# NITO SPORTS — Hosting, CMS & Setup Guide

Everything you need to get this website live on **nitosports.com** and keep it updated.

> **Design note:** the front end was rebuilt to match the layout, structure and feature set of the  
> reference site you sent — white background, gold accent (`#f9b20a`), dark top bar, sidebar category  
> tree, grid quantity boxes, quote list, breadcrumbs and related products. All copy, photography,  
> product data and branding are NITO's own; nothing was copied from the reference site.

---

## 1. What you have

A complete static website. No WordPress, no database, no monthly software licence.

```
Sports Platform/
├── index.html            Home
├── products.html         All products + filters
├── product.html          Single product page  (reads ?id=... from the URL)
├── customization.html    Printing, embroidery, private label
├── about.html            Company / Sialkot / credentials
├── contact.html          Enquiry form with file upload
├── quote.html            The quote list — buyer collects products, sends one enquiry
├── admin.html            Your private product manager
├── 404.html              Not-found page
├── robots.txt            Search engine rules
├── sitemap.xml           For Google
├── _headers              Caching + security headers (Cloudflare Pages)
├── _redirects            404 handling (Cloudflare Pages)
└── assets/
    ├── css/style.css     Design system
    ├── css/admin.css     Admin panel styles
    ├── js/flats.js       Garment line drawings (the product illustrations)
    ├── js/catalog.js     ← YOUR PRODUCTS LIVE HERE
    ├── js/basket.js      Quote list (add-to-quote, header counter, quote.html)
    ├── js/site.js        Site behaviour
    ├── js/admin.js       Admin panel logic
    └── img/              Your real photos
        └── favicon.svg   Browser tab icon (linked from every page)
```

**Total size: under 1 MB.** That is why it will load fast anywhere in the world.

**Catalogue size:** 5 divisions, 55 product lines. The numbers shown on the homepage stats band  
(5 / 55 / 6 / 30) are read from the real catalogue — if you add or remove products, update the  
`data-count` values in the STATS section of `index.html` to match. The site deliberately states  
**55**, not "55+" or "60+", because those numbers would be untrue.

---

## 2. Hosting recommendation

### Use Cloudflare Pages. It is free, and it is the right answer here.

You already own `nitosports.com` (HosterPK) and already use Cloudflare for DNS. That means  
Cloudflare Pages is not just the cheapest option — it is the *least work* option, because  
nothing about your domain setup has to change except one DNS record.

|                             | Cloudflare Pages            | Netlify          | Vercel           | HosterPK shared hosting |
| --------------------------- | --------------------------- | ---------------- | ---------------- | ----------------------- |
| Cost                        | Free                        | Free             | Free             | Already paid            |
| Global CDN                  | Yes (300+ cities)           | Yes              | Yes              | Single server           |
| SSL certificate             | Automatic                   | Automatic        | Automatic        | Manual / Let's Encrypt  |
| Bandwidth limit             | **Unlimited**               | 100 GB/mo        | 100 GB/mo        | Metered                 |
| Works with your current DNS | Yes — already on Cloudflare | Needs DNS change | Needs DNS change | Yes                     |
| Deploy method               | Drag & drop folder          | Drag & drop      | CLI / Git        | cPanel File Manager     |

**Why not WordPress?** You asked what CMS to use. For a brochure-and-enquiry B2B site like this,  
WordPress adds a database, a login page attackers scan constantly, plugin updates you must apply,  
and a host that can go down — all to manage a product list you can already edit from a simple  
panel. WordPress makes sense when you need hundreds of blog posts or a real shopping cart. You  
need neither: you take **enquiries**, not online payments. Keep it static.

**When to reconsider:** if you later want 200+ products across many brands, multiple staff editing  
simultaneously from different devices, or live stock and pricing — move to the hosted-database  
option in section 7.

---

## 3. Going live on Cloudflare Pages — step by step

### Step 1 — Create the project

1. Log in to <https://dash.cloudflare.com>
2. In the left sidebar choose **Workers & Pages** → **Create** → **Pages** → **Upload assets**
3. Name the project `nitosports`
4. Drag the **entire `Sports Platform` folder** into the upload box  
   *(make sure `index.html` is at the top level of what you upload — not inside an extra folder)*
5. Click **Deploy site**

You will get a temporary address like `nitosports.pages.dev`. Open it and click through every page.

### Step 2 — Point nitosports.com at it

1. Still inside the Pages project, open the **Custom domains** tab
2. Click **Set up a custom domain** → enter `nitosports.com` → Continue
3. Cloudflare will detect that the domain is already on your account and offer to add the DNS  
   record for you. Accept it.
4. Repeat for `www.nitosports.com`

### Step 3 — Remove the Google Sites record

**This is the step people miss.** Your domain currently has:

```
CNAME   @   ghs.googlehosted.com
```

That record is what serves your old Google Sites page. Cloudflare cannot point the domain at two  
places at once. Once step 2 has added the new Cloudflare Pages record:

1. Go to **DNS** → **Records**
2. Find the `ghs.googlehosted.com` CNAME and **delete it**
3. Keep only the record Cloudflare Pages created (it points at `nitosports.pages.dev`)

Wait 5–30 minutes, then hard-refresh the site (`Ctrl` + `F5`). You should see the new site.

> **Keep the Google Sites page published for now.** Don't delete the Google Site itself until the  
> new site is confirmed live — it costs nothing to leave it and it is your fallback.

### Step 4 — Turn on the speed and security settings

In the Cloudflare dashboard for `nitosports.com`:

- **SSL/TLS** → set encryption mode to **Full (strict)**
- **SSL/TLS → Edge Certificates** → enable **Always Use HTTPS**
- **Speed → Optimization** → enable **Brotli**, and **Auto Minify** for CSS + JS
- **Caching** → set **Browser Cache TTL** to `4 hours`

### Step 5 — Submit to Google

1. Go to <https://search.google.com/search-console>
2. Add `nitosports.com` as a property (verify via the DNS method — it is automatic on Cloudflare)
3. Submit `https://nitosports.com/sitemap.xml`

---

## 4. Adding and editing products

There are two ways to add a product. Use the **admin panel** unless you are comfortable editing code.

|                           | Admin panel (`admin.html`)              | Editing `catalog.js` by hand                  |
| ------------------------- | --------------------------------------- | --------------------------------------------- |
| Best for                  | Everyday use, no technical skill needed | Bulk changes, or adding 10+ products at once  |
| Risk of breaking the site | Very low — the panel validates input    | You can break the file with one missing comma |
| Still needs an upload?    | Yes                                     | Yes                                           |

### Why there is an "export" step

The reference site you sent is built on PHP with a MySQL database, so when you add a product there it  
is written straight to the database and appears immediately.

This site is **static** — there is no database and no server-side code. That is what makes it free to  
host, impossible to SQL-inject, and fast everywhere. The trade-off is one extra step: your products  
live in a single file (`assets/js/catalog.js`), and changes only go live once you upload that file.

So the cycle is always: **edit → export → upload.** Two minutes, once per batch of changes.

---

### Step by step

Open **`nitosports.com/admin.html`**.

**First time only:** it asks you to **set an admin password** (at least 6 characters). It is stored  
in your browser only — there is no server account. Write it down; if you clear your browser data you  
will be asked to set it again, but your products are stored separately and will survive.

1. Click **Add product** (top right). The editor opens on the right with a blank form.
2. Fill in the fields below. The **garment drawing** updates live as you change the dropdown.
3. Click **Save product**. It saves to your browser instantly.
4. Repeat for as many products as you need.
5. Click **Export catalog.js**. A file called `catalog.js` downloads.
6. **Upload that file** to replace `assets/js/catalog.js` on the live site (see "How to upload" below).
7. Reload `nitosports.com/products.html` and hard-refresh (`Ctrl` + `F5`) — your products are live.

> **The one thing to remember:** the panel edits a copy stored in **your browser**. If you edit  
> products but never export and upload, visitors still see the old catalogue. The  
> **"Changes to publish"** counter at the top of the panel turns amber to warn you. Export whenever  
> it is not green.

---

### The fields, one by one

| Field                      | Required    | What to put in it                                                                                                                         |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Product code**           | Yes         | Your reference, e.g. `NTO-1016`. Shown as a gold badge on the card. Keep the `NTO-` prefix and don't reuse a code.                        |
| **Product name**           | **Yes**     | e.g. `Cricket Sweater`. This is also what decides the sidebar sub-range (see below).                                                      |
| **Category**               | Yes         | Dropdown of the five divisions: Sportswear & Teamwear, Gym & Activewear, Streetwear & Clothing, Boxing & MMA, Bags & Caps.                |
| **Garment drawing (flat)** | Yes         | Dropdown of 24 line drawings — this is the product image. Pick the closest match.                                                         |
| **Short line**             | Recommended | One sentence shown under the name on the card, e.g. `Knitted V-neck sweater in club colours.`                                             |
| **Full description**       | Recommended | 2–4 sentences for the product page. Describe what it is and how it is made. **Do not put a price here** — this is a quote-only catalogue. |
| **Fabric / material**      | Recommended | e.g. `100% cotton face, brushed inner`.                                                                                                   |
| **Weight / GSM**           | Recommended | e.g. `280 GSM`.                                                                                                                           |
| **MOQ**                    | Recommended | e.g. `30 sets per design`. **Write the unit** (sets / pieces / units) — the quote list uses this number as the default quantity.          |
| **Sizes**                  | Recommended | e.g. `Youth XS–XL · Adult S–4XL`.                                                                                                         |
| **Lead time**              | Recommended | e.g. `10–18 days after artwork approval`.                                                                                                 |
| **Customization options**  | Optional    | **One per line.** Each becomes a pill on the product page. e.g. `Full sublimation printing`, `Embroidered club crest`.                    |
| **Available styles**       | Optional    | **One per line.** e.g. `Short sleeve`, `Ladies fit`.                                                                                      |
| **Colours**                | Optional    | **One per line.** e.g. `Any colourway, Pantone matched`.                                                                                  |
| **Tags**                   | Optional    | **Comma separated**, e.g. `Core Range, Private Label`. Shown as chips at the top of the product page.                                     |


Only **name**, **code**, **category** and **drawing** really matter to get a product on the site —  
but the more you fill in, the more the product page has to show a buyer.

### The 24 garment drawings

`jersey` · `rugby` · `polo` · `baseball` · `hockey` · `football` · `tank` · `stringer` ·  
`compression` · `hoodie` · `track` · `jacket` · `varsity` · `bra` · `robe` · `shorts` · `fights` ·  
`pant` · `leggings` · `duffel` · `backpack` · `cap` · `sock` · `tracksuit`

These are the line-art product illustrations. They are deliberately drawn rather than photographed —  
see section 9 for how to swap in real photos.

### Where your product appears in the sidebar

The products page has a two-level menu: division → sub-range. You do **not** pick the sub-range; the  
site works it out by matching words in the **product name** against the sub-ranges for that division.

| You name it…                  | It lands under…                                        |
| ----------------------------- | ------------------------------------------------------ |
| `Cricket Sweater`             | Cricket                                                |
| `Basketball Jersey`           | Basketball                                             |
| `Yoga Leggings`               | Leggings                                               |
| `Muay Thai Shorts`            | Muay Thai Shorts                                       |
| `Something Totally Unmatched` | Football / Soccer *(the first sub-range — a fallback)* |

**So: include the sport or garment type in the name** and it files itself correctly.

If a product lands somewhere wrong, force it without touching the algorithm — add this to the bottom  
of `assets/js/catalog.js`, using the product's `id` (the panel shows it in the editor header):

```js
window.NITO_SUBCAT_OVERRIDES = {
  'cricket-sweater': 'Cricket',
  'gym-hoodie': 'Hoodies'
};
```

### Worked example — adding a cricket sweater

| Field                 | Value                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product code          | `NTO-1016`                                                                                                                                       |
| Product name          | `Cricket Sweater`                                                                                                                                |
| Category              | `Sportswear & Teamwear`                                                                                                                          |
| Garment drawing       | `jersey` (closest available)                                                                                                                     |
| Short line            | Knitted V-neck sweater in club colours.                                                                                                          |
| Full description      | Traditional cricket sweater in a heavyweight knit, with contrast V-neck and ribbed cuffs. Made to your club colourway with an embroidered crest. |
| Fabric / material     | 100% acrylic knit, cotton-face option available                                                                                                  |
| Weight / GSM          | 320 GSM                                                                                                                                          |
| MOQ                   | 30 pieces per design                                                                                                                             |
| Sizes                 | Youth XS–XL · Adult S–4XL                                                                                                                        |
| Lead time             | 12–18 days after artwork approval                                                                                                                |
| Customization options | Embroidered club crest ↵ Contrast neck trim                                                                                                      |
| Tags                  | Core Range                                                                                                                                       |

Save → Export → upload → the sweater appears under **Sportswear & Teamwear → Cricket**.

---

### Other buttons in the panel

| Button                | What it does                                                                    |
| --------------------- | ------------------------------------------------------------------------------- |
| **Add product**       | Opens a blank editor                                                            |
| **Export catalog.js** | Downloads the file you upload to go live                                        |
| **Import**            | Loads a previously exported `catalog.js` back in (use this to restore a backup) |
| **Reset**             | Returns to the catalogue exactly as shipped — **this discards all your edits**  |
| **Change password**   | Sets a new admin password                                                       |
| **Sign out**          | Ends the session                                                                |

To **delete** a product, use the delete button on its row in the list and confirm. It is removed from  
the catalogue once you export and upload.

### How to upload just one file

**Cloudflare Pages (drag & drop):** open your project → **Create new deployment** → drag the whole  
folder in again. Takes about 15 seconds. (Cloudflare has no single-file upload in the dashboard.)

**HosterPK cPanel:** **File Manager** → `public_html/assets/js/` → **Upload** → overwrite  
`catalog.js`.

**GitHub (best long-term):** once the project is a repository, edit `catalog.js` on GitHub and commit  
— Cloudflare Pages publishes it automatically. This removes the manual upload entirely.

### Adding products by hand instead

Open `assets/js/catalog.js`, copy an existing product object, paste it after the last one, and change  
the values. The shape is:

```js
{
  id: 'cricket-sweater',              // unique, lowercase, dashes — used in the URL
  code: 'NTO-1016',
  cat: 'teamwear',                    // teamwear | gym | street | combat | bags
  flat: 'jersey',                     // any of the 24 drawings above
  name: 'Cricket Sweater',
  blurb: 'Knitted V-neck sweater in club colours.',
  desc: 'Traditional cricket sweater in a heavyweight knit…',
  fabric: '100% acrylic knit, cotton-face option available',
  gsm: '320 GSM',
  moq: '30 pieces per design',
  sizes: 'Youth XS–XL · Adult S–4XL',
  custom: ['Embroidered club crest', 'Contrast neck trim'],
  styles: ['V-neck', 'Round neck'],
  colors: ['Any colourway, Pantone matched'],
  lead: '12–18 days after artwork approval',
  tags: ['Core Range']
}
```

**Mind the commas** — a single missing comma breaks the whole catalogue and every product disappears.  
If that happens, run the panel's **Reset**, or restore your last export. Always keep the previous  
`catalog.js` as a backup before hand-editing.

---

## 5. Making the enquiry form email you directly

Right now the form **validates the enquiry, then opens WhatsApp with everything pre-filled** —  
which is exactly how most Sialkot exporters actually work, and it means zero spam and zero  
setup.

If you also want a copy in your inbox:

1. Sign up free at <https://web3forms.com> using `nitosports.pk@gmail.com`
2. Copy your **Access Key**
3. Open `assets/js/catalog.js` and paste it here:

```js
formEndpoint: 'https://api.web3forms.com/submit',
```

Wait — the code reads the key from the **last part of the URL**. So put the full path instead:

```js
formEndpoint: 'https://api.web3forms.com/submit/YOUR-ACCESS-KEY-HERE',
```

1. Save and upload. The form now does both: emails you **and** opens WhatsApp.

**Alternatives:** Formspree (`https://formspree.io/f/xxxxxxx`), or Cloudflare Pages Functions if  
you want to handle it yourself.

> **File uploads:** uploaded files are attached manually in the WhatsApp chat that opens, because  
> email attachment APIs need a paid plan on most form services. The form says this clearly to the  
> buyer, so nothing is lost. If you want automatic email attachments, use Formspree's paid tier.

---

## 6. Get a proper email address (do this — it matters for credibility)

Right now your contact address is `nitosports.pk@gmail.com`. For a company presenting itself as an  
international manufacturer to buyers in Germany or the UK, a Gmail address is the single biggest  
credibility leak on the whole site.

**Free option — Zoho Mail:** <https://www.zoho.com/mail/> gives you a free custom-domain mailbox.

1. Sign up, choose "Add existing domain", enter `nitosports.com`
2. Zoho gives you MX records — add them in Cloudflare **DNS** → **Records**
3. Create the mailbox `sales@nitosports.com` (or `hello@`)

**Paid option:** Google Workspace (~$6/user/month) if you also want Google Drive and Calendar.

Then update the address everywhere in `assets/js/catalog.js`:

```js
email: 'sales@nitosports.com',
formRecipient: 'sales@nitosports.com'
```

One line, and the whole site updates — header, footer, contact page and form all read from it.

---

## 7. If you outgrow the simple admin panel

The panel is a **single-operator** tool. It is perfect for one person managing 50–200 products.  
It is the wrong tool when you need:

- Two or more staff editing at the same time, from different computers
- Products to update without downloading and re-uploading a file
- A real login with server-side security
- Live pricing, stock levels or customer accounts

**Then do this:**

| Approach                                             | Cost                  | Effort                       | Best for                                    |
| ---------------------------------------------------- | --------------------- | ---------------------------- | ------------------------------------------- |
| **Cloudflare Pages + D1 database + Pages Functions** | Free tier is generous | Needs a developer, ~1–2 days | Real multi-user admin, stays fast and cheap |
| **Headless CMS** (Sanity, Strapi, Decap CMS)         | Free tiers            | Needs a developer            | Non-technical editors, structured content   |
| **WooCommerce / WordPress**                          | Hosting + plugins     | Medium, ongoing maintenance  | If you later sell retail online with a cart |
| **Shopify**                                          | ~$39/mo               | Low                          | If you pivot to retail D2C                  |

**My honest recommendation:** stay on the static site until it actually hurts. For a manufacturer  
whose goal is enquiries, this setup will serve you for years. Move when a real limitation appears,  
not in advance.

---

## 8. Before you go live — checklist

### Must do

- [ ] **Fill in your FBR NTN / STRN.** Two cards on `index.html` and `about.html` currently show  
  an amber `Add your NTN / STRN here` placeholder. Put the real number in, or delete the card.
- [ ] **Fill in or delete the Chamber of Commerce card.** Same rule — real value, or delete.
- [ ] **Test the enquiry form** on your own phone and confirm the WhatsApp message arrives.
- [ ] **Set the admin password** on `admin.html` and write it down somewhere safe.
- [ ] **Check the WhatsApp number** (`+92 329 9830007`) opens the right chat.
- [ ] **Confirm `nitosports.com` resolves** to the new site and not Google Sites.

### Strongly recommended

- [ ] **Get `sales@nitosports.com`** and update `email` in `catalog.js` (section 6)
- [ ] **Add 4–6 real product photos** to replace the line drawings on your best-selling lines  
  (see section 9)
- [ ] Submit the sitemap to Google Search Console
- [ ] Add the site to your WhatsApp Business profile and email signature

### Deliberately left out — do not add these

These would damage your credibility with serious buyers, which is why they are absent:

- ❌ **Fake client logos.** You asked for none, and you were right to.
- ❌ **Fake reviews or testimonials.** Buyers in the USA/UK/EU check. Getting caught costs the order.
- ❌ **Fake certificates.** Same reason. A real NTN beats a borrowed ISO badge.
- ❌ **Retail prices.** Correctly absent — your quote depends on quantity, fabric and destination.  
  Publishing a number would only anchor buyers lower.

When you have **real** client permission, **real** reviews and **real** certificates, tell me and I  
will add the sections properly.

---

## 9. Adding your real product photos

The site currently uses **technical line drawings** for products instead of stock photography —  
deliberately, because you asked for no cheap stock or AI-looking images, and a line drawing reads  
as "manufacturer" rather than "template".

When you have real photos, here is how to add them.

**Best results — follow these rules:**

|            |                                                            |
| ---------- | ---------------------------------------------------------- |
| Format     | JPG for photos, PNG only if you need transparency          |
| Size       | 1600 × 1600 px square is ideal                             |
| Weight     | Under 250 KB each (compress at <https://squoosh.app>)      |
| Background | Plain and consistent across the set — white, grey or black |
| Lighting   | Same lighting for every shot in a range                    |


**To add one:** put the file in `assets/img/products/`, then in `catalog.js` add an `images`  
array to that product:

```js
{
  id: 'football-kit',
  code: 'NTO-1001',
  ...
  images: ['assets/img/products/football-kit-1.jpg', 'assets/img/products/football-kit-2.jpg'],
}
```

The product page will then show the first photo as the main image, and any extra photos become  
clickable thumbnails with a zoom lightbox. With no photos, the page shows the line drawing on its  
own — it deliberately does **not** fake three identical thumbnails. If you want this wired up for  
you, send me the photos.

---

## 10. Backups

Your catalogue is a single file: `assets/js/catalog.js`.

- After every admin-panel export, keep the downloaded `catalog.js` in a dated folder
- Once the site is on GitHub, every change is versioned automatically — this is the best answer
- A full backup is the whole folder zipped, which is under 1 MB

---

## 11. Performance notes

Why this site is fast:

- **No framework.** No React, no jQuery, no build step. ~35 KB of JS total.
- **One font family** (Archivo) with `display=swap`, loaded from Google's CDN.
- **SVG product drawings** are inline — they cost bytes, not requests, and they scale to any screen.
- **Immutable caching** on `/assets/*` via `_headers` — repeat visitors fetch almost nothing.
- **Lazy loading** on every below-the-fold image.
- **`prefers-reduced-motion` respected** — animations switch off for users who ask for that.

Expected Lighthouse scores on a 4G connection: **Performance 95+, Accessibility 95+, Best  
Practices 100, SEO 100.**

---

## 12. Buyer-facing features — how they work

These were built to match the feature set of the reference site you sent, in NITO branding.

### The quote list (`quote.html`)

The B2B equivalent of a shopping cart — except there is no checkout and no price.

- Every product card and every product page has an **Add to quote** button.
- The header shows a counter badge, and a small confirmation pops up each time something is added.
- The list is stored in the visitor's own browser (`localStorage`), so it survives page changes and  
  closing the tab. **Nothing is sent to a server until the buyer actually submits.**
- On `quote.html` the buyer can change quantities, remove lines, and send the whole list as **one  
  enquiry**. Submitting opens WhatsApp with every product, code and quantity pre-filled, plus an  
  e-mail fallback button.

Nothing to configure. If you later delete a product from the catalogue, it silently drops out of any  
buyer's saved list rather than leaving a broken row.

### Header search

The magnifier in the header opens a search panel over the page. It matches on product name, product  
code, blurb and fabric, shows the top 8 matches as cards with a thumbnail, and offers a "see all"  
link that hands the query to `products.html?q=...`. `Ctrl/⌘ + K` opens it from anywhere.

### Hero slider

The homepage hero rotates through three slides — two real photographs and one built from the tech  
flats. It pauses on hover, on focus and when the tab is hidden, and it is disabled entirely for  
visitors who have "reduce motion" switched on. To change the timing, edit `data-autoplay`  
(in milliseconds) on `#heroSlider` in `index.html`.

### Trust strip

The four gold badges just under the featured lines — direct factory pricing, low MOQ, worldwide  
shipping, your label. Plain HTML in `index.html` (search for `WHY CHOOSE NITO`); edit the wording  
there.

### The product catalogue page (`products.html`)

This is the page that most closely mirrors the reference site's layout:

- **Left sidebar — two-level category tree.** The five divisions are listed in gold. Clicking one  
  opens it and reveals its sub-ranges (Football / Soccer, Cricket, Basketball …), each with a live  
  product count. The counts are computed from the catalogue, so they can never drift out of date.  
  On mobile the sidebar moves above the grid and collapses to a single column.
- **Filter row.** "All products" plus the five divisions, and a search box that matches on name,  
  product code, blurb and fabric.
- **Quantity box on every tile.** Hover a product card (or tap it on a phone) and a quantity field  
  plus **Add to quote** appears — the buyer can build a list straight from the grid without opening  
  each product.
- **Pagination.** 12 products per page, with Prev/Next and numbered pages. To change the page size,  
  edit `PAGE_SIZE` near the top of `renderProductGrid()` in `site.js`.
- **Result counter.** "Showing 1–12 of 55 product lines" — accurate to whatever filter is active.

Sub-ranges are worked out automatically by matching each product name against the `items` list on  
its category in `catalog.js`. If a product lands in the wrong sub-range, you can force it without  
touching the algorithm: add a `NITO_SUBCAT_OVERRIDES` map to `catalog.js` keyed by product id.

### Product page (`product.html`)

Breadcrumbs (Home › Products › Division › Code), a spec table (fabric, weight, MOQ, sizes, lead  
time), customisation options, available styles, colour options, a quantity box with **Add to quote**  
and **WhatsApp enquiry**, and a related-products rail drawn from the same division.

### Newsletter signup

In the footer. It validates the address and confirms on screen, but **it does not store anything  
yet**. To actually collect addresses, paste a Web3Forms key into `formEndpoint` in `catalog.js`  
(see section 5) and signups will start arriving in your inbox alongside enquiries.

### Social icons

The footer shows WhatsApp and e-mail automatically, because those are real. To add Facebook,  
Instagram, TikTok, YouTube or LinkedIn, open `catalog.js` → `social` and paste the full URL into the  
`url` field for that network. Leave it empty and the icon stays hidden — which is the correct  
behaviour, because a dead social link looks worse than no link at all.

---

## 13. Quick reference — where to change what

| I want to change…                           | Edit this                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Products, prices, MOQ, descriptions         | `admin.html` → Export → upload `catalog.js`                                                      |
| WhatsApp number, email, address, domain     | `assets/js/catalog.js` → `window.NITO_SITE`                                                      |
| Payment methods shown                       | `assets/js/catalog.js` → `window.NITO_PAYMENTS`                                                  |
| Social links in the footer                  | `assets/js/catalog.js` → `NITO_SITE.social` (paste a URL to switch one on)                       |
| Hero slider timing                          | `index.html` → `data-autoplay` on `#heroSlider`                                                  |
| The four gold trust badges                  | `index.html` → search for `WHY CHOOSE NITO`                                                      |
| Category names and descriptions             | `assets/js/catalog.js` → `window.NITO_CATALOG.categories`                                        |
| Which sub-range a product sits in           | `assets/js/catalog.js` → add `window.NITO_SUBCAT_OVERRIDES = { 'product-id': 'Sub-range name' }` |
| Products per page on the catalogue          | `assets/js/site.js` → `PAGE_SIZE` in `renderProductGrid()`                                       |
| The homepage stat numbers (5 / 55 / 6 / 30) | `index.html` → STATS section → `data-count` attributes                                           |
| Colours, fonts, spacing                     | `assets/css/style.css` → the `:root` token block at the top                                      |
| The gold accent colour                      | `assets/css/style.css` → `--gold` (and `--gold-2…--gold-dk` for the shades)                      |
| Company text, credentials, FAQ answers      | `index.html`, `about.html`                                                                       |
| Menu items                                  | `assets/js/site.js` → `buildHeader()`                                                            |
| The browser tab icon                        | `assets/img/favicon-32.png` (+ `favicon-192.png`, `apple-touch-icon.png`)                        |
| The logo (header, footer, drawer, admin)    | `assets/img/nito-lockup.png` and `nito-lockup-light.png` — regenerate with `tests/make-logo.py` |
| The hero photo's framing                    | `assets/css/style.css` → `object-position` on `.slider__slide img`                               |

### The colour system

The site uses the same light/gold language as the reference site you sent:

| Token                | Value                 | Used for                                        |
| -------------------- | --------------------- | ----------------------------------------------- |
| `--gold`             | `#f9b20a`             | Buttons, accents, active states, sidebar items  |
| `--gold-2…--gold-dk` | `#efab09` → `#d99e06` | The four-cell trust band gradient               |
| `--dark`             | `#0e0d0d`             | Top contact bar, section headers, table headers |
| `--dark-2`           | `#131313`             | Footer                                          |
| `--bg-2`             | `#e8e8e8`             | The category band                               |
| `--t1`               | `#0e0d0d`             | Body text on white                              |

Change `--gold` once and every button, badge, link hover and sidebar item follows.

The **admin panel** (`admin.html`) is deliberately a separate, dark, blue-accented tool so it never
looks like the public site. Its palette is defined at the top of `assets/css/admin.css` and uses the
blue sampled straight out of the logo artwork (`#1b8ec4`). `admin.css` is loaded by `admin.html`
only, so those tokens cannot leak into the public pages.

---

## 14. Hardening pass — what was fixed

A full audit pass found and fixed five real defects. All of them are covered by automated tests now,
so they cannot come back silently.

| # | Problem | Cause | Fix |
| - | ------- | ----- | --- |
| 1 | **Admin panel was unreadable** — near-black text on a dark background, invisible form fields, white logo on white | `admin.css` referenced 12 dark-theme tokens (`--ink-900`, `--blue`, `--t`, `--warn` …) that were never defined anywhere, so the panel silently inherited the public site's light values | Added the missing palette block at the top of `assets/css/admin.css` |
| 2 | **Admin toolbar ran off the right of a phone screen** | Six buttons in a non-wrapping flex row, and the mobile rule that was meant to shorten them targeted `<span>`s the buttons do not contain | Toolbar becomes a two-column grid below 760px; the dead rule was removed |
| 3 | **Every page scrolled 8px sideways** (latent — `overflow-x` was hiding it) | The `data-reveal="left"/"right"` animations translate ±24px, but the container gutter is only 16px, so un-revealed elements below the fold pushed past the viewport | Offsets capped at one gutter via `calc(var(--s4) * -1)`; `overflow-x` changed from `hidden` to `clip` on `html`/`body` |
| 4 | **Contact page overflowed by 17px** | `.split` grid tracks were bare `1fr`, which keeps a min-content floor, so the QR image forced the column wider than the screen | `minmax(0, …)` on all `.split` tracks, plus `min-width:0` on their children |
| 5 | **The sticky nav never actually stuck** | `.nav` is `position:sticky`, but its containing block was the 111px-tall `#site-header` wrapper, so it scrolled away after a few pixels | `#site-header{display:contents}` — the wrapper has no box, so the nav sticks for the whole page and the utility bar scrolls off |

Two smaller improvements came out of the same pass:

- **Hero photo framing.** The supplied factory photo is portrait (1200×1600) and the hero slot is
  21:8. The old focal point (`center 30%`) landed on the printed showroom banner, so dense wall text
  sat right behind the headline. It is now `center 72%`, which frames the packed export orders and
  finished kit instead.
- **Heading structure and labels.** Footer and sidebar headings were `<h4>`, which jumped from the
  page's `<h2>`; they are now `<h2>`. The product gallery's zoom control was a `<button>` with no
  accessible name whenever a product had no photograph (which is every product, by design) — it is
  now a plain `<div>`. The admin screen gained a `<main>`, a `<nav>` and a screen-reader-only `<h1>`.

### Re-running the checks

```bash
bash tests/run-tests.sh
```

That starts a local server, runs all nine suites and prints a pass/fail summary:

| Suite | What it proves |
| ----- | -------------- |
| `smoke-test.js` | Every page renders its dynamic regions with no console errors (jsdom) |
| `enquiry-test.js` | Every enquiry field reaches WhatsApp, with an order reference |
| `admin-test.js` | Gate, product list, editing, persistence across reload, delete |
| `export-test.js` | `catalog.js` exports and re-parses cleanly |
| `add-product-test.js` | Panel → export → live site, end to end |
| `logo-check.js` | The real logo renders in header/footer/drawer/admin and nothing 404s |
| `layout-guard.js` | No horizontal overflow on 9 pages × 6 widths |
| `sticky-scroll-test.js` | Nav and sidebar stick; reveal animations still fire |
| `a11y-audit.js` | Alt text, labels, accessible names, duplicate ids, heading order, landmarks |

---

*Built for NITO SPORTS — Sialkot, Pakistan.*
