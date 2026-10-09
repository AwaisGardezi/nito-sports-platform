/* ==========================================================================
   NITO SPORTS — Platform data layer
   --------------------------------------------------------------------------
   ONE seam between the UI and wherever the data actually lives.

   The whole admin and the public catalogue talk to `window.NitoPlatform` and
   nothing else. That is deliberate: it means the storage backend can be
   swapped in exactly one place, and every page keeps working through the
   change.

   Two providers are implemented:

     localAdapter   — a real, fully working store backed by localStorage.
                      Used until the hosted backend is provisioned, and as an
                      explicit, visible fallback afterwards so nothing silently
                      pretends to save.
     cloudAdapter   — the hosted backend (database + server-side auth).
                      Enabled by setting window.NITO_CLOUD_CONFIG, which is
                      written from the backend's public config.

   IMPORTANT — read this before trusting a deployment:
   The local adapter is a genuine working data store, not a mock. Data really
   is written and really does survive reloads. But it lives in ONE BROWSER:
   it is not shared between visitors and it is not secure. Which adapter is
   live is always reported by NitoPlatform.mode() and is shown in the admin
   UI, so a deployment can never look more capable than it is.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
     helpers
     --------------------------------------------------------------------- */

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function nowISO() { return new Date().toISOString(); }

  /* stable, human-readable product code: NTO-<cat><nnn> */
  function nextCode(products, catIndex) {
    var n = 1000 + catIndex * 1000 + (products.filter(function (p) {
      return p.code && p.code.indexOf('NTO-' + (catIndex + 1)) === 0;
    }).length + 1);
    return 'NTO-' + n;
  }

  /* ---------------------------------------------------------------------
     seed — the shipped catalogue becomes the starting dataset
     --------------------------------------------------------------------- */

  function seed() {
    var C = global.NITO_CATALOG || {};
    return {
      version: 1,
      categories: clone(C.categories || []),
      products: clone(C.products || []),
      enquiries: [],
      customers: [],
      team: [],
      audit: [],
      settings: {
        brand: (global.NITO_SITE && global.NITO_SITE.brand) || 'NITO SPORTS',
        /* There is no self sign-up. The console is set up once by its owner
           and then closed for good — enforced in LocalAdapter.signUp below.
           Kept as a field so a hosted backend can report its own policy. */
        allowSignup: false,
        requireApproval: false
      }
    };
  }

  /* ---------------------------------------------------------------------
     local adapter — real storage, single browser
     --------------------------------------------------------------------- */

  var LS_KEY = 'nito_platform_v1';

  function LocalAdapter() {
    this.kind = 'local';
    this._db = null;
  }

LocalAdapter.prototype.ready = function () {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.products)) {
    this._db = seed();
    this._persist();
  } else {
    this._db = raw;
    /* Forward-fill any collection added by a later version. Arrays are copied
       by reference-to-same-array only when missing; existing ones are kept. */
    var base = seed();
    Object.keys(base).forEach(function (k) {
      if (this._db[k] === undefined) this._db[k] = base[k];
    }, this);
  }
  this._loadedAt = this._stamp();
  return Promise.resolve(this.info());
};

LocalAdapter.prototype._persist = function () {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(this._db));
    this._loadedAt = this._stamp();
  } catch (e) {
    /* quota — surface it rather than pretending the write landed */
    throw new Error('Could not save: browser storage is full.');
  }
};

/* Cheap change-detector for the stored blob. Not a security hash. */
LocalAdapter.prototype._stamp = function () {
  try {
    var s = localStorage.getItem(LS_KEY) || '';
    return s.length + ':' + (s.charCodeAt(s.length - 1) | 0);
  } catch (e) { return ''; }
};

/* Two tabs of this site both write to the same key. Without this, whichever
   tab booted last holds a stale in-memory copy and the next write silently
   discards everything the other tab saved — enquiries disappearing is the
   symptom that matters most, so reload before every read. */
LocalAdapter.prototype._sync = function () {
  var stamp = this._stamp();
  if (stamp === this._loadedAt) return;
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { raw = null; }
  if (raw && typeof raw === 'object' && Array.isArray(raw.products)) {
    this._db = raw;
    var base = seed();
    Object.keys(base).forEach(function (k) {
      if (this._db[k] === undefined) this._db[k] = base[k];
    }, this);
    this._loadedAt = stamp;
  }
};

  LocalAdapter.prototype.info = function () {
    return {
      mode: 'local',
      label: 'Local (single browser)',
      shared: false,
      secure: false,
      note: 'Data is saved in this browser only. It is not shared with visitors ' +
            'and it is not protected by a real login. Fine for building the ' +
            'catalogue; not for taking live enquiries.'
    };
  };

  /* --- generic collection access --- */

LocalAdapter.prototype.list = function (coll, opts) {
  this._sync();
  var rows = (this._db[coll] || []).slice();
    opts = opts || {};
    if (opts.where) {
      rows = rows.filter(function (r) {
        return Object.keys(opts.where).every(function (k) { return r[k] === opts.where[k]; });
      });
    }
    if (opts.search && opts.fields) {
      var q = String(opts.search).toLowerCase();
      rows = rows.filter(function (r) {
        return opts.fields.some(function (f) {
          return String(r[f] || '').toLowerCase().indexOf(q) > -1;
        });
      });
    }
    rows.sort(function (a, b) {
      var da = a[opts.sort || 'createdAt'] || '';
      var db = b[opts.sort || 'createdAt'] || '';
      if (da === db) return String(a.name || a.id).localeCompare(String(b.name || b.id));
      return opts.dir === 'asc' ? (da > db ? 1 : -1) : (da < db ? 1 : -1);
    });
    return Promise.resolve(clone(rows));
  };

LocalAdapter.prototype.get = function (coll, id) {
  this._sync();
  var row = (this._db[coll] || []).filter(function (r) { return r.id === id; })[0];
  return Promise.resolve(row ? clone(row) : null);
};

LocalAdapter.prototype.create = function (coll, row) {
  this._sync();
  row = row || {};
    if (!row.id) row.id = uid(coll.slice(0, 4));
    row.createdAt = row.createdAt || nowISO();
    row.updatedAt = nowISO();
    (this._db[coll] = this._db[coll] || []).unshift(row);
    this._persist();
    return Promise.resolve(clone(row));
  };

LocalAdapter.prototype.update = function (coll, id, patch) {
  this._sync();
  var rows = this._db[coll] || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) {
        rows[i] = Object.assign({}, rows[i], patch, { updatedAt: nowISO() });
        this._persist();
        return Promise.resolve(clone(rows[i]));
      }
    }
    return Promise.reject(new Error('Not found: ' + id));
  };

LocalAdapter.prototype.remove = function (coll, id) {
  this._sync();
  var before = (this._db[coll] || []).length;
    this._db[coll] = (this._db[coll] || []).filter(function (r) { return r.id !== id; });
    this._persist();
    return Promise.resolve(before !== this._db[coll].length);
  };

  LocalAdapter.prototype.replaceAll = function (patch) {
    Object.assign(this._db, patch);
    this._persist();
    return Promise.resolve(true);
  };

  /* --- auth (local) --- */

  var LS_SESSION = 'nito_platform_session_v1';
  var LS_USERS = 'nito_platform_users_v1';

  function hash(s) {
    /* FNV-1a. Explicitly a convenience hash, never a security boundary —
       the local adapter is not a security boundary at all, and the admin UI
       says so. Real auth arrives with the cloud adapter. */
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return 'h' + h.toString(16);
  }

  LocalAdapter.prototype._users = function () {
    try { return JSON.parse(localStorage.getItem(LS_USERS) || '[]'); } catch (e) { return []; }
  };

  LocalAdapter.prototype._saveUsers = function (u) {
    localStorage.setItem(LS_USERS, JSON.stringify(u));
  };

  /* How many staff logins exist. login.html uses this to decide whether to
     offer the one-time setup panel at all. */
  LocalAdapter.prototype.hasAccounts = function () {
    return Promise.resolve(this._users().length > 0);
  };

  /* ---------------------------------------------------------------------
     ONE staff account, created once.

     This used to be open registration in which the first account became the
     owner — so anyone who found /login.html could sign up and, on a browser
     with no account yet, take the console. The owner asked for a single staff
     login with no create-account option, so the rule is enforced in two
     places:

       * the login page offers no sign-up whatsoever (see auth-page.js), and
       * this method refuses outright once an account exists — so the rule
         still holds when the UI is bypassed and the call is made directly.

     It still creates the FIRST account, because a console with no account is
     unreachable. That single call is the one-time owner setup, not
     registration; after it succeeds the door closes permanently.
     --------------------------------------------------------------------- */
  LocalAdapter.prototype.signUp = function (email, password, name) {
    email = String(email || '').trim().toLowerCase();
    if (!email || email.indexOf('@') < 1) return Promise.reject(new Error('Enter a valid e-mail address.'));
    if (!password || password.length < 8) return Promise.reject(new Error('Use at least 8 characters.'));

    var users = this._users();
    if (users.length > 0) {
      return Promise.reject(new Error(
        'This console is already set up. Staff access is issued by the owner — ' +
        'there is no self sign-up.'));
    }

    var user = {
      id: uid('usr'), email: email, name: name || email.split('@')[0],
      role: 'owner',
      passwordHash: hash(password),
      createdAt: nowISO()
    };
    users.push(user);
    this._saveUsers(users);
    return this._setSession(user);
  };

  LocalAdapter.prototype.signIn = function (email, password) {
    email = String(email || '').trim().toLowerCase();
    var users = this._users();
    var user = users.filter(function (u) { return u.email === email; })[0];
    if (!user || user.passwordHash !== hash(password)) {
      return Promise.reject(new Error('E-mail or password is not correct.'));
    }
    return this._setSession(user);
  };

  /* ---------------------------------------------------------------------
     session

     The session MUST live in localStorage, not sessionStorage. This was a real
     bug: sessionStorage is scoped to ONE TAB, so an operator who signed in and
     then opened a new tab — or simply restarted the browser — was bounced back
     to the sign-in page even though their account was still on disk. The
     symptom the owner reported was "after creating an account the frontend is
     not enterprise, I cannot see a dashboard or add products": they were
     looking at the login page, not the console.

     localStorage is per-origin and survives tab close and browser restart, so
     the session now persists the way an operator expects a console to. We still
     write a sessionStorage copy: it is the tab-scoped "is this tab currently
     open" hint, and stale entries are harmless because localStorage is the
     authority on read.
     --------------------------------------------------------------------- */

  LocalAdapter.prototype._setSession = function (user) {
    var pub = { id: user.id, email: user.email, name: user.name, role: user.role };
    var raw = JSON.stringify(pub);
    try { localStorage.setItem(LS_SESSION, raw); } catch (e) { /* private mode */ }
    try { sessionStorage.setItem(LS_SESSION, raw); } catch (e) { /* private mode */ }
    return Promise.resolve(pub);
  };

  LocalAdapter.prototype.currentUser = function () {
    var raw = null;
    try { raw = localStorage.getItem(LS_SESSION); } catch (e) { raw = null; }
    /* Absorb a session written by an older build that only knew about
       sessionStorage, so an operator already signed in is not logged out by
       this upgrade. */
    if (!raw) {
      try {
        var legacy = sessionStorage.getItem(LS_SESSION);
        if (legacy) { localStorage.setItem(LS_SESSION, legacy); raw = legacy; }
      } catch (e) { /* ignore */ }
    }
    if (!raw) return Promise.resolve(null);
    try {
      var pub = JSON.parse(raw);
      if (!pub || !pub.email) return Promise.resolve(null);

      /* The account must still exist. If the user list was cleared (or the
         account deleted) the stored session is stale — drop it rather than
         trusting a name that is no longer backed by an account, which would let
         a deleted user keep a console open. */
      var users = this._users();
      var live = users.filter(function (u) { return u.email === pub.email; })[0];
      if (!live) {
        try { localStorage.removeItem(LS_SESSION); } catch (e) {}
        try { sessionStorage.removeItem(LS_SESSION); } catch (e) {}
        return Promise.resolve(null);
      }
      /* Roles can change (owner promotes an editor); the account is the
         authority, not the snapshot taken at sign-in. */
      if (live.role !== pub.role || live.name !== pub.name) {
        pub.role = live.role;
        pub.name = live.name;
        try { localStorage.setItem(LS_SESSION, JSON.stringify(pub)); } catch (e) {}
      }
      return Promise.resolve(pub);
    } catch (e) { return Promise.resolve(null); }
  };

  LocalAdapter.prototype.signOut = function () {
    try { localStorage.removeItem(LS_SESSION); } catch (e) {}
    try { sessionStorage.removeItem(LS_SESSION); } catch (e) {}
    return Promise.resolve(true);
  };

  /* ---------------------------------------------------------------------
     cloud adapter — the hosted backend
     ---------------------------------------------------------------------

     Not enabled until window.NITO_CLOUD_CONFIG exists. Every method below
     delegates to the shared client, so when the backend is provisioned this
     is the only file that changes.
     --------------------------------------------------------------------- */

  function CloudAdapter(client) {
    this.kind = 'cloud';
    this.client = client;
  }

  CloudAdapter.prototype.ready = function () {
    /* The hosted database starts empty; seed it once from the shipped
       catalogue so the admin is never staring at a blank screen.
       Deliberately NO `.catch` here. This used to swallow the failure and
       return `info()`, which reported "Hosted (shared)" for a backend that was
       never reached — the console would look enterprise while every read and
       write silently went nowhere. It must reject so init() can fall back to
       the local store and say why. */
    var db = this.client.database;
    return db.list('products', { limit: 1 }).then(function (rows) {
      if (rows && rows.length) return this.info();
      return db.insert('products', seed().products).then(function () {
        return this.info();
      }.bind(this));
    }.bind(this));
  };

  CloudAdapter.prototype.info = function () {
    return {
      mode: 'cloud',
      label: 'Hosted (shared)',
      shared: true,
      secure: true,
      note: 'Products and enquiries are stored on the hosted backend and shared ' +
            'with every visitor. Accounts are verified server-side.'
    };
  };

  ['list', 'get', 'create', 'update', 'remove'].forEach(function (m) {
    CloudAdapter.prototype[m] = function () {
      return this.client.database[m].apply(this.client.database, arguments);
    };
  });

  CloudAdapter.prototype.replaceAll = function () {
    throw new Error('replaceAll is not available on the hosted backend.');
  };

  CloudAdapter.prototype.hasAccounts = function () {
    /* ASK the backend; do not assume.
       The rule is "a public page must never be able to seed an account into a
       shared deployment" — and that rule is enforced on the SERVER, where
       signUp refuses outright once any account exists. That is the only place
       it can actually be enforced. Assuming `true` here added no security and
       broke a real case: a fresh backend the owner legitimately owns would
       show a sign-in form with no account and no way to make one, which is
       unreachable. On any error, assume it IS set up — the safer failure. */
    var auth = this.client.auth;
    if (!auth || typeof auth.hasAccounts !== 'function') return Promise.resolve(true);
    return Promise.resolve(auth.hasAccounts())['catch'](function () { return true; });
  };
  CloudAdapter.prototype.signUp = function () {
    return this.client.auth.signUp.apply(this.client.auth, arguments);
  };
  CloudAdapter.prototype.signIn = function () {
    return this.client.auth.signIn.apply(this.client.auth, arguments);
  };
  CloudAdapter.prototype.signOut = function () {
    return this.client.auth.signOut.apply(this.client.auth, arguments);
  };
  CloudAdapter.prototype.currentUser = function () {
    return this.client.auth.currentUser.apply(this.client.auth, arguments);
  };

  /* ---------------------------------------------------------------------
     roles — one place that decides who may do what
     --------------------------------------------------------------------- */

  var ROLE_RANK = { owner: 40, admin: 30, editor: 20, viewer: 10 };

  var PERMS = {
    owner:  ['read', 'create', 'update', 'delete', 'publish', 'manageTeam', 'viewAudit', 'manageSettings'],
    admin:  ['read', 'create', 'update', 'delete', 'publish', 'manageTeam', 'viewAudit'],
    editor: ['read', 'create', 'update', 'publish'],
    viewer: ['read']
  };

  function can(user, action) {
    if (!user) return false;
    return (PERMS[user.role] || []).indexOf(action) > -1;
  }

  /* ---------------------------------------------------------------------
     the facade the UI uses
     --------------------------------------------------------------------- */

  var adapter = null;
  var initPromise = null;

  var ROLE_LABEL = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };

  var api = {
    uid: uid,

    /* Boot the platform. Safe to call more than once. */
    init: function () {
      if (initPromise) return initPromise;

      var cfg = global.NITO_CLOUD_CONFIG;
      var wantsCloud = !!(cfg && cfg.endpoint && cfg.publishableKey && global.NitoCloud);

      if (!wantsCloud) {
        adapter = new LocalAdapter();
        initPromise = adapter.ready();
        return initPromise;
      }

      var cloud;
      try {
        cloud = new CloudAdapter(buildCloudClient(cfg));
      } catch (e) {
        adapter = new LocalAdapter();
        adapter.bootError = e.message;
        initPromise = adapter.ready();
        return initPromise;
      }

      /* A configured backend that does not answer must NOT be reported as
         "Hosted (shared)". Probe it once and fall back to the local store,
         keeping the reason so the console can print it. `adapter` is set
         synchronously so anything reading mode() mid-boot sees a real object,
         and is swapped for the local store only if the probe fails. */
      adapter = cloud;
      initPromise = cloud.ready().then(function (info) {
        return info;
      })['catch'](function (err) {
        adapter = new LocalAdapter();
        adapter.bootError = 'No backend answered at ' + cfg.endpoint + ' — ' +
          (err && err.message ? err.message : 'request failed') +
          '. Falling back to the local store.';
        return adapter.ready();
      });
      return initPromise;
    },

    mode: function () {
      return adapter ? adapter.info() : { mode: 'none', label: 'Not started', shared: false, secure: false, note: '' };
    },

    isCloud: function () { return !!adapter && adapter.kind === 'cloud'; },

    /* --- generic collections --- */
    list:  function (c, o) { return adapter.list(c, o); },
    get:   function (c, i) { return adapter.get(c, i); },
    create: function (c, r) { return adapter.create(c, r); },
    update: function (c, i, p) { return adapter.update(c, i, p); },
    remove: function (c, i) { return adapter.remove(c, i); },
    replaceAll: function (p) { return adapter.replaceAll(p); },

    /* --- auth --- */
    hasAccounts: function () { return adapter.hasAccounts(); },
    signUp: function (e, p, n) { return adapter.signUp(e, p, n); },
    signIn: function (e, p) { return adapter.signIn(e, p); },
    signOut: function () { return adapter.signOut(); },
    currentUser: function () { return adapter.currentUser(); },

    /* --- permissions --- */
    can: can,
    roleLabel: function (r) { return ROLE_LABEL[r] || r || '—'; },
    roleRank: function (r) { return ROLE_RANK[r] || 0; },

    /* --- audit --- */
    log: function (user, action, entity, entityId, detail) {
      return adapter.create('audit', {
        actor: user ? user.email : 'system',
        actorName: user ? user.name : 'System',
        actorRole: user ? user.role : '',
        action: action,
        entity: entity,
        entityId: entityId || '',
        detail: detail || '',
        at: nowISO()
      }).catch(function () { /* audit must never break a write */ });
    },

    /* --- product helpers --- */
    nextCode: nextCode,

    /* Reset the local store back to the shipped catalogue. Deliberately
       explicit and loud; never called automatically. */
    resetLocal: function () {
      if (!adapter || adapter.kind !== 'local') {
        return Promise.reject(new Error('Only available on the local store.'));
      }
      adapter._db = seed();
      adapter._persist();
      return Promise.resolve(true);
    },

    /* Export the whole dataset — used by the admin backup button. */
    exportAll: function () {
      if (!adapter || adapter.kind !== 'local') return Promise.resolve(null);
      return Promise.resolve(clone(adapter._db));
    },

    /* Import a previously exported dataset. */
    importAll: function (data) {
      if (!adapter || adapter.kind !== 'local') {
        return Promise.reject(new Error('Only available on the local store.'));
      }
      if (!data || !Array.isArray(data.products)) {
        return Promise.reject(new Error('That file is not a valid NITO backup.'));
      }
      adapter._db = Object.assign(seed(), data);
      adapter._persist();
      return Promise.resolve(true);
    }
  };

  /* Built lazily so a missing SDK cannot break the local path. */
  function buildCloudClient(cfg) {
    var mk = global.NitoCloud && global.NitoCloud.createNitoCloud;
    if (!mk) throw new Error('Cloud SDK not loaded');
    var cloud = mk({
      endpoint: cfg.endpoint,
      oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
      publishableKey: cfg.publishableKey
    });
    return cloud;
  }

  global.NitoPlatform = api;

})(window);
