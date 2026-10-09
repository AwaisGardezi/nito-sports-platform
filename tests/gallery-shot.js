/* Capture the "From our floor" section on the homepage after removing the
   placeholder, to confirm the single photo fills the strip and the crop shows
   the bagged orders rather than the banner wall. Throwaway helper. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099';
const OUT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'galshot-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  for (const [label, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h });
    await p.goto(URL + '/index.html', { waitUntil: 'networkidle2' });

    /* reveals start at opacity:0 — scroll the section into view and let it fire */
    await p.evaluate(() => {
      const g = document.querySelector('.gallery-strip');
      g.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await new Promise((r) => setTimeout(r, 900));

    const box = await p.evaluate(() => {
      const g = document.querySelector('.gallery-strip');
      const sec = g.closest('section');
      const r = sec.getBoundingClientRect();
      const gr = g.getBoundingClientRect();
      const img = g.querySelector('img');
      return {
        secH: Math.round(r.height),
        stripW: Math.round(gr.width),
        stripH: Math.round(gr.height),
        frames: g.querySelectorAll('.media-frame').length,
        imgH: img ? Math.round(img.getBoundingClientRect().height) : 0,
        todoLeft: document.querySelectorAll('.media-frame--todo').length
      };
    });
    console.log(label, JSON.stringify(box));

    const el = await p.$('.gallery-strip');
    await el.screenshot({ path: path.join(OUT, 'home-gallery-' + label + '.png') });
    console.log('  wrote home-gallery-' + label + '.png');
    await p.close();
  }

  await b.close();
})();
