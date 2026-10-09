/* Throwaway: capture the payments section after swapping the text badges for
   the providers' own logos. Scrolls first so [data-reveal]/lazy images fire. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099/index.html';
const OUT = require('path').resolve(__dirname, 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'payshot-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  for (const [label, w, h] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const p = await b.newPage();
    const failed = [];
    p.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.goto(URL, { waitUntil: 'networkidle0' });

    await p.evaluate(() => {
      const s = document.getElementById('payments');
      if (s) s.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    await new Promise((r) => setTimeout(r, 900));

    const info = await p.evaluate(() => {
      const grid = document.getElementById('paymentGrid');
      const cards = Array.from(grid.querySelectorAll('.pay'));
      return {
        cards: cards.length,
        marks: cards.map((c) => {
          const img = c.querySelector('.pay__logo img');
          const box = c.querySelector('.pay__logo');
          const r = img ? img.getBoundingClientRect() : null;
          return {
            text: box.textContent.trim(),
            src: img ? img.getAttribute('src').split('/').pop() : '(no logo - text)',
            alt: img ? img.getAttribute('alt') : '',
            shown: r ? Math.round(r.width) + 'x' + Math.round(r.height) : '',
            loaded: img ? (img.complete && img.naturalWidth > 0) : 'n/a'
          };
        }),
        gridW: Math.round(grid.getBoundingClientRect().width),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    console.log('\n=== ' + label + ' (' + w + 'px) ===');
    console.log('cards:', info.cards, '| grid width:', info.gridW, '| h-overflow:', info.overflow);
    info.marks.forEach((m) => console.log('  ' + m.src.padEnd(22) + ' alt="' + m.alt + '" shown=' + m.shown + ' loaded=' + m.loaded + (m.text ? ' text="' + m.text + '"' : '')));
    if (failed.length) console.log('  !! FAILED REQUESTS: ' + failed.join(', '));

    const el = await p.$('#payments');
    await el.screenshot({ path: path.join(OUT, 'payments-' + label + '.png') });
    await p.close();
  }

  await b.close();
  console.log('\nwrote payments-desktop.png / payments-mobile.png');
})();
