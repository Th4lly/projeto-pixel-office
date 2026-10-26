// Escritório padrão, montado com os tiles e sprites da pasta.
//
//  ┌ Ala das arenas ┐┌──── Jardim ────┐┌──────── Salão / Recepção ────────┐
//  │ Monstros │ PvP ││                ││                                   │
//  │──corredor──────▶│                │└───────────────────────────────────┘
//  │ Covil    │Treino│└──── corredor ───────────────────────────────────────
//  └──────────┴──────┘┌──── Mesas (cada uma com área) ──┐┌ Reunião A ┐┌ Reunião B ┐
//                     └──────────────────────────────────┘└───────────┘└───────────┘
//                     ┌ Copa ┐┌ Cantinho de leitura ┐┌──── Auditório (palco) ────┐
import { findFloor, CAT } from '../art/assets.js';
import { FLOORS } from '../art/tiles.js';

const F = (...n) => {
  const f = findFloor(...n);
  return f ? f.id : 'void';
};
const WALL = (...n) => {
  for (const k of n) {
    const id = Object.keys(FLOORS).find((x) => FLOORS[x].wall && x.includes(k));
    if (id) return id;
  }
  return Object.keys(FLOORS).find((x) => FLOORS[x].wall) || 'void';
};

export function buildDefaultMap() {
  const W = 78;
  const H = 50;
  const T = {
    grass: F('seasonal-sample-summer-png-1'),
    grass2: F('seasonal-sample-summer-png-4'),
    dirt: F('seasonal-sample-summer-png-3'),
    path: F('seasonal-sample-summer-png-15', 'floors-tiles-png-11'),
    cobble: F('floors-tiles-png-11'),
    wood: F('topdownhouse-floorsandwalls-png-6'),
    carpet: F('office-carpete'),
    porc: F('office-porcelanato'),
    walnut: F('nook-floor-walnut'),
    vinyl: F('topdownhouse-floorsandwalls-png-11', 'topdownhouse-floorsandwalls-png-3'),
    herring: F('topdownhouse-floorsandwalls-png-1', 'interior-walls-01-png-30'),
    arena: F('wall-tiles-png-11'),
    pvp: F('floors-tiles-png-13', 'floors-tiles-png-11'),
    lair: F('wall-tiles-png-13'),
    dungeon: F('interior-walls-01-png-23'),
    water: F('water-tiles-png-1'),
    sand: F('floors-tiles-png-1'),
    wall: WALL('office-parede-creme'),
    stone: WALL('interior-walls-01-png-22', 'interior-walls'),
    hedge: WALL('hedge'),
    wood_wall: WALL('structures-buildings-walls-png-3', 'walls-png'),
  };
  const floor = new Array(W * H).fill(T.stone);
  const fill = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) floor[y * W + x] = t;
  };

  // ---------------- ala das arenas (oeste)
  fill(0, 0, 21, 49, T.stone);
  fill(1, 1, 8, 22, T.arena); // arena de monstros
  fill(12, 1, 20, 22, T.pvp); // arena PvP
  fill(14, 3, 18, 20, T.sand); // areia no centro da arena PvP
  fill(9, 1, 11, 47, T.dungeon); // corredor das arenas
  fill(1, 25, 8, 47, T.lair); // covil do chefe
  fill(12, 25, 20, 47, T.dungeon); // sala de treino / equipamentos
  fill(8, 10, 8, 12, T.dungeon); fill(12, 10, 12, 12, T.dungeon); // entradas das arenas
  fill(8, 35, 8, 37, T.dungeon); fill(12, 35, 12, 37, T.dungeon);
  fill(21, 7, 21, 9, T.dungeon); // passagem para o jardim

  // ---------------- jardim
  fill(22, 0, 41, 17, T.hedge);
  fill(23, 1, 40, 16, T.grass);
  for (let y = 1; y <= 16; y++) for (let x = 23; x <= 40; x++) if ((x * 7 + y * 13) % 11 === 0) floor[y * W + x] = T.grass2;
  fill(22, 8, 40, 8, T.path); fill(31, 1, 31, 17, T.path);
  fill(33, 3, 38, 6, T.water); // laguinho
  fill(31, 17, 31, 17, T.path);

  // ---------------- salão / recepção
  fill(42, 0, 77, 17, T.wall);
  fill(43, 1, 76, 16, T.porc);
  fill(41, 7, 42, 9, T.porc);
  fill(52, 17, 54, 17, T.porc);

  // ---------------- corredor central
  fill(22, 18, 77, 20, T.cobble);

  // ---------------- mesas (escritório)
  fill(22, 21, 77, 35, T.wall);
  fill(23, 22, 48, 34, T.wood);
  fill(34, 21, 37, 21, T.wood);
  // salas de reunião
  fill(50, 22, 62, 34, T.carpet);
  fill(55, 21, 57, 21, T.carpet);
  fill(64, 22, 76, 34, T.carpet);
  fill(69, 21, 71, 21, T.carpet);

  // ---------------- corredor de baixo
  fill(22, 36, 77, 37, T.cobble);
  fill(34, 35, 37, 35, T.wood);

  // ---------------- copa, cantinho de leitura, auditório
  fill(22, 38, 77, 49, T.wall);
  fill(23, 39, 35, 48, T.vinyl);
  fill(28, 38, 30, 38, T.vinyl);
  fill(37, 39, 50, 48, T.walnut);
  fill(42, 38, 44, 38, T.walnut);
  fill(52, 39, 76, 48, T.herring);
  fill(62, 38, 65, 38, T.herring);
  fill(21, 36, 21, 37, T.cobble); fill(21, 18, 21, 20, T.cobble); // ala das arenas ↔ corredores
  fill(12, 36, 20, 37, T.dungeon);
  fill(12, 18, 20, 20, T.dungeon);

  const objects = [];
  let n = 0;
  const add = (type, x, y, extra = {}) => objects.push({ id: `d${String(n++).padStart(3, '0')}`, type, x, y, state: {}, data: {}, ...extra });
  const on = { state: { on: true } };

  // ===== Arenas
  add('arena_gate', 4, 23); add('signpost', 10, 2, { data: { text: 'Ala das Arenas — PvP só vale dentro da Arena PvP. Monstros ficam nas arenas da esquerda.' } });
  add('mob_spawner', 2, 2, { data: { pool: 'arena' } }); add('mob_spawner', 7, 20, { data: { pool: 'arena' } });
  add('mob_spawner', 4, 27, { data: { pool: 'boss' } });
  add('torch', 1, 12, on); add('torch', 8, 1, on); add('torch', 1, 25, on); add('torch', 8, 25, on); add('torch', 1, 47, on); add('torch', 8, 47, on);
  add('torch', 12, 1, on); add('torch', 20, 1, on); add('torch', 12, 22, on); add('torch', 20, 22, on);
  add('dummy', 14, 28); add('dummy', 17, 28); add('dummy', 14, 32); add('dummy', 17, 32);
  add('chest', 19, 45); add('crate', 13, 45); add('barrel', 14, 45);
  // decoração das arenas
  add('banner', 2, 1); add('banner', 6, 1); add('banner', 13, 1); add('banner', 19, 1); add('banner', 2, 25); add('banner', 6, 25);
  add('statue', 12, 21); add('statue', 20, 21); add('column', 1, 20); add('column', 8, 20);
  add('portal', 10, 46); add('signpost', 13, 26, { data: { text: 'Sala de treino: teste seus golpes nos bonecos. Equipamentos no baú.' } });

  // ===== Jardim
  add('fountain', 35, 1); add('tree', 23, 11); add('tree', 38, 12); add('tree', 23, 1); add('tree', 39, 9);
  add('flowers', 29, 3); add('flowers', 29, 13); add('bush', 33, 10); add('bush', 36, 14); add('bush', 25, 15);
  add('bench', 27, 9); add('bench', 34, 9); add('bench', 27, 14);
  add('signpost', 30, 9, { data: { text: 'Jardim — à esquerda fica a Ala das Arenas. Boa caçada!' } });
  add('portal', 39, 1);

  // ===== Salão / recepção
  add('counter', 51, 9); add('chair', 52, 10);
  add('quest_board', 45, 1); add('notion_board', 49, 1); add('notice_board', 53, 1); add('calendar', 55, 1);
  add('window', 58, 1); add('window', 62, 1); add('window', 66, 1);
  add('plant_big', 43, 1); add('plant_big', 76, 1); add('plant', 43, 15); add('plant', 76, 15);
  add('sofa', 60, 10); add('sofa', 64, 10); add('table_round', 62, 12); add('armchair', 60, 13); add('armchair', 65, 13);
  add('statue', 70, 4); add('trophy', 72, 4); add('clock', 74, 4); add('globe', 68, 1);
  add('water', 75, 9); add('coffee', 74, 9);
  add('arcade', 44, 12); add('arcade', 45, 12); add('jukebox', 46, 12);
  add('signpost', 50, 15, { data: { text: 'Bem-vindo! Reivindique uma mesa no escritório (abaixo) e decore do seu jeito.' } });

  // ===== Mesas: cada uma com a sua área
  const zones = [];
  const deskTypes = ['desk', 'desk_pc', 'desk', 'desk_pc'];
  let k = 0;
  for (const y of [23, 28]) {
    for (const x of [24, 30, 36, 42]) {
      k += 1;
      add(deskTypes[k % 4], x, y + 1, { data: { slot: k } });
      add('chair', x, y + 2);
      zones.push({ id: `z-mesa-${k}`, name: `Mesa ${k}`, kind: 'desk', x: x - 1, y, w: 5, h: 4 });
    }
  }
  add('printer', 23, 33); add('water', 25, 33); add('server', 47, 22); add('mailbox', 46, 22);
  add('plant', 48, 33); add('lamp', 23, 22, on); add('whiteboard', 40, 33); add('chart_board', 43, 33);

  // ===== Sala de reunião A
  add('meeting_table', 54, 26);
  for (const x of [54, 55, 56, 57]) { add('chair', x, 25); add('chair', x, 28); }
  add('phone', 51, 23); add('projector', 58, 23); add('whiteboard', 53, 22); add('chart_board', 60, 31);
  add('plant', 50, 33); add('plant', 62, 33); add('lamp', 62, 22, on);
  add('door', 56, 21, { state: { open: true } });

  // ===== Sala de reunião B
  add('meeting_table', 68, 26);
  for (const x of [68, 69, 70, 71]) { add('chair', x, 25); add('chair', x, 28); }
  add('phone', 65, 23); add('tv', 74, 23); add('notion_board', 66, 31); add('plant', 64, 33); add('plant', 76, 33);
  add('door', 70, 21, { state: { open: true } });

  // ===== Copa
  add('fridge', 23, 39); add('coffee', 24, 39); add('water', 25, 39); add('counter', 26, 39); add('cauldron', 28, 39);
  add('table_long', 25, 43); add('stool', 25, 44); add('stool', 27, 44); add('table_round', 31, 44); add('stool', 30, 44); add('stool', 32, 44);
  add('barrel', 35, 39); add('crate', 35, 48);

  // ===== Cantinho de leitura (cena pronta do pacote Cozy Nook)
  // monta a cena do pacote (SCENE_PLACEMENT.json) no canto de cima da sala
  const scene = CAT.scenes && CAT.scenes.nook;
  if (scene) {
    for (const o of scene.objects) {
      const p = o.id && CAT.props.find((pp) => pp.id === o.id);
      if (!p || /wall-cream/.test(p.id)) continue;
      const w = (o.render_width || p.f[2]) * scene.sc / 32;
      const hh = (o.render_height || p.f[3]) * scene.sc / 32;
      const tx = 38 + Math.round((o.x * scene.sc) / 32 + w / 2 - p.w / 2);
      const ty = 38 + Math.round((o.y * scene.sc) / 32 + hh - p.h);
      if (tx >= 37 && tx + p.w <= 46 && ty >= 39 && ty + p.h <= 48) add(p.id, tx, ty);
    }
  } else {
    add('rug_round', 41, 42); add('armchair', 39, 41); add('table_round', 43, 45);
  }
  add('bookshelf', 37, 39); add('lamp', 49, 40, on); add('fireplace', 47, 39, on);
  add('bed', 48, 46); add('wardrobe', 50, 39); add('piano', 38, 46); add('game_table', 45, 47); add('beanbag', 44, 47); add('beanbag', 46, 47);

  // ===== Auditório
  add('projector', 62, 39); add('podium', 64, 41);
  for (const y of [44, 46]) for (const x of [54, 57, 60, 66, 69, 72]) add('bench', x, y);
  add('torch', 53, 39, on); add('torch', 75, 39, on); add('plant_big', 52, 47); add('plant_big', 76, 47);

  zones.push(
    { id: 'z-arena', name: 'Arena dos Monstros', kind: 'arena', x: 1, y: 1, w: 8, h: 22 },
    { id: 'z-pvp', name: 'Arena PvP', kind: 'pvp', x: 12, y: 1, w: 9, h: 22 },
    { id: 'z-covil', name: 'Covil do Chefe (MvP)', kind: 'arena', x: 1, y: 25, w: 8, h: 23 },
    { id: 'z-treino', name: 'Sala de Treino', kind: 'area', x: 12, y: 25, w: 9, h: 23 },
    { id: 'z-corredor-arenas', name: 'Corredor das Arenas', kind: 'area', x: 9, y: 1, w: 3, h: 47 },
    { id: 'z-jardim', name: 'Jardim', kind: 'area', x: 23, y: 1, w: 18, h: 16 },
    { id: 'z-salao', name: 'Recepção', kind: 'area', x: 43, y: 1, w: 34, h: 16 },
    { id: 'z-escritorio', name: 'Escritório', kind: 'area', x: 23, y: 22, w: 26, h: 13 },
    { id: 'z-reuniao-a', name: 'Sala de reunião A', kind: 'private', x: 50, y: 22, w: 13, h: 13, meeting: true },
    { id: 'z-reuniao-b', name: 'Sala de reunião B', kind: 'private', x: 64, y: 22, w: 13, h: 13, meeting: true },
    { id: 'z-copa', name: 'Copa', kind: 'area', x: 23, y: 39, w: 13, h: 10 },
    { id: 'z-leitura', name: 'Cantinho de leitura', kind: 'area', x: 37, y: 39, w: 14, h: 10 },
    { id: 'z-auditorio', name: 'Auditório', kind: 'area', x: 52, y: 42, w: 25, h: 7 },
    { id: 'z-palco', name: 'Palco', kind: 'spotlight', x: 58, y: 39, w: 12, h: 3 },
  );

  return { map: { width: W, height: H, floor, spawn: { x: 52, y: 12 }, version: 2 }, objects, zones };
}

export const MAP_VERSION = 2;
export { CAT };
