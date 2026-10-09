/* ==========================================================================
   NITO SPORTS — Console pages
   --------------------------------------------------------------------------
   One entry per sidebar route. Each registers itself on
   window.NitoAdmin.pages and exposes render(root, ctx).

   Everything reads and writes through window.NitoPlatform only.
   ========================================================================== */

(function (global) {
  'use strict';

  var A = global.NitoAdmin;
  var $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, fmt = A.fmt;
  var P = function () { return global.NitoPlatform; };

  /* ---------------------------------------------------------------------
     shared bits
     --------------------------------------------------------------------- */

  function modeBanner() {
    var m = P().mode();
    if (!m || m.mode === 'none') return '';
    var cls = m.shared ? 'mode--cloud' : 'mode--local';
    return '<div class="mode ' + cls + '">' + icon(m.shared ? 'check' : 'warn') +
      '<div><b>' + esc(m.label) + '.</b> ' + esc(m.note) + '</div></div>';
  }

  function statusBadge(s) {
    var map = {
      new:       ['badge--blue', 'New'],
      contacted: ['badge--warn', 'Contacted'],
      quoted:    ['badge--gold', 'Quoted'],
      won:       ['badge--ok',   'Won'],
      lost:      ['badge--err',  'Lost'],
      archived:  ['',            'Archived']
    };
    var m = map[s] || ['', s || 'New'];
    return '<span class="badge ' + m[0] + '">' + esc(m[1]) + '</span>';
  }

  function roleBadge(r) {
    var tone = r === 'owner' ? 'badge--gold' : r === 'admin' ? 'badge--blue'
             : r === 'editor' ? 'badge--ok' : '';
    return '<span class="badge badge--role ' + tone + '">' + esc(P().roleLabel(r)) + '</span>';
  }

  function emptyState(title, body, cta) {
    return '<div class="empty">' + icon('info') + '<b>' + esc(title) + '</b>' +
      '<span>' + esc(body) + '</span>' + (cta || '') + '</div>';
  }

  /* a category count that always reflects live data */
  function countBy(rows, key) {
    return rows.reduce(function (acc, r) {
      var k = r[key] || '—';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  /* =======================================================================
     DASHBOARD
     ======================================================================= */

  var dashboard = {
    render: function (root) {
      root.innerHTML = modeBanner() + '<div id="dash"><div class="empty">' +
        icon('info') + '<b>Loading…</b></div></div>';

      Promise.all([
        P().list('products'),
        P().list('enquiries'),
        P().list('categories'),
        P().list('audit', { sort: 'at' })
      ]).then(function (r) {
        var products = r[0], enquiries = r[1], cats = r[2], audit = r[3];

        var open = enquiries.filter(function (e) {
          return ['new', 'contacted', 'quoted'].indexOf(e.status || 'new') > -1;
        });
        var won = enquiries.filter(function (e) { return e.status === 'won'; });

        /* enquiries over the last 14 days */
        var days = [];
        for (var i = 13; i >= 0; i--) {
          var d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - i);
          days.push({ key: d.toISOString().slice(0, 10), label: d.getDate() + '/', n: 0 });
        }
        enquiries.forEach(function (e) {
          var k = String(e.createdAt || '').slice(0, 10);
          var hit = days.filter(function (x) { return x.key === k; })[0];
          if (hit) hit.n++;
        });
        var peak = Math.max.apply(null, days.map(function (d) { return d.n; }).concat([1]));

        /* products per category */
        var perCat = countBy(products, 'cat');
        var catRows = cats.map(function (c) {
          return { name: c.name, n: perCat[c.id] || 0 };
        }).sort(function (a, b) { return b.n - a.n; });
        var catPeak = Math.max.apply(null, catRows.map(function (c) { return c.n; }).concat([1]));

        root.querySelector('#dash').innerHTML =

          '<div class="stats">' +
            '<div class="stat"><div class="stat__lbl">Product lines</div>' +
              '<div class="stat__n">' + fmt.num(products.length) + '</div>' +
              '<div class="stat__d">Across ' + cats.length + ' categories</div></div>' +
            '<div class="stat ' + (state_published(products) === products.length ? 'stat--ok' : 'stat--warn') + '">' +
              '<div class="stat__lbl">Published</div>' +
              '<div class="stat__n">' + fmt.num(state_published(products)) + '</div>' +
              '<div class="stat__d">' + (products.length - state_published(products)) + ' hidden as draft</div></div>' +
            '<div class="stat stat--warn"><div class="stat__lbl">Open enquiries</div>' +
              '<div class="stat__n">' + fmt.num(open.length) + '</div>' +
              '<div class="stat__d">' + fmt.num(won.length) + ' marked won all-time</div></div>' +
            '<div class="stat stat--gold"><div class="stat__lbl">Quote list value</div>' +
              '<div class="stat__n" style="font-size:1.25rem">On quotation</div>' +
              '<div class="stat__d">B2B — no retail pricing by design</div></div>' +
          '</div>' +

          '<div class="grid grid-2" style="margin-bottom:var(--s5)">' +

            '<div class="card">' +
              '<div class="card__head"><span class="card__title">Enquiries, last 14 days</span>' +
                '<span class="card__sub card__acts">' + fmt.num(enquiries.length) + ' total</span></div>' +
              '<div class="card__body">' +
                (enquiries.length
                  ? '<div class="chart">' + days.map(function (d) {
                      var h = Math.round((d.n / peak) * 100);
                      return '<div class="chart__col" title="' + d.n + ' on ' + d.key + '">' +
                        '<span class="chart__v">' + (d.n || '') + '</span>' +
                        '<div class="chart__bar" style="height:' + Math.max(h, 2) + '%"></div>' +
                        '<span class="chart__k">' + d.label + '</span></div>';
                    }).join('') + '</div>'
                  : emptyState('No enquiries yet', 'Requests from the website contact form land here.')) +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card__head"><span class="card__title">Catalogue by category</span></div>' +
              '<div class="card__body">' +
                (catRows.length
                  ? '<div class="bars">' + catRows.map(function (c) {
                      return '<div class="bars__row">' +
                        '<span class="bars__lbl">' + esc(c.name) + '</span>' +
                        '<span class="bars__val">' + c.n + '</span>' +
                        '<span class="bars__track"><span class="bars__fill" style="width:' +
                          Math.round((c.n / catPeak) * 100) + '%"></span></span></div>';
                    }).join('') + '</div>'
                  : emptyState('No categories', 'Add a category to organise the catalogue.')) +
              '</div>' +
            '</div>' +

          '</div>' +

          '<div class="card">' +
            '<div class="card__head">' +
              '<span class="card__title">Recent activity</span>' +
              '<div class="card__acts">' +
                (P().can(A.user, 'viewAudit')
                  ? '<a class="btn btn--ghost btn--sm" href="#/audit">Full audit log</a>' : '') +
                '<a class="btn btn--primary btn--sm" href="#/products">' + icon('plus') + ' Manage products</a>' +
              '</div>' +
            '</div>' +
            '<div class="card__body">' +
              (audit.length
                ? '<div class="timeline">' + audit.slice(0, 8).map(function (a) {
                    return '<div class="tl"><span class="tl__dot"></span><div class="tl__b">' +
                      '<div class="tl__t">' + esc(a.actorName || a.actor) + ' — ' + esc(a.detail || a.action) + '</div>' +
                      '<div class="tl__m">' + fmt.dateTime(a.at) + ' · ' + esc(a.entity) + '</div>' +
                    '</div></div>';
                  }).join('') + '</div>'
                : emptyState('Nothing logged yet', 'Adding, editing or deleting anything will show up here.')) +
            '</div>' +
          '</div>';
      });
    }
  };

  /* a product counts as published unless explicitly marked draft */
  function state_published(products) {
    return products.filter(function (p) { return p.published !== false; }).length;
  }

  /* =======================================================================
     PRODUCTS — the core screen
     ======================================================================= */

  var prodState = { q: '', cat: 'all', status: 'all', sort: 'updatedAt', dir: 'desc' };

  var products = {
    render: function (root) {
      var canWrite = P().can(A.user, 'create');

      root.innerHTML =
        modeBanner() +
        '<div class="bar">' +
          '<div class="bar__search">' + icon('search') +
            '<input class="input" type="search" id="pQ" placeholder="Search by name, code, fabric or tag…" aria-label="Search products">' +
          '</div>' +
          '<select class="select" id="pCat" aria-label="Filter by category" style="max-width:210px"></select>' +
          '<select class="select" id="pStatus" aria-label="Filter by status" style="max-width:150px">' +
            '<option value="all">All statuses</option>' +
            '<option value="published">Published</option>' +
            '<option value="draft">Draft only</option>' +
          '</select>' +
          '<div class="bar__spacer"></div>' +
          (canWrite ? '<button class="btn btn--primary btn--sm" id="pNew">' + icon('plus') + ' Add product</button>' : '') +
        '</div>' +
        '<div class="card">' +
          '<div class="card__head">' +
            '<span class="card__title">Catalogue</span>' +
            '<span class="card__sub" id="pCount"></span>' +
            '<div class="card__acts">' +
              (P().mode().shared
                ? ''
                : '<button class="btn btn--primary btn--sm" id="pPublish">' + icon('up') + ' Publish to website</button>') +
              '<button class="btn btn--ghost btn--sm" id="pExport">' + icon('down') + ' Backup</button>' +
              (canWrite ? '<button class="btn btn--ghost btn--sm" id="pImportBtn">' + icon('up') + ' Restore</button>' +
              '<input type="file" id="pImportFile" accept=".json">' : '') +
            '</div>' +
          '</div>' +
          '<div class="tbl-wrap"><div id="pTable"></div></div>' +
        '</div>';

      P().list('categories').then(function (cats) {
        $('#pCat').innerHTML = '<option value="all">All categories</option>' +
          cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
      });

      $('#pQ').value = prodState.q;
      $('#pCat').value = prodState.cat;
      $('#pStatus').value = prodState.status;

      $('#pQ').addEventListener('input', function () { prodState.q = this.value.trim(); drawTable(); });
      $('#pCat').addEventListener('change', function () { prodState.cat = this.value; drawTable(); });
      $('#pStatus').addEventListener('change', function () { prodState.status = this.value; drawTable(); });
      if ($('#pNew')) $('#pNew').addEventListener('click', function () { openEditor(null); });
      if ($('#pPublish')) $('#pPublish').addEventListener('click', publishCatalog);
      $('#pExport').addEventListener('click', exportBackup);
      if ($('#pImportBtn')) {
        $('#pImportBtn').addEventListener('click', function () { $('#pImportFile').click(); });
        $('#pImportFile').addEventListener('change', function () {
          if (this.files && this.files[0]) importBackup(this.files[0]);
          this.value = '';
        });
      }

      drawTable();
    }
  };

  var cache = { products: [], cats: [] };

  function drawTable() {
    var host = $('#pTable');
    if (!host) return;

    Promise.all([P().list('products'), P().list('categories')]).then(function (r) {
      cache.products = r[0];
      cache.cats = r[1];

      var rows = cache.products.slice();

      if (prodState.cat !== 'all') {
        rows = rows.filter(function (p) { return p.cat === prodState.cat; });
      }
      if (prodState.status === 'published') rows = rows.filter(function (p) { return p.published !== false; });
      if (prodState.status === 'draft') rows = rows.filter(function (p) { return p.published === false; });
      if (prodState.q) {
        var q = prodState.q.toLowerCase();
        rows = rows.filter(function (p) {
          return [p.name, p.code, p.fabric, p.blurb, (p.tags || []).join(' ')]
            .join(' ').toLowerCase().indexOf(q) > -1;
        });
      }

      var dir = prodState.dir === 'asc' ? 1 : -1;
      rows.sort(function (a, b) {
        var x = a[prodState.sort] || '', y = b[prodState.sort] || '';
        if (x === y) return 0;
        return x > y ? dir : -dir;
      });

      var cnt = $('#pCount');
      if (cnt) {
        cnt.textContent = 'Showing ' + rows.length + ' of ' + cache.products.length +
          (cache.products.length === 1 ? ' product line' : ' product lines');
      }

      if (!rows.length) {
        host.innerHTML = emptyState(
          cache.products.length ? 'Nothing matches that filter' : 'No products yet',
          cache.products.length
            ? 'Try a different search or clear the filters.'
            : 'Add your first product and it will appear on the website straight away.',
          '<button class="btn btn--primary btn--sm" id="pNew2">' + icon('plus') + ' Add product</button>'
        );
        var b = $('#pNew2');
        if (b) b.addEventListener('click', function () { openEditor(null); });
        return;
      }

      var canWrite = P().can(A.user, 'update');
      var canDel = P().can(A.user, 'delete');

      function th(key, label) {
        var on = prodState.sort === key;
        var arrow = on ? (prodState.dir === 'asc' ? ' ↑' : ' ↓') : '';
        return '<th class="is-sortable" data-sort="' + key + '"' +
          (on ? ' style="color:var(--t1)"' : '') + '>' + label + arrow + '</th>';
      }

      host.innerHTML =
        '<table class="tbl"><thead><tr>' +
          th('name', 'Product') +
          th('code', 'Code') +
          '<th>Category</th>' +
          th('moq', 'MOQ') +
          '<th>Status</th>' +
          th('updatedAt', 'Updated') +
          '<th class="acts">Actions</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (p) {
          var cat = cache.cats.filter(function (c) { return c.id === p.cat; })[0];
          var draft = p.published === false;
          return '<tr data-id="' + esc(p.id) + '">' +
            '<td><div class="tbl__name">' +
              '<span class="tbl__thumb">' + (global.NitoFlats ? global.NitoFlats.flat(p.flat) : '') + '</span>' +
              '<span><span class="tbl__name-t">' + esc(p.name || 'Untitled') + '</span>' +
              '<span class="tbl__name-s">' + esc(p.blurb || (p.tags || []).join(' · ') || '—') + '</span></span>' +
            '</div></td>' +
            '<td class="num">' + esc(p.code || '—') + '</td>' +
            '<td>' + esc(cat ? cat.name : p.cat || '—') + '</td>' +
            '<td class="num">' + esc(p.moq || '—') + '</td>' +
            '<td>' + (draft ? '<span class="badge badge--warn">Draft</span>' : '<span class="badge badge--ok">Live</span>') + '</td>' +
            '<td class="num">' + fmt.rel(p.updatedAt || p.createdAt) + '</td>' +
            '<td class="acts">' +
              (canWrite ? '<button class="btn btn--ghost btn--sm" data-edit="' + esc(p.id) + '" title="Edit">' + icon('edit') + '</button> ' : '') +
              (canWrite ? '<button class="btn btn--ghost btn--sm" data-dup="' + esc(p.id) + '" title="Duplicate">' + icon('copy') + '</button> ' : '') +
              (canDel ? '<button class="btn btn--danger-ghost btn--sm" data-del="' + esc(p.id) + '" title="Delete">' + icon('trash') + '</button>' : '') +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';

      $$('th[data-sort]', host).forEach(function (t) {
        t.addEventListener('click', function () {
          var k = t.getAttribute('data-sort');
          if (prodState.sort === k) prodState.dir = prodState.dir === 'asc' ? 'desc' : 'asc';
          else { prodState.sort = k; prodState.dir = 'asc'; }
          drawTable();
        });
      });

      host.addEventListener('click', function (e) {
        var b = e.target.closest('[data-edit],[data-dup],[data-del]');
        if (!b) return;
        if (b.hasAttribute('data-edit')) openEditor(b.getAttribute('data-edit'));
        else if (b.hasAttribute('data-dup')) duplicateProduct(b.getAttribute('data-dup'));
        else askDeleteProduct(b.getAttribute('data-del'));
      });
    });
  }

  /* ---------- product editor ------------------------------------------------ */

  function blankProduct() {
    return {
      code: '', cat: (cache.cats[0] || {}).id || 'teamwear', flat: 'jersey',
      name: '', blurb: '', desc: '', fabric: '', gsm: '', moq: '', sizes: '',
      lead: '', custom: [], styles: [], colors: [], tags: [], published: true,
      images: [], imagePaths: {}
    };
  }

  function openEditor(id) {
    Promise.all([id ? P().get('products', id) : Promise.resolve(null), P().list('categories')])
      .then(function (r) {
        var p = r[0] || blankProduct();
        cache.cats = r[1];
        var isNew = !r[0];
        var flatKeys = global.NitoFlats ? Object.keys(global.NitoFlats.SHAPES) : ['jersey'];

        A.openDrawer(isNew ? 'Add product' : 'Edit product',
          /* ---- body ---- */
          '<div class="card" style="background:var(--ink-800)"><div class="card__body" ' +
            'style="display:grid;place-items:center;padding:var(--s5)">' +
            '<div id="ePrev" style="width:120px">' + (global.NitoFlats ? global.NitoFlats.flat(p.flat) : '') + '</div>' +
          '</div></div>' +

          /* ---- product images -------------------------------------------- */
          /* Optional by design. The SVG tech flat above is a complete product
             image on its own; this section is for the day the owner has real
             photography. It must never look like a required, broken field. */
          '<div class="field"><label class="field__lbl" for="e-img">Product photos ' +
            '<span class="hint">optional — JPG or PNG</span></label>' +
            '<div class="imgset" id="e-imgs"></div>' +
            '<div class="imgset__bar">' +
              '<label class="btn btn--ghost btn--sm imgset__pick">' +
                '<input type="file" id="e-img" accept="image/*" multiple hidden>' +
                (icon('plus') || '') + '<span>Add photos</span>' +
              '</label>' +
              '<span class="imgset__cap" id="e-imgcap"></span>' +
            '</div>' +
            '<span class="hint">Photos are resized in your browser before storage. ' +
              'Until the hosted backend is connected they live in this browser only — ' +
              'export the catalogue to publish them, and keep the exported ' +
              '<b>catalog.js</b> as your master copy of the catalogue.</span>' +
          '</div>' +

          '<div class="grid grid-2">' +
            '<div class="field"><label class="field__lbl" for="e-code">Product code</label>' +
              '<input class="input" id="e-code" value="' + esc(p.code) + '" placeholder="Auto if left blank"></div>' +
            '<div class="field"><label class="field__lbl" for="e-cat">Category</label>' +
              '<select class="select" id="e-cat">' + cache.cats.map(function (c) {
                return '<option value="' + esc(c.id) + '"' + (c.id === p.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
              }).join('') + '</select></div>' +
          '</div>' +

          '<div class="field"><label class="field__lbl" for="e-name">Product name <span class="req">*</span></label>' +
            '<input class="input" id="e-name" value="' + esc(p.name) + '" placeholder="e.g. Football Match Kit"></div>' +

          '<div class="field"><label class="field__lbl" for="e-blurb">Short line <span class="hint">shown on the card</span></label>' +
            '<input class="input" id="e-blurb" value="' + esc(p.blurb) + '"></div>' +

          '<div class="field"><label class="field__lbl" for="e-desc">Full description</label>' +
            '<textarea class="textarea" id="e-desc">' + esc(p.desc) + '</textarea></div>' +

          '<div class="field"><label class="field__lbl" for="e-flat">Garment drawing</label>' +
            '<select class="select" id="e-flat">' + flatKeys.map(function (k) {
              return '<option value="' + esc(k) + '"' + (k === p.flat ? ' selected' : '') + '>' + esc(k) + '</option>';
            }).join('') + '</select>' +
            '<span class="hint">The technical flat shown on the site — no photograph needed.</span></div>' +

          '<div class="grid grid-2">' +
            '<div class="field"><label class="field__lbl" for="e-fabric">Fabric / material</label>' +
              '<input class="input" id="e-fabric" value="' + esc(p.fabric) + '" placeholder="e.g. 100% polyester interlock"></div>' +
            '<div class="field"><label class="field__lbl" for="e-gsm">Weight / GSM</label>' +
              '<input class="input" id="e-gsm" value="' + esc(p.gsm) + '" placeholder="e.g. 150 GSM"></div>' +
          '</div>' +

          '<div class="grid grid-2">' +
            '<div class="field"><label class="field__lbl" for="e-moq">MOQ</label>' +
              '<input class="input" id="e-moq" value="' + esc(p.moq) + '" placeholder="e.g. 30 pcs"></div>' +
            '<div class="field"><label class="field__lbl" for="e-lead">Lead time</label>' +
              '<input class="input" id="e-lead" value="' + esc(p.lead) + '" placeholder="e.g. 3–4 weeks"></div>' +
          '</div>' +

          '<div class="field"><label class="field__lbl" for="e-sizes">Sizes</label>' +
            '<input class="input" id="e-sizes" value="' + esc(p.sizes) + '" placeholder="e.g. Youth XS–XL, Adult S–4XL"></div>' +

          '<div class="field"><label class="field__lbl" for="e-custom">Customization options <span class="hint">one per line</span></label>' +
            '<textarea class="textarea" id="e-custom">' + esc((p.custom || []).join('\n')) + '</textarea></div>' +

          '<div class="field"><label class="field__lbl" for="e-styles">Available styles <span class="hint">one per line</span></label>' +
            '<textarea class="textarea" id="e-styles">' + esc((p.styles || []).join('\n')) + '</textarea></div>' +

          '<div class="field"><label class="field__lbl" for="e-colors">Colours <span class="hint">one per line</span></label>' +
            '<textarea class="textarea" id="e-colors">' + esc((p.colors || []).join('\n')) + '</textarea></div>' +

          '<div class="field"><label class="field__lbl" for="e-tags">Tags <span class="hint">comma separated</span></label>' +
            '<input class="input" id="e-tags" value="' + esc((p.tags || []).join(', ')) + '" placeholder="Core Range, Private Label"></div>' +

          '<label class="check"><input type="checkbox" id="e-pub"' + (p.published !== false ? ' checked' : '') + '>' +
            '<span><b style="color:var(--t1)">Published</b><br>' +
            '<span class="hint">Uncheck to keep this as a draft — it stays out of the public catalogue.</span></span></label>',

          /* ---- foot ---- */
          '<button class="btn btn--primary btn--sm" id="e-save" style="flex:1">' +
            (isNew ? 'Add product' : 'Save changes') + '</button>' +
          '<button class="btn btn--ghost btn--sm" id="e-cancel">Cancel</button>'
        );

        $('#e-flat').addEventListener('change', function () {
          $('#ePrev').innerHTML = global.NitoFlats ? global.NitoFlats.flat(this.value) : '';
        });
        initImageField(p.images, p.imagePaths);
        $('#e-save').addEventListener('click', function () { saveProduct(id, isNew); });
        $('#e-cancel').addEventListener('click', A.closeDrawer);
      });
  }

  /* ---------------------------------------------------------- product images
     State lives on the #e-imgs element rather than in a module variable, so a
     drawer closed and reopened on a different product can never inherit the
     previous product's photos. `baseline` is what publishCatalog() has already
     put on the site for this product — see commitImages(). */
  function imgHost() { return $('#e-imgs'); }

  function imgState() {
    var host = imgHost();
    if (!host) return null;
    if (!host._imgs) {
      host._imgs = [];
      host._base = {};
    }
    return host;
  }

  function initImageField(images, imagePaths) {
    var host = imgState();
    if (!host) return;
    host._imgs = (images || []).filter(Boolean).map(function (r) { return String(r); });
    host._baseRefs = host._imgs.slice();
    host._base = (imagePaths && typeof imagePaths === 'object')
      ? JSON.parse(JSON.stringify(imagePaths)) : {};
    host._removed = [];

    $('#e-img').addEventListener('change', function () {
      if (!global.NitoMedia) {
        A.toast('The image library did not load, so photos cannot be added yet.', 'err');
        return;
      }
      addImages(this.files);
      this.value = '';   /* same file twice in a row must still fire change */
    });
    drawImages();
  }

  function addImages(fileList) {
    var host = imgState();
    if (!host) return;
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    var done = 0;
    var failed = [];
    /* Sequential, not Promise.all: every put() re-reads and re-writes the
       index, and the budget check reads what the last one wrote. Parallel
       uploads would each measure a store that does not yet contain the others
       and could between them blow straight through the cap. */
    function step() {
      if (done >= files.length) {
        drawImages();
        if (failed.length) {
          A.toast(failed.length === 1 ? failed[0]
            : failed.length + ' photos were not added: ' + failed[0], 'err');
        } else {
          A.toast(files.length === 1 ? 'Photo added' : files.length + ' photos added');
        }
        return;
      }
      var f = files[done++];
      global.NitoMedia.put(f).then(function (rec) {
        host._imgs.push(global.NitoMedia.refFor(rec.id));
        /* Newly uploaded bytes are stored, so keep them out of the "just
           saved" baseline — commitImages() must treat them as added. */
      }).catch(function (err) {
        failed.push(err && err.message ? err.message : 'That photo could not be added.');
      }).then(step);
    }
    step();
  }

  function moveImage(idx, delta) {
    var host = imgState();
    if (!host) return;
    var to = idx + delta;
    if (to < 0 || to >= host._imgs.length) return;
    var tmp = host._imgs[to];
    host._imgs[to] = host._imgs[idx];
    host._imgs[idx] = tmp;
    drawImages();
  }

  function dropImage(idx) {
    var host = imgState();
    if (!host) return;
    var ref = host._imgs[idx];
    var id = global.NitoMedia.idOf(ref);
    /* Only drop the stored bytes if nothing else still points at them. The
       same photo used on two colourways of a kit is a normal thing to do, and
       deleting one product's copy must not blank the other. */
    var stillUsed = host._imgs.some(function (r, i) {
      return i !== idx && global.NitoMedia.idOf(r) === id;
    });
    host._imgs.splice(idx, 1);
    if (!stillUsed && global.NitoMedia.isRef(ref) && !host._base[id]) {
      delete host._base[id];
      host._removed.push(id);
    } else if (!stillUsed && global.NitoMedia.isRef(ref)) {
      delete host._base[id];
      host._removed.push(id);
    }
    drawImages();
  }

  function fmtKB(n) {
    if (!n) return '—';
    return n < 1024 * 1024 ? Math.round(n / 1024) + ' KB'
      : (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function drawImages() {
    var host = imgState();
    if (!host) return;
    var imgs = host._imgs;

    if (!imgs.length) {
      host.innerHTML = '<div class="imgset__empty">' +
        'No photo yet — the site shows the technical drawing above. ' +
        'Add a real photo and it takes over automatically.</div>';
    } else {
      host.innerHTML = imgs.map(function (ref, i) {
        var id = global.NitoMedia.idOf(ref);
        var src = global.NitoMedia.resolve(ref, host._base);
        var rec = global.NitoMedia.get(id);
        return '<div class="imgset__item' + (i === 0 ? ' is-lead' : '') + '">' +
          '<div class="imgset__thumb">' +
            (src ? '<img src="' + esc(src) + '" alt="">'
                 : '<span class="imgset__miss">missing</span>') +
            (i === 0 ? '<span class="imgset__badge">Lead</span>' : '') +
          '</div>' +
          '<div class="imgset__meta">' +
            '<span class="imgset__name">' + esc(rec ? rec.name : id) + '</span>' +
            '<span class="imgset__size">' + (rec ? (rec.w + '×' + rec.h + ' · ' + fmtKB(rec.bytes)) : '—') + '</span>' +
          '</div>' +
          '<div class="imgset__acts">' +
            '<button type="button" class="ibtn" data-img-up="' + i + '"' +
              (i === 0 ? ' disabled' : '') + ' aria-label="Move photo up"' +
              ' title="Move up">' + icon('caretUp') + '</button>' +
            '<button type="button" class="ibtn" data-img-down="' + i + '"' +
              (i === imgs.length - 1 ? ' disabled' : '') + ' aria-label="Move photo down"' +
              ' title="Move down">' + icon('caretDn') + '</button>' +
            '<button type="button" class="ibtn ibtn--danger" data-img-del="' + i + '"' +
              ' aria-label="Remove photo" title="Remove">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var cap = $('#e-imgcap');
    /* The meter is cosmetic. If the media library failed to load, the field
       must still render and the rest of the editor must stay usable — a
       convenience readout is not worth throwing over. */
    if (cap && global.NitoMedia) {
      var used = global.NitoMedia.used();
      var pct = Math.min(100, Math.round(used / global.NitoMedia.BUDGET * 100));
      cap.className = 'imgset__cap' + (pct >= 90 ? ' is-high' : pct >= 70 ? ' is-mid' : '');
      cap.textContent = 'Browser image storage ' + fmtKB(used) + ' of ' +
        fmtKB(global.NitoMedia.BUDGET) + ' used (' + pct + '%)';
    }

    /* Delegated, not per-button: drawImages() replaces innerHTML wholesale, so
       handlers bound to the old buttons would be discarded on every redraw. */
    host.onclick = function (ev) {
      var b = ev.target.closest ? ev.target.closest('button') : null;
      if (!b) return;
      if (b.hasAttribute('data-img-up')) moveImage(+b.getAttribute('data-img-up'), -1);
      else if (b.hasAttribute('data-img-down')) moveImage(+b.getAttribute('data-img-down'), 1);
      else if (b.hasAttribute('data-img-del')) dropImage(+b.getAttribute('data-img-del'));
    };
  }

  /* Called by saveProduct once the record has been written. Turns the editor's
     pending image list into the two fields the site and the export read:
       images      — the ordered refs the site renders
       imagePaths  — id -> URL for anything the owner published themselves

     A ref is only recorded in `images` if it can actually resolve here. Storing
     a ref whose bytes are gone would put a ref-shaped hole on the public site,
     so unreachable ones are held back and reported instead of being saved. */
  function commitImages(id) {
    var host = imgHost();
    if (!host || !host._imgs) return Promise.resolve({ dropped: 0 });

    var paths = JSON.parse(JSON.stringify(host._base || {}));
    var imgs = [], missing = [];

    if (!global.NitoMedia) {
      /* The library did not load. Hold on to whatever is already on the
         product rather than writing an empty array over it. */
      (host._baseRefs || []).forEach(function (r) { imgs.push(r); });
    } else {
      host._imgs.forEach(function (ref) {
        var rid = global.NitoMedia.idOf(ref);
        var thumb = global.NitoMedia.resolve(ref, paths);
        if (!thumb) { missing.push(rid); return; }
        imgs.push(ref);
        /* Publishing the thumbnail, not the full frame, is what keeps an
           exported catalog.js uploadable. The grid renders 12 at a time at
           ~280px, so a 420px JPEG is more than enough and is roughly a tenth
           of the weight. */
        paths[rid] = thumb;
      });
    }

    var patch = { images: imgs, imagePaths: paths };
    return P().update('products', id, patch).then(function () {
      host._removed.forEach(function (rid) { global.NitoMedia.remove(rid); });
      host._removed = [];
      host._base = paths;
      if (missing.length) {
        A.toast(missing.length + ' photo' + (missing.length === 1 ? '' : 's') +
          ' could not be read and ' + (missing.length === 1 ? 'was' : 'were') +
          ' left off this product.', 'err');
      }
      return { dropped: missing.length };
    });
  }

  function lines(v) {
    return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function saveProduct(id, isNew) {
    var name = $('#e-name').value.trim();
    if (!name) { A.toast('A product name is required', 'err'); $('#e-name').focus(); return; }

    var cat = $('#e-cat').value;
    var catIndex = Math.max(0, cache.cats.map(function (c) { return c.id; }).indexOf(cat));

    var data = {
      code: $('#e-code').value.trim() || P().nextCode(cache.products, catIndex),
      cat: cat,
      flat: $('#e-flat').value,
      name: name,
      blurb: $('#e-blurb').value.trim(),
      desc: $('#e-desc').value.trim(),
      fabric: $('#e-fabric').value.trim(),
      gsm: $('#e-gsm').value.trim(),
      moq: $('#e-moq').value.trim(),
      sizes: $('#e-sizes').value.trim(),
      lead: $('#e-lead').value.trim(),
      custom: lines($('#e-custom').value),
      styles: lines($('#e-styles').value),
      colors: lines($('#e-colors').value),
      tags: String($('#e-tags').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      published: $('#e-pub').checked
    };

    var op = isNew
      ? P().create('products', data)
      : P().update('products', id, data);

    op.then(function (row) {
      /* The product row must exist before its images can be attached, so this
         is a second write rather than part of `data`. On a create, `row.id` is
         the only place the generated id is available. */
      var pid = id || (row && row.id);
      if (!pid) return null;
      return commitImages(pid).then(function () { return pid; });
    }).then(function (pid) {
      return P().log(A.user, isNew ? 'create' : 'update', 'product', pid || data.code,
        (isNew ? 'Added ' : 'Updated ') + name);
    }).then(function () {
      A.closeDrawer();
      /* The success wording MUST match what actually happened. Until the hosted
         backend is connected, saving writes to this browser only and the public
         pages keep reading the static catalog.js — so a product is NOT live yet,
         it needs "Publish to website" and an upload first. Claiming "it is live
         on the site" here would be a straightforward lie to the operator, and a
         costly one: they would tell a customer a product is up when it is not.
         When the backend is shared, saving really does publish directly. */
      var shared = P().mode().shared;
      if (isNew) {
        A.toast(shared
          ? 'Product added — it is live on the site'
          : 'Product saved in this browser — use "Publish to website" to put it on the site');
      } else {
        A.toast(shared ? 'Changes saved and published' : 'Changes saved in this browser');
      }
      drawTable();
      updateSideCounts();
    }).catch(function (err) {
      A.toast(err && err.message ? err.message : 'Could not save', 'err');
    });
  }

  function duplicateProduct(id) {
    P().get('products', id).then(function (p) {
      if (!p) return;
      var copy = JSON.parse(JSON.stringify(p));
      delete copy.id;
      copy.name = p.name + ' (copy)';
      copy.code = '';
      copy.published = false;
      return P().create('products', copy).then(function () {
        return P().log(A.user, 'create', 'product', copy.name, 'Duplicated ' + p.name);
      }).then(function () {
        A.toast('Duplicated as a draft — edit it and publish when ready');
        drawTable();
      });
    });
  }

  function askDeleteProduct(id) {
    P().get('products', id).then(function (p) {
      if (!p) return;
      A.confirm({
        title: 'Delete this product?',
        body: '<p><b style="color:var(--t1)">' + esc(p.name) + '</b> (' + esc(p.code) + ') will be removed ' +
              'from the catalogue and will disappear from the website immediately.</p>' +
              '<p style="margin:0">This cannot be undone.</p>',
        ok: 'Delete product', danger: true,
        onOk: function () {
          P().remove('products', id)
            .then(function () { return P().log(A.user, 'delete', 'product', p.code, 'Deleted ' + p.name); })
            .then(function () {
              A.toast('Product deleted');
              drawTable();
              updateSideCounts();
            })
            .catch(function (err) { A.toast(err && err.message || 'Could not delete', 'err'); });
        }
      });
    });
  }

  /* ---------- publish to the live website ---------------------------------- */
  /* This is the step that actually puts a product in front of a customer.
     Until the hosted backend is connected the public pages read the static
     assets/js/catalog.js, so a product saved here lives only in this browser
     until it is exported and uploaded. Saying that plainly matters: an admin
     that implies it has published when it has not is worse than no admin. */

  function publishCatalog() {
    Promise.all([P().list('products'), P().list('categories')]).then(function (r) {
      var products = r[0], cats = r[1];

      /* Only published lines go to the live site. Drafts stay in the console. */
      var live = products.filter(function (p) { return p.published !== false; });
      var drafts = products.length - live.length;

      /* Strip console-only bookkeeping so the site file stays clean. */
      var M = global.NitoMedia;
      var unresolved = 0, photoLines = 0;

      var cleanProducts = live.map(function (p) {
        var c = JSON.parse(JSON.stringify(p));
        delete c.published;
        delete c.createdAt;
        delete c.updatedAt;
        delete c.imagePaths;

        /* An uploaded photo is stored as a small reference plus a data: URL in
           the media store. The exported file has no sidecar folder, so the
           reference is replaced by the picture itself — otherwise every photo
           the operator uploads would arrive on the live site as a broken box. */
        if (M && Array.isArray(c.images)) {
          var out = [];
          c.images.forEach(function (ref) {
            var src = M.resolveFull(ref, p.imagePaths);
            if (src) out.push(src); else unresolved++;
          });
          c.images = out;
          if (out.length) photoLines++;
        } else if (!c.images) {
          c.images = [];
        }
        return c;
      });

      var header =
        '/* ==========================================================================\n' +
        '   NITO SPORTS — Product Catalog\n' +
        '   Exported from the console on ' +
        new Date().toISOString().slice(0, 16).replace('T', ' ') + '\n' +
        '   Upload this file over assets/js/catalog.js on your live site.\n' +
        '   ' + cleanProducts.length + ' published product lines' +
        (drafts ? ' (' + drafts + ' draft' + (drafts === 1 ? '' : 's') + ' held back)' : '') +
        (photoLines ? '\n   ' + photoLines + ' line' + (photoLines === 1 ? '' : 's') +
          ' carry product photos embedded in this file' : '') + '\n' +
        '   ========================================================================== */\n\n';

      var out = header +
        'window.NITO_SITE = ' + JSON.stringify(global.NITO_SITE || {}, null, 2) + ';\n\n' +
        'window.NITO_PAYMENTS = ' + JSON.stringify(global.NITO_PAYMENTS || [], null, 2) + ';\n\n' +
        'window.NITO_CATALOG = ' + JSON.stringify({
          categories: cats,
          products: cleanProducts
        }, null, 2) + ';\n';

      var blob = new Blob([out], { type: 'text/javascript;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'catalog.js';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

      P().log(A.user, 'publish', 'catalog', 'catalog.js',
        'Exported ' + cleanProducts.length + ' product lines to catalog.js');

      A.toast('catalog.js downloaded — upload it to publish ' +
        cleanProducts.length + ' lines');
      if (unresolved) {
        /* Silence here would be the worst outcome: the operator would ship a
           catalogue with holes in it and only find out from a customer. */
        A.toast(unresolved + ' stored photo' + (unresolved === 1 ? '' : 's') +
          ' could not be read and ' + (unresolved === 1 ? 'was' : 'were') +
          ' left out of the export.', 'err');
      }
      /* A big export is worth a word, because uploading a multi-megabyte
         catalog.js is a different job from uploading a 50 KB one. */
      var kb = Math.round(out.length / 1024);
      if (kb > 900) {
        A.toast('Heads-up: the exported file is about ' + kb +
          ' KB because of the embedded photos. Your web host should accept it, ' +
          'but a slower connection will notice.', 'err');
      }
    });
  }

  /* ---------- backup / restore --------------------------------------------- */

  function exportBackup() {
    Promise.all([P().list('products'), P().list('categories'), P().list('enquiries')])
      .then(function (r) {
        var payload = { exportedAt: new Date().toISOString(), products: r[0], categories: r[1], enquiries: r[2] };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'nitosports-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        A.toast('Backup downloaded');
      });
  }

  function importBackup(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var data;
      try { data = JSON.parse(String(fr.result)); } catch (e) { A.toast('That file is not valid JSON', 'err'); return; }
      if (!data || !Array.isArray(data.products)) { A.toast('That is not a NITO backup file', 'err'); return; }
      A.confirm({
        title: 'Restore this backup?',
        body: '<p>The backup contains <b style="color:var(--t1)">' + data.products.length +
              ' products</b>, exported ' + esc(fmt.date(data.exportedAt)) + '.</p>' +
              '<p style="margin:0">Restoring replaces your current catalogue. This cannot be undone.</p>',
        ok: 'Restore', danger: true,
        onOk: function () {
          P().replaceAll({ products: data.products, categories: data.categories || cache.cats })
            .then(function () {
              A.toast('Backup restored');
              drawTable();
              updateSideCounts();
            })
            .catch(function (err) {
              A.toast(err && err.message ? err.message : 'Restore is only available on the local store', 'err');
            });
        }
      });
    };
    fr.readAsText(file);
  }

  function updateSideCounts() {
    P().list('products').then(function (rows) {
      var m = P().mode();
      A.state.counts.products = rows.length;
    });
  }

  /* =======================================================================
     CATEGORIES
     ======================================================================= */

  var categories = {
    render: function (root) {
      var canWrite = P().can(A.user, 'update');
      root.innerHTML = modeBanner() +
        '<div class="card"><div class="card__head">' +
          '<span class="card__title">Categories</span>' +
          '<span class="card__sub">The five divisions every product belongs to</span>' +
          '<div class="card__acts">' +
            (canWrite ? '<button class="btn btn--ghost btn--sm" id="cNew">' + icon('plus') + ' Add category</button>' : '') +
          '</div>' +
        '</div><div class="card__body" id="cBody"></div></div>';

      if ($('#cNew')) $('#cNew').addEventListener('click', function () { editCat(null); });
      draw();
    }
  };

  function draw() {
    Promise.all([P().list('categories'), P().list('products')]).then(function (r) {
      var cats = r[0], products = r[1];
      var per = countBy(products, 'cat');
      var canWrite = P().can(A.user, 'update');

      $('#cBody').innerHTML = cats.length
        ? '<div class="stack stack-3">' + cats.map(function (c) {
            return '<div class="card" style="background:var(--ink-850)"><div class="card__body" ' +
              'style="display:flex;align-items:center;gap:var(--s4);flex-wrap:wrap">' +
              '<span class="tbl__thumb">' + (global.NitoFlats ? global.NitoFlats.flat(c.flat) : '') + '</span>' +
              '<div style="flex:1;min-width:180px">' +
                '<div style="color:var(--t1);font-weight:600">' + esc(c.name) + '</div>' +
                '<div class="hint">' + esc(c.short || c.blurb || '') + '</div>' +
              '</div>' +
              '<span class="badge">' + (per[c.id] || 0) + ' products</span>' +
              (canWrite ? '<button class="btn btn--ghost btn--sm" data-cedit="' + esc(c.id) + '">' + icon('edit') + '</button>' : '') +
            '</div></div>';
          }).join('') + '</div>'
        : emptyState('No categories', 'Add a category to group your products.');

      $$('[data-cedit]').forEach(function (b) {
        b.addEventListener('click', function () { editCat(b.getAttribute('data-cedit')); });
      });
    });
  }

  function editCat(id) {
    Promise.all([id ? P().get('categories', id) : Promise.resolve(null),
                 P().list('categories')]).then(function (r) {
      var c = r[0] || { name: '', short: '', flat: 'jersey', num: String(r[1].length + 1).padStart(2, '0') };
      var isNew = !r[0];
      var flatKeys = global.NitoFlats ? Object.keys(global.NitoFlats.SHAPES) : ['jersey'];

      A.openDrawer(isNew ? 'Add category' : 'Edit category',
        '<div class="field"><label class="field__lbl" for="c-name">Name <span class="req">*</span></label>' +
          '<input class="input" id="c-name" value="' + esc(c.name) + '" placeholder="e.g. Sportswear & Teamwear"></div>' +
        '<div class="field"><label class="field__lbl" for="c-short">Short description</label>' +
          '<input class="input" id="c-short" value="' + esc(c.short || '') + '"></div>' +
        '<div class="field"><label class="field__lbl" for="c-blurb">Long description</label>' +
          '<textarea class="textarea" id="c-blurb">' + esc(c.blurb || '') + '</textarea></div>' +
        '<div class="grid grid-2">' +
          '<div class="field"><label class="field__lbl" for="c-num">Number</label>' +
            '<input class="input" id="c-num" value="' + esc(c.num || '') + '" placeholder="01"></div>' +
          '<div class="field"><label class="field__lbl" for="c-flat">Drawing</label>' +
            '<select class="select" id="c-flat">' + flatKeys.map(function (k) {
              return '<option value="' + esc(k) + '"' + (k === c.flat ? ' selected' : '') + '>' + esc(k) + '</option>';
            }).join('') + '</select></div>' +
        '</div>',
        '<button class="btn btn--primary btn--sm" id="c-save" style="flex:1">' +
          (isNew ? 'Add category' : 'Save') + '</button>' +
        '<button class="btn btn--ghost btn--sm" id="c-cancel">Cancel</button>'
      );

      $('#c-cancel').addEventListener('click', A.closeDrawer);
      $('#c-save').addEventListener('click', function () {
        var name = $('#c-name').value.trim();
        if (!name) { A.toast('A category name is required', 'err'); return; }
        var data = {
          name: name, short: $('#c-short').value.trim(), blurb: $('#c-blurb').value.trim(),
          num: $('#c-num').value.trim(), flat: $('#c-flat').value
        };
        if (isNew) data.id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

        var op = isNew ? P().create('categories', data) : P().update('categories', id, data);
        op.then(function () {
          return P().log(A.user, isNew ? 'create' : 'update', 'category', data.id || id, name);
        }).then(function () {
          A.closeDrawer();
          A.toast(isNew ? 'Category added' : 'Category saved');
          draw();
        }).catch(function (err) { A.toast(err && err.message || 'Could not save', 'err'); });
      });
    });
  }

  /* =======================================================================
     ENQUIRIES — the CRM inbox
     ======================================================================= */

  var enqState = { status: 'all', q: '' };

  var enquiries = {
    render: function (root) {
      root.innerHTML = modeBanner() +
        '<div class="bar">' +
          '<div class="bar__search">' + icon('search') +
            '<input class="input" type="search" id="qQ" placeholder="Search by buyer, company or reference…" aria-label="Search enquiries">' +
          '</div>' +
          '<select class="select" id="qStatus" aria-label="Filter by status" style="max-width:180px">' +
            '<option value="all">All statuses</option>' +
            '<option value="new">New</option><option value="contacted">Contacted</option>' +
            '<option value="quoted">Quoted</option><option value="won">Won</option>' +
            '<option value="lost">Lost</option>' +
          '</select>' +
          '<div class="bar__spacer"></div>' +
          '<button class="btn btn--ghost btn--sm" id="qCsv">' + icon('down') + ' Export CSV</button>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card__head"><span class="card__title">Enquiries</span>' +
            '<span class="card__sub" id="qCount"></span></div>' +
          '<div class="tbl-wrap"><div id="qTable"></div></div>' +
        '</div>';

      $('#qQ').value = enqState.q;
      $('#qStatus').value = enqState.status;
      $('#qQ').addEventListener('input', function () { enqState.q = this.value.trim(); drawQ(); });
      $('#qStatus').addEventListener('change', function () { enqState.status = this.value; drawQ(); });
      $('#qCsv').addEventListener('click', exportEnquiriesCsv);

      /* Pick up anything the public form queued while this console was closed,
         so opening the inbox is enough — the operator should not have to know
         that a separate import step exists. */
      var A = global.NitoAdmin;
      if (A && A.drainEnquiries) {
        A.drainEnquiries().then(function (res) {
          if (res && res.moved) {
            A.toast(res.moved + ' new enquir' + (res.moved === 1 ? 'y' : 'ies') + ' imported from the website');
          }
          drawQ();
        }, drawQ);
      } else {
        drawQ();
      }
    }
  };

  /* CSV, not a screenshot. A quotation follow-up happens in a spreadsheet or a
     mail merge, and an operator who can only read the inbox on screen ends up
     retyping every lead by hand. Columns are the fields needed to answer the
     enquiry, in the order a person would read them. */
  function csvCell(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    /* A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
       A buyer's message starting with "-" would execute. Prefixing with an
       apostrophe keeps it text and is the standard mitigation. */
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  }

  function exportEnquiriesCsv() {
    P().list('enquiries').then(function (all) {
      if (!all.length) { A.toast('There are no enquiries to export', 'err'); return; }
      var cols = [
        ['ref', 'Reference'], ['createdAt', 'Received'], ['status', 'Status'],
        ['name', 'Buyer'], ['company', 'Company'], ['country', 'Country'],
        ['email', 'E-mail'], ['phone', 'WhatsApp'], ['product', 'Product'],
        ['qty', 'Quantity'], ['sizes', 'Sizes'], ['deadline', 'Needed by'],
        ['custom', 'Customization'], ['message', 'Message'], ['notes', 'Internal notes']
      ];
      var lines = [cols.map(function (c) { return csvCell(c[1]); }).join(',')];
      all.slice().sort(function (a, b) {
        return String(b.createdAt || '') > String(a.createdAt || '') ? 1 : -1;
      }).forEach(function (e) {
        lines.push(cols.map(function (c) { return csvCell(e[c[0]]); }).join(','));
      });

      /* A BOM so Excel opens UTF-8 correctly — buyer names with accents and
         country names in local script are common on an export business. */
      var blob = new Blob(['\ufeff' + lines.join('\r\n')],
        { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nitosports-enquiries-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

      P().log(A.user, 'export', 'enquiry', 'enquiries.csv',
        'Exported ' + all.length + ' enquiries to CSV');
      A.toast('Exported ' + all.length + ' enquiries to CSV');
    });
  }

  function drawQ() {
    P().list('enquiries').then(function (all) {
      var rows = all.slice().sort(function (a, b) {
        return String(b.createdAt || '') > String(a.createdAt || '') ? 1 : -1;
      });
      if (enqState.status !== 'all') {
        rows = rows.filter(function (e) { return (e.status || 'new') === enqState.status; });
      }
      if (enqState.q) {
        var q = enqState.q.toLowerCase();
        rows = rows.filter(function (e) {
          return [e.name, e.company, e.email, e.phone, e.ref, e.product].join(' ').toLowerCase().indexOf(q) > -1;
        });
      }

      var c = $('#qCount');
      if (c) c.textContent = rows.length + ' of ' + all.length;

      var host = $('#qTable');
      if (!rows.length) {
        host.innerHTML = emptyState(
          all.length ? 'Nothing matches' : 'No enquiries yet',
          all.length ? 'Try a different search or status.' :
            'When a buyer sends the form on the contact page, the request lands here.'
        );
        return;
      }

        host.innerHTML =
        '<table class="tbl"><thead><tr>' +
          '<th>Buyer</th><th>Reference</th><th>Product</th><th>Status</th><th>Received</th><th class="acts"></th>' +
        '</tr></thead><tbody>' +
        rows.map(function (e) {
          return '<tr data-id="' + esc(e.id) + '">' +
            '<td><span class="tbl__name-t">' + esc(e.name || '—') + '</span>' +
              '<span class="tbl__name-s">' + esc(e.company || e.email || '') + '</span></td>' +
            '<td class="num">' + esc(e.ref || '—') + '</td>' +
            '<td>' + esc(e.product || '—') + '</td>' +
            '<td>' + statusBadge(e.status || 'new') + '</td>' +
            '<td class="num">' + fmt.rel(e.createdAt) + '</td>' +
            '<td class="acts"><button class="btn btn--ghost btn--sm" data-open="' + esc(e.id) +
              '" aria-label="Open enquiry ' + esc(e.ref || e.name || '') + '">Open</button></td>' +
          '</tr>';
        }).join('') + '</tbody></table>';

      $$('[data-open]', host).forEach(function (b) {
        b.addEventListener('click', function () { openEnquiry(b.getAttribute('data-open')); });
      });
    });
  }

  function openEnquiry(id) {
    P().get('enquiries', id).then(function (e) {
      if (!e) return;
      var canW = P().can(A.user, 'update');

      A.openDrawer(e.name + ' — ' + (e.ref || 'enquiry'),
        '<div style="display:flex;gap:var(--s3);flex-wrap:wrap">' + statusBadge(e.status || 'new') +
          '<span class="badge">' + esc(fmt.dateTime(e.createdAt)) + '</span></div>' +

        '<div class="card" style="background:var(--ink-800)"><div class="card__body">' +
          '<dl class="dl">' +
            '<dt>Buyer</dt><dd>' + esc(e.name || '—') + '</dd>' +
            '<dt>Company</dt><dd>' + esc(e.company || '—') + '</dd>' +
            '<dt>Country</dt><dd>' + esc(e.country || '—') + '</dd>' +
            '<dt>E-mail</dt><dd>' + (e.email ? '<a href="mailto:' + esc(e.email) + '" style="color:var(--blue-300)">' + esc(e.email) + '</a>' : '—') + '</dd>' +
            '<dt>WhatsApp</dt><dd>' + (e.phone ? '<a href="https://wa.me/' + esc(String(e.phone).replace(/[^0-9]/g, '')) + '" target="_blank" rel="noopener" style="color:var(--blue-300)">' + esc(e.phone) + '</a>' : '—') + '</dd>' +
            '<dt>Product</dt><dd>' + esc(e.product || '—') + '</dd>' +
            '<dt>Quantity</dt><dd>' + esc(e.qty || '—') + '</dd>' +
            '<dt>Sizes</dt><dd>' + esc(e.sizes || '—') + '</dd>' +
            '<dt>Needed by</dt><dd>' + esc(e.deadline || '—') + '</dd>' +
            '<dt>Customization</dt><dd>' + esc(e.custom || '—') + '</dd>' +
            '<dt>Message</dt><dd>' + esc(e.message || '—') + '</dd>' +
            '<dt>Reference</dt><dd class="num">' + esc(e.ref || '—') + '</dd>' +
          '</dl>' +
        '</div></div>' +

        (e.items && e.items.length
          ? '<div class="card" style="background:var(--ink-800)"><div class="card__head">' +
              '<span class="card__title">Quote list</span></div><div class="card__body">' +
              '<div class="stack stack-2">' + e.items.map(function (it) {
                return '<div style="display:flex;gap:var(--s3);justify-content:space-between;font-size:.8125rem">' +
                  '<span style="color:var(--t1)">' + esc(it.name || it.id) + '</span>' +
                  '<span class="num">' + esc(it.qty || '—') + ' · ' + esc(it.code || '') + '</span></div>';
              }).join('') + '</div></div></div>'
          : '') +

        '<div class="field"><label class="field__lbl" for="q-status">Status</label>' +
          '<select class="select" id="q-status">' +
            ['new', 'contacted', 'quoted', 'won', 'lost'].map(function (s) {
              return '<option value="' + s + '"' + ((e.status || 'new') === s ? ' selected' : '') + '>' +
                s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
            }).join('') + '</select></div>' +

        '<div class="field"><label class="field__lbl" for="q-notes">Internal notes <span class="hint">never shown to the buyer</span></label>' +
          '<textarea class="textarea" id="q-notes" placeholder="What you quoted, when you followed up…">' + esc(e.notes || '') + '</textarea></div>',

        canW
          ? '<button class="btn btn--primary btn--sm" id="q-save" style="flex:1">Save</button>' +
            '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" ' +
              'href="mailto:' + esc(e.email || '') + '?subject=' + encodeURIComponent('Re: your enquiry ' + (e.ref || '')) + '">Reply</a>'
          : '<button class="btn btn--ghost btn--sm" id="q-cancel" style="flex:1">Close</button>'
      );

      var cancel = $('#q-cancel');
      if (cancel) cancel.addEventListener('click', A.closeDrawer);

      var save = $('#q-save');
      if (save) save.addEventListener('click', function () {
        P().update('enquiries', id, { status: $('#q-status').value, notes: $('#q-notes').value.trim() })
          .then(function () {
            return P().log(A.user, 'update', 'enquiry', e.ref || id,
              'Enquiry ' + (e.ref || '') + ' → ' + $('#q-status').value);
          })
          .then(function () {
            A.closeDrawer(); A.toast('Enquiry updated'); drawQ(); A.refreshCounts();
          })
          .catch(function (err) { A.toast(err && err.message || 'Could not save', 'err'); });
      });
    });
  }

  /* =======================================================================
     CUSTOMERS
     ======================================================================= */

  var customers = {
    render: function (root) {
      root.innerHTML = modeBanner() +
        '<div class="card"><div class="card__head">' +
          '<span class="card__title">Customers</span>' +
          '<span class="card__sub">Buyers who created an account</span>' +
        '</div><div class="card__body" id="cuBody"></div></div>';

      Promise.all([P().list('customers'), P().list('enquiries')]).then(function (r) {
        var cs = r[0], enq = r[1];
        var host = $('#cuBody');

        if (!cs.length) {
          host.innerHTML = emptyState(
            'No buyer accounts',
            'Buyer accounts are not available yet — this console has a single staff login and no ' +
            'public sign-up, so nothing can create a customer record. This list fills itself once ' +
            'a hosted backend is connected. Enquiries still appear under Enquiries either way.'
          );
          return;
        }

        host.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
          '<th>Customer</th><th>Country</th><th>Enquiries</th><th>Joined</th><th class="acts"></th>' +
          '</tr></thead><tbody>' +
          cs.map(function (c) {
            var n = enq.filter(function (e) { return e.email === c.email; }).length;
            return '<tr><td><div class="tbl__name">' +
              '<span class="side__avatar" style="width:34px;height:34px;font-size:.75rem">' +
                esc(A.initials(c.name || c.email)) + '</span>' +
              '<span><span class="tbl__name-t">' + esc(c.name || '—') + '</span>' +
              '<span class="tbl__name-s">' + esc(c.email || '') + '</span></span></div></td>' +
              '<td>' + esc(c.country || '—') + '</td>' +
              '<td class="num">' + n + '</td>' +
              '<td class="num">' + fmt.date(c.createdAt) + '</td>' +
              '<td class="acts"><a class="btn btn--ghost btn--sm" href="mailto:' + esc(c.email || '') + '">E-mail</a></td>' +
            '</tr>';
          }).join('') + '</tbody></table></div>';
      });
    }
  };

  /* =======================================================================
     TEAM
     ======================================================================= */

  var team = {
    render: function (root) {
      var canManage = P().can(A.user, 'manageTeam');
      root.innerHTML = modeBanner() +
        '<div class="card"><div class="card__head">' +
          '<span class="card__title">Team</span>' +
          '<span class="card__sub">Who can sign in, and what they can do</span>' +
          '<div class="card__acts">' +
            (canManage ? '<button class="btn btn--primary btn--sm" id="tInvite">' + icon('plus') + ' Add member</button>' : '') +
          '</div>' +
        '</div><div class="card__body" id="tBody"></div></div>' +
        '<div class="card" style="margin-top:var(--s5)"><div class="card__head">' +
          '<span class="card__title">What each role can do</span></div><div class="card__body">' +
          '<div class="tbl-wrap"><table class="tbl" style="min-width:520px"><thead><tr>' +
            '<th>Role</th><th>View</th><th>Edit products</th><th>Delete</th><th>Team &amp; audit</th>' +
          '</tr></thead><tbody>' +
            roleRow('Owner',  true, true, true, true) +
            roleRow('Admin',  true, true, true, true) +
            roleRow('Editor', true, true, false, false) +
            roleRow('Viewer', true, false, false, false) +
          '</tbody></table></div>' +
          '<p class="hint" style="margin-top:var(--s4)">Roles are enforced in the console itself. ' +
          'Once the hosted backend is connected they are also enforced on the server, which is ' +
          'what makes them a real permission boundary.</p>' +
        '</div></div>';

      if ($('#tInvite')) $('#tInvite').addEventListener('click', function () { editMember(null); });
      drawTeam();
    }
  };

  function roleRow(name, view, edit, del, admin) {
    function cell(on) {
      return '<td>' + (on
        ? '<span style="color:var(--ok)">' + icon('check') + '</span>'
        : '<span style="color:var(--t5)">—</span>') + '</td>';
    }
    return '<tr><td class="strong">' + esc(name) + '</td>' + cell(view) + cell(edit) + cell(del) + cell(admin) + '</tr>';
  }

  function drawTeam() {
    P().list('team').then(function (rows) {
      var canManage = P().can(A.user, 'manageTeam');
      var host = $('#tBody');

      if (!rows.length) {
        host.innerHTML = emptyState(
          'No additional team members',
          'You are signed in as the owner. Add someone here to give them their own login.',
          canManage ? '<button class="btn btn--primary btn--sm" id="tInvite2">' + icon('plus') + ' Add member</button>' : ''
        );
        var b = $('#tInvite2');
        if (b) b.addEventListener('click', function () { editMember(null); });
        return;
      }

      host.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        '<th>Member</th><th>Role</th><th>Added</th><th class="acts"></th></tr></thead><tbody>' +
        rows.map(function (m) {
          return '<tr><td><div class="tbl__name">' +
            '<span class="side__avatar" style="width:34px;height:34px;font-size:.75rem">' +
              esc(A.initials(m.name || m.email)) + '</span>' +
            '<span><span class="tbl__name-t">' + esc(m.name || '—') + '</span>' +
            '<span class="tbl__name-s">' + esc(m.email || '') + '</span></span></div></td>' +
            '<td>' + roleBadge(m.role) + '</td>' +
            '<td class="num">' + fmt.date(m.createdAt) + '</td>' +
            '<td class="acts">' +
              (canManage ? '<button class="btn btn--ghost btn--sm" data-tedit="' + esc(m.id) + '">' + icon('edit') + '</button> ' : '') +
              (canManage ? '<button class="btn btn--danger-ghost btn--sm" data-tdel="' + esc(m.id) + '">' + icon('trash') + '</button>' : '') +
            '</td></tr>';
        }).join('') + '</tbody></table></div>';

      $$('[data-tedit]', host).forEach(function (b) {
        b.addEventListener('click', function () { editMember(b.getAttribute('data-tedit')); });
      });
      $$('[data-tdel]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-tdel');
          P().get('team', id).then(function (m) {
            A.confirm({
              title: 'Remove this member?',
              body: '<p><b style="color:var(--t1)">' + esc(m.name || m.email) +
                    '</b> will lose access to the console.</p><p style="margin:0">Their past changes stay in the audit log.</p>',
              ok: 'Remove', danger: true,
              onOk: function () {
                P().remove('team', id).then(function () {
                  return P().log(A.user, 'delete', 'team', m.email, 'Removed ' + (m.name || m.email));
                }).then(function () { A.toast('Member removed'); drawTeam(); });
              }
            });
          });
        });
      });
    });
  }

  function editMember(id) {
    Promise.all([id ? P().get('team', id) : Promise.resolve(null)]).then(function (r) {
      var m = r[0] || { name: '', email: '', role: 'editor' };
      var isNew = !r[0];

      A.openDrawer(isNew ? 'Add team member' : 'Edit team member',
        '<div class="field"><label class="field__lbl" for="t-name">Name</label>' +
          '<input class="input" id="t-name" value="' + esc(m.name) + '" placeholder="Their full name"></div>' +
        '<div class="field"><label class="field__lbl" for="t-email">E-mail <span class="req">*</span></label>' +
          '<input class="input" type="email" id="t-email" value="' + esc(m.email) + '" placeholder="them@nitosports.com"></div>' +
        '<div class="field"><label class="field__lbl" for="t-role">Role</label>' +
          '<select class="select" id="t-role">' +
            [['editor', 'Editor — can add and edit products'], ['admin', 'Admin — full catalogue access'],
             ['viewer', 'Viewer — read only']].map(function (o) {
              return '<option value="' + o[0] + '"' + (m.role === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
            }).join('') + '</select>' +
          '<span class="hint">Ownership can only be transferred by the current owner.</span></div>' +
        '<div class="field" style="background:var(--warn-wash);border:1px solid rgba(251,191,36,.3);' +
          'border-radius:var(--r-sm);padding:12px 14px">' +
          '<div style="display:flex;gap:10px;font-size:.8125rem;color:#fcd34d">' + icon('warn') +
          '<span>Team members sign in with the hosted backend. Until it is connected, this list ' +
          'records who should have access but does not grant a working password.</span></div></div>',
        '<button class="btn btn--primary btn--sm" id="t-save" style="flex:1">' +
          (isNew ? 'Add member' : 'Save') + '</button>' +
        '<button class="btn btn--ghost btn--sm" id="t-cancel">Cancel</button>'
      );

      $('#t-cancel').addEventListener('click', A.closeDrawer);
      $('#t-save').addEventListener('click', function () {
        var email = $('#t-email').value.trim();
        if (!email) { A.toast('An e-mail address is required', 'err'); return; }
        var data = { name: $('#t-name').value.trim(), email: email, role: $('#t-role').value };
        var op = isNew ? P().create('team', data) : P().update('team', id, data);
        op.then(function () {
          return P().log(A.user, isNew ? 'create' : 'update', 'team', email,
            (isNew ? 'Added ' : 'Updated ') + email + ' as ' + data.role);
        }).then(function () {
          A.closeDrawer(); A.toast(isNew ? 'Member added' : 'Member saved'); drawTeam();
        }).catch(function (err) { A.toast(err && err.message || 'Could not save', 'err'); });
      });
    });
  }

  /* =======================================================================
     AUDIT LOG
     ======================================================================= */

  var audit = {
    render: function (root) {
      root.innerHTML = modeBanner() +
        '<div class="card"><div class="card__head">' +
          '<span class="card__title">Audit log</span>' +
          '<span class="card__sub">Every change, in order, with who made it</span>' +
        '</div><div class="tbl-wrap"><div id="aBody"></div></div></div>';

      P().list('audit', { sort: 'at' }).then(function (rows) {
        var host = $('#aBody');
        if (!rows.length) {
          host.innerHTML = emptyState('Nothing logged yet',
            'Add, edit or delete something and it will be recorded here.');
          return;
        }
        host.innerHTML = '<table class="tbl"><thead><tr>' +
          '<th>When</th><th>Who</th><th>Action</th><th>What</th><th>Detail</th>' +
          '</tr></thead><tbody>' +
          rows.map(function (a) {
            var tone = a.action === 'delete' ? 'badge--err'
                     : a.action === 'create' ? 'badge--ok' : 'badge--blue';
            return '<tr>' +
              '<td class="num">' + fmt.dateTime(a.at) + '</td>' +
              '<td class="strong">' + esc(a.actorName || a.actor) +
                '<span class="tbl__name-s">' + esc(a.actor || '') + '</span>' +
                (roleBadge(a.actorRole) || '') + '</td>' +
              '<td><span class="badge ' + tone + '">' + esc(a.action) + '</span></td>' +
              '<td>' + esc(a.entity) + '</td>' +
              '<td class="num">' + esc(a.detail || '—') + '</td>' +
            '</tr>';
          }).join('') + '</tbody></table>';
      });
    }
  };

  /* =======================================================================
     SETTINGS
     ======================================================================= */

  var settings = {
    render: function (root) {
      var m = P().mode();
      var canOwner = A.user && A.user.role === 'owner';

      root.innerHTML = modeBanner() +
        '<div class="grid grid-2">' +

          '<div class="card"><div class="card__head"><span class="card__title">Storage</span></div>' +
            '<div class="card__body">' +
              '<dl class="dl">' +
                '<dt>Mode</dt><dd><span class="badge ' + (m.shared ? 'badge--ok' : 'badge--warn') + '">' + esc(m.label) + '</span></dd>' +
                '<dt>Shared with visitors</dt><dd>' + (m.shared ? 'Yes' : 'No — this browser only') + '</dd>' +
                '<dt>Server-verified login</dt><dd>' + (m.secure ? 'Yes' : 'No — local convenience lock') + '</dd>' +
              '</dl>' +
              '<p class="hint" style="margin-top:var(--s4)">' + esc(m.note) + '</p>' +
              (m.shared ? '' :
                '<div style="margin-top:var(--s4);display:flex;gap:var(--s2);flex-wrap:wrap">' +
                  '<button class="btn btn--ghost btn--sm" id="sExport">' + icon('down') + ' Download backup</button>' +
                  '<button class="btn btn--danger-ghost btn--sm" id="sReset">Reset to shipped catalogue</button>' +
                '</div>') +
            '</div>' +
          '</div>' +

          '<div class="card"><div class="card__head"><span class="card__title">Your account</span></div>' +
            '<div class="card__body">' +
              '<dl class="dl">' +
                '<dt>Name</dt><dd>' + esc(A.user.name || '—') + '</dd>' +
                '<dt>E-mail</dt><dd>' + esc(A.user.email) + '</dd>' +
                '<dt>Role</dt><dd>' + roleBadge(A.user.role) + '</dd>' +
              '</dl>' +
              '<div style="margin-top:var(--s4);display:flex;gap:var(--s2);flex-wrap:wrap">' +
                '<a class="btn btn--ghost btn--sm" href="login.html">Change password</a>' +
                '<button class="btn btn--ghost btn--sm" id="sOut">Sign out</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

        '</div>' +

        '<div class="card" style="margin-top:var(--s5)"><div class="card__head">' +
          '<span class="card__title">Publishing</span></div><div class="card__body">' +
          (m.shared
            ? '<p style="font-size:.875rem;color:var(--t2);margin:0">Products save straight to the hosted ' +
              'catalogue, so anything you add is live on the website the moment you press save. ' +
              'Mark a product as a draft to keep it out of the public catalogue while you work on it.</p>'
            : '<p style="font-size:.875rem;color:var(--t2);margin:0">While the hosted backend is not connected, ' +
              'products are saved in this browser and the public website still reads ' +
              '<span class="num">assets/js/catalog.js</span>. Use <b>Download backup</b> to keep a copy, ' +
              'and ask for the backend to be connected when you are ready to publish for real.</p>') +
        '</div></div>';

      if ($('#sOut')) $('#sOut').addEventListener('click', function () {
        P().signOut().then(function () { location.href = 'login.html'; });
      });
      if ($('#sExport')) $('#sExport').addEventListener('click', exportBackup);
      if ($('#sReset')) $('#sReset').addEventListener('click', function () {
        A.confirm({
          title: 'Reset to the shipped catalogue?',
          body: '<p>Your local product edits will be replaced by the 55 product lines that ship ' +
                'with the website.</p><p style="margin:0">Download a backup first if you want to keep them.</p>',
          ok: 'Reset', danger: true,
          onOk: function () {
            P().resetLocal().then(function () {
              A.toast('Catalogue reset to the shipped version');
              location.reload();
            }).catch(function (err) { A.toast(err && err.message || 'Could not reset', 'err'); });
          }
        });
      });
    }
  };

  /* ---------------------------------------------------------------------
     register
     --------------------------------------------------------------------- */

  A.pages.dashboard = dashboard;
  A.pages.products = products;
  A.pages.categories = categories;
  A.pages.enquiries = enquiries;
  A.pages.customers = customers;
  A.pages.team = team;
  A.pages.audit = audit;
  A.pages.settings = settings;

})(window);
