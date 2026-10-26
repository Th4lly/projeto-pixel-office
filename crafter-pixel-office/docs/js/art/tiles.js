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

  FLOOR_TYPES = CAT.floors.map((f) => f.id).filter((id) => !FLOORS[id].wall);
  WALL_TYPES = walls.map((w) => w.id);
}

/** Desenha um tile de piso em (x, y) (pixels de mundo, 32 por tile) num contexto já escalado. */
export function paintFloor(ctx, type, tx, ty) {
  const F = FLOORS[type] || FLOORS.void;
  const px = tx * TILE;
  const py = ty * TILE;
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

/** Parede: face com textura quando há chão embaixo; senão, só o topo. */
export function paintWall(ctx, type, tx, ty, front) {
  const W = FLOORS[type];
  const px = tx * TILE;
  const py = ty * TILE;
  ctx.fillStyle = (W && W.cap) || '#2a2030';
  ctx.fillRect(px, py, TILE, TILE);
  if (!W || !front || !W.face) {
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(px, py, TILE, 2);
    return true;
  }
  const img = image(W.face.s);
  if (!img) return false;
  const [fx, fy, fw, fh] = W.face.f;
  // face ocupa os 3/4 de baixo do tile; a faixa de cima continua sendo o topo
  const top = 8;
  if (fh > fw * 2) {
    // textura alta (parede creme): pega a parte de baixo, com o rodapé
    const sh = Math.min(fh, fw * ((TILE - top) / TILE));
    ctx.drawImage(img, fx, fy + fh - sh, fw, sh, px, py + top, TILE, TILE - top);
  } else {
    const span = TILE / W.face.sc;
    const sw = Math.min(span, fw);
    const sh = Math.min(span * ((TILE - top) / TILE), fh);
    ctx.drawImage(img, fx + ((tx * span) % fw + fw) % Math.max(1, fw - sw + 1), fy, sw, sh, px, py + top, TILE, TILE - top);
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(px, py + TILE - 3, TILE, 3);
  return true;
}

export function floorColor(type) {
  return (FLOORS[type] && FLOORS[type].color) || '#333';
}
