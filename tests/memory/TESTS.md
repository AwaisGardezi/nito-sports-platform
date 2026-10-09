# NITO SPORTS — test reference & discipline

Companion to `MEMORY.md`. The authoritative suite list lives in `tests/run-tests.sh` (its
`NAMES`/`FILES` arrays) — if this file and that script disagree, the script wins.

## Running
**`bash tests/run-tests.sh`** — starts a static server on :8099 itself, runs all suites, prints
a summary, exits non-zero on any failure. **Sixteen suites, 16/16 pass in ~7m.**

`local-backend-test.js` is self-contained: it spawns `tools/server.js` on :8842 against a **throwaway
database** (`--data` in the temp dir), so it neither needs nor touches the :8099 server or the owner's
`data/platform-db.json`.

`run-tests.sh` prints the **failing lines** and writes `tests/test-logs/<suite>.log` on failure —
the old `tail -n 5` showed only "FAILURES: 2", never which check or why.

## The suites
| Suite | Checks | Proves |
| ----- | -----: | ------ |
| `smoke-test.js` | — | 12 page/URL combos, dynamic regions render, no console errors (jsdom) |
| `enquiry-test.js` | — | every enquiry field reaches WhatsApp with an `NTO-YYMMDD-NNNN` ref |
| `admin-test.js` | — | console: signed-out bounce, setup gate, owner role, weak password refused, CRUD, persist, delete-with-confirm |
| `export-test.js` | — | `#pPublish` → `catalog.js` round-trips (5 cats / 55 products / 0 missing / 0 prices / bookkeeping stripped) |
| `add-product-test.js` | — | console → publish → live site end to end (55→56) |
| `logo-check.js` | — | real artwork in header/footer/drawer/login gate, console `<h1>` is `.sr-only`, zero 404s |
| `console-test.js` | 103 | jsdom: login → session survives a NEW TAB → dashboard → add product → publish → enquiry inbox → audit → viewer refused → sign-out |
| `live-data-test.js` | 14 | inert on local; active on shared; drafts held back in data AND DOM; owner phone + payment methods survive |
| `console-ui-test.js` | 45 | puppeteer: 8 screens × no oversized icon / no overflow / content rendered; row collisions; density caps |
| `product-images-test.js` | 24 | real file input → preview; bytes outside the dataset; export inlines the photo and leaks no `nito-media:` ref |
| `enquiry-pipeline-test.js` | 26 | capture before WhatsApp; blocked popup still records; email honest on 4xx; failed import keeps the lead; CSV has no formula cell |
| `staff-login-test.js` | 25 | no create-account affordance; setup offered once; a second account refused even when `signUp` is called directly; the local-adapter limit asserted, not hidden |
| `local-backend-test.js` | 33 | puppeteer + fetch, own server + throwaway DB: API seeds 55; server-side auth incl. a **second sign-up 403** and no hash leak; durability (row really in the file, hash not plain text); the bridge ARMS and a new line renders on `products.html`; the console signs in and reports `cloud`; **honesty** — with `/api/` aborted it falls back to `local`, does NOT claim shared, and the static catalogue still serves |
| `layout-guard.js` | — | no horizontal overflow, 9 pages × 6 widths |
| `sticky-scroll-test.js` | — | nav + sidebar stick, reveals still fire |
| `a11y-audit.js` | 0/0 | alt text, labels, names, dup ids, heading order, landmarks |

## Discipline (all earned)
**Functional tests do not cover geometry.** Every functional suite passed while the team page rendered
metre-tall icons. `console-ui-test.js` exists because "it works" and "it looks broken" are different
failures — when the owner says something is "not cool", look for the geometry bug first.

**A guard must be proved able to fail.** Sabotage the code, watch the *right* check go red, restore.
Earned its keep repeatedly:
- breaking the *grid's* `NitoMedia.resolve()` turned **nothing** red (the exported file holds a plain
  `data:` URL, so every consumer worked by accident) → `product-images-test.js` gained a
  `nito-media:`-ref check and the re-sabotage went **9 red**;
- removing enquiry capture → **18 red**;
- discarding leads on a failed import → **1 red**;
- disabling the console drain → **4 red**;
- restoring multi-account sign-up → exactly **2 red**;
- backend suite: restoring `CloudAdapter.ready()`'s swallowed `.catch` → **3 red** (reports `cloud`
  while unreachable); removing the server's second-signup 403 → **1 red**; making `publicUser()` return
  the raw record → **1 red**.

**Test suites hand-maintain their own script lists, and they drift from the real HTML.** Bitten three
times: `smoke-test.js`'s `SCRIPTS` missing `live-data.js` then `media.js`, and `console-test.js`'s
`CONSOLE_SCRIPTS` missing `media.js` then `enquiries.js` — so those suites silently exercised a page the
browser never builds. **Whenever a module is added to an HTML page, grep the suites for their literal
script arrays.**

**Assert on the artefact that carries the value.** A product name lives in `.pcard`'s `data-name`
**attribute** — `body.textContent` does not contain it, so a draft can render while a textContent check
still passes. Same class of error:
- the density cap lives on `#view`'s *children*, not `#view`;
- asserting a new product on `index.html` tests the wrong surface entirely — `#featuredRail` is a
  **hardcoded id list**, so the page that lists the catalogue is `products.html`.

**Any suite that swaps `catalog.js` must restore it.** Verify `md5sum` against
`tests/catalog.original.js` — expected **`0499888d…`** (it changed from `b53176fd…` on
2026-10-09 when the payment `logo` field was added). `add-product-test.js` snapshots and restores on
`process.on('exit')`/`SIGINT`.
