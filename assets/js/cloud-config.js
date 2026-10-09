/* ==========================================================================
   NITO SPORTS — point the platform at a backend
   --------------------------------------------------------------------------
   Loaded BEFORE assets/js/cloud-shim.js and assets/js/platform.js.

   With no config, `platform.js` uses its localStorage adapter — real storage,
   but single-browser and not protected by a real login. Setting
   NITO_CLOUD_CONFIG is what makes it use the shared, server-side backend.

   WHY THE LOCALHOST GATE
   A visitor on the deployed site has no backend on their own machine to talk
   to. Setting this config there would make every browser attempt a request
   that cannot succeed, so the config is only published when the page is
   actually being served from this machine.

   Note that this gate alone is not enough to be safe: a localhost page served
   by something OTHER than tools/server.js (a plain static server, for example)
   would also match. That case is caught in platform.js, which probes the
   backend once before trusting it and falls back to the local store if it does
   not answer. See `init()` there — a backend that is configured but absent must
   never be reported as shared.

   TO POINT AT A REAL HOSTED BACKEND
   Replace this file's body with the deployment's own config (endpoint,
   oauthRelayBaseUrl, publishableKey) and drop the localhost gate. Nothing else
   needs to change — that is the whole point of the adapter seam.
   ========================================================================== */

(function (global) {
  'use strict';

  var host = global.location && global.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';

  if (!isLocal) return;

  global.NITO_CLOUD_CONFIG = {
    /* Same origin — tools/server.js serves both the site and the API. */
    endpoint: global.location.origin,
    oauthRelayBaseUrl: '',
    publishableKey: 'nito-local-backend'
  };
})(window);
