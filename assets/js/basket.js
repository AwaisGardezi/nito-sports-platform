/* ==========================================================================
   NITO SPORTS — Enquiry Basket ("Quote List")
   --------------------------------------------------------------------------
   The B2B equivalent of a shopping cart. A buyer collects several products
   across the catalogue, sets a quantity on each, then sends ONE combined
   quotation request instead of filling in the form five times.

   There is no checkout and no price — this is a quotation basket, not a shop.
   Stored in localStorage so it survives page changes and browser restarts.
   Exposes window.NitoBasket. No dependencies.
   ========================================================================== */

(function () {
  'use strict';

  var KEY = 'nito_quote_v1';
  var CAT = window.NITO_CATALOG || { products: [], categories: [] };
  var F = window.NitoFlats;
  var S = window.NITO_SITE || {};

  /* ---------- helpers ---------------------------------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function prod(id) {
    for (var i = 0; i < CAT.products.length; i++) {
      if (CAT.products[i].id === id) return CAT.products[i];
    }
    return null;
  }

  function catName(id) {
    for (var i = 0; i < CAT.categories.length; i++) {
      if (CAT.categories[i].id === id) return CAT.categories[i].name;
    }
    return '';
  }

  /* "30 sets per design" -> 30, used as the sensible default quantity */
  function moqNum(p) {
    var n = parseInt(String((p && p.moq) || '').replace(/[^\d]/g, ''), 10);
    return (isNaN(n) || n < 1) ? 0 : n;
  }

  function waLink(msg) {
    return 'https://wa.me/' + (S.whatsapp || '') + '?text=' + encodeURIComponent(msg || '');
  }

  function mailLink(subject, body) {
    return 'mailto:' + (S.email || '') + '?subject=' + encodeURIComponent(subject || '') +
           '&body=' + encodeURIComponent(body || '');
  }

  function flat(type, cls) {
    return F ? F.flat(type, { className: cls || 'flat' }) : '';
  }

  var ICON = {
    basket: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    doc: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  function icon(name, cls, size) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (size ? ' width="' + size + '" height="' + size + '"' : '') + '>' + (ICON[name] || '') + '</svg>';
  }

  /* ---------- store ------------------------------------------------------ */

  var listeners = [];

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    if (!Array.isArray(raw)) return [];
    /* drop anything that no longer exists in the catalogue — a product the
       owner has since deleted should not linger in a buyer's basket */
    return raw.filter(function (it) {
      return it && typeof it.id === 'string' && prod(it.id);
    }).map(function (it) {
      var q = parseInt(it.qty, 10);
      return { id: it.id, qty: (isNaN(q) || q < 1) ? (moqNum(prod(it.id)) || 1) : q };
    });
  }

  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
    refresh();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](list); } catch (e) { /* a bad listener must not break the basket */ }
    }
  }

  /* ---------- public API -------------------------------------------------- */

  var API = {
    items: load,
    count: function () { return load().length; },
    units: function () { return load().reduce(function (a, i) { return a + i.qty; }, 0); },
    has: function (id) { return load().some(function (i) { return i.id === id; }); },

    add: function (id, qty) {
      var p = prod(id);
      if (!p) return false;
      var list = load();
      var n = parseInt(qty, 10);
      if (isNaN(n) || n < 1) n = moqNum(p) || 1;
      var found = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { list[i].qty = n; found = true; }
      }
      if (!found) list.push({ id: id, qty: n });
      persist(list);
      toast(p.name + ' added to your quote list');
      return true;
    },

    setQty: function (id, qty) {
      var list = load();
      var n = parseInt(qty, 10);
      if (isNaN(n) || n < 1) n = 1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) list[i].qty = n;
      }
      persist(list);
    },

    remove: function (id) {
      persist(load().filter(function (i) { return i.id !== id; }));
    },

    clear: function () { persist([]); },

    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    refresh: refresh,
    init: init,
    initQuotePage: initQuotePage,
    buttonHTML: buttonHTML,
    drawerHTML: drawerHTML
  };

  /* ---------- DOM sync ---------------------------------------------------- */

  function refresh() {
    var n = API.count(), u = API.units();
    $$('[data-basket-count]').forEach(function (el) {
      el.textContent = n;
      if (el.classList.contains('basket__n')) el.hidden = (n === 0);
    });
    $$('[data-basket-units]').forEach(function (el) { el.textContent = u; });
    $$('[data-basket-empty-hide]').forEach(function (el) { el.hidden = (n === 0); });
    $$('[data-basket-empty-show]').forEach(function (el) { el.hidden = (n > 0); });
  }

  function buttonHTML() {
    return '<a class="basket" href="quote.html" aria-label="Your quote list">' +
      icon('basket') +
      '<span class="basket__n" data-basket-count hidden>0</span>' +
      '<span class="basket__t">Quote list</span>' +
    '</a>';
  }

  function drawerHTML() {
    return '<a class="btn btn--ghost btn--block" href="quote.html">' + icon('basket') +
      'Your quote list (<span data-basket-count>0</span>)</a>';
  }

  /* ---------- toast ------------------------------------------------------- */

  function toast(msg) {
    var wrap = document.getElementById('nitoToastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'nitoToastWrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = icon('check') + '<span>' + esc(msg) + '</span>' +
      '<a class="toast__a" href="quote.html">View list</a>';
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () {
      t.classList.remove('is-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, 3800);
  }

  /* ---------- quantity stepper -------------------------------------------- */

  function stepQty(btn, dir) {
    var wrap = btn.closest('.qty');
    if (!wrap) return;
    var inp = $('input', wrap);
    if (!inp) return;
    var v = parseInt(inp.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    v = Math.max(1, v + dir);
    inp.value = v;
    if (inp.hasAttribute('data-quote-qty')) {
      API.setQty(inp.getAttribute('data-quote-qty'), v);
    }
  }

  /* ---------- event wiring ------------------------------------------------ */

  function init() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var add = t.closest('[data-add-quote]');
      if (add) {
        e.preventDefault();
        var id = add.getAttribute('data-add-quote');
        var fromSel = add.getAttribute('data-qty-from');
        var qty = fromSel ? ($(fromSel) ? $(fromSel).value : '') : (add.getAttribute('data-qty') || '');
        if (API.add(id, qty)) {
          add.classList.add('is-added');
          setTimeout(function () { add.classList.remove('is-added'); }, 1400);
        }
        return;
      }

      var inc = t.closest('[data-qty-inc]');
      if (inc) { e.preventDefault(); stepQty(inc, 1); return; }

      var dec = t.closest('[data-qty-dec]');
      if (dec) { e.preventDefault(); stepQty(dec, -1); return; }

      var rm = t.closest('[data-quote-remove]');
      if (rm) { e.preventDefault(); API.remove(rm.getAttribute('data-quote-remove')); return; }

      var cl = t.closest('[data-quote-clear]');
      if (cl) {
        e.preventDefault();
        if (window.confirm('Remove every product from your quote list?')) API.clear();
      }
    });

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var q = t.closest('[data-quote-qty]');
      if (q) API.setQty(q.getAttribute('data-quote-qty'), q.value);
    });

    refresh();
  }

  /* ---------- quote page -------------------------------------------------- */

  function rowHTML(it) {
    var p = prod(it.id);
    if (!p) return '';
    var cat = catName(p.cat);
    var moq = String(p.moq || '').replace(/ per .*/, '');
    return '<div class="qrow">' +
      '<a class="qrow__media" href="product.html?id=' + esc(p.id) + '" aria-hidden="true" tabindex="-1">' + flat(p.flat) + '</a>' +
      '<div class="qrow__body">' +
        '<span class="qrow__code mono">' + esc(p.code) + '</span>' +
        '<h3 class="qrow__name"><a href="product.html?id=' + esc(p.id) + '">' + esc(p.name) + '</a></h3>' +
        '<p class="qrow__meta">' + esc(cat) + (moq ? ' · MOQ ' + esc(moq) : '') + '</p>' +
      '</div>' +
      '<div class="qrow__qty">' +
        '<span class="qrow__lbl">Quantity</span>' +
        '<div class="qty">' +
          '<button type="button" class="qty__b" data-qty-dec aria-label="Decrease quantity">' + icon('minus') + '</button>' +
          '<input class="qty__i" type="number" min="1" step="1" value="' + it.qty + '" ' +
            'data-quote-qty="' + esc(p.id) + '" aria-label="Quantity for ' + esc(p.name) + '">' +
          '<button type="button" class="qty__b" data-qty-inc aria-label="Increase quantity">' + icon('plus') + '</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="qrow__x" data-quote-remove="' + esc(p.id) + '" ' +
        'aria-label="Remove ' + esc(p.name) + ' from your quote list">' + icon('x') + '</button>' +
    '</div>';
  }

  function summaryHTML() {
    return '<span class="eyebrow">Your request</span>' +
      '<div class="qsum__rows">' +
        '<div><span>Product lines</span><strong data-basket-count>0</strong></div>' +
        '<div><span>Total units</span><strong data-basket-units>0</strong></div>' +
      '</div>' +
      '<a class="btn btn--primary btn--block" href="#quoteForm">Continue to enquiry</a>' +
      '<a class="btn btn--ghost btn--block" href="products.html">Add more products</a>' +
      '<button type="button" class="btn btn--ghost btn--block" data-quote-clear>Clear list</button>' +
      '<p class="small" style="color:var(--t4)">Quantities are a starting point — we will confirm the ' +
      'final size breakdown with your quotation.</p>';
  }

  function initQuotePage() {
    var root = $('#quotePage');
    if (!root) return;

    var listEl = $('#quoteList');
    var sumEl = $('#quoteSummary');

    if (sumEl) sumEl.innerHTML = summaryHTML();

    function syncHidden(list) {
      var lines = list.map(function (it) {
        var p = prod(it.id);
        return p ? '- ' + p.name + ' (' + p.code + ') — quantity ' + it.qty : '';
      }).filter(Boolean).join('\n');

      var fi = $('#f-items');
      if (fi) fi.value = lines;

      var fp = $('#f-product');
      if (fp) {
        if (list.length === 1) {
          var p = prod(list[0].id);
          fp.value = p.name + ' (' + p.code + ')';
        } else if (list.length > 1) {
          fp.value = list.length + ' product lines — see the list below';
        } else {
          fp.value = '';
        }
      }
    }

    /* Only rebuild the rows when the SET of products changes. Re-rendering on
       every quantity keystroke would blow away focus mid-typing. */
    var sig = null;

    function draw() {
      var list = API.items();
      var next = list.map(function (i) { return i.id; }).join('|');
      if (next !== sig) {
        sig = next;
        if (listEl) listEl.innerHTML = list.map(rowHTML).join('');
      }
      syncHidden(list);
      refresh();
    }

    API.onChange(draw);
    draw();
  }

  /* ---------- boot -------------------------------------------------------- */

  window.NitoBasket = API;

  var started = false;
  function start() {
    /* Idempotent for the same reason as site.js — a duplicated script tag
       must not double-bind the delegated click handlers. */
    if (started) return;
    started = true;
    API.init();
    API.initQuotePage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})();
