/* Smoke test: load each page in jsdom, run the site scripts in order, assert
   that the dynamic regions actually rendered, that no errors were thrown, and
   that the enquiry-basket flow really works end to end. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
/* Mirrors the <script> order in the public HTML files. Keep it in step: a
   module the real page loads and this list omits is one this suite silently
   never exercises (that is how a broken `global` reference in site.js once
   passed the smoke test while killing the live grid). */
const SCRIPTS = [
  'assets/js/flats.js',
  'assets/js/catalog.js',
  'assets/js/basket.js',
  'assets/js/live-data.js',
  'assets/js/media.js',
  'assets/js/enquiries.js',
  'assets/js/site.js'
];

const BASKET_KEY = 'nito_quote_v1';

const PAGES = [
  {
    file: 'index.html', url: '/index.html',
    expect: [
      ['#heroSlider .slider__slide', 3],
      ['#heroDots .slider__dot', 3],
      ['#heroFlats .slider__flat', 6],
      ['#heroFlats2 .slider__flat', 6],
      ['.why-choose .why-choose__i', 4],
      ['#featuredRail .pcard', 10],
      ['#categoryGrid .cat-block', 5],
      ['#paymentGrid .pay', 6],
      ['#newsletterForm', 1],
      ['#searchPanel', 1],
      ['#site-header .basket', 1]
    ]
  },
  {
    file: 'products.html', url: '/products.html',
    expect: [
      ['#productGrid .pcard', 12],            // page 1 of paginated catalogue
      ['#productFilters .fbtn', 6],           // "All products" + 5 divisions
      ['#catalogSide .side__cat', 6],         // sidebar tree: all + 5 divisions
      ['#productGrid .pcard__hover', 12],     // qty box + add-to-quote on every tile
      ['#productGrid .pcard__code', 12],
      ['.crumbs', 1],
      ['#productPager button', null],
      ['#productCount', 1]
    ],
    checks: [{
      label: 'no category is expanded on the all-products view',
      fn: (w) => w.document.querySelectorAll('#catalogSide .side__sub').length === 0
    }, {
      label: 'pager shows every page and the active page is marked',
      fn: (w) => {
        const btns = w.document.querySelectorAll('#productPager button[data-page]');
        const active = w.document.querySelectorAll('#productPager button.is-active');
        return btns.length >= 5 && active.length === 1 && active[0].getAttribute('data-page') === '1';
      }
    }, {
      label: 'basket: add() stores the item and updates the header badge',
      fn: (w) => {
        w.NitoBasket.add('gym-shorts', 50);
        const stored = JSON.parse(w.localStorage.getItem(BASKET_KEY) || '[]');
        const badge = w.document.querySelector('#site-header .basket__n');
        return stored.length === 1 &&
               stored[0].id === 'gym-shorts' &&
               stored[0].qty === 50 &&
               badge && badge.textContent === '1' && badge.hidden === false;
      }
    }, {
      label: 'basket: default quantity falls back to the product MOQ',
      fn: (w) => {
        w.NitoBasket.clear();
        w.NitoBasket.add('football-kit');           // MOQ "30 sets per design"
        const stored = JSON.parse(w.localStorage.getItem(BASKET_KEY) || '[]');
        return stored.length === 1 && stored[0].qty === 30;
      }
    }, {
      label: 'basket: setQty / remove behave',
      fn: (w) => {
        w.NitoBasket.add('boxing-shorts', 10);
        w.NitoBasket.setQty('boxing-shorts', 99);
        const after = w.NitoBasket.items().find((i) => i.id === 'boxing-shorts');
        if (!after || after.qty !== 99) return false;
        w.NitoBasket.remove('boxing-shorts');
        return !w.NitoBasket.has('boxing-shorts') && w.NitoBasket.count() === 1;
      }
    }]
  },
  {
    file: 'products.html', url: '/products.html?cat=gym',
    expect: [['#productGrid .pcard', 12], ['#catalogSide .side__cat.is-open', 1]],
    checks: [{
      label: 'open division expands a sub-range tree whose links carry cat + sub params',
      fn: (w) => {
        const subs = w.document.querySelectorAll('#catalogSide .side__sub a');
        if (subs.length < 3) return false;
        return Array.from(subs).every((a) => {
          const href = a.getAttribute('href');
          return /^products\.html\?cat=gym(&sub=.+)?$/.test(href);
        });
      }
    }]
  },
  {
    file: 'products.html', url: '/products.html?cat=teamwear&sub=Cricket',
    expect: [['#productGrid .pcard', null], ['#catalogSide .side__sub a.is-active', 1]]
  },
  { file: 'products.html', url: '/products.html?q=hoodie', expect: [['#productGrid .pcard', null]] },
  {
    file: 'product.html', url: '/product.html?id=football-kit',
    expect: [
      ['#pdp .spec-table__row', 5],
      ['#pdp .pdp__buy .qty__i', 1],
      ['#pdp [data-add-quote]', 1],
      ['#pdp .pdp__thumb', 0]          // no photos yet -> no fake duplicate thumbs
    ],
    checks: [{
      label: 'product page renders a related-products block from the same range',
      fn: (w) => w.document.querySelectorAll('main > section .pcard').length >= 2
    }]
  },
  { file: 'about.html', url: '/about.html', expect: [['#categoryGrid .cat-block', 5]] },
  { file: 'customization.html', url: '/customization.html', expect: [['.steps .step', 4]] },
  {
    file: 'contact.html', url: '/contact.html',
    expect: [['#enquiryForm .field', 12], ['#f-country option', 48]],
    checks: [{
      label: 'enquiry submit hands every field to WhatsApp, led by an order reference',
      fn: (w) => {
        const opened = [];
        w.open = (u) => { opened.push(u); return { closed: false, focus() {} }; };
        const set = (id, v) => {
          const e = w.document.getElementById(id);
          if (e) { e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); }
        };
        set('f-name', 'John Whitfield');
        set('f-company', 'Northside FC');
        set('f-country', 'United Kingdom');
        set('f-contact', '+44 7700 900123');
        set('f-product', 'Football / Soccer Match Kit');
        set('f-qty', '120');
        set('f-sizes', 'Adult S-4XL');
        set('f-date', '2026-11-20');
        set('f-custom', 'Full sublimation, embroidered crest');
        set('f-message', 'Please quote including shipping to Manchester.');
        const c = w.document.getElementById('f-consent');
        if (c) c.checked = true;

        w.document.getElementById('enquiryForm')
          .dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

        const wa = opened.find((u) => /wa\.me/.test(u)) || '';
        const msg = decodeURIComponent((wa.split('?text=')[1] || ''));
        const status = w.document.getElementById('formStatus');
        const chip = status && status.querySelector('.ref-chip');

        const ref = (msg.match(/Order ref: (NTO-\d{6}-\d{4})/) || [])[1];
        return !!ref &&
               !!chip && chip.textContent === ref &&
               msg.indexOf('John Whitfield') > -1 &&
               msg.indexOf('Northside FC') > -1 &&
               msg.indexOf('United Kingdom') > -1 &&
               msg.indexOf('+44 7700 900123') > -1 &&
               msg.indexOf('Football / Soccer Match Kit') > -1 &&
               msg.indexOf('120') > -1 &&
               msg.indexOf('Adult S-4XL') > -1 &&
               msg.indexOf('2026-11-20') > -1 &&
               msg.indexOf('Full sublimation') > -1 &&
               msg.indexOf('shipping to Manchester') > -1;
      }
    }]
  },
  {
    file: 'quote.html', url: '/quote.html',
    expect: [['#quotePage', 1], ['#enquiryForm', 1], ['#quoteSummary .qsum__rows', 1]],
    checks: [{
      label: 'empty quote list shows the empty state and hides the form',
      fn: (w) => {
        const empty = w.document.querySelector('[data-basket-empty-show]');
        const hidden = w.document.querySelector('[data-basket-empty-hide]');
        return empty && empty.hidden === false && hidden && hidden.hidden === true;
      }
    }]
  },
  {
    file: 'quote.html', url: '/quote.html',
    pre: (w) => w.localStorage.setItem(BASKET_KEY, JSON.stringify([
      { id: 'football-kit', qty: 60 }, { id: 'boxing-shorts', qty: 30 }
    ])),
    expect: [['#quoteList .qrow', 2], ['#quoteList .qty__i', 2]],
    checks: [{
      label: 'quote list renders rows, totals, and fills the hidden enquiry fields',
      fn: (w) => {
        const units = w.document.querySelector('[data-basket-units]');
        const items = w.document.querySelector('#f-items');
        const product = w.document.querySelector('#f-product');
        const hidden = w.document.querySelector('[data-basket-empty-hide]');
        return units && units.textContent === '90' &&
               items && items.value.indexOf('NTO-1001') > -1 && items.value.indexOf('NTO-4001') > -1 &&
               product && product.value.indexOf('2 product lines') > -1 &&
               hidden && hidden.hidden === false;
      }
    }, {
      label: 'removing a row updates the list, totals and enquiry text',
      fn: (w) => {
        w.NitoBasket.remove('boxing-shorts');
        const rows = w.document.querySelectorAll('#quoteList .qrow').length;
        const units = w.document.querySelector('[data-basket-units]');
        const items = w.document.querySelector('#f-items');
        return rows === 1 && units.textContent === '60' && items.value.indexOf('NTO-4001') === -1;
      }
    }]
  },
  { file: '404.html', url: '/404.html', expect: [['.nav', 1]] }
];

let failures = 0;

function loadPage(page) {
  return new Promise((resolve) => {
    const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
    vc.on('error', (m) => errors.push('console.error: ' + m));

    const dom = new JSDOM(html, {
      url: 'https://nitosports.com' + page.url,
      runScripts: 'dangerously',
      resources: undefined,
      pretendToBeVisual: true,
      virtualConsole: vc
    });
    const { window } = dom;

    try {
      if (page.pre) page.pre(window);
      for (const s of SCRIPTS) window.eval(fs.readFileSync(path.join(ROOT, s), 'utf8'));
      window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    } catch (e) {
      errors.push('script threw: ' + e.message);
    }

    setTimeout(() => {
      const results = [];
      const fail = (sel, want, got) => { failures++; results.push({ sel, want, got, ok: false }); };

      for (const [sel, want] of page.expect) {
        const got = window.document.querySelectorAll(sel).length;
        const ok = want === null ? got > 0 : got === want;
        results.push({ sel, want, got, ok });
        if (!ok) failures++;
      }

      for (const c of (page.checks || [])) {
        let ok = false;
        try { ok = !!c.fn(window); } catch (e) { ok = false; errors.push('check threw (' + c.label + '): ' + e.message); }
        results.push({ sel: c.label, want: 'true', got: String(ok), ok });
        if (!ok) failures++;
      }

      if (window.document.querySelectorAll('#site-header .nav').length !== 1) fail('#site-header .nav', 1, 0);
      if (window.document.querySelectorAll('#site-footer .footer').length !== 1) fail('#site-footer .footer', 1, 0);

      resolve({ page, results, errors });
      dom.window.close();
    }, 80);
  });
}

(async () => {
  for (const p of PAGES) {
    const { page, results, errors } = await loadPage(p);
    const bad = results.filter((r) => !r.ok);
    console.log('\n' + (bad.length || errors.length ? '\u2717' : '\u2713') + '  ' + page.file + '  ' + page.url);
    bad.forEach((r) => console.log('     MISS  ' + r.sel + '  expected ' + r.want + ', got ' + r.got));
    errors.slice(0, 6).forEach((e) => console.log('     ERR   ' + e));
    if (!bad.length && !errors.length) console.log('     all ' + results.length + ' assertions passed');
  }
  console.log('\n' + (failures ? 'FAILURES: ' + failures : 'ALL PASSED'));
  process.exit(failures ? 1 : 0);
})();
