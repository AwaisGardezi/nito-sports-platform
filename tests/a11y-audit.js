/* Quality + accessibility audit across every page. Checks the things that are
   cheap to get wrong and expensive to notice: missing alt text, unlabelled
   form controls, buttons and links with no accessible name, duplicate ids,
   heading-order skips, multiple h1s, target=_blank without rel=noopener,
   positive tabindex, and missing title/description/lang. */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';

const PAGES = [
  ['/', 'home'], ['/products.html', 'products'], ['/product.html?id=football-kit', 'product'],
  ['/quote.html', 'quote'], ['/about.html', 'about'], ['/customization.html', 'customization'],
  ['/contact.html', 'contact'], ['/admin.html', 'admin'], ['/404.html', '404']
];

const AUDIT = () => {
  const out = { errors: [], warnings: [] };
  const E = (m) => out.errors.push(m);
  const W = (m) => out.warnings.push(m);

  const name = (n) => (n.tagName.toLowerCase() +
    (n.id ? '#' + n.id : '') +
    (n.className && n.className.toString ? '.' + n.className.toString().split(' ').filter(Boolean).join('.') : ''));

  const accName = (n) => {
    const t = (n.getAttribute('aria-label') || '').trim();
    if (t) return t;
    const lb = n.getAttribute('aria-labelledby');
    if (lb) {
      const r = lb.split(/\s+/).map((id) => {
        const e = document.getElementById(id);
        return e ? e.textContent.trim() : '';
      }).join(' ').trim();
      if (r) return r;
    }
    const title = (n.getAttribute('title') || '').trim();
    if (title) return title;
    const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt) return txt;
    const img = n.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();
    const svgTitle = n.querySelector('svg > title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    return '';
  };

  /* ---- lang / title / description ---- */
  const html = document.documentElement;
  if (!html.getAttribute('lang')) E('page has no lang attribute');
  if (!document.title || !document.title.trim()) E('page has no <title>');
  const desc = document.querySelector('meta[name="description"]');
  if (!desc || !desc.getAttribute('content')) W('page has no meta description');

  /* ---- multiple h1 / heading order ---- */
  const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .filter((h) => h.offsetParent !== null || h.getClientRects().length);
  const h1s = hs.filter((h) => h.tagName === 'H1');
  if (h1s.length === 0) W('page has no visible <h1>');
  if (h1s.length > 1) W('page has ' + h1s.length + ' visible <h1> elements');
  let prev = 0;
  hs.forEach((h) => {
    const lvl = +h.tagName[1];
    if (prev && lvl > prev + 1) {
      W('heading jumps h' + prev + ' → h' + lvl + ' at "' + h.textContent.trim().slice(0, 40) + '"');
    }
    prev = lvl;
  });

  /* ---- images ---- */
  document.querySelectorAll('img').forEach((im) => {
    if (!im.hasAttribute('alt')) E('<img> with no alt attribute: ' + (im.getAttribute('src') || '').slice(0, 60));
    else if (!im.getAttribute('alt').trim() && !im.getAttribute('aria-hidden') && !im.closest('[aria-hidden="true"]')) {
      /* decorative alt="" is fine; flag only if it is the sole content of a link/button */
      const p = im.closest('a,button');
      if (p && !accName(p).trim()) W('image-only control with empty alt: ' + (im.getAttribute('src') || '').slice(0, 60));
    }
    /* NOTE: do not test im.complete here — a loading="lazy" image below the fold
       has not been requested yet and is not broken. Actual failures are caught
       from the network layer instead. */
  });

  /* ---- links ---- */
  document.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === null) W('<a> with no href: "' + (a.textContent || '').trim().slice(0, 40) + '"');
    else if (!href.trim() || href.trim() === '#') W('<a> with placeholder href: "' + (a.textContent || '').trim().slice(0, 40) + '"');
    if (!accName(a)) E('link with no accessible name: ' + name(a));
    if (a.getAttribute('target') === '_blank') {
      const rel = (a.getAttribute('rel') || '').toLowerCase();
      if (rel.indexOf('noopener') === -1) E('target="_blank" without rel="noopener": ' + href);
    }
  });

  /* ---- buttons ---- */
  document.querySelectorAll('button').forEach((b) => {
    if (!accName(b)) E('button with no accessible name: ' + name(b));
    if (b.type && b.type !== 'submit' && b.type !== 'button' && b.type !== 'reset') W('button with odd type: ' + b.type);
  });

  /* ---- form controls ---- */
  document.querySelectorAll('input,select,textarea').forEach((f) => {
    const t = (f.getAttribute('type') || '').toLowerCase();
    if (t === 'hidden' || t === 'file') return;
    if (f.closest('[hidden]') || f.offsetParent === null) return;
    const id = f.id;
    const lab = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    const wrapped = f.closest('label');
    const aria = f.getAttribute('aria-label') || f.getAttribute('aria-labelledby');
    if (!lab && !wrapped && !aria) E('form control with no label: ' + name(f) + ' (' + t + ')');
  });

  /* ---- duplicate ids ---- */
  const seen = {};
  document.querySelectorAll('[id]').forEach((n) => {
    seen[n.id] = (seen[n.id] || 0) + 1;
  });
  Object.keys(seen).forEach((k) => { if (seen[k] > 1) E('duplicate id "' + k + '" x' + seen[k]); });

  /* ---- positive tabindex ---- */
  document.querySelectorAll('[tabindex]').forEach((n) => {
    if (+n.getAttribute('tabindex') > 0) W('positive tabindex=' + n.getAttribute('tabindex') + ' on ' + name(n));
  });

  /* ---- iframes / svg titles ---- */
  document.querySelectorAll('iframe').forEach((f) => {
    if (!f.getAttribute('title')) W('<iframe> with no title attribute');
  });

  /* ---- landmarks ---- */
  if (!document.querySelector('main, [role="main"]')) W('page has no <main> landmark');
  if (!document.querySelector('nav, [role="navigation"]')) W('page has no <nav> landmark');

  return out;
};

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  let errTotal = 0, warnTotal = 0;
  const perPage = [];

  for (const [url, label] of PAGES) {
    const p = await b.newPage();
    await p.setCacheEnabled(false);
    await p.setViewport({ width: 1280, height: 900 });

    /* catch genuine load failures from the network layer */
    const netFails = [];
    p.on('response', (r) => {
      if (r.status() >= 400) netFails.push(r.status() + ' ' + r.url().replace(BASE, ''));
    });
    p.on('requestfailed', (r) => {
      netFails.push('FAILED ' + r.url().replace(BASE, '') + ' (' + (r.failure() || {}).errorText + ')');
    });

    await p.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const r = await p.evaluate(AUDIT);
    r.errors = netFails.concat(r.errors);
    errTotal += r.errors.length;
    warnTotal += r.warnings.length;
    perPage.push({ label, url, errors: r.errors, warnings: r.warnings });
    await p.close();
  }

  await b.close();

  perPage.forEach((r) => {
    const head = r.label + '  (' + r.url + ')';
    if (!r.errors.length && !r.warnings.length) { console.log('\n' + head + '\n  clean'); return; }
    console.log('\n' + head);
    r.errors.forEach((m) => console.log('  ERROR  ' + m));
    r.warnings.forEach((m) => console.log('  warn   ' + m));
  });

  console.log('\nAUDIT TOTAL: ' + errTotal + ' errors, ' + warnTotal + ' warnings across ' + PAGES.length + ' pages');
  process.exit(errTotal ? 1 : 0);
})();
