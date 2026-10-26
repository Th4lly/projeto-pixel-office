"""Gera docs/assets a partir da pasta de sprites "Pixel office".

Uso:
    python3 tools/build_assets.py "C:/Users/Thallyta/Downloads/Pixel office"

O que faz:
  * copia todas as imagens da pasta para docs/assets/raw (nomes seguros para URL);
  * limpa as folhas do Ragnarok (fundo sólido vira transparente, divisórias e
    rótulos de texto saem) e salva em docs/assets/ro;
  * recorta folhas irregulares em quadros e monta as animações;
  * escreve docs/assets/catalog.json (o que o jogo carrega) e
    docs/assets/usage.json + docs/assets/USO.md (onde cada arquivo é usado);
  * copia fontes editáveis (.aseprite), licenças e leia-mes para assets-src/.

Nada é desenhado à mão: todo gráfico do jogo vem desta pasta.
"""
from __future__ import annotations

import json
import math
import re
import shutil
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slicer import (  # noqa: E402
    load_rgba, make_transparent, slice_sheet, components, _merge_contained, rows_of, split_groups,
)

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
OUT = DOCS / 'assets'
SRC_OUT = ROOT / 'assets-src'
TILE = 32  # pixels de mundo por tile

SKIP_DIRS = ('__MACOSX',)
SKIP_FILES = ('.DS_Store',)

# ----------------------------------------------------------------------------- utilidades


def slug(text: str) -> str:
    t = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    t = re.sub(r'[^A-Za-z0-9]+', '-', t).strip('-').lower()
    return t or 'x'


def nice(name: str) -> str:
    """Nome legível a partir do nome do arquivo."""
    n = re.sub(r'\.(png|gif)$', '', name, flags=re.I)
    n = re.sub(r'^(office_(furniture|electronics|props|decor)_)', '', n)
    n = re.sub(r'_0?1$', '', n)
    n = n.replace('_', ' ').replace('-', ' ')
    n = re.sub(r'\s+', ' ', n).strip()
    return translate(n)


PT = {
    'desk': 'mesa', 'chair': 'cadeira', 'table': 'mesa', 'stool': 'banqueta', 'sofa': 'sofá', 'armchair': 'poltrona',
    'bed': 'cama', 'lamp': 'luminária', 'plant': 'planta', 'tree': 'árvore', 'bookshelf': 'estante', 'shelf': 'prateleira',
    'cabinet': 'armário', 'wardrobe': 'guarda-roupa', 'dresser': 'cômoda', 'clock': 'relógio', 'printer': 'impressora',
    'computer': 'computador', 'monitor': 'monitor', 'laptop': 'notebook', 'mug': 'caneca', 'books': 'livros', 'book': 'livro',
    'stack': 'pilha', 'rug': 'tapete', 'round': 'redondo', 'window': 'janela', 'curtains': 'cortinas', 'picture': 'quadro',
    'botanical': 'botânico', 'potted': 'em vaso', 'wall': 'parede', 'floor': 'piso', 'bench': 'banco', 'padded': 'estofado',
    'large': 'grande', 'small': 'pequeno', 'tall': 'alto', 'wide': 'largo', 'long': 'longo', 'short': 'curto', 'double': 'casal',
    'single': 'solteiro', 'canopy': 'dossel', 'ottoman': 'pufe', 'chaise': 'chaise', 'glass': 'vidro', 'filing': 'arquivo',
    'pedestal': 'gaveteiro', 'mobile': 'móvel', 'corner': 'de canto', 'straight': 'reta', 'standing': 'em pé', 'task': 'giratória',
    'visitor': 'visitante', 'meeting': 'reunião', 'reception': 'recepção', 'counter': 'balcão', 'curved': 'curvo',
    'credenza': 'aparador', 'low': 'baixo', 'modesty panel': 'painel frontal', 'stapler': 'grampeador', 'calculator': 'calculadora',
    'headphones': 'fones', 'notebook': 'caderno', 'closed': 'fechado', 'open': 'aberto', 'off': 'desligado', 'folder': 'pasta',
    'papers': 'papéis', 'clipboard': 'prancheta', 'blank': 'em branco', 'frame': 'moldura', 'photo': 'foto', 'organizer': 'organizador',
    'pen cup': 'porta-canetas', 'keys': 'chaves', 'set': 'conjunto', 'usb drive': 'pendrive', 'tape dispenser': 'fita adesiva',
    'water bottle': 'garrafa d\'água', 'wastebasket': 'lixeira', 'archive box': 'caixa de arquivo', 'succulent': 'suculenta',
    'artwork': 'arte', 'abstract': 'abstrata', 'refrigerator': 'geladeira', 'compact': 'compacta', 'palm': 'palmeira',
    'partition': 'divisória', 'fabric': 'tecido', 'indoor': 'interna', 'umbrella': 'guarda-chuva', 'stand': 'suporte',
    'broadleaf': 'folhagem', 'bin': 'lixeira', 'waste': 'lixo', 'recycling': 'reciclagem', 'snake': 'espada-de-são-jorge',
    'shredder': 'fragmentadora', 'tower': 'gabinete', 'ups': 'nobreak', 'control panel': 'painel de controle',
    'camera': 'câmera', 'security': 'segurança', 'projector': 'projetor', 'copier': 'copiadora', 'multifunction': 'multifuncional',
    'loveseat': 'namoradeira', 'booth': 'banco de cabine', 'cream': 'creme', 'wood': 'madeira', 'terracotta': 'terracota',
    'olive': 'oliva', 'walnut': 'nogueira', 'autumn': 'outono', 'furniture': 'móvel', 'painting': 'pintura', 'loot': 'item',
}


def translate(n: str) -> str:
    low = n.lower()
    for en in sorted(PT, key=len, reverse=True):
        low = re.sub(rf'\b{re.escape(en)}\b', PT[en], low)
    return low[:1].upper() + low[1:]


def rect(b):
    return [int(v) for v in b]


def area(b):
    return b[2] * b[3]


class Builder:
    def __init__(self, src: Path):
        self.src = src
        self.cat = {
            'version': 1, 'tile': TILE, 'sheets': [], 'bodies': [], 'heads': [], 'headgears': [], 'weapons': [],
            'pets': [], 'mobs': [], 'npcs': [], 'effects': [], 'emotes': [], 'cursors': [], 'floors': [], 'walls': [],
            'props': [], 'ui': {}, 'uiFrames': {}, 'icons': [], 'palettes': [], 'gallery': [], 'credits': [], 'chairs': [],
            'deskColors': [], 'stickers': [], 'tilesets': [],
        }
        self.sheet_ids = {}
        self.usage = defaultdict(list)
        self.prop_ids = set()

    # ------------------------------------------------------------------ arquivos
    def rel(self, p: Path) -> str:
        return p.relative_to(self.src).as_posix()

    def use(self, p: Path, what: str):
        self.usage[self.rel(p)].append(what)

    def out_path(self, p: Path, sub='raw') -> Path:
        parts = [slug(x) for x in p.relative_to(self.src).with_suffix('').parts]
        return OUT / sub / Path(*parts).with_suffix(p.suffix.lower())

    def sheet(self, p: Path, im: Image.Image | None = None, sub='raw') -> int:
        """Registra uma imagem (copiando ou salvando a versão tratada) e devolve o índice."""
        key = (str(p), sub)
        if key in self.sheet_ids:
            return self.sheet_ids[key]
        dst = self.out_path(p, sub).with_suffix('.png' if p.suffix.lower() != '.gif' else '.gif')
        dst.parent.mkdir(parents=True, exist_ok=True)
        if im is not None:
            im.save(dst, optimize=True)
        else:
            shutil.copyfile(p, dst)
        url = dst.relative_to(DOCS).as_posix()
        self.cat['sheets'].append(url)
        idx = len(self.cat['sheets']) - 1
        self.sheet_ids[key] = idx
        return idx

    def files(self, pattern='**/*'):
        for p in sorted(self.src.glob(pattern)):
            if not p.is_file():
                continue
            if any(d in p.parts for d in SKIP_DIRS) or p.name in SKIP_FILES:
                continue
            yield p

    # ------------------------------------------------------------------ props
    def prop(self, p: Path, f, *, name=None, cat='Decoração', sc=1.0, sheet=None, frames=None, kind=None,
             solid=None, small=None, wall=False, sit=False, light=None, dirs=None, extra=None, id_hint=None):
        sid = sheet if sheet is not None else self.sheet(p)
        base = slug(id_hint or self.rel(p))
        pid = base
        k = 2
        while pid in self.prop_ids:
            pid = f'{base}-{k}'
            k += 1
        self.prop_ids.add(pid)
        dw, dh = f[2] * sc, f[3] * sc
        if small is None:
            small = dw <= 22 and dh <= 26 and not wall
        w = max(1, round(dw / TILE))
        h = 1 if (small or wall) else max(1, min(4, round(min(dh * 0.5, dw * 0.75) / TILE)))
        if solid is None:
            solid = not small and not wall and dh > 12
        entry = {
            'id': pid, 'name': name or nice(p.name), 'cat': cat, 's': sid, 'f': rect(f), 'sc': round(sc, 4),
            'w': w, 'h': h, 'solid': bool(solid),
        }
        if small:
            entry['small'] = True
        if wall:
            entry['wall'] = True
        if sit:
            entry['sit'] = True
        if light:
            entry['light'] = light
        if frames:
            entry['frames'] = [rect(x) for x in frames]
        if dirs:
            entry['dirs'] = dirs
        if kind:
            entry['kind'] = kind
        if extra:
            entry.update(extra)
        self.cat['props'].append(entry)
        self.use(p, f'objeto "{entry["name"]}" ({cat})')
        return entry

    def sheet_props(self, p: Path, *, cat, sc, merge=2, min_px=20, min_size=6, name_prefix=None, im=None, sub='raw', **kw):
        """Recorta uma folha com vários objetos soltos e registra cada um como objeto."""
        im = im if im is not None else load_rgba(p)
        arr = np.array(im)
        boxes, _ = components(arr, merge=merge, min_px=min_px, lines=False)
        boxes = _merge_contained(boxes)
        boxes = [b for b in boxes if b[2] >= min_size and b[3] >= min_size]
        rows = rows_of(boxes, overlap=0.3)
        sid = self.sheet(p, im if sub != 'raw' else None, sub=sub)
        n = 0
        prefix = name_prefix or nice(p.name)
        for r in rows:
            for b in r['items']:
                n += 1
                self.prop(p, b, name=f'{prefix} {n}', cat=cat, sc=sc, sheet=sid, id_hint=f'{self.rel(p)}-{n}', **kw)
        return n

    # ------------------------------------------------------------------ execução
    def run(self):
        if OUT.exists():
            shutil.rmtree(OUT)
        OUT.mkdir(parents=True)
        self.ragnarok()
        self.pixel_crawler()
        self.topdown_interior()
        self.modern_office()
        self.cozy_nook()
        self.coffee_shop()
        self.noble()
        self.office_chairs()
        self.demo_packs()
        self.megapack()
        self.mana_seed()
        self.demon_goblin()
        self.paper_ui()
        self.app_icons()
        self.pipoya()
        self.misc_root()
        self.extras()
        self.finish()

    # ================================================================== RAGNAROK
    def ro_files(self, kind):
        pre = 'PC _ Computer - Ragnarok Online - '
        for p in self.files(f'{pre}{kind}*.png'):
            yield p, p.name[len(pre):-4]

    def ro_sheet(self, p):
        im = load_rgba(p)
        im, _ = make_transparent(im)
        _, rows = slice_sheet(p, drop_text=True, im=im)
        # limpa rótulos/divisórias da imagem publicada: mantém só pixels dentro dos quadros
        arr = np.array(im)
        from slicer import strip_lines, text_mask, background_mask
        fg = ~background_mask(arr)[0]
        arr[strip_lines(arr, fg) | text_mask(arr, fg), 3] = 0
        keep = np.zeros(arr.shape[:2], bool)
        for r in rows:
            for g in r:
                for x, y, w, h in g:
                    keep[y:y + h, x:x + w] = True
        arr[~keep, 3] = 0
        clean = Image.fromarray(arr)
        sid = self.sheet(p, clean, sub='ro')
        return sid, rows

    def ragnarok(self):
        for p, label in self.ro_files('Classes'):
            self.ro_class(p, label)
        for p, label in self.ro_files('Heads'):
            self.ro_head(p, label)
        for p, label in self.ro_files('Headgear'):
            self.ro_headgear(p, label)
        for p, label in self.ro_files('Weapons'):
            self.ro_weapon(p, label)
        for p, label in self.ro_files('Enemies'):
            self.ro_mob(p, label)
        for p, label in self.ro_files('Effects'):
            self.ro_effect(p, label)
        for p, label in self.ro_files('Non-Playable Characters'):
            self.ro_npc(p, label)
        for p, label in self.ro_files('Miscellaneous'):
            self.ro_misc(p, label)

    @staticmethod
    def flat_groups(rows):
        return [g for r in rows for g in r]

    def ro_class(self, p, label):
        m = re.match(r'Classes \((Male|Female|Other)\) - (.+)', label)
        gender, cname = (m.group(1), m.group(2)) if m else ('Other', label)
        sid, rows = self.ro_sheet(p)
        groups = self.flat_groups(rows)
        name = CLASS_PT.get(cname, cname)
        if cname in ('Falcon',) or 'Carts' in cname:
            frames = [f for g in groups for f in g]
            pet = {'id': slug(label), 'name': PET_PT.get(cname, cname), 's': sid, 'sc': 0.7, 'frames': [rect(f) for f in frames[:24]],
                   'idle': [rect(f) for f in (groups[0] if groups else frames)[:8]]}
            self.cat['pets'].append(pet)
            self.use(p, f'mascote "{pet["name"]}" (segue o avatar)')
            return
        anims = ro_body_anims(groups)
        if not anims:
            self.npc_from_groups(p, sid, groups, name)
            return
        g = {'Male': 'm', 'Female': 'f'}.get(gender, 'm' if 'Male' in cname else 'f' if 'Female' in cname else 'x')
        body = {'id': slug(label), 'name': name, 'gender': g, 's': sid, 'sc': 0.72, **anims}
        self.cat['bodies'].append(body)
        self.use(p, f'classe de avatar "{name}" ({"masc." if g == "m" else "fem." if g == "f" else "outro"})')

    def ro_head(self, p, label):
        m = re.match(r'Heads \((Male|Female)(?: _ (Original))?\) - (.+)', label)
        gender = 'm' if m and m.group(1) == 'Male' else 'f'
        color = m.group(3) if m else label
        orig = bool(m and m.group(2))
        sid, rows = self.ro_sheet(p)
        seqs = []
        for r in rows:
            items = sorted([f for g in r for f in g], key=lambda b: b[0])
            if len(items) > 15 and len(items) % 15 not in (0,):
                # duas linhas grudadas por cabelos longos: separa pela altura do topo
                tops = sorted(set(b[1] for b in items))
                mid = (tops[0] + tops[-1]) / 2
                parts = [sorted([b for b in items if b[1] < mid], key=lambda b: b[0]), sorted([b for b in items if b[1] >= mid], key=lambda b: b[0])]
            else:
                parts = [items]
            for it in parts:
                for k in range(0, len(it) - 4, 5):
                    seqs.append(it[k:k + 5])
        n = 0
        for s in seqs:
            if len(s) < 5:
                continue
            n += 1
            self.cat['heads'].append({
                'id': f'{slug(label)}-{n}', 'name': f'Cabelo {n}{" (clássico)" if orig else ""}', 'gender': gender,
                'color': COLOR_PT.get(color, color), 'colorKey': slug(color), 's': sid, 'sc': 0.72, 'dirs': [rect(f) for f in s],
                'doram': color == 'Doram',
            })
        self.use(p, f'{n} penteados de cabelo ({COLOR_PT.get(color, color)}, {"masc." if gender == "m" else "fem."})')

    def ro_headgear(self, p, label):
        sid, rows = self.ro_sheet(p)
        name = label.replace('Headgear - ', '')
        n = 0
        for g in self.flat_groups(rows):
            chunks = [g[k:k + 5] for k in range(0, len(g), 5)] if len(g) >= 10 else [g]
            for c in chunks:
                if not c:
                    continue
                n += 1
                dirs = c[:5] if len(c) >= 5 else [c[0]] * 5
                self.cat['headgears'].append({'id': f'{slug(label)}-{n}', 'name': f'{HG_PT.get(name, name)} {n}', 'group': HG_PT.get(name, name),
                                              's': sid, 'sc': 0.72, 'dirs': [rect(f) for f in dirs],
                                              'anim': [rect(f) for f in c] if 'Animated' in name else None})
        self.use(p, f'{n} acessórios de cabeça ({HG_PT.get(name, name)})')

    def ro_weapon(self, p, label):
        sid, rows = self.ro_sheet(p)
        name = label.replace('Weapons - ', '')
        groups = self.flat_groups(rows)
        n = 0
        for g in groups:
            n += 1
            icon = max(g, key=area)
            self.cat['weapons'].append({'id': f'{slug(label)}-{n}', 'name': f'{WEAPON_PT.get(name, name)} {n}', 'group': WEAPON_PT.get(name, name),
                                        's': sid, 'sc': 0.72, 'icon': rect(icon), 'frames': [rect(f) for f in g]})
        self.use(p, f'{n} armas equipáveis no combate ({WEAPON_PT.get(name, name)})')

    def ro_mob(self, p, label):
        name = label.replace('Enemies - ', '')
        sid, rows = self.ro_sheet(p)
        groups = [g for g in self.flat_groups(rows) if g]
        anims = ro_mob_anims(groups)
        mob = {'id': slug(label), 'name': name, 's': sid, 'sc': 0.72, **anims}
        mob.update(MOB_STATS.get(name, {}))
        self.cat['mobs'].append(mob)
        self.use(p, f'monstro "{name}" na arena')

    def ro_effect(self, p, label):
        name = label.replace('Effects - ', '')
        sid, rows = self.ro_sheet(p)
        n = 0
        for g in self.flat_groups(rows):
            if not g:
                continue
            n += 1
            self.cat['effects'].append({'id': f'{slug(label)}-{n}', 'name': f'{name} {n}', 'group': name, 's': sid, 'sc': 0.72,
                                        'frames': [rect(f) for f in g]})
        self.use(p, f'{n} efeitos animados ({name}) — habilidades, status e objetos')

    def ro_npc(self, p, label):
        name = label.replace('Non-Playable Characters - ', '')
        sid, rows = self.ro_sheet(p)
        self.npc_from_groups(p, sid, self.flat_groups(rows), NPC_PT.get(name, name), group=name)

    def npc_from_groups(self, p, sid, groups, name, group=None, sc=0.72):
        n = 0
        for g in groups:
            if not g:
                continue
            n += 1
            self.cat['npcs'].append({'id': f'{slug(self.rel(p))}-{n}', 'name': f'{name} {n}', 'group': group or name, 's': sid,
                                     'sc': sc, 'frames': [rect(f) for f in g]})
        self.use(p, f'{n} NPCs/figuras ({name}) — decoração viva e arena')

    def ro_misc(self, p, label):
        name = label.replace('Miscellaneous - ', '')
        sid, rows = self.ro_sheet(p)
        groups = self.flat_groups(rows)
        if name == 'Emotes':
            n = 0
            for g in groups:
                n += 1
                self.cat['emotes'].append({'id': f'ro-{n}', 'name': f'Emote RO {n}', 's': sid, 'frames': [rect(f) for f in g]})
            self.use(p, f'{n} emotes animados (barra de emotes)')
        elif name == 'Cursors':
            frames = [f for g in groups for f in g]
            self.cat['cursors'] = [{'s': sid, 'f': rect(f)} for f in frames]
            # o primeiro vira o cursor do mapa (arquivo pequeno, que o navegador aceita como cursor)
            src = load_rgba(p)
            src, _ = make_transparent(src)
            x, y, w, hh = frames[0]
            (OUT / 'ui').mkdir(parents=True, exist_ok=True)
            src.crop((x, y, x + w, y + hh)).save(OUT / 'ui' / 'cursor.png')
            if len(frames) > 1:
                x, y, w, hh = frames[1]
                src.crop((x, y, x + w, y + hh)).save(OUT / 'ui' / 'cursor-hand.png')
            self.use(p, 'cursores do mouse no jogo')
        elif name == 'Book Icons':
            for i, f in enumerate([f for g in groups for f in g], 1):
                self.cat['ui'][f'book{i}'] = {'s': sid, 'f': rect(f)}
            self.use(p, 'ícones do quadro de quests')
        else:  # Slot Machine
            frames = [f for g in groups for f in g]
            big = max(frames, key=area)
            self.prop(p, big, name='Caça-níquel', cat='Lazer', sc=0.6, sheet=sid, frames=frames,
                      kind='slot', extra={'interact': 'slot'})

    # ================================================================== PIXEL CRAWLER
    def pixel_crawler(self):
        base = 'Pixel Crawler - Free Pack 2.11/Pixel Crawler - Free Pack'
        root = self.src / base
        if not root.exists():
            return
        # pisos/paredes/água/masmorra: amostras repetíveis
        for p in sorted((root / 'Environment/Tilesets').glob('*.png')):
            self.tileset(p, 16, 2.0, pack='Pixel Crawler')
        for p in sorted((root / 'Environment/Structures/Buildings').rglob('*.png')):
            if 'Interior_Walls' in p.name or p.name in ('Walls.png',):
                self.tileset(p, 16, 2.0, pack='Pixel Crawler', walls=True)
            elif p.name in ('Roofs.png',):
                self.tileset(p, 16, 2.0, pack='Pixel Crawler', walls=True)
            elif p.name == 'Shadows.png':
                self.sheet_props(p, cat='Sombras', sc=2.0, kind='flat')
            else:
                self.sheet_props(p, cat='Construção', sc=2.0)
        for p in sorted((root / 'Environment/Props/Static').rglob('*.png')):
            catg = {'Vegetation': 'Plantas', 'Rocks': 'Natureza', 'Furniture': 'Móveis', 'Dungeon_Props': 'Masmorra',
                    'Resources': 'Recursos', 'Esoteric': 'Mágico', 'Tools': 'Ferramentas', 'Farm': 'Fazenda',
                    'Shadows': 'Sombras', 'Meat': 'Cozinha', 'Pan': 'Cozinha'}.get(p.stem, 'Natureza')
            if 'Trees' in p.parts:
                self.sheet_props(p, cat='Plantas', sc=1.0, merge=1, min_px=200, min_size=24, name_prefix='Árvore')
            else:
                self.sheet_props(p, cat=catg, sc=2.0, merge=0, min_px=8, kind='flat' if catg == 'Sombras' else None)
        for p in sorted((root / 'Environment/Props/Animated').glob('*.png')):
            self.strip_prop(p, cat='Cozinha', sc=2.0)
        for p in sorted((root / 'Environment/Structures/Stations').rglob('*.png')):
            if p.stem.endswith('-Sheet'):
                self.anim_sheet_prop(p, cat='Estações', sc=2.0)
            else:
                self.sheet_props(p, cat='Estações', sc=2.0, merge=1)
        # personagens e monstros (tiras de animação)
        ents = root / 'Entities'
        for d in sorted({q.parent.parent for q in ents.rglob('*-Sheet.png') if 'Characters' not in q.parts}):
            self.crawler_entity(d)
        self.crawler_body(ents / 'Characters/Body_A/Animations')
        for p in sorted((root / 'Weapons').rglob('*.png')):
            sid = self.sheet(p)
            im = load_rgba(p)
            boxes, _ = components(np.array(im), merge=1, min_px=8, lines=False)
            for i, b in enumerate(sorted(_merge_contained(boxes), key=lambda b: (b[1], b[0])), 1):
                self.cat['weapons'].append({'id': f'{slug(self.rel(p))}-{i}', 'name': f'{nice(p.stem)} {i}', 'group': f'Arsenal {nice(p.stem)}',
                                            's': sid, 'sc': 2.0, 'icon': rect(b), 'frames': [rect(b)]})
            self.use(p, 'armas do arsenal (combate)')
        for p in sorted((root / 'Icons').glob('*.png')):
            sid = self.sheet(p)
            self.cat['ui']['crawlerIcons'] = {'s': sid, 'grid': 16}
            self.use(p, 'ícones de itens do inventário de combate')
        for p in sorted((root / 'MockUps').glob('*.png')):
            self.gallery(p, 'Taverna (mockup Pixel Crawler)')

    def tileset(self, p, cell, sc, pack, walls=False):
        """Extrai blocos repetíveis (pisos) e faces de parede de uma folha de tiles."""
        im = load_rgba(p)
        arr = np.array(im)
        sid = self.sheet(p)
        H, W = arr.shape[:2]
        n = 0
        seen = set()
        a = arr[..., 3]
        entries = []
        step = cell
        for y in range(0, H - cell * 2 + 1, step):
            for x in range(0, W - cell * 2 + 1, step):
                blk = arr[y:y + cell * 2, x:x + cell * 2]
                if (blk[..., 3] < 250).any():
                    continue
                key = hash(blk[::3, ::3].tobytes())
                if key in seen:
                    continue
                # repetível: bordas opostas parecidas
                d1 = np.abs(blk[0].astype(int) - blk[-1].astype(int)).mean()
                d2 = np.abs(blk[:, 0].astype(int) - blk[:, -1].astype(int)).mean()
                if d1 > 40 or d2 > 40:
                    continue
                seen.add(key)
                entries.append((d1 + d2, x, y))
        # mantém os mais repetíveis, sem sobreposição
        taken = np.zeros((H, W), bool)
        entries.sort()
        for _, x, y in entries:
            if taken[y:y + cell * 2, x:x + cell * 2].any():
                continue
            taken[y:y + cell * 2, x:x + cell * 2] = True
            n += 1
            blk = arr[y:y + cell * 2, x:x + cell * 2, :3].reshape(-1, 3).mean(0)
            self.cat['floors'].append({'id': f'{slug(self.rel(p))}-{n}', 'name': f'{nice(p.stem)} {n}', 'pack': pack, 's': sid,
                                       'f': [x, y, cell * 2, cell * 2], 'sc': sc, 'avg': '#%02x%02x%02x' % tuple(int(v) for v in blk),
                                       'wallish': walls})
        self.cat['tilesets'].append({'name': f'{pack} — {nice(p.stem)}', 's': sid, 'cell': cell, 'sc': sc})
        self.use(p, f'{n} pisos/texturas repetíveis + paleta de tiles ({pack})')

    def strip_prop(self, p, cat, sc, name=None):
        im = load_rgba(p)
        w, h = im.size
        fw = h if w % h == 0 else None
        if fw is None:
            for c in (64, 48, 32, 80, 16):
                if w % c == 0 and h % c == 0:
                    fw = c
                    break
        frames = []
        if fw:
            for y in range(0, h, h if w % h == 0 else fw):
                for x in range(0, w, fw):
                    box = im.crop((x, y, x + fw, y + (h if w % h == 0 else fw))).getbbox()
                    if box:
                        frames.append([x, y, fw, h if w % h == 0 else fw])
        if not frames:
            frames = [[0, 0, w, h]]
        # recorte comum (tira o vazio em volta, igual em todos os quadros)
        u = None
        for fr in frames:
            b = im.crop((fr[0], fr[1], fr[0] + fr[2], fr[1] + fr[3])).getbbox()
            if b:
                u = b if u is None else (min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3]))
        if u:
            frames = [[fr[0] + u[0], fr[1] + u[1], u[2] - u[0], u[3] - u[1]] for fr in frames]
        return self.prop(p, frames[0], name=name or nice(p.stem.replace('-Sheet', '')), cat=cat, sc=sc,
                         frames=frames if len(frames) > 1 else None)

    def anim_sheet_prop(self, p, cat, sc):
        """Folha de animação em grade irregular: todos os quadros viram um único objeto animado."""
        im = load_rgba(p)
        w, h = im.size
        if w % h == 0:
            return self.strip_prop(p, cat=cat, sc=sc)
        _, rows = slice_sheet(p, merge=2, lines=False, im=im)
        frames = [f for r in rows for g in r for f in g]
        if not frames:
            return None
        big = max(f[2] * f[3] for f in frames)
        frames = [f for f in frames if f[2] * f[3] > big * 0.35]
        fw = max(f[2] for f in frames)
        fh = max(f[3] for f in frames)
        # normaliza: mesma caixa (ancorada embaixo/centro) para não tremer
        norm = [[f[0] + f[2] // 2 - fw // 2, f[1] + f[3] - fh, fw, fh] for f in frames]
        return self.prop(p, norm[0], name=nice(p.stem.replace('-Sheet', '')), cat=cat, sc=sc, frames=norm if len(norm) > 1 else None)

    def strip_frames(self, p):
        im = load_rgba(p)
        w, h = im.size
        fw = h if w % h == 0 else (64 if w % 64 == 0 else 32)
        out = []
        for x in range(0, w - fw + 1, fw):
            b = im.crop((x, 0, x + fw, h)).getbbox()
            if b:
                out.append([x, 0, fw, h])
        return out or [[0, 0, w, h]]

    def crawler_entity(self, d: Path):
        anims = {}
        sid = None
        for p in sorted(d.rglob('*-Sheet.png')):
            key = p.parent.name.lower()
            sid = self.sheet(p)
            frames = self.strip_frames(p)
            anims.setdefault(key, {'s': sid, 'frames': frames})
            self.use(p, f'animação "{key}" de {d.name}')
        if not anims:
            return
        is_mob = 'Mobs' in d.parts
        ent = {'id': slug(self.rel(d)), 'name': d.name.replace(' - ', ' ').replace('Wizzard', 'Mago'), 'sc': 1.4, 'anims': anims, 'kind': 'crawler'}
        if is_mob:
            ent.update(MOB_STATS.get(d.name, {'hp': 18, 'ca': 12, 'atk': 3, 'dmg': '1d8+1', 'xp': 12}))
            self.cat['mobs'].append(ent)
        else:
            self.cat['npcs'].append({**ent, 'group': 'Cidadãos'})

    def crawler_body(self, d: Path):
        if not d.exists():
            return
        anims = {}
        for p in sorted(d.rglob('*-Sheet.png')):
            key = p.stem.replace('-Sheet', '').lower()
            anims[key] = {'s': self.sheet(p), 'frames': self.strip_frames(p)}
            self.use(p, f'animação "{key}" do NPC aventureiro (Pixel Crawler)')
        self.cat['npcs'].append({'id': 'crawler-body-a', 'name': 'Aventureiro', 'group': 'Aventureiros', 'sc': 1.4, 'anims': anims, 'kind': 'crawler'})

    # ================================================================== TOP-DOWN INTERIOR
    def topdown_interior(self):
        d = self.src / 'Top-Down_Retro_Interior'
        if not d.exists():
            return
        for p in sorted(d.glob('*.png')):
            if 'FloorsAndWalls' in p.name and 'Open' not in p.name:
                self.tileset(p, 16, 2.0, pack='Retro Interior')
                self.td_walls(p)
            elif 'OpenDoors' in p.name:
                self.sheet_props(p, cat='Portas e janelas', sc=2.0, merge=0, min_px=10, extra={'door': True})
            elif 'DoorsAndWindows' in p.name:
                self.sheet_props(p, cat='Portas e janelas', sc=2.0, merge=0, min_px=10, wall=False)
            elif 'FurnitureState2' in p.name:
                # mesmos móveis no estado 2 (ligado/aberto): vira o estado alternativo dos objetos da State1
                self.td_states(p)
            else:
                self.sheet_props(p, cat='Móveis' if 'Furniture' in p.name else 'Itens pequenos', sc=2.0, merge=0, min_px=10)

    def td_walls(self, p):
        """Moldura marrom das paredes da folha: vira o tipo de parede padrão do escritório."""
        sid = self.sheet_ids[(str(p), 'raw')]
        self.cat['walls'].append({'id': 'retro-wall', 'name': 'Parede retrô', 's': sid, 'top': [0, 0, 16, 16], 'sc': 2.0})

    def td_states(self, p):
        sid = self.sheet(p)
        state1 = [e for e in self.cat['props'] if 'furniturestate1' in e['id']]
        for e in state1:
            e['alt'] = {'s': sid, 'f': e['f']}  # mesma posição na folha do estado 2
        self.use(p, f'estado alternativo (ligado/aberto) de {len(state1)} móveis retrô')

    # ================================================================== MODERN OFFICE
    def modern_office(self):
        d = self.src / 'ModernOffice2DProps_v1.0/ModernOffice2DProps_v1.0'
        if not d.exists():
            return
        meta = {}
        try:
            for a in json.loads((d / 'Documentation/ASSET_LIST.json').read_text())['assets']:
                meta[a['file']] = a
            self.use(d / 'Documentation/ASSET_LIST.json', 'tamanhos e âncoras dos móveis modernos (gerador)')
        except Exception:
            pass
        sizes = {'furniture': 0.24, 'electronics': 0.11, 'props': 0.075, 'decor': 0.17}
        special = {'desk': 0.24, 'chair': 0.2, 'cabinet': 0.2, 'counter': 0.28, 'credenza': 0.22, 'copier': 0.18, 'printer': 0.13,
                   'refrigerator': 0.2, 'tree': 0.2, 'partition': 0.2, 'lamp_floor': 0.2, 'stand_umbrella': 0.15, 'clock_wall': 0.1}
        for p in sorted((d / 'Tiles').rglob('*.png')):
            relf = p.relative_to(d / 'Tiles').as_posix()
            m = meta.get(relf, {})
            catk = p.parent.name.lower()
            sc = sizes.get(catk, 0.15)
            for k, v in special.items():
                if k in p.stem:
                    sc = v
            im = load_rgba(p)
            b = im.getbbox() or (0, 0, im.width, im.height)
            f = [b[0], b[1], b[2] - b[0], b[3] - b[1]]
            cat = {'furniture': 'Escritório', 'electronics': 'Eletrônicos', 'props': 'Itens de mesa', 'decor': 'Decoração'}[catk]
            sit = 'chair' in p.stem or 'stool' in p.stem
            wall = 'clock_wall' in p.stem or 'artwork' in p.stem
            small = catk == 'props' or p.stem.endswith(('monitor_single_off_01', 'laptop_closed_01', 'laptop_open_off_01', 'lamp_desk_01'))
            self.prop(p, f, cat=cat, sc=sc, sit=sit, wall=wall, small=small,
                      extra={'desk': True} if 'desk' in p.stem else None)
        for p in sorted((d / 'TileMap').glob('*')):
            if p.suffix == '.png':
                self.gallery(p, 'Folha completa — Modern Office Props')
            else:
                self.use(p, 'mapa da folha (referência do gerador)')
        for p in sorted((d / 'Preview').glob('*.png')):
            self.gallery(p, 'Prévia — Modern Office Props')

    # ================================================================== COZY NOOK / COFFEE / NOBLE / CHAIRS
    def cozy_nook(self):
        d = self.src / 'Cozy_Reading_Nook_Free_Sample/Cozy_Reading_Nook_Free_Sample'
        if not d.exists():
            return
        place = {}
        try:
            sp = json.loads((d / 'Game_Ready/SCENE_PLACEMENT.json').read_text())
            place = sp
            self.use(d / 'Game_Ready/SCENE_PLACEMENT.json', 'monta o "Cantinho de leitura" pronto no mapa')
            self.use(d / 'Detail_2x/SCENE_PLACEMENT.json', 'conferência da cena em 2x (gerador)')
            self.use(d / 'Game_Ready/ASSET_INDEX.json', 'índice de tamanhos (gerador)')
            self.use(d / 'Detail_2x/ASSET_INDEX.json', 'índice de tamanhos 2x (gerador)')
        except Exception:
            pass
        sc = 0.42
        ids = {}
        for p in sorted((d / 'Game_Ready').glob('*.png')):
            im = load_rgba(p)
            b = im.getbbox()
            f = [0, 0, im.width, im.height] if not b else [b[0], b[1], b[2] - b[0], b[3] - b[1]]
            if p.stem == 'floor_walnut':
                sid = self.sheet(p)
                fl = {'id': 'nook-floor-walnut', 'name': 'Taco de nogueira', 'pack': 'Cozy Nook', 's': sid, 'f': [0, 0, 256, 256], 'sc': 0.25, 'avg': '#7a4b2c'}
                hi = d / 'Detail_2x' / p.name
                if hi.exists():
                    fl['hd'] = {'s': self.sheet(hi), 'k': 2}
                    self.use(hi, 'versão HD do piso "Taco de nogueira" (zoom alto)')
                self.cat['floors'].append(fl)
                self.use(p, 'piso "Taco de nogueira"')
                continue
            hi = d / 'Detail_2x' / p.name
            e = self.prop(p, f, cat='Cantinho de leitura', sc=sc, wall=p.stem in ('window_autumn', 'curtains_terracotta', 'botanical_picture', 'wall_shelf', 'wall_cream_walnut'),
                          kind='flat' if 'rug' in p.stem else None, sit='armchair' in p.stem,
                          small=p.stem in ('books_stack',))
            if hi.exists():
                e['hd'] = {'s': self.sheet(hi), 'k': 2}
                self.use(hi, f'versão HD (miniatura do catálogo) de "{e["name"]}"')
            ids[p.name] = e['id']
        if place:
            self.cat['scenes'] = {'nook': {'canvas': place.get('canvas'), 'objects': [{**o, 'id': ids.get(o['file'])} for o in place.get('objects', [])], 'sc': sc}}
        for p in sorted((d / 'Examples').glob('*.png')):
            self.gallery(p, f'Exemplo — Cantinho de leitura ({p.stem})')

    def coffee_shop(self):
        d = self.src / 'cozy_coffee_shop_free_directional_furniture_add_on/cozy_coffee_shop_free_directional_furniture_add_on'
        if not d.exists():
            return
        order = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
        for fam in sorted((d / 'sprites').iterdir()):
            if not fam.is_dir():
                continue
            frames = {}
            sids = {}
            for o in order:
                p = fam / f'{fam.name}_{o}.png'
                if not p.exists():
                    continue
                im = load_rgba(p)
                b = im.getbbox()
                frames[o] = [b[0], b[1], b[2] - b[0], b[3] - b[1]]
                sids[o] = self.sheet(p)
                self.use(p, f'direção {o.upper()} do móvel giratório "{nice(fam.name)}"')
            sheet = d / 'sheets' / f'{fam.name}_directions.png'
            first = fam / f'{fam.name}_s.png'
            e = self.prop(first, frames['s'], name=nice(fam.name), cat='Café', sc=0.15, sheet=sids['s'], sit=True,
                          extra={'rot': {o: {'s': sids[o], 'f': frames[o]} for o in frames}})
            self.usage[self.rel(first)].pop()  # já contado acima
            if sheet.exists():
                e['preview'] = {'s': self.sheet(sheet)}
                self.use(sheet, f'prévia das 8 direções de "{e["name"]}" no catálogo')

    def noble(self):
        d = self.src / 'noble_furniture/noble_furniture'
        if not d.exists():
            return
        colors = sorted(x.name for x in (d / 'sprites').iterdir() if x.is_dir())
        items = sorted(q.stem for q in (d / 'sprites' / colors[0]).glob('*.png'))
        for it in items:
            variants = {}
            for c in colors:
                p = d / 'sprites' / c / f'{it}.png'
                if not p.exists():
                    continue
                im = load_rgba(p)
                b = im.getbbox() or (0, 0, 64, 64)
                variants[c] = {'s': self.sheet(p), 'f': [b[0], b[1], b[2] - b[0], b[3] - b[1]]}
                self.use(p, f'cor "{COLOR_PT.get(c, c)}" do móvel nobre "{nice(it)}"')
            c0 = colors[0]
            p0 = d / 'sprites' / c0 / f'{it}.png'
            e = self.prop(p0, variants[c0]['f'], name=f'{nice(it)} (nobre)', cat='Móveis nobres', sc=1.0, sheet=variants[c0]['s'],
                          sit=any(k in it for k in ('chair', 'bench', 'sofa', 'chaise', 'ottoman')),
                          extra={'variants': variants, 'desk': 'desk' in it})
            self.usage[self.rel(p0)].pop()
        for p in sorted((d / 'spritesheets').glob('*.png')):
            c = p.stem.replace('noble_furniture_', '')
            self.cat['deskColors'].append({'id': c, 'name': COLOR_PT.get(c, c), 's': self.sheet(p)})
            self.use(p, f'amostra da cor "{COLOR_PT.get(c, c)}" no seletor de cores da mesa')
        for p in d.glob('*.png'):
            self.gallery(p, 'Cores da linha nobre')

    def office_chairs(self):
        d = self.src / '_cosy office chair v0.1/_cosy office chair'
        if not d.exists():
            return
        for col in sorted(x for x in d.iterdir() if x.is_dir()):
            rot = {}
            for p in sorted((col / 'single').glob('*.png')):
                k = {'front': 's', 'back': 'n', 'side left': 'w', 'side right': 'e'}[p.stem.replace(col.name + ' ', '')]
                im = load_rgba(p)
                b = im.getbbox()
                rot[k] = {'s': self.sheet(p), 'f': [b[0], b[1], b[2] - b[0], b[3] - b[1]]}
                self.use(p, f'direção da cadeira de escritório {col.name}')
            sheet = next((col / 'spritesheet').glob('*.png'), None)
            ch = {'id': slug(col.name), 'name': f'Cadeira {COLOR_PT.get(col.name.split()[0], col.name)}', 'rot': rot, 'sc': 1.6}
            if sheet:
                ch['sheet'] = self.sheet(sheet)
                self.use(sheet, f'animação de giro da cadeira {col.name} (seletor de cadeira)')
            self.cat['chairs'].append(ch)
            s = rot.get('s')
            if s:
                pfront = next((col / 'single').glob('*front.png'))
                e = self.prop(pfront, s['f'], name=ch['name'], cat='Escritório', sc=1.6, sheet=s['s'], sit=True, extra={'rot': rot})
                self.usage[self.rel(pfront)].pop()

    # ================================================================== DEMO PACKS (itens, móveis, quadros)
    def demo_packs(self):
        for folder, cat, sc in (('Demo/Demo', 'Itens', 0.8), ('Demo (1)/Demo', 'Móveis', 1.0), ('Demo (2)/Demo', 'Quadros', 0.9)):
            d = self.src / folder
            if not d.exists():
                continue
            for p in sorted(d.glob('*.png'), key=lambda q: int(re.sub(r'\D', '', q.stem) or 0)):
                im = load_rgba(p)
                b = im.getbbox() or (0, 0, im.width, im.height)
                f = [b[0], b[1], b[2] - b[0], b[3] - b[1]]
                num = re.sub(r'\D', '', p.stem)
                if cat == 'Itens':
                    self.cat.setdefault('loot', []).append({'id': f'loot-{num}', 'name': f'Item {num}', 's': self.sheet(p), 'f': f})
                    self.use(p, f'item que cai dos monstros (Item {num}) e decoração')
                    self.prop(p, f, name=f'Item {num}', cat='Itens', sc=sc, small=True)
                    self.usage[self.rel(p)].pop()
                else:
                    self.prop(p, f, name=f'{"Móvel" if cat == "Móveis" else "Quadro"} {num}', cat=cat, sc=sc,
                              wall=cat == 'Quadros')

    # ================================================================== MEGAPACK (animais, gatos, UI, ambiente)
    def megapack(self):
        d = self.src / 'MegaPackFree/MegaPackFree'
        if not d.exists():
            return
        for p in sorted((d / 'FreeAnimalPack').rglob('*.png')):
            if 'AnimalStuffs' in p.parts:
                self.prop(p, list(load_rgba(p).getbbox()), name=nice(p.stem), cat='Pets', sc=1.0, small=True)
                continue
            frames = self.strip_frames(p)
            self.cat['pets'].append({'id': slug(self.rel(p)), 'name': PET_PT.get(p.stem, nice(p.stem)), 's': self.sheet(p), 'sc': 1.0,
                                     'idle': frames, 'frames': frames})
            self.use(p, f'mascote animado "{PET_PT.get(p.stem, p.stem)}"')
        cats = d / 'CatMegaFree'
        for p in sorted(cats.rglob('*.png')):
            if 'CatRoomFree' in p.parts:
                self.sheet_props(p, cat='Cantinho dos gatos', sc=1.0, merge=1)
            elif 'CatUIFree' in p.parts:
                self.ui_sheet(p, 'catUi')
            elif 'PochiFree' in p.parts:
                im = load_rgba(p)
                _, rows = slice_sheet(p, merge=1, lines=False, im=im)
                sid = self.sheet(p)
                for i, g in enumerate(self.flat_groups(rows), 1):
                    self.cat['pets'].append({'id': f'pochi-{i}', 'name': f'Pochi {i}', 's': sid, 'sc': 1.0, 'idle': g, 'frames': g})
                self.use(p, 'mascotes "Pochi" (animações)')
            else:
                frames = self.strip_frames(p)
                self.cat['pets'].append({'id': slug(self.rel(p)), 'name': PET_PT.get(p.stem, nice(p.stem)), 's': self.sheet(p), 'sc': 1.0,
                                         'idle': frames, 'frames': frames})
                self.use(p, f'gato animado "{nice(p.stem)}"')
        for p in sorted((d / 'FreeEnvironment').glob('*.png')):
            self.sheet_props(p, cat='Plantas', sc=1.0, merge=1)
        for p in sorted((d / 'UIBundleFree').glob('*.png')):
            self.ui_sheet(p, f'bundle-{slug(p.stem)}')

    def ui_sheet(self, p, key):
        im = load_rgba(p)
        boxes, _ = components(np.array(im), merge=0, min_px=6, lines=False)
        boxes = sorted(_merge_contained(boxes), key=lambda b: (b[1], b[0]))
        self.cat['uiFrames'][key] = {'s': self.sheet(p), 'parts': [rect(b) for b in boxes]}
        self.use(p, f'peças de interface ({len(boxes)}) — tema "{key}" das janelas')

    # ================================================================== MANA SEED
    def mana_seed(self):
        d = self.src / 'Mana Seed Farmer Sprite Free Sample'
        if not d.exists():
            return
        sheets = d / 'farmer base sheets'
        layers = [q for q in sorted(sheets.rglob('*.png')) if q.name != 'fbas_blank_sheet.png']
        by = {}
        for q in layers:
            by.setdefault(q.parent.name, []).append(q)
        body = by.get('01body', [None])[0]
        if body:
            combos = []
            hairs = by.get('13hair', [None])
            shirts = by.get('05shrt', [None])
            hats = [None] + by.get('14head', [])
            for i, hair in enumerate(hairs):
                for j, shirt in enumerate(shirts):
                    for k, hat in enumerate(hats):
                        combos.append((hair, shirt, hat))
            for n, (hair, shirt, hat) in enumerate(combos, 1):
                base = load_rgba(body).copy()
                for q in [*by.get('03fot1', []), *by.get('04lwr1', []), shirt, hair, hat]:
                    if q:
                        base.alpha_composite(load_rgba(q))
                fake = d / f'farmer-combo-{n}.png'
                sid = self.sheet(fake, base, sub='mana')
                cell = 64
                walk_d = [[c * cell, 3 * cell, cell, cell] for c in range(6)]
                walk_s = [[c * cell, 4 * cell, cell, cell] for c in range(6)]
                self.cat['npcs'].append({'id': f'farmer-{n}', 'name': f'Jardineiro {n}', 'group': 'Jardineiros', 's': sid, 'sc': 1.0, 'kind': 'mana',
                                         'anims': {'walk-down': {'s': sid, 'frames': walk_d}, 'walk-side': {'s': sid, 'frames': walk_s},
                                                   'idle-down': {'s': sid, 'frames': [[0, 0, cell, cell]]}, 'idle-up': {'s': sid, 'frames': [[0, cell, cell, cell]]}}})
            for q in layers:
                self.use(q, f'camada do jardineiro (Mana Seed) — combinada em {len(combos)} jardineiros do jardim')
        blank = sheets / 'fbas_blank_sheet.png'
        if blank.exists():
            self.gallery(blank, 'Folha em branco (Mana Seed)')
        for q in sorted((d / '_supporting files').rglob('*.png')):
            if 'palettes' in q.parts:
                self.palette(q)
            else:
                self.gallery(q, f'Guia Mana Seed — {nice(q.stem)}')

    def palette(self, p):
        im = load_rgba(p)
        arr = np.array(im)
        cols = []
        for px in arr.reshape(-1, 4):
            if px[3] < 128:
                continue
            c = '#%02x%02x%02x' % tuple(int(v) for v in px[:3])
            if c not in cols:
                cols.append(c)
        self.cat['palettes'].append({'id': slug(self.rel(p)), 'name': nice(p.stem), 'colors': cols[:96]})
        self.use(p, f'paleta de {min(len(cols), 96)} cores no seletor de cores da mesa')

    # ================================================================== DEMÔNIO / GOBLIN
    def demon_goblin(self):
        d = self.src / 'Demon_v1.1/Demon_v1.1'
        if d.exists():
            for p in sorted(d.glob('demon_0*.png')):
                if 'palette' in p.name:
                    continue
                sid = self.sheet(p)
                im = load_rgba(p)
                frames = []
                cell = 64
                for y in range(0, im.height, cell):
                    row = []
                    for x in range(0, im.width, cell):
                        if im.crop((x, y, x + cell, y + cell)).getbbox():
                            row.append([x, y, cell, cell])
                    if row:
                        frames.append(row)
                anims = {'idle': {'s': sid, 'frames': frames[0]}, 'walk': {'s': sid, 'frames': frames[1] if len(frames) > 1 else frames[0]},
                         'attack': {'s': sid, 'frames': frames[2] if len(frames) > 2 else frames[0]},
                         'die': {'s': sid, 'frames': frames[-1]}}
                boss = {'id': slug(p.stem), 'name': f'Bafomé ({nice(p.stem.replace("demon_", "forma "))})', 'sc': 1.6, 'anims': anims, 'kind': 'grid',
                        **MOB_STATS['Bafomé'], 'boss': True}
                self.cat['mobs'].append(boss)
                self.use(p, f'chefe MvP "{boss["name"]}" da arena')
            for p in sorted(d.glob('*palette*.png')):
                self.palette(p)
        g = self.src / 'goblin_v1'
        for p in sorted(g.glob('*.png')) if g.exists() else []:
            if 'palette' in p.name:
                self.palette(p)
                continue
            sid = self.sheet(p)
            im = load_rgba(p)
            cell = 64 if im.width % 64 == 0 else 48 if im.width % 48 == 0 else 32
            rows = []
            for y in range(0, im.height, cell):
                row = [[x, y, cell, cell] for x in range(0, im.width, cell) if im.crop((x, y, x + cell, y + cell)).getbbox()]
                if row:
                    rows.append(row)
            if rows:
                anims = {'idle': {'s': sid, 'frames': rows[0]}, 'walk': {'s': sid, 'frames': rows[min(1, len(rows) - 1)]},
                         'attack': {'s': sid, 'frames': rows[min(2, len(rows) - 1)]}, 'die': {'s': sid, 'frames': rows[-1]}}
                self.cat['mobs'].append({'id': slug(p.stem), 'name': 'Goblin', 'sc': 1.4, 'anims': anims, 'kind': 'grid', **MOB_STATS['Goblin']})
                self.use(p, 'monstro "Goblin" da arena')

    # ================================================================== PAPER UI
    def paper_ui(self):
        d = self.src / 'Humble Gift - Paper UI System/Humble Gift - Paper UI System v1.1'
        if not d.exists():
            return
        sp = d / 'Sprites'

        def num(q):
            return int(re.sub(r'\D', '', q.stem) or 0)

        ui = self.cat['ui']
        for q in sorted(sp.rglob('*.png')):
            relp = q.relative_to(sp).as_posix()
            sid = self.sheet(q)
            im = Image.open(q)
            key = 'paper/' + slug(str(Path(relp).with_suffix('')))
            ui[key] = {'s': sid, 'w': im.width, 'h': im.height}
            self.use(q, 'interface: ' + PAPER_ROLE(relp))
        for q in sorted((d / 'SpriteSheet').glob('*.png')):
            self.gallery(q, f'Folha completa — Paper UI ({q.stem})')

    # ================================================================== ÍCONES DE APPS
    def app_icons(self):
        d = self.src / 'Pixelart_App_Icons_v5_by_ReffPixels/Pixelart_App_Icons_v5_by_ReffPixels'
        if not d.exists():
            return
        big = {q.stem: q for q in (d / 'Big (120x120) PNG').glob('*.png')}
        small = {q.stem: q for q in (d / 'Small (24x24) PNG').glob('*.png')}
        for name in sorted(set(big) | set(small)):
            e = {'id': slug(name), 'name': name}
            if name in big:
                e['big'] = self.sheet(big[name])
                self.use(big[name], f'ícone grande "{name}" (adesivo para decorar a mesa e painéis)')
            if name in small:
                e['small'] = self.sheet(small[name])
                self.use(small[name], f'ícone pequeno "{name}" (botões, anexos e integrações)')
            self.cat['icons'].append(e)

    # ================================================================== PIPOYA
    def pipoya(self):
        d = self.src / 'Pipoya Popup  Emotes Pack/Pipoya Popup  Emotes Pack'
        if not d.exists():
            return
        sheet = d / 'pipo-popupemotes.png'
        split = sorted((d / 'pipo-popupemotes Split images').glob('*.png'), key=lambda q: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', q.stem)])
        groups = defaultdict(list)
        for q in split:
            m = re.match(r'(.*?)(\d+)$', q.stem)
            groups[m.group(1) if m else q.stem].append(q)
        n = 0
        for name, qs in groups.items():
            n += 1
            self.cat['emotes'].append({'id': f'pipo-{slug(name)}', 'name': f'Balão {nice(name).strip() or n}', 'files': [self.sheet(q) for q in qs]})
            for q in qs:
                self.use(q, f'quadro do balão animado "{name}"')
        if sheet.exists():
            self.gallery(sheet, 'Folha de balões (Pipoya)')
        gif = d / 'pipo-popupemotes_sampleanimation.gif'
        if gif.exists():
            self.cat['ui']['emotePreview'] = {'s': self.sheet(gif)}
            self.use(gif, 'animação de exemplo no seletor de emotes')

    # ================================================================== SOLTOS NA RAIZ
    def misc_root(self):
        s = self.src
        p = s / 'copia office pixel.png'
        if p.exists():
            sid = self.sheet(p)
            props = [b for _, c, b, _ in OFFICE_BOXES if c not in ('ui', 'floor', 'wall')]
            clean = self.sheet(p, clean_boxes(load_rgba(p), props), sub='clean')
            for name, cat, box, opts in OFFICE_BOXES:
                opts = dict(opts) if isinstance(opts, dict) else opts
                if cat == 'ui':
                    self.cat['ui'][name] = {'s': sid, 'f': box}
                    self.use(p, f'interface: {opts}')
                elif cat == 'floor':
                    self.cat['floors'].append({'id': f'office-{slug(name)}', 'name': name, 'pack': 'Escritório pixel', 's': sid, 'f': box, 'sc': 32 / box[2], 'avg': opts})
                    self.use(p, f'piso "{name}"')
                elif cat == 'wall':
                    self.cat['walls'].append({'id': f'office-{slug(name)}', 'name': name, 's': sid, 'face': box, 'sc': 1.0, **opts})
                    self.use(p, f'parede "{name}"')
                elif cat == 'npc':
                    self.cat['npcs'].append({'id': f'office-{slug(name)}', 'name': name, 'group': 'Escritório', 's': clean, 'sc': 0.6, 'frames': [box]})
                    self.use(p, f'NPC "{name}"')
                else:
                    extra = dict(opts.pop('extra', {}))
                    if opts.pop('desk', False):
                        extra['desk'] = True
                    self.prop(p, box, name=name, cat=cat, sc=opts.pop('sc', 0.6), sheet=clean, id_hint=f'office-{name}', extra=extra or None, **opts)
        p = s / 'coins-chests-etc-2-0-noborders.png'
        if p.exists():
            self.sheet_props(p, cat='Tesouros', sc=1.0, merge=1, min_px=10)
        p = s / 'coins-chests-etc-2-0.png'
        if p.exists():
            self.gallery(p, 'Moedas e baús (com bordas)')
        for p in sorted((s / 'sample(idle&walk)').rglob('*.png')):
            frames = self.grid_auto(p)
            self.cat['npcs'].append({'id': slug(self.rel(p)), 'name': f'Visitante ({p.stem})', 'group': 'Visitantes', 's': self.sheet(p), 'sc': 1.2, 'frames': frames})
            self.use(p, f'NPC visitante animado ({p.stem})')
        p = s / 'Pxiel Art UI borders/Pxiel Art UI borders.png'
        if p.exists():
            self.ui_sheet(p, 'borders')
        d = s / 'mana seed seasonal forest sample (summer)'
        if d.exists():
            q = d / 'seasonal sample (summer).png'
            if q.exists():
                self.tileset(q, 16, 2.0, pack='Floresta de verão')
                self.sheet_props(q, cat='Floresta', sc=2.0, merge=1, min_px=60, im=None)
                self.usage[self.rel(q)][-1] += ' (árvore, arbustos, pedras e cachoeira recortados)'
            for q in sorted((d / 'seasonal water animations').glob('*.png')):
                self.strip_prop(q, cat='Água', sc=2.0)

    def grid_auto(self, p):
        im = load_rgba(p)
        _, rows = slice_sheet(p, merge=1, lines=False, im=im)
        return [rect(f) for r in rows for g in r for f in g]

    def gallery(self, p, name):
        self.cat['gallery'].append({'name': name, 's': self.sheet(p)})
        self.use(p, f'quadro "{name}" na galeria do lobby e créditos')

    # ================================================================== FONTES, LICENÇAS, LEIA-MES
    def extras(self):
        for p in self.files('**/*'):
            r = self.rel(p)
            if self.usage.get(r):
                continue
            ext = p.suffix.lower()
            if ext == '.aseprite':
                self.keep_src(p, 'fonte editável no Aseprite (assets-src/)')
            elif ext in ('.txt', '.md', '.pdf') or p.name.lower().startswith(('license', 'readme')):
                dst = self.keep_src(p, 'licença/leia-me — listado em Créditos')
                pub = OUT / 'licenses' / slug(r)
                pub = pub.with_suffix(ext)
                pub.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(p, pub)
                self.cat['credits'].append({'pack': r.split('/')[0], 'file': pub.relative_to(DOCS).as_posix()})
            elif ext == '.json':
                self.keep_src(p, 'metadados do pacote (assets-src/)')

    def keep_src(self, p, what):
        dst = SRC_OUT / Path(*[slug(x) for x in p.relative_to(self.src).with_suffix('').parts]).with_suffix(p.suffix.lower())
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, dst)
        self.use(p, what)
        return dst

    # ================================================================== FIM
    def finish(self):
        missing = []
        for p in self.files('**/*'):
            if not self.usage.get(self.rel(p)):
                missing.append(self.rel(p))
        cat = self.cat
        (OUT / 'catalog.json').write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')))
        (OUT / 'usage.json').write_text(json.dumps(self.usage, ensure_ascii=False, indent=0))
        lines = ['# Onde cada arquivo da pasta "Pixel office" é usado', '',
                 f'Arquivos: **{len(self.usage)}** usados, **{len(missing)}** sem uso.', '']
        for k in sorted(self.usage):
            lines.append(f'- `{k}` — ' + '; '.join(dict.fromkeys(self.usage[k])))
        if missing:
            lines += ['', '## Sem uso', ''] + [f'- `{m}`' for m in missing]
        (OUT / 'USO.md').write_text('\n'.join(lines))
        size = sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file())
        print(f'sheets={len(cat["sheets"])} props={len(cat["props"])} bodies={len(cat["bodies"])} heads={len(cat["heads"])} '
              f'headgears={len(cat["headgears"])} weapons={len(cat["weapons"])} mobs={len(cat["mobs"])} npcs={len(cat["npcs"])} '
              f'effects={len(cat["effects"])} floors={len(cat["floors"])} pets={len(cat["pets"])} icons={len(cat["icons"])}')
        print(f'usados={len(self.usage)} sem uso={len(missing)} tamanho={size / 1e6:.1f} MB')
        for m in missing[:40]:
            print('  sem uso:', m)


# ----------------------------------------------------------------------------- animações RO


def ro_body_anims(groups):
    """Mapeia os grupos de quadros de uma folha de classe do RO para animações.

    Direções na ordem das folhas: S, SO, O, NO, N (as outras são espelhadas).
    """
    groups = [g for g in groups if g]
    if not groups:
        return None
    first = groups[0]
    stand = sit = None
    if len(first) >= 10:
        stand, sit = first[:5], first[5:10]
    elif len(first) >= 5:
        stand = first[:5]
        nxt = groups[1] if len(groups) > 1 else []
        sit = nxt[:5] if len(nxt) >= 5 else None
    if not stand:
        return None
    walks = [g for g in groups if len(g) == 8]
    if len(walks) < 5:
        walks = [g for g in groups[1:] if 6 <= len(g) <= 9]
    if len(walks) < 5:
        return None
    walks = walks[:5]
    last_walk = groups.index(walks[-1])
    attacks = [g[:8] for g in groups[last_walk + 1:] if 4 <= len(g) <= 12 and g not in walks]
    allf = [f for g in groups for f in g]
    lying = [f for f in allf if f[2] > f[3] * 1.35]
    dead = max(lying, key=lambda f: f[2] / f[3]) if lying else stand[0]
    out = {'stand': [rect(f) for f in stand], 'walk': [[rect(f) for f in g] for g in walks], 'dead': rect(dead)}
    if sit:
        out['sit'] = [rect(f) for f in sit]
    if attacks:
        while len(attacks) < 5:
            attacks.append(attacks[-1])
        out['attack'] = [[rect(f) for f in g] for g in attacks[:5]]
    return out


def ro_mob_anims(groups):
    # descarta restos de divisórias (quadros finos demais)
    groups = [[f for f in g if f[2] >= 8 and f[3] >= 8] for g in groups]
    groups = [g for g in groups if g] or [[[0, 0, 8, 8]]]
    allf = [f for g in groups for f in g]
    lying = [f for f in allf if f[2] > f[3] * 1.3]
    die_g = None
    if lying:
        widest = max(lying, key=lambda f: f[2] / f[3])
        for g in groups:
            if widest in g:
                die_g = g
                break
    idle = groups[0]
    walk = groups[1] if len(groups) > 1 and groups[1] is not die_g else idle
    attack = None
    for g in groups[2:]:
        if g is not die_g and len(g) >= 3:
            attack = g
            break
    attack = attack or walk
    die = die_g or groups[-1]
    # só a direção de frente: corta as sequências longas (várias direções numa linha)
    def front(g):
        return g[: max(1, min(len(g), 8 if len(g) <= 9 else len(g) // 2))]
    return {'anims': {'idle': {'frames': [rect(f) for f in front(idle)]}, 'walk': {'frames': [rect(f) for f in front(walk)]},
                      'attack': {'frames': [rect(f) for f in front(attack)]}, 'die': {'frames': [rect(f) for f in die]}}, 'kind': 'ro'}


def clean_boxes(im, boxes):
    """Tira o carpete de fundo em volta de cada recorte (só o que encosta na borda do recorte)."""
    from scipy import ndimage
    arr = np.array(im).astype(np.int32)
    out = arr.copy()
    out[..., 3] = 0
    rgb = arr[..., :3]
    carpet = np.median(rgb[640:704, 448:512].reshape(-1, 3), axis=0)
    for x, y, w, h in boxes:
        sub = rgb[y:y + h, x:x + w]
        diff = np.abs(sub - carpet).sum(-1)
        sat = sub.max(-1) - sub.min(-1)
        bg = (diff < 60) & (sat < 30)
        lab, _ = ndimage.label(bg)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        kill = np.isin(lab, list(edge))
        blk = arr[y:y + h, x:x + w].copy()
        blk[kill, 3] = 0
        out[y:y + h, x:x + w] = blk
    return Image.fromarray(out.astype(np.uint8))


def carpet_to_alpha(im):
    """A folha "copia office pixel" tem um carpete cinza de fundo: vira transparência."""
    arr = np.array(im).astype(np.int32)
    rgb = arr[..., :3]
    # cor do carpete: mediana das bordas
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    med = np.median(edge, axis=0)
    diff = np.abs(rgb - med).sum(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    bg = (diff < 46) & (sat < 26)
    from scipy import ndimage
    bg = ndimage.binary_opening(bg, iterations=1)
    out = arr.copy()
    out[bg, 3] = 0
    return Image.fromarray(out.astype(np.uint8))


def PAPER_ROLE(relp):
    r = relp.lower()
    if 'appear animation' in r:
        return 'animação de abrir janelas (papel se desdobrando)'
    if 'day & night' in r:
        return 'relógio com ciclo de dia e noite'
    if 'buttons' in r:
        return 'botões estilizados'
    if 'icons' in r:
        return 'ícones das ações'
    if 'items' in r:
        return 'itens do inventário'
    if 'progress' in r:
        return 'barras de HP/SP e XP'
    if 'holders' in r:
        return 'molduras (relógio, avatar, slots)'
    if 'highlighter' in r:
        return 'destaque de seleção'
    if 'stamp' in r:
        return 'carimbo de quest concluída'
    if 'banners' in r:
        return 'faixas de título das áreas'
    if 'equipment' in r:
        return 'slots de equipamento (combate)'
    if 'book desk' in r:
        return 'livro do quadro de quests'
    if 'calander' in r:
        return 'calendário'
    if 'mini map' in r:
        return 'moldura do minimapa'
    if 'player hud' in r:
        return 'HUD do jogador (HP/SP)'
    if 'dialogue' in r:
        return 'caixa de diálogo'
    if 'notification' in r:
        return 'notificações (toasts)'
    if 'shop' in r or 'rewards' in r:
        return 'janela de recompensas da arena'
    if 'headers' in r:
        return 'cabeçalhos das janelas'
    if 'item holder' in r:
        return 'slots de itens'
    if 'paper' in r:
        return 'papel das janelas (bordas em 9 partes)'
    return 'peça de interface'


# Recortes da folha "copia office pixel.png" (ela tem o carpete pintado no fundo).
OFFICE_BOXES = [
    ('hud', 'ui', [12, 12, 272, 92], 'moldura do HUD de HP/SP'),
    ('minimap', 'ui', [776, 780, 248, 244], 'moldura do minimapa'),
    ('Carpete', 'floor', [436, 646, 40, 40], '#7a746c'),
    ('Porcelanato', 'floor', [196, 322, 32, 32], '#d9dde3'),
    ('Parede creme', 'wall', [516, 0, 24, 128], {'cap': '#5a3a24'}),
    ('Mesa com PC 1', 'Escritório pixel', [0, 140, 128, 86], {'desk': True, 'sc': 0.5}),
    ('Mesa com PC 2', 'Escritório pixel', [0, 268, 128, 82], {'desk': True, 'sc': 0.5}),
    ('Mesa com PC 3', 'Escritório pixel', [384, 12, 128, 112], {'desk': True, 'sc': 0.5}),
    ('Mesa com PC 4', 'Escritório pixel', [384, 272, 128, 74], {'desk': True, 'sc': 0.5}),
    ('Mesa com PC 5', 'Escritório pixel', [384, 398, 128, 110], {'desk': True, 'sc': 0.5}),
    ('Mesa com monitor cinza', 'Escritório pixel', [320, 512, 64, 128], {'desk': True, 'sc': 0.5}),
    ('Cadeira preta', 'Escritório pixel', [44, 222, 40, 46], {'sit': True, 'sc': 0.6}),
    ('Cadeira vermelha', 'Escritório pixel', [40, 345, 48, 62], {'sit': True, 'sc': 0.6}),
    ('Cadeira verde', 'Escritório pixel', [424, 345, 48, 50], {'sit': True, 'sc': 0.6}),
    ('Banco de madeira', 'Escritório pixel', [0, 416, 128, 60], {'sit': True, 'sc': 0.5}),
    ('Porta aberta', 'Escritório pixel', [192, 160, 128, 128], {'sc': 0.5}),
    ('Cabideiro de chapéus', 'Escritório pixel', [216, 388, 80, 124], {'sc': 0.5}),
    ('Arara de roupas', 'Escritório pixel', [384, 160, 128, 96], {'sc': 0.5}),
    ('Porta de madeira', 'Escritório pixel', [540, 22, 64, 104], {'wall': True, 'sc': 0.5}),
    ('Janela 1', 'Escritório pixel', [668, 8, 96, 80], {'wall': True, 'sc': 0.5}),
    ('Janela 2', 'Escritório pixel', [796, 8, 96, 80], {'wall': True, 'sc': 0.5}),
    ('Elevador', 'Escritório pixel', [918, 8, 100, 120], {'wall': True, 'sc': 0.5}),
    ('Copa completa', 'Escritório pixel', [512, 160, 256, 180], {'sc': 0.5}),
    ('Cabideiro com casacos', 'Escritório pixel', [768, 180, 64, 140], {'sc': 0.5}),
    ('Câmera de segurança 1', 'Escritório pixel', [950, 140, 74, 44], {'wall': True, 'sc': 0.4}),
    ('Câmera de segurança 2', 'Escritório pixel', [950, 330, 74, 44], {'wall': True, 'sc': 0.4}),
    ('Cadeira giratória preta', 'Escritório pixel', [516, 345, 56, 84], {'sit': True, 'sc': 0.5}),
    ('Cadeira giratória verde', 'Escritório pixel', [580, 345, 56, 84], {'sit': True, 'sc': 0.5}),
    ('Cadeira giratória grafite', 'Escritório pixel', [644, 345, 56, 84], {'sit': True, 'sc': 0.5}),
    ('Banqueta vermelha', 'Escritório pixel', [708, 345, 50, 84], {'sit': True, 'sc': 0.5}),
    ('Cadeira giratória azul', 'Escritório pixel', [514, 430, 58, 82], {'sit': True, 'sc': 0.5}),
    ('Cadeira giratória cinza', 'Escritório pixel', [578, 430, 58, 82], {'sit': True, 'sc': 0.5}),
    ('Cadeira giratória marrom', 'Escritório pixel', [640, 430, 60, 82], {'sit': True, 'sc': 0.5}),
    ('Cadeira giratória celeste', 'Escritório pixel', [708, 430, 54, 82], {'sit': True, 'sc': 0.5}),
    ('Guarda-roupa duplo 1', 'Escritório pixel', [768, 356, 64, 156], {'sc': 0.5}),
    ('Guarda-roupa duplo 2', 'Escritório pixel', [832, 356, 64, 156], {'sc': 0.5}),
    ('Arquivo de aço', 'Escritório pixel', [0, 512, 64, 128], {'sc': 0.5}),
    ('Armário marrom 1', 'Escritório pixel', [64, 512, 64, 128], {'sc': 0.5}),
    ('Armário marrom 2', 'Escritório pixel', [128, 512, 64, 128], {'sc': 0.5}),
    ('Estante de pastas', 'Escritório pixel', [192, 546, 64, 94], {'sc': 0.5}),
    ('Copiadora 1', 'Escritório pixel', [384, 520, 104, 112], {'sc': 0.5}),
    ('Copiadora 2', 'Escritório pixel', [64, 648, 128, 108], {'sc': 0.5}),
    ('Planta no vaso azul', 'Escritório pixel', [0, 652, 64, 104], {'sc': 0.5}),
    ('Planta no vaso de barro', 'Escritório pixel', [192, 640, 64, 116], {'sc': 0.5}),
    ('Geladeira', 'Escritório pixel', [320, 640, 64, 128], {'sc': 0.5}),
    ('Mesa baixa', 'Escritório pixel', [388, 704, 124, 60], {'sc': 0.5}),
    ('Mesa de reunião com notebooks', 'Escritório pixel', [64, 830, 130, 140], {'sc': 0.5, 'desk': True}),
    ('Mesa de reunião', 'Escritório pixel', [320, 830, 130, 140], {'sc': 0.5, 'desk': True}),
    ('Cadeira de reunião azul', 'Escritório pixel', [84, 782, 38, 56], {'sit': True, 'sc': 0.5}),
    ('Cadeira de reunião (lado)', 'Escritório pixel', [20, 838, 42, 62], {'sit': True, 'sc': 0.5}),
    ('Cadeira de reunião escura', 'Escritório pixel', [84, 976, 40, 48], {'sit': True, 'sc': 0.5}),
    ('Bebedouro 1', 'Escritório pixel', [512, 512, 48, 128], {'sc': 0.5}),
    ('Bebedouro 2', 'Escritório pixel', [704, 512, 48, 128], {'sc': 0.5}),
    ('Mesinha com livros', 'Escritório pixel', [576, 560, 64, 80], {'sc': 0.5}),
    ('Mesinha com pastas', 'Escritório pixel', [640, 570, 64, 70], {'sc': 0.5}),
    ('Planta de folhas', 'Escritório pixel', [768, 544, 64, 96], {'sc': 0.5}),
    ('Luminária de chão', 'Escritório pixel', [832, 512, 64, 128], {'sc': 0.5, 'light': {'r': 3, 'color': 'rgba(255,220,150,.32)'}}),
    ('Palmeira 1', 'Escritório pixel', [896, 512, 64, 128], {'sc': 0.5}),
    ('Palmeira 2', 'Escritório pixel', [960, 520, 60, 120], {'sc': 0.5}),
    ('Mesa de vidro', 'Escritório pixel', [512, 700, 112, 70], {'sc': 0.5}),
    ('Quadro de gráfico', 'Escritório pixel', [640, 664, 120, 112], {'sc': 0.5, 'extra': {'interact': 'chart'}}),
    ('Quadro de paisagem', 'Escritório pixel', [768, 656, 112, 64], {'wall': True, 'sc': 0.5}),
    ('Quadrinho', 'Escritório pixel', [960, 648, 56, 40], {'wall': True, 'sc': 0.5}),
    ('Xícara branca', 'Escritório pixel', [512, 776, 40, 36], {'small': True, 'sc': 0.35}),
    ('Xícara marrom', 'Escritório pixel', [576, 776, 40, 36], {'small': True, 'sc': 0.35}),
    ('Copo de café 1', 'Escritório pixel', [520, 856, 32, 42], {'small': True, 'sc': 0.35}),
    ('Copo de café 2', 'Escritório pixel', [584, 856, 32, 42], {'small': True, 'sc': 0.35}),
    ('Café na xícara 1', 'Escritório pixel', [512, 912, 40, 36], {'small': True, 'sc': 0.35}),
    ('Café na xícara 2', 'Escritório pixel', [576, 912, 40, 36], {'small': True, 'sc': 0.35}),
    ('Caneca 1', 'Escritório pixel', [520, 984, 40, 40], {'small': True, 'sc': 0.35}),
    ('Caneca 2', 'Escritório pixel', [584, 984, 40, 40], {'small': True, 'sc': 0.35}),
    ('Caneca 3', 'Escritório pixel', [784, 984, 32, 30], {'small': True, 'sc': 0.35}),
    ('Projetor na mesa', 'Escritório pixel', [656, 808, 96, 80], {'sc': 0.5, 'extra': {'interact': 'projector'}}),
    ('Tela de projeção', 'Escritório pixel', [640, 912, 120, 112], {'sc': 0.5}),
    ('Vaso de flores', 'Escritório pixel', [968, 736, 56, 72], {'sc': 0.4}),
    ('Recepcionista', 'npc', [232, 282, 48, 96], None),
]

CLASS_PT = {
    'Novice': 'Aprendiz', 'Acolyte': 'Noviço', 'Archer': 'Arqueiro', 'Mage': 'Mago', 'Merchant': 'Mercador', 'Knight': 'Cavaleiro',
    'Lord Knight': 'Lorde', 'Rune Knight': 'Cavaleiro Rúnico', 'Rune Knight (Alternate)': 'Cavaleira Rúnica (alt.)', 'Crusader': 'Templário',
    'Priest': 'Sacerdote', 'Arch Bishop': 'Arcebispo', 'Monk': 'Monge', 'Champion': 'Mestre', 'Wizard': 'Bruxo', 'High Wizard': 'Arquimago',
    'Warlock': 'Feiticeiro', 'Sorcerer': 'Sorcerer', 'Scholar': 'Professor', 'Hunter': 'Caçador', 'Bard': 'Bardo', 'Dancer (Adopted)': 'Odalisca',
    'Gypsy': 'Cigana', 'Minstrel': 'Menestrel', 'Maestro': 'Maestro', 'Wanderer': 'Musa', 'Assassin': 'Mercenário', 'Assassin Cross': 'Algoz',
    'Alchemist': 'Alquimista', 'Genetic': 'Bioquímico', 'Ninja': 'Ninja', 'Gunslinger': 'Justiceiro', 'Taekwon': 'Taekwon', 'Soul Linker': 'Espiritualista',
    'Game Master': 'Game Master', 'Hanbok': 'Hanbok', 'Santa': 'Papai Noel', 'Wedding': 'Casamento', 'Game Master Robot': 'Robô GM',
    'Genetic Costume (Female)': 'Bioquímica (traje)', 'Guillotine Cross Costume (Male)': 'Sicário (traje)', 'Mercenary Amazon': 'Amazona',
}
PET_PT = {'Falcon': 'Falcão', 'Merchant Carts (01 _ 02)': 'Carrinho 1', 'Merchant Carts (02 _ 02)': 'Carrinho 2', 'GoldenBarking': 'Golden latindo',
          'PigIdle': 'Porquinho', 'JumpCattt': 'Gato pulando', 'SleepDog': 'Cão dormindo', 'FrogIdle': 'Sapo', 'BirdFly': 'Passarinho',
          'Jumping': 'Gatinho pulando', 'Idle': 'Mochi', 'Box3': 'Gato na caixa'}
COLOR_PT = {'Black': 'Preto', 'Blue': 'Azul', 'Brown': 'Castanho', 'Green': 'Verde', 'Purple': 'Roxo', 'Red': 'Ruivo', 'White': 'Branco',
            'Yellow': 'Loiro', 'Doram': 'Doram', 'amber': 'Âmbar', 'blush': 'Rosé', 'charcoal': 'Grafite', 'crimson': 'Carmim', 'emerald': 'Esmeralda',
            'midnight': 'Meia-noite', 'purple': 'Roxo', 'teal': 'Petróleo', 'blue': 'azul', 'orange': 'laranja', 'pink': 'rosa', 'red': 'vermelha'}
HG_PT = {'Afros': 'Black power', 'Angel Wings': 'Asas de anjo', 'Animal Hats': 'Chapéu de bicho', 'Boxes & Bags': 'Caixas e sacolas',
         "Brunhild's Crown": 'Coroa de Brunhild', 'Claw Helmet': 'Elmo de garras', 'Crowns': 'Coroa', 'Dark Flame': 'Chama sombria',
         'Deviruchi': 'Chapéu Deviruchi', 'Halloween Hat': 'Chapéu de Halloween', 'Hats (01 _ 03)': 'Chapéu', 'Hats (Animated, 01 _ 03)': 'Chapéu animado',
         'Headdresses': 'Arranjo', 'Headgear (Middle, Animated)': 'Acessório animado', 'Hoods': 'Capuz', 'Imp Hat': 'Chapéu de diabrete',
         'Orc Face': 'Máscara de orc', 'Rainbow Star': 'Estrela arco-íris', 'Ribbons': 'Laço', 'Wizard Hats': 'Chapéu de mago', 'Zodiac Hats': 'Chapéu do zodíaco'}
WEAPON_PT = {'Acolyte Rods': 'Maça', 'Alchemist Axes': 'Machado', 'Alchemist Daggers': 'Adaga', 'Archer Bows': 'Arco', 'Assassin Dual Weapons (Female)': 'Katar',
             'Assassin Swords': 'Espada curta', 'Bard Daggers': 'Adaga de bardo', 'Bard Instrument': 'Instrumento', 'Crusader Axes (Peco Peco)': 'Machado de montaria',
             'Crusader Spears (Female)': 'Lança', 'Crusader Spears (Male)': 'Lança', 'Crusader Spears (Peco Peco, Baby)': 'Lança de montaria',
             'Gunslinger Guns': 'Arma de fogo', 'Kagerou Shurikens': 'Shuriken', 'Mercenary Bowman Weapons': 'Arco de mercenário',
             'Mercenary Spearman Weapons': 'Lança de mercenário', 'Rogue Bows': 'Arco de arruaceiro', 'Swordman Spears (Male)': 'Lança de espadachim',
             'Swordman Swords': 'Espada', 'Wizard Rods': 'Cajado'}
NPC_PT = {'Animals (Anthropomorphic)': 'Bicho falante', 'Animals': 'Animal', 'Fairies': 'Fada', 'NPCs (Holiday)': 'NPC festivo',
          'NPCs (Regional)': 'NPC regional', 'NPCs (Walking)': 'NPC andarilho', 'Rafflesias': 'Rafflesia', 'Treasure Chest': 'Baú do tesouro'}

# Estatísticas d20 (bestiário do PDF + conversões no mesmo espírito)
MOB_STATS = {
    'Orc Warrior': {'hp': 34, 'ca': 14, 'atk': 4, 'dmg': '1d12+3', 'softDef': 2, 'element': 'Terra', 'xp': 40, 'bash': True, 'attrs': {'for': 16, 'agi': 10, 'vit': 15, 'int': 6, 'des': 12, 'sor': 8}},
    'Orc Baby': {'hp': 12, 'ca': 11, 'atk': 2, 'dmg': '1d6+1', 'element': 'Terra', 'xp': 10},
    'Orc Lady': {'hp': 28, 'ca': 13, 'atk': 3, 'dmg': '1d10+2', 'element': 'Terra', 'xp': 30},
    'Bafomé': {'hp': 412, 'ca': 22, 'atk': 11, 'dmg': '2d10+7', 'critDmg': '4d10+14', 'critRange': 16, 'softDef': 6, 'mdef': 5, 'element': 'Sombrio',
               'immune': ['Sombrio', 'Veneno'], 'weak': {'Sagrado': 2}, 'xp': 1500, 'thor': True, 'attrs': {'for': 24, 'agi': 18, 'vit': 22, 'int': 20, 'des': 18, 'sor': 40}},
    'Goblin': {'hp': 16, 'ca': 12, 'atk': 3, 'dmg': '1d8+1', 'element': 'Vento', 'xp': 14},
    'Goblin (Mace)': {'hp': 18, 'ca': 13, 'atk': 3, 'dmg': '1d8+2', 'element': 'Vento', 'xp': 16},
    'Goblin Leader': {'hp': 60, 'ca': 15, 'atk': 6, 'dmg': '2d6+4', 'element': 'Vento', 'xp': 90},
    'Deviruchi': {'hp': 30, 'ca': 15, 'atk': 4, 'dmg': '1d10+2', 'element': 'Sombrio', 'weak': {'Sagrado': 2}, 'xp': 45},
    'Dark Lord': {'hp': 300, 'ca': 21, 'atk': 10, 'dmg': '2d10+6', 'element': 'Morto-Vivo', 'weak': {'Sagrado': 2}, 'xp': 1200, 'boss': True},
}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f'Pasta não encontrada: {src}')
    Builder(src).run()


if __name__ == '__main__':
    main()
