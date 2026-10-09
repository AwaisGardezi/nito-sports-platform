/* Look at the hero band at three widths to judge the crop of a portrait source
   in a 21:8 landscape slot. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const OUT = path.join('C:/Users/PcR/OneDrive/Desktop/Sports Platform', 'tests', 'shots', 'hero');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  for (const w of [1440, 1024, 390]) {
    const p = await b.newPage();
    await p.setCacheEnabled(false);
    await p.setViewport({ width: w, height: 900 });
    await p.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    const info = await p.evaluate(() => {
      const s = document.querySelector('.slider');
      const im = document.querySelector('.slider__slide.is-active img');
      const r = s.getBoundingClientRect();
      return {
        slider: Math.round(r.width) + 'x' + Math.round(r.height),
        natural: im.naturalWidth + 'x' + im.naturalHeight,
        rendered: Math.round(im.getBoundingClientRect().width) + 'x' + Math.round(im.getBoundingClientRect().height)
      };
    });
    const el = await p.$('.slider');
    await el.screenshot({ path: path.join(OUT, 'hero-' + w + '.png') });
    console.log(w + 'px  slider=' + info.slider + '  source=' + info.natural + '  rendered=' + info.rendered);
    await p.close();
  }
  await b.close();
})();
