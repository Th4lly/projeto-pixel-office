"""Importa sprites do LPC Revised (Liberated Pixel Cup) para o catálogo do jogo.

Fonte: https://github.com/ElizaWy/LPC (licença OGA-BY 3.0 / CC-BY 3.0 — créditos em
docs/assets/lpc/CREDITOS.txt). As folhas usadas ficam copiadas em assets-src/lpc/.

Uso:  python3 tools/lpc_assets.py [pasta do repositório LPC]

Cada item é recortado (só os pixels do objeto, sem vizinhos), empacotado em
docs/assets/lpc/pack-N.png e entra em catalog.json → props com id "lpc-…".
Todos ficam na escala nativa (1 px da arte = 1 px do mundo, igual aos personagens).
Também gera alguns sprites próprios (banco de jardim, vitrola, base do portal).
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'
OUT = DOCS / 'assets' / 'lpc'
SRC = ROOT / 'assets-src' / 'lpc'

DESK = 'Objects/Furniture/Desk, Office.png'
OCH = 'Objects/Furniture/Seating/Chair, Office.png'
DIN = 'Objects/Furniture/Seating/Chair, Dining A.png'
ARM = 'Objects/Furniture/Seating/Chair, Sofa D.png'
LOVE = 'Objects/Furniture/Seating/Loveseat, Small - Casual Solid B.png'
CAB = 'Objects/Furniture/Cabinet.png'
TREES = 'Terrain/trees_summer.png'
PLANTS = 'Terrain/plants_summer.png'
ROCKS = 'Terrain/Rocks, Grasslands.png'
FLW = 'Terrain/flowers.png'
WILD = 'Terrain/wildflowers_summer.png'
COLORS8 = ['amarelo', 'vermelho', 'azul', 'verde', 'marrom', 'marinho', 'cinza', 'branco']


def P(sheet, box, **kw):
    """Peça: folha + caixa [x, y, w, h]. Pode ter overlays (lista de (sheet, box)) desenhados por cima."""
    return {'sheet': sheet, 'box': box, **kw}


# ---------------------------------------------------------------- itens
# id, nome, categoria, peça (ou dict de direções), w, h (tiles no chão), extras
ITEMS = []


def add(iid, name, cat, piece, w=1, h=1, **extra):
    ITEMS.append((iid, name, cat, piece, w, h, extra))


# --- escritório
for i, (box, nm) in enumerate([([3, 80, 58, 35], 'escura'), ([67, 80, 58, 35], 'branca'), ([131, 80, 58, 35], 'madeira'), ([3, 144, 58, 35], 'grafite')]):
    add(f'mesa-{nm}', f'Mesa de escritório {nm}', 'Escritório LPC', P(DESK, box), 2, 1, desk=True)
add('balcao-recepcao', 'Balcão da recepção', 'Escritório LPC', P(DESK, [0, 12, 192, 40]), 6, 1, interact='table')
add('cadeira-escritorio', 'Cadeira de escritório', 'Escritório LPC', {
    's': P(OCH, [4, 46, 24, 34]), 'n': P(OCH, [4, 3, 24, 29]), 'e': P(OCH, [36, 0, 24, 32]), 'w': P(OCH, [36, 32, 24, 32])}, sit=True)
add('notebook', 'Notebook', 'Itens de mesa LPC', P('Objects/Small Items/Laptop.png', [38, 6, 19, 22]), small=True, interact='screen')
add('monitor', 'Monitor', 'Itens de mesa LPC', P('Objects/Furniture/TV, Widescreen.png', [398, 32, 36, 25]), small=True, interact='screen')
add('monitor-largo', 'Monitor ultrawide', 'Itens de mesa LPC', P('Objects/Furniture/TV, Widescreen.png', [325, 23, 52, 34]), small=True, interact='screen')
add('notebook-fechado', 'Notebook fechado', 'Itens de mesa LPC', P('Objects/Small Items/Laptop.png', [6, 102, 19, 14]), small=True)
add('notebook-prata', 'Notebook prata', 'Itens de mesa LPC', P('Objects/Small Items/Laptop.png', [102, 6, 19, 22]), small=True, interact='screen')
add('telefone', 'Telefone', 'Itens de mesa LPC', P('Objects/Small Items/Rotary Phones.png', [40, 17, 15, 13]), small=True, interact='phone')
add('telefone-vermelho', 'Telefone vermelho', 'Itens de mesa LPC', P('Objects/Small Items/Rotary Phones.png', [40, 49, 15, 13]), small=True, interact='phone')
add('porta-retrato', 'Porta-retrato', 'Itens de mesa LPC', P('Objects/Small Items/Tabletop Portraits.png', [41, 5, 16, 20]), small=True, interact='picture')
add('porta-retrato-2', 'Porta-retrato pequeno', 'Itens de mesa LPC', P('Objects/Small Items/Tabletop Portraits.png', [10, 37, 13, 20]), small=True, interact='picture')
add('papeis', 'Papéis', 'Itens de mesa LPC', P('Objects/Small Items/Loose Paper.png', [7, 41, 15, 8]), small=True, interact='examine')
add('pilha-de-papeis', 'Pilha de papéis', 'Itens de mesa LPC', P('Objects/Small Items/Loose Paper.png', [72, 67, 15, 19]), small=True, interact='examine')
add('cafeteira', 'Cafeteira', 'Itens de mesa LPC', P('Objects/Small Items/Coffee Maker.png', [8, 2, 15, 29]), small=True, interact='coffee')
add('xicara', 'Xícara', 'Itens de mesa LPC', P('Objects/Small Items/Coffee Maker.png', [75, 12, 9, 8]), small=True, interact='coffee')
add('abajur', 'Abajur', 'Itens de mesa LPC', P('Objects/Small Items/Lighting, Table.png', [4, 0, 24, 31]), small=True, interact='toggle', light={'r': 2.4, 'color': 'rgba(255,214,140,0.30)'})
add('abajur-azul', 'Abajur azul', 'Itens de mesa LPC', P('Objects/Small Items/Lighting, Table.png', [133, 33, 22, 29]), small=True, interact='toggle', light={'r': 2.4, 'color': 'rgba(170,220,255,0.26)'})
add('luminaria-de-mesa', 'Luminária de mesa', 'Itens de mesa LPC', P('Objects/Small Items/Lighting, Table.png', [202, 32, 17, 23]), small=True, interact='toggle', light={'r': 2, 'color': 'rgba(255,230,170,0.28)'})
add('vela', 'Vela', 'Itens de mesa LPC', P('Objects/Small Items/Lighting, Table.png', [139, 2, 10, 20]), small=True, interact='toggle', light={'r': 1.6, 'color': 'rgba(255,190,100,0.3)'})
add('xadrez', 'Peças de jogo', 'Itens de mesa LPC', P('Objects/Small Items/Games.png', [2, 9, 26, 10]), small=True, interact='tictactoe')
add('almofada', 'Almofada', 'Decoração LPC', P('Objects/Small Items/Pillows.png', [2, 8, 26, 15]), small=True)
add('almofada-azul', 'Almofada azul', 'Decoração LPC', P('Objects/Small Items/Pillows.png', [3, 104, 26, 15]), small=True)
add('vaso-de-flor', 'Vasinho de flor', 'Itens de mesa LPC', P('Objects/Small Items/Flowers.png', [10, 73, 12, 22]), small=True, interact='water')
add('vaso-de-flor-2', 'Vasinho de flor (2)', 'Itens de mesa LPC', P('Objects/Small Items/Flowers.png', [42, 73, 12, 22]), small=True, interact='water')
add('planta-de-mesa', 'Planta de mesa', 'Itens de mesa LPC', P('Objects/Small Items/Flowers.png', [133, 69, 22, 25]), small=True, interact='water')
add('buque', 'Buquê', 'Itens de mesa LPC', P('Objects/Small Items/Flowers.png', [167, 66, 19, 15]), small=True, interact='water')
add('prato', 'Refeição', 'Cozinha LPC', P('Objects/Small Items/Food/Meals.png', [3, 5, 26, 21]), small=True, interact='snack')
add('bolo', 'Bolo', 'Cozinha LPC', P('Objects/Small Items/Food/Dessert.png', [3, 47, 26, 37]), small=True, interact='snack')
add('torta', 'Torta', 'Cozinha LPC', P('Objects/Small Items/Food/Dessert.png', [0, 96, 33, 32]), small=True, interact='snack')
add('pratos', 'Pratos', 'Cozinha LPC', P('Objects/Small Items/Dishes A.png', [37, 10, 22, 14]), small=True)
# --- iluminação (no lugar do fogo)
add('poste', 'Poste de luz', 'Iluminação', P('Objects/Furniture/Lighting, Outdoors.png', [7, 4, 18, 80]), interact='toggle', light={'r': 4, 'color': 'rgba(255,224,150,0.32)'})
add('poste-2', 'Poste de luz (2)', 'Iluminação', P('Objects/Furniture/Lighting, Outdoors.png', [39, 4, 18, 80]), interact='toggle', light={'r': 4, 'color': 'rgba(255,224,150,0.32)'})
add('arandela', 'Arandela', 'Iluminação', P('Objects/Wall Items/Lighting, Wall.png', [6, 4, 20, 28]), wall=True, interact='toggle', light={'r': 3, 'color': 'rgba(255,214,140,0.30)'})
add('arandela-2', 'Arandela dourada', 'Iluminação', P('Objects/Wall Items/Lighting, Wall.png', [38, 4, 20, 28]), wall=True, interact='toggle', light={'r': 3, 'color': 'rgba(255,214,140,0.30)'})
add('luminarias-de-parede', 'Trio de luminárias', 'Iluminação', P('Objects/Wall Items/Lighting, Wall.png', [0, 43, 64, 19]), 2, 1, wall=True, interact='toggle', light={'r': 3.4, 'color': 'rgba(255,230,180,0.28)'})
for i, (box, nm) in enumerate([([4, 2, 24, 49], 'creme'), ([36, 2, 24, 49], 'dourada'), ([0, 64, 31, 52], 'arco'), ([132, 68, 24, 49], 'azul'), ([7, 128, 18, 52], 'coluna')]):
    add(f'luminaria-{nm}', f'Luminária de chão {nm}', 'Iluminação', P('Objects/Furniture/Lighting, Floor.png', box), interact='toggle', light={'r': 3.2, 'color': 'rgba(255,214,140,0.30)'})
add('candelabro', 'Candelabro', 'Iluminação', P('Objects/Furniture/Lighting, Floor.png', [64, 0, 32, 57]), interact='toggle', light={'r': 3.4, 'color': 'rgba(255,200,120,0.32)'})
# --- estantes, armários, mesinhas
for i, (box, nm) in enumerate([([64, 90, 32, 82], 'livros'), ([96, 90, 32, 82], 'livros-2'), ([128, 90, 32, 82], 'livros-3'), ([32, 90, 32, 82], 'louças')]):
    add(f'estante-{nm}', f'Estante ({nm})', 'Biblioteca', P(CAB, box), interact='links')
add('estante-baixa', 'Estante baixa', 'Biblioteca', P(CAB, [160, 128, 32, 44]), interact='links')
add('estante-baixa-2', 'Estante baixa (2)', 'Biblioteca', P(CAB, [192, 128, 32, 44]), interact='links')
add('armario', 'Armário', 'Móveis LPC', P(CAB, [0, 0, 32, 64]), interact='stash')
add('prateleira', 'Prateleira de parede', 'Biblioteca', P('Objects/Furniture/Shelf.png', [1, 43, 62, 21]), 2, 1, wall=True, interact='links')
add('escada-biblioteca', 'Escada de biblioteca', 'Biblioteca', P('Objects/Furniture/Ladder.png', [3, 7, 26, 83]), interact='examine')
for i, (box, nm) in enumerate([([6, 3, 20, 24], 'clara'), ([6, 67, 20, 24], 'media'), ([6, 163, 20, 24], 'branca'), ([6, 195, 20, 24], 'preta')]):
    add(f'mesinha-{nm}', f'Mesa de canto {nm}', 'Móveis LPC', P('Objects/Furniture/End Table.png', box), interact='table')
add('mesa-de-centro', 'Mesa de centro', 'Móveis LPC', P('Objects/Furniture/Table, Ornate Wood.png', [8, 35, 48, 25]), 2, 1, interact='table')
add('mesa-redonda', 'Mesa redonda', 'Móveis LPC', P('Objects/Furniture/Table, Ornate Wood.png', [0, 0, 30, 32]), interact='eat')
add('mesa-comprida', 'Mesa comprida de madeira', 'Móveis LPC', P('Objects/Furniture/Table, Rough Wood.png', [8, 22, 80, 42]), 3, 1, interact='eat')
add('mesa-comprida-clara', 'Mesa comprida clara', 'Móveis LPC', P('Objects/Furniture/Table, Rough Wood.png', [8, 150, 80, 42]), 3, 1, interact='eat')
for i, (y, nm) in enumerate([(0, 'grafite'), (64, 'cinza'), (128, 'areia')]):
    add(f'mesa-moderna-{nm}', f'Mesa moderna {nm}', 'Móveis LPC', P('Objects/Furniture/Table, Card.png', [0, y, 92, 61]), 3, 2, interact='eat')
add('mesa-reuniao', 'Mesa de reunião com toalha', 'Móveis LPC', P('Objects/Furniture/Table, Ornate Wood.png', [104, 16, 80, 112]), 3, 3, interact='meeting')
add('lareira', 'Lareira', 'Móveis LPC', P('Objects/Furniture/Fireplace.png', [1, 16, 94, 72]), 3, 1, interact='toggle', light={'r': 4, 'color': 'rgba(255,150,70,0.30)'})
add('lareira-tijolo', 'Lareira de tijolo', 'Móveis LPC', P('Objects/Furniture/Fireplace.png', [108, 15, 72, 70]), 2, 1, interact='toggle', light={'r': 4, 'color': 'rgba(255,150,70,0.30)'})
add('arquivo', 'Arquivo de gavetas', 'Móveis LPC', P('Objects/Furniture/Dresser.png', [33, 6, 62, 40]), 2, 1, interact='stash')
add('arquivo-escuro', 'Arquivo escuro', 'Móveis LPC', P('Objects/Furniture/Dresser.png', [289, 134, 62, 40]), 2, 1, interact='stash')
add('relogio-de-pe', 'Relógio de pé', 'Móveis LPC', P('Objects/Furniture/Clock, Grandfather.png', [7, 22, 18, 71]), interact='pomodoro')
add('espelho', 'Espelho', 'Móveis LPC', P('Objects/Furniture/Mirror, Standing.png', [14, 2, 39, 62]), interact='wardrobe')
add('bebedouro', 'Bebedouro', 'Móveis LPC', P('Objects/Furniture/Water Cooler.png', [8, 9, 18, 53]), interact='water_drink')
add('copiadora', 'Copiadora', 'Móveis LPC', P('Objects/Furniture/Copy Machine.png', [5, 18, 53, 45]), 2, 1, interact='print')
add('maquina-de-vendas', 'Máquina de lanches', 'Móveis LPC', P('Objects/Furniture/Vending Machine.png', [16, 0, 40, 64]), interact='snack')
add('maquina-de-bebidas', 'Máquina de bebidas', 'Móveis LPC', P('Objects/Furniture/Vending Machine.png', [56, 0, 40, 64]), interact='drink')
add('tv', 'TV de parede', 'Móveis LPC', P('Objects/Furniture/TV, Widescreen.png', [134, 5, 84, 52]), 3, 1, wall=True, interact='tv')
add('tv-pequena', 'TV média', 'Móveis LPC', P('Objects/Furniture/TV, Widescreen.png', [238, 14, 68, 43]), 2, 1, wall=True, interact='tv')
add('geladeira', 'Geladeira', 'Cozinha LPC', P('Objects/Furniture/Fridge.png', [0, 0, 32, 64]), interact='snack')
add('fogao', 'Fogão', 'Cozinha LPC', P('Objects/Furniture/Oven, Modern.png', [0, 9, 32, 41]), interact='cook', station='fogao')
add('pia', 'Pia', 'Cozinha LPC', P('Objects/Furniture/Sink, Countertop.png', [3, 0, 61, 29]), 2, 1, interact='cook', station='pia')
add('lixeira', 'Lixeira', 'Móveis LPC', P('Objects/Furniture/Bin.png', [9, 0, 14, 31]), interact='examine')
add('lixeira-reciclagem', 'Lixeira de reciclagem', 'Móveis LPC', P('Objects/Furniture/Bin.png', [39, 3, 18, 28]), interact='examine')
for i, nm in enumerate(COLORS8):
    add(f'banqueta-{nm}', f'Banqueta {nm}', 'Assentos LPC', P('Objects/Furniture/Seating/Bar Stools.png', [4 + 32 * i, 0, 24, 32]), sit=True)
for i, nm in enumerate(COLORS8):
    add(f'pufe-{nm}', f'Pufe {nm}', 'Assentos LPC', P('Objects/Furniture/Seating/Ottoman, Small A.png', [5 + 32 * (i % 4), 8 + 32 * (i // 4), 24, 21]), sit=True)
# cadeiras de jantar: 4 direções (o encosto vem num overlay)
for r, nm in enumerate(COLORS8):
    y = 32 * r
    add(f'cadeira-{nm}', f'Cadeira {nm}', 'Assentos LPC', {
        's': P(DIN, [0, y, 32, 32]),
        'e': P(DIN, [32, y, 32, 32], over=[(DIN, [64, y, 32, 32])]),
        'w': P(DIN, [128, y, 32, 32], over=[(DIN, [96, y, 32, 32])]),
        'n': P(DIN, [160, y, 32, 32], over=[(DIN, [192, y, 32, 32])]),
    }, sit=True)
# poltronas e sofás em 8 cores, 4 direções
for c, nm in enumerate(COLORS8):
    gx, gy = (c % 4) * 64, (c // 4) * 64
    add(f'poltrona-{nm}', f'Poltrona {nm}', 'Assentos LPC', {
        's': P(ARM, [gx, gy, 32, 32]), 'n': P(ARM, [gx + 32, gy, 32, 32]),
        'e': P(ARM, [gx, gy + 32, 32, 32]), 'w': P(ARM, [gx + 32, gy + 32, 32, 32])}, sit=True)
    gx, gy = (c % 4) * 64, (c // 4) * 128
    add(f'sofa-{nm}', f'Sofá {nm}', 'Assentos LPC', {
        's': P(LOVE, [gx, gy, 64, 32]), 'n': P(LOVE, [gx, gy + 96, 64, 32]),
        'e': P(LOVE, [gx, gy + 32, 32, 64]), 'w': P(LOVE, [gx + 32, gy + 32, 32, 64])}, 2, 1, sit=True)
add('trono', 'Trono', 'Assentos LPC', P('Objects/Furniture/Seating/Thrones.png', [64, 0, 64, 64]), sit=True)
# tapetes
add('tapete-vinhas-azul', 'Tapete de vinhas azul', 'Tapetes', P('Objects/Furniture/Rugs/Swirling Vine Rug.png', [0, 0, 160, 64]), 5, 2, flat=True)
add('tapete-vinhas-rosa', 'Tapete de vinhas rosa', 'Tapetes', P('Objects/Furniture/Rugs/Swirling Vine Rug.png', [0, 64, 160, 64]), 5, 2, flat=True)
add('tapete-arco-iris', 'Tapete arco-íris', 'Tapetes', P('Objects/Furniture/Rugs/Rainbow Rug.png', [2, 1, 92, 62]), 3, 2, flat=True)
# quadros
add('quadro-onda', 'Quadro: a onda', 'Quadros LPC', P('Objects/Wall Items/Paintings, Landscape.png', [74, 0, 44, 32]), 2, 1, wall=True, interact='picture')
add('quadro-panorama', 'Quadro: panorama', 'Quadros LPC', P('Objects/Wall Items/Paintings, Landscape.png', [7, 101, 81, 25]), 3, 1, wall=True, interact='picture')
add('quadro-cachoeira', 'Quadro: cachoeira', 'Quadros LPC', P('Objects/Wall Items/Paintings, Landscape.png', [13, 3, 39, 61]), wall=True, interact='picture')
add('quadro-abstrato', 'Quadro abstrato', 'Quadros LPC', P('Objects/Wall Items/Paintings, Abstract.png', [35, 3, 84, 43]), 3, 1, wall=True, interact='picture')
add('quadro-fogo', 'Quadro: chamas', 'Quadros LPC', P('Objects/Wall Items/Paintings, Abstract.png', [141, 1, 39, 63]), wall=True, interact='picture')
add('poster', 'Pôster', 'Quadros LPC', P('Objects/Wall Items/Posters.png', [99, 7, 24, 36]), wall=True, interact='picture')
add('poster-2', 'Pôster (2)', 'Quadros LPC', P('Objects/Wall Items/Posters.png', [67, 35, 27, 40]), wall=True, interact='picture')
# vasos e plantas internas
add('vaso-grego', 'Vaso grego', 'Plantas internas', P('Objects/Furniture/Vase-Studies.png', [5, 2, 22, 45]), interact='examine')
add('vaso-azul', 'Vaso azul', 'Plantas internas', P('Objects/Furniture/Vase-Studies.png', [34, 140, 28, 36]), interact='examine')
add('topiaria', 'Topiária no vaso', 'Plantas internas', P('Objects/Furniture/Planter.png', [34, 0, 30, 84]), interact='water')
add('arvore-no-vaso', 'Arvorezinha no vaso', 'Plantas internas', P('Objects/Furniture/Planter.png', [66, 0, 30, 84]), interact='water')
add('samambaia-no-vaso', 'Samambaia no vaso', 'Plantas internas', P('Objects/Furniture/Planter.png', [128, 36, 32, 48]), interact='water')
add('floreira', 'Floreira', 'Plantas internas', P('Objects/Furniture/Planter.png', [32, 40, 32, 44]), interact='water')
add('jardineira', 'Jardineira com samambaia', 'Plantas internas', P('Objects/Furniture/Planter.png', [0, 40, 32, 44]), interact='water')
add('flor-no-vaso', 'Flor no vaso', 'Plantas internas', P('Objects/Furniture/Planter.png', [96, 0, 32, 36]), interact='water')
# --- calabouço
add('pilar', 'Pilar de pedra', 'Calabouço', P('Structure/Pillars/Stone Pillar A.png', [96, 0, 32, 96]), interact='examine')
add('pilar-escuro', 'Pilar escuro', 'Calabouço', P('Structure/Pillars/Stone Pillar A.png', [192, 0, 32, 96]), interact='examine')
add('portao-arco', 'Portão em arco', 'Calabouço', P('Structure/Doors/64x64px Arched Doors/Arched Double Doors A.png', [0, 25, 93, 71]), 3, 1, wall=True, interact='examine')
add('grade', 'Porta de grade', 'Calabouço', P('Structure/Doors/32x48px Doors/Barred Prison Door A.png', [224, 16, 32, 48]), interact='examine')
add('bau', 'Baú', 'Calabouço', P('Objects/Furniture/Chest.png', [98, 0, 28, 27]), interact='stash')
add('bau-grande', 'Baú grande', 'Calabouço', P('Objects/Furniture/Chest.png', [0, 0, 47, 32]), 2, 1, interact='loot')
add('barril', 'Barril', 'Calabouço', P('Objects/Furniture/Barrel.png', [2, 10, 28, 37]), interact='drink')
add('barris', 'Barris', 'Calabouço', P('Objects/Furniture/Barrel.png', [66, 2, 78, 61]), 2, 1, interact='loot')
add('caixote', 'Caixote', 'Calabouço', P('Objects/Furniture/Crate.png', [69, 37, 22, 24]), interact='loot')
add('caixote-pequeno', 'Caixote pequeno', 'Calabouço', P('Objects/Furniture/Crate.png', [40, 5, 16, 22]), interact='loot')
add('caveira', 'Caveira', 'Calabouço', P('Objects/Small Items/Skeletons A.png', [4, 3, 20, 20]), small=True, interact='examine')
add('ossada', 'Ossada', 'Calabouço', P('Objects/Small Items/Skeletons A.png', [20, 0, 76, 64]), 2, 1, interact='examine')
add('teia', 'Teia de aranha', 'Calabouço', P('Objects/Small Items/Dungeon Elements.png', [40, 0, 24, 32]), wall=True)
add('lapide-lobo', 'Medalhão do lobo', 'Calabouço', P('Objects/Furniture/Wolf Stone.png', [0, 0, 64, 64]), 2, 1, flat=True, interact='examine')
add('altar', 'Altar de pedra', 'Calabouço', P('Objects/Furniture/Stone Slab.png', [0, 80, 64, 33]), 2, 1, interact='examine')
# --- jardim: árvores (com sombra), arbustos, flores, pedras
SH = (TREES, [16, 89, 64, 31])  # sombra suave
for i, (box, nm) in enumerate([([128, 0, 96, 128], 'carvalho'), ([224, 0, 96, 128], 'carvalho-raiz'), ([320, 0, 96, 160], 'alta'),
                               ([416, 96, 96, 160], 'alta-2'), ([128, 256, 96, 128], 'escura'), ([224, 256, 96, 128], 'escura-raiz'),
                               ([320, 256, 96, 160], 'escura-alta'), ([128, 352, 96, 160], 'pinheiro'), ([224, 352, 96, 160], 'pinheiro-2'),
                               ([320, 416, 96, 128], 'pinheiro-baixo'), ([416, 352, 96, 160], 'pinheiro-alto'), ([0, 256, 96, 160], 'seca')]):
    add(f'arvore-{nm}', f'Árvore ({nm})', 'Jardim', P(TREES, box, shadow=SH), interact='water', tree=True)
add('copa', 'Copa redonda', 'Jardim', P(TREES, [320, 160, 96, 96], shadow=SH), 2, 1, interact='water', tree=True)
add('toco', 'Toco', 'Jardim', P(TREES, [16, 420, 64, 48]), interact='examine')
for i, box in enumerate([[0, 0, 32, 32], [64, 0, 32, 32], [128, 0, 32, 32], [0, 32, 32, 32], [64, 32, 32, 32], [128, 32, 32, 32]]):
    add(f'moita-{i + 1}', f'Moita {i + 1}', 'Jardim', P(PLANTS, box), interact='water')
add('cipreste', 'Cipreste', 'Jardim', P(PLANTS, [2, 69, 30, 58]), interact='water')
add('cipreste-2', 'Cipreste (2)', 'Jardim', P(PLANTS, [34, 69, 30, 58]), interact='water')
add('cipreste-baixo', 'Cipreste baixo', 'Jardim', P(PLANTS, [67, 77, 28, 49]), interact='water')
add('samambaia', 'Samambaia', 'Jardim', P(PLANTS, [99, 77, 55, 51]), 2, 1, interact='water')
add('samambaia-grande', 'Samambaia grande', 'Jardim', P(PLANTS, [160, 76, 87, 52]), 3, 1, interact='water')
add('junco', 'Junco', 'Jardim', P(PLANTS, [355, 0, 25, 53]), interact='water')
add('capim', 'Capim', 'Jardim', P(PLANTS, [263, 23, 22, 28]), small=True, interact='water')
add('capim-2', 'Capim alto', 'Jardim', P(PLANTS, [259, 63, 27, 43]), interact='water')
for i, nm in enumerate(['brancas', 'rosas', 'vermelhas', 'azuis', 'roxas', 'amarelas', 'laranjas', 'douradas', 'celestes']):
    add(f'canteiro-{nm}', f'Canteiro de flores {nm}', 'Flores', P(FLW, [32 * i, 0, 32, 32]), small=True, interact='water')
    add(f'flores-{nm}', f'Flores {nm}', 'Flores', P(FLW, [32 * i + 4, 70, 23, 20]), small=True, interact='water')
for i in range(9):
    add(f'florzinhas-{i + 1}', 'Florzinhas', 'Flores', P(WILD, [16 * i, 0, 16, 16]), flat=True)
ROCK = [([0, 0, 64, 96], 'rochedo'), ([64, 0, 64, 64], 'pedra-alta'), ([128, 0, 64, 64], 'pedregulho'), ([0, 96, 64, 32], 'laje'),
        ([64, 64, 64, 32], 'pedra-chata'), ([64, 96, 64, 32], 'pedras'), ([128, 64, 32, 32], 'pedra'), ([128, 96, 32, 32], 'pedra-2'),
        ([160, 64, 32, 32], 'seixo'), ([160, 96, 32, 32], 'seixos')]
for yoff, cor in [(0, 'cinza'), (128, 'areia')]:
    for box, nm in ROCK:
        w = 2 if box[2] > 40 else 1
        add(f'{nm}-{cor}', f'{nm.replace("-", " ").capitalize()} ({cor})', 'Pedras', P(ROCKS, [box[0], box[1] + yoff, box[2], box[3]]), w, 1,
            interact='examine', small=nm.startswith('seixo'))
for i, box in enumerate([[103, 64, 19, 26], [135, 64, 19, 26], [6, 98, 18, 23], [101, 97, 21, 21]]):
    add(f'cogumelo-{i + 1}', 'Cogumelo', 'Jardim', P('Terrain/mushrooms.png', box), small=True, interact='examine')
add('fonte', 'Fonte', 'Jardim', P('Structure/Misc/Fountain A.png', [0, 0, 64, 82]), 2, 2, interact='wish')
add('degraus', 'Degraus de pedra', 'Jardim', P('Structure/Stairs/Short Steps A.png', [0, 64, 96, 24]), 3, 1, flat=True, walk=True)
add('ponte-reta', 'Ponte de madeira', 'Calabouço', P('Structure/Bridges/Wood Bridge A - Rails.png', [0, 0, 100, 81]), 3, 2, flat=True, walk=True, bridge=True)
add('ponte-arco', 'Ponte em arco', 'Calabouço', P('Structure/Bridges/Wood Bridge A - Rails.png', [128, 16, 96, 66]), 3, 2, flat=True, walk=True, bridge=True)
add('ponte-arco-clara', 'Ponte em arco clara', 'Jardim', P('Structure/Bridges/Wood Bridge A - Rails.png', [128, 208, 96, 66]), 3, 2, flat=True, walk=True, bridge=True)

# portas (32x48): fechada + aberta
DOOR = 'Structure/Doors/32x48px Doors/12 Panel Door A.png'
for i, (y, nm) in enumerate([(16, 'madeira'), (112, 'azul'), (208, 'verde'), (304, 'escura')]):
    add(f'porta-{nm}', f'Porta ({nm})', 'Portas', P(DOOR, [224, y, 32, 48], alt=(DOOR, [412, y, 8, 48 + 16])), door=True, interact='door')


# ---------------------------------------------------------------- recorte e empacotamento
_cache = {}


def sheet(lpc, rel):
    if rel not in _cache:
        src = lpc / rel
        dst = SRC / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.exists() and src.resolve() != dst.resolve():
            shutil.copyfile(src, dst)
        _cache[rel] = Image.open(dst).convert('RGBA')
    return _cache[rel]


def cut(lpc, rel, box):
    im = sheet(lpc, rel)
    x, y, w, h = box
    crop = np.array(im.crop((x, y, x + w, y + h)))
    a = crop[:, :, 3] > 0
    if not a.any():
        return Image.fromarray(crop)
    # só os componentes cujo centro cai dentro da caixa (corta vizinhos encostados na borda)
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=1))
    keep = np.zeros_like(a)
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    big = max(sizes) if len(sizes) else 0
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sizes[i] < max(3, big * 0.02):
            continue
        keep |= (lab == i + 1)
    crop[:, :, 3] = np.where(keep & a, crop[:, :, 3], 0)
    return Image.fromarray(crop)


def compose(lpc, piece):
    base = cut(lpc, piece['sheet'], piece['box'])
    for rel, box in piece.get('over', []):
        base.alpha_composite(cut(lpc, rel, box))
    if piece.get('shadow'):
        rel, box = piece['shadow']
        sh = cut(lpc, rel, box)
        arr = np.array(sh)
        arr[:, :, :3] = [20, 14, 30]
        arr[:, :, 3] = np.where(arr[:, :, 3] > 0, 70, 0)
        sh = Image.fromarray(arr)
        canvas = Image.new('RGBA', (max(base.width, sh.width), base.height + 6), (0, 0, 0, 0))
        canvas.alpha_composite(sh, ((canvas.width - sh.width) // 2, canvas.height - sh.height))
        canvas.alpha_composite(base, ((canvas.width - base.width) // 2, 0))
        base = canvas
    bb = base.getbbox()
    return base.crop(bb) if bb else base


# ---------------------------------------------------------------- sprites próprios (pixel art desenhada aqui)
def own_sprites():
    out = {}
    # banco de jardim de madeira (frente e costas): ripas + pés de ferro
    W, H = 60, 34
    wood = [(122, 78, 44), (150, 98, 58), (176, 120, 72), (96, 60, 34)]
    iron = (46, 42, 52)
    def bench(back_view):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        px = im.load()
        def rect(x0, y0, x1, y1, c):
            for yy in range(y0, y1):
                for xx in range(x0, x1):
                    px[xx, yy] = c + (255,)
        # pés
        for x in (5, W - 9):
            rect(x, 14, x + 4, H, iron)
            rect(x - 1, H - 2, x + 5, H, iron)
        if not back_view:
            # encosto: 2 ripas
            for i, y in enumerate((2, 8)):
                rect(2, y, W - 2, y + 4, wood[1])
                rect(2, y, W - 2, y + 1, wood[2])
                rect(2, y + 3, W - 2, y + 4, wood[3])
            rect(6, 12, 10, 16, iron); rect(W - 10, 12, W - 6, 16, iron)
            # assento: 3 ripas em perspectiva
            for i, y in enumerate((16, 20, 24)):
                rect(1, y, W - 1, y + 3, wood[(i + 1) % 3])
                rect(1, y, W - 1, y + 1, wood[2])
            rect(1, 27, W - 1, 28, wood[3])
        else:
            for i, y in enumerate((12, 16, 20)):
                rect(1, y, W - 1, y + 3, wood[(i + 1) % 3])
                rect(1, y, W - 1, y + 1, wood[2])
            for i, y in enumerate((2, 7)):
                rect(2, y + 20 - 18, W - 2, y + 20 - 14, wood[0])
            rect(2, 23, W - 2, 27, wood[1]); rect(2, 23, W - 2, 24, wood[2]); rect(2, 26, W - 2, 27, wood[3])
        # contorno
        a = np.array(im)
        al = a[:, :, 3] > 0
        edge = ndimage.binary_dilation(al) & ~al
        a[edge] = [34, 22, 18, 255]
        return Image.fromarray(a)
    out['banco-jardim'] = {'s': bench(False), 'n': bench(True)}
    # vitrola / caixa de som (Spotify): móvel baixo com toca-discos
    im = Image.new('RGBA', (30, 30), (0, 0, 0, 0))
    d = np.array(im)
    d[12:30, 2:28] = [92, 58, 34, 255]; d[12:14, 2:28] = [128, 84, 50, 255]; d[28:30, 2:28] = [60, 36, 20, 255]
    d[18:26, 5:14] = [40, 34, 40, 255]; d[18:26, 16:25] = [40, 34, 40, 255]
    for cx, cy in ((9, 22), (20, 22)):
        for yy in range(18, 26):
            for xx in range(cx - 4, cx + 5):
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= 9:
                    d[yy, xx] = [24, 20, 26, 255]
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= 1:
                    d[yy, xx] = [120, 200, 120, 255]
    d[3:12, 4:26] = [26, 24, 30, 255]  # disco
    for yy in range(3, 12):
        for xx in range(4, 26):
            r = ((xx - 15) / 10) ** 2 + ((yy - 7.5) / 4.5) ** 2
            d[yy, xx] = [0, 0, 0, 0] if r > 1 else ([30, 215, 96, 255] if r < 0.08 else ([18, 16, 22, 255] if int(r * 6) % 2 else [42, 38, 46, 255]))
    d[2:6, 22:24] = [200, 200, 210, 255]; d[5:8, 23:25] = [200, 200, 210, 255]
    a = d[:, :, 3] > 0
    edge = ndimage.binary_dilation(a) & ~a
    d[edge] = [22, 16, 20, 255]
    out['vitrola'] = Image.fromarray(d)
    # base do portal: círculo de pedra com runas (o brilho é desenhado no jogo)
    S = 40
    d = np.zeros((22, S, 4), np.uint8)
    for yy in range(22):
        for xx in range(S):
            r = ((xx - S / 2 + 0.5) / (S / 2 - 1)) ** 2 + ((yy - 10.5) / 10) ** 2
            if r <= 1:
                d[yy, xx] = [118, 114, 132, 255] if r > 0.62 else ([88, 160, 210, 255] if r < 0.5 else [70, 66, 84, 255])
                if 0.68 < r < 0.86 and (xx * 7 + yy * 3) % 9 == 0:
                    d[yy, xx] = [150, 230, 255, 255]
    a = d[:, :, 3] > 0
    edge = ndimage.binary_dilation(a) & ~a
    d[edge] = [34, 30, 44, 255]
    out['portal'] = Image.fromarray(d)
    return out


def pack(images, width=1024):
    pad = 2
    x = y = rowh = 0
    pos = []
    order = sorted(range(len(images)), key=lambda i: -images[i].height)
    places = [None] * len(images)
    for i in order:
        im = images[i]
        if x + im.width + pad > width:
            x, y, rowh = 0, y + rowh + pad, 0
        places[i] = (x, y)
        x += im.width + pad
        rowh = max(rowh, im.height)
    sheet_im = Image.new('RGBA', (width, y + rowh), (0, 0, 0, 0))
    for im, p in zip(images, places):
        sheet_im.paste(im, p)
    return sheet_im, places


# pisos (bloco repetível) e paredes (face) do LPC; terreno com autotile (grama, terra, água)
FLOORS_LPC = [
    ('Structure/Floor/Wood Floor A.png', 'madeira', 'Madeira (LPC)', [32, 0, 32, 96]),
    ('Structure/Floor/Wood Floor A.png', 'madeira-clara', 'Madeira clara (LPC)', [96, 0, 32, 96]),
    ('Structure/Floor/Wood Floor A.png', 'madeira-escura', 'Madeira escura (LPC)', [0, 0, 32, 96]),
    ('Structure/Floor/Wood Floor A.png', 'madeira-creme', 'Madeira creme (LPC)', [96, 96, 32, 96]),
    ('Structure/Floor/Herringbone A.png', 'espinha', 'Taco espinha de peixe (LPC)', [64, 0, 32, 96]),
    ('Structure/Floor/Herringbone A.png', 'espinha-cinza', 'Taco cinza (LPC)', [0, 0, 32, 96]),
    ('Structure/Floor/Tile A.png', 'ladrilho', 'Ladrilho creme (LPC)', [0, 0, 32, 32]),
    ('Structure/Floor/Tile B.png', 'porcelanato', 'Porcelanato (LPC)', [0, 0, 32, 32]),
    ('Structure/Floor/Tile B.png', 'porcelanato-cinza', 'Porcelanato cinza (LPC)', [32, 0, 32, 32]),
    ('Structure/Floor/Tile C.png', 'pedra', 'Laje de pedra (LPC)', [64, 0, 32, 64]),
    ('Structure/Floor/Tile C.png', 'pedra-escura', 'Laje escura (LPC)', [64, 192, 32, 64]),
    ('Structure/Floor/Diamond Tile B.png', 'xadrez', 'Piso xadrez (LPC)', [64, 0, 32, 32]),
    ('Structure/Floor/Diamond Tile A.png', 'losango', 'Piso losango (LPC)', [32, 0, 32, 32]),
    ('Structure/Floor/Geometric Carpet C.png', 'carpete-cinza', 'Carpete cinza (LPC)', [32, 0, 32, 32]),
    ('Structure/Floor/Geometric Carpet C.png', 'carpete-azul', 'Carpete azul (LPC)', [128, 0, 32, 32]),
    ('Structure/Floor/Geometric Carpet C.png', 'carpete-vinho', 'Carpete vinho (LPC)', [224, 0, 32, 32]),
    ('Structure/Floor/Geometric Carpet C.png', 'carpete-roxo', 'Carpete roxo (LPC)', [96, 0, 32, 32]),
    ('Structure/Floor/Subfloor.png', 'deck', 'Deck de madeira (LPC)', [0, 0, 32, 64]),
    ('Structure/Floor/Gritty Dirt.png', 'terra-batida', 'Terra batida (LPC)', [0, 0, 32, 32]),
]
WALLS_LPC = [
    ('Structure/Walls/Brick Wall A.png', 'tijolo', 'Parede de tijolo claro (LPC)', [32, 40, 32, 32], '#8b7f6e'),
    ('Structure/Walls/Brick Wall A.png', 'tijolo-cinza', 'Parede de tijolo cinza (LPC)', [128, 40, 32, 32], '#5e5a5a'),
    ('Structure/Walls/Brick Wall A.png', 'tijolo-escuro', 'Parede de tijolo escuro (LPC)', [32, 232, 32, 32], '#2a2a36'),
    ('Structure/Walls/Jagged Stone Walls.png', 'pedra', 'Muro de pedra (LPC)', [128, 32, 32, 32], '#4a4450'),
    ('Structure/Walls/Jagged Stone Walls.png', 'pedra-clara', 'Muro de pedra clara (LPC)', [32, 32, 32, 32], '#7e7466'),
    ('Structure/Walls/Jagged Stone Walls.png', 'pedra-escura', 'Muro de pedra escura (LPC)', [32, 224, 32, 32], '#1e1e28'),
    ('Structure/Walls/Half-Wall Paneling A.png', 'painel', 'Parede com painel creme (LPC)', [0, 32, 32, 32], '#5a4033'),
    ('Structure/Walls/Half-Wall Paneling A.png', 'painel-madeira', 'Parede com painel de madeira (LPC)', [0, 64, 32, 32], '#4e3324'),
    ('Structure/Walls/Drywall.png', 'gesso', 'Parede de gesso (LPC)', [32, 32, 32, 32], '#6e7a84'),
]
TERRAIN = 'Terrain/terrain_summer.png'


def floors_walls(lpc, cat):
    def sid_of(rel):
        src = SRC / rel
        sheet(lpc, rel)
        dst = OUT / 'tiles' / rel.split('/')[-1].replace(' ', '-').replace(',', '').lower()
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        url = dst.relative_to(DOCS).as_posix()
        if url not in cat['sheets']:
            cat['sheets'].append(url)
        return cat['sheets'].index(url)

    def avg(rel, f):
        a = np.array(sheet(lpc, rel).crop((f[0], f[1], f[0] + f[2], f[1] + f[3])).convert('RGB')).reshape(-1, 3).mean(0)
        return '#%02x%02x%02x' % tuple(int(v) for v in a)
    cat['floors'] = [f for f in cat['floors'] if not f['id'].startswith('lpc-')]
    cat['walls'] = [w for w in cat.get('walls', []) if not w['id'].startswith('lpc-')]
    for rel, iid, name, f in FLOORS_LPC:
        cat['floors'].append({'id': f'lpc-{iid}', 'name': name, 'pack': 'LPC Revised', 's': sid_of(rel), 'f': f, 'sc': 1.0, 'avg': avg(rel, f)})
    for rel, iid, name, f, cap in WALLS_LPC:
        cat['walls'].append({'id': f'lpc-{iid}', 'name': name, 's': sid_of(rel), 'face': f, 'sc': 1.0, 'cap': cap})
    ts = sid_of(TERRAIN)
    # terreno com autotile (o desenho de verdade é feito no renderer a partir de cat.terrain)
    for iid, name, f, kind in [('grama', 'Grama (LPC, bordas automáticas)', [96, 32, 32, 32], 'grass'),
                               ('terra', 'Terra (LPC, bordas automáticas)', [96, 96, 32, 32], 'dirt'),
                               ('agua', 'Água (LPC, margens automáticas)', [384, 512, 32, 32], 'water'),
                               ('areia', 'Areia (LPC)', [96, 160, 32, 32], 'sand')]:
        cat['floors'].append({'id': f'lpc-{iid}', 'name': name, 'pack': 'LPC Revised', 's': ts, 'f': f, 'sc': 1.0, 'avg': avg(TERRAIN, f), 'terrain': kind})
    cat['terrain'] = {
        's': ts,
        'grass': {'full': [[3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [5, 2]], 'island': [0, 0], 'inner': [0, 6]},
        'dirt': {'full': [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4]]},
        'sand': {'full': [[3, 5], [4, 5], [5, 5], [3, 6], [4, 6], [5, 6]]},
        'water': {'full': [[12, 16], [13, 16], [14, 16], [15, 16], [12, 17], [13, 17], [14, 17], [15, 17]], 'island': [0, 10], 'inner': [0, 13]},
        'deco': [[2, 6], [2, 7]],
    }


def run(lpc):
    lpc = Path(lpc)
    cat_path = DOCS / 'assets' / 'catalog.json'
    cat = json.loads(cat_path.read_text())
    cat['props'] = [p for p in cat['props'] if not p['id'].startswith('lpc-')]
    OUT.mkdir(parents=True, exist_ok=True)
    imgs, refs = [], []  # refs: (item idx, dir|None)
    for n, (iid, name, catn, piece, w, h, extra) in enumerate(ITEMS):
        if isinstance(piece, dict) and 'sheet' not in piece:
            for dk, pc in piece.items():
                imgs.append(compose(lpc, pc)); refs.append((n, dk, pc))
        else:
            imgs.append(compose(lpc, piece)); refs.append((n, None, piece))
            if piece.get('alt'):
                rel, box = piece['alt']
                imgs.append(cut(lpc, rel, box).crop(cut(lpc, rel, box).getbbox())); refs.append((n, 'alt', None))
    own = own_sprites()
    own_items = [('banco-jardim', 'Banco de jardim', 'Jardim', 2, 1, {'sit': True}),
                 ('vitrola', 'Vitrola (Spotify)', 'Decoração LPC', 1, 1, {'interact': 'music', 'light': {'r': 1.6, 'color': 'rgba(30,215,96,0.18)', 'always': True}}),
                 ('portal', 'Portal', 'Portais', 1, 1, {'flat': True, 'walk': True})]
    for k, (oid, *_rest) in enumerate(own_items):
        v = own[oid]
        if isinstance(v, dict):
            for dk, im in v.items():
                imgs.append(im); refs.append((('own', k), dk, None))
        else:
            imgs.append(v); refs.append((('own', k), None, None))
    sheet_im, places = pack(imgs)
    dst = OUT / 'pack-1.png'
    sheet_im.save(dst, optimize=True)
    url = dst.relative_to(DOCS).as_posix()
    if url in cat['sheets']:
        sid = cat['sheets'].index(url)
    else:
        cat['sheets'].append(url)
        sid = len(cat['sheets']) - 1
    entries = {}

    def entry(key, iid, name, catn, w, h, extra):
        e = entries.get(key)
        if not e:
            e = {'id': f'lpc-{iid}', 'name': name, 'cat': catn, 's': sid, 'w': w, 'h': h, 'sc': 1, 'nat': 1,
                 'solid': not extra.get('flat') and not extra.get('small') and not extra.get('sit') and not extra.get('walk') and not extra.get('door')}
            if extra.get('flat'):
                e['kind'] = 'flat'
            for k in ('sit', 'small', 'interact', 'station', 'light', 'wall', 'desk', 'door', 'tree', 'bridge', 'walk'):
                if k in extra:
                    e[k] = extra[k]
            entries[key] = e
        return e

    for (ref, dk, pc), im, (px, py) in zip(refs, imgs, places):
        f = [px, py, im.width, im.height]
        if isinstance(ref, tuple):
            oid, name, catn, w, h, extra = own_items[ref[1]]
            e = entry(('own', oid), oid, name, catn, w, h, extra)
        else:
            iid, name, catn, piece, w, h, extra = ITEMS[ref]
            e = entry(ref, iid, name, catn, w, h, extra)
        if dk == 'alt':
            e['alt'] = {'s': sid, 'f': f}
        elif dk is None:
            e['f'] = f
        else:
            e.setdefault('rot', {})[dk] = {'s': sid, 'f': f}
            if dk == 's' or 'f' not in e:
                e['f'] = f
    cat['props'].extend(entries.values())
    floors_walls(lpc, cat)
    # créditos
    (OUT / 'CREDITOS.txt').write_text(
        'Sprites do LPC Revised — https://github.com/ElizaWy/LPC\n'
        'Licença OGA-BY 3.0 / CC-BY 3.0. Artistas: Eliza Wyatt (DeathsDarling), Lanea Zimmerman (Sharm),\n'
        'Stephen Challener (Redshrike), Johannes Sjölund (Wulax), BlueCarrot16, BenCreating, Durrani,\n'
        'YuriNikolai, Craftpix.net 2D Game Assets.\n')
    cat_path.write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')))
    print(f'lpc: {len(entries)} itens, folha {sheet_im.size}')


if __name__ == '__main__':
    run(sys.argv[1] if len(sys.argv) > 1 else SRC)
