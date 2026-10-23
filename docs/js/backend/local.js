// Backend de demonstração: tudo fica neste navegador (localStorage) e as abas
// conversam entre si via BroadcastChannel. Útil para testar sem Supabase.
import { Emitter } from './emitter.js';

const P = 'po.local.';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();

function read(k, fb) {
  try {
    const v = localStorage.getItem(P + k);
    return v ? JSON.parse(v) : typeof fb === 'function' ? fb() : fb;
  } catch {
    return typeof fb === 'function' ? fb() : fb;
  }
}
function write(k, v) {
  try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* cheio */ }
}

async function hash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`pixeloffice:${s}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class LocalBackend {
  constructor(cfg) {
    this.mode = 'local';
    this.cfg = cfg;
    this.db = new Emitter();
    this.dbBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('po-db') : null;
    if (this.dbBus) this.dbBus.onmessage = (e) => this.db.emit(e.data.table, e.data.payload || {});
  }

  async init() {}

  changed(table, payload = {}) {
    this.db.emit(table, payload);
    if (this.dbBus) this.dbBus.postMessage({ table, payload });
  }

  // ------------------------------------------------------------------ auth
  currentSession() {
    try {
      return JSON.parse(sessionStorage.getItem(`${P}session`) || localStorage.getItem(`${P}session`) || 'null');
    } catch {
      return null;
    }
  }

  setSession(s, remember) {
    try {
      sessionStorage.setItem(`${P}session`, JSON.stringify(s));
      if (remember) localStorage.setItem(`${P}session`, JSON.stringify(s));
    } catch { /* sem storage */ }
  }

  userFromRow(u) {
    this.uid = u.id;
    return { id: u.id, email: u.email || '', name: u.name, avatar: u.avatar || null, admin: !!u.admin, xp: u.xp || 0, guest: !!u.guest, identities: [] };
  }

  users() { return read('users', {}); }
  saveUsers(u) { write('users', u); }

  async session() {
    const s = this.currentSession();
    if (!s) return null;
    const u = this.users()[s.id];
    return u ? this.userFromRow(u) : null;
  }

  async signIn(email, password, remember = true) {
    email = String(email).trim().toLowerCase();
    const u = Object.values(this.users()).find((x) => x.email === email);
    if (!u || u.hash !== (await hash(password))) throw new Error('E-mail ou senha incorretos.');
    this.setSession({ id: u.id }, remember);
    return this.userFromRow(u);
  }

  async signUp(name, email, password) {
    email = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('E-mail inválido.');
    if (String(password).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    const users = this.users();
    if (Object.values(users).some((x) => x.email === email)) throw new Error('Já existe uma conta com esse e-mail.');
    const u = {
      id: uuid(), name: String(name).trim().slice(0, 24), email, hash: await hash(password),
      admin: !Object.values(users).some((x) => x.admin), xp: 0, avatar: null, guest: false,
    };
    users[u.id] = u;
    this.saveUsers(users);
    this.setSession({ id: u.id }, true);
    this.changed('profiles');
    return this.userFromRow(u);
  }

  async signInGuest(name) {
    const users = this.users();
    const u = { id: uuid(), name: String(name).trim().slice(0, 24), guest: true, admin: false, xp: 0, avatar: null };
    users[u.id] = u;
    this.saveUsers(users);
    this.setSession({ id: u.id }, false);
    return this.userFromRow(u);
  }

  async signInWith() {
    throw new Error('Login com Google/GitHub/Microsoft funciona só com o Supabase configurado.');
  }

  async linkProvider() {
    throw new Error('Integrações funcionam só com o Supabase configurado (veja o README).');
  }

  providerToken() { return null; }
  forgetProvider() {}

  async signOut() {
    try { sessionStorage.removeItem(`${P}session`); localStorage.removeItem(`${P}session`); } catch { /* ok */ }
  }

  // ------------------------------------------------------------------ perfis
  async saveProfile(patch) {
    const users = this.users();
    const u = users[this.uid];
    if (!u) return;
    if (patch.name) u.name = patch.name;
    if (patch.avatar) u.avatar = patch.avatar;
    this.saveUsers(users);
    this.changed('profiles');
  }

  async profiles() {
    return Object.values(this.users()).filter((u) => !u.guest).map((u) => ({ id: u.id, name: u.name, xp: u.xp || 0, avatar: u.avatar, admin: u.admin })).sort((a, b) => b.xp - a.xp);
  }

  isAdmin() { const u = this.users()[this.uid]; return !!(u && u.admin); }
  canEdit() {
    const u = this.users()[this.uid];
    const map = read('map', null);
    return !!u && (u.admin || (!u.guest && map && map.openEdit));
  }
  guard() { if (!this.canEdit()) throw new Error('Você não tem permissão para fazer isso.'); }

  // ------------------------------------------------------------------ mundo
  async loadWorld(buildDefault) {
    let map = read('map', null);
    if (!map) {
      const def = buildDefault();
      map = { ...def.map, openEdit: false };
      write('map', map);
      write('objects', def.objects);
      write('zones', def.zones);
    }
    return { map, objects: read('objects', []), zones: read('zones', []) };
  }

  async resetWorld(def) {
    this.guard();
    const open = (read('map', {}) || {}).openEdit;
    write('map', { ...def.map, openEdit: !!open });
    write('objects', def.objects);
    write('zones', def.zones);
  }

  async paintFloor(cells) {
    this.guard();
    const map = read('map');
    for (const [x, y, t] of cells) if (x >= 0 && y >= 0 && x < map.width && y < map.height) map.floor[y * map.width + x] = t;
    write('map', map);
  }

  async addObject(o) {
    this.guard();
    const list = read('objects', []);
    list.push({ ...o, state: o.state || {}, data: o.data || {} });
    write('objects', list);
  }

  async removeObject(id) {
    this.guard();
    write('objects', read('objects', []).filter((o) => o.id !== id));
  }

  async setObjectState(id, state) {
    const list = read('objects', []);
    const o = list.find((x) => x.id === id);
    if (o) { o.state = state; write('objects', list); }
  }

  async setObjectData(id, data) {
    this.guard();
    const list = read('objects', []);
    const o = list.find((x) => x.id === id);
    if (o) { o.data = data; write('objects', list); }
  }

  async upsertZone(z) {
    this.guard();
    write('zones', [...read('zones', []).filter((x) => x.id !== z.id), z]);
  }

  async removeZone(id) {
    this.guard();
    write('zones', read('zones', []).filter((x) => x.id !== id));
  }

  async setSettings({ spawn, openEdit }) {
    if (openEdit !== undefined && !this.isAdmin()) throw new Error('Apenas administradores.');
    this.guard();
    const map = read('map');
    if (spawn) map.spawn = spawn;
    if (openEdit !== undefined) map.openEdit = openEdit;
    write('map', map);
  }

  // ------------------------------------------------------------------ documentos
  docs() { return read('docs', {}); }

  async getDoc(id) { return this.docs()[id] || {}; }

  async docAppend(id, key, item, max = 500) {
    const docs = this.docs();
    const d = (docs[id] = docs[id] || {});
    d[key] = [...(d[key] || []), item].slice(-max);
    write('docs', docs);
    this.changed('object_docs', { new: { object_id: id } });
  }

  async docSet(id, key, value) {
    const docs = this.docs();
    (docs[id] = docs[id] || {})[key] = value;
    write('docs', docs);
    this.changed('object_docs', { new: { object_id: id } });
  }

  async docRemove(id, key, itemId) {
    const docs = this.docs();
    const d = docs[id] || {};
    d[key] = (d[key] || []).filter((x) => x.id !== itemId);
    docs[id] = d;
    write('docs', docs);
    this.changed('object_docs', { new: { object_id: id } });
  }

  // ------------------------------------------------------------------ chat
  async recentMessages() { return read('messages', []).slice(-50); }

  async saveMessage(name, text) {
    const list = read('messages', []);
    list.push({ id: uuid(), uid: this.uid, name, text, ts: Date.now() });
    write('messages', list.slice(-200));
  }

  // ------------------------------------------------------------------ quests
  async listQuests() { return read('quests', []).sort((a, b) => b.created_at.localeCompare(a.created_at)); }

  async createQuest(q) {
    const u = this.users()[this.uid];
    if (!u || u.guest) throw new Error('Convidados não criam quests.');
    const row = {
      id: uuid(), description: '', difficulty: 1, reward_xp: 50, status: 'aberta', category: 'geral', assignees: [],
      due_date: null, link: null, created_by: this.uid, created_at: now(), updated_at: now(), completed_at: null, completed_by: null, ...q,
    };
    write('quests', [row, ...read('quests', [])]);
    this.changed('quests', { eventType: 'INSERT', new: row });
    return row;
  }

  async updateQuest(id, patch) {
    if (patch.status === 'concluida') throw new Error('Use "Concluir" para finalizar a quest.');
    const list = read('quests', []);
    const q = list.find((x) => x.id === id);
    if (!q) return;
    Object.assign(q, patch, { updated_at: now() });
    write('quests', list);
    this.changed('quests', { eventType: 'UPDATE', new: q });
  }

  async completeQuest(id) {
    const list = read('quests', []);
    const q = list.find((x) => x.id === id);
    if (!q || q.status === 'concluida') return 0;
    Object.assign(q, { status: 'concluida', completed_at: now(), completed_by: this.uid });
    write('quests', list);
    const users = this.users();
    for (const uid of q.assignees.length ? q.assignees : [this.uid]) if (users[uid]) users[uid].xp = (users[uid].xp || 0) + q.reward_xp;
    this.saveUsers(users);
    this.changed('quests', { eventType: 'UPDATE', new: q });
    this.changed('profiles');
    return q.reward_xp;
  }

  async reopenQuest(id) {
    if (!this.isAdmin()) throw new Error('Apenas administradores reabrem quests concluídas.');
    const list = read('quests', []);
    const q = list.find((x) => x.id === id);
    if (!q || q.status !== 'concluida') return;
    const users = this.users();
    for (const uid of q.assignees.length ? q.assignees : [q.completed_by]) if (users[uid]) users[uid].xp = Math.max(0, (users[uid].xp || 0) - q.reward_xp);
    this.saveUsers(users);
    Object.assign(q, { status: 'andamento', completed_at: null, completed_by: null });
    write('quests', list);
    this.changed('quests', { eventType: 'UPDATE', new: q });
    this.changed('profiles');
  }

  async deleteQuest(id) {
    write('quests', read('quests', []).filter((q) => q.id !== id));
    this.changed('quests', { eventType: 'DELETE', old: { id } });
  }

  async questComments(id) { return read('comments', []).filter((c) => c.quest_id === id); }

  async addQuestComment(id, name, text) {
    const c = { id: uuid(), quest_id: id, user_id: this.uid, name, text, created_at: now() };
    write('comments', [...read('comments', []), c]);
    this.changed('quest_comments', { eventType: 'INSERT', new: c });
  }

  // ------------------------------------------------------------------ objetos inteligentes
  async feed() { return read('feed', []); }

  async dismissFeed(id) {
    write('feed', read('feed', []).filter((f) => String(f.id) !== String(id)));
    this.changed('object_feed', { eventType: 'DELETE', old: { id } });
  }

  async webhookUrl() { return null; }

  /** Só no modo local: simula a chegada de um webhook. */
  async simulateFeed(objectId, item) {
    const row = { id: uuid(), object_id: objectId, source: item.source || 'teste', title: item.title, body: item.body || '', url: item.url || '', created_at: now() };
    write('feed', [row, ...read('feed', [])].slice(0, 300));
    this.changed('object_feed', { eventType: 'INSERT', new: row });
  }

  // ------------------------------------------------------------------ notas
  async listNotes() { return read('notes', []); }

  async saveNote(n) {
    const row = { id: uuid(), created_by: this.uid, created_at: now(), ...n };
    write('notes', [row, ...read('notes', [])].slice(0, 100));
    return row;
  }

  async updateNote(id, patch) {
    const list = read('notes', []);
    const n = list.find((x) => x.id === id);
    if (n) { Object.assign(n, patch); write('notes', list); }
  }

  async deleteNote(id) { write('notes', read('notes', []).filter((n) => n.id !== id)); }

  async summarize() {
    throw new Error('O resumo por IA funciona com o Supabase configurado (função "summarize").');
  }

  // ------------------------------------------------------------------ fliperama
  async topScores(game) {
    return read('scores', []).filter((s) => s.game === game).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  async addScore(game, name, score) {
    write('scores', [...read('scores', []), { game, name, score, created_at: now() }].slice(-500));
  }

  onChange(table, fn) { return this.db.on(table, fn); }

  // ------------------------------------------------------------------ sala em tempo real
  joinRoom(key, initial) {
    const room = new Emitter();
    const bus = new BroadcastChannel('po-room');
    const peers = new Map(); // key -> { state, seen }
    let mine = initial;

    const publish = () => {
      const out = { [key]: mine };
      for (const [k, v] of peers) out[k] = v.state;
      room.emit('presence', out);
    };
    const hb = () => bus.postMessage({ t: 'hb', key, state: mine });

    bus.onmessage = (e) => {
      const m = e.data;
      if (!m || m.key === key) return;
      if (m.t === 'hb') {
        const isNew = !peers.has(m.key);
        peers.set(m.key, { state: m.state, seen: Date.now() });
        if (isNew) hb();
        publish();
      } else if (m.t === 'bye') {
        peers.delete(m.key);
        publish();
      } else if (m.t === 'ev') {
        room.emit(m.type, m.payload);
      }
    };

    const timer = setInterval(() => {
      hb();
      let changed = false;
      for (const [k, v] of peers) if (Date.now() - v.seen > 7000) { peers.delete(k); changed = true; }
      if (changed) publish();
    }, 2000);
    const bye = () => bus.postMessage({ t: 'bye', key });
    window.addEventListener('pagehide', bye);

    setTimeout(() => {
      room.emit('status', 'SUBSCRIBED');
      hb();
      publish();
      room.emit('ready');
    }, 30);

    room.send = (type, payload) => bus.postMessage({ t: 'ev', key, type, payload });
    room.track = (state) => {
      mine = state;
      hb();
      publish();
      return Promise.resolve();
    };
    room.leave = () => {
      clearInterval(timer);
      bye();
      bus.close();
    };
    return room;
  }
}
