#!/usr/bin/env python3
"""Draw the example's identification figure: the construction lines of a painted floor in
one-point perspective (no artwork is copied). Writes img/q8-floor.png next to this file.

Usage: python3 make_figure.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

S = 2                      # draw at 2x, then downscale for smooth lines
W, H = 900 * S, 540 * S
INK, SOFT, PAPER, ACCENT = (40, 36, 30), (150, 140, 124), (250, 247, 240), (168, 62, 38)


def font(size, bold=False):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif%s.ttf' % ('-Bold' if bold else ''),
              '/usr/share/fonts/truetype/liberation/LiberationSerif-%s.ttf' % ('Bold' if bold else 'Regular')):
        if os.path.exists(p):
            return ImageFont.truetype(p, size * S)
    return ImageFont.load_default()


def main():
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    vx, vy = W // 2, 200 * S                 # vanishing point on the horizon
    near, far = 480 * S, 290 * S             # near and far edges of the floor
    left, right = 70 * S, W - 70 * S
    # frame of the painted panel
    d.rectangle([24 * S, 24 * S, W - 24 * S, H - 24 * S], outline=SOFT, width=2 * S)
    # horizon line, dashed
    x = 40 * S
    while x < W - 40 * S:
        d.line([x, vy, x + 14 * S, vy], fill=SOFT, width=2 * S)
        x += 24 * S
    # orthogonals: from evenly spaced points on the near edge toward V, stopped at the far edge
    n = 10
    for i in range(n + 1):
        bx = left + (right - left) * i / n
        t = (near - far) / (near - vy)
        fx = bx + (vx - bx) * t
        d.line([bx, near, fx, far], fill=INK, width=2 * S)
        d.line([fx, far, vx, vy], fill=SOFT, width=1 * S)
    # transversals: parallel to the picture plane, closer together as they recede
    for k in range(7):
        # depth z = 1 at the near edge; the image row is vy + (near - vy) / z
        z = 1 + k * 0.42
        y = vy + (near - vy) / z
        if y < far:
            break
        t = (near - y) / (near - vy)
        xl, xr = left + (vx - left) * t, right + (vx - right) * t
        d.line([xl, y, xr, y], fill=INK, width=2 * S)
    d.line([left + (vx - left) * (near - far) / (near - vy), far, right + (vx - right) * (near - far) / (near - vy), far], fill=INK, width=2 * S)
    # V
    r = 7 * S
    d.ellipse([vx - r, vy - r, vx + r, vy + r], fill=ACCENT)
    fb = font(26, bold=True)
    d.text((vx + 14 * S, vy - 38 * S), 'V', font=fb, fill=ACCENT)
    d.text((44 * S, vy - 34 * S), 'H', font=fb, fill=SOFT)
    # label one orthogonal "o" and one transversal "t"
    bx = left + (right - left) * 2 / n
    mx, my = bx + (vx - bx) * 0.25, near - (near - vy) * 0.25
    d.text((mx - 36 * S, my - 6 * S), 'o', font=fb, fill=INK)
    z = 1 + 0.42
    ty = vy + (near - vy) / z
    tx = right + (vx - right) * (near - ty) / (near - vy)
    d.text((tx + 12 * S, ty - 30 * S), 't', font=fb, fill=INK)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img', 'q8-floor.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.resize((W // S, H // S), Image.LANCZOS).save(out, optimize=True)
    print('wrote', out)


if __name__ == '__main__':
    main()
