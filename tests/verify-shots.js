/* Confirm the sticky nav and the fixed mobile admin toolbar visually. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const OUT = path.join('C:/Users/PcR/OneDrive/Desktop/Sports Platform', 'tests', 'shots', 'verify');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  const shot = async (url, name, w, h, scrollTo, prep) => {
    const p = await b.newPage();
    await p.setCacheEnabled(false);
    await p.setViewport({ width: w, height: h });
    await p.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 900));
    if (prep) await prep(p);
    if (scrollTo) {
      await p.evaluate(async (y) => {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 900));
      }, scrollTo);
    }
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('shot', name, '<-', url + (scrollTo ? ' @scroll ' + scrollTo : ''));
    await p.close();
  };

  await shot('/', 'sticky-nav-desktop', 1280, 800, 1400);
  await shot('/', 'sticky-nav-mobile', 390, 844, 1600);
  await shot('/products.html', 'products-sticky', 1440, 900, 1500);
  await shot('/products.html', 'products-mobile-top', 390, 844, 0);
  await shot('/contact.html', 'contact-mobile', 360, 844, 0);
  await shot('/contact.html', 'contact-desktop', 1280, 900, 0);

  /* admin on a phone */
  await shot('/admin.html', 'admin-mobile-toolbar', 390, 844, 0, async (p) => {
    const pw = await p.$$('.adm-gate input[type="password"]');
    for (const f of pw) await f.type('nito-admin-2026');
    await p.click('.adm-gate button[type="submit"], .adm-gate .btn--primary');
    await new Promise((r) => setTimeout(r, 1200));
  });
  await shot('/admin.html', 'admin-desktop', 1440, 950, 0, async (p) => {
    const pw = await p.$$('.adm-gate input[type="password"]');
    for (const f of pw) await f.type('nito-admin-2026');
    await p.click('.adm-gate button[type="submit"], .adm-gate .btn--primary');
    await new Promise((r) => setTimeout(r, 1200));
  });

  await b.close();
})();
