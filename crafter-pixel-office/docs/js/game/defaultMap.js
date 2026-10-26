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
  const zones = [];
  const fg = {};
  const fx = {};
  let n = 0;
  const add = (type, x, y, extra = {}) => objects.push({ id: `d${String(n++).padStart(3, '0')}`, type, x, y, state: {}, data: {}, ...extra });
  const on = { state: { on: true } };
  const rect = (x0, y0, x1, y1, fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); };
  const roofWood = F('roofs-png-2', 'roofs-png-1');
  const roofStone = F('roofs-png-8', 'roofs-png-1');
  // rot = para onde o móvel olha (0 ↓, 90 ←, 180 ↑, 270 →)
  const S = 0, Wd = 90, N = 180, E = 270;
  const npc = (role, sprite, x, y, extra = {}) => add('npc', x, y, { data: { role, sprite: CAT.npcs.some((q) => q.id === sprite) ? sprite : '', ...extra } });
  const RO = 'pc-computer-ragnarok-online-non-playable-characters-';

  /** Mesa redonda (1x1) com 4 cadeiras viradas para ela. */
  const tableFor4 = (x, y, chair = 'chair_wood', table = 'table_round') => {
    add(table, x, y);
    add(chair, x, y - 1, { rot: S }); add(chair, x, y + 1, { rot: N });
    add(chair, x - 1, y, { rot: E }); add(chair, x + 1, y, { rot: Wd });
  };
  /** Mesa de reunião 3x3 com 12 cadeiras em volta, todas viradas para o centro. */
  const meetingTable = (x, y) => {
    add('meeting_table', x, y);
    for (let i = 0; i < 3; i++) {
      add('chair', x + i, y - 1, { rot: S }); add('chair', x + i, y + 3, { rot: N });
      add('chair', x - 1, y + i, { rot: E }); add('chair', x + 3, y + i, { rot: Wd });
    }
  };
  /** Sala de estar: tapete redondo, sofás e poltronas virados para a mesinha do centro. */
  const lounge = (x, y) => {
    add('rug_round', x, y);
    add('table_round', x + 1, y + 1);
    add('sofa', x, y - 1, { rot: S, data: { ox: 16 } }); add('sofa', x, y + 3, { rot: N, data: { ox: 16 } });
    add('armchair', x - 1, y + 1, { rot: E }); add('armchair', x + 3, y + 1, { rot: Wd });
  };

  // ===== Arenas
  add('arena_gate', 4, 23); add('signpost', 10, 1, { data: { text: 'Ala das Arenas — PvP só vale dentro da Arena PvP. Monstros ficam nas arenas da esquerda.' } });
  add('mob_spawner', 2, 2, { data: { pool: 'arena' } }); add('mob_spawner', 7, 20, { data: { pool: 'arena' } });
  add('mob_spawner', 4, 27, { data: { pool: 'boss' } });
  for (const [x, y] of [[1, 12], [8, 1], [1, 25], [8, 25], [1, 47], [8, 47], [12, 1], [20, 1], [12, 22], [20, 22]]) add('torch', x, y, on);
  for (const x of [14, 17]) for (const y of [28, 32]) add('dummy', x, y);
  add('chest', 19, 45); add('crate', 13, 45); add('barrel', 14, 45);
  for (const [x, y] of [[2, 1], [6, 1], [13, 1], [19, 1], [2, 25], [6, 25]]) add('banner', x, y);
  add('statue', 12, 21); add('statue', 20, 21); add('column', 1, 20); add('column', 8, 20);
  add('signpost', 13, 26, { data: { text: 'Sala de treino: teste seus golpes nos bonecos. Equipamentos no baú.' } });
  npc('arena', `${RO}npcs-walking-png-2`, 10, 6, { name: 'Mestre Garrick' });
  // portal da ala ↔ jardim (efeito de tile + o vórtice para enxergar)
  add('portal', 10, 3); fx['10,3'] = 'o:39,4';
  add('portal', 39, 2); fx['39,2'] = 'o:10,5';
  // arco de pedra na passagem para o jardim (fica na frente do personagem)
  rect(21, 6, 21, 10, (x, y) => { fg[`${x},${y}`] = roofStone; });

  // ===== Jardim
  add('fountain', 35, 1); add('tree', 23, 11); add('tree', 38, 12); add('tree', 23, 1); add('tree', 38, 8);
  add('flowers', 29, 3); add('flowers', 33, 3); add('flowers', 29, 13); add('flowers', 33, 13);
  add('bush', 24, 4); add('bush', 24, 6); add('bush', 39, 14); add('bush', 25, 15);
  // pergolado sobre o cruzamento dos caminhos: telhado na camada da frente (passa por baixo)
  rect(30, 7, 32, 9, (x, y) => { fg[`${x},${y}`] = roofWood; });
  add('bench', 26, 10); add('bench', 26, 13); add('bench', 34, 10); add('bench', 34, 13);
  add('signpost', 29, 6, { data: { text: 'Jardim — o portal leva à Ala das Arenas. Boa caçada!' } });
  rect(33, 3, 38, 6, (x, y) => { if (floor[y * W + x] === T.water) fx[`${x},${y}`] = 'x'; });

  // ===== Recepção
  add('counter', 50, 8); npc('guide', 'office-recepcionista', 51, 7, { name: 'Lia' });
  add('quest_board', 44, 1); npc('quests', `${RO}npcs-walking-png-12`, 46, 3, { name: 'Mestra das Quests' });
  add('notice_board', 47, 1); add('calendar', 48, 1);
  for (const x of [56, 60, 64]) add('window', x, 1);
  add('plant_big', 43, 1); add('plant_big', 76, 1); add('plant', 43, 15); add('plant', 76, 15);
  lounge(60, 9); // sofás + poltronas em volta do tapete
  add('lamp', 59, 8, on); add('lamp', 65, 8, on);
  add('statue', 70, 3); add('trophy', 72, 3); add('clock', 74, 3); add('globe', 68, 1);
  add('water', 75, 9); add('coffee', 75, 10);
  npc('kafra', `${RO}npcs-walking-png-10`, 44, 9, { name: 'Kafra' });
  npc('merchant', `${RO}npcs-regional-png-7`, 70, 12, { name: 'Bruno, o mercador' });
  add('crate', 71, 13); add('barrel', 69, 13);
  add('arcade', 73, 14); add('arcade', 74, 14); add('jukebox', 75, 14);
  add('signpost', 49, 14, { data: { text: 'Bem-vindo! Fale com a Lia no balcão para achar uma mesa livre. Botão direito em qualquer móvel mostra o que ele faz.' } });
  rect(51, 11, 55, 13, (x, y) => { fx[`${x},${y}`] = 'n'; }); // pontos de chegada

  // ===== Escritório: ilhas de mesas alinhadas (2 mesas por ilha, cadeira centrada atrás)
  let k = 0;
  for (const y of [24, 30]) {
    for (const px of [24, 31, 38]) {
      for (const dx of [0, 2]) {
        k += 1;
        const x = px + dx;
        add(k % 2 ? 'desk_pc' : 'desk', x, y, { data: { slot: k } });
        add('chair', x, y + 1, { rot: N, data: { ox: 16 } });
        zones.push({ id: `z-mesa-${k}`, name: `Mesa ${k}`, kind: 'desk', x, y: y - 1, w: 2, h: 3 });
      }
    }
  }
  for (const x of [29, 36]) { add('plant', x, 24); add('plant', x, 30); }
  add('printer', 23, 33); add('water', 26, 33); add('lamp', 23, 22, on);
  add('whiteboard', 30, 22); add('chart_board', 33, 22); add('notion_board', 36, 22);
  npc('notion', `${RO}npcs-regional-png-6`, 39, 22, { name: 'Ada' });
  add('server', 41, 33); add('mailbox', 42, 33);
  // cabines de foco (área privada por ID: só quem está dentro se escuta)
  for (const [y, id] of [[22, 'cabine-1'], [29, 'cabine-2']]) {
    rect(44, y, 47, y + 4, (x, yy) => { fx[`${x},${yy}`] = `p:${id}`; });
    add('armchair', 45, y + 2, { rot: E }); add('table_round', 46, y + 2); add('lamp', 47, y, on); add('plant', 44, y);
  }

  // ===== Sala de reunião A / B (mesa 3x3, 12 cadeiras viradas para ela)
  meetingTable(55, 27);
  add('phone', 51, 23); add('projector', 59, 23); add('whiteboard', 54, 22); add('chart_board', 59, 33);
  add('plant', 50, 33); add('plant', 62, 33); add('lamp', 62, 22, on);
  add('door', 56, 21, { state: { open: true } });
  meetingTable(69, 27);
  add('phone', 65, 23); add('tv', 73, 23); add('notion_board', 66, 33); add('plant', 64, 33); add('plant', 76, 33);
  add('door', 70, 21, { state: { open: true } });

  // ===== Copa: balcão com barista e mesas para 4
  add('fridge', 23, 39); add('coffee', 24, 39); add('water', 25, 39); add('cauldron', 26, 39);
  add('counter', 28, 40); npc('barista', `${RO}animals-anthropomorphic-png-6`, 29, 39, { name: 'Miau' });
  tableFor4(25, 42); tableFor4(31, 42); tableFor4(25, 46); tableFor4(31, 46);
  add('barrel', 34, 39); add('plant', 34, 48);

  // ===== Cantinho de leitura (cena pronta do pacote Cozy Nook)
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
    lounge(40, 42);
  }
  add('bookshelf', 37, 39); add('lamp', 49, 40, on); add('fireplace', 47, 39, on);
  add('wardrobe', 50, 39); add('piano', 38, 47); add('game_table', 47, 46); add('beanbag', 46, 46); add('beanbag', 48, 46);

  // ===== Auditório: palco com destaque e bancos virados para ele
  add('projector', 62, 39); add('podium', 64, 40);
  rect(58, 39, 69, 41, (x, y) => { fx[`${x},${y}`] = 's'; });
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
    { id: 'z-escritorio', name: 'Escritório', kind: 'area', x: 23, y: 22, w: 21, h: 13 },
    { id: 'z-cabine-1', name: 'Cabine de foco 1', kind: 'area', x: 44, y: 22, w: 4, h: 5 },
    { id: 'z-cabine-2', name: 'Cabine de foco 2', kind: 'area', x: 44, y: 29, w: 4, h: 5 },
    { id: 'z-reuniao-a', name: 'Sala de reunião A', kind: 'private', x: 50, y: 22, w: 13, h: 13, meeting: true },
    { id: 'z-reuniao-b', name: 'Sala de reunião B', kind: 'private', x: 64, y: 22, w: 13, h: 13, meeting: true },
    { id: 'z-copa', name: 'Copa', kind: 'area', x: 23, y: 39, w: 13, h: 10 },
    { id: 'z-leitura', name: 'Cantinho de leitura', kind: 'area', x: 37, y: 39, w: 14, h: 10 },
    { id: 'z-auditorio', name: 'Auditório', kind: 'area', x: 52, y: 42, w: 25, h: 7 },
    { id: 'z-palco', name: 'Palco', kind: 'spotlight', x: 58, y: 39, w: 12, h: 3 },
  );

  return { map: { width: W, height: H, floor, fg, fx, spawn: { x: 53, y: 12 }, version: 3 }, objects, zones };
}

export const MAP_VERSION = 3;
export { CAT };
