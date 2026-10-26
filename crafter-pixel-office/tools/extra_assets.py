"""Recorta as folhas extras (assets-src/extras/) e acrescenta os itens ao catálogo.

Uso: python3 tools/extra_assets.py      (roda também no fim de tools/build_assets.py)

Cada item vira um recorte com fundo transparente, empacotado numa folha em
docs/assets/extras/. Os itens entram em catalog.json → props com id "extra-…".
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'
SRC = ROOT / 'assets-src' / 'extras'
OUT = DOCS / 'assets' / 'extras'

# (caixa x, y, w, h), id, nome, categoria, w, h (tiles), altura no mundo (px), extras
ARENA = [
    ((40, 27, 53, 127), 'estandarte-vermelho', 'Estandarte vermelho', 1, 1, 64, {'interact': 'team', 'team': 'vermelho'}),
    ((120, 28, 148, 120), 'camarote-real', 'Camarote real (tenda)', 4, 2, 72, {'interact': 'watch'}),
    ((608, 27, 26, 120), 'poste-de-madeira', 'Poste de madeira', 1, 1, 64, {}),
    ((642, 27, 40, 171), 'parede-de-armas-longas', 'Parede de armas longas', 1, 1, 80, {'interact': 'weapons', 'rack': 'long'}),
    ((334, 94, 44, 45), 'alvo', 'Alvo de arco e flecha', 1, 1, 34, {'interact': 'archery'}),
    ((394, 99, 36, 41), 'alvo-2', 'Alvo de arco e flecha (2)', 1, 1, 34, {'interact': 'archery'}),
    ((461, 91, 79, 55), 'pilha-de-elmos', 'Pilha de elmos', 2, 1, 26, {'interact': 'helmets'}),
    ((552, 99, 30, 31), 'elmo-de-aco', 'Elmo de aço', 1, 1, 14, {'small': True, 'interact': 'helmets'}),
    ((352, 142, 77, 73), 'tapete-azul', 'Tapete azul', 2, 2, 0, {'flat': True}),
    ((25, 169, 21, 72), 'flamula', 'Flâmula', 1, 1, 52, {'interact': 'team', 'team': 'vermelho'}),
    ((59, 169, 21, 73), 'flamula-2', 'Flâmula (2)', 1, 1, 52, {'interact': 'team', 'team': 'vermelho'}),
    ((118, 155, 62, 86), 'pilha-de-caixotes', 'Pilha de caixotes', 2, 1, 40, {'interact': 'loot'}),
    ((191, 153, 164, 89), 'monte-de-equipamentos', 'Monte de equipamentos', 4, 2, 44, {'interact': 'armory'}),
    ((454, 162, 39, 43), 'poltrona-do-camarote', 'Poltrona do camarote', 1, 1, 30, {'sit': True}),
    ((504, 150, 45, 55), 'trono-vermelho', 'Trono vermelho', 1, 1, 40, {'sit': True}),
    ((556, 162, 39, 44), 'poltrona-do-camarote-2', 'Poltrona do camarote (2)', 1, 1, 30, {'sit': True}),
    ((367, 219, 37, 22), 'peitoral', 'Peitoral de aço', 1, 1, 12, {'small': True, 'interact': 'armory'}),
    ((411, 215, 31, 27), 'manoplas', 'Manoplas', 1, 1, 12, {'small': True, 'interact': 'armory'}),
    ((447, 220, 39, 18), 'arco-curto', 'Arco curto', 1, 1, 10, {'small': True, 'interact': 'weapons', 'rack': 'bow'}),
    ((490, 219, 53, 20), 'grevas', 'Grevas', 1, 1, 10, {'small': True, 'interact': 'armory'}),
    ((554, 216, 23, 22), 'broquel', 'Broquel', 1, 1, 11, {'small': True, 'interact': 'shield'}),
    ((578, 212, 55, 30), 'par-de-escudos', 'Par de escudos', 1, 1, 14, {'small': True, 'interact': 'shield'}),
    ((658, 214, 24, 28), 'escudo-heraldico', 'Escudo heráldico', 1, 1, 14, {'small': True, 'interact': 'shield'}),
    ((298, 249, 82, 60), 'rack-de-machados', 'Rack de machados', 3, 1, 38, {'interact': 'weapons', 'rack': 'axe'}),
    ((26, 261, 128, 47), 'tapete-azul-longo', 'Tapete azul longo', 4, 2, 0, {'flat': True}),
    ((195, 252, 83, 57), 'rack-de-espadas', 'Rack de espadas', 3, 1, 38, {'interact': 'weapons', 'rack': 'sword'}),
    ((400, 252, 82, 56), 'rack-de-lancas', 'Rack de lanças', 3, 1, 38, {'interact': 'weapons', 'rack': 'spear'}),
    ((502, 263, 83, 45), 'rack-vazio', 'Rack vazio', 3, 1, 28, {'interact': 'weapons', 'rack': 'any'}),
    ((611, 273, 23, 35), 'escudo-de-madeira', 'Escudo de madeira', 1, 1, 16, {'small': True, 'interact': 'shield'}),
    ((640, 271, 16, 37), 'adaga', 'Adaga', 1, 1, 14, {'small': True, 'interact': 'weapons', 'rack': 'dagger'}),
    ((26, 325, 67, 50), 'suporte-de-escudos', 'Suporte de escudos', 2, 1, 32, {'interact': 'shield'}),
    ((103, 325, 64, 50), 'suporte-de-escudos-2', 'Suporte de escudos (2)', 2, 1, 32, {'interact': 'shield'}),
    ((179, 325, 65, 50), 'cerca-de-madeira', 'Cerca de madeira', 2, 1, 28, {}),
    ((263, 346, 63, 30), 'banco-de-madeira', 'Banco de madeira', 2, 1, 18, {'sit': True}),
    ((341, 341, 29, 34), 'saco-de-graos', 'Saco de grãos', 1, 1, 18, {'interact': 'loot'}),
    ((375, 336, 35, 39), 'saco-grande', 'Saco grande', 1, 1, 21, {'interact': 'loot'}),
    ((416, 346, 28, 29), 'saco-pequeno', 'Saco pequeno', 1, 1, 15, {'interact': 'loot'}),
    ((26, 385, 45, 58), 'caixote-grande', 'Caixote grande', 1, 1, 30, {'interact': 'loot'}),
    ((76, 385, 47, 58), 'caixote-grande-2', 'Caixote grande (2)', 1, 1, 30, {'interact': 'loot'}),
    ((132, 399, 40, 44), 'caixote', 'Caixote', 1, 1, 22, {'interact': 'loot'}),
    ((239, 390, 40, 54), 'caixote-de-ripas', 'Caixote de ripas', 1, 1, 28, {'interact': 'loot'}),
    ((372, 401, 30, 42), 'caixote-claro', 'Caixote claro', 1, 1, 22, {'interact': 'loot'}),
    ((448, 396, 32, 47), 'boneco-de-treino', 'Boneco de treino', 1, 1, 40, {'interact': 'dummy'}),
    ((499, 396, 30, 48), 'boneco-de-treino-2', 'Boneco de treino (2)', 1, 1, 40, {'interact': 'dummy'}),
    ((549, 396, 33, 48), 'boneco-de-treino-3', 'Boneco de treino (3)', 1, 1, 40, {'interact': 'dummy'}),
]
PLANTS = [
    ((193, 2, 109, 116), 'bonsai', 'Bonsai', 1, 1, 34, {}),
    ((292, 17, 78, 101), 'planta-carnivora', 'Planta carnívora', 1, 1, 30, {}),
    ((27, 90, 70, 104), 'planta-orelhas', 'Planta orelhas', 1, 1, 30, {}),
    ((351, 96, 39, 98), 'cacto-alto', 'Cacto alto', 1, 1, 30, {}),
    ((94, 106, 62, 88), 'planta-coracao', 'Planta coração', 1, 1, 27, {}),
    ((163, 129, 46, 66), 'coracao-vermelho', 'Coração vermelho', 1, 1, 21, {}),
    ((219, 126, 54, 68), 'coracao-verde', 'Coração verde', 1, 1, 21, {}),
    ((293, 126, 41, 70), 'cacto-azul', 'Cacto azul', 1, 1, 21, {}),
    ((0, 224, 125, 165), 'costela-de-adao', 'Costela-de-adão florida', 1, 1, 54, {}),
    ((128, 221, 102, 168), 'arvore-florida', 'Árvore florida no vaso', 1, 1, 56, {}),
    ((237, 213, 90, 177), 'espada-florida', 'Espada florida', 1, 1, 54, {}),
    ((320, 216, 65, 173), 'cacto-gigante', 'Cacto gigante', 1, 1, 54, {}),
    ((25, 407, 71, 129), 'flor-rosa', 'Flor rosa', 1, 1, 42, {}),
    ((110, 425, 69, 110), 'heras', 'Vaso de heras', 1, 1, 36, {}),
    ((193, 408, 54, 127), 'flor-azul', 'Flor azul', 1, 1, 42, {}),
    ((265, 408, 47, 127), 'trepadeira', 'Trepadeira', 1, 1, 42, {}),
    ((331, 468, 50, 67), 'arbustinho', 'Arbustinho', 1, 1, 22, {}),
]
SHEETS = [('arena-props.png', 'arena', 'Arena', 24, ARENA), ('plantas-tailside.png', 'plantas', 'Plantas no vaso', 40, PLANTS)]


def cut(path, tol, items):
    im = np.array(Image.open(path).convert('RGBA')).astype(int)
    h, w = im.shape[:2]
    # o fundo pode ser liso ou xadrez: junta as cores mais comuns da borda
    border = np.concatenate([im[0, :, :3], im[-1, :, :3], im[:, 0, :3], im[:, -1, :3]])
    cols, cnt = np.unique(border // 4 * 4, axis=0, return_counts=True)
    bgs = cols[np.argsort(-cnt)[:3]]
    d = np.min([np.abs(im[:, :, :3] - b).sum(2) for b in bgs], axis=0)
    # sombra projetada = a cor do fundo escurecida (mesma proporção nos 3 canais)
    r = im[:, :, :3] / np.maximum(bgs[0], 1)
    shadow = (r.std(2) < 0.03) & (r.mean(2) > 0.6) & (r.mean(2) < 1.04)
    fg = (d > tol) & ~shadow
    fg = ndimage.binary_opening(fg, iterations=1)
    lab, _ = ndimage.label(ndimage.binary_dilation(fg, iterations=2))
    out = []
    for (x, y, bw, bh), *rest in items:
        sub = lab[y:y + bh, x:x + bw]
        ids, n = np.unique(sub[sub > 0], return_counts=True)
        keep = ids[n >= n.max() * 0.15] if len(ids) else []
        m = np.isin(sub, keep) & fg[y:y + bh, x:x + bw]
        rgba = im[y:y + bh, x:x + bw].copy()
        rgba[:, :, 3] = np.where(m, 255, 0)
        out.append((Image.fromarray(rgba.astype('uint8'), 'RGBA'), rest))
    return out


def pack(cuts):
    pad = 2
    W = 512
    x = y = rowh = 0
    pos = []
    for img, _ in cuts:
        if x + img.width + pad > W:
            x, y, rowh = 0, y + rowh + pad, 0
        pos.append((x, y))
        x += img.width + pad
        rowh = max(rowh, img.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for (img, _), (px, py) in zip(cuts, pos):
        sheet.paste(img, (px, py))
    return sheet, pos


def run():
    cat_path = DOCS / 'assets' / 'catalog.json'
    cat = json.loads(cat_path.read_text())
    cat['props'] = [p for p in cat['props'] if not p['id'].startswith('extra-')]
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for fname, key, catname, tol, items in SHEETS:
        src = SRC / fname
        if not src.exists():
            continue
        cuts = cut(src, tol, items)
        sheet, pos = pack(cuts)
        dst = OUT / f'{key}.png'
        sheet.save(dst, optimize=True)
        url = dst.relative_to(DOCS).as_posix()
        if url in cat['sheets']:
            sid = cat['sheets'].index(url)
        else:
            cat['sheets'].append(url)
            sid = len(cat['sheets']) - 1
        for (img, (iid, name, tw, th, hgt, extra)), (px, py) in zip(cuts, pos):
            e = {'id': f'extra-{key}-{iid}', 'name': name, 'cat': catname, 's': sid, 'f': [px, py, img.width, img.height],
                 'sc': round((hgt or th * 32) / img.height, 3) if not extra.get('flat') else round(tw * 32 / img.width, 3),
                 'w': tw, 'h': th, 'solid': not extra.get('flat') and not extra.get('small') and not extra.get('sit')}
            if hgt:
                e['hgt'] = hgt
            if extra.get('flat'):
                e['kind'] = 'flat'
            for k in ('sit', 'small', 'interact', 'rack', 'team'):
                if k in extra:
                    e[k] = extra[k]
            cat['props'].append(e)
            total += 1
    pruned = prune_letter_weapons(cat)
    cat_path.write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')))
    print(f'extras: {total} itens · {pruned} "armas" que eram letras dos rótulos removidas')


def prune_letter_weapons(cat):
    """Algumas folhas de armas do RO têm rótulos (letras pretas) que viraram 'armas' (ícone ou quadro só com letras pretas)."""
    keep = []
    cache = {}
    removed = 0
    for w in cat.get('weapons', []):
        fr = w.get('frames') or []
        for f in ([w['icon']] if w.get('icon') else []) + fr[:1]:
            path = DOCS / cat['sheets'][w['s']]
            if path not in cache:
                cache[path] = np.array(Image.open(path).convert('RGBA')).astype(int)
            a = cache[path][f[1]:f[1] + f[3], f[0]:f[0] + f[2]]
            op = a[:, :, 3] > 0
            if op.sum() and ((a[:, :, :3].sum(2) < 120) & op).sum() / op.sum() > 0.7:
                break
        else:
            keep.append(w)
            continue
        removed += 1
    cat['weapons'] = keep
    return removed


if __name__ == '__main__':
    run()
