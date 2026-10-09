/* ==========================================================================
   staff-login — the console has ONE account, and no way to register another

   WHY THIS EXISTS
   The console used to be open registration: login.html offered a "Create
   account" tab and the FIRST account created became the owner. On a browser
   with no account yet — a fresh visitor, a cleared cache, a new device — that
   meant anyone who found /login.html could sign up and own the console.

   The owner asked for the opposite: one staff account, no create-account
   option. That is enforced in two independent places, and this suite proves
   BOTH, because either one alone is not enough:

     1. the UI   — login.html offers no registration affordance at all, so an
                   ordinary visitor never sees one;
     2. the API  — platform.js refuses a second account even when signUp() is
                   called directly, so bypassing the page does not help.

   Check 2 is the one that matters. A UI-only fix is cosmetic: the page can be
   edited in devtools, or the method called from the console. Only the API
   guard makes the rule real.

   It also asserts the KNOWN LIMIT plainly, rather than leaving it to be
   discovered: on the LOCAL adapter, clearing browser data removes the account
   and re-offers setup. That adapter is explicitly not a security boundary —
   which is exactly why the hosted backend must be bound before real use.

   ONE-TIME SETUP is not a loophole. A console with no account at all would be
   unreachable, so the first run asks once for the owner's details and then
   never again. After it succeeds the page is sign-in only, for good.
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099';
const EMAIL = 'owner@nitosports.com';
const PASS = 'nito-staff-login-2026';
const LS_USERS = 'nito_platform_users_v1';

let checks = 0;
let failures = 0;
function check(label, ok, detail) {
  checks++;
  console.log((ok ? '  \u2713 ' : '  \u2717 ') + label + (ok ? '' : '   \u2014 ' + detail));
  if (!ok) failures++;
}

/* Which of the two states the page is in. The page sets this itself, so the
   test never has to infer it from a hidden attribute. */
const mode = (p) => p.evaluate(() => {
  const f = document.querySelector('#authForm');
  return f ? f.getAttribute('data-mode') : null;
});

/* Anything a visitor could click that would start a registration. Scanned over
   buttons, links and submit inputs — NOT over body text, because the page
   legitimately says "there is no sign-up here", which must not trip it. */
const affordance = (p) => p.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button, a, input[type=submit]'));
  const hit = els.find((e) => /create account|sign\s?up|register|join now/i.test(
    (e.textContent || '') + ' ' + (e.value || '')));
  return hit ? String(hit.textContent || hit.value || '').trim() : null;
});

const users = (p) => p.evaluate((k) => {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; }
}, LS_USERS);

const fill = (p, fields, email, pass) => p.evaluate((f, em, pw) => {
  const set = (id, v) => {
    const e = document.getElementById(id);
    if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  if (f) set('aName', 'Awais Haider');
  set('aEmail', em); set('aPass', pw);
  if (f) set('aPass2', pw);
  const form = document.querySelector('#authForm');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}, fields, email, pass);

(async () => {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-'));
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: udd,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.setViewport({ width: 1500, height: 1000 });

  /* ------------------------------------------ 1 no way to register, at all */
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') !== 'signin';
  }, { timeout: 8000 }).catch(() => {});

  check('the login page has no create-account tab',
    !(await p.evaluate(() => !!document.querySelector('#tabUp'))));
  const aff = await affordance(p);
  check('the login page offers no create-account or sign-up control at all',
    !aff, 'found: ' + aff);

  /* ------------------------------------ 2 a fresh console offers setup once */
  check('a console with no account is offered one-time setup',
    (await mode(p)) === 'setup', 'data-mode=' + (await mode(p)));
  check('setup reveals the name and confirm fields',
    await p.evaluate(() => {
      const n = document.querySelector('#fNameWrap'), c = document.querySelector('#fPass2Wrap');
      return !!n && !!c && n.hidden === false && c.hidden === false;
    }));
  check('setup labels the action as setup, not registration',
    (await p.evaluate(() => document.querySelector('#authSubmit').textContent.trim())) === 'Create console access');
  check('the page says plainly that the setup is one-time',
    /one-time setup/i.test(await p.evaluate(() => document.querySelector('#authNote').textContent)));

  /* ---------------------------------------- 3 create it through the real UI */
  await fill(p, true, EMAIL, PASS);
  await p.waitForFunction(() => /admin\.html/.test(location.pathname), { timeout: 8000 }).catch(() => {});
  check('completing setup signs the owner straight into the console',
    /admin\.html/.test(p.url()), p.url());

  const u1 = await users(p);
  check('exactly one account exists after setup', u1.length === 1, 'users=' + u1.length);
  check('that account is the owner', u1[0] && u1[0].role === 'owner', 'role=' + (u1[0] || {}).role);

  /* ------------------------------ 4 THE RULE: no second account, ever, ever */
  const second = await p.evaluate(async () => {
    try {
      await window.NitoPlatform.signUp('intruder@nitosports.com', 'letmein-2026', 'Intruder');
      return 'accepted';
    } catch (e) { return 'refused: ' + e.message; }
  });
  check('a second staff account is refused even when requested directly',
    /^refused/.test(second) && /already set up/i.test(second), second);
  const u2 = await users(p);
  check('the refused attempt added nobody', u2.length === 1, 'users=' + u2.length);

  /* ------------------------------ 5 after setup the page is sign-in only */
  await p.evaluate(() => window.NitoPlatform.signOut());
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'signin';
  }, { timeout: 8000 }).catch(() => {});

  check('once an account exists the page is sign-in only',
    (await mode(p)) === 'signin', 'data-mode=' + (await mode(p)));
  check('the setup fields stay hidden once an account exists',
    await p.evaluate(() => {
      const n = document.querySelector('#fNameWrap'), c = document.querySelector('#fPass2Wrap');
      return !!n && !!c && n.hidden === true && c.hidden === true;
    }));
  check('the sign-in page still offers no create-account control',
    !(await affordance(p)));
  check('the sign-in action is labelled "Sign in"',
    (await p.evaluate(() => document.querySelector('#authSubmit').textContent.trim())) === 'Sign in');

  /* ------------------------------------ 6 the sign-in form still works */
  await fill(p, false, EMAIL, PASS);
  await p.waitForFunction(() => /admin\.html/.test(location.pathname), { timeout: 8000 }).catch(() => {});
  check('signing in with the account still works', /admin\.html/.test(p.url()), p.url());

  /* ---- 7 no in-app recovery: the page must offer no way back in ---- */
  await p.evaluate(() => window.NitoPlatform.signOut());
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'signin';
  }, { timeout: 8000 }).catch(() => {});

  const productsBefore = await p.evaluate(() =>
    window.NitoPlatform.list('products').then((r) => r.length));
  check('the catalogue is present before recovery', productsBefore === 55, 'products=' + productsBefore);

  /* The owner removed BOTH recovery affordances — "forgot password" and "reset
     console access" — so the sign-in form is the only thing on this page. The
     old forgot-password advice (clear the browser's site data) was worse than
     absent: that also erases `nito_platform_v1`, so it would have destroyed the
     catalogue while looking like a password reset. */
  check('the login page offers no forgot-password affordance',
    !(await p.evaluate(() => !!document.querySelector('#forgotBtn'))));
  check('the login page offers no reset affordance',
    !(await p.evaluate(() => !!document.querySelector('#resetBtn'))));
  const cardText = await p.evaluate(() => {
    const c = document.querySelector('.auth__card');
    return c ? c.textContent : '';
  });
  check('the login page never advises clearing browser site data',
    !/clear this site|clear site data|browser data/i.test(cardText),
    cardText.slice(0, 160));

  /* Recovery is now manual and out-of-band, so the procedure the docs give must
     actually work — and must not cost the catalogue. Assert it here, because
     nothing else covers it. */
  await p.evaluate(() => {
    ['nito_platform_users_v1', 'nito_platform_session_v1'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  });
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'setup';
  }, { timeout: 8000 }).catch(() => {});

  check('the documented manual recovery re-offers one-time setup',
    (await mode(p)) === 'setup', 'data-mode=' + (await mode(p)));
  check('the old account is gone after manual recovery', (await users(p)).length === 0);

  const productsAfter = await p.evaluate(() =>
    window.NitoPlatform.list('products').then((r) => r.length));
  check('THE POINT: manual recovery kept every product line',
    productsAfter === productsBefore, 'before=' + productsBefore + ' after=' + productsAfter);

  /* ------- 8 the honest limit — asserted, not left to be discovered later */
  await p.evaluate(() => localStorage.clear());
  await p.goto(URL + '/login.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => {
    const f = document.querySelector('#authForm');
    return f && f.getAttribute('data-mode') === 'setup';
  }, { timeout: 8000 }).catch(() => {});
  check('KNOWN LIMIT (local adapter only): wiping browser data re-offers setup '
      + '\u2014 this is why a hosted backend must be bound before real use',
    (await mode(p)) === 'setup', 'data-mode=' + (await mode(p)));

  check('no page error was thrown on the login page',
    errors.length === 0, errors.slice(0, 3).join(' | '));

  await b.close();
  console.log('\n' + (failures === 0
    ? 'ALL ' + checks + ' CHECKS PASSED'
    : 'FAILURES: ' + failures));
  process.exit(failures === 0 ? 0 : 1);
})();
