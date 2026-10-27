// Escritório padrão (v6), montado a partir do desenho da Thallyta:
//
//  ┌Quartel────────────┐┌ Jardim interno ┐┌──────────── Recepção ─────────────┐
//  │Arena dos  │ │ PvP  ││  (lago, árvores) ││  balcão + secretária · 2 salinhas │
//  │Monstros   │c│      │└────────┬────────┘└────────────┬──────────────────────┘
//  │Filhotes   │o│Ringue1│Ringue2 ════════════ corredor ══════════════════════════
//  │Esc. chefe │r│Refeit.│ ┌ Escritório (12 mesas) ┐┌cab.┐┌ Reunião A ┐┌ Reunião B ┐
//  │Descanso   │r│(ampli-│ └───────────────────────┘└────┘└───────────┘└───────────┘
//  │Arquivos   │ │ ado)  │ ════════════ corredor de baixo ══════════════════════════
//  └───────────┴┬┴───────┘ ┌ Cafeteria ┐┌ Biblioteca ┐┌──────── Auditório ─────────┐
//  ┌ Calabouço ─┴────────┐ ┌ terraço (deck) ─────── Jardim externo (lago) ───────┐
//
// Tudo com sprites do LPC Revised (pisos, paredes, móveis, plantas, portas e luzes) e das
// pastas de sprites do projeto. 1 tile = 32 px.
import { findFloor, CAT } from '../art/assets.js';
import { FLOORS } from '../art/tiles.js';

const F = (...n) => {
  for (const k of n) if (FLOORS[k]) return k;
  const f = findFloor(...n);
  return f ? f.id : 'void';
};
const WALL = (...n) => {
  for (const k of n) {
    if (FLOORS[`w:${k}`]) return `w:${k}`;
    const id = Object.keys(FLOORS).find((x) => FLOORS[x].wall && x.includes(k));
    if (id) return id;
  }
  return Object.keys(FLOORS).find((x) => FLOORS[x].wall) || 'void';
};

export function buildDefaultMap() {
  const W = 78;
  const H = 84;
  const T = {
    grass: F('lpc-grama', 'seasonal-sample-summer-png-1'),
    dirt: F('lpc-terra', 'seasonal-sample-summer-png-3'),
    water: F('lpc-agua', 'water-tiles-png-1'),
    sand: F('lpc-areia', 'floors-tiles-png-1'),
    dwater: F('water-tiles-png-1'),
    wood: F('lpc-madeira', 'topdownhouse-floorsandwalls-png-6'),
    woodLight: F('lpc-madeira-clara'),
    woodDark: F('lpc-madeira-escura'),
    woodCream: F('lpc-madeira-creme'),
    herring: F('lpc-espinha'),
    herringGrey: F('lpc-espinha-cinza'),
    tile: F('lpc-ladrilho'),
    porc: F('lpc-porcelanato', 'office-porcelanato'),
    porcGrey: F('lpc-porcelanato-cinza'),
    stone: F('lpc-pedra'),
    stoneDark: F('lpc-pedra-escura'),
    checker: F('lpc-xadrez'),
    carpetGrey: F('lpc-carpete-cinza', 'office-carpete'),
    carpetBlue: F('lpc-carpete-azul'),
    carpetWine: F('lpc-carpete-vinho'),
    deck: F('lpc-deck'),
    wBrick: WALL('lpc-tijolo', 'office-parede-creme'),
    wPanel: WALL('lpc-painel', 'office-parede-creme'),
    wStone: WALL('lpc-pedra', 'interior-walls'),
    wDungeon: WALL('lpc-pedra-escura', 'lpc-tijolo-escuro'),
    hedge: WALL('hedge'),
  };
  const floor = new Array(W * H).fill(T.wBrick);
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const fill = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) floor[y * W + x] = t;
  };
  const at = (x, y) => floor[y * W + x];

  const objects = [];
  const zones = [];
  const fg = {};
  const fx = {};
  let n = 0;
  const has = (id) => !!(CAT.props && CAT.props.some((p) => p.id === id));
  const add = (type, x, y, extra = {}) => {
    if (!type) return null;
    const o = { id: extra.id || `d${String(n++).padStart(3, '0')}`, type, x, y, state: {}, data: {}, ...extra };
    objects.push(o);
    return o;
  };
  const L = (id, x, y, extra) => (has(`lpc-${id}`) ? add(`lpc-${id}`, x, y, extra) : null);
  const X = (id, x, y, extra) => (has(`extra-${id}`) ? add(`extra-${id}`, x, y, extra) : null);
  const on = { state: { on: true } };
  const rect = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(x, y); };
  // rot = para onde o móvel olha (0 ↓, 90 ←, 180 ↑, 270 →)
  const S = 0, Wd = 90, N = 180, E = 270;
  const RO = 'pc-computer-ragnarok-online-non-playable-characters-';
  const npc = (role, sprite, x, y, data = {}) => add('npc', x, y, { data: { role, sprite: CAT.npcs.some((q) => q.id === sprite) ? sprite : '', ...data } });
  const door = (x, y, skin = 'porta-madeira', floorT = null) => {
    if (floorT) fill(x, y, x, y, floorT);
    return add('door', x, y, { data: { skin } });
  };
  const lamp = (x, y) => add('torch', x, y, on); // arandela na parede
  const post = (x, y) => add('lamppost', x, y, on); // poste no jardim
  const pet = (kind, skin, x, y, name) => add('pet', x, y, { data: { kind, skin, name } });
  /** Mesinha com 4 cadeiras viradas para ela. */
  const table4 = (x, y, color = 'marrom', table = 'mesa-redonda') => {
    L(table, x, y);
    L(`cadeira-${color}`, x, y - 1, { rot: S }); L(`cadeira-${color}`, x, y + 1, { rot: N });
    L(`cadeira-${color}`, x - 1, y, { rot: E }); L(`cadeira-${color}`, x + 1, y, { rot: Wd });
  };
  /** Salinha de estar: tapete, sofás e poltronas virados para a mesa de centro, mesa de canto, vitrola e plantas. */
  const lounge = (x, y, c1 = 'azul', c2 = 'cinza', rug = 'tapete-vinhas-azul', music = true) => {
    L(rug, x, y + 1);
    L(`sofa-${c1}`, x + 1, y, { rot: S, data: { ox: 16 } });
    L('mesa-de-centro', x + 1, y + 1, { data: { ox: 16, oy: 12 } });
    L(`poltrona-${c2}`, x, y + 1, { rot: E, data: { oy: 14 } });
    L(`poltrona-${c2}`, x + 4, y + 1, { rot: Wd, data: { oy: 14 } });
    L(`sofa-${c1}`, x + 1, y + 3, { rot: N, data: { ox: 16 } });
    L('mesinha-clara', x + 5, y);
    L('abajur', x + 5, y, { data: { oy: -8 } });
    if (music) add('jukebox', x - 1, y);
    L('samambaia-no-vaso', x + 5, y + 3);
    L('arvore-no-vaso', x - 1, y + 3);
  };

  // =================================================================== PISOS E PAREDES
  // ---------------- quartel (oeste): pedra, cada espaço separado por parede
  fill(0, 0, 21, 49, T.wStone);
  fill(9, 1, 11, 48, T.herringGrey); // corredor do quartel
  fill(1, 1, 7, 12, T.stone); // arena dos monstros
  fill(3, 13, 5, 13, T.stone);
  fill(1, 14, 7, 21, T.stone); // arena dos filhotes (anexa)
  fill(8, 6, 8, 7, T.stone); fill(8, 17, 8, 18, T.stone); // passagens para o corredor
  fill(1, 23, 7, 31, T.carpetWine); // escritório do chefe
  fill(1, 33, 7, 40, T.woodLight); // sala de descanso
  fill(1, 42, 7, 48, T.porcGrey); // área de arquivos
  fill(12, 5, 12, 7, T.stone); // corredor ↔ arena PvP
  fill(13, 1, 20, 12, T.stone); fill(14, 3, 19, 10, T.sand); // arena PvP
  fill(14, 13, 14, 13, T.sand); fill(19, 13, 19, 13, T.sand);
  fill(13, 14, 16, 20, T.sand); fill(18, 14, 20, 20, T.sand); // ringues de duelo
  fill(21, 6, 21, 9, T.stone); // arena PvP ↔ jardim
  fill(13, 22, 20, 48, T.checker); // refeitório (extensão da cafeteria)
  fill(13, 22, 20, 27, T.carpetBlue); // salinha de convivência do refeitório
  fill(9, 49, 11, 50, T.herringGrey); // escada para o calabouço

  // ---------------- jardim interno
  fill(22, 0, 41, 17, T.hedge);
  fill(23, 1, 40, 16, T.grass);
  fill(22, 6, 22, 9, T.grass); fill(41, 7, 41, 8, T.grass); fill(31, 17, 33, 17, T.grass);
  const blob = (cx, cy, rx, ry, t, wob = 0.18, seed = 1) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const a = Math.atan2(y - cy, x - cx);
        const r = 1 + wob * Math.sin(a * 3 + seed) + wob * 0.6 * Math.cos(a * 5 + seed * 2);
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r && inb(x, y)) floor[y * W + x] = t;
      }
    }
  };
  const path = (pts, wdt = 2) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / Math.max(1, steps));
        const y = Math.round(ay + ((by - ay) * k) / Math.max(1, steps));
        fill(x, y, x + wdt - 1, y + wdt - 1, T.dirt);
      }
    }
  };
  path([[22, 7], [26, 8], [29, 10], [32, 10], [36, 9], [41, 7]]);
  path([[31, 10], [32, 13], [31, 16], [32, 17]]);
  blob(35.5, 3.8, 4.2, 2.6, T.water, 0.2, 2);

  // ---------------- recepção
  fill(42, 0, 77, 17, T.wBrick);
  fill(43, 1, 76, 16, T.porc);
  fill(42, 7, 42, 8, T.porc); // porta do jardim
  fill(50, 17, 51, 17, T.porc); // porta principal para o corredor

  // ---------------- corredor principal
  fill(22, 18, 76, 20, T.herring);

  // ---------------- bloco do escritório
  fill(22, 21, 77, 35, T.wPanel);
  fill(23, 22, 42, 34, T.wood); // escritório
  fill(44, 22, 48, 27, T.carpetBlue); fill(44, 29, 48, 34, T.carpetBlue); // cabines de foco
  fill(50, 22, 63, 34, T.carpetGrey); // reunião A
  fill(65, 22, 76, 34, T.carpetGrey); // reunião B

  // ---------------- corredor de baixo
  fill(22, 36, 76, 37, T.herring);
  fill(21, 36, 21, 37, T.herring); // refeitório ↔ corredor

  // ---------------- cafeteria, biblioteca, auditório
  fill(22, 38, 77, 49, T.wPanel);
  fill(23, 39, 35, 48, T.checker); fill(23, 39, 35, 40, T.tile); // cafeteria (cozinha em ladrilho)
  fill(37, 39, 50, 48, T.woodDark); // biblioteca
  fill(52, 39, 76, 48, T.woodCream); fill(57, 39, 71, 41, T.woodDark); // auditório + palco

  // ---------------- calabouço (sudoeste)
  fill(0, 50, 25, 83, T.wDungeon);
  fill(10, 50, 10, 50, T.stoneDark);
  fill(1, 51, 8, 59, T.stoneDark); // capela
  fill(9, 51, 15, 61, T.stone); // galeria central
  fill(16, 51, 24, 57, T.stoneDark); fill(20, 58, 20, 58, T.stoneDark); // sala do tesouro
  fill(1, 60, 24, 61, T.stone); fill(1, 62, 24, 63, T.dwater); fill(1, 64, 24, 69, T.stone); // canal com pontes
  fill(1, 71, 8, 82, T.stoneDark); fill(5, 70, 5, 70, T.stoneDark); // depósito
  fill(9, 70, 15, 82, T.stone); fill(11, 70, 12, 82, T.dwater); // corredor do poço
  fill(16, 71, 24, 82, T.stoneDark); fill(19, 70, 20, 70, T.stoneDark); // salão do MvP

  // ---------------- jardim externo (sul)
  fill(26, 50, 77, 83, T.hedge);
  fill(27, 50, 76, 82, T.grass);
  fill(27, 50, 36, 54, T.deck); // terraço: deck de madeira
  path([[30, 55], [31, 58], [38, 59], [44, 58], [52, 59], [60, 58], [66, 58], [72, 60]]);
  path([[44, 58], [44, 50]]);
  path([[64, 58], [64, 50]]);
  path([[52, 59], [52, 66], [54, 76], [60, 81], [68, 81], [74, 76], [74, 64], [72, 60]]);
  path([[38, 59], [35, 66], [31, 70]]);
  blob(64, 72.5, 6.6, 4.6, T.water, 0.22, 4);
  blob(69.5, 69, 3, 2.4, T.water, 0.15, 1);

  // =================================================================== OBJETOS
  // ----- portas (abrem sozinhas quando alguém chega perto)
  door(8, 27, 'porta-madeira', T.carpetWine); door(8, 36, 'porta-madeira', T.woodLight); door(8, 45, 'porta-escura', T.porcGrey);
  door(12, 30, 'porta-madeira', T.checker); door(12, 44, 'porta-madeira', T.checker);
  door(21, 36); door(21, 37);
  door(42, 7); door(42, 8);
  door(50, 17); door(51, 17);
  door(34, 21, 'porta-madeira', T.wood); door(35, 21, 'porta-madeira', T.wood);
  door(34, 35, 'porta-madeira', T.wood); door(35, 35, 'porta-madeira', T.wood);
  door(43, 24, 'porta-azul', T.carpetBlue); door(43, 32, 'porta-azul', T.carpetBlue);
  door(56, 21, 'porta-madeira', T.carpetGrey); door(57, 21, 'porta-madeira', T.carpetGrey);
  door(70, 21, 'porta-madeira', T.carpetGrey); door(71, 21, 'porta-madeira', T.carpetGrey);
  door(29, 38, 'porta-madeira', T.checker); door(43, 38, 'porta-madeira', T.woodDark); door(44, 38, 'porta-madeira', T.woodDark);
  door(73, 38, 'porta-madeira', T.woodCream); door(74, 38, 'porta-madeira', T.woodCream);
  door(29, 49, 'porta-verde', T.deck); door(30, 49, 'porta-verde', T.deck);
  door(44, 49, 'porta-verde', T.woodDark); door(64, 49, 'porta-verde', T.woodCream); door(65, 49, 'porta-verde', T.woodCream);
  fill(44, 50, 45, 50, T.dirt); fill(64, 50, 65, 50, T.dirt);

  // ----- quartel
  npc('arena', `${RO}npcs-regional-png-3`, 10, 9, { name: 'Mestre Garrick' });
  npc('info', `${RO}npcs-walking-png-2`, 11, 47, { name: 'Guarda do Calabouço', text: 'A escada aqui embaixo desce ao Calabouço: capela, sala do tesouro, canal com pontes e o salão do MvP. Monstros fortes — vá curado!' });
  for (const y of [4, 15, 26, 35, 44]) add('candelabra', 9, y, on);
  // arena dos monstros (grande) + filhotes (anexa)
  add('mob_spawner', 2, 3, { data: { pool: 'arena' } }); add('mob_spawner', 5, 9, { data: { pool: 'arena' } }); add('mob_spawner', 3, 18, { data: { pool: 'arena' } });
  L('pilar', 1, 1); L('pilar', 7, 1); L('pilar', 1, 12); L('pilar', 7, 12);
  lamp(4, 0); lamp(2, 13); lamp(6, 13); lamp(4, 22);
  add('banner', 3, 1); add('banner', 5, 1);
  X('arena-saco-grande', 6, 6); X('arena-caixote-claro', 1, 8); X('arena-poste-de-madeira', 7, 4);
  X('arena-boneco-de-treino', 2, 15); X('arena-boneco-de-treino-2', 6, 15); X('arena-alvo', 4, 14);
  // arena PvP + ringues
  X('arena-camarote-real', 15, 1);
  X('arena-estandarte-vermelho', 13, 1); X('arena-estandarte-vermelho', 20, 1, { flip: true });
  X('arena-cerca-de-madeira', 13, 3); X('arena-cerca-de-madeira', 19, 3); X('arena-cerca-de-madeira', 13, 11); X('arena-cerca-de-madeira', 19, 11);
  X('arena-rack-de-espadas', 16, 12); X('arena-suporte-de-escudos', 13, 12);
  lamp(16, 0); lamp(14, 0); lamp(18, 0);
  X('arena-flamula', 13, 14); X('arena-flamula-2', 16, 14); X('arena-flamula', 18, 14); X('arena-flamula-2', 20, 14);
  lamp(15, 21); lamp(19, 21);
  // escritório do chefe
  L('estante-livros', 1, 23); L('estante-livros-2', 2, 23); L('lareira', 4, 23, on); L('relogio-de-pe', 7, 23);
  L('quadro-panorama', 4, 22);
  L('tapete-vinhas-rosa', 2, 27);
  L('mesa-escura', 3, 26);
  L('cadeira-escritorio', 3, 25, { rot: S, data: { ox: 16 } });
  L('notebook-prata', 3, 26, { data: { oy: -8, ox: 4 } }); L('abajur', 4, 26, { data: { ox: 10, oy: -8 } }); L('porta-retrato', 3, 26, { data: { ox: -8, oy: -6 } });
  L('cadeira-vermelho', 3, 28, { rot: N }); L('cadeira-vermelho', 4, 28, { rot: N });
  L('sofa-marrom', 1, 29, { rot: E });
  L('arvore-no-vaso', 7, 30); L('topiaria', 6, 23); L('luminaria-dourada', 7, 27, on); L('vaso-grego', 6, 31);
  // sala de descanso
  lounge(2, 34, 'verde', 'amarelo', 'tapete-arco-iris');
  L('tv', 3, 32); L('estante-baixa', 7, 33); L('luminaria-arco', 7, 39, on); L('pufe-amarelo', 6, 39);
  pet('gatinho', 1, 5, 39, 'Pipoca');
  // área de arquivos
  for (const [x, y] of [[1, 42], [3, 42], [5, 42]]) L('arquivo', x, y);
  for (const [x, y] of [[1, 45], [3, 45]]) L('arquivo-escuro', x, y);
  L('armario', 7, 42); L('copiadora', 5, 47); L('lixeira-reciclagem', 7, 47); L('samambaia-no-vaso', 1, 48); L('estante-louças', 6, 45);
  lamp(4, 41);
  // refeitório (extensão da cafeteria): salinha no alto + mesas compridas
  lounge(14, 22, 'cinza', 'azul', 'tapete-vinhas-azul');
  L('quadro-abstrato', 15, 21);
  for (const y of [30, 35, 40, 45]) {
    for (const x of [14, 18]) {
      if (!X('int-mesa-comprida', x, y)) L('mesa-comprida', x, y);
      X('int-banco-comprido', x, y - 1); X('int-banco-comprido', x, y + 1);
    }
  }
  L('maquina-de-vendas', 20, 28); L('maquina-de-bebidas', 20, 29); L('bebedouro', 17, 28); L('lixeira-reciclagem', 20, 47); L('lixeira', 20, 48);
  L('topiaria', 13, 28); L('samambaia-no-vaso', 13, 48); L('arvore-no-vaso', 16, 48);
  L('luminarias-de-parede', 18, 21);

  // ----- jardim interno: espécies variadas, pedras, flores, lago e bancos de madeira
  const G = [['arvore-carvalho', 24, 2], ['arvore-pinheiro', 27, 2], ['arvore-carvalho-raiz', 30, 4], ['cipreste', 24, 5],
    ['arvore-alta', 24, 13], ['arvore-escura', 27, 15], ['copa', 28, 12], ['cipreste-2', 25, 10],
    ['arvore-carvalho', 35, 13], ['arvore-pinheiro-baixo', 38, 15], ['arvore-alta-2', 40, 12], ['cipreste-baixo', 34, 16]];
  for (const [id, x, y] of G) L(id, x, y);
  for (const [id, x, y] of [['moita-1', 27, 6], ['moita-3', 31, 6], ['moita-2', 39, 9], ['moita-5', 23, 9], ['moita-4', 37, 11], ['samambaia', 29, 14], ['moita-6', 40, 16]]) L(id, x, y);
  for (const [id, x, y] of [['canteiro-rosas', 28, 7], ['canteiro-amarelas', 34, 7], ['canteiro-azuis', 40, 2], ['flores-roxas', 33, 1], ['flores-brancas', 30, 13], ['canteiro-vermelhas', 36, 15], ['flores-laranjas', 25, 16]]) L(id, x, y);
  for (const [id, x, y] of [['pedregulho-cinza', 39, 1], ['pedra-cinza', 31, 2], ['seixos-cinza', 33, 8], ['pedra-areia', 27, 9], ['pedras-areia', 38, 6]]) L(id, x, y);
  for (const [id, x, y] of [['junco', 31, 4], ['junco', 40, 4], ['capim-2', 30, 3], ['cogumelo-1', 23, 15], ['cogumelo-3', 40, 14]]) L(id, x, y);
  for (let i = 0; i < 14; i++) { const x = 23 + ((i * 7) % 18); const y = 1 + ((i * 5) % 16); if (at(x, y) === T.grass) L(`florzinhas-${(i % 9) + 1}`, x, y); }
  add('bench', 26, 11, { rot: S }); add('bench', 35, 11, { rot: N });
  post(28, 9); post(37, 8); post(30, 16);
  npc('info', `${RO}npcs-regional-png-2`, 34, 13, { name: 'Jardineira Íris', text: 'Jardim interno — à esquerda a Arena PvP do quartel, à direita a recepção, embaixo o corredor do escritório. Regue as plantas, sente nos bancos e brinque com o Thor!' });
  pet('cachorro', 0, 30, 12, 'Thor');
  pet('sapo', 0, 33, 7, 'Croaky');
  rect(30, 0, 41, 8, (x, y) => { if (at(x, y) === T.water) fx[`${x},${y}`] = 'x'; });

  // ----- recepção: grande balcão com a secretária, duas salinhas de estar
  L('balcao-recepcao', 56, 7);
  npc('secretary', `${RO}npcs-walking-png-12`, 59, 6, { name: 'Clara' });
  L('notebook', 57, 7, { data: { oy: -10 } }); L('telefone', 61, 7, { data: { oy: -10 } }); L('vaso-de-flor', 56, 7, { data: { oy: -10, ox: 4 } });
  L('pilha-de-papeis', 58, 7, { data: { oy: -10, ox: 8 } }); L('abajur', 60, 7, { data: { oy: -11, ox: 8 } }); L('porta-retrato-2', 61, 7, { data: { oy: -10, ox: 14 } });
  L('arquivo-escuro', 56, 1); L('relogio-de-pe', 59, 1); L('arquivo-escuro', 60, 1);
  L('topiaria', 55, 7); L('topiaria', 62, 7);
  L('tapete-vinhas-azul', 56, 9);
  for (const x of [45, 49]) add('window', x, 0);
  add('quest_board', 64, 1); add('calendar', 53, 0);
  L('quadro-onda', 62, 0); L('arandela', 47, 0, on); L('arandela', 66, 0, on);
  L('sofa-marinho', 44, 11, { rot: E }); L('mesinha-media', 44, 13); L('poltrona-marinho', 44, 14, { rot: E }); L('samambaia-no-vaso', 43, 16);
  L('bebedouro', 43, 1); L('arvore-no-vaso', 43, 3);
  lounge(69, 1, 'azul', 'cinza', 'tapete-vinhas-azul');
  lounge(69, 11, 'vermelho', 'amarelo', 'tapete-vinhas-rosa');
  pet('gato', 0, 73, 8, 'Mochi');
  L('luminaria-creme', 67, 6, on); L('luminaria-azul', 67, 10, on);
  rect(48, 13, 54, 15, (x, y) => { fx[`${x},${y}`] = 'n'; }); // pontos de chegada

  // ----- corredores
  for (const x of [26, 38, 47, 60, 73]) lamp(x, 17);
  for (const x of [25, 40, 53, 67]) lamp(x, 35);
  for (const x of [24, 46, 62]) L('arvore-no-vaso', x, 18);
  L('samambaia-no-vaso', 76, 18); L('samambaia-no-vaso', 76, 37); L('topiaria', 22, 37);

  // ----- escritório: 12 mesas em ilhas, cadeira centrada atrás de cada mesa
  let k = 0;
  for (const y of [24, 30]) {
    for (const px of [24, 30, 36]) {
      for (const dx of [0, 2]) {
        k += 1;
        const x = px + dx;
        add(k % 3 === 0 ? 'desk_magic' : k % 2 ? 'desk_pc' : 'desk', x, y, { id: `mesa-${k}`, data: { slot: k } });
        add('chair', x, y + 1, { id: `cadeira-mesa-${k}`, rot: N, data: { ox: 16 } });
        zones.push({ id: `z-mesa-${k}`, name: `Mesa ${k}`, kind: 'desk', x, y: y - 1, w: 2, h: 3 });
      }
    }
  }
  for (const x of [28, 34]) { L('samambaia-no-vaso', x, 24); L('flor-no-vaso', x, 30); }
  add('whiteboard', 24, 22); add('chart_board', 27, 22); add('notion_board', 30, 22); L('tv', 37, 21);
  L('estante-livros', 41, 22); L('estante-livros-3', 42, 22); L('relogio-de-pe', 23, 22);
  L('copiadora', 38, 33); L('bebedouro', 41, 33); L('lixeira-reciclagem', 42, 33); L('arquivo', 23, 33);
  L('luminaria-creme', 23, 28, on); L('luminaria-creme', 42, 28, on);
  // cabines de foco (área privada por ID)
  for (const [y0, id] of [[22, 'cabine-1'], [29, 'cabine-2']]) {
    rect(44, y0, 48, y0 + 5, (x, yy) => { if (at(x, yy) === T.carpetBlue) fx[`${x},${yy}`] = `p:${id}`; });
    L('poltrona-azul', 45, y0 + 2, { rot: E }); L('mesinha-branca', 46, y0 + 2); L('abajur-azul', 46, y0 + 2, { data: { oy: -8 } });
    L('samambaia-no-vaso', 48, y0); L('estante-baixa', 44, y0); L('luminaria-coluna', 48, y0 + 4, on);
  }
  // salas de reunião: mesa com toalha e 12 cadeiras viradas para ela
  const meeting = (x, y) => {
    add('meeting_table', x, y);
    for (let i = 0; i < 3; i++) {
      add('chair', x + i, y - 1, { rot: S }); add('chair', x + i, y + 3, { rot: N });
      add('chair', x - 1, y + i, { rot: E }); add('chair', x + 3, y + i, { rot: Wd });
    }
  };
  meeting(55, 26);
  add('phone', 51, 23); L('tv', 60, 21); add('whiteboard', 52, 22); add('chart_board', 60, 33);
  L('samambaia-no-vaso', 50, 33); L('arvore-no-vaso', 63, 33); L('luminaria-creme', 63, 22, on); L('estante-baixa-2', 50, 22);
  meeting(69, 26);
  add('phone', 66, 23); L('tv', 74, 21); add('notion_board', 66, 33); L('samambaia-no-vaso', 76, 33); L('topiaria', 65, 33); L('luminaria-dourada', 76, 22, on);

  // ----- cafeteria: cozinha ao fundo, balcão com banquetas, mesas
  L('fogao', 23, 39); L('pia', 24, 39); L('geladeira', 26, 39); X('int-fogao-grande', 27, 39); X('int-forno-a-lenha', 31, 39); X('int-adega', 33, 39);
  L('cafeteira', 35, 39);
  X('int-balcao-madeira', 24, 41); X('int-balcao-madeira', 26, 41); X('int-balcao-pedra', 31, 41);
  L('xicara', 24, 41, { data: { oy: -10 } }); L('bolo', 26, 41, { data: { oy: -10 } }); L('torta', 31, 41, { data: { oy: -10, ox: 8 } });
  for (const x of [24, 25, 26, 27]) L('banqueta-vermelho', x, 42);
  X('int-cardapio', 34, 41);
  table4(25, 45); table4(29, 45, 'vermelho'); table4(33, 45, 'marrom');
  L('samambaia-no-vaso', 23, 48); L('arvore-no-vaso', 35, 48); L('quadro-fogo', 33, 38);
  lamp(25, 38); lamp(32, 38);

  // ----- biblioteca: paredes de estantes, corredores de livros, cantinho de leitura
  for (let x = 37; x <= 50; x++) if (x !== 43 && x !== 44) L(['estante-livros', 'estante-livros-2', 'estante-livros-3'][x % 3], x, 39);
  for (const x of [38, 39, 40, 47, 48, 49]) L(['estante-livros-2', 'estante-livros', 'estante-livros-3'][x % 3], x, 42);
  L('escada-biblioteca', 41, 40);
  L('tapete-vinhas-rosa', 40, 45);
  L('poltrona-vermelho', 40, 46, { rot: E }); L('mesinha-media', 42, 46); L('abajur', 42, 46, { data: { oy: -8 } }); L('poltrona-vermelho', 44, 46, { rot: Wd });
  L('almofada', 43, 47);
  L('vaso-grego', 37, 48); L('vaso-azul', 50, 48); L('relogio-de-pe', 50, 44); L('luminaria-dourada', 37, 44, on);
  L('lareira-tijolo', 46, 45, on); L('arvore-no-vaso', 49, 47); L('estante-baixa', 37, 45);
  pet('gato', 3, 39, 47, 'Pretinha');
  lamp(40, 38); lamp(48, 38);

  // ----- auditório: palco, telão e plateia virada para o palco
  add('podium', 64, 40); L('tv', 62, 38); add('projector', 58, 40);
  rect(57, 39, 71, 41, (x, y) => { fx[`${x},${y}`] = 's'; });
  for (const y of [43, 45, 47]) for (let x = 54; x <= 74; x++) if (x < 62 || x > 66) L('cadeira-vermelho', x, y, { rot: N });
  L('topiaria', 52, 39); L('topiaria', 76, 39); L('samambaia-no-vaso', 52, 48); L('samambaia-no-vaso', 76, 48);
  lamp(54, 38); lamp(69, 38);

  // ----- terraço: deck de madeira com escada para o jardim
  L('degraus', 29, 55);
  L('floreira', 27, 50); L('floreira', 36, 50); L('jardineira', 27, 54); L('jardineira', 36, 54);
  post(28, 52); post(35, 52);
  L('vaso-grego', 33, 50); L('flor-no-vaso', 33, 54);

  // ----- jardim externo: bosque variado, lago orgânico, caminhos e bancos
  const TREES = ['arvore-carvalho', 'arvore-carvalho-raiz', 'arvore-alta', 'arvore-alta-2', 'arvore-escura', 'arvore-pinheiro', 'arvore-pinheiro-2', 'arvore-pinheiro-baixo', 'arvore-escura-alta', 'copa', 'arvore-pinheiro-alto'];
  const forest = [[48, 53], [51, 53], [54, 54], [57, 53], [49, 56], [55, 56], [58, 55], [68, 53], [71, 54], [74, 53], [69, 56], [75, 56],
    [38, 64], [41, 67], [38, 71], [30, 78], [34, 80], [41, 79], [45, 81], [72, 81], [76, 79], [69, 64], [57, 64], [47, 70], [43, 74], [28, 61], [33, 63]];
  forest.forEach(([x, y], i) => { if (at(x, y) === T.grass) L(TREES[(i * 7) % TREES.length], x, y); });
  const BUSHES = ['moita-1', 'moita-2', 'moita-3', 'moita-4', 'moita-5', 'moita-6', 'cipreste', 'cipreste-baixo', 'samambaia', 'capim-2'];
  const FLOWERS = ['canteiro-brancas', 'canteiro-rosas', 'canteiro-vermelhas', 'canteiro-azuis', 'canteiro-roxas', 'canteiro-amarelas', 'flores-laranjas', 'flores-douradas', 'flores-celestes'];
  const ROCKS = ['pedra-cinza', 'pedregulho-cinza', 'rochedo-areia', 'pedras-cinza', 'seixos-areia', 'pedra-alta-cinza', 'laje-areia', 'seixo-cinza'];
  const free = (x, y) => at(x, y) === T.grass && !objects.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2);
  for (let i = 0; i < 90; i++) {
    const x = 27 + ((i * 37 + 11) % 50);
    const y = 56 + ((i * 23 + 5) % 27);
    if (!free(x, y)) continue;
    const r = i % 6;
    if (r < 2) L(BUSHES[i % BUSHES.length], x, y);
    else if (r < 4) L(FLOWERS[i % FLOWERS.length], x, y);
    else if (r === 4) L(ROCKS[i % ROCKS.length], x, y);
    else L(`florzinhas-${(i % 9) + 1}`, x, y);
  }
  for (const [x, y] of [[57, 70], [70, 74], [60, 77], [66, 68]]) if (at(x, y) === T.grass) L('junco', x, y);
  for (const [x, y] of [[61, 67], [72, 77]]) if (at(x, y) === T.grass) L('cogumelo-2', x, y);
  add('bench', 40, 57, { rot: S }); add('bench', 56, 57, { rot: S }); add('bench', 48, 61, { rot: N }); add('bench', 60, 79, { rot: N });
  for (const [x, y] of [[33, 57], [47, 57], [62, 57], [51, 63], [53, 75], [75, 70], [66, 79]]) post(x, y);
  L('fonte', 46, 64);
  npc('info', `${RO}npcs-walking-png-6`, 42, 60, { name: 'Guia Tomás', text: 'Jardim externo — siga as trilhas até o lago. A caverna a oeste desce direto ao Calabouço. Cuidado com o Bolinha, o porquinho guloso!' });
  pet('porquinho', 0, 58, 62, 'Bolinha'); pet('coelho', 1, 70, 62, 'Neve'); pet('coelho', 0, 36, 75, 'Pipo'); pet('sapo', 2, 56, 69, 'Dourado');
  // caverna do calabouço (portal)
  X('mana-caverna', 27, 68);
  add('portal', 30, 71); fx['30,71'] = 'o:22,80';
  rect(52, 64, 76, 82, (x, y) => { if (at(x, y) === T.water) fx[`${x},${y}`] = 'x'; });

  // ----- calabouço: capela, tesouro, canal com pontes, poço, depósito e salão do MvP
  L('degraus', 9, 49);
  // capela
  L('altar', 3, 52); L('lapide-lobo', 3, 55); L('candelabro', 2, 52, on); L('candelabro', 6, 52, on);
  L('pilar-escuro', 1, 51); L('pilar-escuro', 8, 51); L('pilar-escuro', 1, 59); L('pilar-escuro', 8, 59);
  add('banner', 4, 51); add('banner', 5, 51); L('caveira', 7, 57); L('teia', 1, 50);
  // galeria central
  L('pilar', 9, 52); L('pilar', 15, 52); L('pilar', 9, 58); L('pilar', 15, 58);
  L('trono', 12, 52); add('mob_spawner', 11, 55, { data: { pool: 'arena' } });
  // sala do tesouro
  L('bau-grande', 17, 52); L('bau', 22, 52); L('bau', 23, 55); L('barris', 17, 55); L('caixote', 21, 56);
  L('candelabro', 20, 52, on); L('teia', 24, 50);
  // canal com pontes de madeira (o piso da ponte libera a água por baixo)
  for (const x of [3, 10, 19]) {
    if (!L('ponte-reta', x - 1, 61)) L('ponte-arco', x - 1, 61);
    rect(x - 1, 62, x + 1, 63, (xx, yy) => { fx[`${xx},${yy}`] = 'w'; });
  }
  for (const [x, y] of [[1, 60], [24, 60], [1, 64], [24, 64], [8, 60], [16, 60]]) L('pilar-escuro', x, y);
  add('mob_spawner', 5, 66, { data: { pool: 'arena' } }); add('mob_spawner', 18, 66, { data: { pool: 'arena' } });
  L('ossada', 13, 67); L('caveira', 21, 68);
  // depósito
  L('barris', 2, 72); L('barril', 4, 72); L('caixote', 7, 72); L('caixote-pequeno', 7, 73);
  L('bau', 2, 81); L('ossada', 5, 79); L('caixote', 8, 81); add('mob_spawner', 4, 76, { data: { pool: 'arena' } });
  // poço com ponte em arco
  L('ponte-arco', 10, 75); rect(11, 76, 12, 76, (x, y) => { fx[`${x},${y}`] = 'w'; });
  L('pilar', 9, 71); L('pilar', 14, 71); L('pilar', 9, 81); L('pilar', 14, 81);
  // salão do MvP
  L('trono', 20, 72); L('lapide-lobo', 19, 75); L('candelabro', 17, 72, on); L('candelabro', 23, 72, on);
  L('bau-grande', 22, 81); L('pilar-escuro', 16, 71); L('pilar-escuro', 24, 71);
  add('mob_spawner', 19, 78, { data: { pool: 'boss' } });
  add('portal', 22, 80); fx['22,80'] = 'o:31,72';
  for (const [x, y] of [[4, 50], [13, 50], [20, 50], [3, 70], [22, 70]]) lamp(x, y);

  // =================================================================== ÁREAS
  zones.push(
    { id: 'z-arena', name: 'Arena dos Monstros', kind: 'arena', x: 1, y: 1, w: 7, h: 12 },
    { id: 'z-filhotes', name: 'Arena dos Filhotes', kind: 'arena', x: 1, y: 14, w: 7, h: 8 },
    { id: 'z-pvp', name: 'Arena PvP', kind: 'pvp', x: 13, y: 1, w: 8, h: 12 },
    { id: 'z-duelo-1', name: 'Ringue de Duelo 1', kind: 'pvp', x: 13, y: 14, w: 4, h: 7 },
    { id: 'z-duelo-2', name: 'Ringue de Duelo 2', kind: 'pvp', x: 18, y: 14, w: 3, h: 7 },
    { id: 'z-corredor-arenas', name: 'Corredor do Quartel', kind: 'area', x: 9, y: 1, w: 3, h: 48 },
    { id: 'z-chefe', name: 'Escritório do Chefe', kind: 'private', x: 1, y: 23, w: 7, h: 9, meeting: true },
    { id: 'z-descanso', name: 'Sala de Descanso', kind: 'area', x: 1, y: 33, w: 7, h: 8 },
    { id: 'z-arquivos', name: 'Área de Arquivos', kind: 'area', x: 1, y: 42, w: 7, h: 7 },
    { id: 'z-refeitorio', name: 'Refeitório', kind: 'area', x: 13, y: 22, w: 8, h: 27 },
    { id: 'z-jardim', name: 'Jardim Interno', kind: 'area', x: 23, y: 1, w: 18, h: 16 },
    { id: 'z-salao', name: 'Recepção', kind: 'area', x: 43, y: 1, w: 34, h: 16 },
    { id: 'z-escritorio', name: 'Escritório', kind: 'area', x: 23, y: 22, w: 20, h: 13 },
    { id: 'z-cabine-1', name: 'Cabine de foco A', kind: 'area', x: 44, y: 22, w: 5, h: 6 },
    { id: 'z-cabine-2', name: 'Cabine de foco B', kind: 'area', x: 44, y: 29, w: 5, h: 6 },
    { id: 'z-reuniao-a', name: 'Sala de reunião A', kind: 'private', x: 50, y: 22, w: 14, h: 13, meeting: true },
    { id: 'z-reuniao-b', name: 'Sala de reunião B', kind: 'private', x: 65, y: 22, w: 12, h: 13, meeting: true },
    { id: 'z-copa', name: 'Cafeteria', kind: 'area', x: 23, y: 39, w: 13, h: 10 },
    { id: 'z-leitura', name: 'Biblioteca', kind: 'area', x: 37, y: 39, w: 14, h: 10 },
    { id: 'z-auditorio', name: 'Auditório', kind: 'area', x: 52, y: 42, w: 25, h: 7 },
    { id: 'z-palco', name: 'Palco', kind: 'spotlight', x: 57, y: 39, w: 15, h: 3 },
    { id: 'z-calabouco', name: 'Calabouço (MvP)', kind: 'arena', x: 1, y: 51, w: 24, h: 32 },
    { id: 'z-terraco', name: 'Terraço', kind: 'area', x: 27, y: 50, w: 10, h: 5 },
    { id: 'z-bosque', name: 'Jardim Externo', kind: 'area', x: 27, y: 55, w: 50, h: 28 },
  );

  return { map: { width: W, height: H, floor, fg, fx, spawn: { x: 51, y: 14 }, version: 6 }, objects, zones };
}

export const MAP_VERSION = 6;
export { CAT };
