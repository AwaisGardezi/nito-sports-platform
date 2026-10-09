#!/usr/bin/env node
/* ==========================================================================
   NITO SPORTS — local platform server
   --------------------------------------------------------------------------
   ONE process serves the whole platform: the website (frontend) AND the API
   the console talks to (backend). Start it with `Start NITO Platform.cmd`.

   WHY THIS EXISTS
   The console has always run on a localStorage adapter — real storage, but
   single-browser, not shared, not protected by a real login. The hosted
   backend is not provisioned yet. This server gives the platform a REAL
   backend on the owner's own machine, using the seam that already exists:
   `assets/js/platform.js` swaps its adapter in exactly one place, so nothing
   in the console or the website had to change shape to talk to it.

   It is a genuine server, not a simulation:
     - data lives in `data/platform-db.json` and survives a restart
     - passwords are hashed with scrypt (the browser adapter's FNV-1a hash is
       explicitly a convenience hash, never a security boundary — see
       platform.js)
     - sessions are server-side and survive a restart
     - "one staff account, no self sign-up" is enforced HERE, on the server,
       which is the only place it can actually be enforced

   WHAT IT DELIBERATELY IS NOT
   Not a production deployment. It binds to 127.0.0.1, serves over plain HTTP,
   and has no rate limiting. It is how the owner runs the platform on his own
   machine, and the console banner says so. When the hosted backend is bound,
   this file is not used at all.

   DEV-SERVER HTML INJECTION
   The public pages do not ship the backend scripts, because a real visitor on
   the deployed site has no backend to talk to. When this server serves an
   HTML page it injects three script tags — cloud-config.js, cloud-shim.js and
   platform.js — so the live-catalogue bridge can arm. That is the ONLY thing
   it does differently from a plain static host, it is marked in the response
   with an HTML comment, and `--no-inject` turns it off.

   Usage:
     node tools/server.js [--port 8788] [--no-open] [--no-inject] [--fresh]
   ========================================================================== */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.indexOf(f) > -1;
const flagValue = (f, d) => {
  const i = argv.indexOf(f);
  return i > -1 && argv[i + 1] ? argv[i + 1] : d;
};

const BASE_PORT = Number(flagValue('--port', process.env.NITO_PORT || 8788));
const OPEN_BROWSER = !hasFlag('--no-open');
const INJECT = !hasFlag('--no-inject');

/* Where the data lives. `--data <file>` lets the test suite run against its own
   throwaway database instead of the owner's real one. */
const DATA_DIR = path.join(ROOT, 'data');
const DATA_OVERRIDE = flagValue('--data', '');
const DB_FILE = DATA_OVERRIDE ? path.resolve(DATA_OVERRIDE) : path.join(DATA_DIR, 'platform-db.json');

/* Collections the console reads and writes. `users`, `sessions` and
   `settings` are handled separately — they are not free-form lists. */
const COLLECTIONS = ['products', 'categories', 'enquiries', 'customers', 'team', 'audit'];

/* --------------------------------------------------------------------------
   storage — a single JSON file, written atomically
   -------------------------------------------------------------------------- */

let DB = null;

function emptyDb() {
  return {
    version: 1,
    collections: { products: [], categories: [], enquiries: [], customers: [], team: [], audit: [] },
    settings: { brand: 'NITO SPORTS', allowSignup: false, requireApproval: false },
    users: [],
    sessions: {}
  };
}

/* Load the shipped catalogue so the backend starts with the real 55 lines
   rather than an empty screen. catalog.js is a plain browser script that
   assigns to `window`, so it is run with a stand-in window object. */
function shippedCatalogue() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/catalog.js'), 'utf8');
    const win = {};
    new Function('window', src)(win);
    return {
      categories: win.NITO_CATALOG && win.NITO_CATALOG.categories ? win.NITO_CATALOG.categories : [],
      products: win.NITO_CATALOG && win.NITO_CATALOG.products ? win.NITO_CATALOG.products : [],
      brand: (win.NITO_SITE && win.NITO_SITE.brand) || 'NITO SPORTS'
    };
  } catch (e) {
    console.error('  ! could not read assets/js/catalog.js:', e.message);
    return { categories: [], products: [], brand: 'NITO SPORTS' };
  }
}

function seedDb() {
  const cat = shippedCatalogue();
  const db = emptyDb();
  db.collections.categories = cat.categories;
  db.collections.products = cat.products;
  db.settings.brand = cat.brand;
  return db;
}

function loadDb() {
  if (hasFlag('--fresh') && fs.existsSync(DB_FILE)) {
    fs.renameSync(DB_FILE, DB_FILE + '.replaced-' + Date.now());
    console.log('  i --fresh: previous data file moved aside');
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const base = emptyDb();
      /* Fill in anything a newer version added, without discarding data. */
      return Object.assign(base, parsed, {
        collections: Object.assign(base.collections, parsed.collections || {}),
        settings: Object.assign(base.settings, parsed.settings || {}),
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {}
      });
    } catch (e) {
      const bad = DB_FILE + '.corrupt-' + Date.now();
      fs.renameSync(DB_FILE, bad);
      console.error('  ! data file was not valid JSON — moved to ' + path.basename(bad));
      console.error('    starting from the shipped catalogue instead');
    }
  }
  const db = seedDb();
  persist(db);
  console.log('  i first run: seeded ' + db.collections.products.length +
              ' products from assets/js/catalog.js');
  return db;
}

/* Atomic: write a temp file then rename, so an interrupted write cannot leave
   a half-written database behind. */
function persist(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/* --------------------------------------------------------------------------
   helpers
   -------------------------------------------------------------------------- */

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}
const nowISO = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

function readCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sessionUser(req) {
  const token = readCookies(req)['nito_sid'];
  if (!token) return null;
  const s = DB.sessions[token];
  if (!s) return null;
  const u = DB.users.filter((x) => x.id === s.userId)[0];
  if (!u) { delete DB.sessions[token]; return null; }
  return u;
}

/* --------------------------------------------------------------------------
   static files
   -------------------------------------------------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

/* The three scripts the console already loads, added to pages that do not
   ship them so the live-catalogue bridge can arm. Marked in the output so the
   served page is never mistaken for the file on disk. */
function injectBackendScripts(html) {
  if (!INJECT || html.indexOf('nito-backend-injected') > -1) return html;
  let tags = '';
  if (html.indexOf('assets/js/cloud-config.js') === -1) tags += '<script src="assets/js/cloud-config.js"></script>\n';
  if (html.indexOf('assets/js/cloud-shim.js') === -1) tags += '<script src="assets/js/cloud-shim.js"></script>\n';
  if (html.indexOf('assets/js/platform.js') === -1) tags += '<script src="assets/js/platform.js"></script>\n';
  if (!tags) return html;
  tags = '<!-- nito-backend-injected: dev server only, see tools/server.js -->\n' + tags;
  const anchor = html.match(/<script src="assets\/js\/(?:platform|live-data)\.js"/);
  if (anchor) return html.replace(anchor[0], tags + anchor[0]);
  return html.replace('</body>', tags + '</body>');
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const abs = path.resolve(ROOT, '.' + rel);

  /* Never serve outside the project directory. */
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'text/plain', 'Forbidden');
  }

  let file = abs;
  try {
    if (fs.statSync(abs).isDirectory()) file = path.join(abs, 'index.html');
  } catch (e) {
    file = abs;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      fs.readFile(path.join(ROOT, '404.html'), (e2, page) => {
        if (e2) return send(res, 404, 'text/plain', 'Not found: ' + rel);
        send(res, 404, MIME['.html'], page.toString());
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const body = ext === '.html' ? injectBackendScripts(buf.toString()) : buf;
    send(res, 200, type, body);
  });
}

function send(res, code, type, body, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': type,
    /* No caching: this is a working copy the owner edits and reloads. A stale
       stylesheet here would look exactly like a broken layout. */
    'Cache-Control': 'no-store, must-revalidate'
  }, extraHeaders || {});
  res.writeHead(code, headers);
  res.end(body);
}

const sendJson = (res, code, obj, extra) =>
  send(res, code, MIME['.json'], JSON.stringify(obj), extra);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8e6) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Body is not valid JSON')); }
    });
    req.on('error', reject);
  });
}

/* --------------------------------------------------------------------------
   the API
   -------------------------------------------------------------------------- */

function applyListOptions(rows, q) {
  let out = rows.slice();
  if (q.where) {
    let where;
    try { where = JSON.parse(q.where); } catch (e) { where = null; }
    if (where) out = out.filter((r) => Object.keys(where).every((k) => r[k] === where[k]));
  }
  if (q.search && q.fields) {
    const needle = String(q.search).toLowerCase();
    const fields = String(q.fields).split(',');
    out = out.filter((r) => fields.some((f) => String(r[f] || '').toLowerCase().indexOf(needle) > -1));
  }
  const sortKey = q.sort || 'createdAt';
  out.sort((a, b) => {
    const da = a[sortKey] || '';
    const dbv = b[sortKey] || '';
    if (da === dbv) return String(a.name || a.id).localeCompare(String(b.name || b.id));
    return q.dir === 'asc' ? (da > dbv ? 1 : -1) : (da < dbv ? 1 : -1);
  });
  if (q.limit) out = out.slice(0, Number(q.limit));
  return out;
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const seg = parts.slice(1);
  const q = {};
  url.searchParams.forEach((v, k) => { q[k] = v; });

  /* ---- health ---- */
  if (seg[0] === 'health') {
    return sendJson(res, 200, {
      ok: true,
      mode: 'local-backend',
      shared: true,
      products: DB.collections.products.length,
      accounts: DB.users.length,
      storage: path.relative(ROOT, DB_FILE).replace(/\\/g, '/'),
      server: 'nito-local-backend/1'
    });
  }

  /* ---- settings ---- */
  if (seg[0] === 'settings') {
    if (req.method === 'GET') return sendJson(res, 200, DB.settings);
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const patch = await readBody(req);
      DB.settings = Object.assign(DB.settings, patch);
      persist(DB);
      return sendJson(res, 200, DB.settings);
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  /* ---- auth ---- */
  if (seg[0] === 'auth') {
    const action = seg[1];

    if (action === 'has-accounts' && req.method === 'GET') {
      /* Exposing this is safe: signUp below refuses outright once an account
         exists, so this can only ever be the difference between "offer the
         one-time setup" and "ask for the password". */
      return sendJson(res, 200, { hasAccounts: DB.users.length > 0 });
    }

    if (action === 'signup' && req.method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (DB.users.length > 0) {
        return sendJson(res, 403, { error: 'This console is already set up. Staff access is issued by the owner — there is no self sign-up.' });
      }
      if (!email || !password) return sendJson(res, 400, { error: 'E-mail and password are required.' });
      if (password.length < 8) return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const user = {
        id: uid('usr'), email, name: String(body.name || email.split('@')[0]),
        role: 'owner', salt, passwordHash: hashPassword(password, salt), createdAt: nowISO()
      };
      DB.users.push(user);
      const token = crypto.randomBytes(32).toString('hex');
      DB.sessions[token] = { userId: user.id, createdAt: nowISO() };
      persist(DB);
      return sendJson(res, 200, publicUser(user), {
        'Set-Cookie': 'nito_sid=' + token + '; HttpOnly; SameSite=Strict; Path=/'
      });
    }

    if (action === 'signin' && req.method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = DB.users.filter((u) => u.email === email)[0];
      /* Same message either way: never reveal which addresses exist. */
      const bad = () => sendJson(res, 401, { error: 'E-mail or password is not correct.' });
      if (!user) return bad();
      const candidate = hashPassword(password, user.salt);
      const a = Buffer.from(candidate, 'hex');
      const b = Buffer.from(user.passwordHash, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return bad();
      const token = crypto.randomBytes(32).toString('hex');
      DB.sessions[token] = { userId: user.id, createdAt: nowISO() };
      persist(DB);
      return sendJson(res, 200, publicUser(user), {
        'Set-Cookie': 'nito_sid=' + token + '; HttpOnly; SameSite=Strict; Path=/'
      });
    }

    if (action === 'signout' && req.method === 'POST') {
      const token = readCookies(req)['nito_sid'];
      if (token) { delete DB.sessions[token]; persist(DB); }
      return sendJson(res, 200, { ok: true }, {
        'Set-Cookie': 'nito_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
      });
    }

    if (action === 'me' && req.method === 'GET') {
      const u = sessionUser(req);
      return sendJson(res, 200, u ? publicUser(u) : null);
    }

    return sendJson(res, 404, { error: 'Unknown auth action: ' + action });
  }

  /* ---- collections ---- */
  if (seg[0] === 'db') {
    const coll = seg[1];
    const id = seg[2];
    if (COLLECTIONS.indexOf(coll) === -1) {
      return sendJson(res, 404, { error: 'Unknown collection: ' + coll });
    }
    const rows = DB.collections[coll];

    if (!id) {
      if (req.method === 'GET') return sendJson(res, 200, applyListOptions(rows, q));
      if (req.method === 'POST') {
        const body = await readBody(req);
        const row = Object.assign({}, body);
        if (!row.id) row.id = uid(coll.slice(0, 4));
        row.createdAt = row.createdAt || nowISO();
        row.updatedAt = nowISO();
        rows.unshift(row);
        persist(DB);
        return sendJson(res, 201, clone(row));
      }
      return sendJson(res, 405, { error: 'Method not allowed on a collection' });
    }

    const i = rows.findIndex((r) => r.id === id);
    if (req.method === 'GET') {
      return i === -1 ? sendJson(res, 404, { error: 'Not found: ' + id }) : sendJson(res, 200, rows[i]);
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (i === -1) return sendJson(res, 404, { error: 'Not found: ' + id });
      const patch = await readBody(req);
      rows[i] = Object.assign({}, rows[i], patch, { updatedAt: nowISO() });
      persist(DB);
      return sendJson(res, 200, clone(rows[i]));
    }
    if (req.method === 'DELETE') {
      if (i === -1) return sendJson(res, 404, { error: 'Not found: ' + id });
      rows.splice(i, 1);
      persist(DB);
      return sendJson(res, 200, { removed: true });
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  return sendJson(res, 404, { error: 'Unknown API path: ' + url.pathname });
}

/* --------------------------------------------------------------------------
   server
   -------------------------------------------------------------------------- */

function createServer() {
  return http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); }
    catch (e) { return send(res, 400, 'text/plain', 'Bad request'); }

    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url).catch((err) => {
        console.error('  ! api error:', err.message);
        sendJson(res, 500, { error: err.message });
      });
      return;
    }
    serveStatic(req, res, url.pathname);
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'cmd'
    : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    console.log('  i open this in your browser: ' + url);
  }
}

function listen(port, attempt) {
  const server = createServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 5) {
      console.log('  i port ' + port + ' is busy, trying ' + (port + 1) + '…');
      return listen(port + 1, attempt + 1);
    }
    console.error('\n  x could not start: ' + err.message);
    if (err.code === 'EADDRINUSE') {
      console.error('    Something else is using port ' + port + '.');
      console.error('    Start again with a different port:  node tools/server.js --port 8899');
    }
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + port + '/';
    const api = 'http://127.0.0.1:' + port + '/api/health';
    console.log('');
    console.log('  ===============================================================');
    console.log('   NITO SPORTS — platform is running');
    console.log('  ===============================================================');
    console.log('   Website      ' + url);
    console.log('   Console      ' + url + 'login.html');
    console.log('   Backend API  ' + api);
    console.log('   Data file    ' + path.relative(ROOT, DB_FILE).replace(/\\/g, '/'));
    console.log('   Products     ' + DB.collections.products.length +
                '   Staff accounts  ' + DB.users.length);
    if (!DB.users.length) {
      console.log('   First run    open the console and create the one staff login');
    }
    console.log('');
    console.log('   Press Ctrl+C to stop.');
    console.log('');
    if (OPEN_BROWSER) openBrowser(url);
  });
}

/* --------------------------------------------------------------------------
   start
   -------------------------------------------------------------------------- */

console.log('NITO SPORTS — local platform server');
DB = loadDb();
listen(BASE_PORT, 0);

['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    try { persist(DB); } catch (e) { /* nothing useful to do while exiting */ }
    console.log('\n  Platform stopped.');
    process.exit(0);
  });
});
