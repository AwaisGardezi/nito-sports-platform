const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const OUT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  const handles = await p.$$('main > section');
  for (let i = 0; i < handles.length; i++) {
    const h = handles[i];
    const meta = await h.evaluate((el) => ({
      cls: (el.className || '').toString().split(' ')[0],
      hh: Math.round(el.getBoundingClientRect().height)
    }));
    await h.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 1300));
    const f = 'sec-' + String(i).padStart(2, '0') + '-' + (meta.cls || 'sec') + '.png';
    await h.screenshot({ path: path.join(OUT, f) });
    console.log('sec', i, meta.cls, 'h=' + meta.hh, '->', f);
  }

  const fh = await p.$('#site-footer .footer');
  if (fh) {
    await fh.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 900));
    await fh.screenshot({ path: path.join(OUT, 'sec-footer-live.png') });
    console.log('footer captured');
  }

  await b.close();
})();
