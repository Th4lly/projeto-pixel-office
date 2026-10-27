// Cena animada da tela de login: um pedaço do escritório com os sprites da pasta
// (piso de nogueira, móveis do escritório, avatares do Ragnarok andando e trabalhando).
import { CAT, TILE } from '../art/assets.js';
import { paintFloor, paintWall, FLOORS } from '../art/tiles.js';
import { OBJECTS, drawObjectSprite } from '../art/objects.js';
import { drawAvatar, normalizeAvatar, bodiesFor, headsFor } from '../art/avatar.js';

const COLS = 11;
const ROWS = 7;

function pickAvatar(i) {
  const g = i % 2 ? 'f' : 'm';
  const bodies = bodiesFor(g);
  const heads = headsFor(g);
  return normalizeAvatar({ v: 2, gender: g, body: bodies[(i * 7) % bodies.length].id, head: heads[(i * 37) % heads.length].id, headgear: 'none' });
}

export function startHero(canvas) {
  if (!canvas || !CAT) return () => {};
  const ctx = canvas.getContext('2d');
  const k = canvas.width / (COLS * TILE);
  const floor = Object.keys(FLOORS).find((f) => f === 'nook-floor-walnut') || Object.keys(FLOORS)[0];
  const wall = Object.keys(FLOORS).find((f) => FLOORS[f].wall && f.includes('creme')) || Object.keys(FLOORS).find((f) => FLOORS[f].wall);
  const props = [
    { type: 'bookshelf', x: 0, y: 1 }, { type: 'plant', x: 1, y: 1 }, { type: 'desk_pc', x: 3, y: 1 }, { type: 'desk', x: 6, y: 1 },
    { type: 'chair', x: 3, y: 2 }, { type: 'chair', x: 6, y: 2 }, { type: 'plant_big', x: 9, y: 1 }, { type: 'window', x: 4, y: 0 },
    { type: 'rug_round', x: 1, y: 4 }, { type: 'sofa', x: 1, y: 3 }, { type: 'table_round', x: 2, y: 5 }, { type: 'lamp', x: 0, y: 5, state: { on: true } },
    { type: 'meeting_table', x: 6, y: 4 }, { type: 'water', x: 10, y: 4 },
  ].filter((p) => OBJECTS[p.type]);
  const sitters = [
    { cfg: pickAvatar(0), x: 3, y: 2, dir: 'up', action: 'sit' },
    { cfg: pickAvatar(1), x: 6, y: 2, dir: 'up', action: 'sit' },
    { cfg: pickAvatar(2), x: 2, y: 4, dir: 'down', action: 'stand' },
    { cfg: pickAvatar(3), x: 9, y: 5, dir: 'left', action: 'stand' },
  ];
  const walker = { cfg: pickAvatar(4), x: 0.5, y: 6, dx: 1 };
  let raf = 0;
  let last = performance.now();
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    walker.x += walker.dx * dt * 1.6;
    if (walker.x > COLS - 1.2) walker.dx = -1;
    if (walker.x < 0.3) walker.dx = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1c1626';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(k, k);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (y === 0) paintWall(ctx, wall, x, y, true);
      else paintFloor(ctx, floor, x, y);
    }
    ctx.restore();
    const items = props.map((o) => ({ z: o.y + OBJECTS[o.type].h, o }));
    sitters.forEach((s) => items.push({ z: s.y + 1.01, s }));
    items.push({ z: walker.y + 1.01, s: { ...walker, dir: walker.dx > 0 ? 'right' : 'left', action: 'walk' } });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.o) drawObjectSprite(ctx, it.o, OBJECTS[it.o.type], it.o.x * TILE * k, it.o.y * TILE * k, k, t / 1000);
      else drawAvatar(ctx, it.s.cfg, it.s.dir, it.s.action, t / 1000, (it.s.x + 0.5) * TILE * k, (it.s.y + 1) * TILE * k - 3 * k, k);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
