/* Capture login.html in both of its states:
     1. a console with no account  → the one-time setup
     2. once an account exists     → sign-in only, no create-account anywhere
   Writes to tests/shots/. Throwaway helper, not part of the suite. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099';
const OUT = require('path').resolve(__dirname, 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });

  /* 1 — fresh: the one-time setup */
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'setup';
  }, { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: path.join(OUT, 'staff-login-setup.png') });
  console.log('wrote staff-login-setup.png');

  /* create the single account, then sign out and return */
  await p.evaluate(() => window.NitoPlatform.signUp('owner@nitosports.com', 'nito-staff-login-2026', 'Awais Haider'));
  await p.evaluate(() => window.NitoPlatform.signOut());
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'signin';
  }, { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: path.join(OUT, 'staff-login-signin.png') });
  console.log('wrote staff-login-signin.png');

  await b.close();
})();
