/* ==========================================================================
   NITO SPORTS — Live catalogue bridge
   --------------------------------------------------------------------------
   Loaded BEFORE assets/js/site.js on every public page.

   WHY THIS EXISTS
   The public site reads `assets/js/catalog.js` — a static file. The admin
   console writes to the platform (localStorage today, the hosted backend once
   it is provisioned). Without this bridge those are two separate worlds: an
   operator can save a product and no customer ever sees it until a human
   downloads `catalog.js` and uploads it over the live file.

   With this bridge, when the platform is SHARED (the hosted backend), the
   public pages read the operator's published lines directly. Saving in the
   console is enough — no file to download, no upload step.

   HOW IT IS WIRED
   This file publishes `window.NITO_LIVE.ready` — a promise. `site.js`'s boot()
   awaits it before taking its catalogue snapshot, so the backend data is
   already in place on the first draw. There is no second render pass.

   WHY IT IS SAFE
   - On the LOCAL adapter (what runs today) it resolves immediately and changes
     nothing: the site keeps reading catalog.js exactly as before. The switch
     happens on its own the day a real backend is bound.
   - Drafts are held back, exactly like `publishCatalog()` does.
   - Only the category and product arrays are replaced. `NITO_SITE` and
     `NITO_PAYMENTS` — phone number, e-mail, payment methods — keep coming from
     catalog.js. Those are the owner's business details, not console content,
     and overwriting them with an empty console record would be a real bug.
   - Every failure path resolves the promise and leaves the static catalogue in
     place. A broken bridge must never take the website down, and must never
     leave the page waiting.

   HOW IT STAYS HONEST
   `NITO_LIVE.armed` / `.reason` record what actually happened, so a page or a
   test can tell "read from the backend" apart from "read from the static
   file" instead of guessing. A bridge that silently did nothing would be worse
   than no bridge: the operator would believe edits were live.
   ========================================================================== */

(function (global) {
  'use strict';

  var state = {
    armed: false,          /* true once backend data replaced the static data */
    reason: 'not-started',
    count: 0
  };
  global.NITO_LIVE = state;

  var CAT = global.NITO_CATALOG || {};

  function apply(products, categories) {
    /* Only published lines reach customers — a draft is an unfinished thought,
       not a published product. Mirrors publishCatalog(). */
    var live = (products || []).filter(function (p) { return p && p.published !== false; });
    if (!live.length) { state.reason = 'no-published-products'; return; }

    /* Take the category list from the console only when it actually has one.
       An empty console category list means "not configured yet", not "delete
       every category" — blanking the sidebar would be destructive. */
    var cats = (categories && categories.length) ? categories : CAT.categories;
    if (!cats || !cats.length) { state.reason = 'no-categories'; return; }

    global.NITO_CATALOG = { categories: cats, products: live };
    state.armed = true;
    state.reason = 'backend';
    state.count = live.length;
  }

  /* No platform script on the page: resolve immediately, change nothing. */
  if (!global.NitoPlatform) {
    state.reason = 'no-platform';
    state.ready = Promise.resolve(state);
    return;
  }

  state.ready = global.NitoPlatform.init().then(function () {
    var P = global.NitoPlatform;
    /* The whole point is the SHARED catalogue. On the local adapter the public
       site must keep reading catalog.js — the operator's browser is not the
       website. */
    var m = P.mode ? P.mode() : null;
    if (!m || !m.shared) { state.reason = 'local-mode'; return state; }

    return Promise.all([P.list('products'), P.list('categories')]).then(function (r) {
      apply(r[0], r[1]);
      return state;
    });
  })['catch'](function (err) {
    state.reason = 'error';
    if (global.console && console.warn) {
      console.warn('[NITO] live catalogue bridge skipped:', err && err.message);
    }
    return state;
  });
})(window);
