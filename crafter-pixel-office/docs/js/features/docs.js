// Conteúdo compartilhado dos móveis: mesas (dono + notificações), caixa de notificações,
// estante de links, mural de avisos, baú (bloco de notas), tela de vídeo e jukebox.
import { h, toast, uid, fill } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';

export function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname.includes('youtube.com') && u.searchParams.get('list')) return `https://www.youtube.com/embed/videoseries?list=${u.searchParams.get('list')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname === 'open.spotify.com' && !u.pathname.startsWith('/embed')) return `https://open.spotify.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com') && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
    return url;
  } catch {
    return '';
  }
}

const ago = (ts) => {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return new Date(ts).toLocaleDateString('pt-BR');
};

export class DocsUi {
  constructor(app) {
    this.app = app;
    this.view = null; // { id, refresh }
    app.on('doc', (id) => { if (this.view && this.view.id === id) this.view.refresh(); });
    app.on('feed', () => { if (this.view && this.view.feed) this.view.refresh(); });
  }

  open(o, title, render, opts = {}) {
    const body = h('div', { class: 'docbox' });
    const refresh = async () => {
      const doc = await this.app.backend.getDoc(o.id).catch(() => ({}));
      if (this.view && this.view.body === body) render(body, doc);
    };
    this.view = { id: o.id, body, refresh, feed: opts.feed };
    openModal({ title, className: opts.wide ? 'modal-wide' : '', content: body, onClose: () => { if (this.view && this.view.body === body) this.view = null; opts.onClose?.(); } });
    refresh();
  }

  async append(o, key, item, max) {
    try {
      await this.app.backend.docAppend(o.id, key, item, max);
      this.app.room.send('doc', { id: o.id });
      this.view?.refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  async set(o, key, value, quiet) {
    try {
      await this.app.backend.docSet(o.id, key, value);
      this.app.room.send('doc', { id: o.id });
      if (!quiet) this.view?.refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  async remove(o, key, itemId) {
    try {
      await this.app.backend.docRemove(o.id, key, itemId);
      this.app.room.send('doc', { id: o.id });
      this.view?.refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ------------------------------------------------------------------ objetos inteligentes
  feedList(o) {
    const items = this.app.feed.filter((f) => f.object_id === o.id);
    const icon = { github: '🐙', asana: '🟣', hubspot: '🟠', teste: '🧪' };
    return items.length
      ? h('ul', { class: 'feed-list' }, items.map((f) => h('li', {},
        h('span', { class: 'feed-ico' }, icon[f.source] || '🔔'),
        h('div', { class: 'feed-main' },
          f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.title) : h('strong', {}, f.title),
          f.body ? h('p', { class: 'muted small' }, f.body) : null),
        h('time', { class: 'muted small' }, ago(f.created_at)),
        this.app.user.guest ? null : h('button', { class: 'icon-btn', title: 'Dispensar', html: ICONS.check, onclick: async () => { await this.app.backend.dismissFeed(f.id).catch((e) => toast(e.message, 'error')); this.app.refreshFeed(); } }))))
      : h('p', { class: 'muted small' }, 'Nenhuma notificação por aqui.');
  }

  webhookBox(o) {
    const app = this.app;
    const box = h('div', { class: 'webhook' });
    if (app.backend.mode === 'local') {
      box.append(h('p', { class: 'muted small' }, 'No modo demonstração não há webhook real. Simule uma notificação:'),
        h('button', { class: 'btn-secondary small', onclick: () => app.backend.simulateFeed(o.id, { source: 'github', title: 'PR #42 aberto: Ajustar relatório semanal', body: 'crafter/relatorios', url: 'https://github.com' }) }, '🧪 Simular notificação do GitHub'));
      return box;
    }
    if (!app.canEdit) {
      box.append(h('p', { class: 'muted small' }, 'Para conectar GitHub, Asana, HubSpot ou n8n a este objeto, peça a um editor o link de webhook.'));
      return box;
    }
    const out = h('div', {});
    box.append(h('button', { class: 'btn-secondary small', onclick: async () => {
      try {
        const url = await app.backend.webhookUrl(o.id);
        fill(out, 
          h('div', { class: 'row-input' }, h('input', { type: 'text', readonly: true, value: url, onclick: (e) => e.target.select() }),
            h('button', { class: 'icon-btn', title: 'Copiar', html: ICONS.copy, onclick: () => { navigator.clipboard.writeText(url); toast('Link copiado!', 'ok', 1500); } })),
          h('p', { class: 'muted small' }, 'Cole este link como Webhook (POST, JSON) no GitHub (Settings → Webhooks), Asana, HubSpot, n8n ou Zapier. Formato genérico: {"title": "...", "body": "...", "url": "..."}.'));
      } catch (e) { toast(e.message, 'error'); }
    } }, '🔗 Mostrar link de webhook'), out);
    return box;
  }

  openFeed(o) {
    this.open(o, '🔔 Notificações', (body) => {
      fill(body, this.feedList(o), h('div', { class: 'opt-label' }, 'Conectar'), this.webhookBox(o));
    }, { feed: true, wide: true });
  }

  openDesk(o) {
    const app = this.app;
    this.open(o, '🪑 Mesa de trabalho', (body, doc) => {
      const owner = doc.owner;
      const mine = owner && owner.uid === app.user.id;
      fill(body, 
        h('div', { class: 'desk-owner' },
          owner ? h('p', {}, 'Mesa de ', h('strong', {}, owner.name), mine ? ' (sua)' : '') : h('p', { class: 'muted' }, 'Mesa livre.'),
          app.user.guest ? null : !owner ? h('button', { class: 'btn-primary small', onclick: () => this.set(o, 'owner', { uid: app.user.id, name: app.me.name }) }, 'Reivindicar esta mesa')
            : mine || app.user.admin ? h('button', { class: 'btn-secondary small', onclick: () => this.set(o, 'owner', null) }, 'Liberar mesa') : null),
        h('div', { class: 'opt-label' }, 'Notificações nesta mesa'),
        this.feedList(o),
        mine || app.canEdit ? [h('div', { class: 'opt-label' }, 'Conectar ferramentas'), this.webhookBox(o)] : null);
    }, { feed: true, wide: true });
  }

  // ------------------------------------------------------------------ estante de links
  openLinks(o) {
    const app = this.app;
    this.open(o, '📚 Biblioteca de links', (body, doc) => {
      const links = doc.links || [];
      const title = h('input', { type: 'text', placeholder: 'Nome (ex.: Manual da marca)', maxlength: 80 });
      const url = h('input', { type: 'url', placeholder: 'https://…' });
      const add = () => {
        const u = url.value.trim();
        if (!/^https?:\/\//.test(u)) return toast('Informe um link começando com https://', 'warn');
        this.append(o, 'links', { id: uid('l'), title: title.value.trim() || u, url: u, by: app.me.name, ts: Date.now() }, 300);
      };
      fill(body, 
        links.length ? h('ul', { class: 'link-list' }, links.map((l) => h('li', {},
          h('a', { href: l.url, target: '_blank', rel: 'noopener' }, '📖 ', l.title),
          h('span', { class: 'muted small' }, l.by),
          h('button', { class: 'icon-btn danger', title: 'Remover', html: ICONS.trash, onclick: () => this.remove(o, 'links', l.id) })))) : h('p', { class: 'muted' }, 'Estante vazia. Guarde aqui links de documentos, pastas e ferramentas do time.'),
        app.user.guest ? null : h('div', { class: 'row-input' }, title, url, h('button', { class: 'btn-primary small', onclick: add }, 'Adicionar')));
    }, { wide: true });
  }

  // ------------------------------------------------------------------ mural de avisos
  openMural(o) {
    const app = this.app;
    this.open(o, '📌 Mural de avisos', (body, doc) => {
      const posts = [...(doc.posts || [])].reverse();
      const text = h('textarea', { rows: 3, maxlength: 600, placeholder: 'Escreva um aviso para o time…' });
      fill(body, 
        app.user.guest ? null : h('div', { class: 'mural-new' }, text, h('button', { class: 'btn-primary small', onclick: () => {
          const t = text.value.trim();
          if (!t) return;
          this.append(o, 'posts', { id: uid('p'), text: t, by: app.me.name, uid: app.user.id, ts: Date.now() }, 100);
          app.room.send('quest', { type: 'other', title: `fixou um aviso no mural: “${t.slice(0, 60)}”`, by: app.me.name });
        } }, '📌 Fixar aviso')),
        posts.length ? h('div', { class: 'mural' }, posts.map((p, i) => h('div', { class: `postit c${i % 4}` },
          h('p', {}, p.text), h('footer', {}, h('span', {}, `— ${p.by}, ${ago(p.ts)}`),
            p.uid === app.user.id || app.user.admin ? h('button', { class: 'icon-btn', title: 'Remover', html: ICONS.trash, onclick: () => this.remove(o, 'posts', p.id) }) : null)))) : h('p', { class: 'muted' }, 'Nenhum aviso fixado.'));
    }, { wide: true });
  }

  // ------------------------------------------------------------------ baú (bloco de notas)
  openStash(o) {
    let timer = 0;
    let area = null;
    this.open(o, '🧰 Baú de anotações', (body, doc) => {
      if (area && document.activeElement === area) return; // não atropela quem está digitando
      area = h('textarea', { class: 'stash', rows: 14, placeholder: 'Bloco de notas compartilhado: ideias, senhas de wi-fi do evento, lista de compras da copa…' });
      area.value = doc.text || '';
      area.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.set(o, 'text', area.value, true), 600);
      });
      fill(body, area, h('p', { class: 'muted small' }, 'Salva automaticamente e aparece para todos.'));
    }, { wide: true });
  }

  // ------------------------------------------------------------------ tela / jukebox
  openTv(o) {
    const app = this.app;
    if (!(o.state && o.state.on)) app.setObjectState(o, { ...o.state, on: true });
    this.openMedia(o, '📺 Tela de vídeo', 'Cole um link do YouTube, Vimeo ou outra página para todos assistirem.', () => app.setObjectState(o, { ...o.state, on: false }));
  }

  openJukebox(o) {
    this.openMedia(o, '🎵 Jukebox', 'Cole uma playlist do Spotify ou do YouTube. Cada pessoa ouve no próprio computador.');
  }

  openMedia(o, title, hint, onOff) {
    const app = this.app;
    this.open(o, title, (body, doc) => {
      const url = doc.url || (o.data && o.data.url) || '';
      const input = h('input', { type: 'url', placeholder: 'https://…', value: url });
      const src = toEmbedUrl(url);
      fill(body, 
        h('div', { class: 'embed-box tall' }, src ? h('iframe', { src, allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: true }) : h('p', { class: 'muted center' }, hint)),
        app.user.guest ? null : h('div', { class: 'row-input' }, input, h('button', { class: 'btn-primary small', onclick: () => this.set(o, 'url', input.value.trim()) }, 'Tocar para todos')),
        onOff ? h('button', { class: 'btn-link', onclick: onOff }, 'Desligar a tela') : null);
    }, { wide: true });
  }
}
