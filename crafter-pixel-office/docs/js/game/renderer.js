// Desenha o escritório: camada de piso em cache + objetos e avatares ordenados por profundidade.
import { makeCanvas } from '../art/pixel.js';
import { FLOORS, floorTile, wallTile } from '../art/tiles.js';
import { OBJECTS, objectSprite } from '../art/objects.js';
import { avatarSprite } from '../art/avatar.js';
import { onStage } from './world.js';

const ZOOMS = [1, 1.5, 2, 2.5, 3, 4];
const STATUS_COLORS = { online: '#3ddc84', busy: '#ff5d5d', away: '#ffc93c' };
const FONT = 'Nunito, Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const ZONE_COLORS = { private: 'rgba(255, 201, 60, .9)', spotlight: 'rgba(255, 120, 200, .9)', area: 'rgba(255,255,255,.55)' };

export class Renderer {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.zoomIdx = window.innerWidth > 1700 ? 3 : 2;
    this.layer = null;
    this.dirty = true;
    this.ox = 0;
    this.oy = 0;
    this.floaters = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get dpr() { return window.devicePixelRatio || 1; }
  get S() { return Math.max(1, Math.round(ZOOMS[this.zoomIdx] * this.dpr)); }
  get T() { return 24 * this.S; }

  zoomBy(d) { this.zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, this.zoomIdx + d)); }

  resize() {
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  }

  invalidate() { this.dirty = true; }

  tileAt(clientX, clientY) {
    const T = this.T;
    return { x: Math.floor((clientX * this.dpr - this.ox) / T), y: Math.floor((clientY * this.dpr - this.oy) / T) };
  }

  /** Mostra um texto flutuante (dano, XP...) sobre um tile. */
  float(x, y, text, color = '#ffd84d', big = false) {
    this.floaters.push({ x: x + 0.5 + (Math.random() - 0.5) * 0.4, y, text, color, big, t: performance.now() });
  }

  isSitting(p) {
    return !p.moving && !!this.app.world.seatAt(p.x, p.y);
  }

  buildLayer() {
    const w = this.app.world;
    const W = w.width * 24;
    const H = w.height * 24;
    if (!this.layer || this.layer.width !== W || this.layer.height !== H) this.layer = makeCanvas(W, H);
    const ctx = this.layer.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const t = w.floorAt(x, y);
        const f = FLOORS[t] || FLOORS.void;
        ctx.drawImage(f.wall ? wallTile(t, !w.isWall(x, y + 1)) : floorTile(t, x, y), x * 24, y * 24);
        // sombra projetada pela parede de cima
        if (!f.wall && w.isWall(x, y - 1) && t !== 'void') {
          const g = ctx.createLinearGradient(0, y * 24, 0, y * 24 + 9);
          g.addColorStop(0, 'rgba(30,18,50,.38)');
          g.addColorStop(1, 'rgba(30,18,50,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x * 24, y * 24, 24, 9);
        }
        if (!f.wall && w.isWall(x - 1, y) && t !== 'void') {
          ctx.fillStyle = 'rgba(30,18,50,.16)';
          ctx.fillRect(x * 24, y * 24, 4, 24);
        }
      }
    }
    for (const o of w.objects) {
      const def = OBJECTS[o.type];
      if (!def || !def.flat) continue;
      ctx.drawImage(objectSprite(o, def), o.x * 24 - 1, (o.y + def.h) * 24 - def.ah - 1);
    }
    this.dirty = false;
  }

  draw(time) {
    const { ctx, app } = this;
    const S = this.S;
    const T = this.T;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (this.dirty) this.buildLayer();
    const frame = Math.floor(time * 6) % 4;

    const me = app.me;
    const mapW = app.world.width * T;
    const mapH = app.world.height * T;
    this.ox = mapW < cw ? Math.round((cw - mapW) / 2) : Math.round(Math.min(0, Math.max(cw - mapW, cw / 2 - (me.rx + 0.5) * T)));
    this.oy = mapH < ch ? Math.round((ch - mapH) / 2) : Math.round(Math.min(0, Math.max(ch - mapH, ch / 2 - (me.ry + 0.5) * T)));
    const { ox, oy } = this;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--void') || '#16121f';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(this.layer, ox, oy, this.layer.width * S, this.layer.height * S);

    const vx0 = -ox / T - 4, vy0 = -oy / T - 4, vx1 = (cw - ox) / T + 4, vy1 = (ch - oy) / T + 4;
    const items = [];
    for (const o of app.world.objects) {
      const def = OBJECTS[o.type];
      if (!def || def.flat) continue;
      if (o.x + def.w < vx0 || o.x > vx1 || o.y + def.h < vy0 || o.y > vy1) continue;
      items.push({ z: o.y + def.h - (def.walk ? 0.9 : 0), o, def });
    }
    for (const p of app.players.values()) items.push({ z: p.ry + 1.001 + (this.isSitting(p) ? 0.002 : 0), p });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.o) this.drawObject(it.o, it.def, ox, oy, S, T, it.o === app.target, frame);
      else this.drawPlayer(it.p, ox, oy, S, T);
    }

    this.drawGlows(ox, oy, S, T, time);
    this.drawZoneLabels(ox, oy, T);
    this.drawBadges(ox, oy, S, T);
    this.drawPrivateDim(ox, oy, T, cw, ch);
    if (app.build.on) this.drawBuild(ox, oy, S, T);
    for (const p of app.players.values()) this.drawOverhead(p, S);
    this.drawFloaters(ox, oy, T);
  }

  drawObject(o, def, ox, oy, S, T, highlight, frame = 0) {
    const spr = objectSprite(o, def, frame);
    const x = ox + o.x * T - S;
    const y = oy + (o.y + def.h) * T - (def.ah + 1) * S;
    const { ctx } = this;
    if (highlight) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 216, 77, 1)';
      ctx.shadowBlur = 16 * this.dpr;
      ctx.drawImage(spr, x, y, spr.width * S, spr.height * S);
      ctx.restore();
    } else {
      ctx.drawImage(spr, x, y, spr.width * S, spr.height * S);
    }
  }

  drawPlayer(p, ox, oy, S, T) {
    const { ctx } = this;
    const sit = this.isSitting(p);
    const cx = ox + (p.rx + 0.5) * T;
    const by = oy + (p.ry + 1) * T;
    if (!sit) {
      ctx.fillStyle = 'rgba(20,10,40,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, by - 4 * S, 7 * S, 2.5 * S, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (onStage(this.app.world, p)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, by - 20 * S, 0, cx, by - 20 * S, 26 * S);
      g.addColorStop(0, 'rgba(255,190,240,.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 26 * S, by - 46 * S, 52 * S, 52 * S);
      ctx.restore();
    }
    const spr = avatarSprite(p.avatar, p.dir, p.frame(), sit);
    const dy = by - 43 * S - (sit ? 4 * S : 0);
    ctx.drawImage(spr, Math.round(cx - 13 * S), Math.round(dy), 26 * S, 42 * S);
    p._cx = cx;
    p._top = dy + 2 * S;
  }

  drawOverhead(p, S) {
    if (p._top === undefined) return;
    const { ctx } = this;
    const dpr = this.dpr;
    const isMe = p === this.app.me;
    let y = p._top - 2 * dpr;

    ctx.font = `700 ${11.5 * dpr}px ${FONT}`;
    ctx.textBaseline = 'middle';
    const lv = `Lv${p.level || 1}`;
    const label = p.name;
    const lvW = ctx.measureText(lv).width + 8 * dpr;
    const tw = ctx.measureText(label).width;
    const pad = 6 * dpr;
    const dot = 7 * dpr;
    const extra = (p.media && p.media.on && !p.media.mic ? 14 : 0) * dpr + (onStage(this.app.world, p) ? 16 * dpr : 0);
    const w = lvW + tw + pad * 2 + dot + 5 * dpr + extra;
    const h = 19 * dpr;
    const x = p._cx - w / 2;
    y -= h;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = isMe ? 'rgba(36, 30, 70, 0.92)' : 'rgba(36, 30, 70, 0.8)';
    ctx.fill();
    if (isMe) { ctx.strokeStyle = 'rgba(255, 216, 77, .8)'; ctx.lineWidth = 1.2 * dpr; ctx.stroke(); }
    // nível
    roundRect(ctx, x + 2 * dpr, y + 2 * dpr, lvW, h - 4 * dpr, (h - 4 * dpr) / 2);
    ctx.fillStyle = '#ffd84d';
    ctx.fill();
    ctx.fillStyle = '#3a2a00';
    ctx.fillText(lv, x + 6 * dpr, y + h / 2 + 0.5 * dpr);
    let cx = x + 2 * dpr + lvW + 5 * dpr;
    ctx.fillStyle = STATUS_COLORS[p.status] || STATUS_COLORS.online;
    ctx.beginPath();
    ctx.arc(cx + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2);
    ctx.fill();
    cx += dot + 4 * dpr;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, y + h / 2 + 0.5 * dpr);
    cx += tw + 3 * dpr;
    ctx.font = `${11 * dpr}px ${FONT}`;
    if (p.media && p.media.on && !p.media.mic) { ctx.fillText('🔇', cx, y + h / 2); cx += 14 * dpr; }
    if (onStage(this.app.world, p)) ctx.fillText('📢', cx, y + h / 2);

    // buffs e música
    const icons = p.activeBuffs().map((b) => b.e);
    if (p.music) icons.push('🎵');
    if (p.media && p.media.screen) icons.push('🖥️');
    if (icons.length) {
      ctx.font = `${13 * dpr}px ${FONT}`;
      ctx.textAlign = 'center';
      const sp = 16 * dpr;
      icons.slice(0, 5).forEach((e, i) => ctx.fillText(e, p._cx + (i - (Math.min(icons.length, 5) - 1) / 2) * sp, y - 8 * dpr));
      ctx.textAlign = 'left';
      y -= 16 * dpr;
    }

    const now = performance.now();
    if (p.bubble && now - p.bubble.t < 6000) {
      ctx.font = `600 ${12 * dpr}px ${FONT}`;
      const lines = wrap(ctx, p.bubble.text, 190 * dpr, 3);
      const lh = 15 * dpr;
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18 * dpr;
      const bh = lines.length * lh + 10 * dpr;
      const bx = p._cx - bw / 2;
      const byy = y - bh - 9 * dpr;
      roundRect(ctx, bx, byy, bw, bh, 9 * dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#8fa6d8';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p._cx - 5 * dpr, byy + bh - 0.5);
      ctx.lineTo(p._cx, byy + bh + 6 * dpr);
      ctx.lineTo(p._cx + 5 * dpr, byy + bh - 0.5);
      ctx.fill();
      ctx.fillStyle = '#26243d';
      lines.forEach((l, i) => ctx.fillText(l, bx + 9 * dpr, byy + 5 * dpr + lh * i + lh / 2));
      y = byy - 4 * dpr;
    } else if (p.bubble) p.bubble = null;

    if (p.emote) {
      const age = (now - p.emote.t) / 1000;
      if (age > 2.6) p.emote = null;
      else {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (2.6 - age) * 2);
        ctx.font = `${24 * dpr}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(p.emote.e, p._cx, y - 14 * dpr - age * 14 * dpr + Math.sin(age * 8) * 2 * dpr);
        ctx.restore();
      }
    }
  }

  drawFloaters(ox, oy, T) {
    const { ctx } = this;
    const dpr = this.dpr;
    const now = performance.now();
    this.floaters = this.floaters.filter((f) => now - f.t < 1400);
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      const age = (now - f.t) / 1400;
      ctx.globalAlpha = 1 - age * age;
      ctx.font = `900 ${(f.big ? 22 : 17) * dpr * (1 + Math.max(0, 0.25 - age))}px ${FONT}`;
      const x = ox + f.x * T;
      const y = oy + f.y * T - age * 40 * dpr;
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = 'rgba(30,10,40,.85)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.restore();
  }

  drawZoneLabels(ox, oy, T) {
    const { ctx } = this;
    const dpr = this.dpr;
    ctx.font = `700 ${12 * dpr}px ${FONT}`;
    ctx.textBaseline = 'middle';
    for (const z of this.app.world.zones) {
      if (!z.name) continue;
      const icon = z.kind === 'private' ? '🔒 ' : z.kind === 'spotlight' ? '📢 ' : '';
      const text = icon + z.name;
      const w = ctx.measureText(text).width + 20 * dpr;
      const h = 22 * dpr;
      const x = ox + (z.x + z.w / 2) * T - w / 2;
      const y = oy + z.y * T + 6 * dpr;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = 'rgba(255,250,240,0.86)';
      ctx.fill();
      ctx.fillStyle = '#5b4a6e';
      ctx.fillText(text, x + 10 * dpr, y + h / 2 + 0.5 * dpr);
    }
  }

  drawGlows(ox, oy, S, T, time) {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.app.world.objects) {
      const def = OBJECTS[o.type];
      if (!def || !def.light) continue;
      if (!def.light.always && !(o.state && o.state.on)) continue;
      const cx = ox + (o.x + def.w / 2) * T;
      const cy = oy + (o.y + def.h) * T - def.ah * S * 0.75;
      const r = def.light.r * T * (1 + Math.sin(time * 3 + o.x) * 0.03);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, def.light.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  drawBadges(ox, oy, S, T) {
    const counts = this.app.feedCounts;
    if (!counts || !counts.size) return;
    const { ctx } = this;
    const dpr = this.dpr;
    ctx.font = `800 ${11 * dpr}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [id, n] of counts) {
      const o = this.app.world.get(id);
      if (!o || !n) continue;
      const def = OBJECTS[o.type];
      const x = ox + (o.x + def.w) * T - 4 * dpr;
      const y = oy + (o.y + def.h) * T - def.ah * S - 2 * dpr;
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(n > 9 ? '9+' : String(n), x, y + 0.5 * dpr);
    }
    ctx.textAlign = 'left';
  }

  drawPrivateDim(ox, oy, T, cw, ch) {
    const z = this.app.world.privateZoneAt(this.app.me.x, this.app.me.y);
    if (!z) return;
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.rect(ox + z.x * T, oy + z.y * T, z.w * T, z.h * T);
    ctx.fillStyle = 'rgba(14, 8, 30, 0.5)';
    ctx.fill('evenodd');
    ctx.restore();
  }

  drawBuild(ox, oy, S, T) {
    const { ctx, app } = this;
    const b = app.build;
    const dpr = this.dpr;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= app.world.width; x++) { ctx.moveTo(ox + x * T + 0.5, oy); ctx.lineTo(ox + x * T + 0.5, oy + app.world.height * T); }
    for (let y = 0; y <= app.world.height; y++) { ctx.moveTo(ox, oy + y * T + 0.5); ctx.lineTo(ox + app.world.width * T, oy + y * T + 0.5); }
    ctx.stroke();

    for (const z of app.world.zones) {
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeStyle = ZONE_COLORS[z.kind] || ZONE_COLORS.area;
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(ox + z.x * T, oy + z.y * T, z.w * T, z.h * T);
    }
    ctx.setLineDash([]);
    if (app.world.map.spawn) {
      const s = app.world.map.spawn;
      ctx.font = `${18 * dpr}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📍', ox + (s.x + 0.5) * T, oy + (s.y + 0.5) * T);
    }

    const h = b.hover;
    if (h) {
      if (b.drag) {
        const r = normRect(b.drag.start, b.drag.end);
        ctx.fillStyle = b.tab === 'zones' ? 'rgba(255, 201, 60, 0.18)' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(ox + r.x * T, oy + r.y * T, r.w * T, r.h * T);
        ctx.strokeStyle = '#ffc93c';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(ox + r.x * T, oy + r.y * T, r.w * T, r.h * T);
      } else if (b.tab === 'objects' && b.tool === 'place' && OBJECTS[b.item]) {
        const def = OBJECTS[b.item];
        const ok = app.buildPanel.canPlace(b.item, h.x, h.y);
        ctx.globalAlpha = 0.65;
        this.drawObject({ id: 'ghost', type: b.item, x: h.x, y: h.y, color: b.color, state: { on: true } }, def, ox, oy, S, T, false);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ok ? '#3ddc84' : '#ff5d5d';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(ox + h.x * T, oy + h.y * T, def.w * T, def.h * T);
      } else if (b.tab === 'objects' && b.tool !== 'place') {
        const o = app.buildPanel.objectAt(h.x, h.y);
        if (o) {
          const def = OBJECTS[o.type];
          ctx.fillStyle = b.tool === 'erase' ? 'rgba(255, 93, 93, 0.25)' : 'rgba(93, 179, 255, 0.25)';
          ctx.fillRect(ox + o.x * T, oy + o.y * T, def.w * T, def.h * T);
          ctx.strokeStyle = b.tool === 'erase' ? '#ff5d5d' : '#5db3ff';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(ox + o.x * T, oy + o.y * T, def.w * T, def.h * T);
        }
      } else {
        ctx.strokeStyle = '#ffc93c';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(ox + h.x * T, oy + h.y * T, T, T);
      }
    }
    ctx.restore();
  }
}

export function normRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines.map((l) => (ctx.measureText(l).width > maxW ? `${l.slice(0, 26)}…` : l));
}
