"""
Genera los SVG editables del logo «chollos d'hoy» (B1-3, B4 y C1-4).

Por cada logo salen dos archivos:
  *-trazos.svg  texto convertido a contornos (no necesita fuentes; versión definitiva)
  *-texto.svg   texto editable (necesita Bricolage Grotesque / Martian Mono instaladas)
Los iconos solos salen solo en trazos.

Cada elemento va en un <g id="..."> con nombre, para seleccionarlo en Figma/Illustrator.

Uso: python3 docs/redes/svg/generar_svg.py /ruta/fuentes
     (BricolageGrotesque.ttf y MartianMono.ttf variables de Google Fonts)
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/brand/fonts")
OUT = Path(__file__).parent

INK, CARD, CARD_LINE, GREY = "#0B0B0C", "#1A1A1C", "#2C2C30", "#8E8E93"
GRAD = """<linearGradient id="naranja" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#FFA23A"/><stop offset="0.45" stop-color="#FF6A13"/><stop offset="1" stop-color="#F23D0C"/>
    </linearGradient>"""


class Font:
    def __init__(self, path, axes, family, weight):
        f = TTFont(path)
        self.font = instantiateVariableFont(f, axes)
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font["head"].unitsPerEm
        self.family, self.weight = family, weight

    def glyph(self, ch):
        return self.cmap[ord(ch)]

    def adv(self, ch, size):
        return self.gs[self.glyph(ch)].width * size / self.upm

    def width(self, text, size, tracking=0):
        return sum(self.adv(c, size) for c in text) + tracking * (len(text) - 1)

    def ymax(self, ch, size):
        from fontTools.pens.boundsPen import BoundsPen
        bp = BoundsPen(self.gs)
        self.gs[self.glyph(ch)].draw(bp)
        return bp.bounds[3] * size / self.upm

    def ink(self, text, size, tracking=0):
        """Caja real de dibujo (x0, y0, x1, y1) de `text` con la línea base en y=0 (y hacia arriba)."""
        from fontTools.pens.boundsPen import BoundsPen
        x, s, box = 0, size / self.upm, None
        for c in text:
            bp = BoundsPen(self.gs)
            self.gs[self.glyph(c)].draw(bp)
            if bp.bounds:
                b = (x + bp.bounds[0] * s, bp.bounds[1] * s, x + bp.bounds[2] * s, bp.bounds[3] * s)
                box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
            x += self.adv(c, size) + tracking
        return box

    def path(self, text, size, x, y, tracking=0):
        """Contorno de `text` con la línea base en (x, y). Devuelve (d, x_final)."""
        pen = SVGPathPen(self.gs)
        s = size / self.upm
        for c in text:
            g = self.glyph(c)
            self.gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
            x += self.adv(c, size) + tracking
        return pen.getCommands(), x - tracking

    def text(self, text, size, x, y, tracking=0, fill=INK):
        return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{self.family}" font-weight="{self.weight}" '
                f'font-size="{size}" letter-spacing="{tracking}" fill="{fill}">{text}</text>')


BRI = Font(FONTS / "BricolageGrotesque.ttf", {"wght": 800, "opsz": 96, "wdth": 100}, "Bricolage Grotesque", 800)
MAR = Font(FONTS / "MartianMono.ttf", {"wght": 700, "wdth": 100}, "Martian Mono", 700)


def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" viewBox="0 0 {w:.0f} {h:.0f}">\n'
            f'  <defs>\n    {GRAD}\n  </defs>\n{body}\n</svg>\n')


def word(font, text, size, x, y, tracking, fill, live, gid):
    """Texto como trazos o como texto editable, dentro de un grupo con nombre."""
    if live:
        return f'  <g id="{gid}">{font.text(text, size, x, y, tracking, fill)}</g>', x + font.width(text, size, tracking)
    d, xe = font.path(text, size, x, y, tracking)
    return f'  <g id="{gid}"><path fill="{fill}" d="{d}"/></g>', xe


# ---------- piezas comunes ----------

def ch_monogram(font, size, cx, cy, ap_pos, with_dot, live, bar=None):
    """«ch» centrado ópticamente en (cx, cy) por su caja real de dibujo, con el apóstrofo
    superpuesto en la unión (y punto opcional). bar=(alto, separación): la línea de debajo
    se centra junto con las letras."""
    text = "ch." if with_dot else "ch"
    x0i, _, x1i, y1i = font.ink(text, size)
    block_h = y1i + (bar[1] + bar[0] if bar else 0)        # de la cima de la «h» al pie de la línea
    base = cy - block_h / 2 + y1i
    x0 = cx - (x0i + x1i) / 2
    parts = []
    g, xe = word(font, "ch", size, x0, base, 0, "#FFFFFF", live, "ch")
    parts.append(g)
    w = font.width(text, size)
    ap_w = font.adv("’", size)
    ax = x0 + w * ap_pos - ap_w / 2
    g, _ = word(font, "’", size, ax, base + 0.06 * size, 0, "url(#naranja)", live, "apostrofo")
    parts.append(g)
    if with_dot:
        g, _ = word(font, ".", size, xe, base, 0, "url(#naranja)", live, "punto")
        parts.append(g)
    if bar:
        bw = font.ink("ch", size)
        bx0, bx1 = x0 + bw[0], x0 + bw[2]
        parts.append(f'  <g id="linea"><rect x="{bx0:.1f}" y="{base + bar[1]:.1f}" width="{bx1 - bx0:.1f}" height="{bar[0]:.1f}" rx="{bar[0]/2:.1f}" fill="url(#naranja)"/></g>')
    return "\n".join(parts)


def stacked_name(font, size, x, cy, tracking, color, live, end):
    """«chollos» / «d’hoy» apilados (interlineado 0,86) centrados en vertical en cy."""
    lead = 0.86 * size
    asc = font.ymax("l", size)
    desc = 0.2 * size
    b1 = cy - (asc + lead + desc) / 2 + asc
    b2 = b1 + lead
    parts = []
    g, x_line1 = word(font, "chollos", size, x, b1, tracking, color, live, "chollos")
    parts.append(g)
    g, xe = word(font, "d", size, x, b2, tracking, color, live, "d")
    parts.append(g)
    g, xe = word(font, "’", size, xe + tracking, b2, tracking, "url(#naranja)", live, "apostrofo-nombre")
    parts.append(g)
    g, xe = word(font, "hoy", size, xe + tracking, b2, tracking, color, live, "hoy")
    parts.append(g)
    if end == "circulo":
        r = 0.1 * size
        parts.append(f'  <g id="punto-final"><circle cx="{xe + 0.05 * size + r:.1f}" cy="{b2 - r:.1f}" r="{r:.1f}" fill="url(#naranja)"/></g>')
        xe += 0.05 * size + 2 * r
    elif end == "punto":
        g, xe = word(font, ".", size, xe, b2, 0, "url(#naranja)", live, "punto-final")
        parts.append(g)
    elif end == "cursor":
        cw, chh = 0.54 * size, 0.96 * size
        parts.append(f'  <g id="cursor"><rect x="{xe + 0.12 * size:.1f}" y="{b2 - 0.82 * size:.1f}" width="{cw:.1f}" height="{chh:.1f}" fill="url(#naranja)"/></g>')
        xe += 0.12 * size + cw
    return "\n".join(parts), max(xe, x_line1)


# ---------- logos ----------

def b13(live, icon_only=False):
    S = 300
    icon = [f'  <g id="icono"><rect width="{S}" height="{S}" rx="72" fill="{INK}"/></g>',
            ch_monogram(BRI, 176, S / 2, S / 2, 0.45, False, live, bar=(S * 0.06, S * 0.07))]
    if icon_only:
        return svg(S, S, "\n".join(icon))
    name, xe = stacked_name(BRI, 128, S + 56, S / 2, -6, INK, live, "circulo")
    return svg(xe + 8, S, "\n".join(icon + [name]))


def b4(live, icon_only=False):
    S = 300
    icon = [f'  <g id="icono"><circle cx="{S/2}" cy="{S/2}" r="{S/2}" fill="{INK}"/></g>',
            ch_monogram(BRI, 160, S / 2, S / 2, 0.38, True, live)]
    if icon_only:
        return svg(S, S, "\n".join(icon))
    name, xe = stacked_name(BRI, 128, S + 56, S / 2, -6, INK, live, "punto")
    return svg(xe + 8, S, "\n".join(icon + [name]))


def c14_icon(kind, live):
    S = 300
    out = [f'  <g id="icono"><rect x="1.5" y="1.5" width="{S-3}" height="{S-3}" rx="72" fill="{CARD}" stroke="{CARD_LINE}" stroke-width="3"/></g>']
    if kind == "cursor":
        gw = MAR.adv(">", 112)
        total = gw + 20 + 68
        x0 = (S - total) / 2
        g, _ = word(MAR, ">", 112, x0, S / 2 + 0.36 * 112, 0, GREY, live, "prompt")
        out.append(g)
        out.append(f'  <g id="cursor"><rect x="{x0 + gw + 20:.1f}" y="{S/2 - 64:.1f}" width="68" height="128" rx="8" fill="url(#naranja)"/></g>')
    else:
        size = 120
        w = MAR.width("d’", size, -8)
        total = w + 8 + 48
        x0 = (S - total) / 2
        base = S / 2 + 0.36 * size
        g, xe = word(MAR, "d’", size, x0, base, -8, "#FFFFFF", live, "d")
        out.append(g)
        out.append(f'  <g id="cursor"><rect x="{xe + 8:.1f}" y="{S/2 - 46:.1f}" width="48" height="92" fill="url(#naranja)"/></g>')
    return out


def c14(kind, live, icon_only=False):
    S = 300
    icon = c14_icon(kind, live)
    if icon_only:
        return svg(S, S, "\n".join(icon))
    size = 104
    lead = 1.05 * size
    b1 = S / 2 - lead / 2 + 0.3 * size
    parts = []
    g, xe1 = word(MAR, "chollos_", size, S + 56, b1, -6, "#FFFFFF", live, "chollos")
    parts.append(g)
    g, xe2 = word(MAR, "d’hoy", size, S + 56, b1 + lead, -6, "#FFFFFF", live, "dhoy")
    parts.append(g)
    parts.append(f'  <g id="cursor-nombre"><rect x="{xe2 + 12:.1f}" y="{b1 + lead - 0.78*size:.1f}" width="{0.54*size:.1f}" height="{0.96*size:.1f}" fill="url(#naranja)"/></g>')
    w = max(xe1, xe2 + 12 + 0.54 * size) + 40
    bg = f'  <g id="fondo"><rect width="{w:.0f}" height="{S}" fill="{INK}"/></g>'
    return svg(w, S, "\n".join([bg] + icon + parts))


def b13_horizontal(live):
    """Icono + «chollos d’hoy.» en una línea, para cabeceras web (texto en tinta)."""
    S = 300
    icon = [f'  <g id="icono"><rect width="{S}" height="{S}" rx="72" fill="{INK}"/></g>',
            ch_monogram(BRI, 176, S / 2, S / 2, 0.45, False, live, bar=(S * 0.06, S * 0.07))]
    size, tr = 200, -8
    # centro óptico: mitad entre la altura de la x y la línea base, en el centro del icono
    xh = BRI.ymax("o", size)
    base = S / 2 + xh / 2
    x = S + 60
    parts = []
    g, x = word(BRI, "chollos ", size, x, base, tr, INK, live, "chollos")
    parts.append(g)
    g, x = word(BRI, "d", size, x + tr, base, tr, INK, live, "d")
    parts.append(g)
    g, x = word(BRI, "’", size, x + tr, base, tr, "url(#naranja)", live, "apostrofo-nombre")
    parts.append(g)
    g, x = word(BRI, "hoy", size, x + tr, base, tr, INK, live, "hoy")
    parts.append(g)
    r = 0.1 * size
    parts.append(f'  <g id="punto-final"><circle cx="{x + 0.05 * size + r:.1f}" cy="{base - r:.1f}" r="{r:.1f}" fill="url(#naranja)"/></g>')
    return svg(x + 0.05 * size + 2 * r + 6, S, "\n".join(icon + parts))


def b13_apilado_web(live):
    """Icono + nombre en dos líneas con alineación óptica: el centro del icono cae en el
    hueco entre «chollos» y «d’hoy» (como en el banner), para cabeceras web."""
    S = 300
    icon = [f'  <g id="icono"><rect width="{S}" height="{S}" rx="72" fill="{INK}"/></g>',
            ch_monogram(BRI, 176, S / 2, S / 2, 0.45, False, live, bar=(S * 0.06, S * 0.07))]
    size, tr = 150, -6
    lead = 0.86 * size
    xh = BRI.ymax("o", size)
    # hueco entre líneas = entre la base de la línea 1 y la altura x de la línea 2
    gap_mid = (lead - xh) / 2
    b1 = S / 2 - gap_mid
    b2 = b1 + lead
    x = S + 48
    parts = []
    g, x1 = word(BRI, "chollos", size, x, b1, tr, INK, live, "chollos")
    parts.append(g)
    g, xe = word(BRI, "d", size, x, b2, tr, INK, live, "d")
    parts.append(g)
    g, xe = word(BRI, "’", size, xe + tr, b2, tr, "url(#naranja)", live, "apostrofo-nombre")
    parts.append(g)
    g, xe = word(BRI, "hoy", size, xe + tr, b2, tr, INK, live, "hoy")
    parts.append(g)
    r = 0.1 * size
    parts.append(f'  <g id="punto-final"><circle cx="{xe + 0.05 * size + r:.1f}" cy="{b2 - r:.1f}" r="{r:.1f}" fill="url(#naranja)"/></g>')
    w = max(x1, xe + 0.05 * size + 2 * r) + 6
    return svg(w, S, "\n".join(icon + parts))


FILES = {
    "b1-3-apilado-web-trazos.svg": lambda: b13_apilado_web(False),
    "b1-3-horizontal-trazos.svg": lambda: b13_horizontal(False),
    "b1-3-logo-trazos.svg": lambda: b13(False),
    "b1-3-logo-texto.svg": lambda: b13(True),
    "b1-3-icono.svg": lambda: b13(False, True),
}

if __name__ == "__main__":
    for name, fn in FILES.items():
        (OUT / name).write_text(fn(), encoding="utf-8")
        print("✓", name)
