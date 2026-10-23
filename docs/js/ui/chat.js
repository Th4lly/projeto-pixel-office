// Chat global (salvo no banco) e por proximidade (só para quem está perto / na mesma área privada).
import { $, $$, h } from './dom.js';
import { blip } from '../audio.js';

export class Chat {
  constructor(app) {
    this.app = app;
    this.scope = 'all';
    this.unread = 0;
    this.seen = new Set();
    this.log = $('#chat-log');
    this.input = $('#chat-input');

    for (const b of $$('.scope button')) b.addEventListener('click', () => { this.setScope(b.dataset.scope); this.input.focus(); });
    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim().slice(0, 500);
      if (!text) return;
      const me = app.me;
      const msg = { id: me.id, mid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, uid: me.uid, name: me.name, text, scope: this.scope, ts: Date.now() };
      app.room.send('chat', msg);
      this.add(msg);
      if (msg.scope === 'all') app.backend.saveMessage(me.name, text).catch(() => {});
      this.input.value = '';
    });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.input.blur(); });
    this.system('Bem-vindo! Ande com WASD/setas ou clicando no mapa. Aperte X perto de um objeto para interagir.');
  }

  setScope(scope) {
    this.scope = scope;
    for (const b of $$('.scope button')) b.classList.toggle('on', b.dataset.scope === scope);
    this.input.placeholder = scope === 'near' ? 'Mensagem para quem está perto…' : 'Mensagem para todos… (Enter)';
  }

  focus() {
    this.app.sidebar.open('chat');
    this.input.focus();
  }

  isVisible() {
    return !$('#sidebar').hidden && !$('#chat-panel').hidden;
  }

  add(msg, silent = false) {
    const key = msg.mid || msg.id + msg.ts;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const mine = msg.uid === this.app.me.uid;
    const time = new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    this.append(h('div', { class: `msg ${mine ? 'mine' : ''}` },
      h('div', { class: 'msg-head' }, h('strong', {}, msg.name), msg.scope === 'near' ? h('span', { class: 'tag' }, 'perto') : null, h('time', {}, time)),
      h('div', { class: 'msg-text' }, msg.text)));
    if (silent) return;
    const p = this.app.players.get(msg.id);
    if (p) p.bubble = { text: msg.text, t: performance.now() };
    if (!mine && !this.isVisible()) {
      this.unread++;
      this.app.emitUi('unread', this.unread);
      blip(660);
    }
  }

  system(text) {
    this.append(h('div', { class: 'msg system' }, text));
  }

  append(el) {
    const atBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
    this.log.append(el);
    while (this.log.children.length > 200) this.log.firstChild.remove();
    if (atBottom) this.log.scrollTop = this.log.scrollHeight;
  }

  clearUnread() {
    this.unread = 0;
    this.app.emitUi('unread', 0);
    this.log.scrollTop = this.log.scrollHeight;
  }
}
