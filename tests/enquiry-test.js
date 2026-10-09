/* Verifies the enquiry form hands EVERY field to WhatsApp, led by an order
   reference number. Intercepts window.open so the generated wa.me URL can be
   decoded and inspected. */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';

let fail = 0;
const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '   [' + x + ']' : '')); if (!c) fail++; };

async function run(page, url, label) {
  console.log('\n--- ' + label + ' (' + url + ') ---');
  await page.goto(BASE + url, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  await page.evaluate(() => {
    window.__opened = [];
    window.open = function (u) { window.__opened.push(u); return { closed: false, focus() {} }; };
  });

  // fill every field the way a buyer would
  await page.evaluate(() => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('f-name', 'John Whitfield');
    set('f-company', 'Northside FC');
    set('f-country', 'United Kingdom');
    set('f-contact', '+44 7700 900123');
    set('f-product', 'Football / Soccer Match Kit');
    set('f-qty', '120');
    set('f-sizes', 'Adult S-4XL, Youth XS-XL');
    set('f-date', '2026-11-20');
    set('f-custom', 'Full sublimation, embroidered crest, player names');
    set('f-message', 'Please quote including shipping to Manchester.');
    const c = document.getElementById('f-consent');
    if (c) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  await page.evaluate(() => {
    const f = document.getElementById('enquiryForm');
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await new Promise((r) => setTimeout(r, 900));

  const out = await page.evaluate(() => {
    const urls = window.__opened || [];
    const wa = urls.find((u) => /wa\.me|api\.whatsapp/.test(u));
    let msg = '';
    if (wa) {
      const q = wa.split('?text=')[1] || '';
      msg = decodeURIComponent(q);
    }
    const st = document.getElementById('formStatus');
    const chip = st ? st.querySelector('.ref-chip') : null;
    return { wa: !!wa, msg, ref: chip ? chip.textContent : null, statusText: st ? st.textContent.replace(/\s+/g, ' ').trim() : '' };
  });

  ok('WhatsApp handoff fired', out.wa);

  const must = [
    ['Name', 'John Whitfield'],
    ['Company', 'Northside FC'],
    ['Country', 'United Kingdom'],
    ['Contact', '+44 7700 900123'],
    ['Product', 'Football / Soccer Match Kit'],
    ['Quantity', '120'],
    ['Sizes', 'Adult S-4XL'],
    ['Delivery date', '2026-11-20'],
    ['Customization', 'Full sublimation'],
    ['Message', 'shipping to Manchester']
  ];
  must.forEach(([name, needle]) => {
    ok('message carries ' + name, out.msg.indexOf(needle) > -1, needle);
  });

  // order reference
  const refLine = (out.msg.match(/Order ref: (NTO-\d{6}-\d{4})/) || [])[1];
  ok('message leads with an order reference', !!refLine, refLine || 'none');
  ok('reference matches NTO-YYMMDD-NNNN', /^NTO-\d{6}-\d{4}$/.test(refLine || ''));
  const today = new Date();
  const ymd = String(today.getFullYear()).slice(2) +
    String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  ok('reference carries today\'s date (' + ymd + ')', (refLine || '').indexOf('NTO-' + ymd) === 0, refLine || '');
  ok('same reference shown on screen', out.ref === refLine, 'screen=' + out.ref);

  // WhatsApp bold markers
  ok('uses WhatsApp bold markers', out.msg.indexOf('*NEW ENQUIRY') > -1 && out.msg.indexOf('*Buyer*') > -1);

  return { refLine, msg: out.msg };
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 1440, height: 1100 });

  const contact = await run(p, '/contact.html', 'Contact page enquiry');

  // --- double-submit guard ---
  const firstRef = await p.evaluate(() => document.getElementById('enquiryForm').dataset.ref);
  const submitAgain = async () => {
    await p.evaluate(() => {
      window.__opened = [];
      document.getElementById('enquiryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 600));
    return p.evaluate(() => {
      const u = (window.__opened || []).find((x) => /wa\.me/.test(x)) || '';
      return decodeURIComponent(u.split('?text=')[1] || '');
    });
  };

  const again = await submitAgain();
  const againRef = (again.match(/Order ref: (NTO-\d{6}-\d{4})/) || [])[1];
  ok('resubmitting identical details reuses the reference', againRef === firstRef, firstRef + ' -> ' + againRef);

  await p.evaluate(() => {
    const e = document.getElementById('f-qty');
    e.value = '250';
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const changed = await submitAgain();
  const changedRef = (changed.match(/Order ref: (NTO-\d{6}-\d{4})/) || [])[1];
  ok('changing a detail issues a new reference', !!changedRef && changedRef !== firstRef, firstRef + ' -> ' + changedRef);
  ok('changed enquiry carries the new quantity', /Quantity: 250/.test(changed));

  // quote.html carries the basket block too
  await p.goto(BASE + '/products.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => localStorage.setItem('nito_quote_v1', JSON.stringify([
    { id: 'football-kit', qty: 60 }, { id: 'boxing-shorts', qty: 30 }
  ])));
  const quote = await run(p, '/quote.html', 'Quote-list enquiry');

  ok('quote-list message includes the product lines block', /Quote list — 2 product lines/.test(quote.msg));
  ok('quote-list message includes product codes', /NTO-1001/.test(quote.msg) && /NTO-4001/.test(quote.msg));
  ok('quote enquiry got its own reference', quote.refLine !== contact.refLine, contact.refLine + ' vs ' + quote.refLine);

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n=== SAMPLE WHATSAPP MESSAGE (contact page) ===');
  console.log(contact.msg);
  console.log('=== END SAMPLE ===');

  console.log(fail ? '\nENQUIRY FAILURES: ' + fail : '\nENQUIRY OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
