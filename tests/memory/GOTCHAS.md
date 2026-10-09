# NITO SPORTS — gotcha catalogue

Companion to `MEMORY.md`. Read this before touching layout, CSS, icons, test harnesses or the
fixed-float bands. Every entry is a rule earned by a real failure — the symptom is included so you can
recognise it rather than rediscover it.

## Environment & tooling
- **`http_proxy` is set with no `no_proxy`.** Every `127.0.0.1` request hits the proxy → **502**. `502`
  = a proxy is in the way; `000` = nothing listening. Always set `no_proxy=127.0.0.1,localhost,::1` and
  use `curl --noproxy '*'`. `run-tests.sh` does both, and its readiness probe requires **HTTP 200 on
  index.html** — "something answered the port" is not "can I fetch a page".
- **`global` does not exist in a browser** — public-side files must use `window`. Suites that `eval` a
  script into jsdom use `window.eval`, so the same code is exercised both ways.
- **Deps live outside the project**: the managed node workspace and `C:\Users\PcR\node_modules`.
  `require.resolve('puppeteer-core')` works from the project root by upward walk, so no `NODE_PATH` is
  needed for the suites.
- **Background task output can be lost.** Write long runs to `tests/test-logs/<name>.log` and
  read the file rather than relying on captured stdout.

## Caching — the "black bar" class of bug
- **HTML and CSS cache independently, and a mismatched pair is a visible break, not a cosmetic one.**
  New payment markup (an `<img>` inside `.pay__logo`) against a cached stylesheet whose `.pay__logo` was
  a solid `#0e0d0d` 46×46 chip made the logo spill out of a black box — exactly what the owner reported
  as **"the black bar covering the logo."**
- All 8 public pages link `assets/css/style.css?v=20261009`; `login.html`/`admin.html` link
  `assets/css/app.css?v=20261009`. **Bump that token whenever either stylesheet changes** — with no
  build step it is manual.
- **When a visual fault cannot be reproduced, suspect the cache before the code.** Hit-test every logo
  with `elementFromPoint` (`tests/logo-occlusion.js`) before changing anything.

## CSS & layout
- **An undefined `:root` token resolves to nothing, silently.** Grep every `var(--…)` you add;
  `admin.css` shipped with 12 undefined tokens and rendered black-on-dark.
- **`svg` defaults to `24px`.** The icon helper emits inline SVGs with no width/height, so an unscoped
  icon fills its container — the team page drew ticks at 141–312px. Keep the default; scope per context
  (`.btn svg`, `.side__link svg`, `.tbl__thumb svg`).
- `[hidden]` needs `display:none !important` — a component `display:flex/grid` overrides it otherwise.
- **Grid tracks need `minmax(0,…)`** — a bare `1fr` keeps a min-content floor, so one wide image can
  push a column past the viewport.
- **A one-item grid leaves a dead column** — `.gallery-strip` had to become `grid-template-columns:1fr`
  with a scoped 16:9 crop. Same defect: six payment cards on `auto-fill` gave 4+2, so the grid is now an
  explicit 3×2 above 1000px.
- **A percentage `max-height` does not resolve against a grid area.** The payment mark rendered
  **212×49 inside a 36px content box** and `overflow:hidden` silently clipped the bottom off four logos.
  Size such slots with an explicit px height (`img{height:34px}`) in a flex chip.
- **Reveal offsets must stay ≤ one container gutter (`--s4`).** `translateX(±24px)` against a 16px
  gutter made every page 8px too wide. `overflow-x:clip` on `html`+`body` hides strays but does not
  remove them.
- **`#site-header{display:contents}` is load-bearing.** Giving the JS mount wrapper a box made it the
  containing block for the `position:sticky` nav, which then scrolled away after ~111px.
- `.crumbs` white text only applies inside `.phead` (dark bar); the PDP breadcrumb is on white.
- Hover effects sit in `@media (hover:hover)` so a touch device does not get a stuck hover state.
- **Console depth comes from three cheap cues, not shadows**: a darker page plane (`--plane`) than the
  card plane (`--surface`), a 1px inner highlight (`--lit`), and one accent per element. Flattening the
  two planes is what made it read as a generic template.
- **Sparse console pages are capped via `ROUTES[].max`** in `admin-shell.js`, applied in `render()`. The
  cap goes on the **content children, not `#view`** — `.mode` (the store-mode banner) must stay full
  width or it wraps mid-sentence.

## The fixed-float collision trap (cost two wrong fixes)
The WhatsApp float is `position:fixed` bottom-right and the copy bar is the page's last element, so the
float paints **on top of the staff link**. Reason about the float's **band**, not padding guesses:
single-row bar → reserve the right edge (≥901px, `padding-right:200px`); wrapped bar → reserve the
bottom (≤900px, `padding-bottom:84px`). Verified at 20 widths, 360→1920.
**"No overlap" and "the user can click it" are different assertions.** Geometry can report a link
visible and 110px wide while something is painted over it — only `elementFromPoint` settles it.

## JS & runtime
- **Icon names must exist in the map** — `icon()` falls back to an info glyph, so `icon('chevron-up')`
  rendered a quiet ⓘ. The real names are `caretUp`/`caretDn`.
- `boot()` in `site.js` and `start()` in `basket.js` **must stay idempotent** (`booted`/`started` flags)
  — duplicate script tags otherwise double-run the slider.
- **Routing owns its own route value** (`lastRoute` + `goRoute()` + `parseHashFrom()`) with a 120ms
  `watchHash()` poll. Never read `location.hash` back after assigning it — during a same-document
  fragment navigation it can still return the **old** value.
- `requireAuth()` returning `null` schedules `showSignedOut()` after 1.2s so a failed redirect never
  strands a visitor on a spinner with no way forward.
- **`#f-items` exists only on `quote.html`.** Reading it unconditionally on contact threw
  `Cannot read properties of null` and killed the whole handler — the one place leads were captured.
- **A `set('#id', value)` helper that silently no-ops on a missing element hides a dead branch.** Three
  suites' `signIn()` had an `else` writing to `#iEmail`/`#iPass` — ids that never existed on
  `login.html`. It read as working because every suite uses a fresh `userDataDir`. When retargeting a
  helper, check the branch you are **not** exercising.

## Removing things
- **Removing a capability means grepping for every promise it backed.** Deleting self sign-up left the
  Customers page telling staff "buyers can create their own account from the login page". No test covers
  prose; grep its vocabulary (`account`, `sign up`, `register`) across copy and empty states.
- **Removing an element from HTML means grepping the JS for its selector in the same pass.** Deleting
  `#resetBtn` then setting its `.hidden` was a TypeError on every page load.
- **Grep the test directory explicitly when removing a selector** — a project-wide grep missed
  `tests/staff-login-test.js`, which was clicking a deleted button.
- **A negative regex cannot distinguish "do this" from "do not do this."** Assert on the instruction.

## Screenshots & browser automation
- Reveal animations (`[data-reveal]`, `[data-stagger]`) start at `opacity:0` — scroll into view before
  screenshotting, or captures come out blank. `fullPage:true` blanks anything behind one.
- `ElementHandle.screenshot()` handles scrolling; a manual `clip` from a viewport-relative
  `boundingBox()` captures the wrong region once the page is scrolled.
- **`#site-header` is `display:contents`, so its rect is `0×0`** — measure a real child instead.
- Don't test `img.complete` to detect broken images — a `loading="lazy"` image below the fold has not
  been requested yet. Check network responses instead.
- `html{scroll-behavior:smooth}` makes `window.scrollY` update **asynchronously** in tests.
- Console pages render **asynchronously** — use a `settle(fn, timeout)` poll, not a fixed sleep.
- **jsdom navigation is unobservable — don't assert on it.** `window.location` exposes
  `replace`/`assign`/`href` as **own, non-writable** properties and `Location.prototype` has none;
  patching either level is a silent no-op and `defineProperty` throws. Assert on product-visible state.
  jsdom also emits `Not implemented: navigation to another Document` for a redirect you *asked* for —
  filter exactly that string, never blanket-silence.
