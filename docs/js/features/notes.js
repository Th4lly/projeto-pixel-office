// Notas de reunião: transcrição ao vivo (reconhecimento de voz do navegador) + ata por IA.
// Cada pessoa transcreve a PRÓPRIA fala (com consentimento) e envia as linhas para a sala.
import { h, toast, fill } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { isNear } from '../game/world.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export class Notes {
  constructor(app) {
    this.app = app;
    this.session = null; // { room, title, lines: [], startedAt, owner }
    this.rec = null;
    this.speaking = false;
    this.modal = null;
  }

  roomKey() {
    const z = this.app.world.privateZoneAt(this.app.me.x, this.app.me.y);
    return z ? { key: `zone:${z.id}`, name: z.name || 'Sala privada' } : { key: `near:${this.app.me.id}`, name: 'Conversa por perto' };
  }

  sameRoom(room, fromId) {
    if (room.startsWith('zone:')) {
      const z = this.app.world.privateZoneAt(this.app.me.x, this.app.me.y);
      return !!z && `zone:${z.id}` === room;
    }
    const p = this.app.players.get(fromId);
    return !!p && isNear(this.app.world, p, this.app.me, this.app.proximity + 1);
  }

  // ------------------------------------------------------------------ fala local
  startSpeaking(room) {
    if (!Recognition) {
      toast('Seu navegador não tem reconhecimento de voz. Use Chrome ou Edge para transcrever.', 'warn', 6000);
      return false;
    }
    this.stopSpeaking();
    const rec = new Recognition();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const text = e.results[i][0].transcript.trim();
        if (!text) continue;
        const line = { room, from: this.app.me.id, name: this.app.me.name, text, ts: Date.now() };
        this.app.room.send('transcript', line);
        this.addLine(line);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') { toast('Permita o uso do microfone para transcrever.', 'error'); this.stopSpeaking(); }
    };
    rec.onend = () => { if (this.speaking && this.rec === rec) { try { rec.start(); } catch { /* reinicia sozinho */ } } };
    try { rec.start(); } catch (e) { toast(e.message, 'error'); return false; }
    this.rec = rec;
    this.speaking = room;
    this.app.addBuff('📝', 'Transcrevendo', 120);
    this.paint();
    return true;
  }

  stopSpeaking() {
    this.speaking = false;
    if (this.rec) { try { this.rec.stop(); } catch { /* ok */ } }
    this.rec = null;
    this.app.me.buffs = this.app.me.activeBuffs().filter((b) => b.e !== '📝');
    this.app.trackSoon();
    this.paint();
  }

  addLine(line) {
    if (!this.session || this.session.room !== line.room) return;
    this.session.lines.push(line);
    this.session.people.add(line.name);
    this.paint();
  }

  // ------------------------------------------------------------------ eventos dos outros
  onRemoteLine(line) {
    if (this.session && this.session.room === line.room) this.addLine(line);
  }

  onRemoteState(d) {
    if (d.from === this.app.me.id) return;
    if (!this.sameRoom(d.room, d.from)) return;
    if (d.on) {
      if (!this.session) this.session = { room: d.room, title: d.title, lines: [], people: new Set(), startedAt: Date.now(), owner: false };
      if (!this.speaking) {
        toast(h('span', {}, `📝 ${d.by} iniciou a transcrição da reunião. `,
          h('button', { class: 'toast-btn', onclick: () => this.startSpeaking(d.room) }, 'Transcrever minha fala')), 'info', 12000);
      }
    } else if (this.session && this.session.room === d.room && !this.session.owner) {
      this.stopSpeaking();
      toast(`📝 ${d.by} encerrou a transcrição. A ata fica em Notas (N).`, 'info', 5000);
      this.session = null;
      this.paint();
    }
  }

  // ------------------------------------------------------------------ janela
  async open() {
    if (this.modal && !this.modal.closed) return;
    this.body = h('div', { class: 'notes' });
    this.modal = openModal({ title: '📝 Notas de reunião', className: 'modal-xl', content: this.body, onClose: () => { this.modal = null; } });
    this.notes = await this.app.backend.listNotes().catch(() => []);
    this.paint();
  }

  start() {
    const r = this.roomKey();
    const title = `${r.name} — ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    this.session = { room: r.key, title, lines: [], people: new Set([this.app.me.name]), startedAt: Date.now(), owner: true };
    this.app.room.send('notes', { room: r.key, on: true, by: this.app.me.name, from: this.app.me.id, title });
    this.startSpeaking(r.key);
    this.paint();
  }

  async finish() {
    const s = this.session;
    if (!s) return;
    this.stopSpeaking();
    this.app.room.send('notes', { room: s.room, on: false, by: this.app.me.name, from: this.app.me.id });
    const transcript = s.lines.map((l) => `[${new Date(l.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}] ${l.name}: ${l.text}`).join('\n');
    this.session = null;
    if (!transcript.trim()) { toast('Nada foi transcrito.', 'warn'); this.paint(); return; }
    this.busy = true;
    this.paint();
    let summary;
    try {
      summary = await this.app.backend.summarize(transcript);
    } catch (e) {
      toast(`Resumo por IA indisponível: ${e.message} — salvando um resumo automático simples.`, 'warn', 7000);
      summary = basicSummary(s.lines);
    }
    try {
      const note = await this.app.backend.saveNote({ title: s.title, room: s.room, participants: [...s.people], transcript, summary });
      this.notes = [note, ...(this.notes || [])];
      this.viewing = note.id;
      toast('Ata salva! 📝', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    }
    this.busy = false;
    this.paint();
  }

  paint() {
    if (!this.body || !this.modal || this.modal.closed) return;
    const s = this.session;
    const room = this.roomKey();
    const live = s
      ? h('div', { class: 'live' },
        h('div', { class: 'live-head' }, h('span', { class: 'rec-dot' }), h('strong', {}, s.title), h('span', { class: 'muted small' }, ` · ${s.people.size} participante(s)`)),
        h('ul', { class: 'transcript' }, s.lines.length ? s.lines.slice(-80).map((l) => h('li', {}, h('strong', {}, `${l.name}: `), l.text)) : h('li', { class: 'muted' }, 'Ouvindo… fale normalmente.')),
        h('div', { class: 'live-actions' },
          this.speaking ? h('button', { class: 'btn-secondary', onclick: () => this.stopSpeaking() }, '⏸ Parar de transcrever minha fala') : h('button', { class: 'btn-secondary', onclick: () => this.startSpeaking(s.room) }, '🎙️ Transcrever minha fala'),
          s.owner ? h('button', { class: 'btn-primary', onclick: () => this.finish() }, '✅ Encerrar e gerar ata') : null))
      : h('div', { class: 'live idle' },
        h('p', {}, `Comece aqui para transcrever a reunião em “${room.name}”. Cada participante autoriza a transcrição da própria fala.`),
        Recognition ? null : h('p', { class: 'muted small' }, '⚠️ Este navegador não transcreve voz. Use Chrome ou Edge.'),
        h('button', { class: 'btn-primary', disabled: !Recognition || this.busy, onclick: () => this.start() }, this.busy ? 'Gerando ata…' : '🎙️ Iniciar notas da reunião'));

    const list = this.notes || [];
    const view = list.find((n) => n.id === this.viewing);
    fill(this.body, 
      h('div', { class: 'notes-grid' },
        h('div', {}, live,
          h('div', { class: 'opt-label' }, 'Atas anteriores'),
          list.length ? h('ul', { class: 'note-list' }, list.map((n) => h('li', { class: n.id === this.viewing ? 'on' : '', onclick: () => { this.viewing = n.id; this.paint(); } },
            h('strong', {}, n.title), h('span', { class: 'muted small' }, (n.participants || []).join(', '))))) : h('p', { class: 'muted small' }, 'Nenhuma ata salva.')),
        h('div', { class: 'note-view' }, view ? [
          h('h3', {}, view.title),
          h('div', { class: 'md' }, renderMd(view.summary || '')),
          h('details', {}, h('summary', {}, 'Transcrição completa'), h('pre', {}, view.transcript)),
          h('div', { class: 'live-actions' },
            h('button', { class: 'btn-secondary', onclick: () => { navigator.clipboard.writeText(`# ${view.title}\n\n${view.summary}\n\n---\n${view.transcript}`); toast('Copiado!', 'ok', 1500); } }, 'Copiar'),
            h('button', { class: 'btn-secondary', onclick: () => this.toQuests(view) }, '📜 Criar quests dos próximos passos'),
            h('button', { class: 'btn-link danger', onclick: async () => {
              if (!(await confirmBox('Apagar ata?', view.title, 'Apagar', true))) return;
              await this.app.backend.deleteNote(view.id).catch((e) => toast(e.message, 'error'));
              this.notes = this.notes.filter((n) => n.id !== view.id);
              this.viewing = null;
              this.paint();
            } }, 'Apagar')),
        ] : h('p', { class: 'muted center' }, 'Selecione uma ata para ver o resumo.'))));
  }

  /** Transforma os itens de "Próximos passos" em quests. */
  async toQuests(note) {
    const part = (note.summary || '').split(/##\s*Próximos passos/i)[1] || '';
    const items = part.split(/\n##/)[0].split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter((l) => l && !/^nenhum/i.test(l));
    if (!items.length) return toast('Não encontrei "Próximos passos" nesta ata.', 'warn');
    if (!(await confirmBox('Criar quests?', `${items.length} quest(s) serão publicadas no quadro.`, 'Criar'))) return;
    for (const it of items.slice(0, 15)) {
      await this.app.quests.createFrom({ title: it.slice(0, 118), description: `Da reunião: ${note.title}`, category: 'geral' }).catch((e) => toast(e.message, 'error'));
    }
    toast('Quests criadas! 📜', 'ok');
  }
}

function basicSummary(lines) {
  const key = /(decid|vamos|fica(mos)? combinado|prazo|até (segunda|terça|quarta|quinta|sexta|amanhã|o dia)|responsável|preciso que|tarefa|entregar)/i;
  const important = lines.filter((l) => key.test(l.text)).slice(0, 10);
  const people = [...new Set(lines.map((l) => l.name))];
  return [
    '## Resumo',
    `Reunião com ${people.join(', ')} (${lines.length} falas transcritas). Resumo gerado automaticamente, sem IA.`,
    '## Decisões',
    important.length ? important.map((l) => `- ${l.name}: ${l.text}`).join('\n') : 'Nenhuma registrada',
    '## Próximos passos',
    'Revise a transcrição completa abaixo.',
  ].join('\n');
}

/** Markdown simples (títulos, listas, negrito) → elementos. */
function renderMd(md) {
  const out = [];
  let list = null;
  for (const raw of String(md).split('\n')) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) { list = null; out.push(h('h4', {}, line.replace(/^#+\s*/, ''))); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!list) { list = h('ul', {}); out.push(list); }
      list.append(h('li', {}, ...inline(line.replace(/^\s*[-*]\s+/, ''))));
      continue;
    }
    list = null;
    if (line.trim()) out.push(h('p', {}, ...inline(line)));
  }
  return out;
}

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part) => (part.startsWith('**') ? h('strong', {}, part.slice(2, -2)) : part));
}
