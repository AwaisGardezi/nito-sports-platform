/* Proof shots for the one-click launcher: the real backend serving the real
   site and the real console. Uses a throwaway --data file and its own port so
   it never touches the owner's data. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const PORT = 8853;
const BASE = 'http://127.0.0.1:' + PORT;
const DB = path.join(os.tmpdir(), 'nito-shot-' + Date.now() + '.json');
const OUT = path.join(ROOT, 'tests/shots/launcher');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [
    path.join(ROOT, 'tools/server.js'), '--no-open', '--port', String(PORT), '--data', DB
  ], { cwd: ROOT, stdio: 'ignore' });

  let browser;
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) {}
      await sleep(250);
    }
    browser = await puppeteer.launch({
      executablePath: CHROME, headless: 'new',
      userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'nito-shot-')),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
    });

    /* 1. the homepage, served by the backend */
    const home = await browser.newPage();
    await home.setViewport({ width: 1440, height: 1000 });
    await home.goto(BASE + '/index.html', { waitUntil: 'networkidle0' });
    /* reveal animations start at opacity:0 — scroll the whole page first */
    await home.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await sleep(900);
    const live = await home.evaluate(() => ({
      mode: window.NitoPlatform && window.NitoPlatform.mode().mode,
      shared: window.NitoPlatform && window.NitoPlatform.mode().shared,
      armed: window.NITO_LIVE && window.NITO_LIVE.armed,
      reason: window.NITO_LIVE && window.NITO_LIVE.reason,
      count: window.NITO_LIVE && window.NITO_LIVE.count
    }));
    console.log('public page:', JSON.stringify(live));
    await home.screenshot({ path: path.join(OUT, '1-site.png') });

    /* 2. the console, first run — the one-time setup the owner will see */
    const con = await browser.newPage();
    await con.setViewport({ width: 1440, height: 1000 });
    await con.goto(BASE + '/login.html', { waitUntil: 'networkidle0' });
    await sleep(1200);
    const mode = await con.evaluate(() =>
      document.getElementById('authForm').getAttribute('data-mode'));
    console.log('console login data-mode:', mode, '(expected "setup" on a fresh backend)');
    await con.screenshot({ path: path.join(OUT, '2-console-first-run.png') });

    console.log('shots written to tests/shots/launcher/');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
    try { fs.unlinkSync(DB); } catch (e) {}
  }
  process.exit(0);
})();
