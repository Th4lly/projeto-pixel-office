// NPCs de ambiente: jardineiros (Mana Seed), cidadãos do Pixel Crawler, NPCs do Ragnarok
// andando pelo jardim, recepção e corredor das arenas. Cada navegador simula os seus
// (são só decoração; ninguém interage com eles).
import { CAT, drawFrame, frameAt } from '../art/assets.js';

const ROUTES = [
  { zone: /jardim/i, groups: ['Jardineiros'], n: 2 },
  { zone: /jardim/i, groups: ['NPC andarilho', 'Animal', 'Fada'], n: 2 },
  { zone: /recep/i, groups: ['Escritório'], n: 1, still: true },
  { zone: /recep/i, groups: ['NPC regional', 'NPC festivo', 'Visitantes'], n: 2 },
  { zone: /corredor das arenas/i, groups: ['Aventureiros', 'Cidadãos'], n: 2 },
  { zone: /leitura/i, groups: ['Bicho falante', 'Cantinho dos gatos'], n: 1 },
];

export class Npcs {
  constructor(app) {
    this.app = app;
    this.list = [];
    this.spawnAll();
    app.on('world', () => { if (!this.list.length) this.spawnAll(); });
  }

  spawnAll() {
    const w = this.app.world;
    this.list = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (const r of ROUTES) {
      const zone = w.zones.find((z) => r.zone.test(z.name || ''));
      if (!zone) continue;
      const pool = CAT.npcs.filter((n) => r.groups.includes(n.group));
      for (let i = 0; i < r.n && pool.length; i++) {
        const def = pool[Math.floor(rnd() * pool.length)];
        const spot = this.freeSpot(zone, rnd);
        if (!spot) continue;
        this.list.push({ def, zone, x: spot.x + 0.5, y: spot.y + 0.9, tx: null, ty: null, dir: 'down', wait: rnd() * 4, still: !!r.still, t: rnd() * 10 });
      }
    }
  }

  freeSpot(zone, rnd) {
    const w = this.app.world;
    for (let i = 0; i < 40; i++) {
      const x = zone.x + Math.floor(rnd() * zone.w);
      const y = zone.y + Math.floor(rnd() * zone.h);
      if (w.walkable(x, y)) return { x, y };
    }
    return null;
  }

  update(dt) {
    const w = this.app.world;
    for (const n of this.list) {
      n.t += dt;
      if (n.still) continue;
      if (n.tx === null) {
        n.wait -= dt;
        if (n.wait > 0) continue;
        const s = this.freeSpot(n.zone, Math.random);
        if (s) { n.tx = s.x + 0.5; n.ty = s.y + 0.9; }
        n.wait = 2 + Math.random() * 5;
        continue;
      }
      const dx = n.tx - n.x;
      const dy = n.ty - n.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.1) { n.tx = null; continue; }
      const st = Math.min(d, dt * 1.3);
      const nx = n.x + (dx / d) * st;
      const ny = n.y + (dy / d) * st;
      if (!w.walkable(Math.floor(nx), Math.floor(ny))) { n.tx = null; continue; }
      n.x = nx;
      n.y = ny;
      n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
  }

  frames(n) {
    const def = n.def;
    const moving = n.tx !== null;
    if (def.anims) {
      const a = def.anims;
      if (def.kind === 'mana') {
        const k = moving ? (n.dir === 'left' || n.dir === 'right' ? 'walk-side' : 'walk-down') : n.dir === 'up' ? 'idle-up' : 'idle-down';
        return a[k] || a['idle-down'];
      }
      const dirKey = n.dir === 'up' ? 'up' : n.dir === 'down' ? 'down' : 'side';
      const prefer = moving ? [`walk_${dirKey}`, `run_${dirKey}`, 'walk', 'run'] : [`idle_${dirKey}`, 'idle'];
      for (const k of prefer) if (a[k]) return a[k];
      return Object.values(a)[0];
    }
    return { s: def.s, frames: def.frames };
  }

  collect(items) {
    for (const n of this.list) items.push({ z: n.y, draw: (ctx, ox, oy, S, T, time) => this.draw(ctx, n, ox, oy, S, T, time) });
  }

  draw(ctx, n, ox, oy, S, T) {
    const a = this.frames(n);
    if (!a || !a.frames || !a.frames.length) return;
    const f = frameAt(a.frames, n.t, n.tx !== null ? 8 : 4);
    const cx = ox + n.x * T;
    const by = oy + n.y * T;
    ctx.fillStyle = 'rgba(20,10,40,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, by, 8 * S, 2.8 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    // RO e Mana Seed olham para a esquerda/direita conforme a folha
    const flip = n.def.kind === 'mana' || n.def.kind === 'crawler' ? n.dir === 'left' : n.dir === 'right';
    drawFrame(ctx, a.s ?? n.def.s, f, cx, by + 2 * S, (n.def.sc || 1) * S, flip);
  }
}
