/* Screenshot the admin gate and the full panel so the dark palette can be
   eyeballed. Writes into tests/shots/admin/. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';
const OUT = path.join('C:/Users/PcR/OneDrive/Desktop/Sports Platform', 'tests', 'shots', 'admin');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  const errs = [];
  const p = await b.newPage();
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  /* ---- gate (first visit: asks to create a password) ---- */
  await p.goto(BASE + '/admin.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  await p.screenshot({ path: path.join(OUT, 'gate.png') });

  /* ---- create the password ---- */
  const pw = await p.$$('.adm-gate input[type="password"]');
  for (const f of pw) await f.type('nito-admin-2026');
  await p.click('.adm-gate button[type="submit"], .adm-gate .btn--primary');
  await new Promise((r) => setTimeout(r, 1200));
  await p.screenshot({ path: path.join(OUT, 'panel-top.png') });

  /* ---- read computed colours to prove the fix ---- */
  const probe = await p.evaluate(() => {
    const cs = (sel, prop) => {
      const n = document.querySelector(sel);
      return n ? getComputedStyle(n)[prop] : '(missing)';
    };
    return {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      panelBg: cs('.adm', 'backgroundColor'),
      rowBg: cs('.adm-row', 'backgroundColor'),
      rowName: cs('.adm-row__name', 'color'),
      statN: cs('.adm-stat__n', 'color'),
      editorBg: cs('.adm-editor', 'backgroundColor'),
      inputBg: cs('.adm-editor .input', 'backgroundColor'),
      inputColor: cs('.adm-editor .input', 'color'),
      ghostColor: cs('#admReset', 'color'),
      tagColor: cs('.adm-top__tag', 'color'),
      tagBg: cs('.adm-top__tag', 'backgroundColor'),
      helpCode: cs('.adm-help code', 'color'),
      selBg: cs('.adm-bar select', 'backgroundColor')
    };
  });
  console.log('COMPUTED COLOURS:');
  for (const k of Object.keys(probe)) console.log('  ' + k.padEnd(12) + ' ' + probe[k]);

  /* ---- scroll to the editor + help block ---- */
  await p.evaluate(() => document.querySelector('.adm-editor').scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: path.join(OUT, 'panel-editor.png') });

  await p.evaluate(() => document.querySelector('.adm-help').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: path.join(OUT, 'panel-help.png') });

  /* ---- open a product in the editor ---- */
  await p.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  const row = await p.$('.adm-row .adm-ico:not(.adm-ico--del)');
  if (row) { await row.click(); await new Promise((r) => setTimeout(r, 700)); }
  await p.screenshot({ path: path.join(OUT, 'panel-edit.png') });

  /* ---- toast ---- */
  await p.click('#admNew').catch(() => {});
  await new Promise((r) => setTimeout(r, 900));
  await p.screenshot({ path: path.join(OUT, 'panel-toast.png') });

  /* ---- mobile ---- */
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: path.join(OUT, 'panel-mobile.png') });

  await b.close();
  console.log('\nPAGE ERRORS:', errs.length ? '' : 'none');
  errs.slice(0, 10).forEach((e) => console.log('  ' + e));
})();
