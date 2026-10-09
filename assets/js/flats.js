/* ==========================================================================
   NITO SPORTS — Technical Flat Library
   Line-art garment flats drawn in a tech-pack / spec-sheet style.
   Deliberately NOT stock photography: these read as production drawings,
   which is what a B2B buyer expects to see before a sample is cut.
   --------------------------------------------------------------------------
   Every shape is authored on a 200x200 canvas.
     outline -> the cut line (solid, currentColor)
     stitch  -> seam / stitch line (dashed, dimmed)
     accent  -> branded or functional detail (NITO blue)
   ========================================================================== */

(function (global) {
  'use strict';

  var BLUE = '#12A0DC';

  var SHAPES = {

    /* --- Tops ------------------------------------------------------------ */

    jersey: {
      outline: [
        'M78 40 C88 54 112 54 122 40 L160 66 L172 86 L150 98 L134 76 L136 158 L64 158 L66 76 L50 98 L28 86 L40 66 Z'
      ],
      stitch: [
        'M82 47 C90 58 110 58 118 47',
        'M64 148 L136 148',
        'M31 88 L52 99',
        'M169 88 L148 99'
      ],
      accent: ['M100 84 L100 130']
    },

    /* Rugby / collared jersey */
    rugby: {
      outline: [
        'M78 42 C88 54 112 54 122 42 L162 68 L174 88 L152 100 L136 78 L138 160 L62 160 L64 78 L48 100 L26 88 L38 68 Z'
      ],
      stitch: [
        'M62 150 L138 150',
        'M33 90 L52 101',
        'M167 90 L148 101'
      ],
      accent: [
        'M80 44 L92 54 L100 46 L108 54 L120 44',
        'M100 46 L100 84',
        'M100 60 L100 60.5',
        'M100 72 L100 72.5'
      ]
    },

    /* Polo / button-up shirt */
    polo: {
      outline: [
        'M78 40 C88 54 112 54 122 40 L160 66 L172 86 L150 98 L134 76 L136 158 L64 158 L66 76 L50 98 L28 86 L40 66 Z'
      ],
      stitch: [
        'M82 47 C90 58 110 58 118 47',
        'M64 148 L136 148',
        'M31 88 L52 99',
        'M169 88 L148 99'
      ],
      accent: [
        'M80 42 L92 52 L100 44 L108 52 L120 42',
        'M100 44 L100 86',
        'M100 60 L100 60.5',
        'M100 72 L100 72.5'
      ]
    },

    /* Baseball button-up — full placket + piping */
    baseball: {
      outline: [
        'M78 40 C88 54 112 54 122 40 L160 66 L172 86 L150 98 L134 76 L136 158 L64 158 L66 76 L50 98 L28 86 L40 66 Z'
      ],
      stitch: [
        'M82 47 C90 58 110 58 118 47',
        'M64 148 L136 148'
      ],
      accent: [
        'M100 44 L100 158',
        'M80 42 L92 52 L100 44 L108 52 L120 42',
        'M100 62 L100 62.5',
        'M100 76 L100 76.5',
        'M100 90 L100 90.5',
        'M100 104 L100 104.5'
      ]
    },

    /* Ice hockey — oversized body, lace collar, hem stripe */
    hockey: {
      outline: [
        'M80 40 C90 52 110 52 120 40 L164 68 L178 92 L154 104 L138 78 L140 162 L60 162 L62 78 L46 104 L22 92 L36 68 Z'
      ],
      stitch: [
        'M60 138 L140 138',
        'M60 148 L140 148',
        'M33 94 L52 105',
        'M167 94 L148 105'
      ],
      accent: [
        'M88 44 L96 58 L104 44',
        'M104 44 L112 58 L120 44'
      ]
    },

    /* American football — shoulder yoke + mesh panel */
    football: {
      outline: [
        'M78 40 C88 54 112 54 122 40 L160 66 L172 86 L150 98 L134 76 L136 158 L64 158 L66 76 L50 98 L28 86 L40 66 Z'
      ],
      stitch: [
        'M66 74 C84 88 116 88 134 74',
        'M64 148 L136 148',
        'M31 88 L52 99',
        'M169 88 L148 99'
      ],
      accent: [
        'M88 70 L88 146',
        'M112 70 L112 146',
        'M100 70 L100 146'
      ]
    },

    /* Basketball / gym tank */
    tank: {
      outline: [
        'M76 42 C84 60 116 60 124 42 L134 44 C146 60 144 86 130 104 L132 158 L68 158 L70 104 C56 86 54 60 66 44 Z'
      ],
      stitch: [
        'M68 148 L132 148',
        'M70 104 C84 112 116 112 130 104'
      ],
      accent: ['M100 74 L100 132']
    },

    /* Stringer — deep-cut armholes, narrow back */
    stringer: {
      outline: [
        'M78 40 C86 58 114 58 122 40 L136 42 C142 66 134 92 124 108 L128 158 L72 158 L76 108 C66 92 58 66 64 42 Z'
      ],
      stitch: [
        'M72 148 L128 148',
        'M76 108 C88 116 112 116 124 108'
      ],
      accent: ['M100 70 L100 134']
    },

    /* Compression top / rash guard — long tight sleeve, panel seams */
    compression: {
      outline: [
        'M76 44 C86 38 114 38 124 44 L148 50 L178 134 L158 142 L134 78 L136 162 L64 162 L66 78 L42 142 L22 134 L52 50 Z'
      ],
      stitch: [
        'M80 48 C90 58 110 58 120 48',
        'M64 152 L136 152',
        'M26 136 L44 142',
        'M174 136 L156 142'
      ],
      accent: [
        'M74 60 C66 90 66 128 70 158',
        'M126 60 C134 90 134 128 130 158'
      ]
    },

    /* Hoodie */
    hoodie: {
      outline: [
        'M74 46 C70 24 130 24 126 46 L164 70 L176 130 L154 138 L142 82 L142 162 L58 162 L58 82 L46 138 L24 130 L36 70 Z'
      ],
      stitch: [
        'M74 46 C86 34 114 34 126 46',
        'M58 152 L142 152',
        'M27 132 L46 138',
        'M173 132 L154 138'
      ],
      accent: [
        'M78 116 L122 116',
        'M80 116 L80 148',
        'M120 116 L120 148',
        'M94 46 L92 66',
        'M106 46 L108 66'
      ]
    },

    /* Track jacket / windbreaker / varsity — full front zip */
    track: {
      outline: [
        'M72 44 C78 36 122 36 128 44 L166 68 L180 132 L156 140 L144 80 L144 164 L56 164 L56 80 L44 140 L20 132 L34 68 Z'
      ],
      stitch: [
        'M56 154 L144 154',
        'M24 134 L44 140',
        'M176 134 L156 140'
      ],
      accent: [
        'M100 44 L100 164',
        'M74 38 L126 38',
        'M72 44 L74 38',
        'M128 44 L126 38'
      ]
    },

    /* Rainwear jacket — hooded shell with storm flap */
    jacket: {
      outline: [
        'M74 48 C68 22 132 22 126 48 L166 72 L178 134 L154 142 L142 84 L144 166 L56 166 L58 84 L46 142 L22 134 L34 72 Z'
      ],
      stitch: [
        'M74 48 C86 34 114 34 126 48',
        'M56 156 L144 156',
        'M26 136 L46 142',
        'M174 136 L154 142'
      ],
      accent: [
        'M100 48 L100 166',
        'M88 60 L88 150',
        'M112 60 L112 150',
        'M86 108 L114 108'
      ]
    },

    /* Varsity jacket — contrast sleeves + snap placket */
    varsity: {
      outline: [
        'M72 44 C78 34 122 34 128 44 L168 68 L182 128 L158 138 L146 80 L146 160 L54 160 L54 80 L42 138 L18 128 L32 68 Z'
      ],
      stitch: [
        'M54 150 L146 150',
        'M30 70 L42 138',
        'M170 70 L158 138',
        'M100 44 L100 160'
      ],
      accent: [
        'M74 40 L126 40',
        'M100 62 L100 62.5',
        'M100 80 L100 80.5',
        'M100 98 L100 98.5'
      ]
    },

    /* Sports bra */
    bra: {
      outline: [
        'M64 78 C64 58 136 58 136 78 L134 106 C122 124 78 124 66 106 Z'
      ],
      stitch: [
        'M66 106 C78 124 122 124 134 106',
        'M68 74 C80 88 120 88 132 74'
      ],
      accent: [
        'M72 68 L84 40',
        'M128 68 L116 40',
        'M100 92 L100 118'
      ]
    },

    /* Boxing robe — long, open front, wide sleeve */
    robe: {
      outline: [
        'M72 40 L100 62 L128 40 L162 54 L176 104 L152 112 L150 84 L154 178 L46 178 L50 84 L48 112 L24 104 L38 54 Z'
      ],
      stitch: [
        'M46 168 L154 168',
        'M26 106 L48 112',
        'M174 106 L152 112'
      ],
      accent: [
        'M72 40 L100 62 L128 40',
        'M44 124 L156 124'
      ]
    },

    /* --- Bottoms --------------------------------------------------------- */

    /* Gym / sports shorts */
    shorts: {
      outline: ['M62 56 L138 56 L146 150 L114 150 L100 96 L86 150 L54 150 Z'],
      stitch: ['M62 68 L138 68', 'M54 142 L86 142', 'M114 142 L146 142'],
      accent: ['M62 56 L138 56', 'M94 56 L92 68', 'M106 56 L108 68']
    },

    /* Fight / MMA / muay thai shorts — side slits, wider cut */
    fights: {
      outline: ['M58 62 L142 62 L152 140 L108 140 L100 100 L92 140 L48 140 Z'],
      stitch: ['M48 132 L92 132', 'M108 132 L152 132'],
      accent: [
        'M58 62 L142 62',
        'M58 74 L142 74',
        'M58 74 L58 104',
        'M142 74 L142 104'
      ]
    },

    /* Joggers / 3-4 pants / tracksuit bottom */
    pant: {
      outline: ['M62 44 L138 44 L142 176 L112 176 L100 100 L88 176 L58 176 Z'],
      stitch: ['M62 58 L138 58', 'M58 168 L88 168', 'M112 168 L142 168'],
      accent: ['M62 44 L138 44', 'M94 44 L94 58', 'M106 44 L106 58']
    },

    /* Leggings — fitted, high waist */
    leggings: {
      outline: ['M64 48 L136 48 L138 176 L114 176 L100 104 L86 176 L62 176 Z'],
      stitch: ['M64 66 L136 66', 'M62 168 L86 168', 'M114 168 L138 168'],
      accent: ['M64 48 L136 48', 'M64 66 L136 66', 'M100 70 L100 176']
    },

    /* --- Accessories ----------------------------------------------------- */

    duffel: {
      outline: [
        'M28 80 L172 80 L172 138 C172 149 163 158 152 158 L48 158 C37 158 28 149 28 138 Z'
      ],
      stitch: ['M28 94 L172 94', 'M48 148 L152 148'],
      accent: [
        'M74 80 C74 54 126 54 126 80',
        'M84 80 C84 64 116 64 116 80',
        'M100 120 L100 120.5',
        'M114 120 L114 120.5'
      ]
    },

    backpack: {
      outline: [
        'M50 70 C50 50 150 50 150 70 L154 170 C154 179 148 184 139 184 L61 184 C52 184 46 179 46 170 Z'
      ],
      stitch: ['M46 98 L154 98', 'M46 132 L154 132'],
      accent: [
        'M78 50 C78 30 122 30 122 50',
        'M100 132 L100 176',
        'M64 148 L136 148'
      ]
    },

    cap: {
      outline: [
        'M44 116 C44 72 156 72 156 116',
        'M40 116 L160 116 C186 116 190 130 178 135 C158 142 62 142 44 133 C36 129 36 118 40 116 Z'
      ],
      stitch: ['M44 108 C70 100 130 100 156 108'],
      accent: ['M100 74 L100 116', 'M74 80 C70 96 68 108 68 116', 'M126 80 C130 96 132 108 132 116']
    },

    sock: {
      outline: [
        'M74 40 L126 40 L126 106 C126 128 116 140 100 148 C88 154 76 158 68 158 C54 158 48 148 54 138 C62 126 74 118 74 100 Z'
      ],
      stitch: ['M74 52 L126 52', 'M74 62 L126 62', 'M100 148 C92 152 82 156 74 158'],
      accent: ['M74 40 L126 40']
    },

    /* Composite: tracksuit shown as jacket + pant, side by side */
    tracksuit: {
      outline: [
        'M30 30 C34 24 62 24 66 30 L88 44 L96 82 L82 87 L76 50 L77 100 L19 100 L20 50 L14 87 L0 82 L8 44 Z',
        'M120 40 L164 40 L167 158 L148 158 L142 92 L136 158 L117 158 Z'
      ],
      stitch: [
        'M19 94 L77 94',
        'M120 52 L164 52',
        'M117 150 L136 150',
        'M148 150 L167 150'
      ],
      accent: [
        'M48 30 L48 100',
        'M34 26 L62 26',
        'M120 40 L164 40',
        'M138 40 L138 52',
        'M150 40 L150 52'
      ]
    }
  };

  /* Fallback so an unknown type never renders an empty box */
  var FALLBACK = 'jersey';

  function esc(s) { return String(s); }

  /**
   * Render a technical flat as an inline SVG string.
   * @param {string} type  key from SHAPES
   * @param {object} [opt] { className, blue }
   */
  function flat(type, opt) {
    opt = opt || {};
    var s = SHAPES[type] || SHAPES[FALLBACK];
    var cls = opt.className || 'flat';
    var blue = opt.blue || BLUE;

    var out = '<svg class="' + cls + '" viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">';

    out += '<g stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" opacity=".92">';
    s.outline.forEach(function (d) { out += '<path d="' + esc(d) + '"/>'; });
    out += '</g>';

    if (s.stitch && s.stitch.length) {
      out += '<g stroke="currentColor" stroke-width="1.3" stroke-dasharray="4 4.5" stroke-linecap="round" opacity=".42">';
      s.stitch.forEach(function (d) { out += '<path d="' + esc(d) + '"/>'; });
      out += '</g>';
    }

    if (s.accent && s.accent.length) {
      out += '<g stroke="' + blue + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity=".95">';
      s.accent.forEach(function (d) { out += '<path d="' + esc(d) + '"/>'; });
      out += '</g>';
    }

    out += '</svg>';
    return out;
  }

  /* The brand mark is the owner's own artwork (assets/img/nito-lockup*.png),
     so no drawn logo lives here. */
  global.NitoFlats = { flat: flat, SHAPES: SHAPES };

})(window);
