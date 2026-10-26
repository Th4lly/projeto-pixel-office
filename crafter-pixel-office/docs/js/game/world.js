// Modelo do mapa: pisos, objetos, áreas, colisão e busca de caminho.
import { OBJECTS } from '../art/objects.js';
import { FLOORS } from '../art/tiles.js';

const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class World {
  constructor(data) {
    this.load(data);
  }

  load({ map, objects, zones }) {
    this.map = map;
    this.objects = objects || [];
    this.zones = zones || [];
    this.reindex();
  }

  get width() { return this.map.width; }
  get height() { return this.map.height; }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  floorAt(x, y) {
    return this.inBounds(x, y) ? this.map.floor[y * this.width + x] : 'void';
  }

  isWall(x, y) {
    const f = FLOORS[this.floorAt(x, y)];
    return !!(f && f.wall);
  }

  reindex() {
    const n = this.width * this.height;
    this.solid = new Uint8Array(n);
    this.seats = new Array(n).fill(null);
    this.byId = new Map();
    for (const o of this.objects) {
      this.byId.set(o.id, o);
      const d = OBJECTS[o.type];
      if (!d) continue;
      const blocks = d.solid || (d.door && !(o.state && o.state.open));
      for (let y = o.y; y < o.y + d.h; y++) {
        for (let x = o.x; x < o.x + d.w; x++) {
          if (!this.inBounds(x, y)) continue;
          const i = y * this.width + x;
          if (blocks) this.solid[i] = 1;
          if (d.sit) this.seats[i] = o;
        }
      }
    }
  }

  walkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const f = FLOORS[this.floorAt(x, y)];
    if (!f || f.solid) return false;
    return !this.solid[y * this.width + x];
  }

  seatAt(x, y) {
    return this.inBounds(x, y) ? this.seats[y * this.width + x] : null;
  }

  get(id) {
    return this.byId.get(id);
  }

  objectsAt(x, y) {
    return this.objects.filter((o) => {
      const d = OBJECTS[o.type];
      return d && x >= o.x && x < o.x + d.w && y >= o.y && y < o.y + d.h;
    });
  }

  zonesAt(x, y) {
    return this.zones.filter((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
  }

  /** Área mais relevante: privada > destaque > arenas > mesa > comum. */
  zoneAt(x, y) {
    const list = this.zonesAt(x, y);
    return list.find((z) => z.kind === 'private') || list.find((z) => z.kind === 'spotlight') || list.find((z) => z.kind === 'pvp')
      || list.find((z) => z.kind === 'arena') || list.find((z) => z.kind === 'desk') || list[0] || null;
  }

  pvpAt(x, y) {
    return this.zonesAt(x, y).find((z) => z.kind === 'pvp') || null;
  }

  arenaAt(x, y) {
    return this.zonesAt(x, y).find((z) => z.kind === 'arena' || z.kind === 'pvp') || null;
  }

  /** Mesa dentro de uma área de mesa. */
  deskOfZone(z) {
    if (!z) return null;
    return this.objects.find((o) => {
      const d = OBJECTS[o.type];
      return d && d.desk && o.x >= z.x && o.y >= z.y && o.x < z.x + z.w && o.y < z.y + z.h;
    }) || null;
  }

  deskZoneOf(desk) {
    return this.zones.find((z) => z.kind === 'desk' && desk.x >= z.x && desk.y >= z.y && desk.x < z.x + z.w && desk.y < z.y + z.h) || null;
  }

  /** A mesa da pessoa (reivindicada por uid). */
  deskOf(uid) {
    return this.objects.find((o) => OBJECTS[o.type] && OBJECTS[o.type].desk && o.data && o.data.owner && o.data.owner.uid === uid) || null;
  }

  privateZoneAt(x, y) {
    return this.zonesAt(x, y).find((z) => z.kind === 'private') || null;
  }

  spotlightAt(x, y) {
    return this.zonesAt(x, y).find((z) => z.kind === 'spotlight') || null;
  }

  distanceToObject(o, x, y) {
    const d = OBJECTS[o.type];
    if (!d) return Infinity;
    const dx = Math.max(o.x - x, 0, x - (o.x + d.w - 1));
    const dy = Math.max(o.y - y, 0, y - (o.y + d.h - 1));
    return Math.max(dx, dy);
  }

  /** Objeto interativo mais próximo (a até 1 tile). Cadeiras e tapetes ficam de fora: interagem sozinhos. */
  interactableNear(x, y) {
    let best = null;
    let bestScore = Infinity;
    for (const o of this.objects) {
      const d = OBJECTS[o.type];
      if (!d || !d.interact || d.interact === 'sit' || d.flat) continue;
      if (!d.functional && d.interact === 'inspect') continue;
      const dist = this.distanceToObject(o, x, y);
      if (dist > 1) continue;
      const score = Math.abs(o.x + d.w / 2 - 0.5 - x) + Math.abs(o.y + d.h / 2 - 0.5 - y);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best;
  }

  portalAt(x, y) {
    return this.objects.find((o) => o.type === 'portal' && o.x === x && o.y === y) || null;
  }

  nextPortal(from) {
    const list = this.objects.filter((o) => o.type === 'portal').sort((a, b) => (a.id < b.id ? -1 : 1));
    if (list.length < 2) return null;
    const i = list.indexOf(from);
    return list[(i + 1) % list.length];
  }

  /** Tile livre ao redor de (x, y) — usado para sair do portal. */
  freeAround(x, y) {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
      if (this.walkable(x + dx, y + dy) && !this.portalAt(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
    return { x, y };
  }

  /** Aplica operações de edição (também recebidas dos outros em tempo real). */
  apply(ops) {
    let floor = false;
    let objects = false;
    for (const op of ops) {
      switch (op.t) {
        case 'floor':
          for (const [x, y, t] of op.cells) if (this.inBounds(x, y) && FLOORS[t]) this.map.floor[y * this.width + x] = t;
          floor = true;
          break;
        case 'add':
          if (!this.byId.has(op.obj.id)) { this.objects.push({ state: {}, data: {}, ...op.obj }); objects = true; }
          break;
        case 'del': {
          const i = this.objects.findIndex((o) => o.id === op.id);
          if (i >= 0) { this.objects.splice(i, 1); objects = true; }
          break;
        }
        case 'state': {
          const o = this.byId.get(op.id);
          if (o) { o.state = op.state || {}; objects = true; }
          break;
        }
        case 'data': {
          const o = this.byId.get(op.id);
          if (o) o.data = op.data || {};
          break;
        }
        case 'zone':
          this.zones = this.zones.filter((z) => z.id !== op.zone.id);
          this.zones.push(op.zone);
          break;
        case 'zdel':
          this.zones = this.zones.filter((z) => z.id !== op.id);
          break;
        case 'spawn':
          this.map.spawn = { x: op.x, y: op.y };
          break;
        case 'settings':
          if (op.openEdit !== undefined) this.map.openEdit = op.openEdit;
          break;
        default:
      }
    }
    if (objects) this.reindex();
    return { floor, objects };
  }

  /** BFS até o primeiro tile que satisfaça goal(x, y). */
  pathTo(sx, sy, goal, maxNodes = 9000) {
    if (goal(sx, sy)) return [];
    const W = this.width;
    const prev = new Int32Array(W * this.height).fill(-1);
    const start = sy * W + sx;
    prev[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length && queue.length < maxNodes; head++) {
      const i = queue[head];
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.walkable(nx, ny)) continue;
        const ni = ny * W + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = i;
        if (goal(nx, ny)) {
          const path = [];
          for (let k = ni; k !== start; k = prev[k]) path.push({ x: k % W, y: (k / W) | 0 });
          return path.reverse();
        }
        queue.push(ni);
      }
    }
    return null;
  }
}

/** Mesma regra para todos: área privada isola; fora dela vale a distância. */
export function isNear(world, a, b, proximity) {
  const za = world.privateZoneAt(a.x, a.y);
  const zb = world.privateZoneAt(b.x, b.y);
  if (za || zb) return !!(za && zb && za.id === zb.id);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= proximity;
}

/** Está falando no palco (área de destaque) com microfone ligado? */
export function onStage(world, p) {
  return !!(p && p.media && p.media.on && p.media.mic && world.spotlightAt(p.x, p.y));
}
