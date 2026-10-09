/* ==========================================================================
   NITO SPORTS — Platform admin shell
   --------------------------------------------------------------------------
   Owns: boot/auth guard, sidebar + topbar, client-side routing between admin
   pages, permission gating, toasts, modals, and the shared render helpers
   every page module uses.

   Every page module registers itself on window.NitoAdmin.pages and is called
   as render(root, ctx). Nothing here talks to storage directly — it all goes
   through window.NitoPlatform.
   ========================================================================== */

(function (global) {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, cls) {
    var P = {
      dash:    '<path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z"/>',
      box:     '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
      mail:    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/>',
      users:   '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
      shield:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      list:    '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      gear:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2a2 2 0 010-4h.1A1.7 1.7 0 003.6 8a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H8a1.7 1.7 0 001-1.5V2a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V8a1.7 1.7 0 001.5 1H22a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
      plus:    '<path d="M12 5v14M5 12h14"/>',
      search:  '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
      edit:    '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>',
      trash:   '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>',
      copy:    '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
      x:       '<path d="M18 6L6 18M6 6l12 12"/>',
      check:   '<path d="M20 6L9 17l-5-5"/>',
      warn:    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
      info:    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
      out:     '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
      slide:   '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
      down:    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
      caretUp: '<path d="M18 15l-6-6-6 6"/>',
      caretDn: '<path d="M6 9l6 6 6-6"/>',
      up:      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
      ext:     '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/>',
      burger:  '<path d="M3 6h18M3 12h18M3 18h18"/>',
      globe:   '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') + '>' +
      (P[name] || P.info) + '</svg>';
  }

  /* `max` caps the content width for pages that are usually near-empty, so they
     read as a composed column rather than a card lost in dead space. Pages that
     carry a real table (dashboard, products, team) are deliberately left
     uncapped — capping them would just squash useful data. */
  var ROUTES = [
    { id: 'dashboard', label: 'Dashboard',  icon: 'dash',   group: 'Overview', perm: 'read' },
    { id: 'products',  label: 'Products',   icon: 'box',    group: 'Catalogue', perm: 'read' },
    { id: 'categories',label: 'Categories', icon: 'list',   group: 'Catalogue', perm: 'read', max: '1100px' },
    { id: 'enquiries', label: 'Enquiries',  icon: 'mail',   group: 'Customers', perm: 'read', badge: 'newEnquiries', max: '1100px' },
    { id: 'customers', label: 'Customers',  icon: 'users',  group: 'Customers', perm: 'read', max: '1100px' },
    { id: 'team',      label: 'Team',       icon: 'shield', group: 'Administration', perm: 'manageTeam' },
    { id: 'audit',     label: 'Audit log',  icon: 'list',   group: 'Administration', perm: 'viewAudit', max: '1180px' },
    { id: 'settings',  label: 'Settings',   icon: 'gear',   group: 'Administration', perm: 'read', max: '1180px' }
  ];

  var state = {
    user: null,
    route: 'dashboard',
    counts: {}
  };

  var pages = {};

  /* ---------- toast / modal ------------------------------------------------ */

  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('#toast');
    if (!el) return;
    el.className = 'toast is-on ' + (kind === 'err' ? 'toast--err' : 'toast--ok');
    el.innerHTML = icon(kind === 'err' ? 'warn' : 'check') + '<span>' + esc(msg) + '</span>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 3000);
  }

  var confirmCb = null;
  function confirmDialog(opts) {
    var m = $('#modal');
    $('#modalTitle').textContent = opts.title || 'Are you sure?';
    $('#modalBody').innerHTML = opts.body || '';
    $('#modalOk').textContent = opts.ok || 'Confirm';
    $('#modalOk').className = 'btn btn--sm ' + (opts.danger ? 'btn--danger' : 'btn--primary');
    $('#modalCancel').textContent = opts.cancel || 'Cancel';
    confirmCb = opts.onOk;
    m.classList.add('is-on');
  }

  /* ---------- routing ----------------------------------------------------- */

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { route: parts[0] || 'dashboard', id: parts[1] || '' };
  }

  /* Mirrors parseHash for assignment. Reading back what the browser actually
     accepted is unreliable here: during a same-document fragment navigation
     `location.hash` can still return the OLD value, so writing the target and
     then re-reading it (as an earlier version did) silently kept the previous
     route. Holding our own copy removes that whole class of bug. */
  var lastRoute = '';

  function routeTo(route, id) {
    var path = '#/' + route + (id ? '/' + id : '');
    lastRoute = path;
    location.hash = path;
  }

  function allowedRoutes() {
    return ROUTES.filter(function (r) {
      return global.NitoPlatform.can(state.user, r.perm);
    });
  }

  function drawSide() {
    var nav = $('#sideNav');
    if (!nav) return;
    var allow = allowedRoutes();
    var groups = [];
    allow.forEach(function (r) {
      var g = groups.filter(function (x) { return x.name === r.group; })[0];
      if (!g) { g = { name: r.group, items: [] }; groups.push(g); }
      g.items.push(r);
    });

    nav.innerHTML = groups.map(function (g) {
      return '<div class="side__grp">' + esc(g.name) + '</div>' +
        g.items.map(function (r) {
          var n = r.badge ? state.counts[r.badge] : 0;
          return '<a class="side__link' + (state.route === r.id ? ' is-on' : '') + '" href="#/' + r.id + '">' +
            icon(r.icon) + '<span>' + esc(r.label) + '</span>' +
            (n ? '<span class="side__badge">' + n + '</span>' : '') +
          '</a>';
        }).join('');
    }).join('');

    var u = state.user || {};
    var initials = (u.name || u.email || '?').trim().slice(0, 1).toUpperCase();
    $('#sideFoot').innerHTML =
      '<div class="side__user">' +
        '<div class="side__avatar">' + esc(initials) + '</div>' +
        '<div class="side__meta">' +
          '<div class="side__name">' + esc(u.name || 'Signed in') + '</div>' +
          '<div class="side__role">' + esc(global.NitoPlatform.roleLabel(u.role)) + '</div>' +
        '</div>' +
        '<button class="side__out" id="sideOut" title="Sign out" aria-label="Sign out">' + icon('out') + '</button>' +
      '</div>';
    var so = $('#sideOut');
    if (so) so.addEventListener('click', signOut);

    /* Drive navigation ourselves rather than relying on the browser turning
       an <a href="#/x"> into a hashchange. The links keep their hrefs so they
       are real, middle-clickable links; the click handler just makes the
       route change synchronous and host-independent. */
    $$('.side__link', nav).forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        goRoute(a.getAttribute('href'));
      });
    });
  }

  /* Set the route from a '#/route/id' string. */
  function goRoute(href) {
    var path = String(href || '').replace(/^#/, '');
    if (!path) return;
    lastRoute = '#' + path;
    state.route = parseHashFrom(path).route;
    try { location.hash = lastRoute; } catch (e) { /* keep our own copy */ }
    render();
    closeSide();
  }

  function parseHashFrom(path) {
    var parts = String(path || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { route: parts[0] || 'dashboard', id: parts[1] || '' };
  }

  function drawTop() {
    var r = ROUTES.filter(function (x) { return x.id === state.route; })[0] || ROUTES[0];
    $('#topTitle').textContent = r.label;
    var sub = $('#topSub');
    if (sub) sub.textContent = topSubtitle();
  }

  function topSubtitle() {
    var mode = global.NitoPlatform.mode();
    if (state.route === 'dashboard') {
      return mode.shared ? 'Live catalogue, shared with visitors' : 'Local draft catalogue';
    }
    return mode.label;
  }

  function render() {
    var host = $('#view');
    if (!host) return;
    var r = ROUTES.filter(function (x) { return x.id === state.route; })[0];
    if (!r) { routeTo('dashboard'); return; }
    if (!global.NitoPlatform.can(state.user, r.perm)) {
      host.innerHTML = '<div class="empty">' + icon('shield') +
        '<b>Not available on your account</b>' +
        '<span>Your role (' + esc(global.NitoPlatform.roleLabel(state.user.role)) +
        ') does not include access to this section.</span>' +
        '<a class="btn btn--ghost btn--sm" href="#/dashboard">Back to dashboard</a></div>';
      return;
    }
    var page = pages[r.id];
    if (!page) {
      host.innerHTML = '<div class="empty">' + icon('info') + '<b>' + esc(r.label) +
        '</b><span>This section is still being built.</span></div>';
      return;
    }
    /* Hold a low-content page to a comfortable measure instead of letting one
       card float in a 1350px void. Declared here, next to the route's own
       permission, so a new route cannot forget it. Dense pages keep the full
       width. See the "SPARSE-PAGE DENSITY" block in app.css. */
    host.style.removeProperty('--content-max');
    if (r.max) host.style.setProperty('--content-max', r.max);
    drawSide();
    drawTop();
    /* A page module that throws must not leave a blank screen with no
       explanation — that reads as "the console is broken". */
    try {
      page.render(host, ctx());
    } catch (err) {
      host.innerHTML = '<div class="empty">' + icon('warn') +
        '<b>This screen could not be drawn</b><span>' +
        esc(err && err.message || 'Unknown error') + '</span>' +
        '<a class="btn btn--ghost btn--sm" href="#/dashboard">Back to dashboard</a></div>';
    }
  }

  function ctx() {
    return { user: state.user, state: state, route: state.route, id: parseHash().id };
  }

  function onHash() {
    var parsed = parseHash();
    state.route = parsed.route;
    render();
    closeSide();
  }

  /* The browser may fire no hashchange at all for a fragment navigation in
     some hosts. Polling the real value is what keeps deep links and the back
     button working everywhere, without trusting a single event. */
  function watchHash() {
    var last = location.hash;
    setInterval(function () {
      if (location.hash !== last) {
        last = location.hash;
        onHash();
      }
    }, 120);
  }

  /* ---------- refresh shared counts (sidebar badges) ----------------------- */

  function refreshCounts() {
    return global.NitoPlatform.list('enquiries').then(function (rows) {
      var newOnes = rows.filter(function (e) { return (e.status || 'new') === 'new'; }).length;
      state.counts.newEnquiries = newOnes;
      state.newEnquiries = newOnes;
      drawSide();
    }).catch(function () { /* counts are cosmetic */ });
  }

  /* Enquiries left by the public contact form sit in an append-only queue in
     localStorage (see assets/js/enquiries.js for why). This is where they
     become console records.

     It runs before the shell paints so the very first view of the inbox is
     complete, and it hands `NitoEnquiries` a writer rather than letting the
     public page touch the console's own dataset. A lead that fails to import
     stays in the queue, so a transient error cannot destroy it. */
  function drainEnquiryQueue() {
    var E = global.NitoEnquiries;
    if (!E || typeof E.drain !== 'function') return Promise.resolve({ moved: 0, failed: 0 });
    var P = global.NitoPlatform;
    if (!P) return Promise.resolve({ moved: 0, failed: 0 });

    return E.drain(function (enq) {
      /* Already imported on an earlier visit, or the console already holds this
         reference: treat it as done rather than creating a second lead. */
      if (E.isDrained && E.isDrained(enq)) return Promise.resolve();
      return P.list('enquiries').then(function (rows) {
        var dupe = rows.some(function (r) {
          return (enq.ref && r.ref === enq.ref) || (enq.id && r.id === enq.id);
        });
        if (dupe) return Promise.resolve();
        return P.create('enquiries', enq).then(function () {
          /* Only audit real arrivals. The audit log is a record of what the
             operator's team did, and flooding it with imports would bury the
             actual work. */
          return P.log(state.user, 'create', 'enquiry', enq.ref || enq.id,
            'Enquiry received from the website: ' + (enq.name || 'unknown buyer'));
        });
      });
    }).then(function (res) {
      if (res.moved && state.counts) {
        state.pendingEnquiries = 0;
      }
      return res;
    })['catch'](function () { return { moved: 0, failed: 0 }; });
  }

  /* How many leads are sitting in the queue waiting to be imported. Shown as a
     badge so an operator who arrives after a quiet week still sees that leads
     are there, rather than an empty inbox and no explanation. */
  function pendingEnquiries() {
    var E = global.NitoEnquiries;
    try { return E && E.pendingCount ? E.pendingCount() : 0; } catch (e) { return 0; }
  }

  /* Enquiries arrive while someone is working. Poll so the badge reflects
     reality rather than whatever was true when the tab was opened, and so a
     second tab's enquiry shows up here too. */
  function pollCounts() {
    return drainEnquiryQueue().then(refreshCounts);
  }

  var countTimer = setInterval(pollCounts, 15000);
  if (countTimer && countTimer.unref) countTimer.unref();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) pollCounts();
  });
  /* Another tab writing the store fires `storage` in this one. That is the
     fastest honest signal that a buyer just submitted the contact form. */
  global.addEventListener('storage', function (ev) {
    if (!ev || !ev.key) return;
    if (ev.key === 'nito_enquiry_queue_v1') pollCounts();
  });

  /* ---------- mobile sidebar ---------------------------------------------- */

  function openSide() {
    $('#side').classList.add('is-open');
    $('#sideScrim').classList.add('is-on');
  }
  function closeSide() {
    var s = $('#side'), sc = $('#sideScrim');
    if (s) s.classList.remove('is-open');
    if (sc) sc.classList.remove('is-on');
  }

  /* ---------- auth --------------------------------------------------------- */

  function signOut() {
    var platform = global.NitoPlatform;
    /* Leave the console first. Waiting on the sign-out call before navigating
       means a backend hiccup strands the user inside a console they have
       already asked to leave. */
    platform.signOut().catch(function () { /* nothing to do about it now */ })
      .then(function () { location.href = 'login.html'; });
  }

  function showShell() {
    $('#boot').hidden = true;
    $('#shell').hidden = false;
    drawSide();
    drawTop();
    render();
    /* Drain BEFORE the first count so the inbox and the sidebar badge are
       already correct on the operator's first look — a badge that fills in a
       moment later reads as a glitch. */
    drainEnquiryQueue().then(refreshCounts, refreshCounts);
  }

  /* Shown if the redirect to the sign-in page has not taken effect. A blank
     page or a spinner that never stops is the worst possible outcome here:
     the visitor cannot tell whether the site is broken or they are simply
     signed out. Always leave them something they can click. */
  function showSignedOut() {
    var boot = $('#boot');
    if (!boot) return;
    boot.hidden = false;
    boot.innerHTML = '<div class="empty">' + icon('shield') +
      '<b>Please sign in</b>' +
      '<span>This console is for NITO SPORTS staff. You are not signed in on this browser.</span>' +
      '<a class="btn btn--primary btn--sm" href="login.html">Go to sign in</a></div>';
  }

  function requireAuth() {
    return global.NitoPlatform.currentUser().then(function (u) {
      if (!u) {
        var next = encodeURIComponent(location.hash || '#/dashboard');
        location.replace('login.html?next=' + next);
        /* Stop the chain here. A redirect is not a rejection — returning null
           lets the caller sit quietly while the browser navigates, instead of
           trying to render a shell the visitor is not allowed to see. */
        return null;
      }
      state.user = u;
      return u;
    });
  }

  /* ---------- boot --------------------------------------------------------- */

  function boot() {
    var platform = global.NitoPlatform;

    platform.init().then(function () {
      return requireAuth();
    }).then(function (u) {
      if (!u) {
        /* The redirect is in flight. Give it a moment to land, then make sure
           the visitor is never left on a spinner with no way forward. */
        setTimeout(showSignedOut, 1200);
        return;
      }
      showShell();

      $('#topBurger').addEventListener('click', openSide);
      $('#sideScrim').addEventListener('click', closeSide);

      $('#topLogout').addEventListener('click', signOut);
      $('#topSite').setAttribute('href', 'index.html');

      window.addEventListener('hashchange', onHash);
      if (!location.hash) location.replace('#/dashboard');
      else state.route = parseHash().route;
      watchHash();

      $('#modalCancel').addEventListener('click', function () {
        confirmCb = null;
        $('#modal').classList.remove('is-on');
      });
      $('#modalOk').addEventListener('click', function () {
        var cb = confirmCb;
        confirmCb = null;
        $('#modal').classList.remove('is-on');
        if (cb) cb();
      });
      $('#modal').addEventListener('click', function (e) {
        if (e.target === this) { confirmCb = null; this.classList.remove('is-on'); }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var d = $('#drawer');
          if (d && d.classList.contains('is-on')) closeDrawer();
          $('#modal').classList.remove('is-on');
        }
      });
    }).catch(function (err) {
      $('#boot').innerHTML = '<div class="empty">' + icon('warn') +
        '<b>Could not start the admin</b><span>' + esc(err && err.message || 'Unknown error') + '</span>' +
        '<a class="btn btn--ghost btn--sm" href="login.html">Back to sign in</a></div>';
    });
  }

  /* ---------- drawer helper (shared by product + enquiry editors) --------- */

  function openDrawer(title, bodyHTML, footHTML) {
    var d = $('#drawer');
    $('#drawerTitle').textContent = title;
    $('#drawerBody').innerHTML = bodyHTML;
    $('#drawerFoot').innerHTML = footHTML || '';
    d.classList.add('is-on');
    var first = $('#drawerBody .input, #drawerBody .select, #drawerBody .textarea');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function closeDrawer() {
    $('#drawer').classList.remove('is-on');
    $('#drawerBody').innerHTML = '';
    $('#drawerFoot').innerHTML = '';
    document.dispatchEvent(new CustomEvent('nito:drawer-closed'));
  }

  /* ---------- shared render helpers --------------------------------------- */

  var fmt = {
    date: function (iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    },
    dateTime: function (iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      if (isNaN(d)) return '—';
      return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    },
    rel: function (iso) {
      if (!iso) return '—';
      var diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (isNaN(diff)) return '—';
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
      return fmt.date(iso);
    },
    num: function (n) { return (n == null ? 0 : n).toLocaleString(); }
  };

  function initials(s) {
    return String(s || '?').trim().split(/\s+/).map(function (w) { return w[0]; })
      .slice(0, 2).join('').toUpperCase();
  }

  /* ---------- export ------------------------------------------------------ */

  global.NitoAdmin = {
    $: $, $$: $$, esc: esc, icon: icon, fmt: fmt, initials: initials,
    pages: pages,
    toast: toast,
    confirm: confirmDialog,
    routeTo: routeTo,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    refreshCounts: refreshCounts,
    drainEnquiries: drainEnquiryQueue,
    pendingEnquiries: pendingEnquiries,
    rerender: render,
    get user() { return state.user; },
    get state() { return state; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
