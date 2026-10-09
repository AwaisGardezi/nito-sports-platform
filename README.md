# NITO SPORTS — product platform

Static product catalogue website plus a small local backend: one process serves
the public site and the private product console.

**Live site:** https://awaisgardezi.github.io/nito-sports-platform/

## What is in here

| Path | What it is |
| --- | --- |
| `index.html` … `quote.html` | The public website — home, catalogue, product page, customization, about, contact, quote list |
| `admin.html`, `login.html` | The private console (products, media, enquiries, team, settings) |
| `assets/js/catalog.js` | The catalogue — 5 divisions, 55 product lines |
| `assets/js/platform.js` | Storage layer: shared backend when present, browser storage otherwise |
| `tools/server.js` | The optional backend — serves the site and the API from one process |
| `data/` | Local database (git-ignored: holds enquiries and the password hash) |
| `tests/` | Regression suites — `bash tests/run-tests.sh` runs all 16 |
| `HOSTING-GUIDE.md` | Full setup, domain and CMS instructions |

## Run it locally

Double-click **`Start NITO Platform.cmd`** (Windows) or run
`./start-platform.sh` (macOS / Linux). Both need Node.js from
<https://nodejs.org> and nothing else. The browser opens at the site, the
console is at `/admin.html`, and data is stored in `data/platform-db.json`.

To view only the static site, open `index.html` through any static file
server — no backend required; the console then uses browser storage.

## Deploy

The repository is published with GitHub Pages (Settings → Pages → branch
`master`, root). Every push to `master` redeploys the site automatically.

For a custom domain, see `HOSTING-GUIDE.md` — it covers Cloudflare Pages,
DNS records and the content workflow for adding or editing products.

## Tests

```bash
bash tests/run-tests.sh
```

Sixteen suites: page rendering, the enquiry flow, the console, catalogue
export round-trips, accessibility, layout at six widths, and the backend
contract. All 16 pass.
