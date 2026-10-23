// Integrações via login OAuth do Supabase:
// Google Agenda / Outlook → status "Ocupado" automático durante reuniões
// GitHub → importar issues atribuídas como quests · Spotify → mostrar o que está tocando
import { h, toast, fill } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { PROVIDERS } from '../backend/index.js';

const AUTO = 'po.autostatus';
const SHARE = 'po.sharemusic';
const flag = (k, def = true) => { try { const v = localStorage.getItem(k); return v === null ? def : v === 'true'; } catch { return def; } };
const setFlag = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* ok */ } };

export class Integrations {
  constructor(app) {
    this.app = app;
    this.events = [];
    this.autoBusy = false;
    setTimeout(() => this.poll(), 3000);
    setInterval(() => this.pollCalendar(), 120000);
    setInterval(() => this.pollSpotify(), 30000);
  }

  get b() { return this.app.backend; }
  token(p) { return this.b.providerToken(p); }
  enabled(p) { return this.app.backend.cfg.INTEGRATIONS[p] !== false; }

  async api(provider, url, headers = {}) {
    const t = this.token(provider);
    if (!t) return null;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}`, ...headers } });
    if (res.status === 401) {
      this.b.forgetProvider(provider);
      toast(`A conexão com ${PROVIDERS[provider].name} expirou. Reconecte em Integrações.`, 'warn', 6000);
      return null;
    }
    if (res.status === 204) return {};
    if (!res.ok) throw new Error(`${PROVIDERS[provider].name}: erro ${res.status}`);
    return res.json();
  }

  poll() {
    this.pollCalendar();
    this.pollSpotify();
  }

  // ------------------------------------------------------------------ agenda
  async fetchEvents() {
    const now = new Date();
    const until = new Date(now.getTime() + 14 * 3600 * 1000);
    const out = [];
    try {
      const g = await this.api('google', `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=15&timeMin=${now.toISOString()}&timeMax=${until.toISOString()}`);
      for (const e of (g && g.items) || []) {
        if (e.transparency === 'transparent' || !e.start || !e.start.dateTime) continue;
        out.push({ title: e.summary || '(sem título)', start: new Date(e.start.dateTime), end: new Date(e.end.dateTime), link: e.hangoutLink || e.htmlLink, src: 'Google' });
      }
    } catch (e) { console.warn(e); }
    try {
      const m = await this.api('azure', `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now.toISOString()}&endDateTime=${until.toISOString()}&$orderby=start/dateTime&$top=15`, { Prefer: 'outlook.timezone="UTC"' });
      for (const e of (m && m.value) || []) {
        if (e.isAllDay || e.showAs === 'free') continue;
        out.push({ title: e.subject || '(sem título)', start: new Date(`${e.start.dateTime}Z`), end: new Date(`${e.end.dateTime}Z`), link: e.onlineMeeting && e.onlineMeeting.joinUrl, src: 'Outlook' });
      }
    } catch (e) { console.warn(e); }
    return out.sort((a, b) => a.start - b.start);
  }

  async pollCalendar() {
    if (!this.token('google') && !this.token('azure')) return;
    this.events = await this.fetchEvents();
    if (!flag(AUTO)) return;
    const now = Date.now();
    const current = this.events.find((e) => e.start <= now && e.end > now);
    const me = this.app.me;
    if (current && me.status !== 'busy') {
      this.autoBusy = true;
      this.app.setStatus('busy', 'Em reunião (agenda)');
      toast(`📅 Você está em “${current.title}”: status alterado para Ocupado.`, 'info', 5000);
    } else if (!current && this.autoBusy) {
      this.autoBusy = false;
      this.app.setStatus('online');
    }
  }

  async openCalendar() {
    const has = this.token('google') || this.token('azure');
    const body = h('div', { class: 'calendar' }, h('p', { class: 'muted' }, 'Carregando…'));
    openModal({ title: '📅 Minha agenda', content: body, className: 'modal-wide' });
    if (!has) {
      fill(body, h('p', {}, 'Conecte o Google Agenda ou o Outlook para ver seus compromissos e mudar seu status automaticamente durante reuniões.'),
        h('button', { class: 'btn-primary', onclick: () => this.open() }, 'Abrir integrações'));
      return;
    }
    this.events = await this.fetchEvents();
    const fmt = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    fill(body, this.events.length
      ? h('ul', { class: 'event-list' }, this.events.map((e) => h('li', { class: e.start <= Date.now() && e.end > Date.now() ? 'now' : '' },
        h('span', { class: 'ev-time' }, `${fmt(e.start)}–${fmt(e.end)}`), h('strong', {}, e.title), h('span', { class: 'muted small' }, e.src),
        e.link ? h('a', { href: e.link, target: '_blank', rel: 'noopener' }, 'abrir') : null)))
      : h('p', { class: 'muted' }, 'Nada nas próximas horas. 🎉'));
  }

  // ------------------------------------------------------------------ spotify
  async pollSpotify() {
    if (!this.token('spotify')) return;
    const me = this.app.me;
    let music = '';
    if (flag(SHARE)) {
      try {
        const d = await this.api('spotify', 'https://api.spotify.com/v1/me/player/currently-playing');
        if (d && d.is_playing && d.item) music = `${d.item.name} — ${(d.item.artists || []).map((a) => a.name).join(', ') || d.item.show?.name || ''}`.slice(0, 80);
      } catch (e) { console.warn(e); }
    }
    if (music !== (me.music || '')) {
      me.music = music;
      this.app.trackSoon();
      this.app.emitUi('players');
    }
  }

  // ------------------------------------------------------------------ github
  async openGithub() {
    const body = h('div', {}, h('p', { class: 'muted' }, 'Buscando issues atribuídas a você…'));
    openModal({ title: '🐙 Issues do GitHub', className: 'modal-wide', content: body });
    try {
      const list = (await this.api('github', 'https://api.github.com/issues?filter=assigned&state=open&per_page=40')) || [];
      const imported = new Set(this.app.quests.list.map((q) => q.link));
      fill(body, list.length ? h('ul', { class: 'gh-list' }, list.map((i) => {
        const done = imported.has(i.html_url);
        return h('li', {},
          h('div', {}, h('a', { href: i.html_url, target: '_blank', rel: 'noopener' }, `#${i.number} ${i.title}`), h('p', { class: 'muted small' }, i.repository ? i.repository.full_name : '')),
          h('button', { class: 'btn-secondary small', disabled: done || this.app.user.guest, onclick: async (e) => {
            e.target.disabled = true;
            try {
              await this.app.quests.createFrom({ title: i.title.slice(0, 118), description: `${i.repository ? i.repository.full_name : ''}\n\n${(i.body || '').slice(0, 1500)}`, link: i.html_url, assignees: [this.app.user.id], status: 'andamento' });
              e.target.textContent = 'Importada ✓';
            } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
          } }, done ? 'Já é quest ✓' : 'Importar como quest'));
      })) : h('p', { class: 'muted' }, 'Nenhuma issue aberta atribuída a você.'));
    } catch (e) {
      fill(body, h('p', {}, e.message));
    }
  }

  // ------------------------------------------------------------------ janela de integrações
  open() {
    const app = this.app;
    const body = h('div', { class: 'integrations' });
    const paint = () => {
      if (app.backend.mode === 'local') {
        fill(body, h('p', {}, 'As integrações usam o login dos provedores pelo Supabase. No modo demonstração elas ficam desativadas.'),
          h('p', { class: 'muted small' }, 'Depois de configurar o Supabase, ative Google, Azure (Microsoft), GitHub e Spotify em Authentication → Providers. O README explica o passo a passo.'));
        return;
      }
      const rows = Object.entries(PROVIDERS).filter(([p]) => this.enabled(p)).map(([p, def]) => {
        const connected = !!this.token(p);
        const extra = {
          google: connected ? h('button', { class: 'btn-link', onclick: () => this.openCalendar() }, 'ver agenda') : null,
          azure: connected ? h('button', { class: 'btn-link', onclick: () => this.openCalendar() }, 'ver agenda') : null,
          github: connected ? h('button', { class: 'btn-link', onclick: () => this.openGithub() }, 'importar issues') : null,
          spotify: null,
        }[p];
        return h('li', { class: connected ? 'on' : '' },
          h('span', { class: 'int-ico' }, def.icon),
          h('div', { class: 'int-main' }, h('strong', {}, def.name), h('span', { class: 'muted small' }, connected ? 'Conectado' : 'Não conectado'), extra),
          connected
            ? h('button', { class: 'btn-secondary small', onclick: () => { this.b.forgetProvider(p); paint(); } }, 'Desconectar')
            : h('button', { class: 'btn-primary small', disabled: app.user.guest && p !== 'spotify', onclick: () => this.b.linkProvider(p, app.user.identities || []).catch((e) => toast(e.message, 'error', 7000)) }, 'Conectar'));
      });
      fill(body, 
        h('ul', { class: 'int-list' }, rows),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: flag(AUTO), onchange: (e) => { setFlag(AUTO, e.target.checked); this.pollCalendar(); } }), 'Mudar meu status para "Ocupado" durante eventos da agenda'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: flag(SHARE), onchange: (e) => { setFlag(SHARE, e.target.checked); this.pollSpotify(); } }), 'Mostrar para o time a música que estou ouvindo no Spotify'),
        h('p', { class: 'muted small' }, 'A conexão é renovada ao clicar em Conectar (por segurança, o acesso dos provedores expira em cerca de 1 hora). Notificações de GitHub, Asana e HubSpot no mapa usam objetos inteligentes: interaja com uma mesa ou com a caixa de notificações.'));
    };
    paint();
    openModal({ title: '🔌 Integrações', className: 'modal-wide', content: body });
  }
}
