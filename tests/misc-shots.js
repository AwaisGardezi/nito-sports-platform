const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  for (const [url, name, h] of [['/admin.html', 'admin', 1000], ['/404.html', 'notfound', 800], ['/about.html', 'about-full', 1200]]) {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.setViewport({ width: 1440, height: h });
    await p.goto('http://127.0.0.1:8099' + url, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1600));
    await p.screenshot({ path: OUT + '/' + name + '.png' });
    console.log(name, 'errs:', errs.length ? errs.join(' | ') : 'none');
    await p.close();
  }
  await b.close();
})();
