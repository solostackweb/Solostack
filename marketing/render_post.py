"""
Post #3 cover — "Same work. Two prices."

Floating range bars for Indian freelance design rates, domestic vs overseas.
The overlap between the two ranges is the whole argument, so the chart is built
to make the overlap visible rather than hide it.

Figures: ₹300–2,000/hr domestic, ₹1,000–3,500/hr international (published 2026
Indian freelance design rate guides).

Renders 1080x1350 (4:5 portrait — max LinkedIn feed height, no crop) and a
1200x1200 square alternate.
"""

from brand import *

DOM_LO, DOM_HI = 300, 2000
INT_LO, INT_HI = 1000, 3500
AXIS_MAX = 3800

HEAD_1 = "Same work."
HEAD_2 = "Two prices."
QUESTION = "Market? Or packaging?"
SUBLINE = "Both ends of that range are the same designer."
SOURCE = "Published Indian freelance design rate guides, 2026"


def build(W, H, head_fs, m):
    CW = W - 2 * m
    s = []
    s.append(f'<rect width="{W}" height="{H}" fill="{BG}"/>')
    s.append(wordmark(m, int(H * 0.055), icon_size=int(W * 0.039)))

    # --- Headline -----------------------------------------------------------
    h1 = int(H * 0.215)
    h2 = h1 + int(head_fs * 1.06)
    s.append(f'''
  <text x="{m}" y="{h1}" font-family="{F800}" font-size="{head_fs}" fill="{INK}"
        letter-spacing="-{head_fs*0.043:.1f}">{HEAD_1}</text>
  <text x="{m}" y="{h2}" font-family="{F800}" font-size="{head_fs}" fill="{INK}"
        letter-spacing="-{head_fs*0.043:.1f}">{HEAD_2}</text>''')

    # --- Range bars ---------------------------------------------------------
    def px(v):
        return m + (v / AXIS_MAX) * CW

    bar_h = int(H * 0.044)
    r1 = h2 + int(H * 0.105)          # row 1 shared baseline (label + value)
    r2 = r1 + int(H * 0.135)
    bar_off = int(H * 0.026)          # baseline -> top of bar

    # Overlap band is drawn FIRST so the bars sit cleanly on top of it.
    ox0, ox1 = px(INT_LO), px(DOM_HI)
    oy_top = r1 + bar_off - int(H * 0.012)
    oy_bot = r2 + bar_off + bar_h + int(H * 0.012)
    s.append(f'''
  <rect x="{ox0:.0f}" y="{oy_top}" width="{ox1-ox0:.0f}" height="{oy_bot-oy_top}"
        fill="{AMBER}" fill-opacity="0.09" rx="12"/>
  <line x1="{ox0:.0f}" y1="{oy_top}" x2="{ox0:.0f}" y2="{oy_bot}"
        stroke="{AMBER}" stroke-width="2" stroke-dasharray="5 6" opacity="0.7"/>
  <line x1="{ox1:.0f}" y1="{oy_top}" x2="{ox1:.0f}" y2="{oy_bot}"
        stroke="{AMBER}" stroke-width="2" stroke-dasharray="5 6" opacity="0.7"/>''')

    def row(label, lo, hi, y, color):
        x0, x1 = px(lo), px(hi)
        by = y + bar_off
        return f'''
  <text x="{m}" y="{y}" font-family="{F600}" font-size="{int(W*0.0213)}"
        fill="{MUTED}" letter-spacing="2.1">{label}</text>
  <text x="{m + CW*0.56:.0f}" y="{y + int(H*0.008)}" font-family="{F800}"
        font-size="{int(W*0.049)}" fill="{INK}"
        letter-spacing="-{W*0.002:.1f}">₹{lo:,}–{hi:,}<tspan font-family="{F500}"
        font-size="{int(W*0.024)}" fill="{MUTED}" letter-spacing="0" dx="9">/hr</tspan></text>
  <rect x="{m}" y="{by}" width="{CW}" height="{bar_h}" rx="{bar_h/2}"
        fill="{HAIRLINE}" fill-opacity="0.55"/>
  <rect x="{x0:.0f}" y="{by}" width="{x1-x0:.0f}" height="{bar_h}" rx="{bar_h/2}"
        fill="{color}"/>'''

    s.append(row("INDIAN CLIENTS", DOM_LO, DOM_HI, r1, INK))
    s.append(row("OVERSEAS CLIENTS", INT_LO, INT_HI, r2, BLUE))

    s.append(f'''
  <text x="{(ox0+ox1)/2:.0f}" y="{oy_bot + int(H*0.034)}" text-anchor="middle"
        font-family="{F600}" font-size="{int(W*0.0204)}" fill="#B45309"
        letter-spacing="0.4">the ranges overlap here</text>''')

    # --- The question -------------------------------------------------------
    qy = oy_bot + int(H * 0.095)
    s.append(f'''
  <line x1="{m}" y1="{qy}" x2="{W-m}" y2="{qy}" stroke="{HAIRLINE}" stroke-width="1"/>
  <text x="{m}" y="{qy + int(H*0.068)}" font-family="{F800}"
        font-size="{int(W*0.058)}" fill="{BLUE}"
        letter-spacing="-{W*0.002:.1f}">{QUESTION}</text>
  <text x="{m}" y="{qy + int(H*0.118)}" font-family="{F500}"
        font-size="{int(W*0.0287)}" fill="{BODY}">{SUBLINE}</text>''')

    # --- Footer -------------------------------------------------------------
    s.append(f'''
  <text x="{m}" y="{H - int(H*0.048)}" font-family="{F400}"
        font-size="{int(W*0.0176)}" fill="{MUTED}" fill-opacity="0.85">{SOURCE}</text>''')
    s.append(bars_motif(W - m - int(W * 0.096), H - int(H * 0.072), int(W * 0.096)))
    return "".join(s)


render(build(1080, 1350, 100, 88), "stackivo-post3-linkedin-1080x1350.png", 1080, 1350, scale=2)
render(build(1200, 1200, 104, 96), "stackivo-post3-linkedin-1200x1200.png", 1200, 1200, scale=2)
print("done")
