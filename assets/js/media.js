/* ==========================================================================
   NITO SPORTS — Product image store
   --------------------------------------------------------------------------
   Why this file exists as its own module:

   The console keeps its whole dataset in ONE localStorage key
   (`nito_platform_v1`, already ~51 KB of JSON). localStorage gives an origin
   about 5 MB. If a product photograph were stored inside the product record,
   then every single save — editing a MOQ, ticking Draft, anything — would
   re-serialise the whole blob *including* the photos, and three or four
   photographs would push it past the cap. The shot the owner just uploaded
   would take the rest of the catalogue down with it, and `platform.js` would
   throw "browser storage is full" on an edit that has nothing to do with
   images.

   So image bytes live here, in their own key, addressed by id. A product
   record only ever carries a short reference string (see refFor() below),
   which costs ~80 bytes regardless of how large the photo is.

   The reference is a data: URL, deliberately. That is what makes an uploaded
   photo survive `publishCatalog()` — the exported catalog.js is a plain
   JavaScript file with no sidecar folder, so an uploaded photo has to travel
   inside it or it does not travel at all. The resolvers below are what keep
   the *storage* copy small while the *exported* copy is self-contained.

   Storage layout (localStorage):
     nito_media_index_v1  -> { "<id>": {w,h,bytes,at,name} }
     nito_med_<id>        -> "data:image/jpeg;base64,..."   (full size, for export)
     nito_medsm_<id>      -> "data:image/jpeg;base64,..."   (≤420px, for the grid)
   ========================================================================== */
(function (global) {
  'use strict';

  var IX_KEY = 'nito_media_index_v1';
  var FULL_PREFIX = 'nito_med_';
  var THUMB_PREFIX = 'nito_medsm_';
  var REF_PREFIX = 'nito-media:';

  /* Two budget lines, not one. The full-size copy is what reaches the exported
     catalog.js, so it justifies the space; the grid thumbnail is the one that
     renders 12-at-a-time on the products page, so it is kept genuinely small. */
  var FULL_MAX = 1400;
  var THUMB_MAX = 420;
  var BUDGET = 3.5 * 1024 * 1024;   /* leaves ~1.5 MB for the dataset + session */

  /* Uploading a photo the browser cannot decode (a RAW file, a corrupt
     download, a .webp from an old browser) must fail with a sentence the
     operator can act on, not a silent no-op. */
  var MAX_INPUT_BYTES = 25 * 1024 * 1024;

  function key(id, prefix) { return prefix + id; }

  function store() { return global.localStorage; }

  function readRaw(k) {
    try { return store().getItem(k); } catch (e) { return null; }
  }

  function index() {
    var raw = readRaw(IX_KEY);
    if (!raw) return {};
    try {
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }

  function writeIndex(ix) {
    try { store().setItem(IX_KEY, JSON.stringify(ix)); return true; }
    catch (e) { return false; }
  }

  function bytesOf(str) { return str ? str.length : 0; }

  /* How much room the image store is currently taking, in characters. A
     data: URL is ASCII, so character count and byte count agree closely enough
     for a budget guard. */
  function used() {
    var ix = index(), total = 0, k;
    for (k in ix) {
      if (!Object.prototype.hasOwnProperty.call(ix, k)) continue;
      total += bytesOf(readRaw(key(k, FULL_PREFIX)));
      total += bytesOf(readRaw(key(k, THUMB_PREFIX)));
    }
    return total;
  }

  function genId() {
    return 'img' + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7);
  }

  /* ------------------------------------------------------------------ refs */

  /* A stored image is referenced by an opaque id, never by the data URL
     itself — the whole point is that the product record stays small. */
  function isRef(v) { return typeof v === 'string' && v.indexOf(REF_PREFIX) === 0; }

  function refFor(id) { return REF_PREFIX + id; }

  function idOf(v) {
    if (isRef(v)) return v.slice(REF_PREFIX.length);
    return v ? String(v) : '';
  }

  /* One function, used by every renderer, so a reference can never leak onto
     a customer's screen as the literal text "nito-media:img123".

     Resolution order matters: stored copy first, then a path the owner
     published (`imagePaths`), then the reference string itself if it happens
     to already be a URL — which is what lets a product point straight at
     `assets/img/team-home-1.jpg` without ever going through this store.

     If nothing resolves we return '' and the caller falls back to the SVG
     tech flat. A broken <img> on a product grid looks like a broken business. */
  function resolve(ref, paths) {
    if (!ref) return '';
    var id = idOf(ref);
    var map = (paths && typeof paths === 'object') ? paths : {};
    if (map[id]) return map[id];
    var thumb = readRaw(key(id, THUMB_PREFIX));
    if (thumb) return thumb;
    var full = readRaw(key(id, FULL_PREFIX));
    if (full) return full;
    /* Not ours — a plain path or URL the operator typed in. */
    if (!isRef(ref)) return String(ref);
    return '';
  }

  /* The full-size copy, for the PDP and for the export. Falls back the same
     way so a published path still wins for anyone who never uploaded. */
  function resolveFull(ref, paths) {
    if (!ref) return '';
    var id = idOf(ref);
    var map = (paths && typeof paths === 'object') ? paths : {};
    if (map[id]) return map[id];
    var full = readRaw(key(id, FULL_PREFIX));
    if (full) return full;
    var thumb = readRaw(key(id, THUMB_PREFIX));
    if (thumb) return thumb;
    if (!isRef(ref)) return String(ref);
    return '';
  }

  /* ----------------------------------------------------------------- write */

  /* Downscale through a canvas before anything is stored. A 4 MB phone photo
     becomes ~150 KB and is indistinguishable on the product grid. */
  function downscale(img, maxDim, quality) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return '';

    var scale = Math.min(1, maxDim / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));

    var cv = global.document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    var ctx = cv.getContext('2d');
    /* Photographs of garments are usually shot on white or on a light
       showroom floor; painting the canvas white first means a transparent
       PNG does not turn into a black rectangle when re-encoded as JPEG. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    try { return cv.toDataURL('image/jpeg', quality); }
    catch (e) { return ''; }
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = global.URL.createObjectURL(file);
      var img = new global.Image();
      img.onload = function () {
        global.URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        global.URL.revokeObjectURL(url);
        reject(new Error('That file could not be read as an image.'));
      };
      img.src = url;
    });
  }

  /* Upload one File. Resolves with the record {id,w,h,bytes,at,name}; the
     caller stores refFor(record.id) on the product. */
  function put(file) {
    if (!file) return Promise.reject(new Error('No file chosen.'));

    if (file.size > MAX_INPUT_BYTES) {
      return Promise.reject(new Error(
        'That image is larger than 25 MB. Please choose a smaller file.'));
    }
    if (file.type && file.type.indexOf('image/') !== 0) {
      return Promise.reject(new Error('That file is not an image.'));
    }

    return loadImage(file).then(function (img) {
      var full = downscale(img, FULL_MAX, 0.82);
      if (!full) {
        throw new Error('That image could not be processed. Try a JPEG or PNG.');
      }
      var thumb = downscale(img, THUMB_MAX, 0.72) || full;

      /* Estimate before writing, not after. Writing a photo that does not fit
         and rolling back afterwards would leave the index and the two data
         keys in disagreement if the rollback itself failed on quota. */
      var need = bytesOf(full) + bytesOf(thumb);
      if (used() + need > BUDGET) {
        throw new Error(
          'The image store is full. Remove a photo you no longer need, or ' +
          'move to the hosted backend for unlimited storage.');
      }

      var id = genId();
      try {
        store().setItem(key(id, FULL_PREFIX), full);
        store().setItem(key(id, THUMB_PREFIX), thumb);
      } catch (e) {
        /* Quota is enforced per write, so a failure here can strand the full
           copy. Clean up both before surfacing it. */
        store().removeItem(key(id, FULL_PREFIX));
        store().removeItem(key(id, THUMB_PREFIX));
        throw new Error(
          'There is not enough browser storage for that image. Remove a ' +
          'stored photo, or move to the hosted backend.');
      }

      var rec = {
        id: id,
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
        bytes: need,
        at: new Date().toISOString(),
        name: file.name || 'photo.jpg'
      };
      var ix = index();
      ix[id] = rec;
      if (!writeIndex(ix)) {
        store().removeItem(key(id, FULL_PREFIX));
        store().removeItem(key(id, THUMB_PREFIX));
        throw new Error('Could not record that image. Browser storage is full.');
      }
      return rec;
    });
  }

  /* -------------------------------------------------------------- delete */

  /* Deleting a stored photo is how the operator frees space again, so it has
     to work even when the dataset is already near the cap — hence removing the
     big data keys before touching the small index. */
  function remove(id) {
    if (!id) return false;
    id = idOf(id);
    try {
      store().removeItem(key(id, FULL_PREFIX));
      store().removeItem(key(id, THUMB_PREFIX));
    } catch (e) { /* nothing useful to do — the index entry still goes */ }
    var ix = index();
    if (Object.prototype.hasOwnProperty.call(ix, id)) {
      delete ix[id];
      writeIndex(ix);
    }
    return true;
  }

  /* Which stored images are still referenced by a product. Used by the
     maintenance button so the owner can see and reclaim dead weight. */
  function referenced(products) {
    var live = {};
    (products || []).forEach(function (p) {
      (p && p.images || []).forEach(function (r) {
        if (isRef(r)) live[idOf(r)] = true;
      });
    });
    return live;
  }

  function orphans(products) {
    var live = referenced(products), ix = index(), out = [];
    Object.keys(ix).forEach(function (id) {
      if (!live[id]) out.push(ix[id]);
    });
    return out;
  }

  function list() {
    var ix = index();
    return Object.keys(ix).map(function (id) { return ix[id]; });
  }

  var api = {
    REF_PREFIX: REF_PREFIX,
    BUDGET: BUDGET,
    FULL_MAX: FULL_MAX,
    THUMB_MAX: THUMB_MAX,
    put: put,
    remove: remove,
    get: function (id) { return index()[idOf(id)] || null; },
    list: list,
    index: index,
    isRef: isRef,
    refFor: refFor,
    idOf: idOf,
    resolve: resolve,
    resolveFull: resolveFull,
    used: used,
    referenced: referenced,
    orphans: orphans
  };

  global.NitoMedia = api;
})(typeof window !== 'undefined' ? window : this);
