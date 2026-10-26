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
  ['chair', 'Cadeira', 'Interativos', 'sit', 'sentar', ['blue-chair-front', 'office-cadeira-giratoria-azul'], { w: 1, h: 1, sit: true }],
  ['chair_wood', 'Cadeira de madeira', 'Interativos', 'sit', 'sentar', ['chair-wood-chair-wood-s'], { w: 1, h: 1, sit: true }],
  ['stool', 'Banqueta', 'Interativos', 'sit', 'sentar', ['office-banqueta-vermelha'], { w: 1, h: 1, sit: true }],
  ['bench', 'Banco', 'Interativos', 'sit', 'sentar', ['bench-padded', 'office-banco-de-madeira'], { w: 2, h: 1, sit: true }],
  ['sofa', 'Sofá', 'Interativos', 'sit', 'sentar', ['loveseat-cream'], { w: 2, h: 1, sit: true }],
  ['armchair', 'Poltrona', 'Interativos', 'sit', 'sentar', ['armchair-terracotta', 'armchair-olive'], { w: 1, h: 1, sit: true }],
  ['throne', 'Trono', 'Interativos', 'sit', 'sentar no trono', ['armchair-olive', 'chaise-long'], { w: 1, h: 1, sit: true }],
  ['beanbag', 'Pufe', 'Interativos', 'sit', 'sentar', ['ottoman-small'], { w: 1, h: 1, sit: true }],
  ['table_round', 'Mesinha', 'Interativos', 'tea', 'servir um chá', ['table-round-walnut'], { w: 1, h: 1 }],
  ['table_long', 'Mesa de banquete', 'Interativos', 'feast', 'servir o banquete', ['office-mesa-baixa'], { w: 3, h: 1 }],
  ['meeting_table', 'Mesa de reunião', 'Interativos', 'meeting', 'abrir a sala (chamada, anexos, planilhas)', ['office-mesa-de-reuniao'], { w: 3, h: 3 }],
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
  ['npc', 'NPC', 'NPCs', 'npc', 'falar', [], { w: 1, h: 1, npc: true, desc: 'Personagem com função: guia, Kafra, mestre da arena, mercador, barista…' }],
  ['chart_board', 'Painel de gráficos', 'Interativos', 'chart', 'ver planilhas e gráficos', ['office-quadro-de-grafico'], { w: 2, h: 1 }],
];

function effectFrames(kind) {
  if (!CAT) return null;
  if (kind === 'portal') return findIn('effects', 'effects-portal-1', 'portal');
  if (kind === 'torch') return findIn('effects', 'effects-torch-1', 'torch');
  return null;
}

// Ação padrão de cada item do catálogo, pelo nome/categoria (todo móvel faz algo).
// [regex, interação, rótulo, luz?]
const RULES = [
  [/cadeira|chair|banqueta|stool|banco|bench|sof[aá]|namoradeira|loveseat|poltrona|armchair|pufe|ottoman|chaise|booth/i, 'sit', 'sentar'],
  [/cama|\bbed\b/i, 'rest', 'tirar um cochilo'],
  [/lumin[aá]ria|\blamp|abajur|vela|candle|torch|tocha|bonfire|fogueira|lareira|fireplace|furnace|forno/i, 'toggle', 'acender/apagar', { r: 3, color: 'rgba(255,200,120,0.3)' }],
  [/planta|plant|[aá]rvore|tree|flor|flower|vegeta|bush|arbusto|palmeira|palm|suculenta|succulent|cacto|cactus|folhagem|vaso/i, 'water', 'regar'],
  [/computador|computer|monitor|notebook|laptop|\btv\b|tela|screen|projetor|projector|painel de controle|control/i, 'screen', 'usar a tela (abrir site)'],
  [/estante|bookshelf|livro|book|biblioteca|prateleira|shelf/i, 'links', 'ver a estante de links'],
  [/arm[aá]rio|cabinet|guarda-roupa|wardrobe|c[oô]moda|dresser|ba[uú]|chest|caixa|\bbox\b|crate|caixote|gaveteiro|pedestal|arquivo|filing|credenza|aparador|barril|barrel/i, 'stash', 'abrir (guardar anotações)'],
  [/geladeira|fridge|refrigerator|caf[eé]|coffee|caneca|mug|x[ií]cara|copo|cup|bebedouro|water|garrafa|bottle|ch[aá]\b|tea|panela|\bpan\b|cozinha|meat|carne|fruta|apple|food|comida|bolo|cake|sopa/i, 'snack', 'comer/beber algo'],
  [/quadro de gr[aá]fico|gr[aá]fico|chart/i, 'chart', 'ver planilhas e gráficos'],
  [/quadro|painting|pintura|arte|artwork|moldura|frame|foto|photo|picture|poster|banner|estandarte/i, 'picture', 'apreciar o quadro'],
  [/quadro branco|whiteboard|prancheta|clipboard|lousa/i, 'board', 'abrir o quadro'],
  [/impressora|printer|copiadora|copier|fragmentadora|shredder/i, 'print', 'imprimir'],
  [/rel[oó]gio|clock/i, 'worldclock', 'ver os fusos horários'],
  [/porta|door/i, 'door', 'abrir/fechar'],
  [/janela|window|cortina|curtain/i, 'window', 'olhar pela janela'],
  [/telefone|phone/i, 'phone', 'ligar'],
  [/moeda|coin|joia|gem|tesouro|treasure|item \d|loot|po[cç][aã]o|potion|chave|key/i, 'pickup', 'pegar'],
  [/fone|headphone/i, 'jukebox', 'ouvir música'],
  [/mesa|table|desk|balc[aã]o|counter/i, 'table', 'usar a mesa'],
  [/gato|cat|cachorro|dog|pet|sapo|frog|porco|pig|p[aá]ssaro|bird/i, 'pet', 'fazer carinho'],
  [/esta[cç][aã]o|anvil|bigorna|workbench|alchemy|alquimia|sawmill|serraria|cooker|grill|butchery/i, 'craft', 'trabalhar na estação'],
];

export function inferInteract(p) {
  const text = `${p.name} ${p.cat} ${p.id}`;
  if (p.interact === 'projector') return { interact: 'present', label: 'apresentar (compartilhar tela)' };
  if (p.interact) return { interact: p.interact, label: p.interact === 'chart' ? 'ver planilhas e gráficos' : 'usar' };
  if (p.kind === 'slot') return { interact: 'arcade', label: 'jogar' };
  if (p.sit) return { interact: 'sit', label: 'sentar' };
  if (p.desk) return { interact: 'desk', label: 'abrir a mesa' };
  for (const [re, interact, label, light] of RULES) if (re.test(text)) return { interact, label, light };
  if (p.small) return { interact: 'pickup', label: 'pegar' };
  return { interact: 'examine', label: 'examinar' };
}

/** Para onde a arte original está virada (cadeiras de costas encaram a mesa: 180°). */
function skinFace(p) {
  if (p.rot) return p.rot.s ? 0 : KEY_ANGLE[Object.keys(p.rot)[0]] ?? 0;
  if (/cadeira-(preta|vermelha|verde)$|cadeira-de-reuniao-escura|chair-task|chair-visitor|chair-meeting/.test(p.id)) return 180;
  if (/cadeira-de-reuniao-lado/.test(p.id)) return 270;
  return 0;
}

export function buildObjects() {
  for (const k of Object.keys(OBJECTS)) delete OBJECTS[k];
  const cats = new Set(['Interativos', 'NPCs', 'Arena', 'Meus objetos']);
  for (const [type, name, cat, interact, label, skins, extra] of FUNCTIONAL) {
    const skin = skins.length ? findProp(...skins) : null;
    const fx = extra.effect ? effectFrames(extra.effect) : null;
    OBJECTS[type] = {
      name, cat, interact, label, desc: extra.desc || '', functional: true,
      w: extra.w || (skin ? skin.w : 1), h: extra.h || (skin ? skin.h : 1),
      solid: !(extra.walk || extra.flat || extra.door), sit: !!extra.sit, flat: !!extra.flat, walk: !!extra.walk,
      door: !!extra.door, light: extra.light || null, wall: !!extra.wall, desk: !!extra.desk, npc: !!extra.npc,
      skin, fx, __type: type, face: extra.face ?? (skin ? skinFace(skin) : 0),
      rot: skin && skin.rot ? skin.rot : null,
    };
  }
  for (const p of CAT.props) {
    cats.add(p.cat);
    const flat = p.kind === 'flat';
    const act = inferInteract(p);
    const sits = !!p.sit || act.interact === 'sit';
    OBJECTS[p.id] = {
      name: p.name, cat: p.cat, w: p.w, h: p.h, skin: p,
      solid: !!p.solid && !flat, sit: sits, flat, walk: flat || !!p.small, small: !!p.small, wall: !!p.wall,
      light: p.light || act.light || null, desk: !!p.desk,
      interact: act.interact, label: act.label,
      variants: p.variants || null, rot: p.rot || null, __type: p.id, face: skinFace(p),
    };
    if (OBJECTS[p.id].sit) { OBJECTS[p.id].solid = false; OBJECTS[p.id].walk = true; }
  }
  OBJECT_CATEGORIES = [...cats];
}

// ---------------------------------------------------------------- rotação
// o.rot = para onde o móvel está virado (graus, horário a partir de "para baixo"; ver game/dirs.js).
// Arte direcional (cadeiras do café, cadeiras de escritório) é usada quando existe;
// senão o sprite é girado e a área no chão acompanha.
export const KEY_ANGLE = { s: 0, sw: 45, w: 90, nw: 135, n: 180, ne: 225, e: 270, se: 315 };

const norm = (a) => ((Math.round(a) % 360) + 360) % 360;

/** Ângulo nativo da arte (para onde ela já está virada). */
export function nativeFace(def) {
  if (def.face !== undefined) return def.face;
  return 0;
}

export function rotOf(o, def = OBJECTS[o.type]) {
  if (o.rot === undefined || o.rot === null || o.rot === '') return def ? nativeFace(def) : 0;
  if (typeof o.rot === 'string') return KEY_ANGLE[o.rot] ?? 0;
  return norm(o.rot);
}

/** Melhor arte direcional para o ângulo e quanto falta girar. */
function pickRot(def, angle) {
  if (!def.rot) return { art: null, rest: norm(angle - nativeFace(def)) };
  let best = null;
  let bd = 999;
  for (const [k, v] of Object.entries(def.rot)) {
    const a = KEY_ANGLE[k];
    if (a === undefined) continue;
    const d = Math.abs(((angle - a + 540) % 360) - 180);
    if (d < bd) { bd = d; best = { art: v, a }; }
  }
  if (!best) return { art: null, rest: norm(angle - nativeFace(def)) };
  return { art: best.art, rest: bd <= 22 ? 0 : norm(angle - best.a) };
}

/** Área no chão (tiles) do objeto, já girada. */
export function dims(o, def = OBJECTS[o && o.type]) {
  if (!def) return { w: 1, h: 1 };
  const { rest } = pickRot(def, rotOf(o, def));
  if (!rest || def.wall) return { w: def.w, h: def.h };
  const r = (rest * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const sn = Math.abs(Math.sin(r));
  return { w: Math.max(1, Math.round(def.w * c + def.h * sn)), h: Math.max(1, Math.round(def.w * sn + def.h * c)) };
}

/** Altura do desenho em tiles (para luz, badges e o "ah" antigo). */
export function objectHeight(def) {
  if (def.fx) return 1.6;
  if (!def.skin) return 1;
  return (def.skin.f[3] * fitScale(def)) / TILE;
}

/** Escala: interativos se ajustam à largura pedida; itens do catálogo não passam da largura da área (alinhamento na grade). */
export function fitScale(def, f = def.skin && def.skin.f) {
  const s = def.skin;
  if (!s) return 1;
  const nat = f[2] * s.sc;
  const want = def.w * TILE;
  if (!def.functional) return nat > want * 1.08 ? s.sc * ((want * 1.04) / nat) : s.sc;
  return s.sc * Math.min(1.6, Math.max(0.4, (want * 0.98) / nat));
}

/** Desenha o objeto com a base no fundo da área (x0, y0 em px de tela do canto do tile; k = px de tela por px de mundo). */
export function drawObjectSprite(ctx, o, def, x0, y0, k, t = 0, alpha = 1) {
  const dm = dims(o, def);
  // ajuste fino (meio tile) para alinhar, p. ex., cadeira no centro de uma mesa de 2 tiles
  if (o.data && (o.data.ox || o.data.oy)) { x0 += (o.data.ox || 0) * k; y0 += (o.data.oy || 0) * k; }
  const cx = x0 + (dm.w * TILE * k) / 2;
  const by = y0 + dm.h * TILE * k - (def.flat ? 0 : 2 * k);
  if (def.npc) return drawNpc(ctx, o, cx, by, k, t, alpha);
  if (def.fx) {
    const fr = frameAt(def.fx.frames, t, 10);
    const on = !(def.interact === 'toggle') || (o.state && o.state.on);
    drawFrame(ctx, def.fx.s, def.interact === 'toggle' && !on ? def.fx.frames[0] : fr, cx, by, def.fx.sc * k * 0.9, false, (def.interact === 'toggle' && !on ? 0.35 : 1) * alpha);
    return true;
  }
  const s = def.skin;
  if (!s) {
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(x0, y0, dm.w * TILE * k, dm.h * TILE * k);
    return false;
  }
  let sid = s.s;
  let f = s.f;
  // variações de cor (móveis nobres)
  if (def.variants && o.color && def.variants[o.color]) ({ s: sid, f } = def.variants[o.color]);
  const { art, rest } = pickRot(def, rotOf(o, def));
  if (art) ({ s: sid, f } = art);
  if (!art && s.frames && s.frames.length > 1) f = frameAt(s.frames, t + (o.x || 0) * 0.13, 8);
  if (s.alt && o.state && (o.state.on || o.state.open)) sid = s.alt.s;
  if (s.custom) sid = s.s;
  const sc = fitScale(def, art ? f : s.f) * k;
  if (!rest) return drawFrame(ctx, sid, f, cx, by, sc, !!o.flip, alpha);
  // gira em volta do centro da área no chão
  const cy = y0 + (dm.h * TILE * k) / 2;
  const fh = f[3] * sc;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rest * Math.PI) / 180);
  // a base do sprite fica no meio da área original (sem girar), centrada
  const ok = drawFrame(ctx, sid, f, 0, Math.min(fh / 2, (def.h * TILE * k) / 2) , sc, !!o.flip, alpha);
  ctx.restore();
  return ok;
}

/** Quadros do NPC (sprite escolhido do catálogo). */
export function npcFrames(o) {
  const id = (o.data && o.data.sprite) || '';
  const n = IDX.npcs.get(id) || CAT.npcs.find((x) => x.group === 'NPC regional') || CAT.npcs[0];
  if (!n) return null;
  if (n.anims) {
    const a = n.anims['idle-down'] || n.anims.idle || n.anims.idle_down || Object.values(n.anims)[0];
    return { s: a.s ?? n.s, frames: a.frames, sc: n.sc || 1 };
  }
  return { s: n.s, frames: n.frames, sc: n.sc || 1 };
}

function drawNpc(ctx, o, cx, by, k, t, alpha) {
  const a = npcFrames(o);
  if (!a || !a.frames.length) return false;
  // NPCs do RO: a sequência costuma ter várias direções; usa só os primeiros quadros (parado, de frente)
  const seq = a.frames.length > 8 ? a.frames.slice(0, 1) : a.frames;
  const f = frameAt(seq, t + (o.x || 0) * 0.37, 4);
  ctx.fillStyle = 'rgba(20,10,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, by - 1 * k, 9 * k, 3 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  const sc = Math.min(a.sc, (TILE * 1.9) / f[3]) * k;
  return drawFrame(ctx, a.s, f, cx, by, sc, !!o.flip, alpha);
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
    if (def.npc) {
      const a = npcFrames({ data: {} });
      if (!a) return true;
      const f = a.frames[0];
      const k = Math.min((size - 4) / f[2], (size - 4) / f[3]);
      return drawFrame(ctx, a.s, f, size / 2, size / 2 + (f[3] * k) / 2, k);
    }
    if (!def.skin && !def.fx) return true;
    const src = def.fx ? { s: def.fx.s, f: def.fx.frames[0] } : def.skin ? (def.skin.hd ? null : def.skin) : null;
    const sid = src ? src.s : def.skin.hd.s;
    const f = src ? src.f : def.skin.f.map((v) => v * def.skin.hd.k);
    const k = Math.min((size - 4) / f[2], (size - 4) / f[3]);
    return drawFrame(ctx, sid, f, size / 2, size / 2 + (f[3] * k) / 2, k);
  };
  if (!paint()) import('./assets.js').then(({ onAssetLoad }) => { const off = onAssetLoad(() => { if (paint()) off(); }); });
  return c;
}
