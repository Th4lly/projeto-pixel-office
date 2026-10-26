// Avatares no estilo Ragnarok: corpo da classe + cabelo + acessório de cabeça + arma + mascote.
// Tudo vem das folhas do RO na pasta de sprites (via catálogo).
//
// Direções das folhas: 0 = S (frente), 1 = SO, 2 = O (esquerda), 3 = NO, 4 = N (costas).
// "right" usa a esquerda espelhada.
import { CAT, IDX, drawFrame, image, onAssetLoad } from './assets.js';
import { RO_DIR, isLeftish, isRightish } from '../game/dirs.js';

const DIR = RO_DIR;
const NECK = 9; // sobreposição da cabeça sobre o pescoço, em pixels da folha

export const DEFAULT_AVATAR = { v: 2, gender: 'm', body: '', head: '', headgear: 'none', weapon: 'none', pet: 'none' };

export function bodiesFor(gender) {
  return CAT.bodies.filter((b) => b.gender === gender || b.gender === 'x');
}

export function headsFor(gender) {
  return CAT.heads.filter((h) => h.gender === gender);
}

function defaultBody(g) {
  const list = bodiesFor(g);
  return (list.find((b) => /novice|aprendiz/i.test(b.id + b.name)) || list[0] || CAT.bodies[0]).id;
}

function defaultHead(g) {
  return (headsFor(g)[0] || CAT.heads[0]).id;
}

export function normalizeAvatar(a) {
  const out = { ...DEFAULT_AVATAR };
  if (!CAT) return out;
  if (a && typeof a === 'object' && a.v === 2) {
    out.gender = a.gender === 'f' ? 'f' : 'm';
    if (IDX.bodies.has(a.body)) out.body = a.body;
    if (IDX.heads.has(a.head)) out.head = a.head;
    if (a.headgear === 'none' || IDX.headgears.has(a.headgear)) out.headgear = a.headgear || 'none';
    if (a.weapon === 'none' || IDX.weapons.has(a.weapon)) out.weapon = a.weapon || 'none';
    if (a.pet === 'none' || IDX.pets.has(a.pet)) out.pet = a.pet || 'none';
  }
  if (!out.body) out.body = defaultBody(out.gender);
  if (!out.head) out.head = defaultHead(out.gender);
  return out;
}

export function randomAvatar() {
  const g = Math.random() < 0.5 ? 'm' : 'f';
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  return normalizeAvatar({
    v: 2, gender: g, body: pick(bodiesFor(g)).id, head: pick(headsFor(g)).id,
    headgear: Math.random() < 0.4 ? pick(CAT.headgears).id : 'none', weapon: 'none', pet: 'none',
  });
}

export const PRESETS = [];

/** Quadro do corpo para a ação (sempre devolve algum quadro). */
function bodyFrame(body, action, dirIdx, t) {
  return pickFrame(body, action, dirIdx, t) || body.stand[dirIdx] || body.stand[0];
}

function pickFrame(body, action, dirIdx, t) {
  switch (action) {
    case 'walk': {
      const seq = body.walk[dirIdx] || body.walk[0];
      return seq && seq[Math.floor(t * 10) % seq.length];
    }
    case 'sit':
      return (body.sit || body.stand)[dirIdx];
    case 'attack': {
      const set = body.attack || body.walk;
      const seq = set[dirIdx] || set[0];
      return seq && seq[Math.min(seq.length - 1, Math.floor(t * 14))];
    }
    case 'dead':
      return body.dead;
    default:
      return body.stand[dirIdx];
  }
}

/**
 * Desenha o avatar com a base dos pés em (cx, by).
 * k = pixels de tela por pixel de mundo; o tamanho final aplica a escala da folha (sc).
 * Devolve o topo da cabeça (para nome e balões).
 */
export function drawAvatar(ctx, cfg, dir = 'down', action = 'stand', t = 0, cx = 0, by = 0, k = 1, alpha = 1) {
  const body = IDX.bodies.get(cfg.body) || CAT.bodies[0];
  const head = IDX.heads.get(cfg.head) || CAT.heads[0];
  if (!body) return by;
  const [d, flip] = DIR[dir] || DIR.down;
  const s = body.sc * k;
  const bf = bodyFrame(body, action, d, t);
  const dead = action === 'dead';
  // corpo
  drawFrame(ctx, body.s, bf, cx, by, s, flip, alpha);
  let top = by - bf[3] * s;
  if (dead) return top;
  // cabeça: base no topo do corpo + pescoço
  const hf = head.dirs[d] || head.dirs[0];
  const hs = head.sc * k;
  const hb = top + NECK * hs;
  const bob = action === 'walk' ? 0 : 0;
  drawFrame(ctx, head.s, hf, cx + (flip ? -1 : 1) * 0, hb + bob, hs, flip, alpha);
  const headTop = hb - hf[3] * hs;
  // acessório: centrado na cabeça, apoiado na metade de cima
  if (cfg.headgear && cfg.headgear !== 'none') {
    const hg = IDX.headgears.get(cfg.headgear);
    if (hg) {
      const seq = hg.anim && hg.anim.length > 5 ? null : null;
      const gf = seq || hg.dirs[d] || hg.dirs[0];
      const gs = hg.sc * k;
      const gb = headTop + Math.min(gf[3], hf[3] * 0.62) * gs + 2 * gs;
      drawFrame(ctx, hg.s, gf, cx, gb, gs, flip, alpha);
      top = Math.min(headTop, gb - gf[3] * gs);
      return top;
    }
  }
  return headTop;
}

/** Arma desenhada na mão durante o ataque (ícone girando, simples). */
export function drawWeapon(ctx, cfg, dir, cx, by, k, swing = 0) {
  if (!cfg.weapon || cfg.weapon === 'none') return;
  const w = IDX.weapons.get(cfg.weapon);
  if (!w || !image(w.s)) return;
  const [, flip] = DIR[dir] || DIR.down;
  const s = w.sc * k * 0.8;
  ctx.save();
  const side = isLeftish(dir) ? -1 : 1;
  ctx.translate(cx + side * 10 * k, by - 22 * k);
  ctx.rotate((side * (swing - 0.5) * Math.PI) / 1.6);
  drawFrame(ctx, w.s, w.icon, 0, 0, s, flip);
  ctx.restore();
}

/** Mascote andando ao lado (segue o dono com atraso). */
export function drawPet(ctx, cfg, dir, t, cx, by, k) {
  if (!cfg.pet || cfg.pet === 'none') return;
  const p = IDX.pets.get(cfg.pet);
  if (!p) return;
  const frames = p.idle && p.idle.length ? p.idle : p.frames;
  if (!frames || !frames.length) return;
  const f = frames[Math.floor(t * 6) % frames.length];
  const off = isLeftish(dir) ? 18 : -18;
  drawFrame(ctx, p.s, f, cx + off * k, by + 2 * k, p.sc * k * (p.sc >= 1 ? 0.75 : 1), isRightish(dir));
}

/** Miniatura (de frente, parado) num canvas. */
export function avatarThumb(cfg, size = 36, target) {
  const c = target || document.createElement('canvas');
  c.width = size;
  c.height = size;
  const paint = () => {
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const a = normalizeAvatar(cfg);
    // mostra do peito para cima: desenha grande e deixa os pés para fora
    const k = size / 46;
    drawAvatar(ctx, a, 'down', 'stand', 0, size / 2, size + size * 0.35, k);
  };
  paint();
  const off = onAssetLoad(() => { paint(); });
  setTimeout(off, 8000);
  return c;
}

/** Canvas com o avatar inteiro (editor, cartões). */
export function avatarPortrait(cfg, w = 96, h = 120, dir = 'down', action = 'stand', t = 0) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawAvatar(ctx, normalizeAvatar(cfg), dir, action, t, w / 2, h - 6, h / 80);
  return c;
}
