/* ==========================================================================
   NITO SPORTS — staff sign-in page
   --------------------------------------------------------------------------
   Drives login.html.

   There is deliberately NO create-account flow here. The console has exactly
   one staff login, created once by its owner and then closed.

   The single exception is the first run of a console that has no account at
   all: without it the console would be unreachable, so the page asks once for
   the owner's details and never again. That is one-time setup, not
   registration — and it is not the only thing enforcing it. `signUp` in
   platform.js refuses a second account even when the UI is bypassed and the
   call is made directly, so the rule survives a crafted request.

   Always states plainly where accounts are stored, because a login screen
   that overstates its security is worse than useless.
   ========================================================================== */

(function (global) {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* true only on a console that has no account yet. Set once, in boot(). */
  var setup = false;
  var busy = false;

  function msg(text, kind) {
    var el = $('#authMsg');
    el.className = 'auth__msg' + (text ? ' is-on auth__msg--' + (kind || 'err') : '');
    el.textContent = text || '';
  }

  function fieldErr(wrapId, on) {
    var w = $('#' + wrapId);
    if (w) w.classList.toggle('is-error', !!on);
  }

  /* Paint the page for whichever of the two states we are in. Everything the
     setup state reveals is hidden again the moment an account exists, so the
     normal, steady state of this page is sign-in only. */
  function apply() {
    $('#fNameWrap').hidden = !setup;
    $('#fPass2Wrap').hidden = !setup;
    $('#authForm').setAttribute('data-mode', setup ? 'setup' : 'signin');

    $('#authTitle').textContent = setup ? 'Set up console access' : 'Staff sign in';
    $('#authSub').textContent = setup
      ? 'This console has no account yet. Create the one staff login to begin.'
      : 'Sign in to manage the catalogue and enquiries.';

    $('#authSubmit').textContent = setup ? 'Create console access' : 'Sign in';

    $('#aPass').setAttribute('autocomplete', setup ? 'new-password' : 'current-password');
    $('#aPass').placeholder = setup ? 'At least 8 characters' : 'Your password';

    note();
  }

  function note() {
    var el = $('#authNote');

    if (setup) {
      el.innerHTML = '<b>One-time setup.</b> This creates the single staff account for ' +
        'this console. Afterwards this page only signs in — no further accounts can be ' +
        'created here.';
      return;
    }

    var info = global.NitoPlatform.mode();
    if (info.mode === 'local') {
      el.innerHTML = 'Accounts are held <b>in this browser only</b> while the hosted ' +
        'backend is not connected. They are not verified server-side and will not work on ' +
        'another device. <a href="HOSTING-GUIDE.md" style="color:var(--blue-300)">Details</a>';
    } else if (info.mode === 'cloud') {
      el.innerHTML = 'Accounts are verified on the hosted backend. Your password is never ' +
        'stored in this browser.';
    } else {
      el.textContent = '';
    }
  }

  function nextUrl() {
    var next = new URLSearchParams(location.search).get('next');
    return next && next.indexOf('#/') === 0 ? 'admin.html' + next : 'admin.html';
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;

    var email = $('#aEmail').value.trim();
    var pass = $('#aPass').value;
    var pass2 = $('#aPass2').value;
    var name = $('#aName').value.trim();

    fieldErr('fEmailWrap', !email);
    fieldErr('fPassWrap', !pass);
    if (!email || !pass) { msg('Fill in the fields marked in red.'); return; }

    if (setup) {
      if (pass.length < 8) { fieldErr('fPassWrap', true); msg('Use at least 8 characters for your password.'); return; }
      if (pass !== pass2) { fieldErr('fPass2Wrap', true); msg('The two passwords do not match.'); return; }
    }

    busy = true;
    var btn = $('#authSubmit');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = setup ? 'Setting up…' : 'Signing in…';
    msg('');

    var p = setup
      ? global.NitoPlatform.signUp(email, pass, name)
      : global.NitoPlatform.signIn(email, pass);

    p.then(function (user) {
      msg('Signed in as ' + esc(user.email) + '. Taking you through…', 'ok');
      setTimeout(function () { location.href = nextUrl(); }, 500);
    }).catch(function (err) {
      busy = false;
      btn.disabled = false;
      btn.textContent = label;
      msg(err && err.message ? err.message : 'That did not work. Try again.');
    });
  }

  /* NO in-app recovery, by the owner's decision.

     The page offers neither "forgot password" nor "reset console access" — both
     were removed deliberately, so the sign-in form is the only thing here. The
     old forgot-password advice (clear the browser's site data) was worse than
     absent: that also erases `nito_platform_v1` and the photo keys, so it would
     have destroyed the catalogue while looking like a password reset.

     Recovery is therefore a manual, out-of-band operation: remove ONLY
     `nito_platform_users_v1` and `nito_platform_session_v1` (from both
     localStorage and sessionStorage), then reload. The catalogue lives in a
     different key, so products, enquiries, photos and the quote list survive.
     `staff-login-test.js` verifies that procedure, because it is now the only
     way back in.

     A hosted backend makes this unnecessary — real password reset is
     server-side. Keep this page recovery-free until then. */

  function boot() {
    global.NitoPlatform.init()
      /* On any error, assume the console is already set up. Offering setup
         when it is not wanted is the riskier failure of the two. */
      .then(function () { return global.NitoPlatform.hasAccounts(); })
      .catch(function () { return true; })
      .then(function (has) {
        setup = !has;
        apply();
        return global.NitoPlatform.currentUser();
      })
      .then(function (u) {
        if (u) location.replace(nextUrl());
      })
      .catch(function () { /* leave the form usable rather than stuck */ });

    $('#authForm').addEventListener('submit', submit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
