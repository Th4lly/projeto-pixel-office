// Combate em tempo real com as regras do "Ragnarok d20" (features/d20.js).
// • Monstros só existem nas arenas (áreas "arena"); PvP só vale dentro da área "pvp".
// • Em cada arena, a pessoa com o menor id presente é a "autoridade": cria os monstros,
//   roda a IA e transmite o estado. Os outros só desenham e mandam os golpes.
// • Cada um rola os próprios ataques (d20 + DES + BAB vs CA) e guarda o próprio HP.
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { CAT, IDX, TILE, drawFrame, frameAt, findIn, frameCanvas } from '../art/assets.js';
import { OBJECTS } from '../art/objects.js';
import { blip } from '../audio.js';
import { dirFromVec } from '../game/dirs.js';
import {
  CLASSES, STATUS, ATTR_NAMES, classOf, sheet, mobSheet, attack, save, roll, d, ROUND_MS, ACTION_MS, addExp, expToNext,
} from './d20.js';

const MAX_MOBS = { arena: 4, boss: 3 };
const AGGRO = 5; // células
const SNAP_MS = 250;
const AI_MS = 250;
const RESPAWN_MS = 6000;
const uidm = () => `m${Math.random().toString(36).slice(2, 9)}`;

function mobDef(id) {
  return IDX.mobs.get(id);
}

const ALIAS = { walk: ['walk', 'run'], die: ['die', 'death'], attack: ['attack', 'run'], idle: ['idle'] };

function animOf(def, name) {
  const keys = ALIAS[name] || [name];
  const hit = def.anims && keys.map((k) => def.anims[k]).find(Boolean);
  const a = def.anims && (hit || def.anims.idle || Object.values(def.anims)[0]);
  if (!a) return null;
  return { s: a.s ?? def.s, frames: a.frames };
}

export class Combat {
  constructor(app) {
    this.app = app;
    this.mobs = new Map(); // id → mob
    this.fx = []; // efeitos visuais temporários
    this.lastAction = 0;
    this.lastRound = Date.now();
    this.statuses = {}; // meus status: key → { until, src }
    this.buffs = {}; // magnificat etc.
    this.lastSnap = 0;
    this.lastAi = 0;
    this.saveTimer = 0;
    this.progress = { baseLevel: 1, baseExp: 0, jobLevel: 1, jobExp: 0, kills: 0, pvpKills: 0, deaths: 0, ...((app.user && app.user.combat) || {}) };
    if (app.user.guest) {
      try { Object.assign(this.progress, JSON.parse(localStorage.getItem('po.combat') || '{}')); } catch { /* ok */ }
    }
    this.refreshSheet(true);
    this.buildHud();
    app.on('me', () => this.refreshSheet());
    setInterval(() => this.tick(), 100);
  }

  // ------------------------------------------------------------------ ficha
  get cls() {
    const a = this.app.me.avatar;
    const body = IDX.bodies.get(a.body);
    return classOf(`${a.body} ${body ? body.name : ''}`);
  }

  refreshSheet(full = false) {
    const me = this.app.me;
    const prev = this.sheet;
    this.sheet = sheet(this.cls, this.progress.baseLevel);
    if (full || me.hp === undefined || !prev || prev.cls !== this.sheet.cls) {
      me.hp = this.sheet.maxHp;
      me.sp = this.sheet.maxSp;
    }
    me.maxHp = this.sheet.maxHp;
    me.maxSp = this.sheet.maxSp;
    me.hp = Math.min(me.hp, me.maxHp);
    me.sp = Math.min(me.sp, me.maxSp);
    me.cls = this.sheet.cls;
    me.baseLevel = this.progress.baseLevel;
    this.renderHud();
  }

  /** Ficha de outra pessoa a partir da presença (classe + nível). */
  sheetOf(p) {
    if (p === this.app.me) return this.withStatus(this.sheet, this.statuses);
    const s = sheet(p.cls || classOf(p.avatar && p.avatar.body), p.baseLevel || 1);
    const st = {};
    for (const k of p.statuses || []) st[k] = { until: Infinity };
    return this.withStatus(s, st);
  }

  withStatus(s, st) {
    const out = { ...s };
    if (st.curse) { out.statusCursed = true; out.luck = 0; }
    if (st.freeze) { out.frozen = true; out.statusElement = 'Água'; }
    if (st.stun) out.stunned = true;
    if (st.petrify) { out.frozen = true; out.hardDef += 5; out.ca += 5; out.statusElement = 'Terra'; }
    if (st.poison) out.poisoned = true;
    return out;
  }

  zoneOf(x, y) {
    return this.app.world.arenaAt(Math.floor(x), Math.floor(y));
  }

  inPvp(p) {
    return !!this.app.world.pvpAt(p.x, p.y);
  }

  // ------------------------------------------------------------------ autoridade por arena
  authorityOf(zone) {
    const ids = [];
    for (const p of this.app.players.values()) if (p.x >= zone.x && p.y >= zone.y && p.x < zone.x + zone.w && p.y < zone.y + zone.h) ids.push(p.id);
    ids.sort();
    return ids[0] || null;
  }

  isAuthority(zone) {
    return this.authorityOf(zone) === this.app.me.id;
  }

  poolFor(zone) {
    const boss = /chefe|mvp|boss|covil/i.test(zone.name || '');
    const list = CAT.mobs.filter((m) => (boss ? m.boss || (m.hp || 0) >= 40 : !m.boss && (m.hp || 20) < 200));
    return { boss, list: list.length ? list : CAT.mobs };
  }

  spawn(zone, defId = null, near = null) {
    const { boss, list } = this.poolFor(zone);
    let def = defId ? mobDef(defId) : null;
    if (!def) {
      // monstros à altura de quem está na arena: PV até 25 + 15 por nível de base
      const lv = Math.max(1, ...[...this.app.players.values()].filter((p) => p.x >= zone.x && p.y >= zone.y && p.x < zone.x + zone.w && p.y < zone.y + zone.h).map((p) => p.baseLevel || 1));
      const fit = boss ? list : list.filter((m) => (m.hp || this.guessHp(m)) <= 25 + 15 * lv);
      const pool = fit.length ? fit : list;
      def = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!def) return null;
    let x = near ? near.x : zone.x + 1 + Math.random() * (zone.w - 2);
    let y = near ? near.y : zone.y + 2 + Math.random() * (zone.h - 3);
    for (let i = 0; i < 20 && !this.app.world.walkable(Math.floor(x), Math.floor(y)); i++) {
      x = zone.x + 1 + Math.random() * (zone.w - 2);
      y = zone.y + 2 + Math.random() * (zone.h - 3);
    }
    const s = mobSheet({ ...def, hp: def.hp || this.guessHp(def) });
    const m = { id: uidm(), mid: def.id, zone: zone.id, x, y, hp: s.maxHp, maxHp: s.maxHp, act: 'idle', dir: 'left', st: {}, t0: performance.now(), next: Date.now() + 800, boss: !!def.boss || boss, bashUsed: false, thor: 0 };
    this.mobs.set(m.id, m);
    return m;
  }

  guessHp(def) {
    const a = animOf(def, 'idle');
    const f = a && a.frames && a.frames[0];
    const size = f ? (f[2] * f[3] * (def.sc || 1) ** 2) / 900 : 2;
    return Math.max(8, Math.min(120, Math.round(8 + size * 6)));
  }

  defStats(m) {
    const def = mobDef(m.mid) || {};
    return { ...def, hp: m.maxHp, name: def.name, atk: def.atk || 2 + Math.floor(m.maxHp / 25), ca: def.ca || 11 + Math.floor(m.maxHp / 30), dmg: def.dmg || `1d${Math.min(12, 4 + Math.floor(m.maxHp / 10))}+${Math.floor(m.maxHp / 30)}`, xp: def.xp || Math.round(m.maxHp * 1.2) };
  }

  /** IA dos monstros (só na autoridade). */
  runAi(zone) {
    const now = Date.now();
    const list = [...this.mobs.values()].filter((m) => m.zone === zone.id && !m.dead);
    const { boss } = this.poolFor(zone);
    const want = boss ? 0 : MAX_MOBS.arena;
    if (list.length < want && Math.random() < 0.08) this.spawn(zone);
    const players = [...this.app.players.values()].filter((p) => !p.dead && p.x >= zone.x && p.y >= zone.y && p.x < zone.x + zone.w && p.y < zone.y + zone.h);
    for (const m of list) {
      this.tickStatus(m, now);
      if (m.st.stun || m.st.freeze || m.st.petrify) { m.act = 'idle'; continue; }
      let target = null;
      let best = Infinity;
      for (const p of players) {
        const dd = Math.hypot(p.x + 0.5 - m.x, p.y + 0.9 - m.y);
        if (dd < best && dd < AGGRO) { best = dd; target = p; }
      }
      if (!target) {
        if (Math.random() < 0.02) { m.wx = zone.x + 1 + Math.random() * (zone.w - 2); m.wy = zone.y + 2 + Math.random() * (zone.h - 3); }
        if (m.wx !== undefined) this.moveToward(m, m.wx, m.wy, 1.2 * (AI_MS / 1000));
        continue;
      }
      if (best > 1.4) {
        this.moveToward(m, target.x + 0.5, target.y + 0.9, (m.st.curse ? 0.8 : 2.2) * (AI_MS / 1000));
        continue;
      }
      if (now < m.next) continue;
      m.next = now + ACTION_MS + Math.random() * 600;
      this.mobAttack(m, target, zone);
    }
  }

  moveToward(m, tx, ty, step) {
    const dx = tx - m.x;
    const dy = ty - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) { m.act = 'idle'; return; }
    const nx = m.x + (dx / dist) * Math.min(step, dist);
    const ny = m.y + (dy / dist) * Math.min(step, dist);
    if (this.app.world.walkable(Math.floor(nx), Math.floor(ny))) { m.x = nx; m.y = ny; }
    else if (this.app.world.walkable(Math.floor(nx), Math.floor(m.y))) m.x = nx;
    else if (this.app.world.walkable(Math.floor(m.x), Math.floor(ny))) m.y = ny;
    m.act = 'walk';
    m.dir = dx > 0 ? 'right' : 'left';
  }

  mobAttack(m, p, zone) {
    const def = this.defStats(m);
    const ms = mobSheet(def);
    ms.atk = def.atk;
    m.act = 'attack';
    m.actAt = performance.now();
    m.dir = p.x + 0.5 > m.x ? 'right' : 'left';
    const tgt = this.sheetOf(p);
    // Bafomé: Ira de Thor (recarga 5-6), 10d6 de Vento em 6 células, Reflexos CD 18 = metade
    if (def.thor && m.thor <= 0) {
      m.thor = 4;
      const hits = [...this.app.players.values()].filter((q) => !q.dead && Math.hypot(q.x + 0.5 - m.x, q.y + 0.9 - m.y) <= 6);
      this.broadcastFx({ fx: 'thor', x: m.x, y: m.y });
      for (const q of hits) {
        let dmg = roll('10d6');
        const half = save(this.sheetOf(q), 'ref', 18);
        if (half) dmg = Math.floor(dmg / 2);
        this.sendDamage(q, dmg, { text: `Ira de Thor ${dmg}${half ? ' (½)' : ''}`, from: m.id, color: '#9be8ff' });
      }
      return;
    }
    if (m.thor > 0 && d(6) >= 5) m.thor = 0; else if (m.thor > 0) m.thor -= 1;
    let opts = {};
    if (def.bash && !m.bashUsed && Math.random() < 0.35) { opts = { bonus: 2, extraDice: '1d6' }; m.bashUsed = true; }
    if (def.critDmg) ms.critRange = def.critRange || 16;
    const r = attack(ms, tgt, { ...opts, element: def.element, dice: def.dmg, status: { attackerCursed: !!m.st.curse } });
    if (r.crit && def.critDmg) r.dmg = Math.max(1, roll(def.critDmg, true) - tgt.softDef);
    if (!r.hit) { this.sendDamage(p, 0, { text: r.perfect ? 'Esquiva perfeita!' : 'Errou', from: m.id, miss: true }); return; }
    const extra = {};
    // monstros sombrios/venenosos aplicam status do PDF
    if (/Sombrio|Morto/.test(def.element || '') && d(6) === 6) extra.status = 'curse';
    if (/Veneno|Anaconda|Comodo|Mantis/i.test(`${def.name}`) && d(4) === 4) extra.status = 'poison';
    if (/Freezer|Gelo/i.test(`${def.name}`) && d(6) === 6) extra.status = 'freeze';
    this.sendDamage(p, r.dmg, { text: r.crit ? `CRÍTICO ${r.dmg}` : `${r.dmg}`, crit: r.crit, from: m.id, mods: ms.mods, ...extra });
  }

  // ------------------------------------------------------------------ dano e efeitos (rede)
  sendDamage(p, dmg, info) {
    const msg = { to: p.id, dmg, ...info };
    if (p === this.app.me) this.onDamage(msg);
    else this.app.room.send('cbt', { type: 'dmg', ...msg });
  }

  broadcastFx(f) {
    this.addFx(f);
    this.app.room.send('cbt', { type: 'fx', ...f });
  }

  onNet(msg) {
    const app = this.app;
    switch (msg.type) {
      case 'snap': {
        // estado dos monstros vindo da autoridade
        const zone = app.world.zones.find((z) => z.id === msg.zone);
        if (!zone || (this.isAuthority(zone) && msg.from !== app.me.id && app.me.id < msg.from)) return;
        const seen = new Set();
        for (const s of msg.list) {
          seen.add(s.id);
          let m = this.mobs.get(s.id);
          if (!m) { m = { ...s, rx: s.x, ry: s.y, t0: performance.now(), st: {} }; this.mobs.set(s.id, m); }
          const wasAct = m.act;
          Object.assign(m, s);
          if (s.act === 'attack' && wasAct !== 'attack') m.actAt = performance.now();
        }
        for (const [id, m] of this.mobs) if (m.zone === msg.zone && !seen.has(id) && !m.dead) this.mobs.delete(id);
        break;
      }
      case 'hit': {
        // golpe num monstro: só a autoridade aplica
        const m = this.mobs.get(msg.id);
        if (!m) return;
        const zone = app.world.zones.find((z) => z.id === m.zone);
        if (!zone || !this.isAuthority(zone)) return;
        this.applyHit(m, msg);
        break;
      }
      case 'dmg':
        if (msg.to === app.me.id) this.onDamage(msg);
        else this.floatAt(app.players.get(msg.to), msg);
        break;
      case 'fx':
        this.addFx(msg);
        break;
      case 'die': {
        const m = this.mobs.get(msg.id);
        if (m) { m.dead = true; m.hp = 0; m.deadAt = performance.now(); }
        if (msg.killer === app.me.id) this.reward(msg);
        break;
      }
      case 'heal':
        if (msg.to === app.me.id) {
          app.me.hp = Math.min(app.me.maxHp, app.me.hp + msg.amount);
          app.renderer.float(app.me.x, app.me.y - 1, `+${msg.amount}`, '#7bf07b');
          this.publish();
        }
        break;
      case 'buff':
        if (msg.targets.includes(app.me.id)) {
          this.buffs[msg.buff] = Date.now() + msg.ms;
          toast(`${msg.name} recebeu: ${msg.label}`, 'ok', 2000);
        }
        break;
      case 'summon':
        if (!msg.mid) { const z = this.app.world.zones.find((zz) => zz.id === msg.zone); if (z && this.isAuthority(z)) this.spawn(z); break; }
        this.onSummon(msg);
        break;
      case 'pvpkill':
        this.onPvpKill(msg);
        break;
      default:
    }
  }

  applyHit(m, h0) {
    if (m.dead) return;
    m.hp = Math.max(0, m.hp - h0.dmg);
    if (h0.push) {
      const nx = m.x + h0.push.dx;
      const ny = m.y + h0.push.dy;
      if (this.app.world.walkable(Math.floor(nx), Math.floor(ny))) { m.x = nx; m.y = ny; }
    }
    if (h0.status && !m.st[h0.status]) {
      const S = STATUS[h0.status];
      m.st[h0.status] = { until: Date.now() + S.rounds * ROUND_MS, src: h0.from, mods: h0.mods };
    }
    if (m.st.freeze && h0.dmg > 0 && !h0.magic) delete m.st.freeze; // congelamento quebra com dano físico
    m.lastHitBy = h0.from;
    if (m.hp <= 0) {
      m.dead = true;
      m.deadAt = performance.now();
      const def = this.defStats(m);
      const loot = CAT.loot && CAT.loot.length ? CAT.loot[Math.floor(Math.random() * CAT.loot.length)].id : null;
      const msg = { type: 'die', id: m.id, killer: h0.from, xp: def.xp, name: def.name, loot, boss: m.boss };
      this.app.room.send('cbt', msg);
      if (h0.from === this.app.me.id) this.reward(msg);
      setTimeout(() => this.mobs.delete(m.id), 1600);
    }
  }

  onDamage(msg) {
    const app = this.app;
    const me = app.me;
    if (me.dead) return;
    if (msg.pvp && !(this.inPvp(me) && this.inPvp(app.players.get(msg.from) || { x: -1, y: -1 }))) return;
    if (msg.miss || !msg.dmg) {
      app.renderer.float(me.x, me.y - 1, msg.text || 'Errou', '#cfd8ff');
      return;
    }
    me.hp = Math.max(0, me.hp - msg.dmg);
    me.action = 'hurt';
    app.renderer.float(me.x, me.y - 1, `-${msg.dmg}${msg.crit ? '!' : ''}`, msg.color || (msg.crit ? '#ff4d4d' : '#ff9a6b'), msg.crit);
    blip(msg.crit ? 180 : 240, 0.07, 0.05);
    if (this.statuses.freeze && !msg.magic) delete this.statuses.freeze;
    if (msg.status && !this.statuses[msg.status]) {
      const S = STATUS[msg.status];
      const adv = this.buffs.magnificat > Date.now() && ['curse', 'silence'].includes(msg.status);
      const dc = S.dc(msg.mods ? { mods: msg.mods } : null);
      if (!save(this.sheet, S.save, dc, adv)) {
        this.statuses[msg.status] = { until: Date.now() + S.rounds * ROUND_MS, mods: msg.mods };
        toast(`${S.icon} ${S.name}: ${S.desc}`, 'warn', 3500);
      } else app.renderer.float(me.x, me.y - 1.6, `Resistiu (${S.name})`, '#cfd8ff');
    }
    if (me.hp <= 0) this.die(msg);
    this.publish();
  }

  floatAt(p, msg) {
    if (!p) return;
    this.app.renderer.float(p.x, p.y - 1, msg.miss || !msg.dmg ? (msg.text || 'Errou') : `-${msg.dmg}`, msg.miss ? '#cfd8ff' : '#ff9a6b', !!msg.crit);
  }

  die(msg) {
    const app = this.app;
    const me = app.me;
    me.dead = true;
    this.progress.deaths += 1;
    const killer = app.players.get(msg.from);
    toast(killer ? `💀 ${killer.name} te derrotou na arena PvP!` : '💀 Você foi derrotado! Voltando em alguns segundos…', 'warn', 4000);
    if (killer && msg.pvp) app.room.send('cbt', { type: 'pvpkill', to: msg.from, victim: me.name });
    this.trackSoon();
    setTimeout(() => {
      me.dead = false;
      me.hp = me.maxHp;
      me.sp = me.maxSp;
      this.statuses = {};
      const z = app.world.zones.find((zz) => /corredor das arenas/i.test(zz.name)) || null;
      const spot = z ? { x: z.x + 1, y: z.y + Math.floor(z.h / 2) } : app.spawnPoint();
      app.teleport(spot.x, spot.y);
      this.publish();
    }, RESPAWN_MS);
  }

  reward(msg) {
    const app = this.app;
    const { state, up } = addExp(this.progress, msg.xp || 10);
    if (app.inventory) app.inventory.addZeny(Math.max(1, Math.round((msg.xp || 10) / 2)));
    this.progress = { ...state, kills: (this.progress.kills || 0) + 1 };
    app.renderer.float(app.me.x, app.me.y - 1.6, `+${msg.xp} EXP`, '#ffd84d');
    if (msg.loot) {
      const it = (CAT.loot || []).find((l) => l.id === msg.loot);
      if (it) toast(h('span', { class: 'loot-toast' }, frameCanvas(it.s, it.f, 28), ` Você pegou: ${it.name}${msg.boss ? ' (drop de MvP!)' : ''}`), 'ok', 3000);
    }
    if (up) {
      this.refreshSheet(true);
      app.renderer.float(app.me.x, app.me.y - 2, `NÍVEL DE BASE ${this.progress.baseLevel}!`, '#7bf0ff', true);
      this.broadcastFx({ fx: 'levelup', x: app.me.x + 0.5, y: app.me.y + 1 });
      blip(660, 0.12); setTimeout(() => blip(990, 0.2), 140);
    }
    this.persist();
    this.renderHud();
  }

  persist() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (this.app.user.guest) { try { localStorage.setItem('po.combat', JSON.stringify(this.progress)); } catch { /* ok */ } return; }
      this.app.backend.saveProfile({ combat: this.progress }).catch(() => {});
    }, 1500);
  }

  publish() {
    const me = this.app.me;
    me.statuses = Object.keys(this.statuses);
    this.renderHud();
    this.trackSoon();
  }

  trackSoon() {
    this.app.trackSoon();
  }

  // ------------------------------------------------------------------ minhas ações
  canAct() {
    const me = this.app.me;
    if (me.dead) return false;
    if (this.statuses.stun || this.statuses.freeze || this.statuses.petrify) { toast('Você não pode agir agora!', 'warn', 1200); return false; }
    return Date.now() - this.lastAction >= ACTION_MS * (this.sheet.extraAttack ? 0.6 : 1);
  }

  /** Alvo hostil mais perto: monstro na mesma arena ou jogador (só na arena PvP). */
  nearestTarget(range = this.sheet.range) {
    const me = this.app.me;
    let best = null;
    let bd = Infinity;
    const myZone = this.zoneOf(me.x + 0.5, me.y + 0.5);
    for (const m of this.mobs.values()) {
      if (m.dead || !myZone || m.zone !== myZone.id) continue;
      const dd = Math.hypot(m.x - (me.x + 0.5), m.y - (me.y + 0.9));
      if (dd < bd && dd <= range + 0.9) { bd = dd; best = { mob: m }; }
    }
    if (this.inPvp(me)) {
      for (const p of this.app.players.values()) {
        if (p === me || p.dead || !this.inPvp(p)) continue;
        const dd = Math.max(Math.abs(p.x - me.x), Math.abs(p.y - me.y));
        if (dd < bd && dd <= range) { bd = dd; best = { player: p }; }
      }
    }
    return best;
  }

  face(tx, ty) {
    const me = this.app.me;
    const dx = tx - (me.x + 0.5);
    const dy = ty - (me.y + 0.9);
    me.dir = dirFromVec(dx, dy);
  }

  swing() {
    const me = this.app.me;
    me.action = 'attack';
    me.actionStart = performance.now();
    me.actionUntil = performance.now() + 450;
    this.app.room.send('move', { id: me.id, x: me.x, y: me.y, dir: me.dir, action: 'attack', actionStart: 1 });
  }

  /** Ataque básico (tecla F). */
  basic(target = this.nearestTarget()) {
    if (!this.inArena()) return toast('Combate só nas arenas (Ala das Arenas, ao lado do jardim).', 'info', 2500);
    if (!target) return toast('Nenhum alvo ao alcance.', 'info', 1200);
    if (!this.canAct()) return;
    this.lastAction = Date.now();
    const s = this.withStatus(this.sheet, this.statuses);
    const swings = this.sheet.extraAttack && CLASSES[this.sheet.cls].dual ? 2 : 1;
    for (let i = 0; i < swings; i++) this.strike(target, { magic: s.magic }, i * 160);
  }

  strike(target, opts = {}, delay = 0, fx = 'hit') {
    const s = this.withStatus(this.sheet, this.statuses);
    const me = this.app.me;
    setTimeout(() => {
      if (target.mob) {
        const m = target.mob;
        if (m.dead) return;
        this.face(m.x, m.y);
        this.swing();
        const def = this.defStats(m);
        const ts = this.withStatus(mobSheet(def), m.st || {});
        const r = attack(s, ts, { ...opts, status: { attackerCursed: !!this.statuses.curse } });
        this.app.renderer.float(m.x - 0.5, m.y - 1.5, r.hit ? r.text : r.perfect ? 'Esquiva perfeita!' : 'Errou', r.crit ? '#ff4d4d' : r.hit ? '#ffd84d' : '#cfd8ff', r.crit);
        if (r.hit) {
          this.broadcastFx({ fx: r.crit ? 'crit' : fx, x: m.x, y: m.y });
          const hit = { type: 'hit', id: m.id, dmg: r.dmg, from: me.id, crit: r.crit, magic: !!opts.magic, mods: s.mods, ...(opts.onHit ? opts.onHit(r, m) : {}) };
          const zone = this.app.world.zones.find((z) => z.id === m.zone);
          if (zone && this.isAuthority(zone)) this.applyHit(m, hit); else this.app.room.send('cbt', hit);
        }
      } else if (target.player) {
        const p = target.player;
        if (!this.inPvp(me) || !this.inPvp(p)) return toast('Fora da arena PvP não dá para atacar jogadores.', 'warn');
        this.face(p.x + 0.5, p.y + 0.9);
        this.swing();
        const r = attack(s, this.sheetOf(p), { ...opts, status: { attackerCursed: !!this.statuses.curse } });
        if (r.hit) this.broadcastFx({ fx: r.crit ? 'crit' : fx, x: p.x + 0.5, y: p.y + 0.9 });
        const extra = opts.onHit && r.hit ? opts.onHit(r, null) : {};
        this.sendDamage(p, r.hit ? r.dmg : 0, { text: r.hit ? r.text : r.perfect ? 'Esquiva perfeita!' : 'Errou', crit: r.crit, miss: !r.hit, from: me.id, pvp: true, mods: s.mods, ...extra });
        if (!r.hit) this.app.renderer.float(p.x, p.y - 1, r.perfect ? 'Esquiva perfeita!' : 'Errou', '#cfd8ff');
      }
    }, delay);
  }

  /** Habilidade da classe (tecla R) e a segunda (tecla T, Sacerdote: Curar). */
  skill(which = 1) {
    if (!this.inArena()) return toast('Habilidades de combate só nas arenas.', 'info', 2000);
    const C = CLASSES[this.sheet.cls];
    const sk = which === 2 ? C.skill2 : C.skill;
    if (!sk) return;
    if (this.statuses.silence) return toast('🤐 Silenciado: não dá para usar habilidades.', 'warn');
    const me = this.app.me;
    if (me.sp < sk.sp) return toast(`SP insuficiente (${sk.sp}).`, 'warn', 1500);
    if (!this.canAct()) return;
    const s = this.withStatus(this.sheet, this.statuses);
    const target = this.nearestTarget(sk.id === 'stormgust' ? 7 : sk.id === 'heal' || sk.id === 'magnificat' ? 6 : this.sheet.range);
    const spend = () => { me.sp -= sk.sp; this.lastAction = Date.now(); this.publish(); this.app.floatText(me.x, me.y - 2, sk.name, '#ffe9a8'); };
    switch (sk.id) {
      case 'bowling': {
        if (!target) return toast('Precisa de um alvo adjacente.', 'info');
        spend();
        this.strike(target, {
          extraDice: '2d8',
          onHit: (r, m) => {
            const dx = m ? Math.sign(m.x - (me.x + 0.5)) * 2 : 0;
            const dy = m ? Math.sign(m.y - (me.y + 0.9)) * 2 : 0;
            if (m) {
              // colisão: quem estiver no caminho sofre o mesmo dano
              for (const o of this.mobs.values()) {
                if (o === m || o.dead || o.zone !== m.zone) continue;
                if (Math.hypot(o.x - (m.x + dx), o.y - (m.y + dy)) < 1.2) {
                  const fort = save(mobSheet(this.defStats(o)), 'fort', 14);
                  const hit2 = { type: 'hit', id: o.id, dmg: r.dmg, from: me.id, status: fort ? null : 'stun' };
                  const zone = this.app.world.zones.find((z) => z.id === o.zone);
                  if (zone && this.isAuthority(zone)) this.applyHit(o, hit2); else this.app.room.send('cbt', hit2);
                }
              }
            }
            return { push: { dx, dy } };
          },
        }, 0, 'bowling');
        break;
      }
      case 'stormgust': {
        if (!target) return toast('Nenhum alvo para a Nevasca.', 'info');
        spend();
        const cx = target.mob ? target.mob.x : target.player.x + 0.5;
        const cy = target.mob ? target.mob.y : target.player.y + 0.9;
        const amp = this.buffs.amplify > Date.now() ? 1.5 : 1;
        this.broadcastFx({ fx: 'cast', x: me.x + 0.5, y: me.y + 1 });
        const fails = new Map();
        for (let round = 0; round < 3; round++) {
          setTimeout(() => {
            this.broadcastFx({ fx: 'storm', x: cx, y: cy, r: 5 });
            for (const m of this.mobs.values()) {
              if (m.dead || Math.hypot(m.x - cx, m.y - cy) > 5) continue;
              const ms = this.withStatus(mobSheet(this.defStats(m)), m.st || {});
              const ok = save(ms, 'ref', 16);
              const n = (fails.get(m.id) || 0) + (ok ? 0 : 1);
              fails.set(m.id, n);
              const mult = (ms.immune || []).includes('Água') ? 0 : ms.weak && ms.weak['Água'] ? ms.weak['Água'] : 1;
              const dmg = Math.max(0, Math.round(roll('4d6') * amp * mult) - ms.softMdef);
              const hit = { type: 'hit', id: m.id, dmg, from: me.id, magic: true, status: n >= 3 ? 'freeze' : null };
              this.app.renderer.float(m.x - 0.5, m.y - 1.5, `${dmg}`, '#9be8ff');
              const zone = this.app.world.zones.find((z) => z.id === m.zone);
              if (zone && this.isAuthority(zone)) this.applyHit(m, hit); else this.app.room.send('cbt', hit);
            }
            if (this.inPvp(me)) {
              for (const p of this.app.players.values()) {
                if (p === me || p.dead || !this.inPvp(p) || Math.hypot(p.x + 0.5 - cx, p.y + 0.9 - cy) > 5) continue;
                const ps = this.sheetOf(p);
                const ok = save(ps, 'ref', 16);
                const n = (fails.get(p.id) || 0) + (ok ? 0 : 1);
                fails.set(p.id, n);
                this.sendDamage(p, Math.max(0, Math.round(roll('4d6') * amp) - ps.softMdef), { text: 'Nevasca', from: me.id, pvp: true, magic: true, status: n >= 3 ? 'freeze' : undefined, color: '#9be8ff' });
              }
            }
          }, 1500 + round * 1200);
        }
        this.buffs.amplify = 0;
        break;
      }
      case 'sonicblow': {
        if (!target) return toast('Precisa de um alvo adjacente.', 'info');
        spend();
        this.strike(target, { dice: '8d4', advantage: true, bonus: 0, onHit: () => ({ status: 'stun' }) }, 0, 'sonic');
        break;
      }
      case 'magnificat': {
        spend();
        const allies = [...this.app.players.values()].filter((p) => !p.dead && Math.hypot(p.x - me.x, p.y - me.y) <= 6).map((p) => p.id);
        this.app.room.send('cbt', { type: 'buff', buff: 'magnificat', ms: 5 * ROUND_MS, targets: allies, name: me.name, label: 'Magnificat (SP em dobro, vantagem vs Maldição/Silêncio)' });
        this.buffs.magnificat = Date.now() + 5 * ROUND_MS;
        this.broadcastFx({ fx: 'holy', x: me.x + 0.5, y: me.y + 1 });
        break;
      }
      case 'heal': {
        spend();
        const amount = roll('2d8') + Math.max(0, s.mods.int);
        // Aura Divina: contra Morto-Vivo/Demônio vira dano Sagrado que ignora a CA
        if (target && target.mob) {
          const def = this.defStats(target.mob);
          if (/Morto|Sombrio|Dem/i.test(`${def.element} ${def.race || ''}`)) {
            const dmg = amount * 2;
            this.broadcastFx({ fx: 'holy', x: target.mob.x, y: target.mob.y });
            const hit = { type: 'hit', id: target.mob.id, dmg, from: me.id, magic: true };
            const zone = this.app.world.zones.find((z) => z.id === target.mob.zone);
            if (zone && this.isAuthority(zone)) this.applyHit(target.mob, hit); else this.app.room.send('cbt', hit);
            this.app.renderer.float(target.mob.x - 0.5, target.mob.y - 1.5, `Sagrado ${dmg}`, '#fff3a8');
            return;
          }
        }
        let ally = me;
        for (const p of this.app.players.values()) if (p !== me && !p.dead && p.hp < p.maxHp && Math.hypot(p.x - me.x, p.y - me.y) <= 6 && (!ally || p.hp / p.maxHp < ally.hp / ally.maxHp)) ally = p;
        this.broadcastFx({ fx: 'heal', x: ally.x + 0.5, y: ally.y + 1 });
        if (ally === me) { me.hp = Math.min(me.maxHp, me.hp + amount); this.app.renderer.float(me.x, me.y - 1, `+${amount}`, '#7bf07b'); this.publish(); }
        else this.app.room.send('cbt', { type: 'heal', to: ally.id, amount });
        break;
      }
      case 'doublestrafe':
        if (!target) return toast('Nenhum alvo ao alcance.', 'info');
        spend();
        this.strike(target, { bonus: 1 }, 0);
        this.strike(target, { bonus: 1 }, 220);
        break;
      default: // bash
        if (!target) return toast('Nenhum alvo ao alcance.', 'info');
        spend();
        this.strike(target, { bonus: 2, extraDice: '1d6' }, 0, 'bowling');
    }
  }

  /** Amplificação Mística do Bruxo (ação bônus). */
  amplify() {
    if (this.sheet.cls !== 'bruxo') return;
    this.buffs.amplify = Date.now() + 15000;
    toast('✨ Amplificação Mística: próximo feitiço +50%.', 'ok', 2000);
  }

  inArena() {
    const me = this.app.me;
    return !!this.app.world.arenaAt(me.x, me.y);
  }

  // ------------------------------------------------------------------ status e laço
  tickStatus(ent, now) {
    for (const [k, v] of Object.entries(ent.st || {})) {
      if (now > v.until) delete ent.st[k];
    }
  }

  tick() {
    const app = this.app;
    const me = app.me;
    if (!me || !app.world) return;
    const now = Date.now();
    // rodadas: veneno, regeneração
    if (now - this.lastRound >= ROUND_MS) {
      this.lastRound = now;
      for (const [k, v] of Object.entries(this.statuses)) if (now > v.until) { delete this.statuses[k]; toast(`${STATUS[k].icon} ${STATUS[k].name} passou.`, 'info', 1200); }
      if (this.statuses.poison && !me.dead) {
        const dmg = roll('1d6') + Math.max(0, (this.statuses.poison.mods && this.statuses.poison.mods.vit) || 0);
        me.hp = Math.max(1, me.hp - dmg);
        app.renderer.float(me.x, me.y - 1, `-${dmg} veneno`, '#9be86a');
      }
      if (!me.dead) {
        const inA = this.inArena();
        const regenHp = inA ? Math.max(1, Math.floor(me.maxHp * 0.02)) : Math.ceil(me.maxHp * 0.2);
        const regenSp = (inA ? Math.max(1, Math.floor(me.maxSp * 0.04)) : Math.ceil(me.maxSp * 0.2)) * (this.buffs.magnificat > now ? 2 : 1);
        me.hp = Math.min(me.maxHp, me.hp + regenHp);
        me.sp = Math.min(me.maxSp, me.sp + regenSp);
      }
      // monstros: veneno da autoridade
      for (const m of this.mobs.values()) {
        if (m.dead || !m.st || !m.st.poison) continue;
        const zone = app.world.zones.find((z) => z.id === m.zone);
        if (zone && this.isAuthority(zone)) this.applyHit(m, { dmg: roll('1d6') + Math.max(0, (m.st.poison.mods && m.st.poison.mods.vit) || 0), from: m.st.poison.src });
      }
      this.publish();
    }
    // autoridade: IA + estado
    for (const zone of app.world.zones) {
      if (zone.kind !== 'arena' && zone.kind !== 'pvp') continue;
      if (zone.kind === 'pvp') continue;
      if (!this.isAuthority(zone)) continue;
      if (now - this.lastAi >= AI_MS) this.runAi(zone);
      if (now - this.lastSnap >= SNAP_MS) {
        const list = [...this.mobs.values()].filter((m) => m.zone === zone.id && !m.dead).map((m) => ({
          id: m.id, mid: m.mid, zone: m.zone, x: Math.round(m.x * 100) / 100, y: Math.round(m.y * 100) / 100, hp: m.hp, maxHp: m.maxHp, act: m.act, dir: m.dir, boss: m.boss,
          stl: Object.keys(m.st || {}),
        }));
        app.room.send('cbt', { type: 'snap', zone: zone.id, from: app.me.id, list });
      }
    }
    if (now - this.lastAi >= AI_MS) this.lastAi = now;
    if (now - this.lastSnap >= SNAP_MS) this.lastSnap = now;
    // arenas vazias: limpa monstros que ninguém controla
    for (const [id, m] of this.mobs) {
      const zone = app.world.zones.find((z) => z.id === m.zone);
      if (!zone || !this.authorityOf(zone)) this.mobs.delete(id);
    }
    this.hudEl.hidden = !this.inArena();
    if (!this.hudEl.hidden) this.renderBars();
  }

  /** Covil: invocar o chefe pelo objeto "Covil de monstros". */
  summon(o) {
    const zone = this.app.world.arenaAt(o.x, o.y);
    if (!zone) return toast('O covil só funciona dentro de uma arena.', 'warn');
    const { boss, list } = this.poolFor(zone);
    const pick = h('select', {}, list.map((m) => h('option', { value: m.id }, `${m.name}${m.hp ? ` — PV ${m.hp}` : ''}`)));
    const m = openModal({
      title: boss ? '🐉 Invocar chefe (MvP)' : '🐉 Invocar monstro',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Monstro', pick),
        h('p', { class: 'muted small' }, boss ? 'Bafomé (MvP): PV 412, CA 22, crítico 16–20 com a Foice Gigante (4d10+14) e Ira de Thor (10d6 de Vento, Reflexos CD 18 reduz pela metade). Imune a Sombrio e Veneno; +100% de dano Sagrado.' : 'Os monstros seguem o bestiário convertido do guia d20.')),
      footer: [h('button', { class: 'btn-primary', onclick: () => {
        if (!this.isAuthority(zone)) {
          this.app.room.send('cbt', { type: 'summon', zone: zone.id, mid: pick.value });
          toast('Pedido enviado à arena.', 'ok', 1500);
        } else this.spawn(zone, pick.value, { x: o.x + 0.5, y: o.y + 2 });
        m.close();
      } }, 'Invocar')],
    });
  }

  onSummon(msg) {
    const zone = this.app.world.zones.find((z) => z.id === msg.zone);
    if (zone && this.isAuthority(zone)) this.spawn(zone, msg.mid);
  }

  // ------------------------------------------------------------------ efeitos
  addFx(f) {
    const pick = {
      hit: ['shadow-slash-1'], crit: ['effect-1-5'], bowling: ['effect-2-3'], sonic: ['amistr-skills-1'], storm: ['seasonal-effects-1', 'effect-3-1'],
      cast: ['blessing-5'], holy: ['angels-3'], heal: ['blessing-4'], thor: ['various-effects-2'], levelup: ['blessing-6'],
    }[f.fx] || ['shadow-slash-1'];
    const e = findIn('effects', ...pick);
    if (!e) return;
    this.fx.push({ ...f, e, t0: performance.now() });
  }

  // ------------------------------------------------------------------ desenho (chamado pelo renderer)
  collect(items) {
    const now = performance.now();
    for (const m of this.mobs.values()) {
      if (m.rx === undefined) { m.rx = m.x; m.ry = m.y; }
      m.rx += (m.x - m.rx) * 0.25;
      m.ry += (m.y - m.ry) * 0.25;
      items.push({ z: m.ry, draw: (ctx, ox, oy, S, T, time) => this.drawMob(ctx, m, ox, oy, S, T, time, now) });
    }
  }

  drawMob(ctx, m, ox, oy, S, T, time, now) {
    const def = mobDef(m.mid);
    if (!def) return;
    const dead = m.dead;
    const name = dead ? 'die' : m.act === 'attack' && now - (m.actAt || 0) < 600 ? 'attack' : m.act === 'walk' ? 'walk' : 'idle';
    const a = animOf(def, name) || animOf(def, 'idle');
    if (!a) return;
    const t = name === 'attack' ? (now - (m.actAt || 0)) / 1000 : name === 'die' ? (now - (m.deadAt || now)) / 1000 : time + (m.id.charCodeAt(2) % 7) * 0.1;
    const f = frameAt(a.frames, t, name === 'walk' ? 8 : 6, name !== 'die');
    const cx = ox + m.rx * T;
    const by = oy + m.ry * T;
    const sc = (def.sc || 1) * S * (m.boss ? 1.25 : 1);
    ctx.fillStyle = 'rgba(20,10,40,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, by, 10 * S * (m.boss ? 2 : 1), 3.5 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    // folhas do RO olham para a esquerda; as do Pixel Crawler, para a direita
    const facesLeft = def.kind === 'ro';
    const flip = facesLeft ? m.dir === 'right' : m.dir === 'left';
    const frozen = m.stl && (m.stl.includes('freeze') || m.stl.includes('petrify'));
    if (frozen) ctx.filter = m.stl.includes('freeze') ? 'hue-rotate(180deg) saturate(60%) brightness(120%)' : 'grayscale(100%)';
    drawFrame(ctx, a.s, f, cx, by, sc, flip, dead ? Math.max(0, 1 - t / 1.4) : 1);
    ctx.filter = 'none';
    if (dead) return;
    // barra de vida
    const w = 30 * S * (m.boss ? 1.6 : 1);
    const top = by - (f[3] * sc) - 6 * S;
    ctx.fillStyle = 'rgba(20,10,30,.8)';
    ctx.fillRect(cx - w / 2 - 1, top - 1, w + 2, 5 * S);
    ctx.fillStyle = m.boss ? '#ff4d6d' : '#ff9a3c';
    ctx.fillRect(cx - w / 2, top, w * Math.max(0, m.hp / m.maxHp), 5 * S - 2);
    ctx.font = `700 ${10 * S}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(20,10,30,.9)';
    ctx.lineWidth = 3;
    const label = `${def.name}${m.boss ? ' [MvP]' : ''}`;
    ctx.strokeText(label, cx, top - 4 * S);
    ctx.fillText(label, cx, top - 4 * S);
    if (m.stl && m.stl.length) ctx.fillText(m.stl.map((k) => STATUS[k] && STATUS[k].icon).join(''), cx, top - 16 * S);
    ctx.textAlign = 'left';
  }

  drawOverlay(ctx, ox, oy, S, T) {
    const now = performance.now();
    this.fx = this.fx.filter((f) => now - f.t0 < (f.fx === 'storm' ? 1100 : 900));
    for (const f of this.fx) {
      const t = (now - f.t0) / 1000;
      const fr = frameAt(f.e.frames, t, 14, false);
      if (f.r) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#9be8ff';
        ctx.beginPath();
        ctx.arc(ox + f.x * T, oy + f.y * T, f.r * T, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t;
          drawFrame(ctx, f.e.s, fr, ox + (f.x + Math.cos(a) * f.r * 0.6) * T, oy + (f.y + Math.sin(a) * f.r * 0.5) * T, f.e.sc * S);
        }
      } else drawFrame(ctx, f.e.s, fr, ox + f.x * T, oy + f.y * T, f.e.sc * S * (f.fx === 'thor' ? 2 : 1));
    }
    // HP de quem está nas arenas
    for (const p of this.app.players.values()) {
      if (!p.maxHp || p._top === undefined || !this.app.world.arenaAt(p.x, p.y)) continue;
      const w = 34 * S;
      const x = p._cx - w / 2;
      const y = p._top + 2 * S - 22 * S;
      ctx.fillStyle = 'rgba(20,10,30,.8)';
      ctx.fillRect(x - 1, y - 1, w + 2, 9 * S);
      ctx.fillStyle = '#3ddc84';
      ctx.fillRect(x, y, w * Math.max(0, (p.hp || 0) / p.maxHp), 4 * S - 1);
      ctx.fillStyle = '#5db3ff';
      ctx.fillRect(x, y + 4 * S, w * Math.max(0, (p.sp || 0) / (p.maxSp || 1)), 4 * S - 1);
    }
  }

  // ------------------------------------------------------------------ HUD de combate
  buildHud() {
    this.hudEl = h('div', { class: 'combat-hud win', hidden: true });
    document.getElementById('app').append(this.hudEl);
    this.barsEl = h('div', { class: 'cbt-bars' });
    this.renderHud();
  }

  renderHud() {
    if (!this.hudEl || !this.sheet) return;
    const C = CLASSES[this.sheet.cls];
    const s = this.sheet;
    fill(this.hudEl,
      h('div', { class: 'cbt-head' },
        h('strong', {}, C.name),
        h('span', { class: 'muted small' }, `Nv. base ${this.progress.baseLevel} · Nv. classe ${this.progress.jobLevel}`),
        h('button', { type: 'button', class: 'icon-btn', title: 'Ficha de combate', html: ICONS.scroll, onclick: () => this.openSheet() })),
      this.barsEl,
      h('div', { class: 'cbt-actions' },
        h('button', { type: 'button', class: 'cbt-btn', title: 'Atacar o alvo mais perto (F)', onclick: () => this.basic() }, h('span', { html: ICONS.sword }), 'Atacar', h('kbd', {}, 'F')),
        h('button', { type: 'button', class: 'cbt-btn', title: `${C.skill.desc}`, onclick: () => this.skill(1) }, `${C.skill.name}`, h('small', {}, `${C.skill.sp} SP`), h('kbd', {}, 'R')),
        C.skill2 ? h('button', { type: 'button', class: 'cbt-btn', title: C.skill2.desc, onclick: () => this.skill(2) }, C.skill2.name, h('small', {}, `${C.skill2.sp} SP`), h('kbd', {}, 'T')) : null,
        s.cls === 'bruxo' ? h('button', { type: 'button', class: 'cbt-btn', title: 'Ação bônus: +50% no próximo feitiço', onclick: () => this.amplify() }, 'Amplificar', h('kbd', {}, 'G')) : null));
    this.renderBars();
  }

  renderBars() {
    const me = this.app.me;
    if (!me || !this.barsEl) return;
    const st = Object.keys(this.statuses);
    const pct = (a, b) => `${Math.max(0, Math.min(100, (a / (b || 1)) * 100))}%`;
    const next = expToNext(this.progress.baseLevel);
    fill(this.barsEl,
      h('div', { class: 'cbt-bar hp' }, h('span', { style: `width:${pct(me.hp, me.maxHp)}` }), h('em', {}, `HP ${Math.ceil(me.hp)}/${me.maxHp}`)),
      h('div', { class: 'cbt-bar sp' }, h('span', { style: `width:${pct(me.sp, me.maxSp)}` }), h('em', {}, `SP ${Math.floor(me.sp)}/${me.maxSp}`)),
      h('div', { class: 'cbt-bar xp' }, h('span', { style: `width:${pct(this.progress.baseExp, next)}` }), h('em', {}, `EXP ${this.progress.baseExp}/${next}`)),
      st.length ? h('div', { class: 'cbt-status' }, st.map((k) => h('span', { title: STATUS[k].desc }, `${STATUS[k].icon} ${STATUS[k].name}`))) : null,
      me.dead ? h('div', { class: 'cbt-dead' }, '💀 Derrotado — voltando…') : null);
  }

  openSheet() {
    const s = this.sheet;
    const C = CLASSES[s.cls];
    openModal({
      title: `📜 Ficha — ${C.name}`,
      className: 'modal-wide',
      content: h('div', { class: 'sheet' },
        h('div', { class: 'sheet-grid' }, Object.entries(s.attrs).map(([k, v]) => h('div', { class: 'attr' }, h('strong', {}, ATTR_NAMES[k]), h('span', {}, v), h('small', {}, `${s.mods[k] >= 0 ? '+' : ''}${s.mods[k]}`)))),
        h('ul', { class: 'sheet-list' },
          h('li', {}, `PV ${s.maxHp} (d${C.die} por nível + VIT) · SP ${s.maxSp}`),
          h('li', {}, `CA ${s.ca} = 10 + AGI ${s.mods.agi} + Hard DEF ${s.hardDef}`),
          h('li', {}, `Ataque: d20 + DES ${s.mods.des} + BAB ${s.bab} · dano ${s.weapon} + FOR · alcance ${s.range}`),
          h('li', {}, `Soft DEF ${s.softDef} (VIT) · Soft MDEF ${s.softMdef} (INT)`),
          h('li', {}, `Crítico em ${s.critRange}–20 (SOR) · Esquiva perfeita se o d20 do oponente ≤ ${s.luck}`),
          h('li', {}, `ASPD: ${s.extraAttack ? 'ataque extra' : 'um ataque'} por ação`),
          h('li', {}, `Mecânica única: ${C.unique}`),
          h('li', {}, `${C.skill.name} (${C.skill.sp} SP): ${C.skill.desc}`),
          C.skill2 ? h('li', {}, `${C.skill2.name} (${C.skill2.sp} SP): ${C.skill2.desc}`) : null,
          h('li', {}, `Abates: ${this.progress.kills || 0} · PvP: ${this.progress.pvpKills || 0} · Derrotas: ${this.progress.deaths || 0}`)),
        h('p', { class: 'muted small' }, 'A classe vem do seu avatar (Personalizar → Classe). Regras: guia "Ragnarok d20". PvP só dentro da Arena PvP.')),
    });
  }

  onPvpKill(msg) {
    if (msg.to !== this.app.me.id) return;
    this.progress.pvpKills = (this.progress.pvpKills || 0) + 1;
    toast(`⚔️ Você derrotou ${msg.victim}!`, 'ok', 2500);
    this.reward({ xp: 25 });
  }
}

export { OBJECTS };
