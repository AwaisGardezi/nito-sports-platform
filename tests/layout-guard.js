/* Layout guard: no page may scroll horizontally at any breakpoint, and no
   element may stick out past the right edge of the viewport.

   This is the test that would have caught the admin toolbar running off the
   right of a phone screen, so it stays in the suite.

   Usage: node tests/layout-guard.js   (server must be on :8099) */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';

const PAGES = [
  '/', '/products.html', '/product.html?id=football-kit', '/quote.html',
  '/about.html', '/customization.html', '/contact.html', '/admin.html', '/404.html'
];
const WIDTHS = [360, 390, 768, 1024, 1280, 1440];

/* Elements that are legitimately wider than the viewport (they scroll inside
   their own container) are ignored by tag/class. */
const IGNORE = ['HTML', 'BODY'];

let pass = 0, fail = 0;
const problems = [];

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  for (const url of PAGES) {
    const p = await b.newPage();
    await p.setCacheEnabled(false);
    for (const w of WIDTHS) {
      await p.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
      await p.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 450));

      const res = await p.evaluate((ignore) => {
        const de = document.documentElement;
        const vw = window.innerWidth;
        const docOverflow = de.scrollWidth - vw;
        const bad = [];
        if (docOverflow > 1) {
          document.querySelectorAll('*').forEach((n) => {
            if (ignore.indexOf(n.tagName) !== -1) return;
            const r = n.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.right > vw + 1.5 || r.left < -1.5) {
              const cs = getComputedStyle(n);
              /* skip nodes that scroll or clip their own overflow — they are
                 allowed to contain something wider than themselves */
              let anc = n.parentElement, clipped = false;
              while (anc && anc !== document.body) {
                const o = getComputedStyle(anc).overflowX;
                if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; }
                anc = anc.parentElement;
              }
              if (clipped) return;
              bad.push({
                tag: n.tagName.toLowerCase(),
                cls: (n.className && n.className.toString ? n.className.toString() : '').slice(0, 60),
                left: Math.round(r.left), right: Math.round(r.right),
                w: Math.round(r.width),
                txt: (n.textContent || '').trim().slice(0, 40)
              });
            }
          });
        }
        return { vw, docOverflow, bad: bad.slice(0, 6) };
      }, IGNORE);

      if (res.docOverflow <= 1) {
        pass++;
      } else {
        fail++;
        const line = url + ' @ ' + w + 'px  → document is ' + res.docOverflow + 'px too wide';
        problems.push(line);
        res.bad.forEach((x) => {
          problems.push('     ' + x.tag + '.' + x.cls + '  [' + x.left + '…' + x.right + ']  "' + x.txt + '"');
        });
      }
    }
    await p.close();
  }

  await b.close();

  console.log('LAYOUT GUARD — ' + PAGES.length + ' pages x ' + WIDTHS.length + ' widths = ' +
              (PAGES.length * WIDTHS.length) + ' checks');
  if (problems.length) {
    console.log('\nHORIZONTAL OVERFLOW:');
    problems.forEach((l) => console.log('  ' + l));
  }
  console.log('\n' + pass + ' clean, ' + fail + ' overflowing');
  process.exit(fail ? 1 : 0);
})();
