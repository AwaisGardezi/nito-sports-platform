# NITO SPORTS — project memory

Enterprise B2B manufacturer/exporter site + admin console for **NITO SPORTS**, Sialkot, Pakistan.
Built for Awais (for Hassnain, BZU). Workspace: `C:/Users/PcR/OneDrive/Desktop/Sports Platform`.

**Companions — read on demand, not by default:**
- `GOTCHAS.md` — the CSS / layout / JS / automation trap catalogue. **Read before touching layout, CSS,
  icons, the fixed-float bands or the test harnesses.**
- `TESTS.md` — suite list, check counts and test discipline. **Read before adding or editing a suite.**
- `YYYY-MM-DD.md` — append-only daily work log.

## Brief rules (non-negotiable)
- **No public retail prices** — B2B quote-only; show MOQ / fabric / lead time.
- **No fake trust signals** — no invented certificates, client logos, reviews or numbers. Credential
  slots are honest placeholders the owner fills or deletes.
- **No cheap stock/AI imagery.** Product art is a hand-built SVG flat library (`assets/js/flats.js`,
  24 shapes). Only ONE supplied photo is used (`factory-showroom.jpg`, portrait 1200×1600 in a 21:8
  hero slot → `object-position:center 72%`).
- **`team-kit-1.jpg` must NOT be published** — identifiable children in a youth team plus a
  third-party club's branding and phone number. Safeguarding + rights risk. File stays on disk; do not
  re-add without a model release and the club's permission.
- **Never copy the reference site** (`shazamindustries.com`) — structure/features only, never markup,
  copy or photos.
- **Exact counts**: 5 divisions, 55 product lines, 6 core export markets, MOQ from 30 pcs. The
  homepage stats band must match the real catalogue.
- **Third-party marks are the issuing body's own real artwork** — fetched from source, never redrawn,
  never lifted from a screenshot. Record the source of every file.

## Design
**Public site** — light + gold: `--gold:#f9b20a` · `--dark:#0e0d0d` · `--dark-2:#131313` (footer) ·
`--bg-2:#e8e8e8` · `--t1:#0e0d0d` · container 1170px · PT Sans body + Poppins headings.
**Console** — dark navy + blue `#1b8ec4`, its own `:root` block in `app.css`.

## Architecture
Plain HTML + CSS + vanilla JS (ES5 IIFE). **No framework, no build step.** Hosting target:
Cloudflare Pages.
- `catalog.js` — single source of truth: `NITO_SITE`, `NITO_PAYMENTS`, `NITO_CATALOG` (5 categories,
  55 products, `NTO-1001`…`NTO-5007`). Must stay byte-identical to `tests/catalog.original.js`
  (md5 `0499888d…`).
- `site.js` — all public rendering. `subOf()` scores word matches against `category.items` (override
  via `NITO_SUBCAT_OVERRIDES`); `renderProductGrid()` = `PAGE_SIZE 12` + sidebar tree + pager + URL
  sync (`?cat= ?sub= ?q=`), **on `products.html` only**. `renderFeaturedRail()` is a **hardcoded id
  list** on `index.html` — a new line can never appear there.
- `basket.js` — quote list, `localStorage nito_quote_v1`.
- `media.js` — product image store. **Bytes never go in the product record**: the dataset is one
  localStorage key and `_persist()` throws on quota, so a photo inside a product would make the next
  unrelated save fail and take the catalogue with it. Bytes live in `nito_med_<id>` (≤1400px) +
  `nito_medsm_<id>` (≤420px) behind `nito_media_index_v1`; a product carries only
  `images:['nito-media:<id>']` (~80 B) + `imagePaths`. Readers use `NitoMedia.resolve()/resolveFull()`.
  `publishCatalog()` **inlines the thumbnail** as a data URL and strips `imagePaths` — the export is
  standalone, so an unresolved ref is a broken live image.
- `enquiries.js` — the lead is never lost (below). `live-data.js` — live catalogue bridge (below).
- `platform.js` — THE storage seam (below).
- `admin.html` + `assets/js/admin.js` + `assets/css/admin.css` — **retired** old panel, zero
  references from any HTML or JS. Safe to move aside (git has it); owner's call.

## One-click launch + the local backend (2026-10-09)
**`Start NITO Platform.cmd`** (Windows) / **`start-platform.sh`** (macOS/Linux) — double-click starts the
whole thing: real HTTP server, public site **and** console **and** API, one URL. The `.cmd` is
ASCII-only, `cd /d "%~dp0"`, tries three Node locations (`where node`, `%ProgramFiles%\nodejs`,
`%USERPROFILE%\.local-node\binaries\...`), and `pause`s on error so a failure is readable.
- `tools/server.js` — **zero-dependency** Node server (~470 lines) serving the site **and** `/api/`.
  Durable storage in `data/platform-db.json` (atomic tmp+rename), `crypto.scryptSync` + per-user salt
  + `timingSafeEqual`, server-side sessions in an HttpOnly `nito_sid` cookie, and "one staff account,
  no self sign-up" enforced **on the server**. Seeded from `catalog.js` via
  `new Function('window', src)(win)`. Flags: `--port` · `--no-open` · `--no-inject` · `--fresh` ·
  `--data <file>`; full API surface is documented at the top of the file.
- `cloud-shim.js` — defines `window.NitoCloud.createNitoCloud(cfg)` over `fetch` to
  same-origin `/api/`. `cloud-config.js` — sets `NITO_CLOUD_CONFIG` **only when the hostname is
  localhost/127.0.0.1/::1**, so a deployed copy never points at a visitor's own machine.
- **Dev-server HTML injection** — a static host cannot inject scripts, so `tools/server.js` injects
  `cloud-config.js` + `cloud-shim.js` + `platform.js` into served HTML, marked
  `<!-- nito-backend-injected: dev server only -->`. The ONLY thing it does differently from a static
  host; `--no-inject` off.
- **Limits to state plainly:** binds `127.0.0.1` only (one machine — not a team tool), plain HTTP, no
  rate limiting. **It is not the production deployment.**

**`platform.js` is THE seam** — everything reads/writes through `window.NitoPlatform`, so the backend
swaps in exactly one file.
- `LocalAdapter` — real localStorage store (`nito_platform_v1`). Single browser, not shared, not
  secure; says so in `info().note`, printed as a banner on every admin page. **Never hide this.**
- `CloudAdapter` — activated by `NITO_CLOUD_CONFIG` + the SDK. Today the local backend; later the
  hosted one.
- **`CloudAdapter.ready()` has deliberately NO `.catch`.** It once swallowed the failure and returned
  `info()`, so an unreachable backend reported "Hosted (shared)" while every read/write went nowhere.
  It must reject so `init()` falls back to `LocalAdapter` with a visible `bootError`.
- **`hasAccounts()` ASKS the backend** (was hardcoded `true`). Assuming `true` added no security and
  broke a fresh backend the owner legitimately owns: a sign-in form with no account and no way to make
  one. Falls back to `true` on error — the safer failure.
- **`_sync()` is load-bearing** — the stamp check before every read/write stops a second tab or the
  public form silently losing writes. **Disappearing enquiries** is the symptom that matters.
- Auth: FNV-1a `hash()` on the local adapter is a convenience hash, **not** a security boundary. Users
  in `nito_platform_users_v1`. **Exactly ONE staff account.**
- **The session lives in `localStorage` (`nito_platform_session_v1`), not `sessionStorage`** — per-tab
  sessions bounced the operator to `/login.html` on a new tab, which he read as "the frontend is not
  enterprise". `_setSession()` still mirrors to sessionStorage; `currentUser()` migrates a legacy entry
  up **and validates it against the account list**. Keep both.
- Roles `owner 40 / admin 30 / editor 20 / viewer 10`; perms `read/create/update/delete/publish/
  manageTeam/viewAudit/manageSettings`. Viewer sees 6 sections (Settings is `perm:'read'`); only Team
  and Audit hide.

## Cloud backend — status
Awais wants a **real backend**: hosted DB and genuine server-side auth so `admin.html` is really
protected. **Single-tenant: NITO only** — no per-tenant subdomains, no self-signup. Target: better than
the reference site. The local backend above is a working stand-in, not the destination.
**Cloud activation has failed 5×** with `cloud_service_unavailable`
(`unavailableKind:"backend-unavailable"`). Not user error — relay and retry later; **never downgrade to
localStorage without asking**. `domainPrefix:"nitosports"` is reserved and immutable, still unclaimed.
**A `.genie` marker appears when the app is created — `present_files` must carry ONLY that marker,
never the HTML entry or source files.**

## Live catalogue bridge
`live-data.js`, loaded **before** `site.js` on all 8 public pages. Overlays the operator's published
lines onto `NITO_CATALOG` when the platform is **shared**.
- `site.js`'s `boot()` **awaits `NITO_LIVE.ready`** before drawing. The snapshot moved from script-eval
  time into the draw function; capturing a reference at load would freeze the static file's data.
  Deliberately **no second render pass**.
- **Inert on `LocalAdapter`** (reason `local-mode`). Do not make the local adapter feed the public site;
  the operator's browser is not the website.
- Drafts held back (`published !== false`), mirroring `publishCatalog()`.
- **Only `categories` + `products` are replaced.** `NITO_SITE` and `NITO_PAYMENTS` always come from
  `catalog.js` — blanking the owner's phone/e-mail/payment methods with an empty record would be a real
  bug.
- `NITO_LIVE.armed/reason/count` report what actually happened. Never let it fail silently: an operator
  who believes an edit is live when it is not is the exact claim this project forbids.
- `publishCatalog()` (console → downloadable `catalog.js`) is still the path when no backend runs.

## Enquiry pipeline — record first, then deliver
`enquiries.js` (before `site.js` on contact + quote, before `platform.js` on admin). The form used to
end at `window.open(waLink(text))` and **recorded nothing** — a blocked popup or a closed tab looked
identical to success while the inbox said "No enquiries yet" forever.

**KNOWN GAP — the console inbox does not receive real visitors' enquiries (2026-10-09).** The queue is
`localStorage`, so it is **per browser**: a buyer on another machine (or another browser profile) writes
to *their own* store, which the owner's console can never drain. **The console inbox is therefore only
populated by submissions made in the browser that runs the console.** What actually delivers a real
enquiry today is **WhatsApp** (the buyer's browser opens a pre-filled message to the owner's number),
plus e-mail once `formEndpoint` is set. This is the single biggest thing the hosted backend fixes —
`enquiries.js` must POST to the backend when one is shared. **Do not claim "every quote request lands
in one inbox" in any copy until that is wired** — the login page said exactly that and was corrected on
2026-10-09. The local backend now exists, so this is buildable; it is not yet done.
- **3 steps: record → email → WhatsApp.** Capture is step one precisely because a popup blocker cannot
  break a `localStorage` write but can silently kill step three. Nothing before the record may throw.
- **Append-only queue** `nito_enquiry_queue_v1` (an array), never straight into `nito_platform_v1`:
  `_sync()` re-reads its key before every write so a racing public-page write can lose one, and
  `_persist()` throws on quota — a throw inside a capture path is the exact lead loss being fixed.
  `record()` never throws, dedupes on `ref`.
- **The console drains it.** `admin-shell.js drainEnquiryQueue()` runs on boot **before the first
  `refreshCounts()`**, then on a 15s poll, on `visibilitychange`, and on the `storage` event (fires in
  *other* tabs). `admin-pages.js` also drains on entering the enquiries page.
- **A failed import KEEPS the lead queued** — `drain()` writes back the failures.
  `nito_enquiry_drained_v1` marks imported refs.
- **Field names must match the console drawer exactly:** `ref/name/company/country/email/phone/contact/
  product/qty/sizes/deadline/custom/message/items/files/status/source/subject/createdAt`. Mismatch to
  remember: the form field is **`#f-date`** but the record key is **`deadline`**.
- **The e-mail channel is honest about failure** — a non-2xx is a failure (old code read a 4xx as
  success), 12s abort, reports `http-4xx`/`timeout`/`network`. Off until the owner sets
  `NITO_SITE.formEndpoint`.
- **The confirmation panel lists which channels actually fired.** Never claim one that did not run.
- **Inbox is a working surface:** CSV export with a BOM (Excel + accented names) and formula-injection
  guarding — a cell starting `=`, `+`, `-` or `@` is prefixed `'`.

## Console
`login.html` + `admin.html` + `assets/js/{platform,admin-shell,admin-pages,auth-page}.js` +
`assets/css/app.css`.
- **`admin-shell.js`** — boot/auth guard, 8 `ROUTES`, hash routing, permission gating, toasts, modal,
  drawer. Exports `window.NitoAdmin` (`$ $$ esc icon fmt initials pages toast confirm routeTo openDrawer
  closeDrawer refreshCounts rerender user state`).
- **`admin-pages.js`** — 8 pages: `dashboard products categories enquiries customers team audit
  settings`. Products edits all 16 fields + a `published` toggle (drafts stay out of the catalogue).
  - Product images: `#e-imgs` holds state **on the DOM element**, not a module variable, so reopening
    the drawer on another product cannot inherit the previous one's photos. `saveProduct()` writes the
    record then calls `commitImages(pid)` as a **second** write (a generated id only exists after a
    create).
- **Publish to website** — `publishCatalog()` / `#pPublish`. This is the step that actually puts a
  product in front of a customer, and it is the **only** one: with no backend bound the public pages
  read the static `catalog.js`, so saving in the console is not publishing. Hidden when `mode().shared`.
  Ships published lines only; **strips** `published`/`createdAt`/`updatedAt`.
- `app.css` is its own dark design system with its own `:root`; **define every token you use.**

## Single staff account — no self sign-up (2026-10-09)
**Enforced in two independent places — either alone is not enough:**
1. **The UI** — no registration affordance. `auth__tabs`, `#tabIn`, `#tabUp` and the `?mode=signup`
   deep link are gone. Do not add them back.
2. **The API** — `LocalAdapter.signUp` rejects once `_users().length > 0`; `tools/server.js` returns
   **403** on a second `/api/auth/signup`. A UI-only fix is cosmetic (devtools can edit the page).
   **Only the API guard makes the rule real.**

**One-time setup is not a loophole.** A console with zero accounts is unreachable, so the first run asks
once for the owner's details and never again. `login.html` asks `NitoPlatform.hasAccounts()` and
publishes the answer on **`#authForm[data-mode]`** — `"setup"` or `"signin"`. Tests key off that
attribute, not off hidden fields. The steady state is always `signin`.
**Rejected: seeding the owner's password from `catalog.js`.** That file is publicly served, so it would
publish the admin password to anyone who viewed source.
**`auth-page.js` defaults a `hasAccounts()` failure to `true`** (assume set up) — offering setup when it
is not wanted is the riskier failure.

**Recovery — there is NO in-app recovery at all.** Both affordances were removed at the owner's request
on 2026-10-09 ("Forgot your password?", then "Reset console access"). The sign-in form is deliberately
the only thing on the page. **Do not add either back.**
**Manual recovery, local adapter.** With the console open, remove **only** `nito_platform_users_v1` and
`nito_platform_session_v1` from localStorage *and* sessionStorage, then reload `login.html`; one-time
setup returns. The catalogue lives in a **different key** (`nito_platform_v1`), so products, enquiries,
photos and the quote list all survive. `staff-login-test.js` asserts 55 lines before *and* after.
**Manual recovery, local backend.** `node tools/server.js --fresh` — **renames** the data file to
`platform-db.json.replaced-<ts>` (recoverable, not deleted) and reseeds from `catalog.js`, so the
account is cleared and any console-created lines go with the moved file.
**Never re-add a "clear your browser site data" instruction.** Chrome's site-data clearing removes
`nito_platform_v1` too — it destroys the catalogue while looking like it only resets a password.
**Known limit, deliberately asserted in the suite:** on the **local adapter**, clearing browser data
removes the account and re-offers setup. That adapter is not a security boundary — precisely why a real
backend must be bound before real use. Labelled `KNOWN LIMIT`.

## Branding & credentials
Logo = the **owner's own blue-gradient runner mark** from `assets/img/nito-logo.jpg`. Logo blue
`#1b8ec4`. `tests/make-logo.py` regenerates every logo/favicon asset. **There is no drawn SVG
brand mark** — an invented gold one existed and had to be removed from `site.js`, `flats.js`,
`admin.js`, `admin.html` and all 9 HTML files. Do not add one back. `nito-lockup.png` (header 36px,
drawer 34px, light) · `nito-lockup-light.png` (footer 46px, admin header, admin gate, dark) ·
`favicon-32/192.png`, `apple-touch-icon.png`. `brandLockup(variant)` in `site.js` returns the `<img>`.
**Staff sign-in** is `.copy__staff` in the bottom copy bar (`site.js:buildFooter()` — one edit covers
all 9 pages), linking to `login.html`; quiet grey, `nofollow`.

**Credential marks — real artwork only.** `assets/img/scci.png` (411×92, scci.com.pk) +
`assets/img/fbr.png` (532×77, fbr.gov.pk), on `index.html` + `about.html`, in `.cred--marks` /
`.cred__marks` (height-capped 34px, aspect preserved).
**The dashed number slots are gone (2026-10-09).** The `SCCI membership no. [add number] · FBR NTN
[add number]` row was removed from **both** `index.html` and `about.html`, together with `.cred__n`,
`.cred__n .tbd` and `.tbd` — which existed only for that row. The "Registered & verified" claim and its
sentence stay; real numbers, if supplied later, go **into that sentence**, never back as slots.
**"No child labour" is deliberately WORDED AS POLICY, not shown as a badge** — it has no issuing body,
so a stamp beside two government/chamber marks would borrow credibility it has not earned.

**Payment marks (2026-10-09).** The six text code-badges in `#paymentGrid` became the providers' own
artwork. Same rule as SCCI/FBR: **downloaded unmodified, never redrawn, never lifted from a screenshot**;
every source URL in `assets/img/pay/SOURCES.txt`. Files: `western-union.svg` · `moneygram.svg` ·
`ria.png` · `payoneer.svg` · `remitly.svg` (Wikimedia; Remitly's is an `en/` non-free file, the other
four on Commons).
- **`NITO_PAYMENTS` gained an optional `logo` field**; it travels through `publishCatalog()` because
  that exports `global.NITO_PAYMENTS`. Adding it changed the `catalog.js` hash.
- **"Bank Transfer" deliberately has NO `logo`** — a generic method with no issuing body, so there is no
  honest mark; its card renders the name as text in the mark slot. Do not draw a bank glyph.
- The mark slot is a flex chip with an **explicit `img{height:34px}`** (a percentage `max-height` on a
  grid item does not resolve — see `GOTCHAS.md`). `.pay` is a stacked block; the `.pay__t` name line was
  **removed** — the wordmark carries the name, and the name lives in the image's `alt`, so a failed load
  still reads. Do not re-add it. The grid is an explicit 3×2 above 1000px.
- `index.html` carries a visible attribution line (`.pay-attr`) — the marks are the owners' property,
  shown only to indicate accepted methods, and **NITO is not an agent of any provider**.
- **The footer "We accept" chips stay TEXT on purpose.** The copy bar is `--dark-2`, and WU, MoneyGram,
  Ria and Payoneer all use **black** wordmarks that would be invisible there. Using them needs
  white/reversed variants we do not have. Do not "finish the job" by dropping the same files in.

## Testing
**`bash tests/run-tests.sh`** — sixteen suites, 16/16 pass in ~7m. Suite list, check counts and
the discipline that keeps them honest (including **a guard must be proved able to fail**) live in
`TESTS.md`.

## Roadmap — decision PENDING (2026-10-09)
Awais asked what would make this enterprise-grade. Four tiers; **the backend gates most of it**. Do not
start Tier 2/3 before checking which tier he picked.
- **Tier 0 — Foundation (blocking).** Bind the **hosted** backend. Unlocks real server-side auth, shared
  catalogue, buyer accounts, server-side sending. **His original "send enquiries to WhatsApp
  automatically" ask IS achievable here** — the WhatsApp Business Cloud API lets the *server* message
  the owner's own number, so the buyer taps nothing. It needs a server; no static page can. (The local
  backend is a working stand-in for development only.)
- **Tier 1 — Sales operations.** Lead workflow (assignment, SLA, follow-up), conversion analytics
  (enquiry → quoted → won, response time, win rate, per-market), **quotation/proforma PDF from an
  enquiry**, reply templates.
- **Tier 2 — Brand presence.** Per-page OG tags + product structured data (**only `index.html` has
  `ld+json`/`og:image` today**), per-product spec-sheet PDFs, per-market pages, multi-currency.
- **Tier 3 — Platform.** WhatsApp Business API, error monitoring, scheduled backups, PWA console.

**Split that matters:** buildable NOW and carries over — **wire `enquiries.js` to POST to the backend so
the console inbox actually receives real visitors' enquiries (the local backend already supports it;
this is the top of the list, see the KNOWN GAP above)**, quotation/proforma PDF, deeper analytics,
SEO + schema, reply templates. Needs the hosted backend — buyer accounts, server-side e-mail/WhatsApp,
multi-user, shared data.

## Owner to-dos before launch
Fill/delete the NTN-STRN + Chamber placeholders · move the domain off Google Sites · replace Gmail with
`sales@nitosports.com` · **set the staff password** — visit `login.html` on the machine that will run the
console; with no account yet it offers the one-time setup and then never again · add real product photos
(Products → edit → Add photos) · **paste a Web3Forms key into `NITO_SITE.formEndpoint`** if enquiries
should also arrive by e-mail.

**Enquiry delivery today:** record → email → WhatsApp. WhatsApp is primary and needs no configuration —
the buyer's browser opens a pre-filled message to the owner's number. The e-mail leg is off until
`formEndpoint` is set. **Recording is unconditional** — a missing endpoint or a blocked popup costs a
channel, never the lead. **But see the KNOWN GAP above: the console inbox only ever sees same-browser
submissions, so WhatsApp/e-mail — not the inbox — is what actually delivers a real visitor's enquiry.**
**How photos publish today:** upload → Save → **Publish to website** → upload the downloaded `catalog.js`
over `assets/js/catalog.js` on the host. Photos travel *inside* that file as data URLs, so there is no
separate image folder and no broken-path risk; the deployed `catalog.js` is the master copy. With the
local backend running, saving in the console is enough — the bridge arms and the site reads the API.
