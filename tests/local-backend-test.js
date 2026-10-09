/* ==========================================================================
   Local platform backend — end-to-end
   --------------------------------------------------------------------------
   Proves the one-click server really is a backend, and that the platform
   tells the truth about which store it is using.

   What it checks:
     1. the API answers and seeds the real 55-product catalogue
     2. auth is server-side: sign-up, session survives a reload, sign-out
     3. "one staff account, no self sign-up" is enforced ON THE SERVER
     4. the public website reads the backend — the live bridge ARMS
     5. the console signs in against the backend and reports mode 'cloud'
     6. HONESTY: with the API unreachable the platform falls back to the local
        store and must NOT claim to be shared

   Runs against its own throwaway database (--data), so it never touches the
   owner's data/platform-db.json.
   ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = 'C:/Users/PcR/OneDrive/Desktop/Sports Platform';
const PORT = 8842;
const BASE = 'http://127.0.0.1:' + PORT;
const DB = path.join(os.tmpdir(), 'nito-backend-test-' + Date.now() + '.json');

const OWNER = { email: 'owner@nitosports.com', password: 'Fixture-Passw0rd!', name: 'Awais Haider' };
const MARKER = 'Bridge Proof Hoodie';

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  PASS  ' + msg); }
  else { fail++; console.log('  FAIL  ' + msg); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = (method, url, body, headers) => fetch(BASE + url, {
  method,
  headers: Object.assign(body ? { 'Content-Type': 'application/json' } : {}, headers || {}),
  body: body ? JSON.stringify(body) : undefined
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), raw: r }));

let server = null;

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

(async () => {
  console.log('\n=== LOCAL PLATFORM BACKEND ===\n');

  server = spawn(process.execPath, [
    path.join(ROOT, 'tools/server.js'),
    '--no-open', '--port', String(PORT), '--data', DB
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

  let browser = null;
  try {
    if (!await waitForHealth()) throw new Error('server never became healthy on ' + BASE);

    /* ---------- 1. the API is real ---------- */
    console.log('API');
    const health = await api('GET', '/api/health');
    ok(health.status === 200 && health.body && health.body.ok === true, 'health endpoint answers');
    ok(health.body.products === 55, 'seeded the real catalogue: 55 products (got ' + health.body.products + ')');
    ok(health.body.accounts === 0, 'starts with zero staff accounts');

    const listed = await api('GET', '/api/db/products?limit=3');
    ok(Array.isArray(listed.body) && listed.body.length === 3, 'list honours ?limit');
    const search = await api('GET', '/api/db/products?search=hoodie&fields=name');
    ok(Array.isArray(search.body), 'list supports ?search across ?fields');

    /* ---------- 2/3. server-side auth ---------- */
    console.log('\nAUTH (server-side)');
    const su = await api('POST', '/api/auth/signup', OWNER);
    ok(su.status === 200 && su.body.role === 'owner', 'first sign-up creates the owner');
    const cookie = (su.raw.headers.get('set-cookie') || '').split(';')[0];
    ok(/^nito_sid=/.test(cookie), 'session cookie issued');

    const me = await api('GET', '/api/auth/me', null, { Cookie: cookie });
    ok(me.body && me.body.email === OWNER.email, 'session identifies the user');
    ok(me.body && me.body.passwordHash === undefined && me.body.salt === undefined,
      'the user object never leaks the password hash or salt');

    const second = await api('POST', '/api/auth/signup', { email: 'intruder@example.com', password: 'password123' });
    ok(second.status === 403, 'a SECOND sign-up is refused by the server (got ' + second.status + ')');

    const wrong = await api('POST', '/api/auth/signin', { email: OWNER.email, password: 'nope' });
    ok(wrong.status === 401, 'wrong password is rejected');

    const good = await api('POST', '/api/auth/signin', OWNER);
    const cookie2 = (good.raw.headers.get('set-cookie') || '').split(';')[0];
    ok(good.status === 200, 'correct password signs in');

    const out = await api('POST', '/api/auth/signout', {}, { Cookie: cookie2 });
    const after = await api('GET', '/api/auth/me', null, { Cookie: cookie2 });
    ok(out.status === 200 && after.body === null, 'sign-out really ends the session server-side');

    /* ---------- durability ---------- */
    console.log('\nSTORAGE');
    const created = await api('POST', '/api/db/products', { name: MARKER, code: 'NTO-9001', cat: 'teamwear', published: true });
    ok(created.status === 201 && created.body.id, 'create returns the stored row with an id');
    ok(fs.existsSync(DB), 'data file written to disk');
    const onDisk = JSON.parse(fs.readFileSync(DB, 'utf8'));
    ok(onDisk.collections.products.some((p) => p.name === MARKER), 'the new product is in the file, not just in memory');
    ok(!!onDisk.users[0].passwordHash && !onDisk.users[0].password,
      'the stored password is a hash, never plain text');

    const patched = await api('PATCH', '/api/db/products/' + created.body.id, { name: MARKER + ' v2' });
    ok(patched.body.name === MARKER + ' v2', 'update merges the patch');

    /* ---------- 4. the website reads the backend ---------- */
    console.log('\nFRONTEND <-> BACKEND');
    const home = await fetch(BASE + '/index.html');
    const html = await home.text();
    ok(html.indexOf('nito-backend-injected') > -1, 'dev server injected the backend scripts');
    ok(html.indexOf('assets/js/platform.js') > -1, 'platform.js is on the public page so the bridge can arm');

    browser = await puppeteer.launch({
      executablePath: CHROME, headless: 'new',
      userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'nito-be-')),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
    });

    const pub = await browser.newPage();
    await pub.setViewport({ width: 1280, height: 900 });
    await pub.goto(BASE + '/index.html', { waitUntil: 'networkidle0' });
    await sleep(1200);
    const live = await pub.evaluate(() => ({
      armed: window.NITO_LIVE && window.NITO_LIVE.armed,
      reason: window.NITO_LIVE && window.NITO_LIVE.reason,
      count: window.NITO_LIVE && window.NITO_LIVE.count,
      mode: window.NitoPlatform ? window.NitoPlatform.mode().mode : null,
      shared: window.NitoPlatform ? window.NitoPlatform.mode().shared : null
    }));
    ok(live.mode === 'cloud' && live.shared === true, 'public page reports a shared backend (' + live.mode + ')');
    ok(live.armed === true && live.reason === 'backend', 'live catalogue bridge ARMED from the backend (' + live.reason + ')');
    ok(live.count === 56, 'bridge served 56 published lines — the console-created one included (got ' + live.count + ')');
    /* The homepage rail is a HARDCODED id list (renderFeaturedRail), so a newly
       created line can never appear there — asserting on it tests the wrong
       surface. The page that lists the catalogue is products.html, which draws
       #productGrid from this same (live) data.
       Assert on the card's `data-name` attribute: the name is written there and
       NOT into body.textContent, so a textContent check would pass vacuously. */
    const inCatalogue = await pub.evaluate((m) => {
      const c = window.NITO_CATALOG;
      return !!(c && c.products && c.products.some((p) => p.name === m));
    }, MARKER + ' v2');
    ok(inCatalogue, 'the live catalogue the pages render from contains the new line');

    const grid = await browser.newPage();
    await grid.setViewport({ width: 1280, height: 900 });
    await grid.goto(BASE + '/products.html?q=bridge', { waitUntil: 'networkidle0' });
    await sleep(1000);
    const cards = await grid.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#productGrid .pcard'),
      (el) => el.getAttribute('data-name') || ''
    ));
    ok(cards.length > 0, 'searching the public catalogue returns rows (' + cards.length + ')');
    ok(cards.some((n) => n.indexOf('bridge proof hoodie v2') === 0),
      'the product created through the API is VISIBLE on products.html');
    await grid.close();

    /* ---------- 5. the console signs in against the backend ---------- */
    console.log('\nCONSOLE');
    const con = await browser.newPage();
    await con.setViewport({ width: 1440, height: 900 });
    await con.goto(BASE + '/login.html', { waitUntil: 'networkidle0' });
    await sleep(900);
    const mode = await con.evaluate(() => document.getElementById('authForm').getAttribute('data-mode'));
    ok(mode === 'signin', 'with an account on the server the console asks to sign in (got ' + mode + ')');
    await con.type('#aEmail', OWNER.email);
    await con.type('#aPass', OWNER.password);
    await con.click('#authSubmit');
    await sleep(2600);
    const consoleState = await con.evaluate(() => ({
      url: location.pathname,
      mode: window.NitoPlatform ? window.NitoPlatform.mode().mode : null,
      shared: window.NitoPlatform ? window.NitoPlatform.mode().shared : null,
      secure: window.NitoPlatform ? window.NitoPlatform.mode().secure : null
    }));
    ok(/admin\.html$/.test(consoleState.url), 'sign-in lands on the console (got ' + consoleState.url + ')');
    ok(consoleState.mode === 'cloud' && consoleState.shared === true && consoleState.secure === true,
      'the console runs on the shared, server-verified backend');

    /* ---------- 6. HONESTY: no backend must not look like a backend ---------- */
    console.log('\nHONESTY (backend configured but unreachable)');
    const off = await browser.newPage();
    await off.setRequestInterception(true);
    off.on('request', (r) => (/\/api\//.test(r.url()) ? r.abort() : r.continue()));
    await off.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await sleep(1800);
    const fallback = await off.evaluate(() => ({
      mode: window.NitoPlatform ? window.NitoPlatform.mode().mode : null,
      shared: window.NitoPlatform ? window.NitoPlatform.mode().shared : null,
      reason: window.NITO_LIVE && window.NITO_LIVE.reason,
      armed: window.NITO_LIVE && window.NITO_LIVE.armed
    }));
    ok(fallback.mode === 'local', 'falls back to the local store instead of hanging (got ' + fallback.mode + ')');
    ok(fallback.shared === false, 'and does NOT claim to be shared');
    ok(fallback.armed !== true && fallback.reason === 'local-mode',
      'the bridge stays inert, so the static catalogue still serves (reason ' + fallback.reason + ')');
    const stillRendered = await off.evaluate(() => document.querySelectorAll('#productGrid .pcard, #featuredRail .pcard').length);
    ok(stillRendered > 0, 'the site still renders products from catalog.js (' + stillRendered + ' cards)');

  } catch (err) {
    fail++;
    console.log('\n  FAIL  threw: ' + err.message + '\n' + (err.stack || ''));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.kill();
    try { fs.unlinkSync(DB); } catch (e) { /* fine */ }
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
