// Desenha o escritório com os sprites da pasta: camada de piso em cache + objetos,
// mesas decoradas, monstros e avatares ordenados por profundidade.
import { onAssetLoad, TILE, loadUrl } from '../art/assets.js';
import { FLOORS, paintFloor, paintWall } from '../art/tiles.js';
import { OBJECTS, drawObjectSprite, objectHeight, dims, rotOf } from '../art/objects.js';
import { dirFromAngle } from './dirs.js';
import { FX, parseFx } from './world.js';
import { drawAvatar, drawPet, drawWeapon } from '../art/avatar.js';
import { onStage } from './world.js';
import { drawDecorItem } from '../features/desks.js';
import { IDX, image, drawFrame, frameAt } from '../art/assets.js';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];
const STATUS_COLORS = { online: '#3ddc84', busy: '#ff5d5d', away: '#ffc93c' };
const FONT = 'Nunito, Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const ZONE_COLORS = { private: 'rgba(255, 201, 60, .9)', spotlight: 'rgba(255, 120, 200, .9)', area: 'rgba(255,255,255,.55)', arena: 'rgba(255, 80, 80, .9)', pvp: 'rgba(255, 40, 40, 1)' };

export class Renderer {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.zoomIdx = window.innerWidth > 1700 ? 4 : 3;
    this.layer = null;
    this.dirty = true;
    this.ox = 0;
    this.oy = 0;
    this.floaters = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    onAssetLoad(() => { this.dirty = true; });
  }

  get dpr() { return window.devicePixelRatio || 1; }
  /** pixels de tela por pixel de mundo */
  get S() { return ZOOMS[this.zoomIdx] * this.dpr; }
  get T() { return TILE * this.S; }

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
    const W = w.width * TILE;
    const H = w.height * TILE;
    if (!this.layer || this.layer.width !== W || this.layer.height !== H) {
      this.layer = document.createElement('canvas');
      this.layer.width = W;
      this.layer.height = H;
    }
    const ctx = this.layer.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    let complete = true;
    // fundo importado (imagem inteira, 1 px = 1 px de mundo, grade de 32)
    if (w.map.bg && w.map.bg.url) {
      const img = loadUrl(w.map.bg.url);
      if (img) ctx.drawImage(img, 0, 0, w.map.bg.w || img.naturalWidth, w.map.bg.h || img.naturalHeight); else complete = false;
    }
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const t = w.floorAt(x, y);
        const f = FLOORS[t] || FLOORS.void;
        const ok = f.wall ? paintWall(ctx, t, x, y, !w.isWall(x, y + 1)) : paintFloor(ctx, t, x, y);
        if (!ok) complete = false;
        if (!f.wall && t !== 'void' && w.isWall(x, y - 1)) {
          const g = ctx.createLinearGradient(0, y * TILE, 0, y * TILE + 10);
          g.addColorStop(0, 'rgba(20,12,30,.42)');
          g.addColorStop(1, 'rgba(20,12,30,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x * TILE, y * TILE, TILE, 10);
        }
      }
    }
    for (const o of w.objects) {
      const def = OBJECTS[o.type];
      if (!def || !def.flat) continue;
      if (!drawObjectSprite(ctx, o, def, o.x * TILE, o.y * TILE, 1, 0)) complete = false;
    }
    // camada da frente (fica por cima do avatar)
    if (!this.fgLayer || this.fgLayer.width !== W || this.fgLayer.height !== H) {
      this.fgLayer = document.createElement('canvas');
      this.fgLayer.width = W;
      this.fgLayer.height = H;
    }
    const fctx = this.fgLayer.getContext('2d');
    fctx.imageSmoothingEnabled = false;
    fctx.clearRect(0, 0, W, H);
    this.hasFg = false;
    for (const [k, t] of Object.entries(w.map.fg || {})) {
      const [x, y] = k.split(',').map(Number);
      const F = FLOORS[t];
      if (!F) continue;
      this.hasFg = true;
      if (!(F.wall ? paintWall(fctx, t, x, y, true) : paintFloor(fctx, t, x, y))) complete = false;
    }
    if (w.map.fgImg && w.map.fgImg.url) {
      const img = loadUrl(w.map.fgImg.url);
      if (img) { fctx.drawImage(img, 0, 0, w.map.fgImg.w || img.naturalWidth, w.map.fgImg.h || img.naturalHeight); this.hasFg = true; } else complete = false;
    }
    this.dirty = false;
    this.complete = complete;
  }

  draw(time) {
    const { ctx, app } = this;
    const S = this.S;
    const T = this.T;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (this.dirty) this.buildLayer();

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

    const vx0 = -ox / T - 6, vy0 = -oy / T - 6, vx1 = (cw - ox) / T + 6, vy1 = (ch - oy) / T + 6;
    const items = [];
    for (const o of app.world.objects) {
      const def = OBJECTS[o.type];
      if (!def || def.flat) continue;
      const dm = dims(o, def);
      if (o.x + dm.w < vx0 || o.x > vx1 || o.y + dm.h < vy0 || o.y > vy1) continue;
      let z = def.wall ? o.y - 0.5 : def.small ? o.y + dm.h + 0.05 : o.y + dm.h - (def.walk ? 0.9 : 0);
      // cadeira de costas (virada para cima): o encosto fica na frente de quem senta
      if (def.sit) { const a = rotOf(o, def); if (a > 100 && a < 260) z = o.y + dm.h + 0.01; }
      items.push({ z, o, def });
      if (def.desk && o.data && Array.isArray(o.data.decor) && o.data.decor.length && app.desks) {
        const zone = app.desks.zoneOf(o);
        for (const d of o.data.decor) {
          const dz = d.layer === 'top' ? z + 0.01 : zone.y + d.dy / TILE;
          items.push({ z: dz, draw: (c, ox2, oy2, S2) => drawDecorItem(c, d, ox2 + (zone.x * TILE + d.dx) * S2, oy2 + (zone.y * TILE + d.dy) * S2, S2, time) });
        }
      }
    }
    for (const p of app.players.values()) items.push({ z: p.ry + 1.001 + (this.isSitting(p) ? 0.002 : 0), p });
    if (app.combat) app.combat.collect(items, vx0, vy0, vx1, vy1);
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.o) this.drawObject(it.o, it.def, ox, oy, S, T, it.o === app.target, time);
      else if (it.p) this.drawPlayer(it.p, ox, oy, S, T, time);
      else if (it.draw) it.draw(ctx, ox, oy, S, T, time);
    }

    this.drawForeground(ox, oy, S, T);
    this.drawGlows(ox, oy, S, T, time);
    this.drawZoneLabels(ox, oy, T);
    this.drawBadges(ox, oy, S, T);
    this.drawPrivateDim(ox, oy, T, cw, ch);
    if (app.build.on) this.drawBuild(ox, oy, S, T);
    if (app.build.on && (app.build.tab === 'effects' || app.build.showFx)) this.drawEffects(ox, oy, S, T);
    if (app.combat) app.combat.drawOverlay(ctx, ox, oy, S, T, time);
    for (const p of app.players.values()) this.drawOverhead(p, S);
    this.drawFloaters(ox, oy, T);
  }

  drawObject(o, def, ox, oy, S, T, highlight, time = 0) {
    const { ctx } = this;
    const x0 = ox + o.x * T;
    const y0 = oy + o.y * T;
    const sk = this.app.desks && this.app.desks.skinFor(o);
    let oo = o;
    let dd = def;
    if (sk) {
      oo = { ...o, type: sk.type, color: sk.color || o.color, rot: sk.rot || o.rot };
      const alt = OBJECTS[sk.type];
      // mantém a área do original: a mesa/cadeira trocada é desenhada no mesmo lugar
      dd = { ...alt, w: def.w, h: def.h };
    }
    if (highlight) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 216, 77, 1)';
      ctx.shadowBlur = 14 * this.dpr;
      drawObjectSprite(ctx, oo, dd, x0, y0, S, time);
      ctx.restore();
    } else {
      drawObjectSprite(ctx, oo, dd, x0, y0, S, time);
    }
  }

  drawPlayer(p, ox, oy, S, T, time = 0) {
    const { ctx } = this;
    const sit = this.isSitting(p);
    let cx = ox + (p.rx + 0.5) * T;
    const by = oy + (p.ry + 1) * T - 3 * S;
    const action = p.action && p.actionUntil > performance.now() ? p.action : p.dead ? 'dead' : sit ? 'sit' : p.moving ? 'walk' : 'stand';
    const seat = sit ? this.app.world.seatAt(p.x, p.y) : null;
    const dir = seat ? dirFromAngle(rotOf(seat)) : p.dir;
    const sox = seat && seat.data && seat.data.ox ? seat.data.ox * S : 0;
    cx += sox;
    if (!sit) {
      ctx.fillStyle = 'rgba(20,10,40,0.28)';
      ctx.beginPath();
      ctx.ellipse(cx, by - 1 * S, 9 * S, 3.2 * S, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (onStage(this.app.world, p)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, by - 26 * S, 0, cx, by - 26 * S, 34 * S);
      g.addColorStop(0, 'rgba(255,190,240,.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 34 * S, by - 60 * S, 68 * S, 68 * S);
      ctx.restore();
    }
    drawPet(ctx, p.avatar, dir, time, cx, by, S);
    const t = action === 'walk' ? p.animT : action === 'attack' ? (performance.now() - p.actionStart) / 1000 : time;
    const top = drawAvatar(ctx, p.avatar, dir, action, t, cx, by + (sit ? -4 * S : 0), S, p.ghost ? 0.5 : 1);
    if (action === 'attack') drawWeapon(ctx, p.avatar, dir, cx, by, S, Math.min(1, t * 3));
    p._cx = cx;
    p._top = top;
  }

  /** Frente: por cima de todos. Perto de você fica transparente (dá para ver o avatar embaixo do teto/copa). */
  drawForeground(ox, oy, S, T) {
    if (!this.hasFg || !this.fgLayer) return;
    const { ctx } = this;
    const me = this.app.me;
    const W = this.fgLayer.width * S;
    const H = this.fgLayer.height * S;
    const under = this.app.world.fgAt(me.x, me.y) || this.app.world.fgAt(me.x, me.y - 1);
    if (!under) {
      ctx.drawImage(this.fgLayer, ox, oy, W, H);
      return;
    }
    const cx = ox + (me.rx + 0.5) * T;
    const cy = oy + (me.ry + 0.2) * T;
    const r = 2.4 * T;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    ctx.drawImage(this.fgLayer, ox, oy, W, H);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.fgLayer, ox, oy, W, H);
    ctx.restore();
  }

  /** Efeitos de tile (só no modo Construir). */
  drawEffects(ox, oy, S, T) {
    const { ctx } = this;
    const dpr = this.dpr;
    ctx.save();
    ctx.font = `800 ${10 * dpr}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [k, code] of Object.entries(this.app.world.map.fx || {})) {
      const [x, y] = k.split(',').map(Number);
      const fx = parseFx(code);
      if (!fx || !FX[fx.t]) continue;
      ctx.fillStyle = FX[fx.t].color;
      ctx.fillRect(ox + x * T + 1, oy + y * T + 1, T - 2, T - 2);
      ctx.fillStyle = '#fff';
      const label = fx.t === 'p' ? fx.id : fx.t === 'o' ? '⇢' : fx.t === 'n' ? '★' : fx.t === 's' ? '📢' : fx.t === 'x' ? '✕' : '✓';
      ctx.fillText(label, ox + (x + 0.5) * T, oy + (y + 0.5) * T);
      if (fx.t === 'o') {
        ctx.strokeStyle = 'rgba(110,200,255,.6)';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(ox + (x + 0.5) * T, oy + (y + 0.5) * T);
        ctx.lineTo(ox + (fx.x + 0.5) * T, oy + (fx.y + 0.5) * T);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // tiles da frente marcados
    ctx.strokeStyle = 'rgba(120, 255, 200, .7)';
    for (const k of Object.keys(this.app.world.map.fg || {})) {
      const [x, y] = k.split(',').map(Number);
      ctx.strokeRect(ox + x * T + 3, oy + y * T + 3, T - 6, T - 6);
    }
    ctx.restore();
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
        const ey = y - 14 * dpr - age * 14 * dpr + Math.sin(age * 8) * 2 * dpr;
        if (String(p.emote.e).startsWith('img:')) {
          const em = IDX.emotes.get(p.emote.e.slice(4));
          if (em && em.files) {
            const sid = em.files[Math.floor(age * 8) % em.files.length];
            const img = image(sid);
            if (img) ctx.drawImage(img, p._cx - 16 * S, ey - 30 * S, 32 * S, 32 * S);
          } else if (em) drawFrame(ctx, em.s, frameAt(em.frames, age, 8), p._cx, ey + 6 * dpr, S * 0.9);
        } else {
          ctx.font = `${24 * dpr}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(p.emote.e, p._cx, ey);
        }
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
      const icon = z.kind === 'private' ? '🔒 ' : z.kind === 'spotlight' ? '📢 ' : z.kind === 'pvp' ? '⚔️ ' : z.kind === 'arena' ? '🐉 ' : z.kind === 'desk' ? '🪑 ' : '';
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
      const dm = dims(o, def);
      const cx = ox + (o.x + dm.w / 2) * T;
      const cy = oy + (o.y + dm.h - objectHeight(def) * 0.75) * T;
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
      const dm = dims(o, def);
      const x = ox + (o.x + dm.w) * T - 4 * dpr;
      const y = oy + (o.y + dm.h - objectHeight(def)) * T - 2 * dpr;
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
        this.drawObject({ id: 'ghost', type: b.item, x: h.x, y: h.y, color: b.color, rot: b.rot, state: { on: true } }, def, ox, oy, S, T, false);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ok ? '#3ddc84' : '#ff5d5d';
        ctx.lineWidth = 2 * dpr;
        const gd = dims({ type: b.item, rot: b.rot }, def);
        ctx.strokeRect(ox + h.x * T, oy + h.y * T, gd.w * T, gd.h * T);
      } else if (b.tab === 'objects' && b.tool !== 'place') {
        const o = app.buildPanel.objectAt(h.x, h.y);
        if (o) {
          const def = OBJECTS[o.type];
          ctx.fillStyle = b.tool === 'erase' ? 'rgba(255, 93, 93, 0.25)' : 'rgba(93, 179, 255, 0.25)';
          const od = dims(o, def);
          ctx.fillRect(ox + o.x * T, oy + o.y * T, od.w * T, od.h * T);
          ctx.strokeStyle = b.tool === 'erase' ? '#ff5d5d' : '#5db3ff';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(ox + o.x * T, oy + o.y * T, od.w * T, od.h * T);
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
