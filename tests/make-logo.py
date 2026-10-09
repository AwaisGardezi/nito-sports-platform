"""Build transparent logo assets from the original nito-logo.jpg.

The supplied logo is a stacked lockup (runner above NITO above SPORTS) on a white
JPG background. A stacked logo is too tall for a site header, so this script:

  1. removes the white background (proper un-premultiply, so edges stay clean)
  2. crops the three artwork bands: runner / NITO / SPORTS
  3. recomposes them as a horizontal lockup:  [runner]  NITO
                                                         SPORTS
  4. makes a reversed variant (black text -> white) for dark backgrounds
  5. exports the runner alone for the favicon

Everything is derived from the owner's own artwork - nothing is redrawn.
"""
import os
from PIL import Image

SRC = 'assets/img/nito-logo.jpg'
OUT = 'assets/img'

# measured from the artwork
RUNNER = (353, 0, 1077, 558)
NITO = (1, 644, 1531, 997)
SPORTS = (69, 1056, 1412, 1177)

SS = 4  # supersample factor for the exported PNGs


def white_to_alpha(im):
    """White background -> alpha. Un-premultiplies so the colour stays exact
    when the result is composited back onto a white or light background."""
    im = im.convert('RGB')
    w, h = im.size
    src = im.load()
    out = Image.new('RGBA', (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            m = min(r, g, b)
            a = 255 - m
            if a <= 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            af = a / 255.0
            # F = (O - (1-a)*255) / a
            fr = int(max(0, min(255, (r - (1 - af) * 255) / af)))
            fg = int(max(0, min(255, (g - (1 - af) * 255) / af)))
            fb = int(max(0, min(255, (b - (1 - af) * 255) / af)))
            dst[x, y] = (fr, fg, fb, a)
    return out


def recolour_text(im, to=(255, 255, 255)):
    """Turn the neutral (black) artwork white, leaving the blue runner alone."""
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if (max(r, g, b) - min(r, g, b)) < 46:   # low saturation -> the wordmark
                px[x, y] = (to[0], to[1], to[2], a)
    return out


def upscale(im, factor):
    return im.resize((im.width * factor, im.height * factor), Image.LANCZOS)


def fit_height(im, target_h):
    """Scale to a target height, keeping the aspect ratio."""
    if im.height <= target_h:
        return im
    w = max(1, round(im.width * target_h / im.height))
    return im.resize((w, target_h), Image.LANCZOS)


def main():
    base = white_to_alpha(Image.open(SRC))
    runner = base.crop(RUNNER)
    nito = base.crop(NITO)
    sports = base.crop(SPORTS)

    # ---- horizontal lockup: runner | (NITO over SPORTS) ----
    GAP = 110            # horizontal space between runner and wordmark
    VGAP = 56            # vertical space between NITO and SPORTS
    right_w = max(nito.width, sports.width)
    right_h = nito.height + VGAP + sports.height
    total_h = max(runner.height, right_h)
    total_w = runner.width + GAP + right_w

    def compose(text_colour):
        canvas = Image.new('RGBA', (total_w, total_h), (0, 0, 0, 0))
        n = nito if text_colour is None else recolour_text(nito, text_colour)
        s = sports if text_colour is None else recolour_text(sports, text_colour)

        canvas.alpha_composite(runner, (0, (total_h - runner.height) // 2))
        right_x = runner.width + GAP
        y = (total_h - right_h) // 2
        canvas.alpha_composite(n, (right_x, y))
        canvas.alpha_composite(s, (right_x, y + n.height + VGAP))
        return canvas

    # the header shows this at ~34px tall, so 3x for retina is plenty
    LOCKUP_H = 102
    dark = fit_height(compose(None), LOCKUP_H)
    light = fit_height(compose((255, 255, 255)), LOCKUP_H)

    dark.save(os.path.join(OUT, 'nito-lockup.png'), optimize=True)
    light.save(os.path.join(OUT, 'nito-lockup-light.png'), optimize=True)

    # ---- runner alone, for the favicon ----
    mark = fit_height(runner, 192)
    mark.save(os.path.join(OUT, 'nito-mark.png'), optimize=True)

    # ---- favicons: the runner centred on a square, transparent canvas ----
    for size, name in ((32, 'favicon-32.png'), (192, 'favicon-192.png'), (180, 'apple-touch-icon.png')):
        pad = round(size * 0.10)
        box = size - pad * 2
        scaled = fit_height(runner, box)
        if scaled.width > box:
            scaled = scaled.resize((box, max(1, round(scaled.height * box / scaled.width))), Image.LANCZOS)
        sq = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        sq.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
        sq.save(os.path.join(OUT, name), optimize=True)

    for f in ('nito-lockup.png', 'nito-lockup-light.png', 'nito-mark.png',
              'favicon-32.png', 'favicon-192.png', 'apple-touch-icon.png'):
        p = os.path.join(OUT, f)
        im = Image.open(p)
        print('%-24s %5dx%-5d  %6.1f KB  ratio %.2f' % (f, im.width, im.height, os.path.getsize(p) / 1024, im.width / im.height))


if __name__ == '__main__':
    main()
