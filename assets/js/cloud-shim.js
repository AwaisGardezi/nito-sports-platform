/* ==========================================================================
   NITO SPORTS — client for the local platform backend
   --------------------------------------------------------------------------
   Loaded BEFORE assets/js/platform.js.

   WHAT IT IS
   `platform.js` builds its cloud adapter from `window.NitoCloud`, the
   hosted SDK. This file provides that same object, backed by HTTP calls to
   `tools/server.js` on the same origin. The console and the website cannot
   tell the difference: every method below returns a promise and matches the
   shape the adapter already expects, so the seam in platform.js is the only
   thing that had to be written twice.

   WHEN IT IS INERT — three separate gates, all deliberate:
     1. No `fetch` on the page (older jsdom, very old browsers) → the global is
        never defined, so platform.js falls back to its local store.
     2. `cloud-config.js` has not set NITO_CLOUD_CONFIG (any host that is not
        localhost) → platform.js never looks for this global at all.
     3. The backend is not actually answering → `platform.js` probes it once
        and falls back, saying so. A configured-but-absent backend must never
        be reported as "Hosted (shared)".

   Gate 3 matters most. Reporting a shared, server-verified backend that is not
   there is the exact lie this project forbids — so this file is allowed to
   fail, and platform.js is required to notice.
   ========================================================================== */

(function (global) {
  'use strict';

  if (typeof global.fetch !== 'function') return;

  function makeClient(cfg) {
    var base = (cfg && cfg.endpoint) || '';

    function request(method, url, body) {
      var opts = {
        method: method,
        /* Same-origin cookie carries the session; the server sets it HttpOnly. */
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      };
      if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }

      return global.fetch(base + url, opts).then(function (res) {
        if (res.status === 204) return null;
        return res.json().catch(function () {
          return { error: 'Backend returned a non-JSON reply (HTTP ' + res.status + ')' };
        }).then(function (data) {
          if (!res.ok) {
            throw new Error((data && data.error) || ('HTTP ' + res.status));
          }
          return data;
        });
      });
    }

    function query(opts) {
      var parts = [];
      Object.keys(opts || {}).forEach(function (k) {
        var v = opts[k];
        if (v === undefined || v === null || v === '') return;
        parts.push(encodeURIComponent(k) + '=' +
          encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : String(v)));
      });
      return parts.length ? '?' + parts.join('&') : '';
    }

    var db = function (coll) { return '/api/db/' + encodeURIComponent(coll); };

    return {
      database: {
        list: function (coll, opts) { return request('GET', db(coll) + query(opts)); },
        get: function (coll, id) { return request('GET', db(coll) + '/' + encodeURIComponent(id)); },
        create: function (coll, row) { return request('POST', db(coll), row); },
        update: function (coll, id, patch) {
          return request('PATCH', db(coll) + '/' + encodeURIComponent(id), patch);
        },
        remove: function (coll, id) {
          return request('DELETE', db(coll) + '/' + encodeURIComponent(id));
        }
      },
      auth: {
        hasAccounts: function () {
          return request('GET', '/api/auth/has-accounts').then(function (r) {
            return !!(r && r.hasAccounts);
          });
        },
        signUp: function (email, password, name) {
          return request('POST', '/api/auth/signup', { email: email, password: password, name: name });
        },
        signIn: function (email, password) {
          return request('POST', '/api/auth/signin', { email: email, password: password });
        },
        signOut: function () { return request('POST', '/api/auth/signout', {}); },
        currentUser: function () { return request('GET', '/api/auth/me'); }
      }
    };
  }

  global.NitoCloud = { createNitoCloud: makeClient };
})(window);
