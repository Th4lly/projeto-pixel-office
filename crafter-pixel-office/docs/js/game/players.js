// Jogadores: posição em tiles (x, y) e posição suavizada para desenho (rx, ry).
import { normalizeAvatar } from '../art/avatar.js';

export const SPEED = 5.5; // tiles por segundo

const FIELDS = ['name', 'status', 'media', 'guest', 'admin', 'dir', 'uid', 'level', 'buffs', 'music', 'statusText', 'call', 'hp', 'maxHp', 'sp', 'maxSp', 'dead', 'cls', 'baseLevel', 'statuses', 'action', 'actionStart'];

export class Player {
  constructor(data) {
    this.id = data.id;
    this.avatar = normalizeAvatar(null);
    this.media = { on: false, cam: false, mic: false, screen: false };
    this.status = 'online';
    this.dir = 'down';
    this.level = 1;
    this.buffs = [];
    this.apply(data);
    this.rx = this.x;
    this.ry = this.y;
    this.moving = false;
    this.walkT = 0;
    this.animT = 0;
    this.bubble = null;
    this.emote = null;
  }

  apply(d, { position = true } = {}) {
    for (const k of FIELDS) if (d[k] !== undefined) this[k] = d[k];
    if (d.action && d.actionStart) { this.actionUntil = performance.now() + 450; this.actionStart = performance.now(); }
    if (d.avatar !== undefined) {
      this.hasAvatar = !!d.avatar;
      this.avatar = normalizeAvatar(d.avatar);
    }
    if (position && Number.isInteger(d.x) && Number.isInteger(d.y)) {
      this.x = d.x;
      this.y = d.y;
    }
  }

  snap() {
    this.rx = this.x;
    this.ry = this.y;
  }

  update(dt) {
    const dx = this.x - this.rx;
    const dy = this.y - this.ry;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) this.snap();
    else if (dist > 1e-4) {
      const s = SPEED * dt;
      if (s >= dist) this.snap();
      else { this.rx += (dx / dist) * s; this.ry += (dy / dist) * s; }
      this.walkT = 0.14;
    } else this.snap();
    this.walkT -= dt;
    this.moving = this.walkT > 0;
    this.animT = this.moving ? this.animT + dt : 0;
  }

  frame() {
    return this.moving ? Math.floor(this.animT * 8) % 4 : 0;
  }

  activeBuffs() {
    const now = Date.now();
    return (this.buffs || []).filter((b) => b.until > now);
  }
}

const VEC = {
  up: { dx: 0, dy: -1, dir: 'up' },
  down: { dx: 0, dy: 1, dir: 'down' },
  left: { dx: -1, dy: 0, dir: 'left' },
  right: { dx: 1, dy: 0, dir: 'right' },
};

const dirFrom = (dx, dy) => (dx > 0 ? 'right' : dx < 0 ? 'left' : dy < 0 ? 'up' : 'down');

export class LocalPlayer extends Player {
  constructor(data) {
    super(data);
    this.path = null;
    this.pendingInteract = null;
  }

  /** Anda de tile em tile (como no Gather). */
  step(dt, input, world, onMove) {
    if (this.rx === this.x && this.ry === this.y) {
      const key = input.direction();
      let d = key ? VEC[key] : null;
      let fromPath = false;
      if (d) {
        this.path = null;
        this.pendingInteract = null;
      } else if (this.path && this.path.length) {
        const n = this.path[0];
        d = { dx: n.x - this.x, dy: n.y - this.y };
        d.dir = dirFrom(d.dx, d.dy);
        fromPath = true;
      }
      if (d) {
        const changed = this.dir !== d.dir;
        this.dir = d.dir;
        const nx = this.x + d.dx;
        const ny = this.y + d.dy;
        if (Math.abs(d.dx) + Math.abs(d.dy) === 1 && world.walkable(nx, ny)) {
          this.x = nx;
          this.y = ny;
          if (fromPath) this.path.shift();
          onMove(true);
        } else {
          this.path = null;
          if (changed) onMove(false);
        }
      }
    }
    this.update(dt);
  }
}
