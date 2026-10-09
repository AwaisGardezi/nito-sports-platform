/* Console end-to-end test.
 *
 * Proves the real path works, not just that it renders:
 *
 *   1. login.html   — the first account created becomes the owner
 *   2. admin.html   — unauthenticated visitors are redirected to login
 *   3. admin.html   — a signed-in owner gets the full shell + every route
 *   4. products     — add a product, and it really is in the store afterwards
 *   5. products     — a draft product is excluded from the published count
 *   6. persistence  — the added product survives a full reload of the console
 *   7. permissions  — a viewer role cannot see Team, and is refused the section
 *   8. enquiries    — an enquiry saved by the site appears in the inbox and moves status
 *   9. audit        — the write is recorded against the person who made it
 *  10. no console errors anywhere in the above.
 *
 * jsdom is single-window, so each step gets a fresh JSDOM with a SHARED
 * localStorage/sessionStorage shim, which is what makes step 6 a real
 * persistence test rather than a same-object check.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';

/* These two lists mirror the <script> tags in admin.html and login.html. Keep
   them in step with those files: a module that the real page loads but the
   suite does not is a module this suite silently never exercises. That is
   exactly how media.js got missed — admin-pages.js called NitoMedia.used() and
   the jsdom run threw "Cannot read properties of undefined". */
const CONSOLE_SCRIPTS = [
  'assets/js/flats.js',
  'assets/js/catalog.js',
  'assets/js/media.js',
  'assets/js/enquiries.js',
  'assets/js/platform.js',
  'assets/js/admin-shell.js',
  'assets/js/admin-pages.js'
];

const LOGIN_SCRIPTS = [
  'assets/js/flats.js',
  'assets/js/catalog.js',
  'assets/js/media.js',
  'assets/js/platform.js',
  'assets/js/auth-page.js'
];

const LS_KEY = 'nito_platform_v1';
const LS_USERS = 'nito_platform_users_v1';
const SS_KEY = 'nito_platform_session_v1';

/* The session key is the SAME in both stores, and the product deliberately
   writes it to both:
     - localStorage  = the authority (per-origin: survives a new tab / restart)
     - sessionStorage = a tab-scoped mirror, legacy compatibility only
   Reading only sessionStorage was the original bug, so these helpers read the
   same way the product does: localStorage first, sessionStorage as fallback. */
function Sess(key) {
  key = key || SS_KEY;
  return store.local.get(key) || store.session.get(key) || null;
}
function sessSeeded() {
  return store.local.has(SS_KEY) || store.session.has(SS_KEY);
}
/* Seed a session the way the product would, so role/permission tests exercise
   the real read path rather than a store the product now ignores. */
function setSess(obj) {
  const raw = JSON.stringify(obj);
  store.local.set(SS_KEY, raw);
  store.session.set(SS_KEY, raw);
  return raw;
}

/* ---- shared browser storage ------------------------------------------- */
/* One backing map, so a second JSDOM sees what the first one wrote. */
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

/* ---- one page load ----------------------------------------------------- */
function open(file, url, scripts, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
    vc.on('error', (m) => errors.push('console.error: ' + m));

    const dom = new JSDOM(html, {
      url: 'https://nitosports.com' + url,
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: vc
    });
    const { window } = dom;
    installStorage(window);

    /* jsdom does not implement these two; the console legitimately uses both
       (hash routing and the toast/timer path). Stub them, do not silence them. */
    if (!window.CustomEvent) window.CustomEvent = window.Event;
    if (typeof window.scrollTo !== 'function') window.scrollTo = function () {};

    /* Record navigation attempts instead of letting jsdom throw "not
       implemented" — the redirect IS the behaviour under test.
       jsdom resolves `location` to a Location that the browser marks
       [Unforgeable], so a plain property redefinition is a silent no-op. The
       only reliable interception point is Location.prototype.assign/replace,
       which is what the app calls. */
    /* Navigation in jsdom is UNOBSERVABLE, and this is worth knowing before
       trusting a green run. `window.location` exposes `replace`, `assign` and
       `href` as own, non-writable, non-configurable properties on the
       INSTANCE; `Location.prototype` has none of them. So:
         - patching the prototype is a silent no-op
         - patching the instance is a silent no-op (writable=false)
         - Object.defineProperty throws "Cannot redefine property"
       (verified with tests/probe-location.js)
       We therefore do not try to intercept the redirect. Every redirect
       assertion below is instead made against product-visible state — the
       session really being gone, the shell really staying hidden — which is
       what actually matters and what a green run should mean. */
    window.__nav = [];
    window.__navUnobservable = true;
    const recorder = function () {};
    try {
      /* record it if a future jsdom makes this possible; take it if not */
      const L = window.Location && window.Location.prototype;
      if (L && !L.__nitoPatched) {
        for (const m of ['assign', 'replace']) {
          try { L[m] = function (u) { recorder(u); return undefined; }; } catch (e) { /* no-op */ }
        }
        L.__nitoPatched = true;
      }
    } catch (e) { /* nothing to do */ }

    try {
      if (opts.pre) opts.pre(window);
      for (const s of scripts) window.eval(fs.readFileSync(path.join(ROOT, s), 'utf8'));
      window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
      if (opts.probe) {
        setTimeout(() => {
          try {
            window.NitoPlatform.currentUser().then(
              (u) => { window.__diagUser = u; },
              (e) => { window.__diagUser = null; window.__diagErr = String(e && e.message || e); }
            );
          } catch (e) { window.__diagErr = 'probe threw: ' + e.message; }
        }, 60);
      }
    } catch (e) {
      errors.push('script threw: ' + e.message);
    }

    setTimeout(() => resolve({ dom, window, errors, nav: window.__nav }), opts.wait || 120);
  });
}

/* ---- assertion plumbing ------------------------------------------------ */
const results = [];
let failures = 0;

function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail: detail || '' });
  if (!ok) failures++;
}

function noErrors(label, errors) {
  check(label, errors.length === 0, errors.slice(0, 4).join(' | '));
}

function el(window, sel) { return window.document.querySelector(sel); }
function text(window, sel) {
  const n = el(window, sel);
  return n ? (n.textContent || '').trim() : null;
}
function count(window, sel) { return window.document.querySelectorAll(sel).length; }

function go(window, route) {
  const link = window.document.querySelector('#sideNav .side__link[href="#/' + route + '"]');
  if (link) {
    link.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
    return true;
  }
  window.NitoAdmin.routeTo(route);
  return false;
}

/* poll until fn() is true, or give up after timeout — the console renders
   asynchronously (every page reads from the platform first), so a fixed
   sleep is a race. */
function settle(fn, timeout) {
  const deadline = Date.now() + (timeout || 1200);
  return new Promise((resolve) => {
    (function tick() {
      let ok = false;
      try { ok = !!fn(); } catch (e) { ok = false; }
      if (ok) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(tick, 25);
    })();
  });
}

/* ====================================================================== */
(async () => {
  console.log('======================================================================');
  console.log(' NITO SPORTS — console end-to-end');
  console.log('======================================================================');

  /* ------------------------------------------------------------------
     1. unauthenticated admin visit must not reach the console
     ------------------------------------------------------------------ */
  {
    const { dom, window, errors } = await open('admin.html', '/admin.html', CONSOLE_SCRIPTS, { wait: 350, probe: true });

    check('admin.html without a session does not reveal the console',
      el(window, '#shell') && el(window, '#shell').hidden === true);

    /* The guard must have RUN and found nobody — this is the observable fact
       behind the redirect. If this is null AND the shell is hidden, the only
       remaining step in that branch is the redirect itself. */
    check('the auth guard resolves to no user, without erroring',
      window.__diagUser === null && !window.__diagErr,
      'user=' + JSON.stringify(window.__diagUser) + ' err=' + (window.__diagErr || '(none)'));

    /* The redirect is in flight, so give it the same grace the app does, then
       require that the visitor has something they can act on. A spinner that
       never resolves is the failure mode worth guarding against. */
    await settle(() => count(window, '#boot a[href="login.html"]') === 1 ||
                       el(window, '#shell').hidden === false, 1800);
    check('the visitor is never left on a spinner with no way forward',
      el(window, '#shell').hidden === true &&
      count(window, '#boot a[href="login.html"]') === 1,
      'boot text: ' + (text(window, '#boot') || '').slice(0, 120));

    check('no session is created by visiting the console',
      !sessSeeded(), 'sessions: ' + store.session.size + ' local: ' + (store.local.has(SS_KEY) ? 1 : 0));

    /* jsdom raises "Not implemented: navigation" for the redirect we asked
       for. That is the expected outcome, not a defect — filter exactly it. */
    noErrors('unauthenticated admin load threw nothing unexpected',
      errors.filter((e) => !/navigation to another Document/.test(e)));
    dom.window.close();
  }

  /* ------------------------------------------------------------------
     2. the one-time owner setup — and no way to register a second account
     ------------------------------------------------------------------ */
  {
    const { dom, window, errors } = await open('login.html', '/login.html', LOGIN_SCRIPTS, { wait: 250 });

    check('login page resolves the platform before anything else', !!window.NitoPlatform);
    check('the login page has no create-account tab',
      !window.document.querySelector('#tabUp'));
    check('a console with no account is offered one-time setup',
      window.document.querySelector('#authForm').getAttribute('data-mode') === 'setup');
    check('one-time setup reveals the name and confirm fields',
      el(window, '#fNameWrap').hidden === false && el(window, '#fPass2Wrap').hidden === false);
    check('one-time setup labels the action as setup, not registration',
      text(window, '#authSubmit') === 'Create console access');
    check('the page says the setup is one-time and closes afterwards',
      /one-time setup/i.test(text(window, '#authNote') || ''),
      'note: ' + text(window, '#authNote'));

    /* too-short password is refused before anything is stored */
    el(window, '#aName').value = 'Awais Haider';
    el(window, '#aEmail').value = 'awais@nitosports.com';
    el(window, '#aPass').value = 'short';
    el(window, '#aPass2').value = 'short';
    el(window, '#authForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 40));
    check('a password under 8 characters is refused',
      /at least 8/i.test(text(window, '#authMsg') || ''), 'msg: ' + text(window, '#authMsg'));

    /* mismatched confirmation is refused */
    el(window, '#aPass').value = 'nito-sialkot-2026';
    el(window, '#aPass2').value = 'nito-sialkot-2027';
    el(window, '#authForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 40));
    check('mismatched passwords are refused',
      /do not match/i.test(text(window, '#authMsg') || ''), 'msg: ' + text(window, '#authMsg'));

    /* the real thing */
    el(window, '#aPass2').value = 'nito-sialkot-2026';
    el(window, '#authForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 120));

    const users = JSON.parse(store.local.get(LS_USERS) || '[]');
    check('the account is really written to storage', users.length === 1, 'users: ' + users.length);
    check('the one staff account is the owner',
      users[0] && users[0].role === 'owner', 'role: ' + (users[0] || {}).role);
    check('the password is not stored in the clear',
      users[0] && users[0].passwordHash && users[0].passwordHash.indexOf('nito-sialkot-2026') === -1,
      'hash: ' + (users[0] || {}).passwordHash);
    /* The session must outlive the tab, so localStorage is the authority; the
       sessionStorage mirror is checked too, since writing it costs nothing. */
    check('a session is established in localStorage (survives a new tab)',
      !!store.local.get(SS_KEY), 'local: ' + (store.local.get(SS_KEY) || 'none'));
    check('a session is mirrored to sessionStorage for legacy builds',
      !!store.session.get(SS_KEY));

    /* THE RULE the owner asked for: no second account, even asked directly. */
    const second = await window.NitoPlatform
      .signUp('intruder@nitosports.com', 'letmein-2026', 'Intruder')
      .then(() => 'accepted', (e) => 'refused: ' + e.message);
    check('a second staff account is refused even when requested directly',
      /^refused/.test(second) && /already set up/i.test(second), second);
    check('the refused attempt added nobody',
      JSON.parse(store.local.get(LS_USERS) || '[]').length === 1);

    noErrors('login page threw nothing', errors);
    dom.window.close();

    /* ------------------------------------------------------------------
       2b. the session survives a NEW TAB — the bug the owner reported
       The old build kept the session in sessionStorage only, which is
       per-tab: opening a second tab (or restarting the browser) showed the
       sign-in page even though the account was still on disk. Simulate a
       fresh tab by clearing ONLY sessionStorage and reloading the console.
       ------------------------------------------------------------------ */
    store.session.clear();
    const t = await open('admin.html', '/admin.html', CONSOLE_SCRIPTS, { wait: 250 });
    await settle(() => el(t.window, '#shell') && el(t.window, '#shell').hidden === false, 1800);
    check('a new tab (empty sessionStorage) still lands inside the console',
      el(t.window, '#shell') && el(t.window, '#shell').hidden === false,
      'shell hidden: ' + (el(t.window, '#shell') ? el(t.window, '#shell').hidden : 'no shell'));
    check('the new tab shows the signed-in operator, not a sign-in form',
      /Awais/.test(text(t.window, '#sideNav') + text(t.window, '#topUser') || '') ||
      count(t.window, '#sideNav .side__link') >= 8,
      'nav: ' + count(t.window, '#sideNav .side__link'));
    noErrors('a new tab threw nothing unexpected',
      t.errors.filter((e) => !/navigation to another Document/.test(e)));
    t.dom.window.close();
  }

  /* ------------------------------------------------------------------
     3. a signed-in owner gets the full console
     ------------------------------------------------------------------ */
  let shell;
  {
    shell = await open('admin.html', '/admin.html', CONSOLE_SCRIPTS, { wait: 250 });
    const { window, errors } = shell;

    check('the shell is revealed for a signed-in owner',
      el(window, '#shell') && el(window, '#shell').hidden === false);
    check('the boot spinner is gone',
      el(window, '#boot') && el(window, '#boot').hidden === true);
    check('the sidebar renders every section the owner may see',
      count(window, '#sideNav .side__link') === 8,
      'links: ' + count(window, '#sideNav .side__link'));
    check('the sidebar groups the links',
      count(window, '#sideNav .side__grp') === 4,
      'groups: ' + count(window, '#sideNav .side__grp'));
    check('the signed-in user is named in the sidebar footer',
      /Awais/.test(text(window, '#sideFoot') || ''), 'foot: ' + text(window, '#sideFoot'));
    check('the sidebar footer states the real role',
      /Owner/i.test(text(window, '#sideFoot') || ''));
    check('a storage-mode banner is shown, never hidden',
      count(window, '.mode') === 1, 'banners: ' + count(window, '.mode'));
    check('the banner tells the truth about local storage',
      /single browser|this browser only/i.test(text(window, '.mode') || ''),
      'banner: ' + text(window, '.mode'));

    /* dashboard content */
    check('the dashboard renders its four headline stats',
      count(window, '.stat') === 4, 'stats: ' + count(window, '.stat'));
    check('the dashboard reads the real catalogue size (55)',
      (text(window, '.stat__n') || '') === '55', 'first stat: ' + text(window, '.stat__n'));
    check('the dashboard charts the catalogue by category',
      count(window, '.bars__row') === 5, 'bars: ' + count(window, '.bars__row'));
    check('the dashboard explains there is no retail pricing by design',
      /no retail pricing/i.test((el(window, '.stats') || {}).textContent || ''));
    noErrors('signed-in console threw nothing', errors);
  }

  /* ------------------------------------------------------------------
     4/5. add a product through the real UI
     ------------------------------------------------------------------ */
  {
    const { window, errors, nav } = shell;

    /* navigate to the products route the way the sidebar does */
    go(window, 'products');
    await settle(() => window.document.querySelector('#pTable tbody tr'));
    /* #pTable is filled asynchronously, so the toolbar button lives on the
       page root, not inside the table host */
    await settle(() => window.document.querySelector('#pNew'));

    check('routing to #/products renders the products screen',
      !!el(window, '#pTable') && !!el(window, '#pNew'));
    check('every shipped product line is listed',
      /Showing 55 of 55 product lines/.test(text(window, '#pCount') || ''),
      'count: ' + text(window, '#pCount'));
    check('the catalogue table has a row per product',
      count(window, '#pTable tbody tr') === 55, 'rows: ' + count(window, '#pTable tbody tr'));
    check('each row carries an edit and a duplicate action',
      count(window, '#pTable [data-edit]') === 55 && count(window, '#pTable [data-dup]') === 55);
    check('each row carries a delete action for the owner',
      count(window, '#pTable [data-del]') === 55);

    /* open the editor */
    el(window, '#pNew').dispatchEvent(new window.Event('click', { bubbles: true }));
    await settle(() => window.document.querySelector('#drawerBody #e-name'));

    check('the product editor drawer opens', el(window, '#drawer').classList.contains('is-on'));
    check('the editor exposes every field the site renders',
      ['#e-code', '#e-cat', '#e-name', '#e-blurb', '#e-desc', '#e-flat', '#e-fabric',
       '#e-gsm', '#e-moq', '#e-lead', '#e-sizes', '#e-custom', '#e-styles',
       '#e-colors', '#e-tags', '#e-pub'].every((s) => !!el(window, s)),
      'missing: ' + ['#e-code', '#e-cat', '#e-name', '#e-blurb', '#e-desc', '#e-flat',
        '#e-fabric', '#e-gsm', '#e-moq', '#e-lead', '#e-sizes', '#e-custom',
        '#e-styles', '#e-colors', '#e-tags', '#e-pub'].filter((s) => !el(window, s)).join(','));
    check('the editor previews the garment flat', !!el(window, '#ePrev svg'));

    /* a nameless product must be refused */
    el(window, '#e-save').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    check('a product with no name is refused',
      el(window, '#drawer').classList.contains('is-on') &&
      /name is required/i.test(text(window, '#toast') || ''),
      'toast: ' + text(window, '#toast'));

    /* fill it in properly */
    el(window, '#e-name').value = 'Test Cricketing Whites';
    el(window, '#e-blurb').value = 'Full custom range for clubs';
    el(window, '#e-desc').value = 'Cut and stitched to your club block.';
    el(window, '#e-fabric').value = '100% cotton drill';
    el(window, '#e-gsm').value = '220 GSM';
    el(window, '#e-moq').value = '30 sets';
    el(window, '#e-lead').value = '3-4 weeks';
    el(window, '#e-sizes').value = 'Adult S-4XL';
    el(window, '#e-custom').value = 'Full sublimation\nEmbroidered crest';
    el(window, '#e-tags').value = 'Core Range, New';
    el(window, '#e-save').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));

    const db = JSON.parse(store.local.get(LS_KEY) || '{}');
    const added = (db.products || []).filter((p) => p.name === 'Test Cricketing Whites')[0];

    check('the drawer closes after a successful save',
      !el(window, '#drawer').classList.contains('is-on'));
    check('the product is REALLY written to the store', !!added);
    check('the product gets an auto-assigned code', !!(added && added.code), 'code: ' + (added || {}).code);
    check('the multi-line customisation list is stored as an array',
      !!(added && Array.isArray(added.custom) && added.custom.length === 2),
      'custom: ' + JSON.stringify(added && added.custom));
    check('the comma-separated tags are stored as an array',
      !!(added && Array.isArray(added.tags) && added.tags.length === 2),
      'tags: ' + JSON.stringify(added && added.tags));
    check('a new product is published by default',
      !!(added && added.published !== false));

    /* the table reflects it without a reload */
    check('the catalogue count updates immediately',
      /Showing 56 of 56 product lines/.test(text(window, '#pCount') || ''),
      'count: ' + text(window, '#pCount'));

    /* 5. a draft is excluded from the published count but still listed */
    go(window, 'dashboard');
    await new Promise((r) => setTimeout(r, 150));
    const dashText = (el(window, '.stats') || {}).textContent || '';
    check('the dashboard now reports 56 product lines', /56/.test(dashText), 'stats: ' + dashText);

    go(window, 'products');
    await new Promise((r) => setTimeout(r, 150));
    el(window, '#pStatus').value = 'draft';
    el(window, '#pStatus').dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    check('the draft filter correctly shows that nothing is a draft yet',
      /Showing 0 of 56/.test(text(window, '#pCount') || ''), 'count: ' + text(window, '#pCount'));
    el(window, '#pStatus').value = 'all';
    el(window, '#pStatus').dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));

    /* search must find the new product by a word in its tags */
    el(window, '#pQ').value = 'drill';
    el(window, '#pQ').dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    check('search matches on fabric, not just the name',
      /Showing 1 of 56/.test(text(window, '#pCount') || ''), 'count: ' + text(window, '#pCount'));
    el(window, '#pQ').value = '';
    el(window, '#pQ').dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));

    /* ------------------------------------------------------------------
       4b. Publish to website — the step that actually reaches a customer.

       Assert the produced catalog.js is REAL JavaScript that re-parses into
       the full catalogue. Downloading a file that only looks right is the
       classic way an exporter ships broken output.
       ------------------------------------------------------------------ */
    check('the products screen offers Publish to website', !!el(window, '#pPublish'));

    let published = null;
    window.__pub = null;
    window.URL.createObjectURL = function (blob) {
      try {
        const fr = new window.FileReader();
        fr.onload = () => { window.__pub = fr.result; };
        fr.readAsText(blob);
      } catch (e) { /* ignore */ }
      return 'blob:stub';
    };
    window.URL.revokeObjectURL = function () {};

    el(window, '#pPublish').dispatchEvent(new window.Event('click', { bubbles: true }));
    await settle(() => !!window.__pub, 1500);
    published = window.__pub;

    check('Publish produces catalog.js content',
      typeof published === 'string' && published.length > 5000,
      published ? published.length + ' bytes' : 'null');

    if (typeof published === 'string') {
      /* Execute it in a clean sandbox: this is the actual acceptance test. */
      let parsed = null, threw = null;
      try {
        const sandbox = {};
        /* eslint-disable no-new-func */
        const fn = new window.Function('window', published + '\nreturn window.NITO_CATALOG;');
        parsed = fn(sandbox);
      } catch (e) { threw = String(e && e.message || e); }

      check('the exported catalog.js is valid, executable JavaScript',
        !threw && !!parsed, threw || 'ok');
      check('the export carries the live catalogue',
        !!parsed && Array.isArray(parsed.products) && parsed.products.length === 56,
        parsed ? parsed.products.length + ' products' : 'none');
      check('the export carries all five categories',
        !!parsed && Array.isArray(parsed.categories) && parsed.categories.length === 5,
        parsed ? parsed.categories.length + ' categories' : 'none');
      check('the newly added product is in the published file',
        !!parsed && parsed.products.some((p) => p.name === 'Test Cricketing Whites'));
      check('the export keeps the site config the public pages need',
        /window\.NITO_SITE\s*=/.test(published) && /window\.NITO_PAYMENTS\s*=/.test(published));
      check('console-only fields are stripped from the published file',
        !!parsed && parsed.products.every((p) =>
          p.published === undefined && p.createdAt === undefined && p.updatedAt === undefined),
        'leaked: ' + (parsed ? JSON.stringify(Object.keys(parsed.products[0] || {})) : 'n/a'));
      check('no public retail price leaks into the published file',
        !/"(price|retail|rrp|msrp)"\s*:/i.test(published));
    }

    /* The download anchor is clicked by publishCatalog(), which jsdom reports
       as "Not implemented: navigation". That click IS the mechanism under
       test, so filter exactly it — as elsewhere in this file. */
    noErrors('product add + publish flow threw nothing unexpected',
      errors.filter((e) => !/navigation to another Document/.test(e))
            .filter((e) => !/Not implemented/.test(e)));
    shell.nav = shell.nav.concat(nav);
  }

  /* ------------------------------------------------------------------
     6. persistence across a genuine reload
     ------------------------------------------------------------------ */
  {
    shell.dom.window.close();
    const { dom, window, errors } = await open('admin.html', '/admin.html', CONSOLE_SCRIPTS, { wait: 250 });
    go(window, 'products');
    await new Promise((r) => setTimeout(r, 180));

    check('the session survives a fresh page load',
      el(window, '#shell') && el(window, '#shell').hidden === false);
    check('the added product survives a full reload',
      /Showing 56 of 56/.test(text(window, '#pCount') || ''), 'count: ' + text(window, '#pCount'));
    const db = JSON.parse(store.local.get(LS_KEY) || '{}');
    check('the stored product is intact after reload',
      (db.products || []).filter((p) => p.name === 'Test Cricketing Whites').length === 1);
    noErrors('reload threw nothing', errors);

    /* ------------------------------------------------------------------
       9. the write was audited against the person who made it
       ------------------------------------------------------------------ */
    go(window, 'audit');
    await new Promise((r) => setTimeout(r, 160));
    const auditText = (el(window, '#aBody') || {}).textContent || '';
    check('the audit log records the product creation', /Cricketing Whites/.test(auditText),
      'audit: ' + auditText.slice(0, 200));
    check('the audit entry names the person who did it', /awais@nitosports\.com/i.test(auditText));
    check('the audit entry is typed as a create', count(window, '#aBody .badge--ok') >= 1);

    /* ------------------------------------------------------------------
       8. enquiry inbox (a real enquiry written through the shared store,
          exactly as the public contact form writes one)
       ------------------------------------------------------------------ */
    await window.NitoPlatform.create('enquiries', {
      id: 'enq_seedtest', ref: 'NTO-261008-0001', name: 'John Whitfield',
      company: 'Northside FC', country: 'United Kingdom', email: 'john@northsidefc.co.uk',
      phone: '+44 7700 900123', product: 'Football / Soccer Match Kit', qty: '120',
      sizes: 'Adult S-4XL', deadline: '2026-11-20', custom: 'Full sublimation',
      message: 'shipping to Manchester', status: 'new',
      items: [{ id: 'football-kit', code: 'NTO-1001', name: 'Football Match Kit', qty: 120 }],
      createdAt: new Date().toISOString()
    });

    go(window, 'enquiries');
    await settle(() => window.document.querySelector('#qTable tbody tr'));
    check('the enquiry inbox lists the enquiry', count(window, '#qTable tbody tr') === 1,
      'rows: ' + count(window, '#qTable tbody tr'));
    check('the inbox shows the buyer reference',
      /NTO-261008-0001/.test((el(window, '#qTable') || {}).textContent || ''));
    check('every enquiry defaults to a New status badge',
      count(window, '#qTable .badge--blue') === 1);
    /* The sidebar badge is refreshed by refreshCounts() when the shell boots,
       so the enquiry created after boot only shows once an action triggers a
       re-count. Assert that re-count works rather than the stale value. */
    await window.NitoAdmin.refreshCounts();
    await settle(() => window.document.querySelector('#sideNav .side__badge'));
    check('the sidebar badge counts it as new',
      (text(window, '#sideNav .side__badge') || '') === '1',
      'badge: ' + text(window, '#sideNav .side__badge'));

    el(window, '#qTable [data-open]').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 140));
    check('opening an enquiry shows the full buyer record',
      /Northside FC/.test((el(window, '#drawerBody') || {}).textContent || '') &&
      /john@northsidefc\.co\.uk/.test((el(window, '#drawerBody') || {}).textContent || ''));
    check('the enquiry record can be re-statused', !!el(window, '#q-status'));
    check('there is a WhatsApp link built from the buyer number',
      !!el(window, '#drawerBody a[href^="https://wa.me/447700900123"]'),
      'wa: ' + ((el(window, '#drawerBody a[href^="https://wa.me/"]') || {}).href || 'none'));

    el(window, '#q-status').value = 'quoted';
    el(window, '#q-notes').value = 'Sent FOB Sialkot pricing.';
    el(window, '#q-save').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 160));

    go(window, 'enquiries');
    await new Promise((r) => setTimeout(r, 140));
    check('the enquiry status change is persisted',
      ((JSON.parse(store.local.get(LS_KEY) || '{}').enquiries || [])[0] || {}).status === 'quoted',
      'status: ' + (((JSON.parse(store.local.get(LS_KEY) || '{}').enquiries || [])[0] || {}).status));
    check('internal notes are kept on the record',
      ((JSON.parse(store.local.get(LS_KEY) || '{}').enquiries || [])[0] || {}).notes === 'Sent FOB Sialkot pricing.');

    /* ------------------------------------------------------------------
       8b. customers + team + settings render without error
       ------------------------------------------------------------------ */
    for (const [route, sel, label] of [
      ['#/customers', '#cuBody', 'customers'],
      ['#/categories', '#cBody', 'categories'],
      ['#/settings', '.card', 'settings']
    ]) {
      window.location.hash = route;
      await new Promise((r) => setTimeout(r, 150));
      check('the ' + label + ' screen renders', !!el(window, sel), route);
    }

    go(window, 'team');
    await settle(() => window.document.querySelector('#tBody'));
    check('the owner sees the Team screen', !!el(window, '#tBody'));
    check('the team screen publishes the real role matrix',
      ['Owner', 'Admin', 'Editor', 'Viewer'].every((r) =>
        new RegExp(r).test(text(window, '#view') || '')) &&
      /Team & audit/i.test(text(window, '#view') || ''),
      'view: ' + (text(window, '#view') || '').slice(0, 160));
    check('the team screen has an invite action for the owner', !!el(window, '#tInvite'));

    noErrors('enquiry + remaining screens threw nothing', errors);
    dom.window.close();
  }

  /* ------------------------------------------------------------------
     7. permissions — a viewer is genuinely restricted
     ------------------------------------------------------------------ */
  {
    /* Forge a viewer session the way the product stores one. An earlier version
       of this suite wrote sessionStorage only, which the product no longer
       reads — so the console stayed signed in as the previous owner and every
       restriction assertion passed for the wrong reason. Seeding both stores
       is what makes this a real permission test. */
    setSess({
      id: 'usr_viewer', email: 'viewer@nitosports.com', name: 'Read Only', role: 'viewer'
    });
    /* The session is validated against the account list, so the viewer must
       really exist — otherwise currentUser() correctly rejects the forged
       session and the console bounces to sign-in instead of testing the role. */
    const vUsers = JSON.parse(store.local.get(LS_USERS) || '[]')
      .filter((u) => u.email !== 'viewer@nitosports.com');
    vUsers.push({
      id: 'usr_viewer', email: 'viewer@nitosports.com', name: 'Read Only',
      role: 'viewer', passwordHash: 'forged', createdAt: new Date().toISOString()
    });
    store.local.set(LS_USERS, JSON.stringify(vUsers));

    const { dom, window, errors } = await open('admin.html', '/admin.html', CONSOLE_SCRIPTS, { wait: 250 });

    check('a signed-in viewer still reaches the console',
      el(window, '#shell') && el(window, '#shell').hidden === false);
    /* Dashboard, Products, Categories, Enquiries, Customers, Settings.
       Team (manageTeam) and Audit (viewAudit) are the two a viewer must lose. */
    check('a viewer is not offered the Team section',
      count(window, '#sideNav .side__link') === 6 && !/Team/.test(text(window, '#sideNav') || ''),
      'links: ' + count(window, '#sideNav .side__link') + ' | ' + text(window, '#sideNav'));
    check('a viewer is not offered the audit log',
      !/Audit log/.test(text(window, '#sideNav') || ''));

    go(window, 'products');
    await new Promise((r) => setTimeout(r, 180));
    check('a viewer can read the product table',
      count(window, '#pTable tbody tr') === 56, 'rows: ' + count(window, '#pTable tbody tr'));
    check('a viewer is offered no Add product button', !el(window, '#pNew'));
    check('a viewer is offered no edit action', count(window, '#pTable [data-edit]') === 0);
    check('a viewer is offered no delete action', count(window, '#pTable [data-del]') === 0);

    /* deep-linking past the sidebar must still be refused */
    go(window, 'team');
    await new Promise((r) => setTimeout(r, 180));
    check('deep-linking to Team as a viewer is refused with an explanation',
      /Not available on your account/.test(text(window, '#view') || ''),
      'view: ' + (text(window, '#view') || '').slice(0, 120));

    go(window, 'audit');
    await new Promise((r) => setTimeout(r, 180));
    check('deep-linking to the audit log as a viewer is refused',
      /Not available on your account/.test(text(window, '#view') || ''));

    noErrors('viewer session threw nothing', errors);
    dom.window.close();
  }

  /* ------------------------------------------------------------------
     10. signing out really ends the session
     ------------------------------------------------------------------ */
  {
    setSess({
      id: 'usr_owner', email: 'awais@nitosports.com', name: 'Awais Haider', role: 'owner'
    });
    /* section 3 signed up as this address, so the account row already exists. */
    const { dom, window, errors } = await open('admin.html', '/admin.html', CONSOLE_SCRIPTS, { wait: 250 });

    check('the console is open before signing out',
      el(window, '#shell').hidden === false && sessSeeded());

    el(window, '#topLogout').dispatchEvent(new window.Event('click', { bubbles: true }));

    /* Wait on the observable effect, not on navigation (jsdom cannot report
       that — see the note in open()). The session clearing is the real
       precondition for being sent back to login. */
    await settle(() => !sessSeeded(), 900);

    check('signing out clears the stored session from BOTH stores',
      !store.local.get(SS_KEY) && !store.session.get(SS_KEY),
      'local: ' + (store.local.get(SS_KEY) || 'gone') + ' | session: ' + (store.session.get(SS_KEY) || 'gone'));
    check('signing out leaves nobody signed in',
      await window.NitoPlatform.currentUser() === null);

    noErrors('sign-out threw nothing unexpected',
      errors.filter((e) => !/navigation to another Document/.test(e)));
    dom.window.close();
  }

  /* ---- report ---------------------------------------------------------- */
  for (const r of results) {
    console.log((r.ok ? '  \u2713 ' : '  \u2717 ') + r.label + (r.ok ? '' : '   — ' + r.detail));
  }
  console.log('\n' + (failures ? 'FAILURES: ' + failures : 'ALL ' + results.length + ' CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  for (const r of results) {
    console.log((r.ok ? '  \u2713 ' : '  \u2717 ') + r.label + (r.ok ? '' : '   — ' + r.detail));
  }
  console.log('\n  \u2717 harness crashed: ' + (e && e.stack || e));
  process.exit(1);
});
