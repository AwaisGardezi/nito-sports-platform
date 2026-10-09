/* ==========================================================================
   NITO SPORTS — Site Engine
   Header/footer components, catalog rendering, filters, product detail,
   enquiry handling, scroll behaviour.
   No framework, no build step. Loads in one pass.
   ========================================================================== */

(function () {
  'use strict';

  var S = window.NITO_SITE || {};
  /* Read the catalogue lazily, not at script-eval time: the live-data bridge
     (assets/js/live-data.js) may replace window.NITO_CATALOG with the
     operator's published lines from the hosted backend before boot() runs.
     Capturing a reference here would freeze the static file's snapshot. */
  var CAT = { categories: [], products: [] };
  var PAY = window.NITO_PAYMENTS || [];
  var F = window.NitoFlats;

  document.documentElement.classList.add('js');

  /* ---------- helpers ---------------------------------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* not every environment implements scrollIntoView (older browsers, test runners) */
  function scrollIntoViewSafe(el, opts) {
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView(opts || { behavior: 'smooth', block: 'center' });
    }
  }

  function waLink(message) {
    return 'https://wa.me/' + S.whatsapp + '?text=' + encodeURIComponent(message || '');
  }

  function mailLink(subject, body) {
    return 'mailto:' + S.email + '?subject=' + encodeURIComponent(subject || '') +
           '&body=' + encodeURIComponent(body || '');
  }

  function flat(type, cls) {
    return F ? F.flat(type, { className: cls || 'flat' }) : '';
  }

  function pageName() {
    var p = window.location.pathname.split('/').pop() || 'index.html';
    return p.toLowerCase();
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* "30 sets per design" -> 30 — used to seed the quantity stepper */
  function moqNum(p) {
    var n = parseInt(String((p && p.moq) || '').replace(/[^\d]/g, ''), 10);
    return (isNaN(n) || n < 1) ? 1 : n;
  }

  /* Second-level category. Each category carries an `items` list; a product is
     filed under whichever item its name matches most completely. Score is the
     share of an item's own words that appear in the product name, so
     "Football / Soccer" (2/2) beats "American Football" (1/2) on a football kit,
     while "American Football" (2/2) beats "Football / Soccer" (1/2) on a
     US-football uniform. Ties fall back to list order.
     Add an id -> item entry to window.NITO_SUBCAT_OVERRIDES to force one. */
  function subOf(p) {
    var cat = catById(p.cat);
    if (!cat || !cat.items || !cat.items.length) return '';
    var ov = window.NITO_SUBCAT_OVERRIDES || {};
    if (ov[p.id]) return ov[p.id];

    var hay = ' ' + String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    var best = '', bestScore = 0;

    for (var i = 0; i < cat.items.length; i++) {
      var words = String(cat.items[i]).toLowerCase().replace(/[^a-z0-9]+/g, ' ')
        .split(' ').filter(function (w) { return w.length > 2; })
        .map(function (w) { return w.replace(/s$/, ''); });
      if (!words.length) continue;

      var hit = 0;
      for (var j = 0; j < words.length; j++) {
        if (hay.indexOf(' ' + words[j]) > -1) hit++;
      }
      var score = hit / words.length;
      if (score > bestScore) { bestScore = score; best = cat.items[i]; }
    }
    return best || cat.items[0];
  }

  function subCount(catId, sub) {
    return CAT.products.filter(function (p) {
      return p.cat === catId && subOf(p) === sub;
    }).length;
  }

  /* ---------- icon set --------------------------------------------------- */

  var I = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    wa: '<path d="M17.5 14.4c-.3-.2-1.8-.9-2-1s-.5-.2-.7.1-.8 1-1 1.2-.4.2-.7 0a8 8 0 01-2.3-1.4 8.7 8.7 0 01-1.6-2c-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5s0-.4 0-.5-.7-1.7-.9-2.3-.5-.5-.7-.5h-.6a1.2 1.2 0 00-.8.4A3.4 3.4 0 004 8.7a5.9 5.9 0 001.3 3.2 13.5 13.5 0 005.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 001.9.1 3.1 3.1 0 002-1.4 2.5 2.5 0 00.2-1.4c-.1-.2-.3-.3-.6-.4z"/><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.4A10 10 0 1012 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z"/>',
    upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v13"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
    needle: '<path d="M18 2l4 4-11 11-4-4z"/><path d="M7 13l-3 3v4h4l3-3"/><circle cx="16" cy="8" r="1"/>',
    printer: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="8" rx="2"/><path d="M6 14h12v8H6z"/>',
    ruler: '<path d="M3 15L15 3l6 6L9 21z"/><path d="M7 11l2 2M11 7l2 2M15 3l2 2"/>',
    box: '<path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7.5L12 12l8.7-4.5M12 22V12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.4L7 22l5-3 5 3-1.2-8.6"/>',
    factory: '<path d="M2 20V9l6 4V9l6 4V6l6 3v11z"/><path d="M2 20h20"/><path d="M7 20v-4M13 20v-4M18 20v-4"/>',
    layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
    palette: '<circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1.4"/><circle cx="12" cy="7" r="1.4"/><circle cx="16" cy="9" r="1.4"/><circle cx="15" cy="15" r="1.4"/>',
    spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
    doc: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
    fb: '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
    ig: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
    tiktok: '<path d="M15 3v10.5a3.5 3.5 0 11-3-3.46"/><path d="M15 3a5 5 0 005 5"/>',
    yt: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
    li: '<rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/><path d="M10 21v-7a3 3 0 016 0v7"/>',
    pin2: '<path d="M12 17v5"/><path d="M9 10.8V4h6v6.8l2 2.2H7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    zoom: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    left: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>'
  };

  function icon(name, cls, size) {
    var d = I[name] || '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
      (size ? 'width="' + size + '" height="' + size + '" ' : '') + '>' + d + '</svg>';
  }

  /* ---------- shared markup --------------------------------------------- */

  /* The brand lockup is the owner's own artwork, not a redrawn mark. Two exports
     exist: the standard one (black wordmark, for light backgrounds) and a
     reversed one (white wordmark, for the dark footer). */
  function brandLockup(variant) {
    var src = variant === 'light'
      ? 'assets/img/nito-lockup-light.png'
      : 'assets/img/nito-lockup.png';
    return '<a class="brand" href="index.html" aria-label="NITO SPORTS — home">' +
      '<img class="brand__logo" src="' + src + '" width="432" height="102" alt="" decoding="async">' +
    '</a>';
  }

  function buildHeader() {
    var here = pageName();
    function navLink(href, label, key) {
      var active = (key && here.indexOf(key) === 0) ? ' is-active' : '';
      return '<a class="nav__link' + active + '" href="' + href + '">' + label + '</a>';
    }

    var dropItems = CAT.categories.map(function (c) {
      return '<a class="drop__item" href="products.html?cat=' + c.id + '">' +
        '<span class="drop__icon">' + flat(c.flat, 'flat') + '</span>' +
        '<span><span class="drop__t">' + esc(c.name) + '</span>' +
        '<span class="drop__d">' + c.items.length + ' product lines</span></span></a>';
    }).join('');

    var drawerCats = CAT.categories.map(function (c) {
      return '<a href="products.html?cat=' + c.id + '">' + esc(c.name) + '</a>';
    }).join('');

    var basketBtn = (window.NitoBasket && window.NitoBasket.buttonHTML)
      ? window.NitoBasket.buttonHTML() : '';
    var basketDrawer = (window.NitoBasket && window.NitoBasket.drawerHTML)
      ? window.NitoBasket.drawerHTML() : '';

    return '' +
    '<div class="topbar"><div class="container topbar__in">' +
      '<span class="topbar__flag"><span class="dot"></span>' + esc(S.city) + ', ' + esc(S.country) + ' · Manufacturer &amp; Exporter</span>' +
      '<span class="topbar__meta">' +
        '<span class="topbar__item">' + icon('truck') + 'Worldwide Shipping</span>' +
        '<a class="topbar__item" href="' + waLink('Hello NITO SPORTS, I would like to discuss a custom order.') + '" target="_blank" rel="noopener">' + icon('wa') + esc(S.whatsappDisplay) + '</a>' +
        '<a class="topbar__item" href="mailto:' + esc(S.email) + '">' + icon('mail') + esc(S.email) + '</a>' +
      '</span>' +
    '</div></div>' +

    '<header class="nav" id="siteNav"><div class="container nav__in">' +
      brandLockup() +
      '<nav class="nav__links" aria-label="Main">' +
        navLink('index.html', 'Home', 'index') +
        '<div class="has-drop">' +
          '<a class="nav__link' + (here.indexOf('product') === 0 ? ' is-active' : '') + '" href="products.html">Products ' + icon('chevron') + '</a>' +
          '<div class="drop">' + dropItems + '</div>' +
        '</div>' +
        navLink('customization.html', 'Customization', 'customization') +
        navLink('about.html', 'About', 'about') +
        navLink('contact.html', 'Contact', 'contact') +
      '</nav>' +
      '<div class="nav__tools">' +
        '<button class="nav__icon" id="searchOpen" aria-label="Search products" aria-expanded="false" aria-controls="searchPanel">' + icon('search') + '</button>' +
        basketBtn +
        '<a class="btn btn--primary btn--sm nav__cta" href="contact.html">Request a Quote</a>' +
      '</div>' +
      '<button class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
    '</div></header>' +

    '<div class="search-panel" id="searchPanel" hidden>' +
      '<div class="container search-panel__in">' +
        '<form class="search-panel__form" id="searchForm" role="search" autocomplete="off">' +
          icon('search') +
          '<input type="search" class="search-panel__input" id="searchInput" ' +
            'placeholder="Search a product or code — e.g. boxing shorts, NTO-4001" aria-label="Search products">' +
          '<button type="button" class="search-panel__close" id="searchClose" aria-label="Close search">' + icon('x') + '</button>' +
        '</form>' +
        '<div class="search-panel__results" id="searchResults"></div>' +
      '</div>' +
    '</div>' +

    '<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Menu">' +
      '<div class="drawer__scrim" data-close-drawer></div>' +
      '<div class="drawer__panel">' +
        '<div class="drawer__top">' + brandLockup() +
          '<button class="drawer__close" data-close-drawer aria-label="Close menu">' + icon('x') + '</button>' +
        '</div>' +
        '<nav class="drawer__nav" aria-label="Mobile">' +
          '<a class="drawer__link" href="index.html">Home ' + icon('arrow') + '</a>' +
          '<a class="drawer__link" href="products.html">All Products ' + icon('arrow') + '</a>' +
          '<div class="drawer__sub">' + drawerCats + '</div>' +
          '<a class="drawer__link" href="customization.html">Customization ' + icon('arrow') + '</a>' +
          '<a class="drawer__link" href="about.html">About ' + icon('arrow') + '</a>' +
          '<a class="drawer__link" href="contact.html">Contact ' + icon('arrow') + '</a>' +
        '</nav>' +
        '<div class="drawer__foot">' +
          '<a class="btn btn--primary btn--block" href="contact.html">Request a Quote</a>' +
          basketDrawer +
          '<a class="btn btn--wa btn--block" href="' + waLink('Hello NITO SPORTS, I would like to discuss a custom order.') + '" target="_blank" rel="noopener">' + icon('wa') + 'WhatsApp Us</a>' +
          '<a class="btn btn--ghost btn--block" href="mailto:' + esc(S.email) + '">' + icon('mail') + 'E-mail Us</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function buildFooter() {
    var year = new Date().getFullYear();
    var catLinks = CAT.categories.map(function (c) {
      return '<a href="products.html?cat=' + c.id + '">' + esc(c.name) + '</a>';
    }).join('');
    var payChips = PAY.map(function (p) { return '<span>' + esc(p.name) + '</span>'; }).join('');

    /* Social row — only real destinations. WhatsApp and e-mail always exist;
       anything the owner adds to S.social appears once a URL is filled in. */
    var socials = [
      { name: 'WhatsApp', url: waLink('Hello NITO SPORTS, I would like to discuss a custom order.'), icon: 'wa' },
      { name: 'E-mail', url: 'mailto:' + esc(S.email), icon: 'mail' }
    ].concat((S.social || []).filter(function (s) { return s && s.url; }));

    var socialRow = '<div class="social">' +
      '<span class="social__label">Follow &amp; connect</span>' +
      '<div class="social__row">' +
        socials.map(function (s) {
          return '<a class="social__a" href="' + esc(s.url) + '" target="_blank" rel="noopener" ' +
            'aria-label="' + esc(s.name) + '" title="' + esc(s.name) + '">' + icon(s.icon) + '</a>';
        }).join('') +
      '</div>' +
    '</div>';

    return '' +
    '<footer class="footer">' +
      '<div class="container">' +

        '<div class="footer__news">' +
          '<div class="footer__news-copy">' +
            '<span class="eyebrow">Trade notes</span>' +
            '<h2 class="footer__news-t">New ranges, fabric updates and lead-time news</h2>' +
            '<p class="footer__news-d">An occasional e-mail for trade buyers — new product lines, fabric availability and production lead times. Not a retail mailing list, and you can unsubscribe at any time.</p>' +
          '</div>' +
          '<form class="footer__news-form" id="newsletterForm" novalidate>' +
            '<input class="input" type="email" id="newsletterEmail" required ' +
              'aria-label="Your e-mail address" placeholder="you@company.com" autocomplete="email">' +
            '<button class="btn btn--primary" type="submit">Subscribe</button>' +
            '<span class="footer__news-status" id="newsletterStatus" role="status" aria-live="polite"></span>' +
          '</form>' +
        '</div>' +

        '<div class="footer__grid">' +
          '<div class="footer__about">' +
            brandLockup('light') +
            '<p class="footer__desc">Custom sportswear, activewear, streetwear, combat sports apparel and private-label manufacturing from ' +
              esc(S.city) + ', ' + esc(S.country) + '. We build to your artwork, your block and your brand — and ship worldwide.</p>' +
            '<div class="tag-row">' +
              '<span class="tag tag--blue">Low MOQ</span>' +
              '<span class="tag">Direct Factory Pricing</span>' +
              '<span class="tag">Worldwide Shipping</span>' +
            '</div>' +
            socialRow +
          '</div>' +

          '<div>' +
            '<h2>Product Ranges</h2>' +
            '<div class="footer__list">' + catLinks +
              '<a href="products.html">View all products</a>' +
            '</div>' +
          '</div>' +

          '<div>' +
            '<h2>Company</h2>' +
            '<div class="footer__list">' +
              '<a href="about.html">About NITO SPORTS</a>' +
              '<a href="customization.html">Customization &amp; Printing</a>' +
              '<a href="customization.html#process">How Ordering Works</a>' +
              '<a href="quote.html">Your quote list</a>' +
              '<a href="contact.html">Request a Quote</a>' +
              '<a href="admin.html">Staff Login</a>' +
            '</div>' +
          '</div>' +

          '<div>' +
            '<h2>Contact</h2>' +
            '<div class="footer__contact">' +
              '<div class="footer__ci">' + icon('pin') + '<div><span>Factory</span>' + esc(S.city) + ', ' + esc(S.region) + ', ' + esc(S.country) + '</div></div>' +
              '<div class="footer__ci">' + icon('wa') + '<div><span>WhatsApp</span><a href="' + waLink('Hello NITO SPORTS, I would like to discuss a custom order.') + '" target="_blank" rel="noopener">' + esc(S.whatsappDisplay) + '</a></div></div>' +
              '<div class="footer__ci">' + icon('mail') + '<div><span>E-mail</span><a href="mailto:' + esc(S.email) + '">' + esc(S.email) + '</a></div></div>' +
              '<div class="footer__ci">' + icon('globe') + '<div><span>Website</span>www.' + esc(S.domain) + '</div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</footer>' +

    '<section class="copy"><div class="container copy__in">' +
      '<p>© ' + year + ' ' + esc(S.brand) + ' — ' + esc(S.city) + ', ' + esc(S.country) + '. All rights reserved.</p>' +
      '<div class="copy__right">' +
        '<div class="copy__pay"><span>We accept</span>' + payChips + '</div>' +
        /* Staff entry point. The label names the audience ("Staff") rather than
           the mechanism, so a buyer scanning the footer reads it as not-for-you
           and moves on. It is a plain link into the real sign-in page — no
           hidden gesture, because a staff member who cannot find the door is
           worse served than a buyer who ignores it. */
        '<a class="copy__staff" href="login.html" rel="nofollow">' +
          icon('shield') + '<span>Staff sign in</span>' +
        '</a>' +
      '</div>' +
    '</div></section>' +

    '<button class="to-top" id="toTop" type="button" aria-label="Back to top">' + icon('up') + '</button>' +

    '<a class="wa-float" href="' + waLink('Hello NITO SPORTS, I would like to discuss a custom order.') + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">' +
      '<span class="wa-float__ring"></span>' + icon('wa') + '<span>Chat on WhatsApp</span>' +
    '</a>';
  }

  /* ---------- mount ------------------------------------------------------ */

  function mountComponents() {
    var h = $('#site-header');
    if (h) h.innerHTML = buildHeader();
    var f = $('#site-footer');
    if (f) f.innerHTML = buildFooter();
  }

  /* ---------- interactions ----------------------------------------------- */

  function initNav() {
    var nav = $('#siteNav');
    var burger = $('#burger');
    var drawer = $('#drawer');

    if (nav) {
      var onScroll = function () {
        if (window.scrollY > 8) nav.classList.add('is-stuck');
        else nav.classList.remove('is-stuck');
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (burger && drawer) {
      var setOpen = function (open) {
        drawer.classList.toggle('is-open', open);
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      };
      burger.addEventListener('click', function () { setOpen(!drawer.classList.contains('is-open')); });
      $$('[data-close-drawer]', drawer).forEach(function (el) {
        el.addEventListener('click', function () { setOpen(false); });
      });
      $$('.drawer__panel a', drawer).forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
      });
    }
  }

  function initReveal() {
    var els = $$('[data-reveal],[data-stagger]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length) return;
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      var dur = 1100, start = null;
      var step = function (t) {
        if (!start) start = t;
        var p = Math.min((t - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initFaq() {
    $$('.faq__item').forEach(function (item) {
      var q = $('.faq__q', item);
      var a = $('.faq__a', item);
      if (!q || !a) return;
      q.setAttribute('aria-expanded', 'false');
      q.addEventListener('click', function () {
        var open = item.classList.contains('is-open');
        $$('.faq__item').forEach(function (o) {
          o.classList.remove('is-open');
          var oa = $('.faq__a', o); if (oa) oa.style.maxHeight = '0px';
          var oq = $('.faq__q', o); if (oq) oq.setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          item.classList.add('is-open');
          a.style.maxHeight = a.scrollHeight + 40 + 'px';
          q.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  function initMisc() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var txt = btn.getAttribute('data-copy');
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        var old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 1600);
      });
    });
  }

  /* ---------- back to top -------------------------------------------------- */

  function initToTop() {
    var btn = $('#toTop');
    if (!btn) return;
    var onScroll = function () { btn.classList.toggle('is-on', window.scrollY > 500); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    });
  }

  /* ---------- catalog renderers ------------------------------------------ */

  /* The lead photo of a product. The shipped catalogue has no `images` array
     at all, so this must tolerate a missing one on all 55 lines. */
  function refOf(p) {
    return (p && p.images && p.images.length) ? p.images[0] : '';
  }

  function catById(id) {
    for (var i = 0; i < CAT.categories.length; i++) {
      if (CAT.categories[i].id === id) return CAT.categories[i];
    }
    return null;
  }

  function prodById(id) {
    for (var i = 0; i < CAT.products.length; i++) {
      if (CAT.products[i].id === id) return CAT.products[i];
    }
    return null;
  }

  function countIn(catId) {
    return CAT.products.filter(function (p) { return p.cat === catId; }).length;
  }

  function renderCategoryCards(sel) {
    var wrap = $(sel);
    if (!wrap) return;
    wrap.innerHTML = CAT.categories.map(function (c) {
      var items = c.items.slice(0, 5).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('');
      return '<a class="cat-block" href="products.html?cat=' + esc(c.id) + '" data-reveal>' +
        '<div class="cat-block__img">' +
          '<span class="cat-block__count">' + countIn(c.id) + ' products</span>' +
          flat(c.flat) +
          '<span class="cat-block__name"><span>' + esc(c.name) + '</span></span>' +
        '</div>' +
        '<div class="cat-block__body">' +
          '<p>' + esc(c.short) + '</p>' +
          '<ul class="cat-block__list">' + items + '</ul>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  /* Grid tile. Mirrors the reference layout: image with a code flash, a name,
     and a quantity box + add-to-basket pair that appears on hover — so a buyer
     can build a multi-product enquiry without opening every product page. */
  function productCard(p) {
    var sub = subOf(p);
    var qid = 'qty_' + p.id;
    /* A photo the console uploaded arrives here as a `nito-media:` reference
       plus a published path in `imagePaths`; NitoMedia resolves the two into
       something an <img> can actually fetch. Falling through to the tech flat
       rather than emitting a broken <img> is deliberate — a missing picture on
       a product grid reads to a buyer as a business that cannot supply. */
    var photo = window.NitoMedia ? window.NitoMedia.resolve(refOf(p), p.imagePaths) : '';
    var img = photo
      ? '<img src="' + esc(photo) + '" alt="' + esc(p.name) + ' — ' + esc(p.code) + '" loading="lazy">'
      : flat(p.flat);

    return '<article class="pcard" data-cat="' + esc(p.cat) + '" data-sub="' + esc(sub) + '" ' +
        'data-name="' + esc((p.name + ' ' + (p.code || '') + ' ' + (p.blurb || '')).toLowerCase()) + '">' +

      '<div class="pcard__media">' +
        '<span class="pcard__code">' + esc(p.code) + '</span>' +
        img +
        '<div class="pcard__hover">' +
          '<div class="pcard__qty">' +
            '<input type="number" id="' + esc(qid) + '" min="1" step="1" value="' + moqNum(p) + '" ' +
              'aria-label="Quantity for ' + esc(p.name) + '">' +
          '</div>' +
          '<button type="button" class="pcard__ib" data-add-quote="' + esc(p.id) + '" ' +
            'data-qty-from="#' + esc(qid) + '" title="Add to quote list" ' +
            'aria-label="Add ' + esc(p.name) + ' to your quote list">' + icon('plus') + '</button>' +
          '<a class="pcard__ib" href="product.html?id=' + esc(p.id) + '" title="View details" ' +
            'aria-label="View details for ' + esc(p.name) + '">' + icon('arrow') + '</a>' +
        '</div>' +
      '</div>' +

      '<div class="pcard__body">' +
        '<span class="pcard__cat">' + esc(sub || '') + '</span>' +
        '<h3 class="pcard__name"><a href="product.html?id=' + esc(p.id) + '">' + esc(p.name) + '</a></h3>' +
        '<p class="pcard__blurb">' + esc(p.blurb) + '</p>' +
        '<dl class="pcard__spec">' +
          '<div><dt>MOQ</dt><dd>' + esc(String(p.moq || '—').replace(/ per .*/, '')) + '</dd></div>' +
          '<div><dt>Lead</dt><dd>' + esc(String(p.lead || '—').replace(/ after.*/, '')) + '</dd></div>' +
        '</dl>' +
      '</div>' +

      '<div class="pcard__foot">' +
        '<a class="btn btn--ghost btn--sm" href="product.html?id=' + esc(p.id) + '">Details</a>' +
        '<button class="btn btn--primary btn--sm" type="button" data-add-quote="' + esc(p.id) + '" ' +
          'data-qty-from="#' + esc(qid) + '" aria-label="Add ' + esc(p.name) + ' to your quote list">' +
          icon('plus') + 'Add to quote</button>' +
      '</div>' +
    '</article>';
  }

  var PAGE_SIZE = 12;

  function renderProductGrid() {
    var wrap = $('#productGrid');
    if (!wrap) return;

    /* ?cat= opens a division, ?sub= a sub-range, ?q= carries a header search */
    var state = {
      cat: param('cat') || 'all',
      sub: param('sub') || '',
      q: (param('q') || '').toLowerCase(),
      page: 1
    };
    if (state.cat === 'all') state.sub = '';

    var filterBar = $('#productFilters');
    var sideBar = $('#catalogSide');
    var pager = $('#productPager');
    var countEl = $('#productCount');

    /* ---- quick filter row ---- */
    if (filterBar) {
      var btns = [{ id: 'all', name: 'All products' }].concat(CAT.categories.map(function (c) {
        return { id: c.id, name: c.name };
      }));
      filterBar.innerHTML =
        btns.map(function (b) {
          return '<button class="fbtn' + (b.id === state.cat ? ' is-active' : '') + '" data-filter="' + esc(b.id) + '">' +
            esc(b.name) + '</button>';
        }).join('') +
        '<div class="filters__search">' + icon('search') +
          '<input type="search" id="productSearch" placeholder="Search product or code…" aria-label="Search products">' +
        '</div>';
    }

    /* ---- sidebar: category -> sub-range tree ---- */
    function drawSide() {
      if (!sideBar) return;
      sideBar.innerHTML =
        '<div class="side__head">Product ranges</div>' +
        '<ul class="side__list">' +
          '<li class="side__cat"><a class="' + (state.cat === 'all' ? 'is-active' : '') + '" href="products.html">' +
            icon('grid') + 'All products<span class="side__count">' + CAT.products.length + '</span></a></li>' +
          CAT.categories.map(function (c) {
            var open = state.cat === c.id;
            return '<li class="side__cat' + (open ? ' is-open' : '') + '">' +
              '<a class="' + (open && !state.sub ? 'is-active' : '') + '" href="products.html?cat=' + esc(c.id) + '">' +
                icon('layers') + esc(c.name) +
                '<span class="side__count">' + countIn(c.id) + '</span></a>' +
              (open
                ? '<ul class="side__sub">' +
                    '<li><a class="' + (!state.sub ? 'is-active' : '') + '" ' +
                      'href="products.html?cat=' + esc(c.id) + '">All ' + esc(c.name) + '</a></li>' +
                    c.items.map(function (it) {
                      var n = subCount(c.id, it);
                      if (!n) return '';
                      return '<li><a class="' + (state.sub === it ? 'is-active' : '') + '" ' +
                        'href="products.html?cat=' + esc(c.id) + '&sub=' + encodeURIComponent(it) + '">' +
                        esc(it) + '<span class="side__count">' + n + '</span></a></li>';
                    }).join('') +
                  '</ul>'
                : '') +
            '</li>';
          }).join('') +
        '</ul>' +
        '<div class="side__card">' +
          '<h2>Not seeing it?</h2>' +
          '<p>We manufacture far more than this page lists. Send a sketch, a sample or a tech pack and we will quote it.</p>' +
          '<a class="btn btn--primary btn--sm btn--block" href="contact.html">Send an enquiry</a>' +
        '</div>';
    }

    function filtered() {
      return CAT.products.filter(function (p) {
        if (state.cat !== 'all' && p.cat !== state.cat) return false;
        if (state.sub && subOf(p) !== state.sub) return false;
        if (state.q) {
          var hay = (p.name + ' ' + p.code + ' ' + p.blurb + ' ' + (p.fabric || '')).toLowerCase();
          if (hay.indexOf(state.q) === -1) return false;
        }
        return true;
      });
    }

    function drawPager(pages) {
      if (!pager) return;
      if (pages < 2) { pager.innerHTML = ''; return; }
      var out = '<button type="button" data-page="prev"' + (state.page === 1 ? ' disabled' : '') + '>Prev</button>';
      for (var i = 1; i <= pages; i++) {
        out += '<button type="button" data-page="' + i + '"' +
          (i === state.page ? ' class="is-active" aria-current="page"' : '') + '>' + i + '</button>';
      }
      out += '<button type="button" data-page="next"' + (state.page === pages ? ' disabled' : '') + '>Next</button>';
      pager.innerHTML = out;
    }

    function draw() {
      var all = filtered();
      var pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
      if (state.page > pages) state.page = pages;
      if (state.page < 1) state.page = 1;

      var start = (state.page - 1) * PAGE_SIZE;
      var list = all.slice(start, start + PAGE_SIZE);

      if (countEl) {
        var where = state.sub ? state.sub
          : (state.cat !== 'all' && catById(state.cat) ? catById(state.cat).name : '');
        var noun = all.length === 1 ? ' product line' : ' product lines';
        countEl.textContent = all.length
          ? 'Showing ' + (start + 1) + '\u2013' + (start + list.length) + ' of ' + all.length +
            noun + (where ? ' in ' + where : '')
          : 'No products matched' + (where ? ' in ' + where : '');
      }

      if (!all.length) {
        wrap.innerHTML = '<div class="empty" style="grid-column:1/-1">' + icon('search') +
          '<p class="h-card">No products match that filter</p>' +
          '<p class="small" style="color:var(--t3)">We manufacture far more than we list. Tell us what you need and we will quote it.</p>' +
          '<a class="btn btn--primary btn--sm" href="contact.html">Send an enquiry</a></div>';
        if (pager) pager.innerHTML = '';
        return;
      }

      wrap.innerHTML = list.map(productCard).join('');
      drawPager(pages);
    }

    function syncFilters() {
      if (!filterBar) return;
      $$('.fbtn', filterBar).forEach(function (x) {
        x.classList.toggle('is-active', x.getAttribute('data-filter') === state.cat);
      });
    }

    function syncUrl() {
      var qs = [];
      if (state.cat !== 'all') qs.push('cat=' + state.cat);
      if (state.sub) qs.push('sub=' + encodeURIComponent(state.sub));
      history.replaceState(null, '', 'products.html' + (qs.length ? '?' + qs.join('&') : ''));
    }

    if (filterBar) {
      filterBar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-filter]');
        if (!b) return;
        state.cat = b.getAttribute('data-filter');
        state.sub = '';
        state.page = 1;
        syncUrl(); syncFilters(); drawSide(); draw();
      });

      var search = $('#productSearch');
      if (search) {
        search.value = state.q;
        search.addEventListener('input', function () {
          state.q = search.value.trim().toLowerCase();
          state.page = 1;
          draw();
        });
      }
    }

    if (pager) {
      pager.addEventListener('click', function (e) {
        var b = e.target.closest('[data-page]');
        if (!b || b.disabled) return;
        var v = b.getAttribute('data-page');
        var pages = Math.max(1, Math.ceil(filtered().length / PAGE_SIZE));
        if (v === 'prev') state.page = Math.max(1, state.page - 1);
        else if (v === 'next') state.page = Math.min(pages, state.page + 1);
        else state.page = parseInt(v, 10);
        draw();
        var g = $('#productGrid');
        if (g) {
          window.scrollTo({ top: g.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
        }
      });
    }

    drawSide();
    draw();
  }

  function renderProductDetail() {
    var root = $('#pdp');
    if (!root) return;
    var id = param('id');
    var p = prodById(id) || CAT.products[0];
    if (!p) return;

    var cat = catById(p.cat);
    document.title = p.name + ' — ' + p.code + ' | ' + S.brand;

    var waMsg = 'Hello NITO SPORTS,\n\nI am interested in: ' + p.name + ' (' + p.code + ')' +
      '\n\nPlease send me a quotation with:\n- Quantity:\n- Sizes:\n- Customization required:\n- Delivery country:\n\nThank you.';

    function chips(arr, cls) {
      return (arr || []).map(function (x) { return '<span class="tag ' + (cls || '') + '">' + esc(x) + '</span>'; }).join('');
    }

    /* Real photos take over automatically as soon as the owner adds an
       `images: [...]` array to a product. Until then we show the tech flat
       rather than padding the page with stock photography.

       Exported catalog.js carries plain data: URLs, which resolve to
       themselves; a live backend hands over `nito-media:` refs, which resolve
       through the media store. resolveFull() covers both without the caller
       needing to know which world it is in. */
    var M = window.NitoMedia;
    /* With no media library loaded, whatever is in `images` is already a plain
       path or data: URL from an older export — pass it straight through rather
       than blanking the product's photography. */
    var imgs = (p.images || []).map(function (r) {
      return M ? M.resolveFull(r, p.imagePaths) : r;
    }).filter(Boolean);

    var mainView = imgs.length
      ? '<img src="' + esc(imgs[0]) + '" alt="' + esc(p.name) + ' — ' + esc(p.code) +
        ', manufactured by NITO SPORTS in Sialkot" width="900" height="900">'
      : flat(p.flat);

    var thumbs = imgs.length > 1
      ? '<div class="pdp__thumbs">' + imgs.map(function (src, i) {
          return '<button type="button" class="pdp__thumb' + (i === 0 ? ' is-active' : '') + '" ' +
            'data-view="' + esc(src) + '" aria-label="Show image ' + (i + 1) + '">' +
            '<img src="' + esc(src) + '" alt="" loading="lazy"></button>';
        }).join('') + '</div>'
      : '';

    /* Only a real photograph can be zoomed. With no photos the main view is an
       SVG tech-pack drawing, so render a plain div: a <button> there would sit
       in the accessibility tree with nothing to announce, which is what the
       audit flagged. initGallery() keys off [data-zoom] and .pdp__thumb, so a
       div simply gets no handlers. */
    var mainEl = imgs.length
      ? '<button class="pdp__main is-zoomable" type="button" data-zoom="' + esc(imgs[0]) + '" aria-label="Zoom product image">'
      : '<div class="pdp__main">';

    root.innerHTML =
      '<div class="pdp__gallery" data-reveal>' +
        mainEl +
          mainView +
          (imgs.length ? '<span class="pdp__zoom">' + icon('zoom') + 'Zoom</span>' : '') +
        (imgs.length ? '</button>' : '</div>') +
        thumbs +
        '<div class="note" style="margin-top:4px">' + icon('spark') +
          '<div><p class="note__t">Want to see it in your colours first?</p>' +
          '<p>There is no live colour-swap tool on this site. Send us your logo and reference and we will produce a free digital mock-up of this product in your colourway before you commit to anything.</p></div>' +
        '</div>' +
      '</div>' +

      '<div class="pdp__info" data-reveal="right">' +
        '<div class="crumbs"><a href="index.html">Home</a>' + icon('chevron') +
          '<a href="products.html">Products</a>' + icon('chevron') +
          '<a href="products.html?cat=' + esc(p.cat) + '">' + esc(cat ? cat.name : '') + '</a>' + icon('chevron') +
          '<span>' + esc(p.code) + '</span></div>' +

        '<div class="stack gap-3">' +
          '<div class="tag-row">' + chips(p.tags, 'tag--blue') + '<span class="tag tag--outline">' + esc(p.code) + '</span></div>' +
          '<h1 class="display-l" style="font-size:clamp(1.8rem,3.6vw,2.8rem)">' + esc(p.name) + '</h1>' +
          '<p class="lead">' + esc(p.desc) + '</p>' +
        '</div>' +

        '<div class="spec-table">' +
          '<div class="spec-table__row"><div class="spec-table__k">Fabric / Material</div><div class="spec-table__v">' + esc(p.fabric) + '</div></div>' +
          '<div class="spec-table__row"><div class="spec-table__k">Weight</div><div class="spec-table__v mono">' + esc(p.gsm) + '</div></div>' +
          '<div class="spec-table__row"><div class="spec-table__k">Minimum Order</div><div class="spec-table__v mono">' + esc(p.moq) + '</div></div>' +
          '<div class="spec-table__row"><div class="spec-table__k">Sizes</div><div class="spec-table__v">' + esc(p.sizes) + '</div></div>' +
          '<div class="spec-table__row"><div class="spec-table__k">Lead Time</div><div class="spec-table__v">' + esc(p.lead) + '</div></div>' +
        '</div>' +

        '<div class="stack gap-3">' +
          '<span class="eyebrow">Customization options</span>' +
          '<div class="tag-row">' + chips(p.custom) + '</div>' +
        '</div>' +

        '<div class="stack gap-3">' +
          '<span class="eyebrow">Available styles</span>' +
          '<div class="tag-row">' + chips(p.styles, 'tag--outline') + '</div>' +
        '</div>' +

        '<div class="stack gap-3">' +
          '<span class="eyebrow">Colours</span>' +
          '<div class="tag-row">' + chips(p.colors, 'tag--outline') + '</div>' +
        '</div>' +

        '<div class="note note--warn">' + icon('palette') +
          '<div><p class="note__t">Any colour. Any logo. Any placement.</p>' +
          '<p>Nothing on this page is fixed. If you want a different colourway, a different fabric weight, your logo somewhere we have not listed, or a completely different block — tell us and we will make it. There is no configuration tool on the website because every order here is made to order anyway.</p></div>' +
        '</div>' +

        '<div class="pdp__buy">' +
          '<div class="qty qty--lg">' +
            '<button type="button" class="qty__b" data-qty-dec aria-label="Decrease quantity">' + icon('minus') + '</button>' +
            '<input class="qty__i" type="number" id="pdpQty" min="1" step="1" value="' + moqNum(p) + '" aria-label="Quantity required">' +
            '<button type="button" class="qty__b" data-qty-inc aria-label="Increase quantity">' + icon('plus') + '</button>' +
          '</div>' +
          '<button class="btn btn--primary btn--lg" type="button" data-add-quote="' + esc(p.id) + '" data-qty-from="#pdpQty">' +
            icon('plus') + 'Add to quote list</button>' +
        '</div>' +
        '<p class="small" style="color:var(--t4)">Pre-filled at the minimum order quantity — change it to suit. ' +
          'Add as many products as you need, then send them all in one enquiry from your quote list.</p>' +

        '<div class="btn-row">' +
          '<a class="btn btn--ghost btn--lg" href="contact.html?product=' + encodeURIComponent(p.name + ' (' + p.code + ')') + '">' + icon('doc') + 'Request a Quote</a>' +
          '<a class="btn btn--wa btn--lg" href="' + waLink(waMsg) + '" target="_blank" rel="noopener">' + icon('wa') + 'WhatsApp Enquiry</a>' +
        '</div>' +

        '<div class="divider"></div>' +

        '<div class="grid g-2" style="gap:var(--s4)">' +
          '<div class="cred">' + icon('box', 'cred__icon') + '<div><div class="cred__t">Direct factory pricing</div><div class="cred__d">No trading house in the middle. You are quoting with the people who cut and sew it.</div></div></div>' +
          '<div class="cred">' + icon('truck', 'cred__icon') + '<div><div class="cred__t">Worldwide shipping</div><div class="cred__d">Air express, air freight and sea freight, quoted to your door or your port.</div></div></div>' +
        '</div>' +
      '</div>';

    /* ---- related products from the same range ---- */
    var related = CAT.products.filter(function (x) {
      return x.cat === p.cat && x.id !== p.id;
    }).slice(0, 4);

    if (related.length >= 2) {
      var host = document.createElement('section');
      host.className = 'section section--alt';
      host.innerHTML = '<div class="container">' +
        '<div class="sec-head" data-reveal>' +
          '<span class="eyebrow">More in this range</span>' +
          '<h2 class="h-sec">' + esc(cat ? cat.name : 'Related products') + '</h2>' +
        '</div>' +
        '<div class="grid g-auto mt-7" data-stagger>' + related.map(productCard).join('') + '</div>' +
        '<div class="btn-row mt-7"><a class="btn btn--ghost" href="products.html?cat=' + esc(p.cat) + '">' +
          'See the full ' + esc(cat ? cat.name : 'range') + '</a></div>' +
      '</div>';

      var anchor = root.closest('section') || root;
      if (anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling);
      initReveal();
    }

    initLightbox(root);
  }

  /* ---------- image lightbox --------------------------------------------- */

  function initLightbox(scope) {
    var overlay = document.getElementById('nitoLightbox');

    function close() {
      if (!overlay) return;
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(function () { overlay.hidden = true; }, 260);
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'nitoLightbox';
      overlay.className = 'lightbox';
      overlay.hidden = true;
      overlay.innerHTML = '<button class="lightbox__x" type="button" aria-label="Close image">' + icon('x') + '</button>' +
        '<div class="lightbox__body"><img alt="Product image enlarged"></div>';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || (e.target.closest && e.target.closest('.lightbox__x'))) close();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    function open(src) {
      var img = overlay.querySelector('img');
      if (img) img.src = src;
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
    }

    var root = scope || document;
    var zoomBtn = $('.pdp__main[data-zoom]', root);
    if (zoomBtn) {
      zoomBtn.addEventListener('click', function () { open(zoomBtn.getAttribute('data-zoom')); });
    }

    $$('.pdp__thumb[data-view]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var src = b.getAttribute('data-view');
        var main = $('.pdp__main', root);
        if (main) {
          main.setAttribute('data-zoom', src);
          var img = $('img', main);
          if (img) img.src = src;
        }
        $$('.pdp__thumb', root).forEach(function (o) { o.classList.toggle('is-active', o === b); });
      });
    });
  }

  /* ---------- enquiry form ----------------------------------------------- */

  var FILES = [];

  function initEnquiry() {
    var form = $('#enquiryForm');
    if (!form) return;

    /* prefill product from ?product= */
    var pre = param('product');
    if (pre) {
      var pf = $('#f-product', form);
      if (pf) pf.value = pre;
    }

    /* file drop */
    var zone = $('#dropZone', form);
    var input = $('#f-files', form);
    var listEl = $('#fileList', form);

    function humanSize(b) {
      if (b < 1024) return b + ' B';
      if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
      return (b / 1048576).toFixed(1) + ' MB';
    }

    function drawFiles() {
      if (!listEl) return;
      listEl.innerHTML = FILES.map(function (f, i) {
        return '<div class="file-chip">' + icon('doc') +
          '<span class="file-chip__n">' + esc(f.name) + '</span>' +
          '<span class="file-chip__s">' + humanSize(f.size) + '</span>' +
          '<button type="button" data-rm="' + i + '" aria-label="Remove file">' + icon('x') + '</button></div>';
      }).join('');
    }

    function addFiles(fileList) {
      Array.prototype.slice.call(fileList).forEach(function (f) {
        if (FILES.length >= 8) return;
        if (f.size > 20 * 1024 * 1024) return;
        FILES.push(f);
      });
      drawFiles();
    }

    if (zone && input) {
      zone.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('is-drag'); });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }

    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rm]');
        if (!b) return;
        FILES.splice(parseInt(b.getAttribute('data-rm'), 10), 1);
        drawFiles();
      });
    }

    /* validation */
    function setErr(field, on, msg) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.toggle('is-error', on);
      var e = $('.field__err', wrap);
      if (e && msg) e.textContent = msg;
    }

    function validate() {
      var ok = true;
      var req = $$('[required]', form);
      req.forEach(function (el) {
        var empty = !String(el.value || '').trim();
        setErr(el, empty, el.getAttribute('data-msg') || 'This field is required.');
        if (empty) ok = false;
      });
      var email = $('#f-contact', form);
      if (email && email.value.trim()) {
        var v = email.value.trim();
        var looksEmail = v.indexOf('@') > -1 && v.indexOf('.') > -1;
        var looksPhone = /^[+]?[\d\s().-]{7,}$/.test(v);
        if (!looksEmail && !looksPhone) {
          setErr(email, true, 'Enter a valid e-mail address or WhatsApp number.');
          ok = false;
        }
      }
      var consent = $('#f-consent', form);
      if (consent && !consent.checked) {
        var cw = consent.closest('.field');
        if (cw) cw.classList.add('is-error');
        ok = false;
      }
      return ok;
    }

    /* A per-enquiry reference the buyer can quote on WhatsApp or over the phone.
       YYMMDD + four digits: readable aloud, and sortable by date. */
    function makeRef() {
      var d = new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      var stamp = String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
      return 'NTO-' + stamp + '-' + (Math.floor(Math.random() * 9000) + 1000);
    }

    function buildText(ref) {
      var g = function (id) { var el = $('#' + id, form); return el ? String(el.value || '').trim() : ''; };
      var basket = g('f-items');
      /* single asterisks render as bold inside WhatsApp */
      var B = function (v) { return '*' + v + '*'; };

      var lines = [
        B('NEW ENQUIRY — NITO SPORTS'),
        B('Order ref: ' + ref),
        '',
        B('Buyer'),
        'Name: ' + g('f-name'),
        'Company / Brand: ' + (g('f-company') || '—'),
        'Country: ' + g('f-country'),
        'Contact (WhatsApp / E-mail): ' + g('f-contact'),
        '',
        B('Product required'),
        g('f-product')
      ];

      /* A quote-list enquiry carries a multi-product block instead of one line */
      if (basket) {
        var n = basket.split('\n').filter(function (s) { return s.trim(); }).length;
        lines.push('', B('Quote list — ' + n + ' product line' + (n === 1 ? '' : 's')), basket);
      }

      lines = lines.concat([
        '',
        B('Order details'),
        'Quantity: ' + (g('f-qty') || '—'),
        'Sizes: ' + (g('f-sizes') || '—'),
        'Delivery date needed: ' + (g('f-date') || '—'),
        '',
        B('Customization / logo / printing'),
        (g('f-custom') || '—'),
        '',
        B('Message'),
        (g('f-message') || '—')
      ]);

      /* only mention files when there are some */
      if (FILES.length) {
        lines = lines.concat([
          '',
          B('Reference files'),
          FILES.map(function (f) { return f.name; }).join(', ') + ' — attaching in this chat'
        ]);
      }

      lines.push('', '— sent from ' + (S.domain || 'nitosports.com'));

      return lines.join('\n');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('#formStatus', form);

      if (!validate()) {
        var firstErr = $('.field.is-error', form);
        if (firstErr) scrollIntoViewSafe(firstErr);
        if (status) {
          status.className = 'form-status form-status--err is-on';
          status.innerHTML = icon('x') + '<div><div class="form-status__t">Please check the highlighted fields</div>' +
            '<div class="form-status__d">Name, Country, Contact and Product are required so we can quote accurately.</div></div>';
        }
        return;
      }

      /* One reference per enquiry. If the buyer double-clicks Submit, or resubmits
         the identical details, keep the same reference rather than creating a
         second enquiry number for the same request. */
      var ref = makeRef();
      var text = buildText(ref);
      var body = text.split(ref).join('{REF}');
      if (form.dataset.lastBody === body && form.dataset.ref) {
        ref = form.dataset.ref;
        text = buildText(ref);
      }
      form.dataset.ref = ref;
      form.dataset.lastBody = body;

      var product = $('#f-product', form).value || 'NITO SPORTS';
      var subject = '[' + ref + '] Quotation request — ' + product + ' — ' + $('#f-name', form).value;

      /* Build the record once, in the shape the console inbox reads. Field
         names here MUST match the enquiry drawer in admin-pages.js (qty,
         sizes, deadline, custom) — the close button is `#f-close` but the
         record is `deadline`, and a mismatch shows as an empty row on a lead
         the operator is trying to quote. */
      /* `#f-items` exists only on the quote page (it is the hidden basket
         field). Reading it directly on the contact page crashes the submit
         handler, which would lose the lead in the one place it is being
         captured — so it is read defensively. */
      var contact = String($('#f-contact', form).value || '').trim();
      var looksEmail = contact.indexOf('@') > -1 && contact.indexOf('.') > -1;
      var itemsEl = $('#f-items', form);
      var basketRows = itemsEl ? String(itemsEl.value || '').trim() : '';

      var record = {
        ref: ref,
        name: String($('#f-name', form).value || '').trim(),
        company: String($('#f-company', form).value || '').trim(),
        country: String($('#f-country', form).value || '').trim(),
        email: looksEmail ? contact : '',
        phone: looksEmail ? '' : contact,
        contact: contact,
        product: product,
        qty: String($('#f-qty', form).value || '').trim(),
        sizes: String($('#f-sizes', form).value || '').trim(),
        deadline: String($('#f-date', form).value || '').trim(),
        custom: String($('#f-custom', form).value || '').trim(),
        message: String($('#f-message', form).value || '').trim(),
        items: basketRows || '',
        files: FILES.map(function (f) { return f.name; }).join(', '),
        status: 'new',
        source: 'website-contact-form',
        subject: subject,
        createdAt: new Date().toISOString()
      };

      /* STEP 1 — record it locally, before anything else can fail.
         This is the step that guarantees the lead is not lost: a popup
         blocker, an offline device or a wrong WhatsApp number can all break
         the channels below, and none of them can break this. */
      var saved = { ok: false, duplicate: false };
      var E = window.NitoEnquiries;
      if (E) {
        try { saved = E.record(record); }
        catch (err) { saved = { ok: false, duplicate: false, error: String(err) }; }
      }

      /* STEP 2 — e-mail, if the owner configured an endpoint. Attempted before
         the WhatsApp window opens so the fetch is not competing with a tab
         switch, and reported rather than swallowed: the operator needs to know
         whether mail actually left. */
      var mailOutcome = { ok: false, reason: 'not-attempted' };
      if (E && S.formEndpoint) mailOutcome = E.email(record, S.formEndpoint);

      /* STEP 3 — WhatsApp opens synchronously so the popup is not blocked. */
      var wa = window.open(waLink(text), '_blank', 'noopener');

      if (status) {
        var channels = [];
        if (wa) channels.push('WhatsApp opened in a new tab');
        channels.push(saved.ok
          ? (saved.duplicate ? 'your enquiry is already logged in our console'
                             : 'your enquiry is logged in our console')
          : 'we could not log this in the browser — please use the buttons below');

        status.className = 'form-status form-status--ok is-on';
        status.innerHTML = icon('check') +
          '<div><div class="form-status__t">Enquiry ready' +
            (wa ? ' — WhatsApp opened in a new tab' : '') + '</div>' +
          '<div class="form-status__d">' +
            'Your order reference is <span class="ref-chip">' + esc(ref) + '</span> — it is already ' +
            'written at the top of the WhatsApp message. Quote it in any follow-up so we can find your enquiry.' +
            '<br>' +
            (FILES.length
              ? 'Attach your ' + FILES.length + ' reference file' + (FILES.length > 1 ? 's' : '') + ' to that WhatsApp chat (paperclip icon) before sending. '
              : '') +
            'If the tab did not open, use the buttons below — every detail is already filled in.' +
            '<div class="form-status__ch">' + channels.map(function (c) {
              return '<span class="form-status__ch-i">' + icon('check') + esc(c) + '</span>';
            }).join('') + '</div>' +
            (S.formEndpoint && mailOutcome && mailOutcome.ok === false && mailOutcome.reason !== 'not-attempted'
              ? '<div class="form-status__note">The automatic e-mail copy did not go through ('
                 + esc(mailOutcome.reason) + '). WhatsApp still carries every detail.</div>'
              : '') +
            '<div class="btn-row" style="margin-top:14px">' +
              '<a class="btn btn--wa btn--sm" href="' + waLink(text) + '" target="_blank" rel="noopener">' + icon('wa') + 'Open WhatsApp</a>' +
              '<a class="btn btn--ghost btn--sm" href="' + mailLink(subject, text) + '">' + icon('mail') + 'Send by e-mail</a>' +
            '</div>' +
          '</div></div>';
        scrollIntoViewSafe(status);
      }
    });
  }

  /* ---------- hero slider ------------------------------------------------- */

  function initSlider() {
    var root = $('#heroSlider');
    if (!root) return;
    var slides = $$('.slider__slide', root);
    if (slides.length < 2) return;

    var dotsWrap = $('#heroDots', root);
    var idx = 0;
    var timer = null;
    var delay = parseInt(root.getAttribute('data-autoplay'), 10) || 5400;

    /* Fill each graphic slide with real tech flats rather than stock photos.
       A slide can choose its own set via data-flats="a,b,c". */
    if (F) {
      var DEFAULT_FLATS = ['jersey', 'hoodie', 'tracksuit', 'shorts', 'fights', 'duffel'];
      $$('.slider__flats', root).forEach(function (host) {
        var want = (host.getAttribute('data-flats') || '').split(',')
          .map(function (t) { return t.trim(); })
          .filter(function (t) { return t && F.SHAPES && F.SHAPES[t]; });
        if (!want.length) want = DEFAULT_FLATS;
        host.innerHTML = want.map(function (t) {
          return '<div class="slider__flat">' + flat(t) + '</div>';
        }).join('');
      });
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = slides.map(function (_, n) {
        return '<button type="button" class="slider__dot' + (n === 0 ? ' is-active' : '') + '" ' +
          'data-slide="' + n + '" aria-label="Go to slide ' + (n + 1) + '"></button>';
      }).join('');
    }

    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === idx); });
      $$('.slider__dot', root).forEach(function (d, k) { d.classList.toggle('is-active', k === idx); });
    }
    function next() { go(idx + 1); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      stop();
      if (reduceMotion() || document.hidden) return;
      timer = setInterval(next, delay);
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-slide]');
      if (!b) return;
      var v = b.getAttribute('data-slide');
      if (v === 'next') { next(); play(); }
      else if (v === 'prev') { go(idx - 1); play(); }
      else { go(parseInt(v, 10)); play(); }
    });

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', play);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', play);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });

    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 42) { if (dx < 0) next(); else go(idx - 1); play(); }
      x0 = null;
    }, { passive: true });

    go(0);
    play();
  }

  /* ---------- featured rail ----------------------------------------------- */

  function renderFeaturedRail() {
    var host = $('#featuredRail');
    if (!host) return;

    var ids = ['football-kit', 'team-tracksuit', 'gym-shorts', 'compression-leggings',
               'street-hoodie', 'oversized-tee', 'boxing-shorts', 'mma-shorts',
               'snapback-cap', 'sports-duffel'];
    var list = ids.map(prodById).filter(Boolean);
    if (!list.length) list = CAT.products.slice(0, 10);

    host.innerHTML = '<div class="rail__track" id="railTrack">' + list.map(productCard).join('') + '</div>';

    var track = $('#railTrack', host);
    if (!track) return;

    function step(dir) {
      var card = track.querySelector('.pcard');
      var w = card ? card.getBoundingClientRect().width + 20 : 320;
      track.scrollBy({ left: dir * w * 2, behavior: 'smooth' });
    }

    var prev = $('[data-rail="prev"]');
    var nextB = $('[data-rail="next"]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (nextB) nextB.addEventListener('click', function () { step(1); });

    /* Dim the arrows when there is nothing left to scroll to */
    function syncArrows() {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (nextB) nextB.disabled = track.scrollLeft >= max;
    }
    track.addEventListener('scroll', syncArrows, { passive: true });
    window.addEventListener('resize', syncArrows);
    syncArrows();
  }

  /* ---------- header search ----------------------------------------------- */

  function initSearch() {
    var panel = $('#searchPanel');
    var openBtn = $('#searchOpen');
    var closeBtn = $('#searchClose');
    var form = $('#searchForm');
    var input = $('#searchInput');
    var results = $('#searchResults');
    if (!panel || !openBtn) return;

    function setOpen(open) {
      panel.hidden = !open;
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.classList.toggle('is-searching', open);
      if (open) {
        if (input) input.value = '';
        draw('');
        if (input) setTimeout(function () { input.focus(); }, 40);
      }
    }

    function draw(q) {
      if (!results) return;
      q = String(q || '').trim().toLowerCase();

      if (!q) {
        results.innerHTML = '<div class="search-hint"><span class="eyebrow">Popular searches</span>' +
          '<div class="tag-row">' +
            ['Football kit', 'Boxing shorts', 'Hoodie', 'Leggings', 'Duffel bag', 'MMA shorts']
              .map(function (t) {
                return '<button type="button" class="tag search-chip" data-q="' + esc(t) + '">' + esc(t) + '</button>';
              }).join('') +
          '</div></div>';
        return;
      }

      var hits = CAT.products.filter(function (p) {
        return (p.name + ' ' + p.code + ' ' + p.blurb + ' ' + (p.fabric || '')).toLowerCase().indexOf(q) > -1;
      }).slice(0, 8);

      if (!hits.length) {
        results.innerHTML = '<div class="search-none">' + icon('search') +
          '<p>Nothing matched &ldquo;' + esc(q) + '&rdquo;. We manufacture far more than this page lists &mdash; ' +
          'send us an enquiry and we will tell you honestly whether we can make it.</p>' +
          '<a class="btn btn--primary btn--sm" href="contact.html">Send an enquiry</a></div>';
        return;
      }

      results.innerHTML = '<div class="search-list">' + hits.map(function (p) {
        var c = catById(p.cat);
        return '<a class="sres" href="product.html?id=' + esc(p.id) + '">' +
          '<span class="sres__media">' + flat(p.flat) + '</span>' +
          '<span class="sres__body">' +
            '<span class="sres__code mono">' + esc(p.code) + '</span>' +
            '<span class="sres__name">' + esc(p.name) + '</span>' +
            '<span class="sres__cat">' + esc(c ? c.name : '') + '</span>' +
          '</span>' + icon('arrow') + '</a>';
      }).join('') + '</div>' +
      '<a class="search-all" href="products.html?q=' + encodeURIComponent(q) + '">' +
        'See all matching products' + icon('arrow') + '</a>';
    }

    openBtn.addEventListener('click', function () { setOpen(panel.hidden); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
    if (input) input.addEventListener('input', function () { draw(input.value); });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = input ? input.value.trim() : '';
        if (q) window.location.href = 'products.html?q=' + encodeURIComponent(q);
      });
    }

    if (results) {
      results.addEventListener('click', function (e) {
        var chip = e.target.closest && e.target.closest('[data-q]');
        if (chip && input) { input.value = chip.getAttribute('data-q'); draw(input.value); }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) setOpen(false);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(true); }
    });

    draw('');
  }

  /* ---------- newsletter --------------------------------------------------- */

  function initNewsletter() {
    var form = $('#newsletterForm');
    if (!form) return;
    var input = $('#newsletterEmail', form);
    var status = $('#newsletterStatus', form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input ? input.value.trim() : '';
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

      if (!ok) {
        if (status) { status.className = 'footer__news-status is-err'; status.textContent = 'Please enter a valid e-mail address.'; }
        if (input) input.focus();
        return;
      }

      if (status) { status.className = 'footer__news-status is-ok'; status.textContent = 'Thank you — you are on the list.'; }
      if (input) input.value = '';

      if (S.formEndpoint) {
        try {
          fetch(S.formEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              access_key: S.formEndpoint.split('/').pop(),
              subject: 'Newsletter signup — ' + v,
              from_name: 'NITO SPORTS Website',
              email: v,
              message: 'Newsletter subscription request from the website footer.'
            })
          }).catch(function () {});
        } catch (err) { /* the on-screen confirmation still stands */ }
      }
    });
  }

  /* ---------- boot ------------------------------------------------------- */

  var booted = false;

  function draw() {
    /* Take the catalogue snapshot HERE, not at script-eval time. The live-data
       bridge (assets/js/live-data.js) may have replaced window.NITO_CATALOG
       with the operator's published lines from the hosted backend, and this is
       the first moment that is guaranteed to have settled. Falls back to the
       static file whenever the bridge is absent or inactive. */
    CAT = window.NITO_CATALOG || { categories: [], products: [] };
    S = window.NITO_SITE || S;
    PAY = window.NITO_PAYMENTS || PAY;

    mountComponents();
    initNav();
    renderCategoryCards('#categoryGrid');
    renderProductGrid();
    renderProductDetail();
    renderFeaturedRail();
    initSlider();
    initSearch();
    initReveal();
    initCounters();
    initFaq();
    initMisc();
    initEnquiry();
    initNewsletter();
    initToTop();
    /* the header is mounted by JS, so re-sync the basket badge afterwards */
    if (window.NitoBasket && window.NitoBasket.refresh) window.NitoBasket.refresh();
  }

  function boot() {
    /* Idempotent: if the script tag is ever included twice (easy to do by
       accident when pasting into a template) the second run is a no-op
       instead of double-appending slides and double-binding handlers. */
    if (booted) return;
    booted = true;

    /* Wait for the live-data bridge so the FIRST draw already has the right
       catalogue — there is no second render pass to correct it afterwards.
       With no bridge on the page (or on the local adapter, which is what runs
       today) `ready` is already resolved, so this costs nothing. */
    var live = window.NITO_LIVE && window.NITO_LIVE.ready;
    if (live && typeof live.then === 'function') live.then(draw, draw);
    else draw();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
