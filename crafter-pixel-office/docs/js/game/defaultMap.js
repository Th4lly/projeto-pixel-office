// Escritório padrão, montado com os tiles e sprites da pasta.
//
//  ┌ Ala das arenas ┐┌──── Jardim ────┐┌──────── Salão / Recepção ────────┐
//  │ Monstros │ PvP ││                ││                                   │
//  │──corredor──────▶│                │└───────────────────────────────────┘
//  │ Covil    │Treino│└──── corredor ───────────────────────────────────────
//  └──────────┴──────┘┌──── Mesas (cada uma com área) ──┐┌ Reunião A ┐┌ Reunião B ┐
//                     └──────────────────────────────────┘└───────────┘└───────────┘
//                     ┌Cafeteria┐┌ Cantinho de leitura ┐┌──── Auditório (palco) ────┐
//  ┌── Calabouço ──┐┌──────────────── Bosque (terraço do café, lago, caverna) ───────────┐
//  └───────────────┘└────────────────────────────────────────────────────────────────────┘
import { findFloor, CAT } from '../art/assets.js';
import { FLOORS } from '../art/tiles.js';

const F = (...n) => {
  const f = findFloor(...n);
  return f ? f.id : 'void';
};
/** Piso cujo id termina com o sufixo (evita que "png-1" pegue "png-12"). */
const FE = (fallback, ...suffixes) => {
  for (const sfx of suffixes) {
    const id = Object.keys(FLOORS).find((k) => !FLOORS[k].wall && k.endsWith(sfx));
    if (id) return id;
  }
  return fallback;
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
  const H = 84;
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
  // quartel, calabouço, bosque e cafeteria
  T.qfloor = FE(T.dungeon, 'interior-walls-01-png-28');
  T.qwall = WALL('interior-walls-01-png-36', 'interior-walls');
  T.dfloor = FE(T.dungeon, 'dungeon-tiles-png-12');
  T.dfloor2 = FE(T.dungeon, 'dungeon-tiles-png-23');
  T.dwall = WALL('dungeon-tiles-png-19', 'interior-walls');
  T.dwater = FE(T.water, 'seasonal-sample-summer-png-2');
  T.bridge = FE(T.wood, 'interior-walls-01-png-15');
  T.grass = FE(T.grass, 'extra-floor-grama');
  T.bloom = FE(T.grass2, 'extra-floor-grama-florida');
  T.dirt = FE(T.dirt, 'extra-floor-terra');
  T.cafe = FE(T.wood, 'interior-walls-01-png-21');
  T.patio = FE(T.cobble, 'floors-tiles-png-11');
  const floor = new Array(W * H).fill(T.stone);
  const fill = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) floor[y * W + x] = t;
  };

  // ---------------- quartel (ala das arenas, oeste): paredes de pedra separando cada espaço
  fill(0, 0, 21, 49, T.qwall);
  fill(9, 1, 11, 49, T.qfloor); // corredor central do quartel (desce até o calabouço)
  // arena dos monstros (grande) + arena dos filhotes anexada embaixo, com portão
  fill(1, 1, 7, 14, T.arena); fill(1, 16, 7, 21, T.arena); fill(3, 15, 5, 15, T.qfloor);
  fill(8, 6, 8, 8, T.qfloor); fill(8, 17, 8, 18, T.qfloor);
  // arena PvP (grande) com ringue de areia + dois ringues de duelo anexados
  fill(13, 1, 20, 13, T.pvp); fill(14, 3, 19, 11, T.sand);
  fill(13, 15, 15, 21, T.sand); fill(18, 15, 20, 21, T.sand);
  fill(14, 14, 14, 14, T.pvp); fill(19, 14, 19, 14, T.pvp);
  fill(12, 6, 12, 8, T.qfloor);
  // passagem do quartel para o corredor do escritório
  fill(12, 23, 21, 23, T.qfloor); fill(21, 18, 21, 23, T.cobble);
  // salas de convivência (refeitório e sala de descanso) e a escadaria
  fill(1, 24, 7, 31, T.cafe); fill(8, 27, 8, 28, T.qfloor);
  fill(1, 33, 7, 40, T.herring); fill(8, 36, 8, 37, T.qfloor);
  fill(1, 42, 7, 48, T.qfloor); fill(8, 45, 8, 46, T.qfloor);
  // campo de treino
  fill(13, 25, 20, 48, T.qfloor); fill(12, 29, 12, 30, T.qfloor); fill(12, 41, 12, 42, T.qfloor);
  fill(21, 36, 21, 37, T.cobble);
  fill(21, 7, 21, 9, T.qfloor); // passagem da arena PvP para o jardim

  // ---------------- jardim (bosque): grama, trilhas de terra sinuosas, flores e lago
  fill(22, 0, 41, 17, T.hedge);
  fill(23, 1, 40, 16, T.grass);
  for (let y = 1; y <= 16; y++) for (let x = 23; x <= 40; x++) if (((x * 7 + y * 13) % 17) === 0 || ((x * 3 + y * 5) % 19) === 0) floor[y * W + x] = T.bloom;
  const trail = (pts, wdt = 2) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / Math.max(1, n));
        const y = Math.round(ay + ((by - ay) * k) / Math.max(1, n));
        fill(x, y, x + wdt - 1, y + wdt - 1, T.dirt);
      }
    }
  };
  // trilha: arco do quartel → curva → cruzamento → saída para o escritório e para a recepção
  trail([[22, 8], [26, 8], [28, 10], [30, 10], [31, 12], [31, 17]]);
  trail([[30, 10], [33, 8], [37, 8], [40, 8], [41, 8]]);
  trail([[28, 10], [26, 13], [24, 15]], 1);
  fill(33, 3, 38, 6, T.water); fill(34, 2, 37, 2, T.water); // laguinho
  fill(31, 17, 32, 17, T.dirt);

  // ---------------- salão / recepção
  fill(42, 0, 77, 17, T.wall);
  fill(43, 1, 76, 16, T.porc);
  fill(41, 7, 42, 9, T.porc);
  fill(52, 17, 54, 17, T.porc);

  // ---------------- corredor central (a trilha do jardim chega até a porta do escritório)
  fill(22, 18, 77, 20, T.cobble);
  fill(31, 18, 32, 19, T.dirt); fill(33, 19, 35, 20, T.dirt);

  // ---------------- mesas (escritório)
  fill(22, 21, 77, 35, T.wall);
  fill(23, 22, 48, 34, T.wood);
  fill(34, 21, 37, 21, T.wood);
  // cabines de foco separadas por parede, cada uma com sua porta
  fill(43, 22, 43, 34, T.wall); fill(43, 27, 48, 28, T.wall);
  fill(43, 24, 43, 24, T.wood); fill(43, 31, 43, 31, T.wood);
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
  fill(23, 39, 35, 48, T.cafe); fill(23, 39, 35, 41, T.porc); // salão de madeira, cozinha de piso frio
  fill(28, 38, 30, 38, T.cafe);
  fill(29, 49, 30, 49, T.patio); // porta para o terraço no bosque
  fill(37, 39, 50, 48, T.walnut);
  fill(42, 38, 44, 38, T.walnut);
  fill(52, 39, 76, 48, T.herring);
  fill(62, 38, 65, 38, T.herring);
  fill(44, 49, 45, 49, T.walnut); fill(64, 49, 65, 49, T.herring); // saídas para o bosque
  fill(21, 36, 21, 37, T.cobble); fill(21, 18, 21, 20, T.cobble); // ala das arenas ↔ corredores

  // ---------------- calabouço (sudoeste), no formato de masmorra: salas, canal d'água em L, pontes
  fill(0, 50, 25, 83, T.dwall);
  fill(1, 51, 24, 82, T.dfloor);
  fill(9, 49, 11, 50, T.qfloor); // escadaria do quartel
  const ring = (x0, y0, x1, y1) => { fill(x0, y0, x1, y0, T.dwall); fill(x0, y1, x1, y1, T.dwall); fill(x0, y0, x0, y1, T.dwall); fill(x1, y0, x1, y1, T.dwall); };
  ring(1, 51, 8, 60); fill(2, 52, 7, 59, T.dfloor2); fill(4, 60, 5, 60, T.dfloor2); // capela do altar
  ring(16, 51, 24, 57); fill(17, 52, 23, 56, T.dfloor2); fill(20, 57, 20, 57, T.dfloor2); // sala do tesouro
  fill(13, 51, 14, 64, T.dwater); fill(1, 63, 14, 64, T.dwater); // canal em L
  fill(13, 56, 14, 56, T.bridge); fill(9, 63, 11, 64, T.bridge); fill(3, 63, 4, 64, T.bridge);
  ring(1, 72, 9, 82); fill(2, 73, 8, 81, T.dfloor2); fill(5, 72, 5, 72, T.dfloor2); // depósito
  ring(15, 73, 24, 82); fill(16, 74, 23, 81, T.dfloor2); fill(19, 73, 20, 73, T.dfloor2); // salão do MvP
  fill(10, 71, 14, 82, T.dfloor); fill(11, 74, 13, 80, T.dwall); fill(12, 74, 12, 80, T.dwater); // poço central

  // ---------------- bosque (sul): grama, trilhas, lago e o terraço da cafeteria
  fill(26, 50, 77, 83, T.hedge);
  fill(27, 50, 76, 82, T.grass);
  for (let y = 50; y <= 82; y++) for (let x = 27; x <= 76; x++) if (((x * 7 + y * 11) % 23) === 0 || ((x * 5 + y * 3) % 29) === 0) floor[y * W + x] = T.bloom;
  fill(27, 50, 36, 55, T.patio); // terraço do café
  trail([[30, 55], [31, 59], [36, 62], [44, 62], [44, 50]]);
  trail([[44, 62], [52, 66], [60, 66], [64, 60], [64, 50]]);
  trail([[36, 62], [33, 68], [29, 69]]);
  trail([[52, 66], [50, 74], [56, 79], [66, 79], [72, 74]], 2);
  fill(58, 69, 66, 75, T.water); fill(60, 68, 64, 68, T.water); fill(59, 76, 65, 76, T.water); // lago
  fill(30, 64, 30, 66, T.dirt);

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

  const A = (id) => `extra-arena-${id}`;
  const has = (id) => CAT.props.some((p) => p.id === id);
  const ar = (id, x, y, extra) => { if (has(A(id))) add(A(id), x, y, extra); };
  const ex = (id, x, y, extra) => { if (has(`extra-${id}`)) add(`extra-${id}`, x, y, extra); };
  const DP = (n) => `pixel-crawler-free-pack-2-11-pixel-crawler-free-pack-environment-props-static-dungeon-props-png-${n}`;
  const dp = (n, x, y, extra) => { if (has(DP(n))) add(DP(n), x, y, extra); };

  // ===== Quartel: arenas grandes com arenas menores anexadas, salas de convivência e treino
  // corredor
  add('signpost', 10, 1, { data: { text: 'Quartel — PvP só nas Arenas PvP e nos Ringues de Duelo. Monstros na Arena dos Monstros, na dos Filhotes e no Calabouço (escada no fim deste corredor).' } });
  npc('arena', `${RO}npcs-walking-png-2`, 10, 10, { name: 'Mestre Garrick' });
  add('portal', 10, 3); fx['10,3'] = 'o:39,4';
  add('portal', 39, 2); fx['39,2'] = 'o:10,5';
  for (const y of [14, 22, 34, 44]) add('torch', 9, y, on);
  add('signpost', 11, 47, { data: { text: 'Escada para o Calabouço ↓ (monstros fortes e o chefe MvP).' } });
  // arena dos monstros + arena dos filhotes (anexa, pelo portão de baixo)
  add('mob_spawner', 2, 2, { data: { pool: 'arena' } }); add('mob_spawner', 6, 12, { data: { pool: 'arena' } });
  add('mob_spawner', 4, 19, { data: { pool: 'arena' } });
  for (const [x, y] of [[1, 7], [7, 1], [1, 14], [7, 14], [1, 21], [7, 21]]) add('torch', x, y, on);
  add('banner', 2, 1); add('banner', 6, 1); ar('flamula', 2, 16); ar('flamula-2', 6, 16);
  ar('poste-de-madeira', 1, 4); ar('saco-grande', 6, 8); ar('caixote', 1, 11); ar('caixote-claro', 7, 19);
  // arena PvP: camarote no alto, ringue de areia cercado; dois ringues de duelo anexados embaixo
  ar('camarote-real', 15, 1);
  ar('estandarte-vermelho', 13, 1); ar('estandarte-vermelho', 20, 1, { flip: true });
  ar('cerca-de-madeira', 14, 3); ar('cerca-de-madeira', 18, 3); ar('cerca-de-madeira', 14, 12); ar('cerca-de-madeira', 18, 12);
  ar('saco-grande', 13, 13); ar('caixote-claro', 20, 13);
  for (const [x, y] of [[13, 21], [15, 21], [18, 21], [20, 21]]) add('torch', x, y, on);
  add('signpost', 14, 15, { data: { text: 'Ringue de Duelo 1 — PvP 1 contra 1.' } });
  add('signpost', 19, 15, { data: { text: 'Ringue de Duelo 2 — PvP 1 contra 1.' } });
  // refeitório do quartel (convivência)
  ex('int-lareira-grelha', 1, 24); ex('int-barril', 4, 24); ex('int-adega', 5, 24);
  ex('int-mesa-comprida', 2, 28); ex('int-banco-comprido', 2, 27); ex('int-banco-comprido', 2, 29);
  ex('int-mesa-comprida', 5, 28); ex('int-banco-comprido', 5, 27); ex('int-banco-comprido', 5, 29);
  ex('int-cabeca-de-lobo', 7, 24); add('torch', 1, 31, on); add('torch', 7, 31, on);
  // sala de descanso (convivência): lareira, sofás e estante
  add('fireplace', 3, 33, on); add('bookshelf', 1, 33); ex('int-cabeca-de-urso', 7, 33);
  add('rug_round', 3, 36); add('table_round', 4, 37);
  add('sofa', 3, 35, { rot: S, data: { ox: 16 } }); add('sofa', 3, 39, { rot: N, data: { ox: 16 } });
  add('armchair', 2, 37, { rot: E }); add('armchair', 6, 37, { rot: Wd }); add('lamp', 7, 40, on); add('plant', 1, 40);
  // alojamento: camas, baú e armas
  add('bed', 2, 44); add('bed', 5, 44); ex('int-bau-de-madeira', 1, 47); ar('pilha-de-caixotes', 6, 47);
  ex('int-candelabro-sombrio', 4, 42, on); ar('suporte-de-escudos-2', 1, 42); ar('rack-vazio', 5, 42);
  // campo de treino: estande de tiro, armas nas paredes, bonecos
  ar('flamula', 13, 25); ar('flamula-2', 20, 25);
  ar('alvo', 14, 26); ar('alvo-2', 16, 26); ar('alvo', 18, 26);
  ar('tapete-azul-longo', 14, 31);
  ar('parede-de-armas-longas', 13, 27); ar('rack-de-espadas', 13, 33); ar('rack-de-lancas', 13, 35);
  ar('rack-de-machados', 18, 29); ar('suporte-de-escudos', 19, 31); ar('suporte-de-escudos-2', 19, 33);
  ar('pilha-de-elmos', 13, 39); ar('pilha-de-caixotes', 19, 39);
  ar('boneco-de-treino', 14, 41); ar('boneco-de-treino-2', 16, 41); ar('boneco-de-treino-3', 18, 41);
  ar('boneco-de-treino-2', 15, 43); ar('boneco-de-treino', 17, 43);
  ar('monte-de-equipamentos', 13, 45); ar('saco-de-graos', 17, 47); ar('saco-grande', 18, 47); ar('caixote-grande', 19, 46); ar('caixote', 20, 45);
  add('signpost', 14, 38, { data: { text: 'Campo de treino: pegue uma arma no rack, um escudo ou um elmo (valem +CA/+acerto por 10 min), atire nos alvos (série de 3 flechas dá zeny) e teste golpes nos bonecos.' } });
  rect(21, 6, 21, 10, (x, y) => { fg[`${x},${y}`] = roofStone; });

  // ===== Calabouço: capela, sala do tesouro, canal em L com pontes, depósito e salão do MvP
  const dz = [];
  // capela do altar
  add('throne', 4, 52); dp(15, 3, 52); dp(15, 6, 52);
  ex('int-candelabro-sombrio', 2, 52, on); ex('int-candelabro-sombrio', 7, 52, on);
  ex('int-mesa-de-banquete', 4, 55); ex('int-cabeca-de-lobo', 2, 55); add('chest', 7, 57);
  add('torch', 2, 59, on); add('torch', 7, 59, on);
  // sala do tesouro
  add('chest', 18, 52); add('chest', 22, 52); add('crate', 17, 56); add('barrel', 23, 56);
  dp(16, 17, 52); dp(16, 23, 52); add('torch', 20, 52, on);
  // corredor e área leste
  for (const [x, y] of [[9, 52], [11, 52], [15, 59], [24, 59], [1, 62], [24, 62]]) add('torch', x, y, on);
  dp(6, 16, 61); dp(7, 22, 61); dp(8, 19, 59);
  // salão central: portão do MvP, pilares e grades
  add('arena_gate', 11, 66); add('signpost', 13, 67, { data: { text: 'Salão do MvP ↘ — o chefe do calabouço renasce de tempos em tempos.' } });
  for (const [x, y] of [[1, 65], [24, 65], [1, 70], [24, 70]]) add('torch', x, y, on);
  dp(9, 5, 67); dp(10, 18, 67); dp(9, 22, 69); dp(10, 3, 69);
  ex('int-grade-do-chao', 8, 68); ex('int-grade-do-chao', 16, 68);
  // depósito
  add('barrel', 2, 73); add('barrel', 3, 73); add('crate', 8, 73); ex('int-bau-de-madeira', 2, 81);
  ar('pilha-de-caixotes', 6, 80); ar('saco-grande', 4, 76); ar('saco-de-graos', 7, 77); add('torch', 2, 78, on); add('torch', 8, 78, on);
  // salão do MvP
  add('throne', 19, 74); dp(15, 17, 74); dp(16, 22, 74); ex('int-cabeca-de-urso', 16, 74); add('chest', 23, 81);
  ex('int-candelabro-sombrio', 16, 80, on); ex('int-candelabro-sombrio', 23, 79, on);
  add('mob_spawner', 19, 78, { data: { pool: 'boss' } });
  // monstros espalhados
  for (const [x, y] of [[10, 58], [20, 60], [6, 67], [19, 66], [4, 78]]) add('mob_spawner', x, y, { data: { pool: 'arena' } });
  // poço central
  add('torch', 10, 72, on); add('torch', 14, 72, on);
  // saída pela caverna (para o bosque)
  add('portal', 23, 68); fx['23,68'] = 'o:31,70';
  void dz;

  // ===== Jardim (bosque do norte): copas de árvores, moitas, flores e lago
  ex('mana-arvore-frondosa', 23, 1); ex('mana-arvore-frondosa', 26, 2); ex('mana-arvore-frondosa', 23, 11);
  ex('mana-arvore-frondosa', 35, 12); ex('mana-arvore-frondosa', 38, 13);
  for (const [x, y] of [[29, 1], [32, 1], [39, 6], [23, 6], [24, 7], [28, 14], [33, 15], [40, 11], [29, 4]]) ex(['mana-moita', 'mana-arbusto-alto', 'mana-samambaia', 'mana-samambaia-dourada'][(x + y) % 4], x, y);
  for (const [x, y] of [[36, 7], [27, 6], [33, 11], [25, 9]]) ex(['mana-pedra', 'mana-pedregulho', 'mana-pedrinhas', 'mana-rochedo'][(x * y) % 4], x, y);
  add('flowers', 30, 3); add('flowers', 27, 12); add('flowers', 39, 15);
  rect(29, 9, 32, 11, (x, y) => { fg[`${x},${y}`] = roofWood; }); // pergolado sobre o cruzamento
  add('bench', 34, 10); add('bench', 25, 16);
  add('signpost', 29, 6, { data: { text: 'Jardim — trilha ↓ para o escritório, → recepção, ← quartel (portal ao lado do lago).' } });
  rect(33, 2, 38, 6, (x, y) => { if (floor[y * W + x] === T.water) fx[`${x},${y}`] = 'x'; });

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
        add(k % 2 ? 'desk_pc' : 'desk', x, y, { id: `mesa-${k}`, data: { slot: k } });
        add('chair', x, y + 1, { id: `cadeira-mesa-${k}`, rot: N, data: { ox: 16 } });
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

  // ===== Cafeteria: cozinha ao fundo, balcão com banquetas, cabines e mesas (terraço no bosque)
  ex('int-forno-a-lenha', 23, 39); ex('int-fogao-grande', 25, 39); ex('int-pia', 31, 39); ex('int-adega', 34, 39);
  ex('int-fogareiro', 27, 40);
  ex('int-balcao-madeira', 24, 42); ex('int-balcao-madeira', 26, 42); ex('int-balcao-pedra', 31, 42);
  npc('barista', `${RO}animals-anthropomorphic-png-6`, 26, 41, { name: 'Miau' });
  for (const x of [24, 25, 26, 27]) ex('int-banqueta-vermelha', x, 43);
  ex('int-cardapio', 33, 42); ex('int-lousa', 35, 42);
  const booth = has('cozy-coffee-shop-free-directional-furniture-add-on-cozy-coffee-shop-free-directional-furniture-add-on-sprites-booth-bench-booth-bench-s-png')
    ? 'cozy-coffee-shop-free-directional-furniture-add-on-cozy-coffee-shop-free-directional-furniture-add-on-sprites-booth-bench-booth-bench-s-png' : 'sofa';
  for (const bx of [23, 34]) { add(booth, bx, 45, { rot: S }); ex('int-mesa-comprida', bx, 46); add(booth, bx, 47, { rot: N }); }
  const mesa = has('extra-int-mesa-redonda') ? 'extra-int-mesa-redonda' : 'table_round';
  tableFor4(27, 46, 'chair_wood', mesa); tableFor4(31, 46, 'chair_wood', mesa);
  ex('plantas-costela-de-adao', 35, 40); ex('plantas-arbustinho', 23, 41);
  // terraço no bosque
  tableFor4(33, 52, 'chair_wood', mesa); tableFor4(28, 54, 'chair_wood', mesa);
  ex('plantas-arvore-florida', 27, 50); ex('plantas-flor-rosa', 36, 50); ex('plantas-trepadeira', 36, 55);

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

  // ===== Bosque do sul: árvores em grupos, trilhas de terra, flores, lago e a caverna do calabouço
  for (const [x, y] of [[48, 52], [51, 52], [54, 52], [49, 55], [52, 55], [55, 57], [68, 52], [71, 54], [73, 51], [70, 58],
    [38, 66], [41, 69], [38, 72], [30, 76], [34, 79], [40, 77], [44, 80], [70, 79], [74, 76], [67, 64], [56, 60]]) ex('mana-arvore-frondosa', x, y);
  const BUSH = ['mana-moita', 'mana-arbusto-alto', 'mana-samambaia', 'mana-samambaia-dourada'];
  for (let i = 0; i < 46; i++) {
    const x = 27 + ((i * 37) % 50);
    const y = 50 + ((i * 23 + 7) % 33);
    const t = floor[y * W + x];
    if (t !== T.grass && t !== T.bloom) continue;
    if (objects.some((o) => Math.abs(o.x - x) < 3 && Math.abs(o.y - y) < 2)) continue;
    ex(i % 5 === 0 ? ['mana-pedra', 'mana-pedregulho', 'mana-rochedo', 'mana-pedrinhas'][i % 4] : BUSH[i % 4], x, y);
  }
  for (const [x, y] of [[47, 60], [57, 72], [42, 64]]) add('bench', x, y);
  for (const [x, y] of [[46, 58], [62, 63], [36, 66], [58, 81]]) add('flowers', x, y);
  ex('mana-caverna', 27, 66); fx['29,68'] = 'o:21,66'; add('portal', 29, 68);
  add('signpost', 46, 61, { data: { text: 'Bosque — ↑ cafeteria e auditório · ← caverna do Calabouço · → lago.' } });
  rect(58, 68, 66, 76, (x, y) => { if (floor[y * W + x] === T.water) fx[`${x},${y}`] = 'x'; });

  zones.push(
    { id: 'z-arena', name: 'Arena dos Monstros', kind: 'arena', x: 1, y: 1, w: 7, h: 14 },
    { id: 'z-filhotes', name: 'Arena dos Filhotes', kind: 'arena', x: 1, y: 16, w: 7, h: 6 },
    { id: 'z-pvp', name: 'Arena PvP', kind: 'pvp', x: 13, y: 1, w: 8, h: 13 },
    { id: 'z-duelo-1', name: 'Ringue de Duelo 1', kind: 'pvp', x: 13, y: 15, w: 3, h: 7 },
    { id: 'z-duelo-2', name: 'Ringue de Duelo 2', kind: 'pvp', x: 18, y: 15, w: 3, h: 7 },
    { id: 'z-corredor-arenas', name: 'Corredor do Quartel', kind: 'area', x: 9, y: 1, w: 3, h: 49 },
    { id: 'z-refeitorio', name: 'Refeitório do Quartel', kind: 'area', x: 1, y: 24, w: 7, h: 8 },
    { id: 'z-descanso', name: 'Sala de Descanso', kind: 'area', x: 1, y: 33, w: 7, h: 8 },
    { id: 'z-alojamento', name: 'Alojamento', kind: 'area', x: 1, y: 42, w: 7, h: 7 },
    { id: 'z-treino', name: 'Campo de Treino', kind: 'area', x: 13, y: 25, w: 8, h: 24 },
    { id: 'z-calabouco', name: 'Calabouço (MvP)', kind: 'arena', x: 1, y: 51, w: 24, h: 32 },
    { id: 'z-jardim', name: 'Jardim', kind: 'area', x: 23, y: 1, w: 18, h: 16 },
    { id: 'z-salao', name: 'Recepção', kind: 'area', x: 43, y: 1, w: 34, h: 16 },
    { id: 'z-escritorio', name: 'Escritório', kind: 'area', x: 23, y: 22, w: 20, h: 13 },
    { id: 'z-cabine-1', name: 'Cabine de foco 1', kind: 'area', x: 44, y: 22, w: 5, h: 5 },
    { id: 'z-cabine-2', name: 'Cabine de foco 2', kind: 'area', x: 44, y: 29, w: 5, h: 6 },
    { id: 'z-reuniao-a', name: 'Sala de reunião A', kind: 'private', x: 50, y: 22, w: 13, h: 13, meeting: true },
    { id: 'z-reuniao-b', name: 'Sala de reunião B', kind: 'private', x: 64, y: 22, w: 13, h: 13, meeting: true },
    { id: 'z-copa', name: 'Cafeteria', kind: 'area', x: 23, y: 39, w: 13, h: 10 },
    { id: 'z-leitura', name: 'Cantinho de leitura', kind: 'area', x: 37, y: 39, w: 14, h: 10 },
    { id: 'z-auditorio', name: 'Auditório', kind: 'area', x: 52, y: 42, w: 25, h: 7 },
    { id: 'z-palco', name: 'Palco', kind: 'spotlight', x: 58, y: 39, w: 12, h: 3 },
    { id: 'z-terraco', name: 'Terraço do Café', kind: 'area', x: 27, y: 50, w: 10, h: 6 },
    { id: 'z-bosque', name: 'Bosque', kind: 'area', x: 27, y: 56, w: 50, h: 27 },
  );

  return { map: { width: W, height: H, floor, fg, fx, spawn: { x: 53, y: 12 }, version: 5 }, objects, zones };
}

export const MAP_VERSION = 5;
export { CAT };
