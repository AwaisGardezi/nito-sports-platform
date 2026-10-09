/* Regression guard for the overflow-x:clip change: vertical scrolling must
   still work, sticky elements must still stick, and the reveal animations must
   still fire when an element scrolls into view. */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS  ' + m); } else { fail++; console.log('  FAIL  ' + m); } };

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  /* ---------- 1. vertical scrolling still works ---------- */
  console.log('\nVERTICAL SCROLL');
  let p = await b.newPage();
  await p.setCacheEnabled(false);
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 600));
  /* html has scroll-behavior:smooth, so scrollY updates asynchronously —
     scroll, let it settle, then read. */
  const v = await p.evaluate(async () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, 600);
    await new Promise((r) => setTimeout(r, 900));
    return { max, y: window.scrollY, x: window.scrollX };
  });
  ok(v.max > 1000, 'page is taller than the viewport  [scrollable=' + v.max + 'px]');
  ok(v.y > 400, 'window.scrollTo scrolls vertically  [scrollY=' + v.y + ']');
  ok(v.x === 0, 'no horizontal scroll leaked  [scrollX=' + v.x + ']');

  /* ---------- 2. sticky nav ---------- */
  console.log('\nSTICKY NAV');
  const hdr = await p.evaluate(() => {
    const n = document.querySelector('#site-header .nav');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { top: Math.round(r.top), pos: getComputedStyle(n).position, y: window.scrollY };
  });
  ok(hdr && hdr.pos === 'sticky', 'main nav is position:sticky  [' + (hdr && hdr.pos) + ']');
  ok(hdr && hdr.y > 400 && Math.abs(hdr.top) <= 1,
     'nav is pinned to the top of the viewport while scrolled  [scrollY=' + (hdr && hdr.y) + ' navTop=' + (hdr && hdr.top) + ']');
  await p.close();

  /* ---------- 3. sticky sidebar on the catalogue ---------- */
  console.log('\nSTICKY SIDEBAR (products.html)');
  p = await b.newPage();
  await p.setCacheEnabled(false);
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(BASE + '/products.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 900));
  const side = await p.evaluate(async () => {
    const s = document.querySelector('#catalogSide');
    if (!s) return null;
    const pos = getComputedStyle(s).position;
    const before = Math.round(s.getBoundingClientRect().top);
    window.scrollTo(0, 1400);
    await new Promise((r) => setTimeout(r, 500));
    const after = Math.round(s.getBoundingClientRect().top);
    return { pos, before, after };
  });
  ok(side && side.pos === 'sticky', 'catalogue sidebar is position:sticky  [' + (side && side.pos) + ']');
  ok(side && Math.abs(side.after) < Math.abs(side.before) + 400 && side.after < side.before + 100,
     'sidebar sticks instead of scrolling away  [before=' + (side && side.before) + ' after=' + (side && side.after) + ']');
  ok(side && side.after < 400, 'sidebar is still on screen after scrolling 1400px  [top=' + (side && side.after) + ']');
  await p.close();

  /* ---------- 4. reveal animations still fire ---------- */
  console.log('\nREVEAL ANIMATIONS');
  p = await b.newPage();
  await p.setCacheEnabled(false);
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  const rev = await p.evaluate(async () => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    const total = els.length;
    const hiddenAtLoad = els.filter((e) => !e.classList.contains('is-in')).length;
    const firstHidden = els.find((e) => !e.classList.contains('is-in'));
    if (firstHidden) firstHidden.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 1400));
    const nowIn = firstHidden ? firstHidden.classList.contains('is-in') : null;
    const op = firstHidden ? getComputedStyle(firstHidden).opacity : null;
    return { total, hiddenAtLoad, nowIn, op };
  });
  ok(rev.total > 10, 'page has reveal targets  [' + rev.total + ']');
  ok(rev.hiddenAtLoad > 0, 'below-the-fold targets start hidden  [' + rev.hiddenAtLoad + ']');
  ok(rev.nowIn === true, 'a scrolled-to target gets .is-in');
  ok(rev.op === '1', 'revealed target ends fully opaque  [opacity=' + rev.op + ']');
  await p.close();

  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
