// Painel lateral (Pessoas / Chat / Minhas quests).
import { $, $$, h, fill } from './dom.js';
import { ICONS } from './icons.js';
import { avatarThumb } from '../art/avatar.js';
import { isNear, onStage } from '../game/world.js';

const STATUS_LABEL = { online: 'Disponível', busy: 'Ocupado', away: 'Ausente' };

export class Sidebar {
  constructor(app) {
    this.app = app;
    this.el = $('#sidebar');
    this.tab = 'people';
    for (const t of $$('.tab', this.el)) t.addEventListener('click', () => this.open(t.dataset.tab));
    $('.close-sidebar', this.el).addEventListener('click', () => this.close());
  }

  open(tab = this.tab) {
    this.tab = tab;
    this.el.hidden = false;
    for (const t of $$('.tab', this.el)) t.classList.toggle('on', t.dataset.tab === tab);
    $('#people-panel').hidden = tab !== 'people';
    $('#chat-panel').hidden = tab !== 'chat';
    $('#myquests-panel').hidden = tab !== 'myquests';
    if (tab === 'chat') this.app.chat.clearUnread();
    if (tab === 'people') this.app.people.render();
    if (tab === 'myquests') this.app.myQuests.render();
    this.app.emitUi('sidebar');
  }

  close() {
    this.el.hidden = true;
    this.app.emitUi('sidebar');
  }

  toggle(tab) {
    if (!this.el.hidden && this.tab === tab) this.close();
    else this.open(tab);
  }
}

export class People {
  constructor(app) {
    this.app = app;
    this.root = $('#people-panel');
    this.queued = false;
    app.on('players', () => this.schedule());
    setInterval(() => this.schedule(), 2000);
  }

  schedule() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.render(); });
  }

  render() {
    const { app } = this;
    const count = app.players.size;
    $('#people-count').textContent = count;
    $('#people-count-bar').textContent = count;
    if (this.root.hidden || $('#sidebar').hidden) return;
    const me = app.me;
    const list = [...app.players.values()].sort((a, b) => (a === me ? -1 : b === me ? 1 : a.name.localeCompare(b.name)));
    const near = list.filter((p) => p !== me && isNear(app.world, me, p, app.proximity));
    fill(this.root, 
      h('p', { class: 'muted small' }, `${count} ${count === 1 ? 'pessoa online' : 'pessoas online'} · ${near.length} perto de você`),
      h('ul', { class: 'people-list' }, list.map((p) => this.item(p, near.includes(p)))),
    );
  }

  item(p, near) {
    const isMe = p === this.app.me;
    const zone = this.app.world.zoneAt(p.x, p.y);
    const thumb = avatarThumb(p.avatar, 38);
    thumb.className = 'thumb';
    const extras = [];
    if (p.media && p.media.on) extras.push(`${p.media.cam ? '📷' : ''}${p.media.mic ? '🎤' : '🔇'}${p.media.screen ? '🖥️' : ''}`);
    if (onStage(this.app.world, p)) extras.push('📢 no palco');
    for (const b of p.activeBuffs()) extras.push(b.e);
    return h('li', { class: `person ${near ? 'near' : ''}` },
      h('div', { class: 'thumb-wrap' }, thumb, h('span', { class: `status-dot ${p.status}` })),
      h('div', { class: 'person-info' },
        h('strong', {}, h('span', { class: 'lv' }, `Lv${p.level || 1}`), ' ', p.name, isMe ? h('span', { class: 'muted' }, ' (você)') : null, p.admin ? h('span', { class: 'tag' }, 'admin') : null, p.guest ? h('span', { class: 'tag tag-muted' }, 'convidado') : null),
        h('span', { class: 'muted small' }, p.statusText || STATUS_LABEL[p.status] || '', zone && zone.name ? ` · ${zone.name}` : '', near ? ' · perto' : '', extras.length ? ` · ${extras.join(' ')}` : ''),
        p.music ? h('span', { class: 'muted small music' }, `🎵 ${p.music}`) : null),
      isMe ? null : h('div', { class: 'person-actions' },
        h('button', { class: 'icon-btn', title: `Acenar para ${p.name}`, html: ICONS.wave, onclick: () => this.app.wave(p) }),
        h('button', { class: 'icon-btn', title: `Ir até ${p.name}`, html: ICONS.walk, onclick: () => this.app.goTo(p.x, p.y) })));
  }
}

export class MyQuests {
  constructor(app) {
    this.app = app;
    this.root = $('#myquests-panel');
    app.on('quests', () => { if (!this.root.hidden) this.render(); });
  }

  render() {
    const { app } = this;
    const uid = app.user.id;
    const mine = app.quests.list.filter((q) => q.status !== 'concluida' && (q.assignees || []).includes(uid));
    const open = app.quests.list.filter((q) => q.status === 'aberta' && !(q.assignees || []).length).slice(0, 5);
    const row = (q) => h('li', { class: 'mq', onclick: () => app.quests.open(q.id) },
      h('span', { class: `qstatus ${q.status}` }), h('span', { class: 'mq-title' }, q.title), h('span', { class: 'mq-xp' }, `+${q.reward_xp} XP`));
    fill(this.root, 
      h('button', { class: 'btn-primary full', onclick: () => app.quests.open() }, h('span', { html: ICONS.scroll }), 'Abrir quadro de quests'),
      h('div', { class: 'opt-label' }, `Em andamento comigo (${mine.length})`),
      mine.length ? h('ul', { class: 'mq-list' }, mine.map(row)) : h('p', { class: 'muted small' }, 'Nenhuma quest aceita. Pegue uma no quadro!'),
      h('div', { class: 'opt-label' }, 'Disponíveis'),
      open.length ? h('ul', { class: 'mq-list' }, open.map(row)) : h('p', { class: 'muted small' }, 'Nenhuma quest livre agora.'),
    );
  }
}
