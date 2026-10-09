/* Verify the real logo renders everywhere it should, that no invented mark
   survives, that the favicons are served, and that nothing 404s.
   Writes crops into tests/shots/logo/. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const OUT = path.join(ROOT, 'tests', 'shots', 'logo');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ', m); } else { fail++; console.log('  FAIL ', m); } };

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  const misses = [];

  async function visit(url, w, h) {
    const p = await b.newPage();
    p.on('response', (r) => {
      if (r.status() >= 400) misses.push(r.status() + ' ' + r.url());
    });
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await p.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 900));
    return p;
  }

  /* ElementHandle.screenshot() handles scrolling correctly, unlike a manual
     clip taken from a viewport-relative boundingBox. Pad by wrapping the shot
     in a temporary outline-free margin via the element's own scrollIntoView. */
  async function crop(p, sel, name) {
    const el = await p.$(sel);
    if (!el) { console.log('  .. no element for ' + sel + ' (' + name + ')'); return false; }
    await p.evaluate((s) => {
      const n = document.querySelector(s);
      if (n && n.scrollIntoView) n.scrollIntoView({ block: 'center' });
    }, sel);
    await new Promise((r) => setTimeout(r, 350));
    await el.screenshot({ path: path.join(OUT, name + '.png') });
    return true;
  }

  /* ---------- header (desktop) ---------- */
  console.log('\nHEADER — desktop');
  let p = await visit('/', 1440, 950);
  const hdr = await p.evaluate(() => {
    const img = document.querySelector('#site-header .brand__logo');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return {
      src: img.getAttribute('src'),
      natW: img.naturalWidth, natH: img.naturalHeight,
      w: Math.round(r.width), h: Math.round(r.height),
      complete: img.complete,
      legacyMark: !!document.querySelector('.brand__mark, .brand__name, .brand__sub')
    };
  });
  ok(!!hdr, 'header brand renders an <img> logo');
  ok(hdr && /nito-lockup\.png$/.test(hdr.src), 'header uses the dark lockup  [' + (hdr && hdr.src) + ']');
  ok(hdr && hdr.natW > 0 && hdr.complete, 'header logo image actually loaded  [' + (hdr && hdr.natW) + 'x' + (hdr && hdr.natH) + ']');
  ok(hdr && hdr.h === 36, 'header logo is 36px tall  [' + (hdr && hdr.h) + ']');
  ok(hdr && !hdr.legacyMark, 'no invented SVG mark left in the header');
  await crop(p, '#site-header .brand', 'header-logo');
  await p.close();

  /* ---------- footer ---------- */
  console.log('\nFOOTER');
  p = await visit('/', 1440, 950);
  const ftr = await p.evaluate(() => {
    const img = document.querySelector('.footer .brand__logo');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { src: img.getAttribute('src'), h: Math.round(r.height), natW: img.naturalWidth };
  });
  ok(ftr && /nito-lockup-light\.png$/.test(ftr.src), 'footer uses the reversed (light) lockup  [' + (ftr && ftr.src) + ']');
  ok(ftr && ftr.h === 46, 'footer logo is 46px tall  [' + (ftr && ftr.h) + ']');
  ok(ftr && ftr.natW > 0, 'footer logo loaded');
  await crop(p, '.footer .brand', 'footer-logo');
  await p.close();

  /* ---------- drawer (mobile) ---------- */
  console.log('\nDRAWER — mobile');
  p = await visit('/', 390, 844);
  await p.click('#site-header .burger, #site-header .hamburger, [aria-controls="siteDrawer"], .burger').catch(() => {});
  await new Promise((r) => setTimeout(r, 700));
  const dr = await p.evaluate(() => {
    const img = document.querySelector('.drawer__top .brand__logo') || document.querySelector('.drawer .brand__logo');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { src: img.getAttribute('src'), h: Math.round(r.height), natW: img.naturalWidth };
  });
  ok(dr && /nito-lockup\.png$/.test(dr.src), 'drawer uses the dark lockup  [' + (dr && dr.src) + ']');
  ok(dr && dr.h === 34, 'drawer logo is 34px tall  [' + (dr && dr.h) + ']');
  if (dr) await crop(p, '.drawer__top', 'drawer-logo');
  await p.close();

  /* ---------- staff gate (login) + console shell ------------------------------
     These two checks used to point at `admin.html` and query `.adm-gate__brand`.
     That markup belonged to the OLD single-file admin panel; admin.html is now
     the console shell and the sign-in screen moved to login.html. The lockup
     requirement itself is unchanged and still worth proving, so the assertions
     were retargeted rather than dropped. */
  console.log('\nSTAFF — login + console');
  p = await visit('/login.html', 1440, 950);
  const gate = await p.evaluate(() => {
    const img = document.querySelector('.auth__aside .auth__logo, .auth__logo');
    if (!img) return null;
    return {
      src: img.getAttribute('src'),
      natW: img.naturalWidth,
      /* An <h1> here would be a drawn wordmark competing with the real lockup. */
      h1InLogo: !!document.querySelector('.auth__logo h1, .auth__aside h1')
    };
  });
  ok(gate && /nito-lockup-light\.png$/.test(gate.src), 'login gate uses the reversed lockup  [' + (gate && gate.src) + ']');
  ok(gate && gate.natW > 0, 'login gate logo actually loaded  [' + (gate && gate.natW) + ']');
  ok(gate && !gate.h1InLogo, 'no invented <h1> wordmark beside the login lockup');
  if (gate) await crop(p, '.auth__aside', 'login-gate');
  await p.close();

  /* The console keeps its heading, but only the screen-reader one. There must be
     no VISIBLE drawn wordmark standing in for the logo. */
  p = await visit('/admin.html', 1440, 950);
  const shell = await p.evaluate(() => {
    const h1 = document.querySelector('h1');
    return {
      h1: !!h1,
      h1Hidden: !!(h1 && h1.classList.contains('sr-only')),
      lockup: !!document.querySelector('.auth__logo, .brand__logo, img[src*="nito-lockup"]')
    };
  });
  ok(shell.h1Hidden, 'console heading is screen-reader only  [' + shell.h1Hidden + ']');
  await p.close();

  /* ---------- favicons + asset 404 sweep ---------- */
  console.log('\nFAVICONS / 404 SWEEP');
  const pages = ['/', '/products.html', '/product.html?id=football-kit', '/quote.html',
                 '/about.html', '/customization.html', '/contact.html', '/admin.html', '/404.html'];
  for (const u of pages) {
    const q = await visit(u, 1280, 900);
    const links = await q.evaluate(() => Array.from(document.querySelectorAll('link[rel*="icon"]'))
      .map((l) => l.getAttribute('href')));
    if (u === '/') {
      ok(links.some((h) => /favicon-32\.png/.test(h)), 'favicon-32.png linked');
      ok(links.some((h) => /favicon-192\.png/.test(h)), 'favicon-192.png linked');
      ok(links.some((h) => /apple-touch-icon\.png/.test(h)), 'apple-touch-icon.png linked');
      ok(!links.some((h) => /favicon\.svg/.test(h)), 'old SVG favicon link gone');
    }
    await q.close();
  }

  await b.close();

  console.log('\nMISSING RESOURCES (>=400):', misses.length ? '' : 'none');
  [...new Set(misses)].slice(0, 20).forEach((m) => console.log('  ' + m));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail || misses.length ? 1 : 0);
})();
