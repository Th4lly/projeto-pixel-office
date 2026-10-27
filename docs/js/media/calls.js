// Chamadas diretas: o botão de telefone (e o telefone das salas/mesas) liga para as
// pessoas escolhidas, onde quer que estejam no mapa. Quem atende entra na chamada;
// se a chamada saiu de uma sala de reunião, quem está na sala também participa.
// O áudio/vídeo usa a mesma malha WebRTC da proximidade (media/rtc.js).
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { avatarThumb } from '../art/avatar.js';
import { blip } from '../audio.js';

const RING_MS = 30000;
const cid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export class Calls {
  constructor(app) {
    this.app = app;
    this.call = null; // { id, members:Set, room, place, host }
    this.ringing = null; // chamada recebida esperando resposta
    this.outgoing = new Map(); // id → timer
    this.bar = h('div', { class: 'call-bar win', hidden: true });
    document.getElementById('app').append(this.bar);
  }

  /** O WebRTC pergunta: devo me conectar com esta pessoa por causa de uma chamada? */
  wants(p) {
    const c = this.call;
    if (!c) return false;
    if (c.members.has(p.id)) return true;
    if (c.room) {
      const z = this.app.world.zones.find((zz) => zz.id === c.room);
      if (z && p.x >= z.x && p.y >= z.y && p.x < z.x + z.w && p.y < z.y + z.h) return true;
    }
    return false;
  }

  /** Alguém de fora (na chamada da sala) deve ser ouvido por quem está na sala. */
  roomWants(p) {
    // p está numa chamada ligada à sala onde eu estou?
    const calls = p.call;
    if (!calls || !calls.room) return false;
    const z = this.app.world.zones.find((zz) => zz.id === calls.room);
    const me = this.app.me;
    return !!(z && me.x >= z.x && me.y >= z.y && me.x < z.x + z.w && me.y < z.y + z.h);
  }

  presence() {
    const c = this.call;
    return c ? { id: c.id, room: c.room || null } : null;
  }

  currentRoom() {
    const me = this.app.me;
    const z = this.app.world.zonesAt(me.x, me.y).find((zz) => zz.kind === 'private' || zz.meeting);
    return z || null;
  }

  // ------------------------------------------------------------------ discador (botão telefone)
  openDialer({ place = '', from = '' } = {}) {
    const app = this.app;
    const room = this.currentRoom();
    const chosen = new Set();
    const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar pessoa…' });
    const list = h('ul', { class: 'dial-list' });
    const others = () => [...app.players.values()].filter((p) => p !== app.me);
    const paint = () => {
      const q = search.value.trim().toLowerCase();
      const ps = others().filter((p) => !q || p.name.toLowerCase().includes(q));
      fill(list, ps.length ? ps.map((p) => {
        const busy = p.call && (!this.call || p.call.id !== this.call.id);
        const cb = h('input', { type: 'checkbox', checked: chosen.has(p.id), onchange: (e) => { if (e.target.checked) chosen.add(p.id); else chosen.delete(p.id); btn.disabled = !chosen.size; } });
        return h('li', { class: `dial-row ${p.status}` },
          h('label', {}, cb, avatarThumb(p.avatar, 32), h('span', { class: 'dial-name' }, p.name),
            h('span', { class: 'muted small' }, busy ? 'em outra chamada' : p.status === 'busy' ? 'ocupado' : p.status === 'away' ? 'ausente' : 'disponível')),
          h('button', { type: 'button', class: 'icon-btn', title: `Ligar só para ${p.name}`, html: ICONS.phone, onclick: () => { m.close(); this.start([p.id], { place: place || this.placeName(room, from), room: room && room.id }); } }));
      }) : h('li', { class: 'muted' }, 'Ninguém online agora.'));
    };
    search.addEventListener('input', paint);
    const btn = h('button', { type: 'button', class: 'btn-primary', disabled: true, onclick: () => { m.close(); this.start([...chosen], { place: place || this.placeName(room, from), room: room && room.id }); } },
      h('span', { class: 'phone-ic', html: ICONS.phone }), 'Ligar');
    const where = room ? `Ligando da ${room.name}: quem atender entra na reunião com todos da sala.` : from === 'mesa' ? 'Ligando da sua mesa.' : 'Escolha com quem você quer se conectar. Funciona de qualquer lugar do mapa.';
    const m = openModal({
      title: '📞 Ligar',
      content: h('div', { class: 'dialer' }, h('p', { class: 'muted small' }, where), search, list),
      footer: [h('button', { type: 'button', class: 'btn-secondary', onclick: () => m.close() }, 'Cancelar'), btn],
    });
    paint();
    setTimeout(() => search.focus(), 30);
  }

  placeName(room, from) {
    if (room) return room.name;
    if (from === 'mesa') return 'mesa';
    const z = this.app.world.zoneAt(this.app.me.x, this.app.me.y);
    return z && z.name ? z.name : '';
  }

  // ------------------------------------------------------------------ fazer a chamada
  async start(ids, { place = '', room = null } = {}) {
    if (!ids.length) return;
    const app = this.app;
    if (!app.room.connected) {
      toast('A conexão com o escritório está instável. Aguarde a reconexão para ligar.', 'warn', 5000);
      return;
    }
    const hadMedia = app.media.on;
    if (!app.media.on) {
      const ok = await app.media.enable();
      if (!ok) return;
    }
    if (!app.room.connected) {
      if (!hadMedia) app.media.disable();
      toast('A conexão caiu antes de iniciar a chamada. Aguarde a reconexão e tente novamente.', 'error', 5000);
      return;
    }
    if (!this.call) this.call = { id: cid(), members: new Set(), room, place, host: app.me.id };
    const c = this.call;
    if (room && !c.room) c.room = room;
    for (const to of ids) {
      if (to === app.me.id || this.outgoing.has(to) || c.members.has(to)) continue;
      if (!app.room.send('call', { type: 'ring', id: c.id, to, from: app.me.id, name: app.me.name, place: place || c.place, room: c.room })) {
        this.finishUnanswered();
        if (!hadMedia && !this.call) app.media.disable();
        toast('A chamada não foi enviada porque a conexão está indisponível.', 'error', 5000);
        return;
      }
      const t = setTimeout(() => {
        this.outgoing.delete(to);
        app.room.send('call', { type: 'hangup', id: c.id, to, from: app.me.id });
        const p = app.players.get(to);
        toast(`${p ? p.name : 'A pessoa'} não atendeu.`, 'warn', 3000);
        this.finishUnanswered();
        this.renderBar();
      }, RING_MS);
      this.outgoing.set(to, t);
    }
    this.syncPresence();
    this.renderBar();
    blip(660, 0.12, 0.06);
  }

  onSignal(msg) {
    const app = this.app;
    if (msg.from === app.me.id || (msg.to && msg.to !== app.me.id)) return;
    switch (msg.type) {
      case 'ring':
        if (msg.to !== app.me.id) return;
        if (this.call && this.call.id === msg.id) return;
        if (this.call || this.ringing) { app.room.send('call', { type: 'busy', id: msg.id, to: msg.from, from: app.me.id }); return; }
        this.incoming(msg);
        break;
      case 'accept':
        if (!this.call || this.call.id !== msg.id || !this.outgoing.has(msg.from)) return;
        clearTimeout(this.outgoing.get(msg.from));
        this.outgoing.delete(msg.from);
        this.call.members.add(msg.from);
        this.broadcastMembers();
        toast(`${msg.name} entrou na chamada.`, 'ok', 2200);
        this.renderBar();
        app.media.tick();
        break;
      case 'decline':
      case 'busy':
        if (msg.to !== app.me.id || !this.call || this.call.id !== msg.id || !this.outgoing.has(msg.from)) return;
        clearTimeout(this.outgoing.get(msg.from));
        this.outgoing.delete(msg.from);
        toast(msg.type === 'busy' ? `${msg.name || 'A pessoa'} está em outra chamada.` : `${msg.name} recusou a chamada.`, 'warn', 3000);
        this.finishUnanswered();
        this.renderBar();
        break;
      case 'members':
        if (!this.call || this.call.id !== msg.id) return;
        for (const m of msg.members) if (m !== app.me.id) this.call.members.add(m);
        if (msg.room) this.call.room = msg.room;
        this.renderBar();
        app.media.tick();
        break;
      case 'hangup':
        if (this.ringing && this.ringing.id === msg.id && msg.from === this.ringing.from) { this.stopRing(); toast('A chamada foi encerrada.', 'info', 2000); return; }
        if (!this.call || this.call.id !== msg.id) return;
        this.call.members.delete(msg.from);
        if (!this.call.members.size && !this.outgoing.size && !this.call.room) this.end(false);
        this.renderBar();
        app.media.tick();
        break;
      default:
    }
  }

  finishUnanswered() {
    if (this.call && !this.call.members.size && !this.outgoing.size) this.end(true);
  }

  incoming(msg) {
    const app = this.app;
    this.ringing = msg;
    let n = 0;
    const ring = () => { blip(880, 0.15, 0.08); setTimeout(() => blip(1046, 0.18, 0.08), 180); n += 1; };
    ring();
    this.ringTimer = setInterval(ring, 1600);
    this.ringTimeout = setTimeout(() => this.decline(), RING_MS);
    const caller = app.players.get(msg.from);
    this.ringModal = openModal({
      title: '📞 Chamada recebida',
      dismissible: false,
      content: h('div', { class: 'ringing' },
        caller ? avatarThumb(caller.avatar, 72) : null,
        h('p', {}, h('strong', {}, msg.name), ' está te ligando', msg.place ? ` da ${msg.place}` : '', '.'),
        msg.room ? h('p', { class: 'muted small' }, 'Ao atender você entra na reunião com todos que estão na sala (sem precisar ir até lá).') : null),
      footer: [
        h('button', { type: 'button', class: 'btn-secondary danger', onclick: () => this.decline() }, h('span', { html: ICONS.hangup }), 'Recusar'),
        h('button', { type: 'button', class: 'btn-primary', onclick: () => this.accept() }, h('span', { class: 'phone-ic', html: ICONS.phone }), 'Atender'),
      ],
    });
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(`📞 ${msg.name} está te ligando`);
  }

  stopRing() {
    clearInterval(this.ringTimer);
    clearTimeout(this.ringTimeout);
    if (this.ringModal) this.ringModal.close();
    this.ringModal = null;
    this.ringing = null;
  }

  async accept() {
    const msg = this.ringing;
    if (!msg) return;
    const app = this.app;
    if (!app.room.connected) {
      toast('A conexão caiu. Aguarde a reconexão antes de atender.', 'warn', 5000);
      return;
    }
    const hadMedia = app.media.on;
    this.stopRing();
    if (!app.media.on) {
      const ok = await app.media.enable();
      if (!ok) { this.decline(msg); return; }
    }
    if (!app.room.connected) {
      if (!hadMedia) app.media.disable();
      this.decline(msg);
      toast('A conexão caiu antes de atender. Peça para ligarem novamente após a reconexão.', 'error', 5000);
      return;
    }
    this.call = { id: msg.id, members: new Set([msg.from]), room: msg.room || null, place: msg.place, host: msg.from };
    if (!app.room.send('call', { type: 'accept', id: msg.id, to: msg.from, from: app.me.id, name: app.me.name })) {
      this.call = null;
      if (!hadMedia) app.media.disable();
      toast('Não foi possível enviar a resposta. Aguarde a reconexão.', 'error', 5000);
      return;
    }
    this.syncPresence();
    this.renderBar();
    app.media.tick();
  }

  decline(m = this.ringing) {
    if (!m) return;
    this.app.room.send('call', { type: 'decline', id: m.id, to: m.from, from: this.app.me.id, name: this.app.me.name });
    this.stopRing();
  }

  broadcastMembers() {
    const c = this.call;
    if (!c) return;
    this.app.room.send('call', { type: 'members', id: c.id, from: this.app.me.id, members: [this.app.me.id, ...c.members], room: c.room });
  }

  hangup() {
    if (!this.call) return;
    this.app.room.send('call', { type: 'hangup', id: this.call.id, from: this.app.me.id });
    this.end(true);
  }

  end(mine) {
    for (const t of this.outgoing.values()) clearTimeout(t);
    this.outgoing.clear();
    const was = this.call;
    this.call = null;
    this.syncPresence();
    this.renderBar();
    this.app.media.tick();
    if (was && !mine) toast('Chamada encerrada.', 'info', 2000);
  }

  syncPresence() {
    this.app.me.call = this.presence();
    this.app.trackSoon();
  }

  // ------------------------------------------------------------------ barra da chamada
  renderBar() {
    const c = this.call;
    const app = this.app;
    this.bar.hidden = !c;
    if (!c) return;
    const names = [...c.members].map((id) => (app.players.get(id) || {}).name).filter(Boolean);
    const waiting = [...this.outgoing.keys()].map((id) => (app.players.get(id) || {}).name).filter(Boolean);
    const room = c.room && app.world.zones.find((z) => z.id === c.room);
    fill(this.bar,
      h('span', { class: 'call-dot' }),
      h('div', { class: 'call-info' },
        h('strong', {}, room ? `Reunião: ${room.name}` : !c.members.size ? 'Chamando…' : [...c.members].some(id => app.media.peers.get(id)?.pc.connectionState === 'connected') ? 'Em chamada' : 'Conectando áudio…'),
        h('span', { class: 'muted small' }, [names.length ? names.join(', ') : 'só você', waiting.length ? ` · chamando ${waiting.join(', ')}…` : ''].join(''))),
      h('button', { type: 'button', class: 'bar-btn small', title: 'Adicionar pessoa', html: ICONS.plus, onclick: () => this.openDialer({ place: c.place }) }),
      h('button', { type: 'button', class: 'bar-btn small', title: 'Anexos, planilhas e gráficos da reunião', html: ICONS.clip, onclick: () => app.meetings.open(c.room || c.id, room ? room.name : 'Chamada') }),
      h('button', { type: 'button', class: 'bar-btn small danger', title: 'Desligar', html: ICONS.hangup, onclick: () => this.hangup() }));
  }
}
