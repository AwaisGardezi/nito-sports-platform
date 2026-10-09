/* ==========================================================================
   NITO SPORTS — Admin Panel
   --------------------------------------------------------------------------
   A single-operator product manager. Products live in the browser
   (localStorage) and are written back out as assets/js/catalog.js, which you
   upload over the live file to publish.

   SECURITY NOTE — read this before you rely on it:
   This is a CLIENT-SIDE gate. It stops a casual visitor from editing your
   catalogue; it is not real authentication. Anyone technical can read the
   panel's code. Do not put customer data or payment details behind it.
   If you later need genuine security, move the catalogue to a hosted
   database with server-side login (see HOSTING-GUIDE.md).
   ========================================================================== */

(function () {
  'use strict';

  var K_PRODUCTS = 'nito_products_v1';
  var K_CATS = 'nito_cats_v1';
  var K_HASH = 'nito_admin_hash_v1';
  var K_SESSION = 'nito_admin_session_v1';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- hashing ---------------------------------------------------- */

  function sha256(str) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
        .then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('00' + b.toString(16)).slice(-2);
          }).join('');
        });
    }
    /* Fallback for browsers that withhold crypto.subtle. Weaker, but this
       gate is only a convenience lock on a static page. */
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return Promise.resolve('fb' + (h >>> 0).toString(16));
  }

  /* ---------- state ------------------------------------------------------ */

  var state = {
    products: [],
    categories: [],
    editingId: null,
    filterCat: 'all',
    query: ''
  };

  /* true once there are local edits that have not been written back to
     assets/js/catalog.js — drives the "you have not exported" nudge */
  var dirty = false;

  function defaults() {
    return (window.NITO_CATALOG && window.NITO_CATALOG.products) || [];
  }

  function defaultCats() {
    return (window.NITO_CATALOG && window.NITO_CATALOG.categories) || [];
  }

  function load() {
    var p = null, c = null;
    try { p = JSON.parse(localStorage.getItem(K_PRODUCTS) || 'null'); } catch (e) {}
    try { c = JSON.parse(localStorage.getItem(K_CATS) || 'null'); } catch (e) {}
    state.products = Array.isArray(p) ? p : defaults().slice();
    state.categories = Array.isArray(c) ? c : defaultCats().slice();
  }

  function save() {
    localStorage.setItem(K_PRODUCTS, JSON.stringify(state.products));
    localStorage.setItem(K_CATS, JSON.stringify(state.categories));
    dirty = true;
    var el = $('#admState');
    if (el) {
      el.textContent = 'Not exported';
      el.style.color = 'var(--warn)';
    }
  }

  function markExported() {
    dirty = false;
    var el = $('#admState');
    if (el) {
      el.textContent = 'Exported';
      el.style.color = 'var(--ok)';
    }
  }

  /* ---------- toast ------------------------------------------------------ */

  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('#admToast');
    if (!el) return;
    el.className = 'adm-toast is-on ' + (kind === 'err' ? 'adm-toast--err' : 'adm-toast--ok');
    el.innerHTML = (kind === 'err'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>') +
      '<span>' + esc(msg) + '</span>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }

  /* ---------- login gate ------------------------------------------------- */

  function gateMode() {
    return localStorage.getItem(K_HASH) ? 'login' : 'create';
  }

  function renderGate(msg, kind) {
    var mode = gateMode();
    var host = $('#admGate');
    var isCreate = mode === 'create';

    host.innerHTML =
      '<div class="adm-gate__card">' +
        '<div class="adm-gate__brand">' +
          '<img class="brand__logo" src="assets/img/nito-lockup-light.png" width="432" height="102" alt="NITO SPORTS">' +
          '<p>' + (isCreate ? 'Set an admin password for this browser' : 'Admin panel — staff access only') + '</p>' +
        '</div>' +
        '<form id="gateForm">' +
          '<div class="field">' +
            '<label for="gatePass">' + (isCreate ? 'Choose a password' : 'Password') + '</label>' +
            '<input class="input" type="password" id="gatePass" autocomplete="' + (isCreate ? 'new-password' : 'current-password') + '" placeholder="' + (isCreate ? 'At least 6 characters' : 'Enter your password') + '">' +
          '</div>' +
          (isCreate ?
            '<div class="field">' +
              '<label for="gatePass2">Confirm password</label>' +
              '<input class="input" type="password" id="gatePass2" autocomplete="new-password" placeholder="Repeat it">' +
            '</div>' : '') +
          '<button class="btn btn--primary btn--block btn--lg" type="submit">' +
            (isCreate ? 'Set password &amp; continue' : 'Sign in') +
          '</button>' +
        '</form>' +
        '<div class="adm-gate__msg' + (msg ? ' is-on adm-gate__msg--' + (kind || 'err') : '') + '">' + esc(msg || '') + '</div>' +
        '<p class="adm-gate__note">' +
          (isCreate
            ? 'This password is stored in this browser only. If you clear your browser data you will be asked to set it again — your product data is stored separately and will survive.'
            : 'Forgot it? Clearing this site\'s browser data resets the password. Your products are stored separately and are not affected.') +
        '</p>' +
      '</div>';

    $('#gateForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var p1 = $('#gatePass').value;
      var p2 = isCreate && $('#gatePass2') ? $('#gatePass2').value : p1;

      if (isCreate) {
        if (p1.length < 6) return renderGate('Use at least 6 characters.', 'err');
        if (p1 !== p2) return renderGate('The two passwords do not match.', 'err');
        sha256(p1).then(function (h) {
          localStorage.setItem(K_HASH, h);
          sessionStorage.setItem(K_SESSION, '1');
          startPanel();
        });
        return;
      }

      sha256(p1).then(function (h) {
        if (h === localStorage.getItem(K_HASH)) {
          sessionStorage.setItem(K_SESSION, '1');
          startPanel();
        } else {
          renderGate('That password is not correct.', 'err');
        }
      });
    });
  }

  /* ---------- panel ------------------------------------------------------ */

  function countByCat(id) {
    return state.products.filter(function (p) { return p.cat === id; }).length;
  }

  function renderStats() {
    var el = $('#admStats');
    if (!el) return;
    el.innerHTML =
      '<div class="adm-stat"><div class="adm-stat__n">' + state.products.length + '</div><div class="adm-stat__l">Total products</div></div>' +
      '<div class="adm-stat"><div class="adm-stat__n">' + state.categories.length + '</div><div class="adm-stat__l">Categories</div></div>' +
      '<div class="adm-stat"><div class="adm-stat__n">' + state.products.filter(function (p) { return (p.tags || []).indexOf('Private Label') > -1; }).length + '</div><div class="adm-stat__l">Private label lines</div></div>' +
      '<div class="adm-stat"><div class="adm-stat__n" id="admState" style="font-size:.9375rem;color:' + (dirty ? 'var(--warn)' : 'var(--ok)') + '">' + (dirty ? 'Not exported' : 'Up to date') + '</div><div class="adm-stat__l">Changes to publish</div></div>';
  }

  function renderList() {
    var el = $('#admList');
    if (!el) return;

    var q = state.query.toLowerCase();
    var list = state.products.filter(function (p) {
      var okCat = state.filterCat === 'all' || p.cat === state.filterCat;
      var hay = (p.name + ' ' + p.code + ' ' + (p.blurb || '')).toLowerCase();
      return okCat && (!q || hay.indexOf(q) > -1);
    });

    if (!list.length) {
      el.innerHTML = '<div class="adm-editor__empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<span>No products match. Adjust the search, or add a new product.</span></div>';
      return;
    }

    el.innerHTML = list.map(function (p) {
      var cat = state.categories.filter(function (c) { return c.id === p.cat; })[0];
      return '<div class="adm-row">' +
        '<div class="adm-row__thumb">' + (window.NitoFlats ? window.NitoFlats.flat(p.flat) : '') + '</div>' +
        '<div>' +
          '<div class="adm-row__code">' + esc(p.code) + '</div>' +
          '<div class="adm-row__name">' + esc(p.name) + '</div>' +
          '<div class="adm-row__meta">' + esc(cat ? cat.name : p.cat) + ' · MOQ ' + esc(p.moq || '—') + '</div>' +
        '</div>' +
        '<div class="adm-row__acts">' +
          '<button class="adm-ico" data-edit="' + esc(p.id) + '" title="Edit" aria-label="Edit ' + esc(p.name) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/></svg>' +
          '</button>' +
          '<button class="adm-ico" data-dup="' + esc(p.id) + '" title="Duplicate" aria-label="Duplicate">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
          '</button>' +
          '<button class="adm-ico adm-ico--del" data-del="' + esc(p.id) + '" title="Delete" aria-label="Delete">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function blankProduct() {
    return {
      id: 'new-' + Date.now().toString(36),
      code: 'NTO-',
      cat: state.categories[0] ? state.categories[0].id : 'teamwear',
      flat: 'jersey',
      name: '',
      blurb: '',
      desc: '',
      fabric: '',
      gsm: '',
      moq: '',
      sizes: '',
      custom: [],
      styles: [],
      colors: [],
      lead: '',
      tags: []
    };
  }

  function renderEditor() {
    var el = $('#admEditor');
    if (!el) return;

    if (!state.editingId) {
      el.innerHTML =
        '<div class="adm-editor__head"><span class="adm-editor__title">Product editor</span></div>' +
        '<div class="adm-editor__empty">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
          '<span>Select a product to edit, or add a new one.</span>' +
          '<button class="btn btn--primary btn--sm" id="admNew2">Add product</button>' +
        '</div>';
      var b = $('#admNew2');
      if (b) b.addEventListener('click', function () { newProduct(); });
      return;
    }

    var p = state.products.filter(function (x) { return x.id === state.editingId; })[0];
    if (!p) { state.editingId = null; return renderEditor(); }

    var flatKeys = window.NitoFlats ? Object.keys(window.NitoFlats.SHAPES) : ['jersey'];

    el.innerHTML =
      '<div class="adm-editor__head">' +
        '<span class="adm-editor__title">' + (p.name ? 'Edit product' : 'New product') + '</span>' +
        '<span class="adm-row__code">' + esc(p.code) + '</span>' +
      '</div>' +
      '<div class="adm-editor__body">' +
        '<div class="adm-preview">' + (window.NitoFlats ? window.NitoFlats.flat(p.flat) : '') + '</div>' +

        '<div class="field"><label>Product code</label><input class="input" id="e-code" value="' + esc(p.code) + '" placeholder="NTO-1234"></div>' +
        '<div class="field"><label>Product name</label><input class="input" id="e-name" value="' + esc(p.name) + '" placeholder="e.g. Football Match Kit"></div>' +
        '<div class="field"><label>Category</label><select class="select" id="e-cat">' +
          state.categories.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (c.id === p.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label>Garment drawing (flat)</label><select class="select" id="e-flat">' +
          flatKeys.map(function (k) {
            return '<option value="' + esc(k) + '"' + (k === p.flat ? ' selected' : '') + '>' + esc(k) + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label>Short line (card subtitle)</label><input class="input" id="e-blurb" value="' + esc(p.blurb) + '"></div>' +
        '<div class="field"><label>Full description</label><textarea class="textarea" id="e-desc">' + esc(p.desc) + '</textarea></div>' +
        '<div class="field"><label>Fabric / material</label><input class="input" id="e-fabric" value="' + esc(p.fabric) + '"></div>' +
        '<div class="field"><label>Weight / GSM</label><input class="input" id="e-gsm" value="' + esc(p.gsm) + '"></div>' +
        '<div class="field"><label>MOQ</label><input class="input" id="e-moq" value="' + esc(p.moq) + '"></div>' +
        '<div class="field"><label>Sizes</label><input class="input" id="e-sizes" value="' + esc(p.sizes) + '"></div>' +
        '<div class="field"><label>Lead time</label><input class="input" id="e-lead" value="' + esc(p.lead) + '"></div>' +
        '<div class="field"><label>Customization options <span class="hint">one per line</span></label><textarea class="textarea" id="e-custom">' + esc((p.custom || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label>Available styles <span class="hint">one per line</span></label><textarea class="textarea" id="e-styles">' + esc((p.styles || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label>Colours <span class="hint">one per line</span></label><textarea class="textarea" id="e-colors">' + esc((p.colors || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label>Tags <span class="hint">comma separated — e.g. Core Range, Private Label</span></label><input class="input" id="e-tags" value="' + esc((p.tags || []).join(', ')) + '"></div>' +
      '</div>' +
      '<div class="adm-editor__foot">' +
        '<button class="btn btn--primary btn--sm flex-1" id="e-save">Save product</button>' +
        '<button class="btn btn--ghost btn--sm" id="e-cancel">Close</button>' +
      '</div>';

    $('#e-flat').addEventListener('change', function () {
      $('.adm-preview').innerHTML = window.NitoFlats ? window.NitoFlats.flat(this.value) : '';
    });
    $('#e-save').addEventListener('click', saveEditor);
    $('#e-cancel').addEventListener('click', function () {
      state.editingId = null;
      renderEditor();
    });
  }

  function lines(v) {
    return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function saveEditor() {
    var p = state.products.filter(function (x) { return x.id === state.editingId; })[0];
    if (!p) return;

    var name = $('#e-name').value.trim();
    if (!name) { toast('Product name is required', 'err'); $('#e-name').focus(); return; }

    p.code = $('#e-code').value.trim() || p.code;
    p.name = name;
    p.cat = $('#e-cat').value;
    p.flat = $('#e-flat').value;
    p.blurb = $('#e-blurb').value.trim();
    p.desc = $('#e-desc').value.trim();
    p.fabric = $('#e-fabric').value.trim();
    p.gsm = $('#e-gsm').value.trim();
    p.moq = $('#e-moq').value.trim();
    p.sizes = $('#e-sizes').value.trim();
    p.lead = $('#e-lead').value.trim();
    p.custom = lines($('#e-custom').value);
    p.styles = lines($('#e-styles').value);
    p.colors = lines($('#e-colors').value);
    p.tags = String($('#e-tags').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    save();
    renderList();
    renderStats();
    renderEditor();
    toast('Saved — remember to export and upload', 'ok');
  }

  function newProduct() {
    var p = blankProduct();
    state.products.unshift(p);
    state.editingId = p.id;
    save();
    renderList();
    renderStats();
    renderEditor();
    var n = $('#e-name');
    if (n) n.focus();
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  function duplicate(id) {
    var p = state.products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var copy = JSON.parse(JSON.stringify(p));
    copy.id = slug(copy.name) + '-' + Date.now().toString(36).slice(-4);
    copy.name = copy.name + ' (copy)';
    var i = state.products.indexOf(p);
    state.products.splice(i + 1, 0, copy);
    save();
    renderList();
    renderStats();
    toast('Duplicated', 'ok');
  }

  var pendingDelete = null;

  function askDelete(id) {
    var p = state.products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    pendingDelete = id;
    $('#admModalName').textContent = p.name + ' (' + p.code + ')';
    $('#admModal').classList.add('is-on');
  }

  function doDelete() {
    if (!pendingDelete) return;
    state.products = state.products.filter(function (x) { return x.id !== pendingDelete; });
    if (state.editingId === pendingDelete) state.editingId = null;
    pendingDelete = null;
    $('#admModal').classList.remove('is-on');
    save();
    renderList();
    renderStats();
    renderEditor();
    toast('Product deleted', 'ok');
  }

  /* ---------- export / import -------------------------------------------- */

  function exportCatalog() {
    var header =
      '/* ==========================================================================\n' +
      '   NITO SPORTS — Product Catalog\n' +
      '   Exported from the admin panel on ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '\n' +
      '   Upload this file over assets/js/catalog.js on your live site.\n' +
      '   ========================================================================== */\n\n';

    var out = header +
      'window.NITO_SITE = ' + JSON.stringify(window.NITO_SITE || {}, null, 2) + ';\n\n' +
      'window.NITO_PAYMENTS = ' + JSON.stringify(window.NITO_PAYMENTS || [], null, 2) + ';\n\n' +
      'window.NITO_CATALOG = ' + JSON.stringify({
        categories: state.categories,
        products: state.products
      }, null, 2) + ';\n';

    var blob = new Blob([out], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalog.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    markExported();
    toast('catalog.js downloaded — upload it to your site', 'ok');
  }

  function importCatalog(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var w = {};
        var fn = new Function('window', String(reader.result) + '\nreturn window.NITO_CATALOG;');
        var cat = fn(w);
        if (!cat || !Array.isArray(cat.products)) throw new Error('bad file');
        state.products = cat.products;
        if (Array.isArray(cat.categories) && cat.categories.length) state.categories = cat.categories;
        save();
        state.editingId = null;
        renderList();
        renderStats();
        renderEditor();
        toast('Imported ' + cat.products.length + ' products — export to publish', 'ok');
      } catch (e) {
        toast('That file could not be read as a catalog', 'err');
      }
    };
    reader.readAsText(file);
  }

  function resetCatalog() {
    localStorage.removeItem(K_PRODUCTS);
    localStorage.removeItem(K_CATS);
    state.products = defaults().slice();
    state.categories = defaultCats().slice();
    state.editingId = null;
    dirty = true;
    renderList();
    renderStats();
    renderEditor();
    toast('Reset to the shipped catalogue', 'ok');
  }

  /* ---------- start ------------------------------------------------------ */

  function startPanel() {
    var gate = $('#admGate');
    var panel = $('#admPanel');
    gate.style.display = 'none';
    panel.style.display = '';

    load();
    renderStats();
    renderList();
    renderEditor();

    /* toolbar */
    $('#admSearch').addEventListener('input', function () {
      state.query = this.value.trim();
      renderList();
    });
    $('#admCatFilter').innerHTML = '<option value="all">All categories</option>' +
      state.categories.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + countByCat(c.id) + ')</option>';
      }).join('');
    $('#admCatFilter').addEventListener('change', function () {
      state.filterCat = this.value;
      renderList();
    });

    $('#admNew').addEventListener('click', newProduct);
    $('#admExport').addEventListener('click', exportCatalog);
    $('#admReset').addEventListener('click', function () {
      if (confirm('Reset the catalogue to the version shipped with the website? Your local edits in this browser will be lost.')) resetCatalog();
    });
    $('#admImportBtn').addEventListener('click', function () { $('#admImportFile').click(); });
    $('#admImportFile').addEventListener('change', function () {
      if (this.files && this.files[0]) importCatalog(this.files[0]);
      this.value = '';
    });

    $('#admLogout').addEventListener('click', function () {
      sessionStorage.removeItem(K_SESSION);
      location.reload();
    });

    $('#admChangePass').addEventListener('click', function () {
      var np = prompt('Enter a new admin password (minimum 6 characters):');
      if (np === null) return;
      if (np.length < 6) return alert('Use at least 6 characters.');
      sha256(np).then(function (h) {
        localStorage.setItem(K_HASH, h);
        toast('Password changed', 'ok');
      });
    });

    /* list actions (delegated) */
    $('#admList').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      var du = e.target.closest('[data-dup]');
      var de = e.target.closest('[data-del]');
      if (ed) { state.editingId = ed.getAttribute('data-edit'); renderEditor(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (du) duplicate(du.getAttribute('data-dup'));
      if (de) askDelete(de.getAttribute('data-del'));
    });

    /* modal */
    $('#admModalCancel').addEventListener('click', function () {
      pendingDelete = null;
      $('#admModal').classList.remove('is-on');
    });
    $('#admModalConfirm').addEventListener('click', doDelete);
    $('#admModal').addEventListener('click', function (e) {
      if (e.target === this) { pendingDelete = null; this.classList.remove('is-on'); }
    });

    /* warn on unload only when edits have not been exported to disk yet */
    window.addEventListener('beforeunload', function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function boot() {
    if (sessionStorage.getItem(K_SESSION) === '1') startPanel();
    else renderGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
