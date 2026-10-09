/* Verify the console's "Publish to website" download is valid JS that re-parses
   into a complete catalogue — this is the file the owner uploads to go live, so
   it is the last mile between an edit and a customer.

   RETARGETED. This suite used to drive the old single-file admin panel
   (`admin.html` + `admin.js`), whose `#admGate` / `#admExport` markup no longer
   exists — admin.html is now the console shell. The old panel's export was the
   ONLY path from an edit to the live site, and `publishCatalog()` in
   admin-pages.js now serves that exact purpose behind `#pPublish`. So the
   round-trip this suite encodes was kept and pointed at the new button rather
   than deleted. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const DL = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/dl';

let fail = 0;
const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '   [' + x + ']' : '')); if (!c) fail++; };

/* The console reads the platform on boot; polling a predicate is deterministic
   where a fixed sleep is a race. */
async function settle(p, fn, timeout) {
  const deadline = Date.now() + (timeout || 2000);
  for (;;) {
    let v = null;
    try { v = await p.evaluate(fn); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() > deadline) return v;
    await new Promise((r) => setTimeout(r, 60));
  }
}

(async () => {
  fs.rmSync(DL, { recursive: true, force: true });
  fs.mkdirSync(DL, { recursive: true });

  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const p = await b.newPage();
  p.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });
  await p.setViewport({ width: 1500, height: 1000 });
  const cdp = await p.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

  // hook the blob the exporter hands to the anchor, so we can read exactly what
  // would be written to catalog.js regardless of headless download plumbing
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

  /* ---- one-time setup. The single account on a browser becomes the owner,
     which is what gives this session the publish permission. ---------------- */
  await p.goto(BASE + '/login.html', { waitUntil: 'networkidle2' });
  /* A fresh browser has no account, so the page itself reveals the setup
     fields. There is no create-account tab any more — the console has exactly
     one staff account and no sign-up. */
  await settle(p, () => {
    const w = document.querySelector('#fPass2Wrap');
    return !!w && !w.hasAttribute('hidden');
  });

  const signedUp = await p.evaluate(async () => {
    try {
      const u = await window.NitoPlatform.signUp('owner@nitosports.test', 'testpass123', 'Awais Haider');
      return { ok: true, role: u && u.role };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  ok('first account is created as owner', signedUp.ok && signedUp.role === 'owner',
    signedUp.err || ('role=' + signedUp.role));

  /* ---- console ------------------------------------------------------------ */
  await p.goto(BASE + '/admin.html', { waitUntil: 'networkidle2' });
  await settle(p, () => !!document.querySelector('#sideNav .side__link[href="#/products"]'));

  await p.evaluate(() => {
    const a = document.querySelector('#sideNav .side__link[href="#/products"]');
    if (a) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  const publishBtn = await settle(p, () => !!document.querySelector('#pPublish'), 3000);
  ok('products screen offers "Publish to website"', !!publishBtn);
  if (!publishBtn) {
    console.log('\nEXPORT FAILURES: ' + (fail + 1));
    await b.close();
    process.exit(1);
  }

  await p.evaluate(() => document.querySelector('#pPublish').click());

  const src = await settle(p, () => (typeof window.__exported === 'string' ? window.__exported : null), 3000);
  ok('publish produces catalog.js content', typeof src === 'string' && src.length > 5000,
    src ? src.length + ' bytes' : 'null');

  ok('the console does NOT offer a plain backup-only path instead',
    await p.evaluate(() => !!document.querySelector('#pExport')));

  if (typeof src === 'string') {
    fs.writeFileSync(path.join(DL, 'catalog.js'), src);
    console.log('  wrote tests/dl/catalog.js for the swap test');
    ok('export defines window.NITO_CATALOG', /window\.NITO_CATALOG\s*=/.test(src));
    ok('export defines window.NITO_SITE', /window\.NITO_SITE\s*=/.test(src));
    ok('export defines window.NITO_PAYMENTS', /window\.NITO_PAYMENTS\s*=/.test(src));
    ok('export mentions the brand', /NITO SPORTS/.test(src));

    /* Console-only bookkeeping must not leak into the published site file, and
       no price field may ever appear — the site is B2B quote-only. */
    ok('published file carries no price field',
      !/"(price|retail|rrp|msrp)"\s*:/.test(src));
    ok('published file strips console bookkeeping',
      !/"(createdAt|updatedAt|published)"\s*:/.test(src));

    // re-parse it the way the browser would
    const probe = await p.evaluate((code) => {
      const w = {};
      try {
        const fn = new Function('window', code + '\nreturn window;');
        const out = fn(w);
        const C = out.NITO_CATALOG;
        if (!C) return { err: 'no catalog' };
        return {
          cats: C.categories.length,
          products: C.products.length,
          firstCode: C.products[0] && C.products[0].code,
          lastCode: C.products[C.products.length - 1] && C.products[C.products.length - 1].code,
          site: !!out.NITO_SITE && typeof out.NITO_SITE === 'object',
          payments: Array.isArray(out.NITO_PAYMENTS),
          missing: C.products.filter((x) => !x.id || !x.name || !x.code || !x.cat).length,
          strayPrice: C.products.filter((x) =>
            x.price !== undefined || x.retail !== undefined || x.rrp !== undefined).length
        };
      } catch (e) { return { err: e.message }; }
    }, src);
    console.log('  re-parsed:', JSON.stringify(probe));
    ok('exported code re-parses without error', !probe.err, probe.err || '');
    ok('exported catalogue has 5 categories', probe.cats === 5, String(probe.cats));
    ok('exported catalogue has 55 products', probe.products === 55, String(probe.products));
    ok('every exported product has id/name/code/cat', probe.missing === 0, String(probe.missing));
    ok('no product carries a price of any kind', probe.strayPrice === 0, String(probe.strayPrice));
    ok('exported code keeps NITO_SITE and NITO_PAYMENTS intact', probe.site && probe.payments);
  }

  console.log(fail ? '\nEXPORT FAILURES: ' + fail : '\nEXPORT OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
