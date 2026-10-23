// Pisos e paredes 24x24 em estilo pintado.
import { makeCanvas, brush, shade, mix, rng, light, shadow } from './pixel.js';

export const FLOORS = {
  wood: { name: 'Tábuas', color: '#b9824e' },
  wood_dark: { name: 'Tábuas escuras', color: '#7d4f30' },
  stone: { name: 'Lajotas', color: '#c9bfae' },
  cobble: { name: 'Pedras', color: '#a49c94' },
  marble: { name: 'Mármore', color: '#efe8dc' },
  carpet_red: { name: 'Tapete real', color: '#a8343f' },
  carpet_blue: { name: 'Tapete azul', color: '#3f5aa8' },
  carpet_green: { name: 'Tapete verde', color: '#3f8a5c' },
  carpet_purple: { name: 'Tapete roxo', color: '#6e4aa0' },
  grass: { name: 'Grama', color: '#79b84f' },
  dirt: { name: 'Terra', color: '#b48a5c' },
  sand: { name: 'Areia', color: '#e6d3a1' },
  water: { name: 'Água', color: '#4aa3d8', solid: true },
  wall_stone: { name: 'Parede de pedra', color: '#9a93a6', wall: true, solid: true },
  wall_wood: { name: 'Parede de madeira', color: '#8a5a36', wall: true, solid: true },
  wall_plaster: { name: 'Parede enxaimel', color: '#efe3c9', wall: true, solid: true },
  hedge: { name: 'Cerca viva', color: '#3f7d3a', wall: true, solid: true },
  glass: { name: 'Vitral', color: '#9fd3ee', wall: true, solid: true },
  void: { name: 'Vazio', color: '#191426', solid: true },
};

export const FLOOR_TYPES = Object.keys(FLOORS).filter((k) => !FLOORS[k].wall && k !== 'void');
export const WALL_TYPES = Object.keys(FLOORS).filter((k) => FLOORS[k].wall);

const cache = new Map();

function variantOf(type, x, y) {
  if (type.startsWith('wood')) return ((y % 2) * 3 + (((x % 3) + 3) % 3));
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4;
}

export function floorTile(type, x, y) {
  const t = FLOORS[type] ? type : 'void';
  const v = variantOf(t, x, y);
  const key = `${t}|${v}`;
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(24, 24);
    drawFloor(brush(c.getContext('2d')), t, v);
    cache.set(key, c);
  }
  return c;
}

export function wallTile(type, front) {
  const key = `w|${type}|${front ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(24, 24);
    drawWall(brush(c.getContext('2d')), type, front);
    cache.set(key, c);
  }
  return c;
}

function speckle(g, r, base, n, amt = 0.07) {
  for (let i = 0; i < n; i++) g.px((r() * 24) | 0, (r() * 24) | 0, r() < 0.5 ? shade(base, -amt) : shade(base, amt));
}

function drawFloor(g, type, v) {
  const base = FLOORS[type].color;
  const r = rng(v * 991 + type.length * 37 + 11);
  switch (type) {
    case 'wood':
    case 'wood_dark': {
      const d = shadow(base, 0.3);
      const l = light(base, 0.16);
      g.r(0, 0, 24, 24, base);
      for (let row = 0; row < 4; row++) {
        const y = row * 6;
        const tint = shade(base, ((row * 7 + v) % 3 - 1) * 0.04);
        g.r(0, y, 24, 5, tint);
        g.r(0, y, 24, 1, l);
        g.r(0, y + 5, 24, 1, d);
        // juntas desencontradas, contínuas entre tiles
        const seam = (v * 24 + row * 13) % 36;
        if (seam < 24) { g.r(seam, y, 1, 5, d); g.px(seam + 1, y + 1, l); }
        // veios
        g.r(((row * 9 + v * 5) % 18) + 2, y + 2, 4, 1, shade(tint, -0.08));
        g.px(((row * 5 + v * 11) % 20) + 2, y + 3, shade(tint, -0.12));
      }
      break;
    }
    case 'stone': {
      g.r(0, 0, 24, 24, shade(base, -0.18));
      const tint = shade(base, (v - 1.5) * 0.03);
      g.box(1, 1, 22, 22, tint, { l: 0.25, d: 0.22 });
      speckle(g, r, tint, 16, 0.06);
      if (v === 2) { g.line(5, 6, 9, 10, shade(tint, -0.2)); g.line(9, 10, 8, 14, shade(tint, -0.2)); }
      break;
    }
    case 'cobble': {
      g.r(0, 0, 24, 24, shade(base, -0.35));
      const stones = [[5, 5, 5, 4], [16, 4, 6, 4], [4, 14, 5, 4], [13, 13, 5, 4], [21, 13, 3, 4], [9, 21, 6, 3], [20, 21, 4, 3], [0, 21, 3, 3]];
      stones.forEach(([cx, cy, rx, ry], i) => {
        const c = shade(base, ((i + v) % 4 - 1.5) * 0.06);
        g.el(cx, cy, rx, ry, c);
        g.el(cx - 1, cy - 1, rx - 2, ry - 2, light(c, 0.15));
      });
      break;
    }
    case 'marble': {
      const a = base;
      const b = '#d8cfc0';
      g.r(0, 0, 12, 12, a); g.r(12, 12, 12, 12, a);
      g.r(12, 0, 12, 12, b); g.r(0, 12, 12, 12, b);
      g.r(0, 0, 24, 1, '#fffaf0'); g.r(0, 11, 24, 1, shade(b, -0.08)); g.r(0, 23, 24, 1, shade(b, -0.08));
      if (v === 1) g.line(3, 4, 8, 8, shade(a, -0.05));
      if (v === 3) g.line(14, 3, 19, 6, shade(b, -0.05));
      break;
    }
    case 'carpet_red':
    case 'carpet_blue':
    case 'carpet_green':
    case 'carpet_purple': {
      const l = light(base, 0.18);
      const d = shadow(base, 0.18);
      g.r(0, 0, 24, 24, base);
      for (let i = 0; i < 6; i++) {
        g.r(12 - i, 6 + i, 1 + i * 2, 1, d);
        g.r(12 - i, 17 - i, 1 + i * 2, 1, d);
      }
      g.r(11, 10, 3, 3, mix(base, '#f2c14e', 0.55));
      g.px(0, 0, l); g.px(23, 0, l); g.px(0, 23, l); g.px(23, 23, l);
      speckle(g, r, base, 10, 0.05);
      break;
    }
    case 'grass': {
      g.r(0, 0, 24, 24, base);
      speckle(g, r, base, 30, 0.08);
      for (let i = 0; i < 7; i++) {
        const x = (r() * 22) | 0;
        const y = (r() * 21) | 0;
        g.r(x, y, 1, 2, shade(base, -0.22));
        g.px(x + 1, y, shade(base, 0.18));
      }
      if (v === 3) { g.px(5, 6, '#fff'); g.px(4, 6, '#ffe36e'); g.px(17, 16, '#ff9ec2'); g.px(18, 16, '#fff'); }
      if (v === 1) { g.px(14, 4, '#c8a2ff'); g.px(15, 5, '#fff'); }
      break;
    }
    case 'dirt':
    case 'sand': {
      g.r(0, 0, 24, 24, base);
      speckle(g, r, base, 26, 0.09);
      for (let i = 0; i < 3; i++) {
        const x = (r() * 20) | 0;
        const y = (r() * 20) | 0;
        g.r(x, y, 2, 1, shade(base, -0.2)); g.px(x, y - 1, shade(base, 0.2));
      }
      break;
    }
    case 'water': {
      g.r(0, 0, 24, 24, base);
      g.r(3 + v * 3, 8, 6, 1, light(base, 0.4)); g.r(14 - v, 16, 5, 1, light(base, 0.35)); g.r(6, 20, 3, 1, light(base, 0.3));
      break;
    }
    default:
      g.r(0, 0, 24, 24, base);
  }
}

const WALLS = {
  wall_stone: { top: '#5d5470', face: '#9a93a6', base: '#4b4459' },
  wall_wood: { top: '#4f301c', face: '#8a5a36', base: '#3f2716' },
  wall_plaster: { top: '#6b4a2e', face: '#efe3c9', base: '#6b4a2e' },
  hedge: { top: '#2f6a2c', face: '#3f8a3a', base: '#2a4f22' },
};

function drawWall(g, type, front) {
  if (type === 'glass') {
    if (front) {
      g.r(0, 0, 24, 5, '#6a5a7e');
      g.r(0, 5, 24, 15, '#9fd3ee');
      g.r(0, 5, 12, 15, '#b9a2e8');
      g.r(12, 5, 12, 7, '#f4d47a');
      g.r(11, 5, 2, 15, '#4c3f5c'); g.r(0, 12, 24, 1, '#4c3f5c');
      g.r(3, 7, 1, 4, '#ffffff'); g.r(15, 14, 1, 4, 'rgba(255,255,255,.8)');
      g.r(0, 20, 24, 4, '#6a5a7e');
    } else {
      g.r(0, 0, 24, 24, '#6a5a7e'); g.r(0, 0, 24, 1, '#8a7a9e'); g.r(11, 0, 2, 24, '#5a4a6e');
    }
    return;
  }
  const pal = WALLS[type] || WALLS.wall_stone;
  if (!front) {
    g.r(0, 0, 24, 24, pal.top);
    g.r(0, 0, 24, 1, light(pal.top, 0.15));
    if (type === 'hedge') for (let i = 0; i < 6; i++) g.el(4 + i * 4, 12 + ((i % 2) * 4 - 2), 3, 3, light(pal.top, 0.08));
    return;
  }
  g.r(0, 0, 24, 5, pal.top);
  g.r(0, 4, 24, 1, light(pal.top, 0.2));
  g.r(0, 5, 24, 16, pal.face);
  if (type === 'wall_stone') {
    for (let row = 0; row < 4; row++) {
      const y = 5 + row * 4;
      g.r(0, y + 3, 24, 1, shadow(pal.face, 0.2));
      const off = row % 2 ? 6 : 0;
      for (let x = off; x < 24; x += 12) { g.r(x, y, 1, 3, shadow(pal.face, 0.2)); g.r(x + 1, y, 10, 1, light(pal.face, 0.12)); }
    }
  } else if (type === 'wall_wood') {
    for (let row = 0; row < 4; row++) {
      const y = 5 + row * 4;
      g.r(0, y, 24, 1, light(pal.face, 0.15));
      g.r(0, y + 3, 24, 1, shadow(pal.face, 0.25));
    }
  } else if (type === 'wall_plaster') {
    g.r(0, 5, 24, 2, '#7a5434');
    g.r(10, 5, 3, 16, '#7a5434');
    g.line(0, 20, 10, 8, '#7a5434'); g.line(1, 20, 11, 8, '#7a5434');
    g.px(18, 11, shade(pal.face, -0.06)); g.px(5, 15, shade(pal.face, -0.06));
  } else if (type === 'hedge') {
    for (let i = 0; i < 8; i++) g.el((i * 7) % 24, 7 + ((i * 5) % 12), 3, 3, i % 2 ? light(pal.face, 0.12) : shadow(pal.face, 0.08));
    g.px(6, 9, '#ff9ec2'); g.px(17, 15, '#fff2a8');
  }
  g.r(0, 21, 24, 3, pal.base);
  g.r(0, 21, 24, 1, light(pal.base, 0.2));
}
