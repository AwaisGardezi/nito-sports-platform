/* ==========================================================================
   NITO SPORTS — Public enquiry capture
   --------------------------------------------------------------------------
   WHY THIS EXISTS

   The contact form used to have exactly one outcome: it opened WhatsApp. If the
   buyer's browser blocked the popup, if the number was wrong, or if they simply
   closed the tab without pressing send, the enquiry evaporated. Nothing was
   recorded anywhere. From the operator's side the console inbox said "No
   enquiries yet" forever, which reads as "the website is broken" rather than
   "someone changed their mind".

   A lead is the single most valuable thing this website produces. Losing one
   silently is the most expensive bug on the site, so this module records every
   submission locally FIRST and treats WhatsApp and e-mail as the delivery
   channels layered on top. Recording cannot fail because of a popup blocker.

   WHY A QUEUE AND NOT A DIRECT WRITE

   The public pages and the console are separate documents. On the local adapter
   the console is not necessarily open when a buyer submits, and the cloud
   adapter is not bound yet. So the public page writes to its own append-only
   key (`nito_enquiry_queue_v1`) which the console drains on boot.

   Why not write straight into `nito_platform_v1`? Two reasons, both real:
     1. The console owns that key. `LocalAdapter._sync()` re-reads it before
        every write, so a public-page write racing a console write can lose one
        of the two. An append-only queue that only ever `push`es cannot clobber.
     2. Quota. `_persist()` throws on a full store, and a throw here would lose
        the lead. The queue write is wrapped and reports honestly instead.
   The console moves each queued enquiry into the real enquiries collection and
   clears the entry, so there is exactly one copy after the drain.

   HONESTY RULES

   - `channels()` reports what actually fired, not what was configured. The
     buyer is told the truth about whether WhatsApp opened.
   - The e-mail post is attempted, and its real outcome recorded, rather than
     being swallowed by a bare `.catch(function () {})`.
   - Nothing here ever throws into the form handler. A lead must still be
     recorded even if every delivery channel fails.
   ========================================================================== */
(function (global) {
  'use strict';

  var QUEUE_KEY = 'nito_enquiry_queue_v1';
  var DRAIN_KEY = 'nito_enquiry_drained_v1';

  /* Deduplicate on the reference, not on the payload: the same buyer fixing a
     typo and resubmitting is one enquiry, but two buyers with identical
     details are two. The form already keeps one ref per submission attempt. */
  function read() {
    try {
      var raw = global.localStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function write(arr) {
    try {
      global.localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      /* Quota, or private mode with storage disabled. Caller reports it. */
      return false;
    }
  }

  /* Append one enquiry. Returns {ok, duplicate, count}. Never throws. */
  function record(enq) {
    if (!enq || typeof enq !== 'object') return { ok: false, duplicate: false, count: read().length };
    var arr = read();

    if (enq.ref) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].ref === enq.ref) {
          /* Same reference re-submitted (a double-click, or the buyer pressing
             Submit again after backing out). Update in place rather than
             queueing a second lead for one request. */
          arr[i] = Object.assign({}, arr[i], enq, { capturedAt: arr[i].capturedAt || nowISO() });
          write(arr);
          return { ok: true, duplicate: true, count: arr.length };
        }
      }
    }

    arr.push(Object.assign({}, enq, {
      capturedAt: enq.capturedAt || nowISO(),
      id: enq.id || ('enq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7))
    }));

    var ok = write(arr);
    return { ok: ok, duplicate: false, count: arr.length };
  }

  /* Read without consuming — the console uses this to show a pending count
     before it drains, so the operator can see that something arrived. */
  function pending() { return read(); }

  function pendingCount() { return read().length; }

  /* The console takes ownership of everything queued. Called with a writer
     function so this module never needs to know how the console stores things.
     Only entries that were written successfully are removed — a failed write
     must leave the lead in the queue rather than destroying it. */
  function drain(putOne) {
    if (typeof putOne !== 'function') return Promise.resolve({ moved: 0, failed: 0 });
    var arr = read();
    if (!arr.length) return Promise.resolve({ moved: 0, failed: 0 });

    var moved = 0, failed = 0;
    var remaining = [];

    return arr.reduce(function (chain, enq) {
      return chain.then(function () {
        return Promise.resolve(putOne(enq)).then(function () {
          moved++;
          markDrained(enq);
        })['catch'](function () {
          failed++;
          remaining.push(enq);   /* keep it — never lose a lead to a write error */
        });
      });
    }, Promise.resolve()).then(function () {
      write(remaining);
      return { moved: moved, failed: failed };
    });
  }

  /* A small record of what the console has already imported. Protects against
     re-importing a lead if the queue write of `remaining` itself failed. */
  function markDrained(enq) {
    try {
      var ids = JSON.parse(global.localStorage.getItem(DRAIN_KEY) || '[]');
      if (!Array.isArray(ids)) ids = [];
      ids.push(enq.ref || enq.id);
      /* Keep it bounded — this is a guard, not a log. */
      if (ids.length > 500) ids = ids.slice(-500);
      global.localStorage.setItem(DRAIN_KEY, JSON.stringify(ids));
    } catch (e) { /* best effort */ }
  }

  function isDrained(enq) {
    try {
      var ids = JSON.parse(global.localStorage.getItem(DRAIN_KEY) || '[]');
      return Array.isArray(ids) && ids.indexOf(enq.ref || enq.id) > -1;
    } catch (e) { return false; }
  }

  function clear() { write([]); }

  function nowISO() { return new Date().toISOString(); }

  /* ------------------------------------------------------------ delivery */

  /* Post the enquiry to a form endpoint (Web3Forms and compatible). The result
     is reported, not swallowed: the operator needs to know whether the e-mail
     actually left, and the previous bare catch hid every failure. */
  function email(enq, endpoint, timeoutMs) {
    if (!endpoint) return Promise.resolve({ ok: false, reason: 'not-configured' });
    if (!global.fetch) return Promise.resolve({ ok: false, reason: 'unsupported' });

    var key = String(endpoint).split('/').pop();
    var ctrl = global.AbortController ? new global.AbortController() : null;
    var timer = ctrl ? global.setTimeout(function () { ctrl.abort(); }, timeoutMs || 12000) : null;

    return global.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify(Object.assign({ access_key: key, subject: enq.subject || enq.ref }, enq))
    }).then(function (r) {
      if (timer) global.clearTimeout(timer);
      /* A 4xx/5xx is a failure even though fetch resolved — treating it as
         success is how "the form works" becomes "we never received anything". */
      if (!r.ok) return { ok: false, reason: 'http-' + r.status };
      return { ok: true };
    })['catch'](function (err) {
      if (timer) global.clearTimeout(timer);
      return { ok: false, reason: (err && err.name === 'AbortError') ? 'timeout' : 'network' };
    });
  }

  var api = {
    QUEUE_KEY: QUEUE_KEY,
    record: record,
    pending: pending,
    pendingCount: pendingCount,
    drain: drain,
    isDrained: isDrained,
    clear: clear,
    email: email
  };

  global.NitoEnquiries = api;
})(typeof window !== 'undefined' ? window : this);
