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
# Folhas que já têm transparência e já estão em docs/assets: os itens apontam direto para elas.
INTERIOR = [
    ((368, 7, 64, 41), 'balcao-madeira', 'Balcão de madeira', 2, 1, 30, {'interact': 'brew'}),
    ((432, 7, 64, 41), 'balcao-pedra', 'Balcão de pedra (cozinha)', 2, 1, 30, {'interact': 'cook', 'station': 'bancada'}),
    ((384, 47, 48, 97), 'forno-a-lenha', 'Forno a lenha', 2, 1, 84, {'interact': 'cook', 'station': 'forno'}),
    ((272, 47, 48, 97), 'lareira-grelha', 'Grelha com coifa', 2, 1, 84, {'interact': 'cook', 'station': 'grelha'}),
    ((320, 47, 64, 97), 'grelha-dupla', 'Grelha dupla com coifa', 2, 1, 84, {'interact': 'cook', 'station': 'grelha'}),
    ((115, 4, 32, 44), 'fogao', 'Fogão a lenha', 1, 1, 34, {'interact': 'cook', 'station': 'fogao'}),
    ((176, 0, 48, 62), 'fogao-grande', 'Fogão industrial', 2, 1, 50, {'interact': 'cook', 'station': 'fogao'}),
    ((434, 115, 28, 23), 'fogareiro', 'Fogareiro', 1, 1, 18, {'interact': 'cook', 'station': 'fogao'}),
    ((113, 226, 95, 36), 'pia', 'Pia da cozinha', 3, 1, 34, {'interact': 'cook', 'station': 'pia'}),
    ((80, 6, 34, 34), 'mesa-redonda', 'Mesa redonda de madeira', 1, 1, 26, {'interact': 'eat'}),
    ((0, 0, 64, 26), 'mesa-comprida', 'Mesa comprida', 2, 1, 22, {'interact': 'eat'}),
    ((112, 66, 32, 30), 'mesinha', 'Mesinha de madeira', 1, 1, 24, {'interact': 'eat'}),
    ((65, 226, 45, 28), 'mesa-de-banquete', 'Mesa de banquete', 2, 1, 24, {'interact': 'eat'}),
    ((97, 62, 14, 22), 'banqueta-vermelha', 'Banqueta vermelha', 1, 1, 20, {'sit': True}),
    ((81, 62, 15, 12), 'banqueta', 'Banqueta', 1, 1, 14, {'sit': True}),
    ((0, 204, 48, 15), 'banco-comprido', 'Banco comprido', 2, 1, 14, {'sit': True}),
    ((176, 144, 48, 32), 'adega', 'Adega (garrafas)', 2, 1, 40, {'interact': 'brew'}),
    ((224, 122, 16, 22), 'barril', 'Barril de suco', 1, 1, 24, {'interact': 'drink'}),
    ((226, 260, 28, 24), 'cardapio', 'Cardápio (lousa)', 1, 1, 26, {'interact': 'menu'}),
    ((194, 260, 28, 24), 'lousa', 'Lousa', 1, 1, 26, {'interact': 'board'}),
    ((178, 74, 26, 24), 'bau-de-madeira', 'Baú de madeira', 1, 1, 22, {'interact': 'stash'}),
    ((240, 104, 32, 56), 'candelabro-sombrio', 'Candelabro sombrio', 1, 1, 60, {'interact': 'toggle'}),
    ((134, 178, 36, 46), 'porta-de-madeira', 'Porta de madeira', 1, 1, 62, {'interact': 'examine'}),
    ((180, 178, 40, 46), 'porta-de-ferro', 'Porta reforçada', 1, 1, 62, {'interact': 'examine'}),
    ((229, 178, 38, 46), 'porta-de-pedra', 'Porta de pedra', 1, 1, 62, {'interact': 'examine'}),
    ((552, 7, 16, 17), 'cabeca-de-lobo', 'Troféu: cabeça de lobo', 1, 1, 18, {'interact': 'examine'}),
    ((584, 7, 16, 17), 'cabeca-de-urso', 'Troféu: cabeça de urso', 1, 1, 18, {'interact': 'examine'}),
    ((166, 260, 20, 20), 'tabua', 'Tábua de corte', 1, 1, 10, {'small': True, 'interact': 'cook', 'station': 'bancada'}),
    ((562, 278, 10, 8), 'caneca', 'Caneca', 1, 1, 7, {'small': True, 'interact': 'drink'}),
    ((455, 272, 16, 16), 'panela', 'Panela', 1, 1, 10, {'small': True, 'interact': 'cook', 'station': 'fogao'}),
    ((496, 288, 16, 16), 'cesta', 'Cesta de pães', 1, 1, 10, {'small': True, 'interact': 'snack'}),
    ((112, 144, 14, 14), 'grade-do-chao', 'Grade no chão', 1, 1, 0, {'flat': True}),
]
MANA = [
    ((176, 0, 80, 97), 'arvore-frondosa', 'Árvore frondosa', 3, 2, 112, {'interact': 'water'}),
    ((33, 129, 30, 30), 'moita', 'Moita redonda', 1, 1, 26, {'interact': 'water'}),
    ((16, 129, 16, 31), 'arbusto-alto', 'Arbusto alto', 1, 1, 28, {'interact': 'water'}),
    ((0, 128, 16, 16), 'samambaia', 'Samambaia', 1, 1, 13, {'interact': 'water'}),
    ((0, 144, 16, 16), 'samambaia-dourada', 'Samambaia dourada', 1, 1, 13, {'interact': 'water'}),
    ((64, 96, 16, 16), 'pedrinhas', 'Pedrinhas', 1, 1, 8, {'small': True}),
    ((64, 112, 16, 16), 'pedra', 'Pedra', 1, 1, 12, {}),
    ((64, 128, 16, 32), 'pedregulho', 'Pedregulho', 1, 1, 24, {}),
    ((48, 224, 32, 32), 'rochedo', 'Rochedo', 1, 1, 28, {}),
    ((176, 112, 80, 64), 'caverna', 'Entrada da caverna', 4, 2, 70, {'interact': 'cave'}),
]
ALPHA = [
    ('assets/raw/pixel-crawler-free-pack-2-11/pixel-crawler-free-pack/environment/structures/buildings/interior/interior-props-01.png', 'int', 'Taverna e cozinha', INTERIOR),
    ('assets/raw/mana-seed-seasonal-forest-sample-summer/seasonal-sample-summer.png', 'mana', 'Bosque', MANA),
]
# Pisos extras (recortes de 16 px repetidos): terra batida e grama lisa do pacote de floresta
FLOORS_X = [
    ('assets/raw/mana-seed-seasonal-forest-sample-summer/seasonal-sample-summer.png', 'terra', 'Terra batida', [64, 16, 16, 16]),
    ('assets/raw/mana-seed-seasonal-forest-sample-summer/seasonal-sample-summer.png', 'grama', 'Grama do bosque', [0, 16, 16, 16]),
    ('assets/raw/mana-seed-seasonal-forest-sample-summer/seasonal-sample-summer.png', 'grama-florida', 'Grama florida', [0, 112, 16, 16]),
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
    for path, key, catname, items in ALPHA:
        if path not in cat['sheets'] or not (DOCS / path).exists():
            continue
        sid = cat['sheets'].index(path)
        for (box, iid, name, tw, th, hgt, extra) in items:
            x, y, w, h = box
            e = {'id': f'extra-{key}-{iid}', 'name': name, 'cat': catname, 's': sid, 'f': [x, y, w, h],
                 'sc': round((hgt or th * 32) / h, 3) if not extra.get('flat') else round(tw * 32 / max(w, 1), 3),
                 'w': tw, 'h': th, 'solid': not extra.get('flat') and not extra.get('small') and not extra.get('sit')}
            if hgt:
                e['hgt'] = hgt
            if extra.get('flat'):
                e['kind'] = 'flat'
            for k in ('sit', 'small', 'interact', 'station'):
                if k in extra:
                    e[k] = extra[k]
            cat['props'].append(e)
            total += 1
    cat['floors'] = [f for f in cat['floors'] if not f['id'].startswith('extra-floor-')]
    for path, iid, name, f in FLOORS_X:
        if path not in cat['sheets']:
            continue
        im = np.array(Image.open(DOCS / path).convert('RGB'))[f[1]:f[1] + f[3], f[0]:f[0] + f[2]].reshape(-1, 3).mean(0)
        cat['floors'].append({'id': f'extra-floor-{iid}', 'name': name, 'pack': 'Mana Seed', 's': cat['sheets'].index(path), 'f': f, 'sc': 2.0,
                              'avg': '#%02x%02x%02x' % tuple(int(v) for v in im)})
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
