// Backend de produção: Supabase (Auth, Postgres, Realtime e Edge Functions).
import { Emitter } from './emitter.js';
import { PROVIDERS } from './index.js';

const TABLES = ['quests', 'quest_comments', 'object_feed', 'object_docs', 'profiles'];
const REMEMBER = 'po.remember';
const PENDING = 'po.pendingProvider';
const TOKEN = (p) => `po.ptok.${p}`;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Não foi possível carregar o cliente do Supabase.'));
    document.head.append(s);
  });
}

const safe = (fn, fb = null) => {
  try { return fn(); } catch { return fb; }
};

// Guarda a sessão no localStorage ("lembrar de mim") ou só nesta aba.
const storage = {
  getItem: (k) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k)),
  setItem: (k, v) => safe(() => {
    const remember = localStorage.getItem(REMEMBER) !== 'false';
    (remember ? localStorage : sessionStorage).setItem(k, v);
    (remember ? sessionStorage : localStorage).removeItem(k);
  }),
  removeItem: (k) => safe(() => { localStorage.removeItem(k); sessionStorage.removeItem(k); }),
};

const MESSAGES = [
  [/Invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/Email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'],
  [/User already registered/i, 'Já existe uma conta com esse e-mail.'],
  [/Password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
  [/Anonymous sign-ins are disabled/i, 'O acesso de convidado está desativado no Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).'],
  [/Manual linking is disabled/i, 'Ative "Allow manual linking" no Supabase (Authentication → Sign In / Providers) para conectar integrações.'],
  [/provider is not enabled/i, 'Esse provedor não está ativado no Supabase (Authentication → Providers).'],
  [/rate limit/i, 'Muitas tentativas. Aguarde um pouco e tente de novo.'],
  [/violates row-level security|permission denied|sem permissão/i, 'Você não tem permissão para fazer isso.'],
  [/Failed to fetch|NetworkError/i, 'Sem conexão com o servidor.'],
];

function friendly(err) {
  const msg = (err && (err.message || err.error_description || err.msg)) || String(err);
  for (const [re, pt] of MESSAGES) if (re.test(msg)) return new Error(pt);
  return new Error(msg);
}

async function run(q) {
  const { data, error } = await q;
  if (error) throw friendly(error);
  return data;
}

const toObj = (r) => ({ id: r.id, type: r.type, x: r.x, y: r.y, color: r.color || undefined, state: r.state || {}, data: r.data || {} });

export class SupabaseBackend {
  constructor(cfg) {
    this.mode = 'supabase';
    this.cfg = cfg;
    this.db = new Emitter();
    this.dbChannel = null;
  }

  async init() {
    await loadScript('vendor/supabase.js');
    this.sb = window.supabase.createClient(this.cfg.SUPABASE_URL, this.cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storage },
      realtime: { params: { eventsPerSecond: 40 } },
    });
    const { error: schemaError } = await this.sb.from('profiles').select('id').limit(0);
    if (schemaError && schemaError.code === 'PGRST205') {
      throw new Error('O banco ainda não foi configurado. Execute supabase/migrations/20261022000000_pixeloffice.sql no SQL Editor do Supabase.');
    }
    if (schemaError) throw friendly(schemaError);
    this.sb.auth.onAuthStateChange((_evt, session) => this.captureProviderToken(session));
    const { data } = await this.sb.auth.getSession();
    this.captureProviderToken(data.session);
    // remove ?code=... da URL depois do retorno do OAuth
    if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname);
  }

  captureProviderToken(session) {
    if (!session || !session.provider_token) return;
    const pending = safe(() => localStorage.getItem(PENDING));
    const provider = pending || (session.user && session.user.app_metadata && session.user.app_metadata.provider);
    if (!provider || !PROVIDERS[provider]) return;
    safe(() => {
      localStorage.setItem(TOKEN(provider), JSON.stringify({ token: session.provider_token, at: Date.now() }));
      localStorage.removeItem(PENDING);
    });
  }

  // ------------------------------------------------------------------ auth
  async session() {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    return this.loadUser(data.session.user);
  }

  async loadUser(authUser) {
    let profile = null;
    for (let i = 0; i < 4 && !profile; i++) {
      const { data } = await this.sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      profile = data;
      if (!profile) await new Promise((r) => setTimeout(r, 400));
    }
    this.uid = authUser.id;
    this.startDb();
    const guest = !!authUser.is_anonymous;
    return {
      id: authUser.id,
      email: authUser.email || '',
      name: (profile && profile.name) || 'Aventureiro',
      avatar: (profile && profile.avatar) || null,
      admin: !!(profile && profile.is_admin),
      xp: (profile && profile.xp) || 0,
      guest,
      identities: (authUser.identities || []).map((i) => i.provider),
    };
  }

  async signIn(email, password, remember = true) {
    safe(() => localStorage.setItem(REMEMBER, remember ? 'true' : 'false'));
    const data = await run(this.sb.auth.signInWithPassword({ email, password }));
    return this.loadUser(data.user);
  }

  async signUp(name, email, password) {
    safe(() => localStorage.setItem(REMEMBER, 'true'));
    const data = await run(this.sb.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: location.origin + location.pathname },
    }));
    if (!data.session) return { needsConfirmation: true };
    return this.loadUser(data.user);
  }

  async signInGuest(name) {
    safe(() => localStorage.setItem(REMEMBER, 'false'));
    const data = await run(this.sb.auth.signInAnonymously({ options: { data: { name } } }));
    return this.loadUser(data.user);
  }

  async signInWith(provider) {
    await run(this.sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } }));
  }

  /** Conecta uma integração (pede as permissões extras e volta para o escritório). */
  async linkProvider(provider, identities = []) {
    const def = PROVIDERS[provider];
    safe(() => localStorage.setItem(PENDING, provider));
    const options = { scopes: def.scopes, redirectTo: location.origin + location.pathname };
    if (provider === 'google') options.queryParams = { access_type: 'offline', prompt: 'consent' };
    if (identities.includes(provider)) await run(this.sb.auth.signInWithOAuth({ provider, options }));
    else await run(this.sb.auth.linkIdentity({ provider, options }));
  }

  providerToken(provider) {
    const t = safe(() => JSON.parse(localStorage.getItem(TOKEN(provider))));
    if (!t || !t.token) return null;
    if (Date.now() - t.at > 55 * 60 * 1000 && provider !== 'github') return null; // tokens OAuth expiram em ~1h
    return t.token;
  }

  forgetProvider(provider) {
    safe(() => localStorage.removeItem(TOKEN(provider)));
  }

  async signOut() {
    if (this.dbChannel) this.sb.removeChannel(this.dbChannel);
    await this.sb.auth.signOut();
  }

  // ------------------------------------------------------------------ perfis
  async saveProfile(patch) {
    const row = {};
    if (patch.name) row.name = patch.name;
    if (patch.avatar) row.avatar = patch.avatar;
    if (!Object.keys(row).length) return;
    await run(this.sb.from('profiles').update(row).eq('id', this.uid));
  }

  async profiles() {
    const rows = await run(this.sb.from('profiles').select('id, name, xp, avatar, is_admin').order('xp', { ascending: false }).limit(200));
    return rows.map((r) => ({ id: r.id, name: r.name, xp: r.xp, avatar: r.avatar, admin: r.is_admin }));
  }

  // ------------------------------------------------------------------ mundo
  async loadWorld(buildDefault) {
    let map = await run(this.sb.from('maps').select('*').eq('id', 'main').maybeSingle());
    if (!map) {
      const def = buildDefault();
      await run(this.sb.rpc('ensure_map', { p_map: def.map, p_objects: def.objects, p_zones: def.zones }));
      map = await run(this.sb.from('maps').select('*').eq('id', 'main').single());
    }
    const [objects, zones] = await Promise.all([
      run(this.sb.from('map_objects').select('*').eq('map_id', 'main').limit(5000)),
      run(this.sb.from('zones').select('*').eq('map_id', 'main')),
    ]);
    return {
      map: { width: map.width, height: map.height, floor: map.floor, spawn: map.spawn, openEdit: map.open_edit },
      objects: objects.map(toObj),
      zones: zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, x: z.x, y: z.y, w: z.w, h: z.h })),
    };
  }

  resetWorld(def) {
    return run(this.sb.rpc('reset_map', { p_map: def.map, p_objects: def.objects, p_zones: def.zones }));
  }

  paintFloor(cells) {
    return run(this.sb.rpc('paint_floor', { p_cells: cells }));
  }

  addObject(o) {
    return run(this.sb.from('map_objects').insert({ id: o.id, type: o.type, x: o.x, y: o.y, color: o.color || null, state: o.state || {}, data: o.data || {} }));
  }

  removeObject(id) {
    return run(this.sb.from('map_objects').delete().eq('id', id));
  }

  setObjectState(id, state) {
    return run(this.sb.from('map_objects').update({ state }).eq('id', id));
  }

  setObjectData(id, data) {
    return run(this.sb.rpc('set_object_data', { p_id: id, p_data: data }));
  }

  upsertZone(z) {
    return run(this.sb.from('zones').upsert({ id: z.id, name: z.name || '', kind: z.kind || 'area', x: z.x, y: z.y, w: z.w, h: z.h }));
  }

  removeZone(id) {
    return run(this.sb.from('zones').delete().eq('id', id));
  }

  setSettings({ spawn, openEdit }) {
    return run(this.sb.rpc('set_map_settings', { p_spawn: spawn || null, p_open_edit: openEdit === undefined ? null : openEdit }));
  }

  // ------------------------------------------------------------------ documentos dos objetos
  async getDoc(id) {
    const row = await run(this.sb.from('object_docs').select('content').eq('object_id', id).maybeSingle());
    return (row && row.content) || {};
  }

  docAppend(id, key, item, max = 500) {
    return run(this.sb.rpc('doc_append', { p_object: id, p_key: key, p_item: item, p_max: max }));
  }

  docSet(id, key, value) {
    return run(this.sb.rpc('doc_set', { p_object: id, p_key: key, p_value: value }));
  }

  docRemove(id, key, itemId) {
    return run(this.sb.rpc('doc_remove', { p_object: id, p_key: key, p_item_id: itemId }));
  }

  // ------------------------------------------------------------------ chat
  async recentMessages() {
    const rows = await run(this.sb.from('messages').select('id, user_id, name, text, created_at').order('created_at', { ascending: false }).limit(50));
    return rows.reverse().map((m) => ({ id: String(m.id), uid: m.user_id, name: m.name, text: m.text, ts: Date.parse(m.created_at) }));
  }

  saveMessage(name, text) {
    return run(this.sb.from('messages').insert({ name, text }));
  }

  // ------------------------------------------------------------------ quests
  listQuests() {
    return run(this.sb.from('quests').select('*').order('created_at', { ascending: false }).limit(500));
  }

  createQuest(q) {
    return run(this.sb.from('quests').insert(q).select().single());
  }

  updateQuest(id, patch) {
    return run(this.sb.from('quests').update(patch).eq('id', id));
  }

  completeQuest(id) {
    return run(this.sb.rpc('complete_quest', { p_id: id }));
  }

  reopenQuest(id) {
    return run(this.sb.rpc('reopen_quest', { p_id: id }));
  }

  deleteQuest(id) {
    return run(this.sb.from('quests').delete().eq('id', id));
  }

  questComments(id) {
    return run(this.sb.from('quest_comments').select('*').eq('quest_id', id).order('created_at'));
  }

  addQuestComment(id, name, text) {
    return run(this.sb.from('quest_comments').insert({ quest_id: id, name, text }));
  }

  // ------------------------------------------------------------------ objetos inteligentes
  feed() {
    return run(this.sb.from('object_feed').select('*').order('created_at', { ascending: false }).limit(300));
  }

  dismissFeed(id) {
    return run(this.sb.from('object_feed').delete().eq('id', id));
  }

  async webhookUrl(objectId) {
    const token = await run(this.sb.rpc('webhook_token', { p_object: objectId }));
    return `${this.cfg.SUPABASE_URL}/functions/v1/webhook?object=${encodeURIComponent(objectId)}&token=${token}`;
  }

  // ------------------------------------------------------------------ notas de reunião
  listNotes() {
    return run(this.sb.from('meeting_notes').select('*').order('created_at', { ascending: false }).limit(100));
  }

  saveNote(n) {
    return run(this.sb.from('meeting_notes').insert(n).select().single());
  }

  updateNote(id, patch) {
    return run(this.sb.from('meeting_notes').update(patch).eq('id', id));
  }

  deleteNote(id) {
    return run(this.sb.from('meeting_notes').delete().eq('id', id));
  }

  async summarize(transcript) {
    const { data, error } = await this.sb.functions.invoke('summarize', { body: { transcript } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
      throw new Error(/not found|404/i.test(msg) ? 'A função de resumo (summarize) não foi publicada no Supabase.' : msg);
    }
    return data.summary;
  }

  // ------------------------------------------------------------------ fliperama
  topScores(game) {
    return run(this.sb.from('game_scores').select('name, score, created_at').eq('game', game).order('score', { ascending: false }).limit(10));
  }

  addScore(game, name, score) {
    return run(this.sb.from('game_scores').insert({ game, name, score }));
  }

  // ------------------------------------------------------------------ mudanças no banco
  startDb() {
    if (this.dbChannel) return;
    let ch = this.sb.channel('db-changes');
    for (const table of TABLES) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => this.db.emit(table, p));
    }
    ch.subscribe();
    this.dbChannel = ch;
  }

  onChange(table, fn) {
    return this.db.on(table, fn);
  }

  // ------------------------------------------------------------------ sala em tempo real
  joinRoom(key, initial) {
    const room = new Emitter();
    let last = initial;
    let ch = null;
    let generation = 0;
    let left = false;
    let retryTimer = 0;
    let retryCount = 0;
    let connectedAt = 0;

    const connect = () => {
      if (left || ch) return;
      const current = ++generation;
      const channel = this.sb.channel('office:main', {
        config: { presence: { key }, broadcast: { self: false, ack: false } },
      });
      ch = channel;
      channel.on('presence', { event: 'sync' }, () => {
        const out = {};
        for (const [k, metas] of Object.entries(channel.presenceState())) {
          const m = metas[metas.length - 1];
          if (m) {
            const { presence_ref: _ref, ...state } = m;
            out[k] = state;
          }
        }
        room.emit('presence', out);
      });
      channel.on('broadcast', { event: '*' }, (msg) => room.emit(msg.event, msg.payload));
      channel.subscribe(async (status, error) => {
        if (left || current !== generation) return;
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          disconnect(channel, current, status, error);
          return;
        }
        room.emit('status', status);
        if (status === 'SUBSCRIBED') {
          connectedAt = Date.now();
          try {
            const result = await channel.track(last);
            if (result !== 'ok') throw new Error(`Presence tracking failed: ${result}`);
          } catch (trackError) {
            retry(channel, current, 'CHANNEL_ERROR', trackError);
            return;
          }
          if (!left && current === generation) room.emit('ready');
        }
      });
    };

    const retry = (channel, current, status, error) => {
      if (left || current !== generation) return;
      generation++;
      ch = null;
      if (connectedAt && Date.now() - connectedAt >= 30000) retryCount = 0;
      connectedAt = 0;
      room.emit('status', status);
      console.warn('Supabase room disconnected; retrying automatically.', error || status);
      const retryGeneration = generation;
      this.sb.removeChannel(channel).catch((removeError) => {
        console.error('Could not remove disconnected Supabase room channel.', removeError);
      }).finally(() => {
        if (left || retryGeneration !== generation || retryTimer) return;
        const delay = Math.min(1000 * (2 ** retryCount), 30000);
        retryCount++;
        retryTimer = setTimeout(() => {
          retryTimer = 0;
          connect();
        }, delay);
      });
    };

    const retryWhenOnline = () => {
      if (left || ch || !retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = 0;
      connect();
    };

    window.addEventListener('online', retryWhenOnline);
    connect();
    room.send = (type, payload) => {
      if (ch && ch.state === 'joined') ch.send({ type: 'broadcast', event: type, payload });
    };
    room.track = (state) => {
      last = state;
      if (!ch || ch.state !== 'joined') return Promise.resolve('error');
      return ch.track(state);
    };
    room.leave = () => {
      left = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', retryWhenOnline);
      if (ch) return this.sb.removeChannel(ch);
      return Promise.resolve('ok');
    };
    return room;
  }
}
