/* ==========================================================================
   console-ui — the console's screens are visually sound at every width

   WHY THIS EXISTS
   The team page's "What each role can do" matrix rendered four metre-tall tick
   marks because the icon SVG had no width/height and no scoped size rule, so it
   stretched to fill its table cell. Every functional suite passed: the DOM was
   correct, the icons were present, the page did not error. It simply looked
   BROKEN — and looking broken is exactly what the owner reported as "the
   frontend is not cool".

   Functional tests cannot catch that class of defect, so this suite asserts on
   geometry:
     1. No icon is ever absurdly large (the failure above).
     2. No console screen scrolls sideways at any width.
     3. Every route renders a non-empty main column (not a blank panel).
     4. The two-column shell stays two columns on desktop and stacks on mobile.
     5. Sparse pages are centred, dense pages are not (the density rule).
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099';
const EMAIL = 'owner@nitosports.com';
const PASS = 'nito-ui-check-2026';

const ROUTES = ['dashboard', 'products', 'categories', 'enquiries',
  'customers', 'team', 'audit', 'settings'];

/* A route's content cap, mirroring ROUTES[].max in admin-shell.js. Kept as a
   literal here so a silent change to the shell is caught rather than followed. */
const CAPPED = { categories: 1100, enquiries: 1100, customers: 1100, audit: 1180, settings: 1180 };

let results = [];
let failures = 0;
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail });
  if (!ok) failures++;
}

async function signIn(p) {
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 600));
  /* A fresh browser has no account, so the page offers one-time setup and the
     name/confirm fields are already on screen. There is no sign-up tab. */
  const fresh = await p.evaluate(() => {
    const w = document.querySelector('#fPass2Wrap');
    return !!w && !w.hasAttribute('hidden');
  });
  if (fresh) {
    await p.evaluate((em, pw) => {
      const set = (id, v) => {
        const e = document.getElementById(id);
        if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      set('aName', 'Awais Haider'); set('aEmail', em); set('aPass', pw); set('aPass2', pw);
      document.querySelector('#authSubmit').click();
    }, EMAIL, PASS);
  } else {
    /* already has an account — sign in instead */
    await p.evaluate((em, pw) => {
      const set = (id, v) => {
        const e = document.getElementById(id);
        if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      set('aEmail', em); set('aPass', pw);
      const f = document.querySelector('#authForm');
      if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, EMAIL, PASS);
  }
  await p.waitForFunction(() => !!document.querySelector('#shell') &&
    document.querySelector('#shell').hidden === false, { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
}

(async () => {
  const udd = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cui-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const errors = [];
  const p = await b.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));

  /* ---- 1-3. desktop sweep across every route ---------------------------- */
  await p.setViewport({ width: 1600, height: 1000 });
  await signIn(p);

  check('the console opened after signing in',
    await p.evaluate(() => !!document.querySelector('#shell') &&
      document.querySelector('#shell').hidden === false));

  for (const r of ROUTES) {
    await p.evaluate((rt) => { location.hash = '#/' + rt; }, r);
    await new Promise((x) => setTimeout(x, 800));

    const m = await p.evaluate(() => {
      const icons = [].slice.call(document.querySelectorAll('svg'));
      /* `.empty svg` and the flat-library art are legitimately larger. */
      const oversized = icons.filter((s) => {
        if (s.closest('.empty')) return false;
        const b2 = s.getBoundingClientRect();
        return b2.width > 70 || b2.height > 70;
      });
      const view = document.querySelector('#view');
      /* The density cap is applied to the CONTENT children, not to #view itself
         (the store-mode banner must stay full width). So measure the widest
         capped child and its centring, not #view. */
      const capped = [].slice.call(view.children).filter((c) => !c.classList.contains('mode'));
      const maxChildW = capped.length
        ? Math.max.apply(null, capped.map((c) => Math.round(c.getBoundingClientRect().width))) : 0;
      const firstCapped = capped[0] || null;
      return {
        oversized: oversized.length,
        oversizedW: oversized.slice(0, 3).map((s) => Math.round(s.getBoundingClientRect().width)),
        viewW: view ? Math.round(view.getBoundingClientRect().width) : 0,
        contentW: maxChildW,
        contentX: firstCapped ? Math.round(firstCapped.getBoundingClientRect().x) : 0,
        capVar: view ? view.style.getPropertyValue('--content-max').trim() : '',
        contentChars: view ? view.textContent.replace(/\s+/g, ' ').trim().length : 0,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });

    check(r + ': no oversized icons', m.oversized === 0,
      'oversized: ' + m.oversized + ' widths=' + JSON.stringify(m.oversizedW));
    check(r + ': no horizontal overflow', !m.overflowX);
    check(r + ': main column rendered content', m.contentChars > 40,
      'chars: ' + m.contentChars);

    /* ---- 5. density rule: sparse pages capped+centred, dense pages full -- */
    const cap = CAPPED[r];
    if (cap) {
      check(r + ': content capped to ' + cap + 'px and centred',
        m.contentW <= cap + 2 && m.contentX > 260 && m.capVar === cap + 'px',
        'contentW=' + m.contentW + ' x=' + m.contentX + ' var=' + m.capVar);
    } else {
      check(r + ': uses the full panel width (not capped)',
        m.contentW > 1200 && m.capVar === '',
        'contentW=' + m.contentW + ' var=' + m.capVar);
    }

    /* every console screen must survive the widest desktop without sideways
       scroll — the product-row and grid bugs both showed up here first */
    if (r === 'products') {
      const row = await p.evaluate(() => {
        const t = document.querySelector('.tbl__name-t');
        const s = document.querySelector('.tbl__name-s');
        if (!t || !s) return null;
        const rt = t.getBoundingClientRect(), rs = s.getBoundingClientRect();
        return { overlap: rs.top < rt.bottom - 1,
                 tDisplay: getComputedStyle(t).display,
                 sDisplay: getComputedStyle(s).display };
      });
      check('products: name and description do NOT collide on one line',
        row && row.overlap === false && row.tDisplay === 'block' && row.sDisplay === 'block',
        JSON.stringify(row));
    }
  }

  /* ---- 4. shell columns at each width ----------------------------------- */
  for (const [w, stacked] of [[1600, false], [1366, false], [1024, false], [820, true], [390, true]]) {
    await p.setViewport({ width: w, height: 900 });
    await p.goto(URL + '/admin.html', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 700));
    const m = await p.evaluate(() => {
      const side = document.querySelector('.side');
      const view = document.querySelector('#view');
      const sb = side ? side.getBoundingClientRect() : null;
      const vb = view ? view.getBoundingClientRect() : null;
      return {
        sideW: sb ? Math.round(sb.width) : 0,
        viewX: vb ? Math.round(vb.x) : 0,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    if (stacked) {
      check('@' + w + 'px the sidebar collapses and the page takes the width',
        m.viewX === 0, 'viewX=' + m.viewX);
    } else {
      check('@' + w + 'px the page sits beside a 250px sidebar',
        m.viewX >= 240 && m.sideW >= 240, 'sideW=' + m.sideW + ' viewX=' + m.viewX);
    }
    check('@' + w + 'px no horizontal overflow', !m.overflowX);
  }

  await b.close();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}

  console.log('');
  for (const r of results) {
    console.log((r.ok ? '  \u2713 ' : '  \u2717 ') + r.label + (r.ok ? '' : '   — ' + r.detail));
  }
  const realErrors = errors.filter((e) => !/navigation to another Document/.test(e));
  check('no page errors across the whole sweep', realErrors.length === 0,
    realErrors.slice(0, 3).join(' | '));
  console.log((realErrors.length ? '  \u2717 ' : '  \u2713 ') + 'no page errors across the whole sweep');
  console.log('\n' + (failures ? 'FAILURES: ' + failures : 'ALL ' + results.length + ' CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
