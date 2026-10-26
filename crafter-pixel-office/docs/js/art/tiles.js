// Pisos e paredes a partir dos tilesets da pasta de sprites.
// Piso = um bloco repetível do catálogo. Parede = "w:<id do piso>": a textura vira a
// face da parede (quando há chão embaixo) e o topo é a cor média escurecida.
import { CAT, IDX, image, TILE } from './assets.js';

export const FLOORS = {};
export let FLOOR_TYPES = [];
export let WALL_TYPES = [];

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// Tilesets que servem de parede (texturas verticais)
const WALL_SOURCES = ['office-parede-creme', 'wall-variations', 'interior-walls', 'structures-buildings-walls', 'wall-tiles', 'dungeon-tiles', 'retro-wall'];

export function buildTiles() {
  for (const k of Object.keys(FLOORS)) delete FLOORS[k];
  for (const f of CAT.floors) {
    FLOORS[f.id] = { name: f.name, color: f.avg || '#777', src: f, pack: f.pack };
  }
  FLOORS.void = { name: 'Vazio', color: '#14101c', solid: true };
  FLOORS.none = { name: 'Transparente (mostra o fundo importado)', color: 'transparent', clear: true };
  // água: tudo que é dos tilesets de água bloqueia passagem
  for (const f of CAT.floors) if (/water/.test(f.id)) FLOORS[f.id].solid = true;

  const walls = [];
  for (const w of CAT.walls || []) {
    if (!w.face) continue;
    walls.push({ id: `w:${w.id}`, name: w.name, face: { s: w.s, f: w.face, sc: w.sc }, cap: w.cap || '#3a2a20' });
  }
  for (const f of CAT.floors) {
    if (!f.wallish && !WALL_SOURCES.some((s) => f.id.includes(s))) continue;
    walls.push({ id: `w:${f.id}`, name: `Parede — ${f.name}`, face: { s: f.s, f: f.f, sc: f.sc }, cap: shade(f.avg || '#666', 0.45) });
  }
  // cerca viva com a textura de arbustos do pacote de floresta
  const hedge = CAT.floors.find((f) => /seasonal/.test(f.id));
  if (hedge) walls.push({ id: `w:hedge`, name: 'Cerca viva', face: { s: hedge.s, f: hedge.f, sc: hedge.sc }, cap: '#2f4a22' });
  for (const w of walls) FLOORS[w.id] = { name: w.name, color: w.cap, wall: true, solid: true, face: w.face, cap: w.cap };

  FLOOR_TYPES = [...CAT.floors.map((f) => f.id).filter((id) => !FLOORS[id].wall), 'none'];
  WALL_TYPES = walls.map((w) => w.id);
}

/** Desenha um tile de piso em (x, y) (pixels de mundo, 32 por tile) num contexto já escalado. */
export function paintFloor(ctx, type, tx, ty) {
  const F = FLOORS[type] || FLOORS.void;
  const px = tx * TILE;
  const py = ty * TILE;
  if (F.clear) return true;
  if (!F.src) {
    ctx.fillStyle = F.color;
    ctx.fillRect(px, py, TILE, TILE);
    return true;
  }
  return blitRepeat(ctx, F.src, px, py, tx, ty);
}

function blitRepeat(ctx, src, px, py, tx, ty) {
  const img = image(src.s);
  if (!img) {
    ctx.fillStyle = src.avg || '#555';
    ctx.fillRect(px, py, TILE, TILE);
    return false;
  }
  const [fx, fy, fw, fh] = src.f;
  // quantos pixels do bloco cabem num tile
  const span = TILE / src.sc;
  const ox = ((tx * span) % fw + fw) % fw;
  const oy = ((ty * span) % fh + fh) % fh;
  // até 4 pedaços (o bloco dá a volta)
  const sw1 = Math.min(span, fw - ox);
  const sh1 = Math.min(span, fh - oy);
  const parts = [[ox, oy, sw1, sh1, 0, 0]];
  if (sw1 < span) parts.push([0, oy, span - sw1, sh1, sw1, 0]);
  if (sh1 < span) parts.push([ox, 0, sw1, span - sh1, 0, sh1]);
  if (sw1 < span && sh1 < span) parts.push([0, 0, span - sw1, span - sh1, sw1, sh1]);
  for (const [sx, sy, sw, sh, dx, dy] of parts) {
    ctx.drawImage(img, fx + sx, fy + sy, sw, sh, px + dx * src.sc, py + dy * src.sc, sw * src.sc, sh * src.sc);
  }
  return true;
}

// ---------------------------------------------------------------- paredes em pixel
// A face da parede é pré-desenhada numa grade de 1 texel = 1 px de mundo (como os itens no
// estilo RO): textura reduzida por média, cores em degraus, friso claro em cima, rodapé escuro
// e contorno. O topo ganha um pontilhado leve e contorno onde encosta em chão: a divisa dos
// ambientes fica nítida.
const FACE_TOP = 8; // px de topo visível acima da face
const faceCache = new Map();

function hexRgb(hex) {
  const n = parseInt((hex || '#555555').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function wallFace(W) {
  const key = W.face.s + '|' + W.face.f.join(',');
  if (faceCache.has(key)) return faceCache.get(key);
  const img = image(W.face.s);
  if (!img) return null;
  const [fx, fy, fw, fh] = W.face.f;
  const H = TILE - FACE_TOP;
  // 2 tiles de largura para a textura não repetir a cada tile
  const out = document.createElement('canvas');
  out.width = TILE * 2;
  out.height = H;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (fh > fw * 2) {
    // textura alta (parede creme): pega a parte de baixo, com o rodapé
    const sh = Math.min(fh, fw * (H / TILE));
    ctx.drawImage(img, fx, fy + fh - sh, fw, sh, 0, 0, TILE, H);
    ctx.drawImage(img, fx, fy + fh - sh, fw, sh, TILE, 0, TILE, H);
  } else {
    const span = TILE / W.face.sc; // px da textura por tile
    ctx.imageSmoothingEnabled = span > TILE * 1.3;
    for (let i = 0; i < 2; i++) {
      const sw = Math.min(span, fw);
      const sh = Math.min(span * (H / TILE), fh);
      const sx = (i * sw) % Math.max(1, fw - sw + 1);
      ctx.drawImage(img, fx + sx, fy, sw, sh, i * TILE, 0, TILE, H);
    }
  }
  const id = ctx.getImageData(0, 0, out.width, H);
  const d = id.data;
  const cap = hexRgb(W.cap);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < out.width; x++) {
      const i = (y * out.width + x) * 4;
      if (d[i + 3] < 128) { d[i] = cap[0]; d[i + 1] = cap[1]; d[i + 2] = cap[2]; }
      d[i + 3] = 255;
      let k = 1;
      if (y < 2) k = 1.28; // friso
      else if (y === 2) k = 0.7;
      else if (y >= H - 4) k = y === H - 1 ? 0.45 : 0.68; // rodapé
      else k = 1 - (y / H) * 0.12; // luz de cima
      for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] * k) / 8) * 8));
    }
  }
  ctx.putImageData(id, 0, 0);
  faceCache.set(key, out);
  return out;
}

/**
 * Parede: topo com contorno + face com textura em pixel quando há chão embaixo.
 * nb (opcional) = função (dx, dy) → true se o vizinho também é parede.
 */
export function paintWall(ctx, type, tx, ty, front, nb) {
  const W = FLOORS[type];
  const px = tx * TILE;
  const py = ty * TILE;
  const capHex = (W && W.cap) || '#2a2030';
  const [cr, cg, cb] = hexRgb(capHex);
  ctx.fillStyle = capHex;
  const capH = front ? FACE_TOP : TILE;
  ctx.fillRect(px, py, TILE, TILE);
  // pontilhado do topo (pedra/reboco), determinístico
  for (let i = 0; i < 10; i++) {
    const h = (tx * 73856093) ^ (ty * 19349663) ^ (i * 83492791);
    const x = ((h >>> 3) % TILE + TILE) % TILE;
    const y = ((h >>> 11) % capH + capH) % capH;
    ctx.fillStyle = i % 2 ? `rgb(${cr * 0.8 | 0},${cg * 0.8 | 0},${cb * 0.8 | 0})` : `rgb(${Math.min(255, cr * 1.18) | 0},${Math.min(255, cg * 1.18) | 0},${Math.min(255, cb * 1.18) | 0})`;
    ctx.fillRect(px + x, py + y, 2, 1);
  }
  const wallAt = nb || (() => true);
  const dark = 'rgba(12,8,18,.9)';
  const light = `rgba(${Math.min(255, cr + 60)},${Math.min(255, cg + 60)},${Math.min(255, cb + 60)},.55)`;
  // contorno onde a parede encosta em chão (divisa dos ambientes)
  ctx.fillStyle = dark;
  if (!wallAt(0, -1)) ctx.fillRect(px, py, TILE, 2);
  if (!wallAt(-1, 0)) ctx.fillRect(px, py, 2, capH);
  if (!wallAt(1, 0)) ctx.fillRect(px + TILE - 2, py, 2, capH);
  ctx.fillStyle = light;
  if (!wallAt(0, -1)) ctx.fillRect(px + (wallAt(-1, 0) ? 0 : 2), py + 2, TILE - (wallAt(-1, 0) ? 0 : 2) - (wallAt(1, 0) ? 0 : 2), 1);
  if (!wallAt(-1, 0)) ctx.fillRect(px + 2, py + 2, 1, capH - 2);
  if (!W || !front || !W.face) return true;
  const face = wallFace(W);
  if (!face) return false;
  const sx = (((tx % 2) + 2) % 2) * TILE;
  ctx.drawImage(face, sx, 0, TILE, TILE - FACE_TOP, px, py + FACE_TOP, TILE, TILE - FACE_TOP);
  // borda do topo sobre a face + laterais da face
  ctx.fillStyle = dark;
  ctx.fillRect(px, py + FACE_TOP - 1, TILE, 1);
  if (!wallAt(-1, 0)) ctx.fillRect(px, py + FACE_TOP, 2, TILE - FACE_TOP);
  if (!wallAt(1, 0)) ctx.fillRect(px + TILE - 2, py + FACE_TOP, 2, TILE - FACE_TOP);
  return true;
}

export function floorColor(type) {
  return (FLOORS[type] && FLOORS[type].color) || '#333';
}
