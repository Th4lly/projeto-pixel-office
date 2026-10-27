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
    return { id: u.id, email: u.email || '', name: u.name, avatar: u.avatar || null, admin: !!u.admin, xp: u.xp || 0, combat: u.combat || {}, inventory: u.inventory || {}, guest: !!u.guest, identities: [] };
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
    if (patch.combat) u.combat = patch.combat;
    if (patch.inventory) u.inventory = patch.inventory;
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

  // ------------------------------------------------------------------ camadas, rotação e construção
  async paintLayer(layer, cells) {
    this.guard();
    const map = read('map');
    const L = map[layer] || (map[layer] = {});
    for (const [x, y, v] of cells) { const k = `${x},${y}`; if (v === null || v === undefined || v === '') delete L[k]; else L[k] = v; }
    write('map', map);
  }

  async setMapImage(which, value) {
    this.guard();
    const map = read('map');
    map[which] = value || null;
    write('map', map);
  }

  ownsPlaced(o) { return o && o.data && o.data.placed_by === this.uid; }

  async moveObject(id, op) {
    const list = read('objects', []);
    const o = list.find((x) => x.id === id);
    if (!o) return;
    if (!this.canEdit() && !this.ownsPlaced(o)) throw new Error('Você não tem permissão para fazer isso.');
    if (op.x !== undefined) { o.x = op.x; o.y = op.y; }
    if (op.rot !== undefined) o.rot = op.rot;
    if (op.flip !== undefined) o.flip = op.flip;
    write('objects', list);
  }

  inMyDeskArea(x, y) {
    const list = read('objects', []);
    return read('zones', []).some((z) => z.kind === 'desk' && x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h
      && list.some((d) => d.x >= z.x && d.y >= z.y && d.x < z.x + z.w && d.y < z.y + z.h && d.data && d.data.owner && d.data.owner.uid === this.uid));
  }

  async placeOwned(o, w = 1, h = 1) {
    const u = this.users()[this.uid];
    if (!u || u.guest) throw new Error('Convidados não constroem.');
    if (!this.canEdit()) {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (!this.inMyDeskArea(o.x + i, o.y + j)) throw new Error('Fora da área da sua mesa.');
    }
    const list = read('objects', []);
    list.push({ ...o, state: o.state || {}, data: { ...(o.data || {}), placed_by: this.uid } });
    write('objects', list);
  }

  async pickupObject(id) {
    const list = read('objects', []);
    const o = list.find((x) => x.id === id);
    if (!o) return null;
    if (!this.canEdit() && !this.ownsPlaced(o)) throw new Error('Você não tem permissão para fazer isso.');
    write('objects', list.filter((x) => x.id !== id));
    return o.type;
  }

  async customObjects() { return read('custom', []); }

  async uploadMapAsset(blob) {
    if (blob.size > 1.5e6) throw new Error('No modo demonstração as imagens ficam no navegador: até 1,5 MB.');
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Não consegui ler a imagem.'));
      r.readAsDataURL(blob);
    });
  }

  async addCustomObject(row) {
    this.guard();
    const full = { created_at: now(), created_by: this.uid, ...row };
    write('custom', [...read('custom', []), full]);
    return full;
  }

  async removeCustomObject(id) {
    this.guard();
    write('custom', read('custom', []).filter((c) => c.id !== id));
  }

  async upgradeWorld(def) {
    const cur = read('map', null);
    if (cur && (cur.version || 1) >= (def.map.version || 2)) return false;
    // mesas reivindicadas passam para a mesa nova da mesma área (z-mesa-N)
    const oldZones = read('zones', []).filter((z) => z.kind === 'desk');
    const inZ = (o, z) => o.x >= z.x && o.x < z.x + z.w && o.y >= z.y && o.y < z.y + z.h;
    const keep = {};
    for (const o of read('objects', [])) {
      if (!o.data || !o.data.owner) continue;
      const z = oldZones.find((zz) => inZ(o, zz));
      if (z) keep[z.id] = { owner: o.data.owner, decor: o.data.decor, chair: o.data.chair, deskSkin: o.data.deskSkin, deskColor: o.data.deskColor };
    }
    const objects = def.objects.map((o) => {
      if (!o.data || o.data.slot === undefined) return o;
      const z = def.zones.find((zz) => zz.kind === 'desk' && inZ(o, zz) && keep[zz.id]);
      if (!z) return o;
      const extra = Object.fromEntries(Object.entries(keep[z.id]).filter(([, v]) => v !== undefined));
      return { ...o, data: { ...o.data, ...extra } };
    });
    write('map', { ...def.map, openEdit: !!(cur && cur.openEdit) });
    write('objects', objects);
    write('zones', def.zones);
    return true;
  }

  // ------------------------------------------------------------------ mesas
  async claimDesk(id) {
    const u = this.users()[this.uid];
    if (!u || u.guest) throw new Error('Convidados não podem reivindicar mesa.');
    const list = read('objects', []);
    const desk = list.find((o) => o.id === id);
    if (!desk) throw new Error('Mesa não encontrada.');
    if (desk.data && desk.data.owner && desk.data.owner.uid !== this.uid) throw new Error('Esta mesa já tem dono.');
    for (const o of list) {
      if (o !== desk && o.data && o.data.owner && o.data.owner.uid === this.uid) {
        const { owner: _o, decor: _d, chair: _c, deskSkin: _s, deskColor: _k, ...rest } = o.data;
        o.data = rest;
      }
    }
    desk.data = { ...(desk.data || {}), owner: { uid: this.uid, name: u.name } };
    write('objects', list);
    return desk.data;
  }

  async releaseDesk(id) {
    const list = read('objects', []);
    const desk = list.find((o) => o.id === id);
    if (!desk || !desk.data || !desk.data.owner) return;
    if (desk.data.owner.uid !== this.uid && !this.isAdmin()) throw new Error('Só o dono libera a mesa.');
    const { owner: _o, decor: _d, chair: _c, deskSkin: _s, deskColor: _k, ...rest } = desk.data;
    desk.data = rest;
    write('objects', list);
  }

  async setDeskDecor(id, decor, chair = null, color = null, skin = null) {
    const list = read('objects', []);
    const desk = list.find((o) => o.id === id);
    if (!desk || !desk.data || !desk.data.owner || (desk.data.owner.uid !== this.uid && !this.isAdmin())) throw new Error('Só o dono da mesa pode decorá-la.');
    if (!Array.isArray(decor) || decor.length > 60) throw new Error('Decoração inválida (máximo de 60 itens).');
    desk.data = { ...desk.data, decor, chair: chair || '', deskColor: color || '', deskSkin: skin || '' };
    write('objects', list);
    return desk.data;
  }

  // ------------------------------------------------------------------ anexos e planilhas das reuniões
  async meetingItems(room) {
    return read('meeting', []).filter((m) => m.room === room).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async addMeetingItem(item, file) {
    const u = this.users()[this.uid] || {};
    const row = { id: uuid(), created_at: now(), created_by: this.uid, created_name: u.name, data: {}, ...item };
    if (file) {
      if (file.size > 2.5e6) throw new Error('No modo demonstração os anexos ficam no navegador: até 2,5 MB.');
      row.url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
        r.readAsDataURL(file);
      });
      Object.assign(row, { kind: 'file', title: item.title || file.name, size: file.size, mime: file.type });
    }
    write('meeting', [...read('meeting', []), row]);
    this.changed('meeting_items', { new: row });
    return row;
  }

  async removeMeetingItem(it) {
    write('meeting', read('meeting', []).filter((m) => m.id !== it.id));
    this.changed('meeting_items', { old: it });
  }

  async fileUrl(it) { return it.url; }

  // ------------------------------------------------------------------ Notion (demonstração: sem servidor)
  async notionBoards() { return read('notion', []).filter((b) => b.scope === 'company' || b.owner === this.uid); }
  async addNotionBoard(b) {
    const row = { id: uuid(), owner: this.uid, created_at: now(), ...b };
    write('notion', [...read('notion', []), row]);
    return row;
  }
  async removeNotionBoard(id) { write('notion', read('notion', []).filter((b) => b.id !== id)); }
  async saveNotionToken() { throw new Error('No modo demonstração não há servidor para guardar o token do Notion.'); }
  async notion() {
    throw new Error('O Notion precisa do Supabase: a função "notion" faz a ponte (o navegador não pode chamar a API do Notion direto).');
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
    const wake = () => { if (!document.hidden) { hb(); publish(); } };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    const bye = () => bus.postMessage({ t: 'bye', key });
    window.addEventListener('pagehide', bye);

    const joinTimer = setTimeout(() => {
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
      clearTimeout(joinTimer);
      window.removeEventListener('pagehide', bye);
      window.removeEventListener('pageshow', wake);
      document.removeEventListener('visibilitychange', wake);
      bye();
      bus.close();
    };
    return room;
  }
}
