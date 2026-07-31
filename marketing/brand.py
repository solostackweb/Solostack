"""
Stackivo social-graphic renderer.

Renders on-brand LinkedIn covers as SVG -> PNG using the exact brand tokens
from marketing/linkedin-30-day-calendar.md and the real logo geometry from
logo-assets/stackivo-icon.svg. No AI image generation, no font substitution.

Usage:  python3 render_post.py     (writes PNG next to it)
"""

import cairosvg

# --- Brand tokens (verbatim from the Master Visual System) -------------------
BLUE = "#2563EB"
INK = "#0F172A"
BODY = "#334155"
MUTED = "#64748B"
BG = "#FFFFFF"
BG_SOFT = "#F8FAFC"
DARK = "#14161A"
GREEN = "#16A34A"
AMBER = "#F59E0B"
SKY = "#0EA5E9"
HAIRLINE = "#E2E8F0"

# Merged Inter subsets (latin + latin-ext) so both $ and INR render.
F800 = "StackivoInter ExtraBold"
F700 = "StackivoInter Bold"
F600 = "StackivoInter SemiBold"
F500 = "StackivoInter Medium"
F400 = "StackivoInter Regular"

RUPEE = "₹"


def logo_icon(x, y, size, fill=BLUE):
    """Exact stackivo-icon.svg geometry, scaled. 512-unit source grid."""
    s = size / 512.0
    return f"""
  <g transform="translate({x},{y}) scale({s})">
    <rect width="512" height="512" rx="96" fill="{fill}"/>
    <rect x="88" y="156" width="336" height="64" rx="32" fill="white"/>
    <rect x="88" y="240" width="242" height="64" rx="32" fill="white" fill-opacity="0.72"/>
    <rect x="88" y="324" width="158" height="64" rx="32" fill="white" fill-opacity="0.40"/>
  </g>"""


def wordmark(x, y, icon_size=44, text_fill=INK, opacity=1.0):
    """Icon + 'stackivo' lockup, baseline-aligned. x,y = top-left of icon."""
    fs = icon_size * 0.82
    ty = y + icon_size * 0.75
    tx = x + icon_size + icon_size * 0.34
    return f"""
  <g opacity="{opacity}">
    {logo_icon(x, y, icon_size)}
    <text x="{tx}" y="{ty}" font-family="{F700}" font-size="{fs}"
          fill="{text_fill}" letter-spacing="-1.4">stackivo</text>
  </g>"""


def bars_motif(x, y, w, color=BLUE, gap=None):
    """The 3-bar stepping motif as a standalone accent."""
    h = w * 0.115
    gap = gap if gap is not None else h * 0.72
    return f"""
  <g transform="translate({x},{y})">
    <rect width="{w}" height="{h}" rx="{h/2}" fill="{color}"/>
    <rect y="{h+gap}" width="{w*0.72}" height="{h}" rx="{h/2}" fill="{color}" fill-opacity="0.55"/>
    <rect y="{2*(h+gap)}" width="{w*0.47}" height="{h}" rx="{h/2}" fill="{color}" fill-opacity="0.28"/>
  </g>"""


def pill(x, y, text, fg=BLUE, bg_hex=BLUE, bg_op=0.08, fs=26, pad_x=26, pad_y=15):
    """Rounded-full tint chip. Width estimated from glyph metrics."""
    w = len(text) * fs * 0.56 + pad_x * 2
    h = fs + pad_y * 2
    return f"""
  <g>
    <rect x="{x}" y="{y}" width="{w:.0f}" height="{h:.0f}" rx="{h/2:.0f}"
          fill="{bg_hex}" fill-opacity="{bg_op}"/>
    <text x="{x + w/2:.0f}" y="{y + h/2 + fs*0.35:.0f}" text-anchor="middle"
          font-family="{F600}" font-size="{fs}" fill="{fg}"
          letter-spacing="0.3">{text}</text>
  </g>""", w


def render(svg: str, out_png: str, w: int, h: int, scale: int = 2):
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}">{svg}</svg>'
    )
    cairosvg.svg2png(
        bytestring=doc.encode("utf-8"),
        write_to=out_png,
        output_width=w * scale,
        output_height=h * scale,
    )
    return out_png
