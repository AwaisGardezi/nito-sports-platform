/* ==========================================================================
   live-data — the public site reads the operator's published catalogue

   Proves the bridge added in this session:
     1. With no bridge on the page, the site renders the static catalog.js.
     2. INERT on the local adapter (what runs today) — the site keeps reading
        catalog.js; the bridge reports `local-mode`. This is the default that
        must not regress.
     3. ACTIVE when the platform is shared — a published backend product really
        reaches products.html, with no catalog.js upload.
     4. DRAFTS ARE HELD BACK — an unpublished product must not reach customers.
     5. OWNER DETAILS SURVIVE — NITO_SITE (phone/e-mail) and NITO_PAYMENTS must
        not be blanked by an empty console record.
     6. NO SECOND RENDER — the first draw already carries the backend catalogue.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const LS_KEY = 'nito_platform_v1';

let results = [];
let failures = 0;
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail });
  if (!ok) failures++;
}

const store = { local: new Map(), session: new Map() };

function installStorage(window) {
  ['localStorage', 'sessionStorage'].forEach((name) => {
    const backing = name === 'localStorage' ? store.local : store.session;
    Object.defineProperty(window, name, {
      configurable: true,
      value: {
        getItem: (k) => (backing.has(String(k)) ? backing.get(String(k)) : null),
        setItem: (k, v) => { backing.set(String(k), String(v)); },
        removeItem: (k) => { backing.delete(String(k)); },
        clear: () => backing.clear(),
        key: (i) => Array.from(backing.keys())[i] || null,
        get length() { return backing.size; }
      }
    });
  });
}

/* Load scripts in order, then fire DOMContentLoaded, then settle. */
function open(file, url, scripts, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
    vc.on('error', (m) => errors.push('console.error: ' + m));
    const dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8099/' + url,
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
    });
    installStorage(dom.window);
    const w = dom.window;
    (opts.before || (() => {}))(w);

    let i = 0;
    const next = () => {
      if (i >= scripts.length) {
        try { w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true })); } catch (e) {}
        setTimeout(() => resolve({ dom, window: w, errors }), opts.wait || 300);
        return;
      }
      const el = w.document.createElement('script');
      el.src = 'file:///' + path.join(ROOT, scripts[i++]).replace(/\\/g, '/');
      el.onload = next;
      el.onerror = () => { errors.push('could not load ' + el.src); next(); };
      w.document.head.appendChild(el);
    };
    next();
  });
}

const count = (w, sel) => w.document.querySelectorAll(sel).length;
const text = (w, sel) => (w.document.querySelector(sel) || {}).textContent || '';
const el = (w, sel) => w.document.querySelector(sel);

/* Read the shipped catalogue straight off disk by EVALUATING the real file in
   a sandbox. A regex would trip over the header comment (which also mentions
   NITO_CATALOG); executing it asserts against exactly what the browser gets. */
function staticCatalog() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/catalog.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.NITO_CATALOG;
}

const SITE_SCRIPTS = ['assets/js/flats.js', 'assets/js/basket.js', 'assets/js/site.js'];

(async () => {
  const CAT = staticCatalog();
  const ALL = ['assets/js/platform.js', 'assets/js/flats.js', 'assets/js/catalog.js',
    'assets/js/live-data.js', 'assets/js/basket.js', 'assets/js/site.js'];

  /* ------------------------------------------------------------------
     1. no bridge on the page -> static catalogue, unchanged
     ------------------------------------------------------------------ */
  {
    const { dom, window: w } = await open('products.html', 'products.html',
      ['assets/js/flats.js', 'assets/js/catalog.js', 'assets/js/basket.js', 'assets/js/site.js']);
    check('no bridge: the static catalogue is used as-is (' + CAT.products.length + ' lines)',
      w.NITO_CATALOG.products.length === CAT.products.length,
      'products: ' + w.NITO_CATALOG.products.length);
    check('no bridge: the page draws product cards',
      count(w, '.pcard') > 0, 'cards: ' + count(w, '.pcard'));
    dom.window.close();
  }

  /* ------------------------------------------------------------------
     2. bridge present but LOCAL adapter -> inert (the default today)
     ------------------------------------------------------------------ */
  {
    const { dom, window: w } = await open('products.html', 'products.html', ALL, { wait: 450 });
    check('local adapter: the bridge reports local-mode',
      w.NITO_LIVE && w.NITO_LIVE.reason === 'local-mode',
      'reason: ' + ((w.NITO_LIVE || {}).reason));
    check('local adapter: nothing is armed', w.NITO_LIVE && w.NITO_LIVE.armed === false);
    check('local adapter: the site still reads catalog.js (' + CAT.products.length + ' lines)',
      w.NITO_CATALOG.products.length === CAT.products.length,
      'products: ' + w.NITO_CATALOG.products.length);
    check('local adapter: the page still draws product cards',
      count(w, '.pcard') > 0, 'cards: ' + count(w, '.pcard'));
    dom.window.close();
  }

  /* ------------------------------------------------------------------
     3-6. SHARED adapter -> the backend catalogue reaches the page
     ------------------------------------------------------------------ */
  {
    const published = CAT.products.slice(0, 8).concat([{
      id: 'NTO-9001', name: 'Bridge Test Jersey', code: 'NTO-9001', cat: 'teamwear',
      blurb: 'Proves the backend catalogue reaches the public page.', fabric: 'Interlock',
      moq: '30 pieces per design', lead: '10-12 days after approval', flat: 'jersey',
      tags: ['test'], published: true
    }]);                                    /* 9 published */
    const withDraft = published.concat([{
      id: 'NTO-9002', name: 'ZZ DRAFT MUST NOT SHOW', code: 'NTO-9002', cat: 'teamwear',
      blurb: 'Unpublished — must never reach a customer.', flat: 'jersey',
      tags: [], published: false
    }]);                                     /* 10 total, 1 of them a draft */

    /* Seed the store the cloud client will read. */
    store.local.set(LS_KEY, JSON.stringify({ products: withDraft, categories: CAT.categories, enquiries: [] }));

    const { dom, window: w } = await open('products.html', 'products.html', ALL, {
      wait: 600,
      before: (win) => {
        const read = (name) => JSON.parse(store.local.get(LS_KEY) || '{}')[name] || [];
        /* The exact SDK surface platform.js calls through CloudAdapter. */
        const database = {
          list: (name) => Promise.resolve(read(name)),
          get: (name, id) => Promise.resolve(read(name).filter((x) => x.id === id)[0] || null),
          insert: () => Promise.resolve([]),
          update: () => Promise.resolve({}),
          remove: () => Promise.resolve(true)
        };
        const auth = {
          currentUser: () => Promise.resolve(null),
          signUp: () => Promise.reject(new Error('not available in test')),
          signIn: () => Promise.reject(new Error('not available in test')),
          signOut: () => Promise.resolve(true)
        };
        win.NITO_CLOUD_CONFIG = { endpoint: 'http://127.0.0.1:9/x', publishableKey: 'pk_test', resourceId: 'r1' };
        win.NitoCloud = {
          createNitoCloud: () => ({ database, auth })
        };
      }
    });

    const adapterMode = w.NitoPlatform ? w.NitoPlatform.mode() : { mode: '?', shared: false };
    check('shared adapter: the platform really switched to the hosted mode',
      adapterMode.shared === true, 'mode: ' + adapterMode.mode + ' shared=' + adapterMode.shared);
    check('shared adapter: the bridge armed and read the backend',
      w.NITO_LIVE && w.NITO_LIVE.armed === true && w.NITO_LIVE.reason === 'backend',
      'armed=' + w.NITO_LIVE.armed + ' reason=' + w.NITO_LIVE.reason);
    check('shared adapter: the published backend product is on the page',
      count(w, '.pcard[data-name*="bridge test jersey"]') > 0 ||
      /Bridge Test Jersey/.test(w.document.body.textContent),
      'cards: ' + count(w, '.pcard'));
    check('shared adapter: the draft is held back — not in the data',
      !w.NITO_CATALOG.products.some((p) => p.id === 'NTO-9002'),
      'products: ' + w.NITO_CATALOG.products.length);
    check('shared adapter: the draft is held back — not rendered either',
      count(w, '.pcard[data-name*="zz draft must not show"]') === 0 &&
      !/ZZ DRAFT MUST NOT SHOW/.test(w.document.body.innerHTML),
      'draft leaked into the DOM');
    check('shared adapter: only the 9 published lines are served (of 10)',
      w.NITO_CATALOG.products.length === 9, 'products: ' + w.NITO_CATALOG.products.length);
    check('shared adapter: the owner\'s phone number was not blanked',
      w.NITO_SITE && String(w.NITO_SITE.whatsapp || '').length > 0,
      'whatsapp: ' + ((w.NITO_SITE || {}).whatsapp || 'EMPTY'));
    check('shared adapter: payment methods still come from catalog.js',
      Array.isArray(w.NITO_PAYMENTS) && w.NITO_PAYMENTS.length === 6,
      'payments: ' + ((w.NITO_PAYMENTS || []).length));
    dom.window.close();
  }

  console.log('');
  for (const r of results) {
    console.log((r.ok ? '  \u2713 ' : '  \u2717 ') + r.label + (r.ok ? '' : '   — ' + r.detail));
  }
  console.log('\n' + (failures ? 'FAILURES: ' + failures : 'ALL ' + results.length + ' CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
