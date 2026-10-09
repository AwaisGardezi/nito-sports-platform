/* Proves the documented "add a product" workflow end to end:
   console -> add -> publish -> swap in as the live catalog.js -> the product
   shows up on products.html under the correct sidebar sub-range.

   RETARGETED. This used to drive the old single-file admin panel
   (`#admGate` / `#admNew` / `#e-*` on admin.html). That markup is gone —
   admin.html is now the console shell and product editing lives in
   admin-pages.js. The console's own editor uses the SAME `#e-*` field ids, so
   only the gate, the screen navigation and the export button changed. The
   end-to-end claim itself (an edit in the console reaches a customer page) is
   the most important thing this suite proves, so it was retargeted, not removed. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const LIVE = path.join(ROOT, 'assets/js/catalog.js');
const BACKUP = path.join(ROOT, 'tests/catalog.before-add.js');
const ORIGINAL = path.join(ROOT, 'tests/catalog.original.js');

let fail = 0;
const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '   [' + x + ']' : '')); if (!c) fail++; };

async function settle(p, fn, timeout) {
  const deadline = Date.now() + (timeout || 2500);
  for (;;) {
    let v = null;
    try { v = await p.evaluate(fn); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() > deadline) return v;
    await new Promise((r) => setTimeout(r, 60));
  }
}

(async () => {
  /* ---- safety net ---------------------------------------------------------
     This suite overwrites the live catalog.js. Whatever happens below, the
     original must be back on disk before we exit — a failed run that leaves a
     test catalogue live is worse than the failure itself. */
  const pristine = fs.readFileSync(LIVE, 'utf8');
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    try { fs.writeFileSync(LIVE, pristine); } catch (e) {}
  };
  process.on('exit', restore);
  process.on('SIGINT', () => { restore(); process.exit(130); });

  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const p = await b.newPage();
    p.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });
    await p.setViewport({ width: 1500, height: 1000 });

    // capture whatever the console hands to the download anchor
    await p.evaluateOnNewDocument(() => {
      window.__exported = null;
      URL.createObjectURL = function (blob) {
        try {
          const fr = new FileReader();
          fr.onload = () => { window.__exported = fr.result; };
          fr.readAsText(blob);
        } catch (e) {}
        return 'blob:stub';
      };
      URL.revokeObjectURL = function () {};
    });

    await p.goto(BASE + '/login.html', { waitUntil: 'networkidle2' });
    await settle(p, () => !!window.NitoPlatform);
    const up = await p.evaluate(async () => {
      try {
        const u = await window.NitoPlatform.signUp('owner@nitosports.test', 'testpass123', 'Awais Haider');
        return { ok: true, role: u && u.role };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    ok('owner account created', up.ok && up.role === 'owner', up.err || ('role=' + up.role));

    await p.goto(BASE + '/admin.html', { waitUntil: 'networkidle2' });
    await settle(p, () => !!document.querySelector('#sideNav .side__link[href="#/products"]'));
    ok('console shell opened', await p.evaluate(() => !!document.querySelector('#sideNav')));

    /* ---- navigate to Products the way a person would ----------------------- */
    await p.evaluate(() => {
      const a = document.querySelector('#sideNav .side__link[href="#/products"]');
      if (a) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    ok('products screen opened', !!(await settle(p, () => !!document.querySelector('#pNew'), 3000)));

    const before = await p.evaluate(() => {
      const t = document.querySelector('#pCount');
      const m = t && /of\s+(\d+)\s+product/.exec(t.textContent);
      return m ? Number(m[1]) : null;
    });
    console.log('  products before:', before);
    ok('console starts with the full 55-line catalogue', before === 55, String(before));

    /* ---- add the product exactly as a person would ------------------------- */
    await p.evaluate(() => document.querySelector('#pNew').click());
    ok('editor opened', !!(await settle(p, () => !!document.querySelector('#e-name'), 3000)));

    await p.evaluate(() => {
      const set = (sel, val) => {
        const e = document.querySelector(sel);
        if (e) { e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
      };
      set('#e-code', 'NTO-1016');
      set('#e-name', 'Cricket Sweater');
      set('#e-cat', 'teamwear');
      set('#e-flat', 'jersey');
      set('#e-blurb', 'Knitted V-neck sweater in club colours.');
      set('#e-desc', 'Traditional cricket sweater in a heavyweight knit, with contrast V-neck and ribbed cuffs.');
      set('#e-fabric', '100% acrylic knit, cotton-face option available');
      set('#e-gsm', '320 GSM');
      set('#e-moq', '30 pieces per design');
      set('#e-sizes', 'Youth XS–XL · Adult S–4XL');
      set('#e-lead', '12–18 days after artwork approval');
      set('#e-custom', 'Embroidered club crest\nContrast neck trim');
      set('#e-tags', 'Core Range');
      document.querySelector('#e-save').click();
    });

    const added = await settle(p, () => /Cricket Sweater/.test(document.querySelector('#pTable').textContent), 4000);
    ok('product appears in the console list', !!added);
    const after = await p.evaluate(() => {
      const t = document.querySelector('#pCount');
      const m = t && /of\s+(\d+)\s+product/.exec(t.textContent);
      return m ? Number(m[1]) : null;
    });
    ok('console count rose to 56', after === 56, String(after));

    /* ---- publish ----------------------------------------------------------- */
    await p.evaluate(() => document.querySelector('#pPublish').click());
    const src = await settle(p, () => (typeof window.__exported === 'string' ? window.__exported : null), 4000);
    ok('publish produced catalog.js', typeof src === 'string' && src.length > 5000, src ? src.length + ' bytes' : 'null');
    ok('published file contains the new product', typeof src === 'string' && /Cricket Sweater/.test(src));
    ok('published file does NOT contain console-only bookkeeping',
      typeof src === 'string' && !/"(createdAt|updatedAt|published)"\s*:/.test(src));

    if (typeof src !== 'string') throw new Error('no published source to swap in');

    /* ---- swap it in as the live catalogue ---------------------------------- */
    fs.writeFileSync(BACKUP, pristine);
    fs.writeFileSync(LIVE, src);
    console.log('  swapped published catalog.js in as the live file');

    const p2 = await b.newPage();
    const errs = [];
    p2.on('pageerror', (e) => errs.push(e.message));
    await p2.setViewport({ width: 1440, height: 1100 });
    // the swap happens on disk, so the HTTP cache must not serve the old file
    await p2.setCacheEnabled(false);

    // total count should now be 56
    await p2.goto(BASE + '/products.html', { waitUntil: 'networkidle2' });
    const count = await settle(p2, () => {
      const t = document.querySelector('#productCount');
      return t && /of 56 product lines/.test(t.textContent) ? t.textContent.trim() : null;
    }, 3000);
    ok('catalogue total rose to 56 on the live site', !!count, count || 'not found');

    // it should file itself under teamwear -> Cricket
    await p2.goto(BASE + '/products.html?cat=teamwear&sub=Cricket', { waitUntil: 'networkidle2' });
    const inCricket = await settle(p2, () => {
      const grid = document.querySelector('#productGrid');
      if (!grid) return null;
      return /Cricket Sweater/.test(grid.textContent) && /NTO-1016/.test(grid.textContent);
    }, 3000);
    ok('new product appears under Teamwear -> Cricket', !!inCricket);

    // search should find it too
    await p2.goto(BASE + '/products.html?q=Cricket%20Sweater', { waitUntil: 'networkidle2' });
    ok('search finds the new product',
      !!(await settle(p2, () => /Cricket Sweater/.test(document.querySelector('#productGrid').textContent), 3000)));

    ok('no page errors on the live pages', errs.length === 0, errs.join(' | '));
  } catch (e) {
    console.log('  FAIL  workflow threw: ' + e.message);
    fail++;
  }

  /* ---- restore ------------------------------------------------------------ */
  restore();
  const same = fs.readFileSync(LIVE, 'utf8') === pristine;
  ok('original catalog.js restored', same);
  if (fs.existsSync(ORIGINAL)) {
    const md5 = (f) => require('crypto').createHash('md5').update(fs.readFileSync(f)).digest('hex');
    console.log('  catalog.js md5:', md5(LIVE).slice(0, 8), '| known-good:',
      md5(ORIGINAL).slice(0, 8));
  }

  console.log(fail ? '\nADD-PRODUCT FAILURES: ' + fail : '\nADD-PRODUCT WORKFLOW OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
