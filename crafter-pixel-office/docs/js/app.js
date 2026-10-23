// Orquestra a aplicação: mundo, presença em tempo real, edição, objetos e módulos de interface.
import { CONFIG } from './config.js';
import { levelFromXp } from './backend/index.js';
import { $, toast, h } from './ui/dom.js';
import { World, isNear } from './game/world.js';
import { Player, LocalPlayer } from './game/players.js';
import { Input, isTyping } from './game/input.js';
import { Renderer } from './game/renderer.js';
import { buildDefaultMap } from './game/defaultMap.js';
import { OBJECTS } from './art/objects.js';
import { normalizeAvatar, randomAvatar } from './art/avatar.js';
import { playNote, blip } from './audio.js';
import { Chat } from './ui/chat.js';
import { Sidebar, People, MyQuests } from './ui/people.js';
import { Hud, EMOTES } from './ui/hud.js';
import { BuildPanel } from './ui/buildPanel.js';
import { openAvatarEditor } from './ui/avatarEditor.js';
import { interact } from './features/interactions.js';
import { Whiteboards } from './features/whiteboard.js';
import { Quests } from './features/quests.js';
import { Notes } from './features/notes.js';
import { Games } from './features/games.js';
import { Integrations } from './features/integrations.js';
import { MiniMode } from './features/pip.js';
import { DocsUi } from './features/docs.js';
import { Media } from './media/rtc.js';

const TAB = Math.random().toString(36).slice(2, 7);

export class App {
  constructor(backend, user) {
    this.backend = backend;
    this.user = user;
    this.players = new Map();
    this.listeners = {};
    this.build = {};
    this.profiles = [];
    this.feed = [];
    this.feedCounts = new Map();
    this.target = null;
    this.proximity = CONFIG.PROXIMITY;
    this.iceServers = CONFIG.ICE_SERVERS;
    this.input = new Input();
    this.lastTrack = 0;
    this.trackTimer = 0;
    this.floorQueue = [];
    this.floorTimer = 0;
  }

  on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
  emitUi(event, data) { (this.listeners[event] || []).forEach((fn) => fn(data)); }

  get canEdit() {
    return !!(this.user.admin || (!this.user.guest && this.world && this.world.map.openEdit));
  }

  // ------------------------------------------------------------------ início
  async start() {
    const data = await this.backend.loadWorld(buildDefaultMap);
    this.world = new World(data);
    const spawn = this.spawnPoint();
    const xp = this.user.xp || 0;
    this.me = new LocalPlayer({
      id: `${this.user.id.slice(0, 8)}-${TAB}`,
      uid: this.user.id,
      name: this.user.name,
      avatar: this.user.avatar,
      x: spawn.x,
      y: spawn.y,
      dir: 'down',
      status: 'online',
      level: levelFromXp(xp).level,
      guest: this.user.guest,
      admin: this.user.admin,
    });
    this.me.xp = xp;
    if (!this.user.avatar) this.me.avatar = randomAvatar();
    this.players.set(this.me.id, this.me);

    $('#app').hidden = false;
    document.title = `${CONFIG.APP_NAME} — escritório virtual`;
    this.renderer = new Renderer($('#game'), this);
    this.sidebar = new Sidebar(this);
    this.chat = new Chat(this);
    this.people = new People(this);
    this.myQuests = new MyQuests(this);
    this.buildPanel = new BuildPanel(this);
    this.boards = new Whiteboards(this);
    this.quests = new Quests(this);
    this.notes = new Notes(this);
    this.games = new Games(this);
    this.docs = new DocsUi(this);
    this.media = new Media(this);
    this.mini = new MiniMode(this);
    this.integrations = new Integrations(this);
    this.hud = new Hud(this);
    this.bindPointer();
    this.bindKeys();

    this.room = this.backend.joinRoom(this.me.id, this.presenceState());
    this.bindRoom();
    this.bindDb();

    this.backend.recentMessages().then((list) => list.forEach((m) => this.chat.add({ ...m, scope: 'all' }, true))).catch(() => {});
    this.refreshProfiles();
    this.refreshFeed();
    this.quests.load();

    this.lastT = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.emitUi('me');
    this.emitUi('players');
    if (!this.user.avatar) this.openAvatarEditor({ welcome: true });
    if (this.backend.mode === 'local') toast('Modo demonstração: abra outra aba para simular outra pessoa.', 'info', 6000);
  }

  spawnPoint() {
    const s = this.world.map.spawn || { x: 1, y: 1 };
    for (let i = 0; i < 60; i++) {
      const x = s.x + Math.round((Math.random() - 0.5) * 6);
      const y = s.y + Math.round((Math.random() - 0.5) * 4);
      if (this.world.walkable(x, y)) return { x, y };
    }
    return { x: s.x, y: s.y };
  }

  presenceState() {
    const m = this.me;
    return {
      uid: m.uid, name: m.name, avatar: m.avatar, x: m.x, y: m.y, dir: m.dir, status: m.status, statusText: m.statusText || '',
      media: m.media, level: m.level, buffs: m.activeBuffs(), music: m.music || '', guest: m.guest, admin: m.admin,
    };
  }

  /** Atualiza a presença (com limite de 1 por segundo). */
  trackSoon() {
    clearTimeout(this.trackTimer);
    const wait = Math.max(150, 1000 - (Date.now() - this.lastTrack));
    this.trackTimer = setTimeout(() => {
      this.lastTrack = Date.now();
      this.room.track(this.presenceState()).catch(() => {});
    }, wait);
  }

  // ------------------------------------------------------------------ tempo real
  bindRoom() {
    const r = this.room;
    const conn = $('#conn-overlay');
    const message = $('#conn-message');
    const spinner = $('#conn-spinner');
    const reload = $('#conn-reload');
    reload.addEventListener('click', () => window.location.reload());
    r.on('status', (s) => {
      if (s === 'SUBSCRIBED') conn.hidden = true;
      else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(s)) {
        message.textContent = 'Conexão interrompida. Recarregue a página para tentar novamente.';
        spinner.hidden = true;
        reload.hidden = false;
        conn.hidden = false;
      }
    });
    r.on('ready', () => {
      this.started = true;
      this.media.reset();
    });
    r.on('presence', (all) => this.onPresence(all));
    r.on('move', (d) => {
      const p = this.players.get(d.id);
      if (!p || p === this.me) return;
      p.apply(d);
      p.lastMove = Date.now();
    });
    r.on('chat', (m) => {
      if (m.scope === 'near') {
        const p = this.players.get(m.id);
        if (!p || !isNear(this.world, p, this.me, this.proximity)) return;
      }
      this.chat.add(m);
    });
    r.on('emote', ({ id, e }) => {
      const p = this.players.get(id);
      if (p) p.emote = { e, t: performance.now() };
    });
    r.on('float', (f) => this.renderer.float(f.x, f.y, f.text, f.color, f.big));
    r.on('obj', ({ id, state }) => {
      const o = this.world.get(id);
      if (!o) return;
      const def = OBJECTS[o.type];
      this.world.apply([{ t: 'state', id, state }]);
      if (def && def.flat) this.renderer.invalidate();
    });
    r.on('edit', (ops) => {
      const res = this.world.apply(ops);
      if (res.floor || res.objects) this.renderer.invalidate();
      if (this.build.on) this.buildPanel.render();
      this.emitUi('world');
    });
    r.on('map', () => this.reloadWorld('O escritório foi restaurado para o modelo padrão.'));
    r.on('piano', ({ from, note }) => {
      const p = this.players.get(from);
      if (!p || !isNear(this.world, p, this.me, this.proximity + 2)) return;
      playNote(note, 0.45);
      p.emote = { e: '🎵', t: performance.now() };
    });
    r.on('wave', ({ to, from, name }) => {
      if (to !== this.me.id) return;
      blip(880, 0.12, 0.08);
      setTimeout(() => blip(1175, 0.12, 0.08), 140);
      const p = this.players.get(from);
      toast(h('span', {}, `👋 ${name} acenou para você `, p ? h('button', { class: 'toast-btn', onclick: () => this.goTo(p.x, p.y) }, 'Ir até lá') : null), 'info', 8000);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(`${name} acenou para você 👋`);
    });
    r.on('quest', (q) => this.quests.onAnnounce(q));
    r.on('doc', ({ id }) => this.emitUi('doc', id));
    r.on('stroke', (d) => this.boards.onStroke(d));
    r.on('board-clear', (d) => this.boards.onClear(d));
    r.on('transcript', (d) => this.notes.onRemoteLine(d));
    r.on('notes', (d) => this.notes.onRemoteState(d));
    r.on('ttt', (d) => this.games.onTicTacToe(d));
    r.on('signal', (d) => this.media.onSignal(d));
  }

  bindDb() {
    const b = this.backend;
    b.onChange('profiles', () => this.refreshProfiles());
    b.onChange('object_feed', () => this.refreshFeed());
    b.onChange('quests', (p) => this.quests.onDbChange(p));
    b.onChange('quest_comments', (p) => this.quests.onCommentChange(p));
    b.onChange('object_docs', (p) => this.emitUi('doc', p && p.new && p.new.object_id));
  }

  onPresence(all) {
    const seen = new Set();
    for (const [k, st] of Object.entries(all)) {
      if (k === this.me.id) continue;
      seen.add(k);
      let p = this.players.get(k);
      if (!p) {
        p = new Player({ ...st, id: k });
        this.players.set(k, p);
        if (this.started) this.chat.system(`${p.name} entrou no escritório`);
      } else {
        const stale = !p.lastMove || Date.now() - p.lastMove > 3000;
        p.apply(st, { position: stale });
      }
    }
    for (const [k, p] of [...this.players]) {
      if (p === this.me || seen.has(k)) continue;
      this.players.delete(k);
      this.media.close(k);
      this.chat.system(`${p.name} saiu`);
    }
    this.emitUi('players');
  }

  async refreshProfiles() {
    try {
      this.profiles = await this.backend.profiles();
      const mine = this.profiles.find((p) => p.id === this.user.id);
      if (mine) {
        const before = this.me.level;
        this.me.xp = mine.xp;
        this.me.level = levelFromXp(mine.xp).level;
        if (this.me.level > before) {
          this.renderer.float(this.me.x, this.me.y - 1.2, `LEVEL UP! Lv${this.me.level}`, '#7bf0ff', true);
          this.room.send('float', { x: this.me.x, y: this.me.y - 1.2, text: `LEVEL UP! Lv${this.me.level}`, color: '#7bf0ff', big: true });
          blip(660, 0.12); setTimeout(() => blip(880, 0.12), 120); setTimeout(() => blip(1320, 0.2), 240);
        }
        this.trackSoon();
        this.emitUi('me');
      }
      this.emitUi('profiles');
    } catch (e) {
      console.warn(e);
    }
  }

  async refreshFeed() {
    try {
      this.feed = await this.backend.feed();
      const counts = new Map();
      for (const f of this.feed) counts.set(f.object_id, (counts.get(f.object_id) || 0) + 1);
      this.feedCounts = counts;
      this.emitUi('feed');
    } catch (e) {
      console.warn(e);
    }
  }

  async reloadWorld(msg) {
    const data = await this.backend.loadWorld(buildDefaultMap);
    this.world.load(data);
    this.renderer.invalidate();
    if (this.build.on) this.buildPanel.render();
    if (!this.world.walkable(this.me.x, this.me.y)) {
      const s = this.spawnPoint();
      this.teleport(s.x, s.y);
    }
    if (msg) toast(msg);
  }

  // ------------------------------------------------------------------ loop
  loop(t) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;
    const me = this.me;
    me.step(dt, this.input, this.world, (moved) => {
      this.room.send('move', { id: me.id, x: me.x, y: me.y, dir: me.dir });
      this.trackSoon();
      if (moved) this.onStep();
    });
    for (const p of this.players.values()) if (p !== me) p.update(dt);

    const still = !me.moving && (!me.path || !me.path.length);
    this.target = still ? this.world.interactableNear(me.x, me.y) : null;
    if (still && me.pendingInteract) {
      const o = me.pendingInteract;
      me.pendingInteract = null;
      if (this.world.objects.includes(o) && this.world.distanceToObject(o, me.x, me.y) <= 1) this.interact(o);
    }
    this.hud.update();
    this.renderer.draw(t / 1000);
    requestAnimationFrame((tt) => this.loop(tt));
  }

  onStep() {
    const portal = this.world.portalAt(this.me.x, this.me.y);
    if (portal && !this.me.path?.length) {
      const next = this.world.nextPortal(portal);
      if (next) {
        const exit = this.world.freeAround(next.x, next.y);
        setTimeout(() => {
          this.teleport(exit.x, exit.y);
          blip(520, 0.25, 0.06);
          this.renderer.float(exit.x, exit.y, '✨ Teletransporte!', '#9be8ff');
        }, 180);
      }
    }
  }

  teleport(x, y) {
    const me = this.me;
    me.x = x;
    me.y = y;
    me.path = null;
    me.snap();
    this.room.send('move', { id: me.id, x, y, dir: me.dir });
    this.trackSoon();
  }

  // ------------------------------------------------------------------ ações
  interact(o = this.target) {
    if (!o) return;
    const def = OBJECTS[o.type];
    if (!def || !def.interact) return;
    this.face(o);
    interact(this, o, def);
  }

  face(o) {
    const def = OBJECTS[o.type];
    const me = this.me;
    const dx = o.x + (def.w - 1) / 2 - me.x;
    const dy = o.y + (def.h - 1) / 2 - me.y;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (dir !== me.dir) {
      me.dir = dir;
      this.room.send('move', { id: me.id, x: me.x, y: me.y, dir });
    }
  }

  emote(e) {
    this.me.emote = { e, t: performance.now() };
    this.room.send('emote', { id: this.me.id, e });
  }

  floatText(x, y, text, color = '#ffd84d', big = false) {
    this.renderer.float(x, y, text, color, big);
    this.room.send('float', { x, y, text, color, big });
  }

  addBuff(e, label, minutes) {
    const until = Date.now() + minutes * 60000;
    this.me.buffs = [...this.me.activeBuffs().filter((b) => b.e !== e), { e, label, until }];
    this.trackSoon();
    this.emitUi('me');
  }

  setStatus(status, text = '') {
    this.me.status = status;
    this.me.statusText = text;
    this.trackSoon();
    this.emitUi('me');
    this.emitUi('players');
  }

  wave(p) {
    this.room.send('wave', { to: p.id, from: this.me.id, name: this.me.name });
    this.emote('👋');
    toast(`Você acenou para ${p.name}.`, 'ok', 2000);
  }

  goTo(x, y) {
    const me = this.me;
    const path = this.world.pathTo(me.x, me.y, (px, py) => Math.max(Math.abs(px - x), Math.abs(py - y)) <= 1 && !(px === x && py === y));
    if (path) me.path = path;
    else toast('Não encontrei um caminho até lá.', 'warn', 1600);
  }

  clickTo(t) {
    const { world, me } = this;
    if (!world.inBounds(t.x, t.y) || (t.x === me.x && t.y === me.y)) return;
    me.pendingInteract = null;
    const objs = world.objectsAt(t.x, t.y).filter((o) => OBJECTS[o.type] && OBJECTS[o.type].interact);
    const obj = objs.find((o) => !OBJECTS[o.type].flat && OBJECTS[o.type].interact !== 'sit' && OBJECTS[o.type].interact !== 'portal');
    if (obj) {
      if (world.distanceToObject(obj, me.x, me.y) <= 1) return this.interact(obj);
      const path = world.pathTo(me.x, me.y, (x, y) => world.distanceToObject(obj, x, y) <= 1 && world.walkable(x, y));
      if (path) { me.path = path; me.pendingInteract = obj; }
      return;
    }
    const goal = world.walkable(t.x, t.y) ? (x, y) => x === t.x && y === t.y : (x, y) => Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) <= 1;
    const path = world.pathTo(me.x, me.y, goal);
    if (path) me.path = path;
  }

  async setAvatar(avatar, name) {
    const cfg = normalizeAvatar(avatar);
    this.me.avatar = cfg;
    this.me.hasAvatar = true;
    this.user.avatar = cfg;
    if (name) { this.me.name = name; this.user.name = name; }
    this.trackSoon();
    this.emitUi('me');
    this.emitUi('players');
    try { await this.backend.saveProfile({ avatar: cfg, name }); } catch (e) { toast(e.message, 'error'); }
  }

  openAvatarEditor(opts) {
    return openAvatarEditor(this, opts);
  }

  // ------------------------------------------------------------------ objetos e edição
  async setObjectState(o, state) {
    const def = OBJECTS[o.type];
    this.world.apply([{ t: 'state', id: o.id, state }]);
    if (def && def.flat) this.renderer.invalidate();
    this.room.send('obj', { id: o.id, state });
    try { await this.backend.setObjectState(o.id, state); } catch (e) { console.warn(e); }
  }

  async edit(ops) {
    const res = this.world.apply(ops);
    if (res.floor || res.objects) this.renderer.invalidate();
    this.room.send('edit', ops);
    this.emitUi('world');
    for (const op of ops) {
      try {
        if (op.t === 'floor') this.queueFloor(op.cells);
        else if (op.t === 'add') await this.backend.addObject(op.obj);
        else if (op.t === 'del') await this.backend.removeObject(op.id);
        else if (op.t === 'zone') await this.backend.upsertZone(op.zone);
        else if (op.t === 'zdel') await this.backend.removeZone(op.id);
        else if (op.t === 'spawn') await this.backend.setSettings({ spawn: { x: op.x, y: op.y } });
        else if (op.t === 'settings') await this.backend.setSettings({ openEdit: op.openEdit });
        else if (op.t === 'data') await this.backend.setObjectData(op.id, op.data);
      } catch (e) {
        toast(e.message, 'error');
      }
    }
  }

  queueFloor(cells) {
    this.floorQueue.push(...cells);
    clearTimeout(this.floorTimer);
    this.floorTimer = setTimeout(async () => {
      const batch = this.floorQueue.splice(0);
      try { await this.backend.paintFloor(batch); } catch (e) { toast(e.message, 'error'); }
    }, 400);
  }

  async resetWorld() {
    try {
      await this.backend.resetWorld(buildDefaultMap());
      this.room.send('map', {});
      await this.reloadWorld('Escritório restaurado.');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async logout() {
    try {
      if (this.media.on) this.media.disable();
      this.room.leave();
      await this.backend.signOut();
    } finally {
      location.reload();
    }
  }

  // ------------------------------------------------------------------ entrada
  bindPointer() {
    const canvas = $('#game');
    let down = false;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      const t = this.renderer.tileAt(e.clientX, e.clientY);
      down = true;
      canvas.setPointerCapture(e.pointerId);
      if (this.build.on) this.buildPanel.pointerDown(t, e);
      else if (e.button === 0) this.clickTo(t);
    });
    canvas.addEventListener('pointermove', (e) => {
      const t = this.renderer.tileAt(e.clientX, e.clientY);
      if (this.build.on) {
        const hv = this.build.hover;
        if (!hv || hv.x !== t.x || hv.y !== t.y || down) this.buildPanel.pointerMove(t, e);
      } else {
        const hit = this.world.objectsAt(t.x, t.y).some((o) => OBJECTS[o.type] && OBJECTS[o.type].interact && !OBJECTS[o.type].flat);
        canvas.style.cursor = hit ? 'pointer' : '';
      }
    });
    const up = (e) => {
      if (!down) return;
      down = false;
      if (this.build.on) this.buildPanel.pointerUp(this.renderer.tileAt(e.clientX, e.clientY));
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.renderer.zoomBy(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('modal-open')) return;
      if (isTyping(e)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = /^Digit([1-6])$/.exec(e.code);
      if (digit) return this.emote(EMOTES[Number(digit[1]) - 1]);
      switch (e.code) {
        case 'KeyX':
        case 'KeyE':
        case 'Space':
          e.preventDefault();
          this.interact();
          break;
        case 'Enter':
          e.preventDefault();
          this.chat.focus();
          break;
        case 'KeyQ':
          this.quests.open();
          break;
        case 'KeyN':
          this.notes.open();
          break;
        case 'Equal':
        case 'NumpadAdd':
          this.renderer.zoomBy(1);
          break;
        case 'Minus':
        case 'NumpadSubtract':
          this.renderer.zoomBy(-1);
          break;
        case 'KeyB':
          if (this.canEdit) this.buildPanel.toggle();
          break;
        case 'Escape':
          if (this.build.on) this.buildPanel.toggle(false);
          else this.sidebar.close();
          break;
        default:
      }
    });
  }
}
