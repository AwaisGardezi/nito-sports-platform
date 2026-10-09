/* Functional test of the staff console: sign up -> dashboard -> add a product ->
   verify it appears in the list -> survives a reload -> edit it -> delete it.

   RETARGETED. This suite used to test the old single-file admin panel on
   admin.html (`#admGate`, `#admPanel`, `#admList`, `#admNew`, `#admExport`).
   That panel was replaced by the console shell (admin-shell.js + admin-pages.js)
   and the sign-in screen moved to login.html, so every one of those selectors is
   gone. The behaviours this suite was written to protect — an operator can get
   in, add, persist, and delete — are all still required, so the assertions were
   ported to the console rather than dropped.

   Auth is set up through the platform's own one-time setup path rather than by
   poking localStorage. The single account it creates becomes the OWNER, which is
   exactly the role the brief asks for, and it means this suite also proves the
   role is assigned by the product and not assumed by the test.

   The console has NO self sign-up: the owner asked for one staff account and no
   create-account option. This suite therefore asserts the ABSENCE of a
   registration affordance, and that a second account is refused even when the
   call is made directly and the UI is bypassed. */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8099';

let fail = 0;
const ok = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   [' + extra + ']' : ''));
  if (!cond) fail++;
};

async function settle(p, fn, timeout) {
  const deadline = Date.now() + (timeout || 2500);
  for (;;) {
    let v = null;
    try { v = await p.evaluate(fn); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() > deadline) return v;
    await new Promise((r) => setTimeout(r, 60));
  }
}

async function goTo(p, route) {
  await p.evaluate((r) => {
    const a = document.querySelector('#sideNav .side__link[href="#/' + r + '"]');
    if (a) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, route);
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });
  await p.setViewport({ width: 1500, height: 1000 });

  /* ---- 1. the console is not open to the public --------------------------- */
  await p.goto(BASE + '/admin.html', { waitUntil: 'networkidle2' });
  const bounced = await settle(p, () => {
    // either we were sent to the sign-in page, or the shell never drew
    if (/login\.html$/.test(location.pathname)) return 'redirected';
    if (document.querySelector('#sideNav .side__link')) return null; // still waiting
    const boot = document.querySelector('#boot');
    if (boot && !boot.hidden && /sign in/i.test(boot.textContent)) return 'signed-out-notice';
    return null;
  }, 4000);
  ok('signed-out visitor is never shown the console', !!bounced, bounced || 'console visible');

  /* ---- 2. the one staff account, and no way to add a second -------------- */
  await p.goto(BASE + '/login.html', { waitUntil: 'networkidle2' });
  ok('staff sign-in page offers no create-account tab',
    !(await p.evaluate(() => !!document.querySelector('#tabUp'))));

  /* A browser with no account gets the ONE-TIME setup rather than a
     registration form — a console with no account would be unreachable. */
  const modeBefore = await settle(p, () => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'setup' ? 'setup' : null;
  }, 3000);
  ok('a console with no account offers one-time setup, not registration',
    modeBefore === 'setup', 'data-mode=' + modeBefore);

  const up = await p.evaluate(async () => {
    try {
      const u = await window.NitoPlatform.signUp('owner@nitosports.test', 'testpass123', 'Awais Haider');
      return { ok: true, role: u && u.role, name: u && u.name };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  ok('the one staff account is created as the owner', up.ok && up.role === 'owner', up.err || ('role=' + up.role));

  /* weak passwords must be refused */
  const weak = await p.evaluate(async () => {
    try { await window.NitoPlatform.signUp('other@nitosports.test', 'short', 'X'); return 'accepted'; }
    catch (e) { return 'rejected'; }
  });
  ok('a too-short password is refused', weak === 'rejected', weak);

  /* THE RULE the owner asked for: no second account, even asked directly. */
  const second = await p.evaluate(async () => {
    try { await window.NitoPlatform.signUp('intruder@nitosports.test', 'letmein-2026', 'Intruder'); return 'accepted'; }
    catch (e) { return 'refused: ' + e.message; }
  });
  ok('a second staff account is refused even when requested directly',
    /^refused/.test(second) && /already set up/i.test(second), second);

  /* Sign out and reload: the page must now be sign-in only — no setup fields,
     no create-account affordance anywhere. */
  await p.evaluate(() => window.NitoPlatform.signOut());
  await p.goto(BASE + '/login.html', { waitUntil: 'networkidle2' });
  const modeAfter = await settle(p, () => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'signin' ? 'signin' : null;
  }, 3000);
  ok('once an account exists the page is sign-in only', modeAfter === 'signin', 'data-mode=' + modeAfter);
  ok('the setup fields stay hidden once an account exists',
    await p.evaluate(() => {
      const w = document.querySelector('#fPass2Wrap');
      return !!w && w.hasAttribute('hidden');
    }));
  ok('the sign-in page never contains a create-account control',
    !(await p.evaluate(() => !!document.querySelector('#tabUp'))));

  /* sign back in through the real form so the console tests below continue */
  await p.evaluate((em, pw) => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
    };
    set('aEmail', em); set('aPass', pw);
    const f = document.querySelector('#authForm');
    if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }, 'owner@nitosports.test', 'testpass123');
  await p.waitForFunction(() => /admin\.html/.test(location.pathname), { timeout: 8000 }).catch(() => {});

  /* ---- 3. the console opens for the owner --------------------------------- */
  await p.goto(BASE + '/admin.html', { waitUntil: 'networkidle2' });
  const nav = await settle(p, () => {
    const links = document.querySelectorAll('#sideNav .side__link');
    return links.length ? links.length : null;
  }, 4000);
  ok('console shell draws its navigation for the owner', nav > 0, nav + ' links');
  ok('dashboard renders', !!(await settle(p, () => !!document.querySelector('#boot') && /dashboard|catalogue|product/i.test(document.body.textContent))));

  /* ---- 4. product list is populated --------------------------------------- */
  await goTo(p, 'products');
  ok('products screen opens', !!(await settle(p, () => !!document.querySelector('#pTable'), 3000)));

  const seeded = await settle(p, () => {
    const t = document.querySelector('#pCount');
    const m = t && /of\s+(\d+)\s+product/.exec(t.textContent);
    return m ? Number(m[1]) : null;
  }, 3000);
  ok('product list is populated from the catalogue', seeded === 55, String(seeded));

  /* ---- 5. add a product --------------------------------------------------- */
  await p.evaluate(() => document.querySelector('#pNew').click());
  const fields = await settle(p, () => {
    const n = document.querySelectorAll('#e-name, #e-code, #e-cat, #e-moq, #e-blurb, #e-save').length;
    return n >= 5 ? n : null;
  }, 3000);
  ok('editor opens with fields', fields >= 5, fields + ' core fields');

  await p.evaluate(() => {
    const set = (sel, val) => {
      const e = document.querySelector(sel);
      if (e) { e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    set('#e-name', 'ZZ Test Hoodie');
    set('#e-code', 'NTO-9999');
    set('#e-cat', 'street');
    set('#e-moq', '40 units per design');
    set('#e-blurb', 'Automated test entry');
    document.querySelector('#e-save').click();
  });
  ok('new product appears in the console list',
    !!(await settle(p, () => /ZZ Test Hoodie/.test(document.querySelector('#pTable').textContent), 4000)));

  /* ---- 6. persistence across reload (real, not a same-object check) ------- */
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  const stillIn = await settle(p, () => {
    const links = document.querySelectorAll('#sideNav .side__link');
    return links.length ? true : null;
  }, 4000);
  ok('session persists after reload (no re-login)', !!stillIn);

  await goTo(p, 'products');
  ok('added product survives a reload',
    !!(await settle(p, () => /ZZ Test Hoodie/.test(document.body.textContent), 4000)));

  /* ---- 7. edit it --------------------------------------------------------- */
  await p.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#pTable tr'))
      .find((r) => /ZZ Test Hoodie/.test(r.textContent));
    const btn = row && row.querySelector('[data-edit]');
    if (btn) btn.click();
  });
  const editOpened = await settle(p, () => {
    const n = document.querySelector('#e-name');
    return n && /ZZ Test Hoodie/.test(n.value) ? true : null;
  }, 3000);
  ok('edit opens the product pre-filled', !!editOpened);

  await p.evaluate(() => {
    const n = document.querySelector('#e-name');
    n.value = 'ZZ Test Hoodie v2';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#e-save').click();
  });
  ok('edit is saved and reflected in the list',
    !!(await settle(p, () => /ZZ Test Hoodie v2/.test(document.querySelector('#pTable').textContent), 4000)));

  /* ---- 8. delete it ------------------------------------------------------- */
  await p.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#pTable tr'))
      .find((r) => /ZZ Test Hoodie v2/.test(r.textContent));
    const btn = row && row.querySelector('[data-del]');
    if (btn) btn.click();
  });
  ok('delete asks for confirmation first', !!(await settle(p, () => {
    const m = document.querySelector('#modal');
    return m && m.classList.contains('is-on') ? true : null;
  }, 3000)));

  await p.evaluate(() => document.querySelector('#modalOk').click());
  ok('product is deleted after confirming',
    !!(await settle(p, () => !/ZZ Test Hoodie/.test(document.querySelector('#pTable').textContent), 4000)));

  console.log('\nPAGE ERRORS:', errs.length ? errs.join(' | ') : 'none');
  console.log(fail ? 'ADMIN FAILURES: ' + fail : 'ADMIN OK');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
