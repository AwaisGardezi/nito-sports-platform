/* Screenshot the key pages with system Chrome so the Shazam-light rebuild can
   be eyeballed. Writes into tests/shots/. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const OUT = path.join(__dirname, 'shots');

const SHOTS = [
  ['/', 'home-top', { w: 1440, h: 950, full: false }],
  ['/', 'home-full', { w: 1440, h: 950, full: true }],
  ['/products.html', 'products-top', { w: 1440, h: 1100, full: false }],
  ['/products.html?cat=teamwear&sub=Cricket', 'products-filtered', { w: 1440, h: 1100, full: false }],
  ['/product.html?id=football-kit', 'product-detail', { w: 1440, h: 1200, full: false }],
  ['/quote.html', 'quote-empty', { w: 1440, h: 900, full: false }],
  ['/customization.html', 'customization', { w: 1440, h: 1000, full: false }],
  ['/contact.html', 'contact', { w: 1440, h: 1100, full: false }],
  ['/about.html', 'about', { w: 1440, h: 1000, full: false }],
  ['/', 'home-mobile', { w: 390, h: 844, full: false }],
  ['/', 'home-mobile-hero', { w: 390, h: 844, clip: { x: 0, y: 60, width: 390, height: 300 } }],
  ['/products.html', 'products-mobile', { w: 390, h: 844, full: false }],
  ['/products.html', 'products-sidebar', { w: 1440, h: 1100, clip: { x: 100, y: 330, width: 460, height: 560 } }],
  ['/quote.html', 'quote-filled', {
    w: 1440, h: 1000, full: false,
    pre: (p) => p.evaluate(() => {
      localStorage.setItem('nito_quote_v1', JSON.stringify([
        { id: 'football-kit', qty: 60 }, { id: 'gym-shorts', qty: 120 }, { id: 'snapback-cap', qty: 250 }
      ]));
    })
  }]
];

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  const errs = [];
  for (const [url, name, opt] of SHOTS) {
    const p = await b.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.setViewport({ width: opt.w, height: opt.h, deviceScaleFactor: 1 });
    if (opt.pre) {
      await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await opt.pre(p);
      await p.reload({ waitUntil: 'networkidle2' });
    } else {
      await p.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 60000 });
    }
    await new Promise((r) => setTimeout(r, 1800));
    const shotOpt = { path: path.join(OUT, name + '.png'), fullPage: !!opt.full };
    if (opt.clip) shotOpt.clip = opt.clip;
    await p.screenshot(shotOpt);
    console.log('shot', name, '<-', url);
    await p.close();
  }

  await b.close();
  console.log('\nCONSOLE/PAGE ERRORS:', errs.length ? '' : 'none');
  errs.slice(0, 20).forEach((e) => console.log('  ' + e));
})();
