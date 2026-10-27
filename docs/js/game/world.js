// Modelo do mapa em camadas, numa grade de 32×32 px:
//   • Fundo (background): pisos/paredes por tile e, opcionalmente, uma imagem inteira (map.bg)
//   • Objetos: itens do catálogo (giráveis), cada um com interação
//   • Frente (foreground): tiles (map.fg) e/ou imagem (map.fgImg) desenhados por cima do avatar
//   • Efeitos de tile (map.fx), invisíveis: intransitável, área privada (ID), destaque, portal, spawn
// Mais as áreas nomeadas (zones) usadas para nomes de salas, mesas e arenas.
import { OBJECTS, dims } from '../art/objects.js';
import { FLOORS } from '../art/tiles.js';

const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
export const key = (x, y) => `${x},${y}`;

/** Efeitos de tile. Códigos guardados em map.fx["x,y"]. */
export const FX = {
  x: { name: 'Intransitável', color: 'rgba(255, 70, 70, .45)', desc: 'Barreira invisível: ninguém passa.' },
  w: { name: 'Passável', color: 'rgba(70, 220, 120, .40)', desc: 'Libera a passagem mesmo sobre parede/objeto (útil com fundo importado).' },
  p: { name: 'Área privada', color: 'rgba(255, 201, 60, .40)', desc: 'Mesmo ID = mesma conversa; só quem está dentro se vê e se ouve.' },
  s: { name: 'Destaque', color: 'rgba(255, 120, 200, .45)', desc: 'Quem pisa aqui é ouvido e visto por todos.' },
  o: { name: 'Portal', color: 'rgba(110, 200, 255, .50)', desc: 'Teletransporta para o destino escolhido.' },
  n: { name: 'Spawn', color: 'rgba(160, 120, 255, .50)', desc: 'Onde as pessoas aparecem ao entrar.' },
};

export function parseFx(code) {
  if (!code) return null;
  const t = code[0];
  if (t === 'p') return { t, id: code.slice(2) || 'A' };
  if (t === 'o') {
    const [x, y] = code.slice(2).split(',').map(Number);
    return { t, x, y };
  }
  return { t };
}

export class World {
  constructor(data) {
    this.load(data);
  }

  load({ map, objects, zones }) {
    this.map = map;
    if (!this.map.fg || typeof this.map.fg !== 'object') this.map.fg = {};
    if (!this.map.fx || typeof this.map.fx !== 'object') this.map.fx = {};
    this.objects = objects || [];
    this.doors = new Map();
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

  fgAt(x, y) {
    return this.map.fg[key(x, y)] || null;
  }

  fxAt(x, y) {
    return parseFx(this.map.fx[key(x, y)]);
  }

  updateDoors(players, dt) {
    for (const o of this.objects) {
      if (!OBJECTS[o.type]?.door) continue;
      const state = this.doors.get(o.id) || { progress: 0, hold: 0 };
      const near = [...players.values()].some(p => Math.abs(p.rx - o.x) <= 1.8 && Math.abs(p.ry - o.y) <= 1.8);
      state.hold = near ? 0.9 : Math.max(0, state.hold - dt);
      const open = !!o.state?.open || (o.data?.auto !== false && state.hold > 0);
      state.progress = Math.max(0, Math.min(1, state.progress + (open ? 1 : -1) * dt / 0.22));
      this.doors.set(o.id, state);
    }
  }

  /** Área no chão do objeto, considerando a rotação. */
  dimsOf(o) {
    return dims(o, OBJECTS[o.type]);
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
      const { w, h } = this.dimsOf(o);
      const blocks = (d.solid && !d.wall) || (d.door && o.data?.auto === false && !(o.state && o.state.open));
      for (let y = o.y; y < o.y + h; y++) {
        for (let x = o.x; x < o.x + w; x++) {
          if (!this.inBounds(x, y)) continue;
          const i = y * this.width + x;
          if (blocks) this.solid[i] = 1;
          if (d.sit) this.seats[i] = o;
        }
      }
    }
    this.spawns = Object.entries(this.map.fx).filter(([, c]) => c === 'n').map(([k]) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
  }

  walkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const fx = this.map.fx[key(x, y)];
    if (fx === 'x') return false;
    if (fx === 'w') return true;
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
      if (!OBJECTS[o.type]) return false;
      const { w, h } = this.dimsOf(o);
      return x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
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

  /** Área privada: primeiro pelo efeito de tile (ID), depois pela área nomeada. */
  privateZoneAt(x, y) {
    const fx = this.fxAt(x, y);
    if (fx && fx.t === 'p') {
      const named = this.zonesAt(x, y).find((z) => z.kind === 'private' || z.kind === 'desk');
      return { id: `fx:${fx.id}`, name: named ? named.name : `Área ${fx.id}`, kind: 'private', fx: true };
    }
    const zs = this.zonesAt(x, y);
    const priv = zs.find((z) => z.kind === 'private');
    if (priv) return priv;
    // mesa reivindicada vira área privada do dono (dá para desligar no painel da mesa)
    const dz = zs.find((z) => z.kind === 'desk');
    if (dz) {
      const desk = this.deskOfZone(dz);
      const meta = Array.isArray(desk && desk.data && desk.data.decor) ? desk.data.decor.find((d) => d && d.meta) : null;
      if (desk && desk.data && desk.data.owner && desk.data.private !== false && !(meta && meta.private === false)) return { id: dz.id, name: `Mesa de ${desk.data.owner.name}`, kind: 'private', desk: true };
    }
    return null;
  }

  spotlightAt(x, y) {
    const fx = this.fxAt(x, y);
    if (fx && fx.t === 's') return { id: 'fx:spot', name: 'Destaque', kind: 'spotlight' };
    return this.zonesAt(x, y).find((z) => z.kind === 'spotlight') || null;
  }

  distanceToObject(o, x, y) {
    if (!OBJECTS[o.type]) return Infinity;
    const { w, h } = this.dimsOf(o);
    const dx = Math.max(o.x - x, 0, x - (o.x + w - 1));
    const dy = Math.max(o.y - y, 0, y - (o.y + h - 1));
    return Math.max(dx, dy);
  }

  /** Objeto interativo mais próximo (a até 1 tile). Todos os móveis interagem; assentos e tapetes só pelo clique/andar. */
  interactableNear(x, y) {
    let best = null;
    let bestScore = Infinity;
    for (const o of this.objects) {
      const d = OBJECTS[o.type];
      if (!d || d.flat) continue;
      if (d.sit && !(o.data && o.data.action)) continue;
      const dist = this.distanceToObject(o, x, y);
      if (dist > 1) continue;
      const { w, h } = this.dimsOf(o);
      const score = Math.abs(o.x + w / 2 - 0.5 - x) + Math.abs(o.y + h / 2 - 0.5 - y) + (d.functional || d.npc ? -0.6 : 0);
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
    if (this.walkable(x, y) && !this.portalAt(x, y) && !(this.fxAt(x, y) || {}).t) return { x, y };
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0]]) {
      const fx = this.fxAt(x + dx, y + dy);
      if (this.walkable(x + dx, y + dy) && !this.portalAt(x + dx, y + dy) && !(fx && fx.t === 'o')) return { x: x + dx, y: y + dy };
    }
    return { x, y };
  }

  /** Aplica operações de edição (também recebidas dos outros em tempo real). */
  apply(ops) {
    let floor = false;
    let objects = false;
    let layers = false;
    for (const op of ops) {
      switch (op.t) {
        case 'floor':
          for (const [x, y, t] of op.cells) if (this.inBounds(x, y) && FLOORS[t]) this.map.floor[y * this.width + x] = t;
          floor = true;
          break;
        case 'layer': {
          // op.layer = 'fg' | 'fx'; cells = [[x, y, valor ou null]]
          const L = this.map[op.layer] || (this.map[op.layer] = {});
          for (const [x, y, v] of op.cells) {
            if (!this.inBounds(x, y)) continue;
            if (v === null || v === undefined || v === '') delete L[key(x, y)]; else L[key(x, y)] = v;
          }
          layers = true;
          if (op.layer === 'fx') objects = true; // recalcula spawns
          break;
        }
        case 'image':
          // op.which = 'bg' | 'fgImg'
          this.map[op.which] = op.value || null;
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
        case 'move': {
          const o = this.byId.get(op.id);
          if (o) {
            if (op.x !== undefined) { o.x = op.x; o.y = op.y; }
            if (op.rot !== undefined) o.rot = op.rot;
            if (op.flip !== undefined) o.flip = op.flip;
            objects = true;
          }
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
    return { floor: floor || layers, objects, layers };
  }

  /** BFS em 8 direções (sem cortar quina) até o primeiro tile que satisfaça goal(x, y). */
  pathTo(sx, sy, goal, maxNodes = 12000) {
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
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && !(this.walkable(x + dx, y) && this.walkable(x, y + dy))) continue;
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
