"""Recorta folhas de sprites irregulares em quadros.

Detecta o fundo (transparente ou cor sólida do canto), acha os blocos de pixels
conectados (juntando pedaços próximos, como armas soltas) e organiza os quadros
em linhas e grupos, na ordem de leitura da folha.
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage


def load_rgba(path):
    im = Image.open(path)
    if im.mode == 'P' and 'transparency' in im.info:
        im = im.convert('RGBA')
    return im.convert('RGBA')


def background_mask(arr):
    """True onde é fundo. Usa alfa; se a imagem for opaca, usa a cor dos cantos."""
    a = arr[..., 3]
    if (a < 250).mean() > 0.2:
        return a < 16, None
    corners = [tuple(arr[0, 0, :3]), tuple(arr[0, -1, :3]), tuple(arr[-1, 0, :3]), tuple(arr[-1, -1, :3])]
    bg = max(set(corners), key=corners.count)
    diff = np.abs(arr[..., :3].astype(int) - np.array(bg)).sum(-1)
    return diff < 24, bg


def make_transparent(im):
    """Imagem RGBA com o fundo sólido (se houver) trocado por transparência."""
    arr = np.array(im)
    bgm, bg = background_mask(arr)
    if bg is not None:
        arr = arr.copy()
        arr[bgm, 3] = 0
        return Image.fromarray(arr), True
    return im, False


def text_mask(arr, fg, max_h=18, max_colors=3):
    """Marca rótulos de texto: pedaços pequenos com no máximo 3 cores."""
    lab, n = ndimage.label(fg, structure=np.ones((3, 3), bool))
    out = np.zeros_like(fg)
    rgb = arr[..., :3].astype(np.int32)
    code = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        hh, ww = ys.stop - ys.start, xs.stop - xs.start
        if hh > 64 or ww > 160:
            continue
        m = lab[ys, xs] == i
        px = rgb[ys, xs][m]
        white = (px.min(1) > 235).mean()
        dark = (px.max(1) < 90).mean()
        if white > 0.45 and dark > 0.03:
            out[ys, xs] |= m  # etiqueta: caixa branca com texto preto
        elif hh <= max_h and ww <= 40 and len(np.unique(code[ys, xs][m])) <= max_colors:
            out[ys, xs] |= m
    return out


def strip_lines(arr, fg, length=120):
    """Remove linhas finas e longas (divisórias e molduras das folhas)."""
    h_line = ndimage.binary_opening(fg, structure=np.ones((1, length), bool))
    h_thick = ndimage.binary_opening(fg, structure=np.ones((4, length), bool))
    v_line = ndimage.binary_opening(fg, structure=np.ones((length, 1), bool))
    v_thick = ndimage.binary_opening(fg, structure=np.ones((length, 4), bool))
    lines = (h_line & ~h_thick) | (v_line & ~v_thick)
    if lines.any():
        lines = ndimage.binary_dilation(lines, iterations=1) & fg & ~(h_thick | v_thick)
    return lines


def components(arr, merge=3, min_px=12, drop_text=False, lines=True):
    bgm, _ = background_mask(arr)
    fg = ~bgm
    if lines:
        fg = fg & ~strip_lines(arr, fg)
    seps = []
    if drop_text:
        tm = text_mask(arr, fg)
        fg = fg & ~tm
        if tm.any():
            tl, _ = ndimage.label(ndimage.binary_dilation(tm, structure=np.ones((3, 9), bool)))
            for sl in ndimage.find_objects(tl):
                if sl is not None:
                    seps.append([sl[1].start, sl[0].start, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start])
    if merge > 0:
        grown = ndimage.binary_dilation(fg, iterations=merge)
    else:
        grown = fg
    lab, n = ndimage.label(grown)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        sub = fg[ys, xs] & (lab[ys, xs] == i)
        if sub.sum() < min_px:
            continue
        # caixa justa só nos pixels reais
        rows = np.where(sub.any(1))[0]
        cols = np.where(sub.any(0))[0]
        boxes.append([xs.start + int(cols[0]), ys.start + int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1)])
    return boxes, seps


def _merge_contained(boxes, slack=0):
    """Junta caixas que se sobrepõem bastante (pedaços do mesmo quadro)."""
    changed = True
    while changed:
        changed = False
        out = []
        while boxes:
            a = boxes.pop()
            ax, ay, aw, ah = a
            for b in out:
                bx, by, bw, bh = b
                ix = min(ax + aw, bx + bw) - max(ax, bx)
                iy = min(ay + ah, by + bh) - max(ay, by)
                if ix > slack and iy > slack and ix * iy > 0.35 * min(aw * ah, bw * bh):
                    nx, ny = min(ax, bx), min(ay, by)
                    b[:] = [nx, ny, max(ax + aw, bx + bw) - nx, max(ay + ah, by + bh) - ny]
                    changed = True
                    break
            else:
                out.append(a)
        boxes = out
    return boxes


def rows_of(boxes, overlap=0.45):
    """Agrupa caixas em linhas pela sobreposição vertical, de cima para baixo."""
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3] / 2))
    rows = []
    for b in boxes:
        cy0, cy1 = b[1], b[1] + b[3]
        best = None
        for r in rows:
            ry0, ry1 = r['y0'], r['y1']
            inter = min(cy1, ry1) - max(cy0, ry0)
            if inter > overlap * min(b[3], ry1 - ry0):
                best = r
                break
        if best is None:
            rows.append({'y0': cy0, 'y1': cy1, 'items': [b]})
        else:
            best['items'].append(b)
            best['y0'] = min(best['y0'], cy0)
            best['y1'] = max(best['y1'], cy1)
    for r in rows:
        r['items'].sort(key=lambda b: b[0])
    rows.sort(key=lambda r: r['y0'])
    return rows


def split_groups(items, factor=2.6, min_gap=28, seps=()):
    """Divide uma linha em grupos separados por espaços grandes ou por rótulos de texto."""
    if len(items) < 2:
        return [items]

    def labeled(a, b):
        x0, x1 = a[0] + a[2], b[0]
        y0, y1 = min(a[1], b[1]), max(a[1] + a[3], b[1] + b[3])
        for sx, sy, sw, sh in seps:
            if sx >= x0 - 2 and sx + sw <= x1 + 2 and sy < y1 and sy + sh > y0:
                return True
        return False

    gaps = [items[i + 1][0] - (items[i][0] + items[i][2]) for i in range(len(items) - 1)]
    pos = sorted(g for g in gaps if g > 0)
    med = pos[len(pos) // 2] if pos else 4
    lim = max(min_gap, med * factor)
    groups, cur = [], [items[0]]
    for i, (g, b) in enumerate(zip(gaps, items[1:])):
        if g > lim or (seps and labeled(items[i], b)):
            groups.append(cur)
            cur = [b]
        else:
            cur.append(b)
    groups.append(cur)
    return groups


def slice_sheet(path, merge=3, min_px=12, drop_text=False, lines=True, im=None):
    im = im if im is not None else load_rgba(path)
    arr = np.array(im)
    boxes, seps = components(arr, merge, min_px, drop_text, lines)
    boxes = _merge_contained(boxes)
    rows = rows_of(boxes)
    out = []
    for r in rows:
        out.append([[list(map(int, b)) for b in g] for g in split_groups(r['items'], seps=seps)])
    return im, out


def grid_frames(w, h, fw, fh):
    return [[x, y, fw, fh] for y in range(0, h - fh + 1, fh) for x in range(0, w - fw + 1, fw)]
