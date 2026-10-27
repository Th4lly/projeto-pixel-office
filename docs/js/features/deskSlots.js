// Mesa pessoal v6: computador escolhido + 7 espaços (slots) de decoração em cima da mesa.
// Todas as posições são relativas ao tampo da mesa LPC (58×35 px, tampo nas 17 linhas de cima),
// e cada item é reduzido para caber no seu espaço — assim tudo fica na mesma escala da mesa.
import { OBJECTS, drawObjectSprite, fitScale } from '../art/objects.js';
import { TILE } from '../art/assets.js';

// [dx a partir do centro da mesa, base (y) a partir do pé do sprite, largura máx., altura máx., nome]
export const SLOTS = [
  [-21, -27, 12, 17, 'Fundo à esquerda'],
  [21, -27, 12, 17, 'Fundo à direita'],
  [-16, -21, 9, 12, 'Meio à esquerda'],
  [16, -21, 9, 12, 'Meio à direita'],
  [-25, -19, 7, 10, 'Canto da frente esq.'],
  [25, -19, 7, 10, 'Canto da frente dir.'],
  [0, -18, 8, 7, 'Frente (centro)'],
];
export const MAX_SLOTS = SLOTS.length;

export const PCS = {
  monitor: 'Monitor',
  duplo: 'Dois monitores',
  ultrawide: 'Monitor ultrawide',
  imac: 'All-in-one branco',
  notebook: 'Notebook',
  gamer: 'PC gamer (RGB)',
  crt: 'Computador retrô',
  nenhum: 'Sem computador',
};

/** Configuração da mesa (computador e privacidade) — guardada como 1º item "meta" da lista de decoração. */
export function deskMeta(desk) {
  const list = (desk && desk.data && Array.isArray(desk.data.decor)) ? desk.data.decor : [];
  const m = list.find((d) => d && d.meta) || {};
  return { pc: m.pc || 'monitor', private: m.private !== false && (desk && desk.data ? desk.data.private !== false : true) };
}

export function slotItems(desk) {
  const list = (desk && desk.data && Array.isArray(desk.data.decor)) ? desk.data.decor : [];
  return list.filter((d) => d && !d.meta && Number.isInteger(d.slot) && d.slot >= 0 && d.slot < MAX_SLOTS);
}

/** Escala para o item caber no espaço (nunca aumenta). */
export function slotScale(type, slot) {
  const def = OBJECTS[type];
  if (!def || !def.skin) return 1;
  const ws = fitScale(def);
  const f = def.skin.f;
  const [, , mw, mh] = SLOTS[slot];
  return Math.min(1, mw / (f[2] * ws), mh / (f[3] * ws));
}

function px(ctx, X, BY, k) {
  return (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x * k, BY + y * k, w * k, h * k); };
}

function screen(r, x, y, w, h, t, glow = '#3a6fd8') {
  r(x, y, w, h, '#16182a');
  r(x + 1, y + 1, w - 2, h - 2, glow);
  r(x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,.25)');
  // "código" correndo
  const lines = Math.max(1, Math.floor((h - 3) / 2));
  for (let i = 0; i < lines; i++) {
    const lw = 2 + ((i * 7 + Math.floor(t * 2)) % Math.max(2, w - 5));
    r(x + 2, y + 2 + i * 2, Math.min(lw, w - 4), 1, i % 3 === 0 ? '#ffd84d' : '#bfe3ff');
  }
}

function keyboard(r) {
  r(-7, -23, 14, 3, '#2b2d3c');
  r(-6, -23, 12, 1, '#5b5e75');
  r(-6, -22, 12, 1, '#44475a');
  r(9, -23, 2, 2, '#d8dbe8');
  r(9, -23, 2, 1, '#ffffff');
}

/** Desenha o computador na mesa. cx/by: centro e pé do sprite da mesa (px de tela); k: zoom. */
export function drawPc(ctx, pc, cx, by, k, t = 0) {
  const r = px(ctx, cx, by, k);
  switch (pc) {
    case 'nenhum':
      return;
    case 'duplo':
      r(-1, -27, 2, 3, '#3a3c4e'); r(-5, -25, 10, 1, '#2b2d3c');
      screen(r, -16, -39, 15, 12, t);
      screen(r, 1, -39, 15, 12, t + 3, '#2f8f6a');
      keyboard(r);
      return;
    case 'ultrawide':
      r(-1, -27, 2, 3, '#3a3c4e'); r(-5, -25, 10, 1, '#2b2d3c');
      screen(r, -15, -38, 30, 11, t);
      keyboard(r);
      return;
    case 'imac':
      r(-2, -27, 4, 3, '#c9ccd8'); r(-5, -25, 10, 1, '#aeb2c2');
      r(-10, -41, 20, 15, '#eef0f6');
      screen(r, -9, -40, 18, 11, t, '#5d8ff0');
      r(-1, -28, 2, 1, '#9da1b3');
      r(-7, -23, 14, 3, '#e7e9f0'); r(-6, -23, 12, 1, '#ffffff');
      r(9, -23, 2, 2, '#ffffff');
      return;
    case 'notebook':
      r(-9, -35, 18, 11, '#3b3f52');
      screen(r, -8, -34, 16, 9, t);
      r(-10, -24, 20, 3, '#9aa0b4'); r(-9, -24, 18, 1, '#c7cbd8');
      r(-3, -22, 6, 1, '#7d8296');
      return;
    case 'gamer': {
      r(-1, -27, 2, 3, '#3a3c4e'); r(-5, -25, 10, 1, '#2b2d3c');
      screen(r, -11, -40, 22, 13, t, '#7b3fd8');
      // gabinete com RGB do lado
      const hue = (t * 80) % 360;
      r(14, -38, 8, 14, '#1d1f2b'); r(15, -37, 6, 12, '#2b2e40');
      ctx.fillStyle = `hsl(${hue},90%,60%)`; ctx.fillRect(cx + 15 * k, by - 37 * k, 1 * k, 12 * k);
      ctx.fillRect(cx + (-7) * k, by - 20 * k, 14 * k, 1 * k);
      r(-7, -23, 14, 3, '#1d1f2b'); r(-6, -23, 12, 1, '#3d4054');
      r(9, -23, 2, 2, '#1d1f2b');
      return;
    }
    case 'crt':
      r(-9, -39, 18, 15, '#d9cfae'); r(-9, -39, 18, 1, '#efe7cc');
      r(-7, -37, 14, 10, '#1e2a1e');
      for (let i = 0; i < 3; i++) r(-6, -36 + i * 3, 4 + ((i * 5 + Math.floor(t * 2)) % 8), 1, '#5dff8a');
      r(-6, -25, 12, 1, '#b9ae8c');
      r(-7, -23, 14, 3, '#d9cfae'); r(-6, -23, 12, 1, '#efe7cc');
      return;
    default: // monitor
      r(-1, -27, 2, 3, '#3a3c4e'); r(-5, -25, 10, 1, '#2b2d3c');
      screen(r, -11, -40, 22, 13, t);
      keyboard(r);
  }
}

/** Desenha um item num slot. */
export function drawSlotItem(ctx, d, cx, by, k, t = 0) {
  const s = SLOTS[d.slot];
  const def = OBJECTS[d.p];
  if (!s || !def) return;
  const q = slotScale(d.p, d.slot) * (d.k || 1);
  const kk = k * q;
  const x = cx + s[0] * k;
  const b = by + s[1] * k;
  ctx.save();
  if (d.hue || d.sat !== undefined || d.bri !== undefined) ctx.filter = `hue-rotate(${d.hue || 0}deg) saturate(${d.sat ?? 100}%) brightness(${d.bri ?? 100}%)`;
  // o desenho do objeto põe o pé 2 px acima do fundo da área: compensa
  drawObjectSprite(ctx, { x: 0, y: 0, type: d.p, color: d.color, rot: d.rot, flip: d.flip }, def, x - (def.w * TILE * kk) / 2, b - def.h * TILE * kk + 2 * kk, kk, t);
  ctx.restore();
}

/** Itens de trás (atrás do computador) e da frente, na ordem certa. x0/y0: canto da área da mesa. */
export function drawDeskSet(ctx, desk, def, x0, y0, k, t = 0) {
  const cx = x0 + (def.w * TILE * k) / 2;
  const by = y0 + def.h * TILE * k - 2 * k;
  const items = slotItems(desk);
  const back = items.filter((d) => SLOTS[d.slot][1] <= -26);
  const front = items.filter((d) => SLOTS[d.slot][1] > -26);
  for (const d of back) drawSlotItem(ctx, d, cx, by, k, t);
  drawPc(ctx, deskMeta(desk).pc, cx, by, k, t);
  for (const d of front.sort((a, b) => SLOTS[a.slot][1] - SLOTS[b.slot][1])) drawSlotItem(ctx, d, cx, by, k, t);
}
