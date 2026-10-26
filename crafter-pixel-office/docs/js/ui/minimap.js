// Minimapa no canto superior direito (como o do RO e o do Gather).
// Pisos com a cor média de cada tile, você em amarelo, colegas em branco, monstros em vermelho.
// Clique para andar até o ponto; tecla M mostra/esconde.
import { h } from './dom.js';
import { FLOORS } from '../art/tiles.js';
import { OBJECTS, dims } from '../art/objects.js';

const PX = 3; // px de minimapa por tile

export class Minimap {
  constructor(app) {
    this.app = app;
    this.canvas = h('canvas', { class: 'minimap-canvas' });
    this.title = h('span', { class: 'minimap-title' }, '');
    this.el = h('div', { class: 'minimap win', title: 'Minimapa — clique para andar até lá (M esconde)' }, this.title, this.canvas);
    this.base = null;
    this.baseAt = 0;
    this.last = 0;
    let hidden = false;
    try { hidden = localStorage.getItem('po.minimap') === 'off'; } catch (e) { /* sem storage */ }
    this.el.hidden = hidden;
    this.canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const r = this.canvas.getBoundingClientRect();
      const w = this.app.world;
      const x = Math.floor(((e.clientX - r.left) / r.width) * w.width);
      const y = Math.floor(((e.clientY - r.top) / r.height) * w.height);
      if (w.walkable(x, y)) this.app.clickTo({ x, y });
      else this.app.goTo(x, y);
    });
    document.body.append(this.el);
  }

  toggle() {
    this.el.hidden = !this.el.hidden;
    try { localStorage.setItem('po.minimap', this.el.hidden ? 'off' : 'on'); } catch (e) { /* sem storage */ }
  }

  invalidate() { this.base = null; }

  buildBase() {
    const w = this.app.world;
    const c = document.createElement('canvas');
    c.width = w.width * PX;
    c.height = w.height * PX;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#14101c';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const f = FLOORS[w.map.floor[y * w.width + x]];
        if (!f || f.clear) continue;
        ctx.fillStyle = f.wall ? f.cap || '#3a3448' : f.color || '#777';
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }
    // móveis sólidos, mais escuros
    ctx.fillStyle = 'rgba(20,12,30,.45)';
    for (const o of w.objects) {
      const def = OBJECTS[o.type];
      if (!def || def.flat || def.walk || def.small) continue;
      const d = dims(o, def);
      ctx.fillRect(o.x * PX, o.y * PX, d.w * PX, d.h * PX);
    }
    this.base = c;
    this.baseAt = performance.now();
  }

  /** Chamado a cada quadro; redesenha ~6 vezes por segundo. */
  update() {
    if (this.el.hidden) return;
    const now = performance.now();
    if (now - this.last < 160) return;
    this.last = now;
    const app = this.app;
    const w = app.world;
    if (!w || !w.width) return;
    if (!this.base || now - this.baseAt > 5000) this.buildBase();
    const c = this.canvas;
    if (c.width !== this.base.width) { c.width = this.base.width; c.height = this.base.height; }
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.base, 0, 0);
    // área visível na tela
    const r = app.renderer;
    const T = r.T;
    const vx = -r.ox / T;
    const vy = -r.oy / T;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.max(0, vx * PX) + 0.5, Math.max(0, vy * PX) + 0.5, (r.canvas.width / T) * PX, (r.canvas.height / T) * PX);
    if (app.combat) {
      ctx.fillStyle = '#ff5d5d';
      for (const m of app.combat.mobs.values()) if (!m.dead) ctx.fillRect(Math.floor(m.x) * PX, Math.floor(m.y - 0.5) * PX, PX, PX);
    }
    for (const p of app.players.values()) {
      if (p === app.me) continue;
      ctx.fillStyle = p.team === 'vermelho' ? '#ff8a8a' : p.team === 'azul' ? '#8ac4ff' : '#ffffff';
      ctx.fillRect(p.x * PX - 1, p.y * PX - 1, PX + 2, PX + 2);
    }
    const me = app.me;
    const blink = Math.floor(now / 400) % 2;
    ctx.fillStyle = blink ? '#ffd84d' : '#ff9a2e';
    ctx.fillRect(me.x * PX - 1, me.y * PX - 1, PX + 2, PX + 2);
    const z = w.zonesAt(me.x, me.y).find((zz) => zz.kind !== 'desk');
    const name = z ? z.name : 'Escritório';
    if (this.title.textContent !== name) this.title.textContent = name;
  }
}
