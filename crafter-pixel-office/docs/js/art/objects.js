// Catálogo de objetos do mapa.
// • Todo item da pasta de sprites (catálogo) vira um objeto colocável.
// • Os objetos "interativos" (mesa, quadro de quests, portal, arena…) usam um desses
//   sprites como visual ("skin") e ganham a interação.
// w/h = área no chão (tiles) · solid = bloqueia · sit = dá para sentar · flat = no chão
// walk = dá para pisar · light = brilha · small = pode ficar em cima de mesas
import { CAT, IDX, drawFrame, findProp, findIn, frameAt, TILE } from './assets.js';

export const OBJECTS = {};
export let OBJECT_CATEGORIES = [];

// [tipo, nome, categoria, interação, rótulo, skins (trechos de id, em ordem de preferência), extras]
const FUNCTIONAL = [
  ['desk', 'Mesa de trabalho', 'Interativos', 'desk', 'abrir a mesa', ['office-mesa-com-pc-1'], { w: 2, h: 1, desk: true, desc: 'Mesa pessoal: reivindique, decore e ligue para alguém daqui.' }],
  ['desk_pc', 'Mesa com computador', 'Interativos', 'desk', 'abrir a mesa', ['office-mesa-com-pc-3'], { w: 2, h: 1, desk: true }],
  ['desk_magic', 'Mesa nobre', 'Interativos', 'desk', 'abrir a mesa', ['desk-large-chair'], { w: 2, h: 1, desk: true }],
  ['chair', 'Cadeira', 'Interativos', 'sit', 'sentar', ['office-cadeira-giratoria-azul'], { w: 1, h: 1, sit: true }],
  ['stool', 'Banqueta', 'Interativos', 'sit', 'sentar', ['office-banqueta-vermelha'], { w: 1, h: 1, sit: true }],
  ['bench', 'Banco', 'Interativos', 'sit', 'sentar', ['bench-padded', 'office-banco-de-madeira'], { w: 2, h: 1, sit: true }],
  ['sofa', 'Sofá', 'Interativos', 'sit', 'sentar', ['loveseat-cream'], { w: 2, h: 1, sit: true }],
  ['armchair', 'Poltrona', 'Interativos', 'sit', 'sentar', ['armchair-terracotta', 'armchair-olive'], { w: 1, h: 1, sit: true }],
  ['throne', 'Trono', 'Interativos', 'sit', 'sentar no trono', ['armchair-olive', 'chaise-long'], { w: 1, h: 1, sit: true }],
  ['beanbag', 'Pufe', 'Interativos', 'sit', 'sentar', ['ottoman-small'], { w: 1, h: 1, sit: true }],
  ['table_round', 'Mesinha', 'Interativos', 'tea', 'servir um chá', ['table-round-walnut'], { w: 1, h: 1 }],
  ['table_long', 'Mesa de banquete', 'Interativos', 'feast', 'servir o banquete', ['office-mesa-baixa'], { w: 3, h: 1 }],
  ['meeting_table', 'Mesa de reunião', 'Interativos', 'meeting', 'abrir a sala (chamada, anexos, planilhas)', ['office-mesa-de-reuniao'], { w: 4, h: 2 }],
  ['bed', 'Cama', 'Interativos', 'rest', 'tirar um cochilo', ['bed-double'], { w: 2, h: 2 }],
  ['bookshelf', 'Estante', 'Interativos', 'links', 'abrir a biblioteca de links', ['furniturestate1-png-12', 'office-estante-de-pastas'], { w: 1, h: 1 }],
  ['wardrobe', 'Guarda-roupa', 'Interativos', 'wardrobe', 'trocar de roupa', ['furniturestate1-png-7', 'office-guarda-roupa-duplo-1'], { w: 1, h: 1 }],
  ['chest', 'Baú', 'Interativos', 'stash', 'abrir o baú (bloco de notas)', ['coins-chests-etc-2-0-noborders-png-60', 'coins-chests'], { w: 1, h: 1 }],
  ['counter', 'Balcão', 'Interativos', 'drink', 'pedir uma bebida', ['counter-reception-curved'], { w: 2, h: 1 }],
  ['potion_shelf', 'Prateleira de poções', 'Interativos', 'potion', 'tomar uma poção', ['esoteric-png-56', 'esoteric'], { w: 1, h: 1 }],
  ['cauldron', 'Caldeirão', 'Interativos', 'soup', 'pegar uma sopa', ['pan-png-11', 'pan'], { w: 1, h: 1 }],
  ['plant', 'Vaso de planta', 'Interativos', 'water', 'regar a planta', ['office-planta-no-vaso-de-barro'], { w: 1, h: 1 }],
  ['plant_big', 'Palmeira', 'Interativos', 'water', 'regar a planta', ['office-palmeira-1'], { w: 1, h: 1 }],
  ['tree', 'Árvore', 'Interativos', 'water', 'regar a árvore', ['model-01-size-03-png-1', 'trees'], { w: 2, h: 1 }],
  ['flowers', 'Vaso de flores', 'Interativos', 'water', 'regar as flores', ['office-vaso-de-flores'], { w: 1, h: 1 }],
  ['bush', 'Arbusto', 'Interativos', 'water', 'regar o arbusto', ['vegetation-png-2', 'vegetation'], { w: 1, h: 1 }],
  ['rug', 'Tapete', 'Interativos', 'inspect', 'olhar o tapete', ['furniturestate1-png-24', 'rug'], { w: 3, h: 2, flat: true, walk: true }],
  ['rug_round', 'Tapete redondo', 'Interativos', 'inspect', 'olhar o tapete', ['rug-round-autumn'], { w: 3, h: 3, flat: true, walk: true }],
  ['banner', 'Estandarte', 'Interativos', 'inspect', 'ler o estandarte', ['dungeon-props-png-15'], { w: 1, h: 1 }],
  ['painting', 'Quadro', 'Interativos', 'inspect', 'apreciar o quadro', ['office-quadro-de-paisagem'], { w: 1, h: 1, wall: true }],
  ['statue', 'Estátua do herói', 'Interativos', 'leaderboard', 'ver os heróis (ranking de XP)', ['dungeon-props-png-3'], { w: 1, h: 1 }],
  ['trophy', 'Estante de troféus', 'Interativos', 'leaderboard', 'ver os troféus (ranking)', ['shelf-glass'], { w: 1, h: 1 }],
  ['barrel', 'Barril', 'Interativos', 'drink', 'tirar um suco do barril', ['furniture-png-6', 'barrel'], { w: 1, h: 1 }],
  ['crate', 'Caixote', 'Interativos', 'loot', 'abrir o caixote', ['resources-png-18', 'resources-png-19'], { w: 1, h: 1 }],
  ['torch', 'Tocha', 'Interativos', 'toggle', 'acender/apagar', [], { w: 1, h: 1, effect: 'torch', light: { r: 3.2, color: 'rgba(255,160,70,0.35)' } }],
  ['candelabra', 'Candelabro', 'Interativos', 'toggle', 'acender/apagar', [], { w: 1, h: 1, effect: 'torch', light: { r: 3, color: 'rgba(255,190,90,0.33)' } }],
  ['lamp', 'Luminária', 'Interativos', 'toggle', 'acender/apagar', ['office-luminaria-de-chao'], { w: 1, h: 1, light: { r: 3.4, color: 'rgba(255,214,130,0.3)' } }],
  ['fireplace', 'Lareira', 'Interativos', 'toggle', 'acender/apagar a lareira', ['furniturestate1-png-18'], { w: 2, h: 1, light: { r: 4.5, color: 'rgba(255,140,60,0.32)' } }],
  ['fountain', 'Fonte dos desejos', 'Interativos', 'wish', 'jogar uma moeda e fazer um desejo', ['summer-waterfall'], { w: 2, h: 2 }],
  ['signpost', 'Placa', 'Interativos', 'inspect', 'ler a placa', ['clipboard-blank', 'frame-photo-blank'], { w: 1, h: 1 }],
  ['clock', 'Relógio Pomodoro', 'Interativos', 'pomodoro', 'iniciar um pomodoro', ['furniturestate1-png-9', 'clock-tall'], { w: 1, h: 1 }],
  ['globe', 'Globo', 'Interativos', 'worldclock', 'ver os fusos horários', ['clock-wall'], { w: 1, h: 1 }],
  ['column', 'Coluna', 'Interativos', 'inspect', 'examinar a coluna', ['dungeon-props-png-16'], { w: 1, h: 1 }],
  ['window', 'Janela', 'Interativos', 'inspect', 'olhar pela janela', ['office-janela-1'], { w: 2, h: 1, wall: true }],
  ['whiteboard', 'Quadro branco', 'Interativos', 'board', 'abrir o quadro (desenhar / Miro)', ['office-quadro-de-grafico'], { w: 2, h: 1 }],
  ['notice_board', 'Mural de avisos', 'Interativos', 'mural', 'ler o mural de avisos', ['frame-photo-blank', 'clipboard'], { w: 1, h: 1 }],
  ['quest_board', 'Quadro de quests', 'Interativos', 'quests', 'abrir o quadro de quests', ['office-tela-de-projecao'], { w: 2, h: 1 }],
  ['tv', 'Tela de vídeo', 'Interativos', 'tv', 'ligar a tela / assistir', ['monitor-single'], { w: 1, h: 1, light: { r: 2.6, color: 'rgba(120,180,255,0.22)' } }],
  ['projector', 'Projetor', 'Interativos', 'present', 'apresentar (compartilhar tela)', ['office-projetor-na-mesa'], { w: 2, h: 1 }],
  ['podium', 'Púlpito (palco)', 'Interativos', 'spotlight', 'saber como falar para todos', ['control-panel'], { w: 1, h: 1 }],
  ['printer', 'Impressora', 'Interativos', 'print', 'imprimir', ['office-copiadora-1'], { w: 2, h: 1 }],
  ['mailbox', 'Caixa de notificações', 'Interativos', 'feed', 'ver notificações', ['archive-box'], { w: 1, h: 1 }],
  ['server', 'Servidor', 'Interativos', 'feed', 'ver status / notificações', ['computer-tower'], { w: 1, h: 1 }],
  ['calendar', 'Calendário', 'Interativos', 'calendar', 'ver minha agenda', ['office-quadrinho'], { w: 1, h: 1, wall: true }],
  ['water', 'Bebedouro', 'Interativos', 'water_drink', 'beber água', ['office-bebedouro-1'], { w: 1, h: 1 }],
  ['coffee', 'Cafeteira', 'Interativos', 'coffee', 'pegar um café', ['office-mesinha-com-livros'], { w: 1, h: 1 }],
  ['fridge', 'Geladeira', 'Interativos', 'snack', 'pegar um lanche', ['office-geladeira'], { w: 1, h: 1 }],
  ['portal', 'Portal de teletransporte', 'Interativos', 'portal', 'entrar no portal', [], { w: 1, h: 1, walk: true, effect: 'portal', light: { r: 2.2, color: 'rgba(120,200,255,0.30)', always: true } }],
  ['door', 'Porta', 'Interativos', 'door', 'abrir/fechar a porta', ['opendoors-png-1', 'doorsandwindows-png-2'], { w: 1, h: 1, door: true }],
  ['piano', 'Piano', 'Interativos', 'piano', 'tocar piano', ['furniturestate1-png-34'], { w: 2, h: 1 }],
  ['arcade', 'Fliperama (caça-níquel)', 'Interativos', 'arcade', 'jogar no fliperama', ['slot-machine'], { w: 1, h: 1, light: { r: 1.8, color: 'rgba(170,120,255,0.22)', always: true } }],
  ['game_table', 'Mesa de jogos', 'Interativos', 'tictactoe', 'jogar jogo da velha', ['table-round-walnut'], { w: 1, h: 1 }],
  ['jukebox', 'Jukebox', 'Interativos', 'jukebox', 'escolher a música', ['ups'], { w: 1, h: 1, light: { r: 2, color: 'rgba(255,120,200,0.2)', always: true } }],
  ['dummy', 'Boneco de treino', 'Interativos', 'dummy', 'bater no boneco (alivia o estresse)', ['dungeon-props-png-1'], { w: 1, h: 1 }],
  ['phone', 'Telefone da sala', 'Interativos', 'phone', 'ligar desta sala', ['office-mesinha-com-pastas'], { w: 1, h: 1, desc: 'Faz chamadas para quem você escolher, a partir desta sala.' }],
  ['arena_gate', 'Portão da arena', 'Arena', 'arena', 'ver as regras da arena', ['buildings-props-png-2'], { w: 2, h: 1 }],
  ['mob_spawner', 'Covil de monstros', 'Arena', 'spawner', 'invocar monstros', ['dungeon-props-png-3'], { w: 1, h: 1, desc: 'Gera monstros do bestiário d20 dentro da arena.' }],
  ['notion_board', 'Quadro do Notion', 'Interativos', 'notion', 'abrir o board do Notion', ['office-quadro-de-grafico'], { w: 2, h: 1 }],
  ['chart_board', 'Painel de gráficos', 'Interativos', 'chart', 'ver planilhas e gráficos', ['office-quadro-de-grafico'], { w: 2, h: 1 }],
];

function effectFrames(kind) {
  if (!CAT) return null;
  if (kind === 'portal') return findIn('effects', 'effects-portal-1', 'portal');
  if (kind === 'torch') return findIn('effects', 'effects-torch-1', 'torch');
  return null;
}

export function buildObjects() {
  for (const k of Object.keys(OBJECTS)) delete OBJECTS[k];
  const cats = new Set(['Interativos', 'Arena']);
  for (const [type, name, cat, interact, label, skins, extra] of FUNCTIONAL) {
    const skin = skins.length ? findProp(...skins) : null;
    const fx = extra.effect ? effectFrames(extra.effect) : null;
    OBJECTS[type] = {
      name, cat, interact, label, desc: extra.desc || '', functional: true,
      w: extra.w || (skin ? skin.w : 1), h: extra.h || (skin ? skin.h : 1),
      solid: !(extra.walk || extra.flat || extra.door), sit: !!extra.sit, flat: !!extra.flat, walk: !!extra.walk,
      door: !!extra.door, light: extra.light || null, wall: !!extra.wall, desk: !!extra.desk,
      skin, fx,
    };
  }
  for (const p of CAT.props) {
    cats.add(p.cat);
    const flat = p.kind === 'flat';
    OBJECTS[p.id] = {
      name: p.name, cat: p.cat, w: p.w, h: p.h, skin: p,
      solid: !!p.solid && !flat, sit: !!p.sit, flat, walk: flat || !!p.small, small: !!p.small, wall: !!p.wall,
      light: p.light || null, desk: !!p.desk,
      interact: p.interact === 'projector' ? 'present' : p.interact || (p.sit ? 'sit' : p.kind === 'slot' ? 'arcade' : 'inspect'),
      label: p.sit ? 'sentar' : p.interact === 'chart' ? 'ver planilhas e gráficos' : p.interact === 'projector' ? 'apresentar (compartilhar tela)' : 'olhar',
      variants: p.variants || null, rot: p.rot || null,
    };
  }
  OBJECT_CATEGORIES = [...cats];
}

/** Altura do desenho em tiles (para luz, badges e o "ah" antigo). */
export function objectHeight(def) {
  if (def.fx) return 1.6;
  if (!def.skin) return 1;
  return (def.skin.f[3] * fitScale(def)) / TILE;
}

/** Escala para o sprite caber na largura da área do objeto. */
export function fitScale(def) {
  const s = def.skin;
  if (!s) return 1;
  if (!def.functional) return s.sc;
  // interativos: ajusta à largura pedida, sem passar de 1.6x a escala natural
  const want = def.w * TILE * 0.98;
  const nat = s.f[2] * s.sc;
  return s.sc * Math.min(1.6, Math.max(0.4, want / nat));
}

/** Desenha o objeto com a base no fundo da área (x0, y0 em px de tela do canto do tile; k = px de tela por px de mundo). */
export function drawObjectSprite(ctx, o, def, x0, y0, k, t = 0, alpha = 1) {
  const cx = x0 + (def.w * TILE * k) / 2;
  const by = y0 + def.h * TILE * k - (def.flat ? 0 : 2 * k);
  if (def.fx) {
    const fr = frameAt(def.fx.frames, t, 10);
    const on = !(def.interact === 'toggle') || (o.state && o.state.on);
    if (def.interact === 'toggle' && !on) {
      drawFrame(ctx, def.fx.s, def.fx.frames[0], cx, by, def.fx.sc * k * 0.9, false, 0.35 * alpha);
    } else {
      drawFrame(ctx, def.fx.s, fr, cx, by, def.fx.sc * k * 0.9, false, alpha);
    }
    return true;
  }
  const s = def.skin;
  if (!s) {
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(x0, y0, def.w * TILE * k, def.h * TILE * k);
    return false;
  }
  let sid = s.s;
  let f = s.f;
  // variações de cor (móveis nobres) e direção (móveis giratórios)
  if (def.variants && o.color && def.variants[o.color]) ({ s: sid, f } = def.variants[o.color]);
  if (def.rot && o.rot && def.rot[o.rot]) ({ s: sid, f } = def.rot[o.rot]);
  if (s.frames && s.frames.length > 1) f = frameAt(s.frames, t + (o.x || 0) * 0.13, 8);
  if (s.alt && o.state && (o.state.on || o.state.open)) sid = s.alt.s;
  const sc = fitScale(def) * k;
  let flip = false;
  if (o.flip) flip = true;
  return drawFrame(ctx, sid, f, cx, by, sc, flip, alpha);
}

/** Miniatura de um tipo de objeto (canvas). */
export function objectThumb(type, size = 40) {
  const def = OBJECTS[type];
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const paint = () => {
    ctx.clearRect(0, 0, size, size);
    if (!def) return true;
    const src = def.fx ? { s: def.fx.s, f: def.fx.frames[0] } : def.skin ? (def.skin.hd ? null : def.skin) : null;
    const sid = src ? src.s : def.skin.hd.s;
    const f = src ? src.f : def.skin.f.map((v) => v * def.skin.hd.k);
    const k = Math.min((size - 4) / f[2], (size - 4) / f[3]);
    return drawFrame(ctx, sid, f, size / 2, size / 2 + (f[3] * k) / 2, k);
  };
  if (!paint()) import('./assets.js').then(({ onAssetLoad }) => { const off = onAssetLoad(() => { if (paint()) off(); }); });
  return c;
}
