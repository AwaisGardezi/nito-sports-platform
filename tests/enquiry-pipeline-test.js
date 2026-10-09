/* ==========================================================================
   enquiry-pipeline — a lead walks the whole way and arrives

   WHY THIS EXISTS

   The contact form's only previous outcome was to open WhatsApp. No record was
   kept anywhere. That produced a failure mode that looked exactly like success:
   the buyer sees "Enquiry ready", closes the tab without pressing send, and the
   console inbox says "No enquiries yet" forever. Nothing errors, nothing logs,
   and the business quietly loses a lead it paid to attract.

   So the contract this suite protects is not "the form submits". It is:

     1. CAPTURE  — submitting writes the enquiry locally BEFORE WhatsApp is
                   opened, so a popup blocker or a closed tab cannot lose it.
     2. SHAPE    — the stored record uses the field names the console drawer
                   reads (qty/sizes/deadline/custom). A mismatch is invisible
                   in the form and shows as a blank quotation request.
     3. IMPORT   — the console drains the queue on boot and the lead appears in
                   the inbox, exactly once.
     4. DURABLE  — a lead that fails to import stays queued. Losing it is worse
                   than importing it twice.
     5. DECLARED — the buyer is told which channels actually fired.

   Run against a real page and a real console, not two stubbed objects talking
   to each other.
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099';
const EMAIL = 'owner@nitosports.com';
const PASS = 'nito-enq-check-2026';

let results = [];
let failures = 0;
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail });
  if (!ok) failures++;
  console.log((ok ? '  \u2713 ' : '  \u2717 ') + label + (ok ? '' : '   — ' + detail));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Fill the real contact form. Driven through DOM events, not by calling the
   submit handler, because the wiring (validation, ref generation, ordering of
   capture vs window.open) is the part under test. */
async function fillForm(p) {
  return p.evaluate(() => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (!e) return false;
      e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const missing = [];
    [['f-name', 'John Whitfield'], ['f-company', 'Northside FC'],
     ['f-country', 'United Kingdom'], ['f-contact', 'john@northsidefc.co.uk'],
     ['f-product', 'Football Match Kit'], ['f-qty', '120'],
     ['f-sizes', 'Adult S-4XL'], ['f-date', '2026-11-20'],
     ['f-custom', 'Full sublimation, club crest on left chest'],
     ['f-message', 'Shipping to Manchester, need landed cost.']
    ].forEach(([id, v]) => { if (!set(id, v)) missing.push(id); });

    const consent = document.getElementById('f-consent');
    if (consent) { consent.checked = true; consent.dispatchEvent(new Event('change', { bubbles: true })); }
    else missing.push('f-consent');

    return { missing };
  });
}

(async () => {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'enq-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const errors = [];
  const p = await b.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));

  /* A popup blocker is the realistic failure this feature exists to survive, so
     the WhatsApp window is stubbed out and its result controlled. */
  await p.evaluateOnNewDocument(() => {
    window.__openCalls = [];
    window.__allowPopup = true;
    window.open = function (url) {
      window.__openCalls.push(String(url || ''));
      return window.__allowPopup ? { closed: false, focus() {} } : null;
    };
  });

  await p.setViewport({ width: 1440, height: 1000 });

  /* ------------------------------------------------------------ 1 CAPTURE */
  await p.goto(URL + '/contact.html', { waitUntil: 'networkidle2' });
  await sleep(900);

  check('the contact page loads the enquiry capture module',
    await p.evaluate(() => !!window.NitoEnquiries));

  const filled = await fillForm(p);
  check('every enquiry field exists on the form and took a value',
    filled.missing.length === 0, 'missing: ' + JSON.stringify(filled.missing));

  /* The queue must start empty so a later assertion cannot be satisfied by
     residue from another run. */
  await p.evaluate(() => window.localStorage.removeItem('nito_enquiry_queue_v1'));
  check('the queue starts empty',
    await p.evaluate(() => window.NitoEnquiries.pendingCount() === 0));

  await p.evaluate(() => {
    const f = document.getElementById('enquiryForm');
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await sleep(700);

  const captured = await p.evaluate(() => {
    const q = window.NitoEnquiries.pending();
    const e = q[0] || null;
    return {
      count: q.length,
      ref: e ? e.ref : '',
      name: e ? e.name : '',
      // does the record carry the field names the console drawer reads?
      qty: e ? e.qty : null,
      sizes: e ? e.sizes : null,
      deadline: e ? e.deadline : null,
      custom: e ? e.custom : null,
      email: e ? e.email : null,
      phone: e ? e.phone : null,
      status: e ? e.status : null,
      source: e ? e.source : null,
      subject: e ? e.subject : null,
      statusPanel: (document.querySelector('#formStatus') || {}).textContent || ''
    };
  });

  check('submitting records the enquiry locally', captured.count === 1, JSON.stringify(captured));
  check('the record carries a readable NTO reference',
    /^NTO-\d{6}-\d{4}$/.test(captured.ref), 'ref=' + captured.ref);
  check('the record uses the field names the console drawer reads',
    captured.qty === '120' && captured.sizes === 'Adult S-4XL' &&
    captured.deadline === '2026-11-20' && /sublimation/.test(captured.custom || ''),
    JSON.stringify({ qty: captured.qty, sizes: captured.sizes, deadline: captured.deadline }));
  check('a contact that looks like e-mail is stored as e-mail, not a phone',
    captured.email === 'john@northsidefc.co.uk' && captured.phone === '',
    JSON.stringify({ email: captured.email, phone: captured.phone }));
  check('the record starts as a New website enquiry',
    captured.status === 'new' && captured.source === 'website-contact-form',
    JSON.stringify({ status: captured.status, source: captured.source }));
  check('the buyer is told the enquiry is logged, not only that WhatsApp opened',
    /logged in our console/i.test(captured.statusPanel), 'panel=' + captured.statusPanel.slice(0, 90));

  /* ------------------------------------------------- 2 the delivery channels */
  const channels = await p.evaluate(() => ({
    opens: window.__openCalls.length,
    last: window.__openCalls[window.__openCalls.length - 1] || '',
    panel: (document.querySelector('#formStatus') || {}).textContent || ''
  }));
  check('WhatsApp is still opened with the message pre-filled',
    channels.opens === 1 && /wa\.me\/\d+\?text=/.test(channels.last),
    JSON.stringify({ opens: channels.opens }));

  /* The strong form of the guarantee: even with the popup blocked outright, the
     lead is already saved. This is the exact scenario that used to lose it. */
  await p.evaluate(() => { window.__allowPopup = false; window.__openCalls = []; });
  await p.evaluate(() => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
    };
    set('f-name', 'Blocked Popup Buyer');
    set('f-message', 'Popup blocker test');
    document.getElementById('enquiryForm')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await sleep(700);
  const blocked = await p.evaluate(() => {
    const q = window.NitoEnquiries.pending();
    const last = q[q.length - 1];
    return {
      count: q.length,
      lastName: last ? last.name : '',
      panel: (document.querySelector('#formStatus') || {}).textContent || ''
    };
  });
  check('a blocked WhatsApp popup still records the lead',
    blocked.count === 2 && blocked.lastName === 'Blocked Popup Buyer',
    JSON.stringify(blocked));

  /* ------------------------------------------- 3 IMPORT into the console */
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await sleep(700);
  /* A fresh browser has no account, so the page offers one-time setup and the
     name/confirm fields are already on screen. There is no sign-up tab. */
  const fresh = await p.evaluate(() => {
    const w = document.querySelector('#fPass2Wrap');
    return !!w && !w.hasAttribute('hidden');
  });
  if (fresh) {
    await p.evaluate((em, pw) => {
      const set = (id, v) => {
        const e = document.getElementById(id);
        if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      set('aName', 'Awais Haider'); set('aEmail', em); set('aPass', pw); set('aPass2', pw);
      document.querySelector('#authSubmit').click();
    }, EMAIL, PASS);
  } else {
    await p.evaluate((em, pw) => {
      const set = (id, v) => {
        const e = document.getElementById(id);
        if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      set('aEmail', em); set('aPass', pw);
      const f = document.querySelector('#authForm');
      if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, EMAIL, PASS);
  }
  await p.waitForFunction(() => !!document.querySelector('#shell') &&
    document.querySelector('#shell').hidden === false, { timeout: 9000 }).catch(() => {});
  await sleep(1500);

  const imported = await p.evaluate(async () => {
    const rows = await window.NitoPlatform.list('enquiries');
    return {
      count: rows.length,
      names: rows.map((r) => r.name),
      pendingLeft: window.NitoEnquiries.pendingCount(),
      badge: (document.querySelector('#sideNav .side__badge') || {}).textContent || ''
    };
  });
  check('both queued leads are imported into the console',
    imported.count === 2, JSON.stringify(imported));
  check('the imported leads keep the buyer names',
    imported.names.indexOf('John Whitfield') > -1 &&
    imported.names.indexOf('Blocked Popup Buyer') > -1,
    JSON.stringify(imported.names));
  check('the queue is emptied once imported', imported.pendingLeft === 0,
    'pending=' + imported.pendingLeft);
  check('the sidebar badge counts them as new', imported.badge === '2', 'badge=' + imported.badge);

  /* --------------------------------------- 4 the inbox shows a real lead */
  await p.evaluate(() => { location.hash = '#/enquiries'; });
  await sleep(1200);
  const inbox = await p.evaluate(() => {
    const rows = [].slice.call(document.querySelectorAll('#qTable tbody tr'));
    const first = rows[0];
    return {
      rows: rows.length,
      text: first ? first.textContent.replace(/\s+/g, ' ').trim() : '',
      hasCsv: !!document.querySelector('#qCsv')
    };
  });
  check('the enquiries inbox lists the imported leads', inbox.rows === 2, JSON.stringify(inbox));
  check('the inbox row shows the buyer and reference',
    /Whitfield|Blocked Popup Buyer/.test(inbox.text) && /NTO-\d{6}-\d{4}/.test(inbox.text),
    JSON.stringify(inbox.text));

  /* Open the lead and confirm the quotation detail survived the round trip —
     this is what the operator actually quotes from. */
  await p.evaluate(() => {
    const b2 = document.querySelector('#qTable [data-open]');
    if (b2) b2.click();
  });
  await sleep(800);
  const drawer = await p.evaluate(() => {
    const d = document.querySelector('#drawerBody');
    return d ? d.textContent.replace(/\s+/g, ' ') : '';
  });
  check('the enquiry drawer shows the full quotation detail',
    /120/.test(drawer) && /Adult S-4XL/.test(drawer) && /2026-11-20/.test(drawer) &&
    /sublimation/i.test(drawer),
    'drawer=' + drawer.slice(0, 160));
  check('the drawer offers a WhatsApp reply link built from the buyer contact',
    await p.evaluate(() => {
      const a = document.querySelector('#drawerBody a[href*="wa.me"], #drawerBody a[href*="mailto"]');
      return !!a;
    }));

  /* ------------------------------------------------- 5 status + CSV export */
  await p.evaluate(() => {
    const s = document.querySelector('#q-status');
    if (s) { s.value = 'quoted'; s.dispatchEvent(new Event('change', { bubbles: true })); }
    const save = document.querySelector('#q-save');
    if (save) save.click();
  });
  await sleep(1000);
  const restatused = await p.evaluate(async () => {
    const rows = await window.NitoPlatform.list('enquiries');
    return rows.filter((r) => r.status === 'quoted').length;
  });
  check('an enquiry can be re-statused to Quoted and it persists',
    restatused === 1, 'quoted=' + restatused);

  const csv = await p.evaluate(() => {
    /* Capture the generated blob text without needing a download folder. */
    let text = null;
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      try {
        const fr = new FileReader();
        fr.onload = () => { text = fr.result; };
        fr.readAsText(blob);
      } catch (e) {}
      return 'blob:stub';
    };
    URL.revokeObjectURL = function () {};
    const btn = document.querySelector('#qCsv');
    if (btn) btn.click();
    return new Promise((r) => setTimeout(() => {
      URL.createObjectURL = realCreate;
      r(text);
    }, 500));
  });
  check('the CSV export produces a file', !!csv && csv.length > 0,
    'csv=' + (csv ? csv.length + ' chars' : 'null'));
  check('the CSV has a header row and one row per enquiry',
    !!csv && /Reference/.test(csv.split('\n')[0]) &&
    csv.split('\r\n').filter((l) => l.trim()).length === 3,
    'lines=' + (csv ? csv.split('\r\n').length : 0));
  check('the CSV carries the buyer detail an operator needs to quote',
    !!csv && /Whitfield/.test(csv) && /Adult S-4XL/.test(csv) && /120/.test(csv));

  /* A cell beginning =, +, - or @ is a live formula in Excel, so a buyer whose
     message starts with "-" would execute in the operator's spreadsheet. Every
     cell here is a quoted string, so a formula can only appear immediately
     after an opening quote or a comma-quote. */
  const formulaCell = !!csv && /(,|\r\n|^)"[=+@-]/.test(csv);
  check('no CSV cell can be read as a spreadsheet formula', !formulaCell,
    'formula-looking cell found in: ' + (csv ? csv.slice(0, 120) : 'null'));

  /* ----------------------------------- 6 a failed import must not lose it */
  const resilient = await p.evaluate(async () => {
    /* Queue a lead, then make the writer fail and confirm it stays queued. */
    window.NitoEnquiries.clear();
    window.NitoEnquiries.record({ ref: 'NTO-991231-9999', name: 'Resilience Test' });
    const res = await window.NitoEnquiries.drain(function () {
      return Promise.reject(new Error('simulated write failure'));
    });
    const left = window.NitoEnquiries.pendingCount();
    window.NitoEnquiries.clear();
    return { failed: res.failed, moved: res.moved, left: left };
  });
  check('a lead whose import fails stays queued rather than being destroyed',
    resilient.failed === 1 && resilient.moved === 0 && resilient.left === 1,
    JSON.stringify(resilient));

  await b.close();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}

  console.log('');
  const realErrors = errors.filter((e) => !/navigation to another Document/.test(e));
  check('no page errors during the whole pipeline', realErrors.length === 0,
    realErrors.slice(0, 3).join(' | '));
  console.log('\n' + (failures ? 'FAILURES: ' + failures : 'ALL ' + results.length + ' CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
