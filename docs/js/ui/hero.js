// Cena animada da tela de login: escritório verde da Crafter, feita com os mesmos sprites do jogo.
import { makeCanvas, brush } from '../art/pixel.js';
import { floorTile } from '../art/tiles.js';
import { objectSprite, OBJECTS } from '../art/objects.js';
import { avatarSprite, normalizeAvatar } from '../art/avatar.js';
import { CRAFTER_MARK } from './brand.js';

const W = 264; // pixels de arte (11 tiles)
const H = 168; // 7 tiles
const WALL = 30;

const GREEN = '#2f7a3e';
const people = {
  desk1: normalizeAvatar({ hair: 'short', hairColor: '#3a2a3a', outfit: 'hoodie', outfitColor: '#2f7a3e', bottom: 'pants', bottomColor: '#24356a' }),
  desk2: normalizeAvatar({ hair: 'fluffy', hairColor: '#1b1b1b', outfit: 'casual', outfitColor: '#3f8a5c', trimColor: '#f3ead6', skin: '#b97d55' }),
  sofa: normalizeAvatar({ hair: 'short', hairColor: '#8a5432', outfit: 'tunic', outfitColor: '#d9783a', trimColor: '#f3ead6', bottom: 'pants', bottomColor: '#3b3b48' }),
  meet: normalizeAvatar({ hair: 'bob', hairColor: '#3a2a3a', outfit: 'casual', outfitColor: '#7bc86a', trimColor: '#2f7a3e', skin: '#d9a077' }),
  walker: normalizeAvatar({ hair: 'ponytail', hairColor: '#c98b4a', outfit: 'suit', outfitColor: '#2f7a3e', trimColor: '#f2c14e', bottom: 'skirt', bottomColor: '#24356a' }),
};

const props = [
  { type: 'rug', x: 1, y: 4, color: '#3f8a4c' },
  { type: 'bookshelf', x: 0, y: 2 },
  { type: 'plant', x: 2, y: 2 },
  { type: 'desk_pc', x: 4, y: 2 },
  { type: 'desk_pc', x: 6, y: 2 },
  { type: 'chair', x: 4, y: 3, color: '#1f4f2c' },
  { type: 'chair', x: 7, y: 3, color: '#1f4f2c' },
  { type: 'plant', x: 9, y: 2 },
  { type: 'plant_big', x: 10, y: 3 },
  { type: 'lamp', x: 0, y: 5, state: { on: true } },
  { type: 'sofa', x: 1, y: 4, color: '#2f7a3e' },
  { type: 'table_round', x: 2, y: 5 },
  { type: 'table_long', x: 7, y: 5 },
  { type: 'chair', x: 7, y: 4, color: '#1f4f2c' },
  { type: 'chair', x: 9, y: 4, color: '#1f4f2c' },
  { type: 'chair', x: 8, y: 6, color: '#1f4f2c' },
  { type: 'plant', x: 10, y: 6 },
  { type: 'plant', x: 0, y: 6 },
];

const sitters = [
  { cfg: people.desk1, x: 4, y: 3, dir: 'up' },
  { cfg: people.desk2, x: 7, y: 3, dir: 'up' },
  { cfg: people.sofa, x: 2, y: 4, dir: 'down' },
  { cfg: people.meet, x: 8, y: 6, dir: 'up' },
];

function drawWall(g) {
  // parede verde
  g.r(0, 0, W, WALL, '#3f7d4a');
  for (let x = 0; x < W; x += 12) g.r(x, 2, 1, WALL - 6, '#376f41');
  g.r(0, 0, W, 2, '#2c5a35');
  g.r(0, WALL - 4, W, 4, '#24492c');
  g.r(0, WALL - 4, W, 1, '#4f8f59');
  // janelas com a cidade
  for (const wx of [108, 150, 192]) {
    g.r(wx - 2, 1, 40, 25, '#e9f2e4');
    g.grad(wx, 3, 36, 21, '#bfe6ff', '#e4f6ff', 3);
    const tops = [9, 6, 12, 4, 10, 7, 13, 8];
    tops.forEach((t, i) => g.r(wx + i * 4.5, 3 + t, 4, 21 - t, i % 2 ? '#8fa6a8' : '#a5b8b5'));
    for (let i = 0; i < 8; i++) g.px(wx + 1 + i * 4.5, 3 + tops[i] + 3, '#dfeee9');
    g.r(wx + 17, 3, 2, 21, '#e9f2e4');
    g.r(wx, 13, 36, 1, '#e9f2e4');
  }
  // quadro com o símbolo da Crafter
  g.r(62, 4, 22, 18, '#24492c');
  g.r(64, 6, 18, 14, '#f5fbf0');
  // mural escuro com post-its
  g.r(236, 3, 26, 21, '#2a2f2c');
  g.r(238, 5, 22, 17, '#3a403c');
  [['#ffd84d', 240, 7], ['#7bc86a', 248, 6], ['#ff8fb8', 252, 13], ['#9bd7ff', 241, 14], ['#f3ead6', 247, 15]].forEach(([c, x, y]) => g.r(x, y, 5, 5, c));
}

function markImage() {
  const img = new Image();
  const svg = CRAFTER_MARK.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" ').replace(/currentColor/g, '#2e9e45');
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
}

export function startHero(canvas) {
  if (!canvas) return () => {};
  const out = canvas.getContext('2d');
  const scene = makeCanvas(W, H);
  const ctx = scene.getContext('2d');
  const g = brush(ctx);

  // fundo fixo: piso + parede
  const bg = makeCanvas(W, H);
  const bctx = bg.getContext('2d');
  for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) bctx.drawImage(floorTile('wood', x, y), x * 24, y * 24);
  drawWall(brush(bctx));
  const sh = bctx.createLinearGradient(0, WALL, 0, WALL + 8);
  sh.addColorStop(0, 'rgba(20,40,20,.35)');
  sh.addColorStop(1, 'rgba(20,40,20,0)');
  bctx.fillStyle = sh;
  bctx.fillRect(0, WALL, W, 8);
  const mark = markImage();
  mark.onload = () => bctx.drawImage(mark, 66, 6, 14, 14);

  const walker = { x: 3.2, y: 4, dx: 1, min: 3.2, max: 6 };
  let raf = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const f = Math.floor(now / 160) % 4;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0);

    const items = [];
    for (const o of props) {
      const def = OBJECTS[o.type];
      items.push({
        z: def.flat ? -1 : o.y + def.h,
        draw: () => { const s = objectSprite(o, def, f); ctx.drawImage(s, o.x * 24 - 1, (o.y + def.h) * 24 - def.ah - 1); },
      });
    }
    for (const s of sitters) {
      items.push({ z: s.y + 1.003, draw: () => ctx.drawImage(avatarSprite(s.cfg, s.dir, 0, true), (s.x + 0.5) * 24 - 13, (s.y + 1) * 24 - 47) });
    }
    walker.x += walker.dx * dt * 1.6;
    if (walker.x > walker.max || walker.x < walker.min) { walker.dx = -walker.dx; walker.x = Math.max(walker.min, Math.min(walker.max, walker.x)); }
    const wf = Math.floor(now / 130) % 4;
    items.push({
      z: walker.y + 1,
      draw: () => {
        ctx.fillStyle = 'rgba(20,30,20,.22)';
        ctx.beginPath();
        ctx.ellipse((walker.x + 0.5) * 24, (walker.y + 1) * 24 - 4, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(avatarSprite(people.walker, walker.dx > 0 ? 'right' : 'left', wf, false), (walker.x + 0.5) * 24 - 13, (walker.y + 1) * 24 - 43);
      },
    });
    items.sort((a, b) => a.z - b.z).forEach((i) => i.draw());

    // brilho da luminária
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(12, 140, 0, 12, 140, 60);
    lg.addColorStop(0, 'rgba(255,214,130,.28)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 80, 80, 88);
    ctx.restore();

    out.imageSmoothingEnabled = false;
    out.drawImage(scene, 0, 0, canvas.width, canvas.height);
    raf = requestAnimationFrame(frame);
  }
  g.r(0, 0, 0, 0, GREEN);
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
