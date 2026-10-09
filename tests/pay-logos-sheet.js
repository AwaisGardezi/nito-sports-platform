/* Throwaway: render every downloaded payment logo on a white chip AND on the
   dark chip, so we can see which variant we actually got (white-on-white is
   invisible, and a "black" variant is a different asset from the brand one). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const OUT = path.join(ROOT, 'tests/shots');

const FILES = [
  'assets/img/pay/western-union.svg',
  'assets/img/pay/moneygram.svg',
  'assets/img/pay/ria.png',
  'assets/img/pay/payoneer.svg',
  'assets/img/pay/remitly.svg'
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cells = FILES.map((f) => {
    const url = 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
    const name = path.basename(f);
    return '<div class="cell">' +
      '<div class="lab">' + name + '</div>' +
      '<div class="chip light"><img src="' + url + '"></div>' +
      '<div class="chip dark"><img src="' + url + '"></div>' +
      '</div>';
  }).join('');

  const html = '<!doctype html><meta charset="utf-8"><style>' +
    'body{margin:0;padding:24px;background:#f4f4f4;font:12px/1.4 system-ui;display:flex;gap:16px;flex-wrap:wrap}' +
    '.cell{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px;width:220px}' +
    '.lab{font-weight:700;margin-bottom:8px;color:#111;font-size:11px}' +
    '.chip{height:64px;display:grid;place-items:center;border-radius:6px;margin-bottom:8px;padding:8px}' +
    '.chip.light{background:#fff;border:1px solid #e5e5e5}' +
    '.chip.dark{background:#0e0d0d}' +
    '.chip img{max-width:100%;max-height:44px;object-fit:contain}' +
    '</style>' + cells;

  const sheet = path.join(os.tmpdir(), 'pay-sheet.html');
  fs.writeFileSync(sheet, html);

  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'paysheet-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 780, height: 400, deviceScaleFactor: 2 });
  await p.goto('file:///' + sheet.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: path.join(OUT, 'pay-logos-contact-sheet.png'), fullPage: true });
  await b.close();
  console.log('wrote', path.join(OUT, 'pay-logos-contact-sheet.png'));
})();
