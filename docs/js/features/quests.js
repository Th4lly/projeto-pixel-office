// Sistema de quests: as tarefas/trabalhos do time viram missões com dificuldade e recompensa em XP.
import { h, toast, fill } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { avatarThumb, normalizeAvatar } from '../art/avatar.js';
import { levelFromXp } from '../backend/index.js';
import { blip } from '../audio.js';

export const STATUS = [
  ['aberta', 'Disponível', '📜'],
  ['andamento', 'Em andamento', '⚔️'],
  ['revisao', 'Em revisão', '🔍'],
  ['concluida', 'Concluída', '🏆'],
];
const STATUS_NAME = Object.fromEntries(STATUS.map(([k, n]) => [k, n]));
const CATEGORIES = ['geral', 'tráfego pago', 'conteúdo', 'design', 'dev', 'comercial', 'atendimento', 'relatórios', 'admin'];
const RANKS = ['Novato', 'Aprendiz', 'Aventureiro', 'Veterano', 'Elite', 'Herói', 'Lenda'];

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '');
const overdue = (q) => q.due_date && q.status !== 'concluida' && new Date(`${q.due_date}T23:59:59`) < new Date();

export class Quests {
  constructor(app) {
    this.app = app;
    this.list = [];
    this.filter = 'todas';
    this.search = '';
    this.modal = null;
    this.reloadTimer = 0;
  }

  get guest() { return this.app.user.guest; }

  async load() {
    try {
      this.list = await this.app.backend.listQuests();
      this.app.emitUi('quests');
      if (this.modal && !this.modal.closed && !this.editing) {
        if (this.detailId) this.renderDetail(this.detailId);
        else this.renderBoard();
      }
    } catch (e) {
      console.warn(e);
    }
  }

  onDbChange() {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => this.load(), 250);
  }

  onCommentChange(p) {
    const qid = p && p.new && p.new.quest_id;
    if (qid && qid === this.detailId) this.renderDetail(qid);
  }

  onAnnounce(q) {
    const msg = q.type === 'done'
      ? `🏆 ${q.by} concluiu a quest “${q.title}” (+${q.xp} XP)`
      : q.type === 'new' ? `📜 Nova quest: “${q.title}” (por ${q.by})`
        : q.type === 'accept' ? `⚔️ ${q.by} aceitou a quest “${q.title}”` : `${q.by}: ${q.title}`;
    this.app.chat.system(msg);
    if (q.type === 'done' || q.type === 'new') toast(msg, 'info', 4500);
  }

  announce(type, q, xp) {
    const payload = { type, title: q.title, by: this.app.me.name, xp };
    this.app.room.send('quest', payload);
    this.onAnnounce(payload);
  }

  profile(id) {
    return this.app.profiles.find((p) => p.id === id) || { id, name: '?', avatar: null, xp: 0 };
  }

  // ------------------------------------------------------------------ quadro
  open(questId) {
    if (this.modal && !this.modal.closed) this.modal.close();
    this.body = h('div', { class: 'quests' });
    this.modal = openModal({ title: '📜 Quadro de Quests', className: 'modal-xl', content: this.body, onClose: () => { this.detailId = null; } });
    this.load();
    if (questId) this.renderDetail(questId);
    else this.renderBoard();
  }

  filtered() {
    const uid = this.app.user.id;
    const s = this.search.toLowerCase();
    return this.list.filter((q) => {
      if (s && !`${q.title} ${q.description} ${q.category}`.toLowerCase().includes(s)) return false;
      if (this.filter === 'minhas') return (q.assignees || []).includes(uid) || q.created_by === uid;
      if (this.filter === 'livres') return q.status === 'aberta' && !(q.assignees || []).length;
      if (this.filter === 'atrasadas') return overdue(q);
      return true;
    });
  }

  renderBoard() {
    this.detailId = null;
    this.editing = false;
    if (!this.body) return;
    const list = this.filtered();
    const me = this.app.me;
    const lv = levelFromXp(me.xp || 0);
    const filters = [['todas', 'Todas'], ['livres', 'Livres'], ['minhas', 'Minhas'], ['atrasadas', 'Atrasadas']];
    const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar quest…', value: this.search, oninput: (e) => { this.search = e.target.value; clearTimeout(this.st); this.st = setTimeout(() => { this.renderBoard(); const el = this.body.querySelector('.search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); } });
    fill(this.body, 
      h('div', { class: 'q-top' },
        h('div', { class: 'q-hero' },
          h('div', { class: 'q-level' }, h('span', { class: 'lv big' }, `Lv${lv.level}`), h('div', {}, h('strong', {}, `${me.name} · ${RANKS[Math.min(RANKS.length - 1, Math.floor((lv.level - 1) / 2))]}`), h('div', { class: 'xpbar' }, h('span', { style: `width:${Math.round((lv.into / lv.need) * 100)}%` })), h('span', { class: 'muted small' }, `${lv.into}/${lv.need} XP até o próximo nível`)))),
        h('div', { class: 'q-actions' },
          h('button', { type: 'button', class: 'btn-secondary', onclick: () => this.openRanking() }, '🏅 Ranking'),
          this.guest ? null : h('button', { type: 'button', class: 'btn-primary', onclick: () => this.renderForm() }, h('span', { html: ICONS.plus }), 'Nova quest'))),
      h('div', { class: 'q-filters' },
        h('div', { class: 'seg' }, filters.map(([k, n]) => h('button', { type: 'button', class: this.filter === k ? 'on' : '', onclick: () => { this.filter = k; this.renderBoard(); } }, n))),
        search),
      this.guest ? h('p', { class: 'muted small' }, 'Convidados podem ver as quests. Crie uma conta para aceitar e concluir.') : null,
      h('div', { class: 'kanban' }, STATUS.map(([k, name, icon]) => {
        const col = list.filter((q) => q.status === k);
        const shown = k === 'concluida' ? col.slice(0, 15) : col;
        return h('section', { class: `kcol k-${k}` },
          h('header', {}, h('span', {}, `${icon} ${name}`), h('span', { class: 'pill' }, col.length)),
          h('div', { class: 'kcards' }, shown.length ? shown.map((q) => this.card(q)) : h('p', { class: 'muted small center' }, k === 'aberta' ? 'Nenhuma quest disponível.' : '—')));
      })));
  }

  card(q) {
    const avatars = (q.assignees || []).slice(0, 4).map((id) => {
      const p = this.profile(id);
      const c = avatarThumb(normalizeAvatar(p.avatar), 22);
      c.title = p.name;
      return c;
    });
    return h('button', { type: 'button', class: `qcard ${overdue(q) ? 'late' : ''}`, onclick: () => this.renderDetail(q.id) },
      h('div', { class: 'qcard-top' }, h('span', { class: 'qcat' }, q.category), h('span', { class: 'qstars', title: `Dificuldade ${q.difficulty}/5` }, stars(q.difficulty))),
      h('strong', { class: 'qtitle' }, q.title),
      h('div', { class: 'qcard-foot' },
        h('span', { class: 'qxp' }, `+${q.reward_xp} XP`),
        q.due_date ? h('span', { class: `qdue ${overdue(q) ? 'late' : ''}` }, `📅 ${fmtDate(q.due_date)}`) : null,
        h('span', { class: 'qavatars' }, avatars)));
  }

  // ------------------------------------------------------------------ detalhe
  async renderDetail(id) {
    const q = this.list.find((x) => x.id === id);
    if (!q || !this.body) return this.renderBoard();
    this.detailId = id;
    this.editing = false;
    const uid = this.app.user.id;
    const mine = (q.assignees || []).includes(uid);
    const canAct = !this.guest;
    const comments = await this.app.backend.questComments(id).catch(() => []);
    if (this.detailId !== id) return;
    const creator = this.profile(q.created_by);
    const act = async (fn, ok) => {
      try { await fn(); if (ok) toast(ok, 'ok', 2000); await this.load(); } catch (e) { toast(e.message, 'error'); }
    };
    const setStatus = (status, msg) => act(() => this.app.backend.updateQuest(id, { status }), msg);
    const commentInput = h('input', { type: 'text', maxlength: 1000, placeholder: canAct ? 'Registrar progresso ou comentar…' : 'Convidados não comentam' , disabled: !canAct });
    const sendComment = () => {
      const t = commentInput.value.trim();
      if (!t) return;
      act(() => this.app.backend.addQuestComment(id, this.app.me.name, t));
    };
    commentInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendComment(); });

    fill(this.body, 
      h('button', { type: 'button', class: 'btn-link', onclick: () => this.renderBoard() }, '← Voltar ao quadro'),
      h('div', { class: 'qdetail' },
        h('div', { class: 'qd-main' },
          h('div', { class: 'qcard-top' }, h('span', { class: 'qcat' }, q.category), h('span', { class: `qbadge s-${q.status}` }, STATUS_NAME[q.status])),
          h('h3', { class: 'qd-title' }, q.title),
          h('p', { class: 'qd-desc' }, q.description || h('span', { class: 'muted' }, 'Sem descrição.')),
          q.link ? h('a', { class: 'qd-link', href: q.link, target: '_blank', rel: 'noopener' }, h('span', { html: ICONS.link }), q.link) : null,
          h('div', { class: 'opt-label' }, `Registro de progresso (${comments.length})`),
          h('ul', { class: 'qcomments' }, comments.map((c) => h('li', {}, h('strong', {}, c.name), h('time', {}, new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })), h('p', {}, c.text)))),
          h('div', { class: 'row-input' }, commentInput, h('button', { type: 'button', class: 'btn-secondary small', disabled: !canAct, onclick: sendComment }, 'Enviar'))),
        h('aside', { class: 'qd-side' },
          h('div', { class: 'qreward' }, h('span', {}, 'Recompensa'), h('strong', {}, `+${q.reward_xp} XP`), h('span', { class: 'qstars' }, stars(q.difficulty))),
          h('dl', {},
            h('dt', {}, 'Criada por'), h('dd', {}, creator.name),
            q.due_date ? [h('dt', {}, 'Prazo'), h('dd', { class: overdue(q) ? 'late' : '' }, fmtDate(q.due_date), overdue(q) ? ' (atrasada)' : '')] : null,
            h('dt', {}, 'Responsáveis'),
            h('dd', { class: 'qd-people' }, (q.assignees || []).length ? q.assignees.map((a) => {
              const p = this.profile(a);
              const c = avatarThumb(normalizeAvatar(p.avatar), 24);
              return h('span', { class: 'qd-person' }, c, p.name);
            }) : h('span', { class: 'muted' }, 'Ninguém ainda'))),
          canAct ? h('div', { class: 'qd-buttons' },
            q.status !== 'concluida' && !mine ? h('button', { type: 'button', class: 'btn-primary', onclick: () => act(async () => {
              await this.app.backend.updateQuest(id, { assignees: [...new Set([...(q.assignees || []), uid])], status: q.status === 'aberta' ? 'andamento' : q.status });
              this.announce('accept', q);
            }, 'Quest aceita! ⚔️') }, '⚔️ Aceitar quest') : null,
            q.status !== 'concluida' && mine ? h('button', { type: 'button', class: 'btn-secondary', onclick: () => act(() => this.app.backend.updateQuest(id, { assignees: q.assignees.filter((a) => a !== uid), status: q.assignees.length <= 1 ? 'aberta' : q.status }), 'Você saiu da quest.') }, 'Abandonar') : null,
            q.status === 'aberta' ? h('button', { type: 'button', class: 'btn-secondary', onclick: () => setStatus('andamento', 'Quest iniciada.') }, '▶ Iniciar') : null,
            q.status === 'andamento' ? h('button', { type: 'button', class: 'btn-secondary', onclick: () => setStatus('revisao', 'Enviada para revisão.') }, '🔍 Enviar para revisão') : null,
            q.status === 'revisao' ? h('button', { type: 'button', class: 'btn-secondary', onclick: () => setStatus('andamento', 'Voltou para andamento.') }, '↩ Voltar para andamento') : null,
            q.status !== 'concluida' ? h('button', { type: 'button', class: 'btn-gold', onclick: () => this.complete(q) }, '🏆 Concluir quest') : null,
            q.status === 'concluida' && this.app.user.admin ? h('button', { type: 'button', class: 'btn-secondary', onclick: () => act(() => this.app.backend.reopenQuest(id), 'Quest reaberta (XP devolvido).') }, 'Reabrir') : null,
            q.status !== 'concluida' ? h('button', { type: 'button', class: 'btn-secondary', onclick: () => this.renderForm(q) }, '✏️ Editar') : null,
            q.created_by === uid || this.app.user.admin ? h('button', { type: 'button', class: 'btn-link danger', onclick: async () => {
              if (await confirmBox('Excluir quest?', `“${q.title}” será apagada para todos.`, 'Excluir', true)) act(() => this.app.backend.deleteQuest(id), 'Quest excluída.').then(() => this.renderBoard());
            } }, 'Excluir') : null) : null)));
  }

  async complete(q) {
    try {
      const xp = await this.app.backend.completeQuest(q.id);
      const me = this.app.me;
      if (xp) {
        this.app.floatText(me.x, me.y - 1.4, `+${xp} XP`, '#ffd84d', true);
        this.app.emote('🏆');
        blip(784, 0.1); setTimeout(() => blip(988, 0.1), 110); setTimeout(() => blip(1318, 0.25), 220);
        this.announce('done', q, xp);
      }
      await this.load();
      await this.app.refreshProfiles();
      this.renderBoard();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ------------------------------------------------------------------ criar / editar
  renderForm(q = null) {
    this.editing = true;
    const people = this.app.profiles.filter((p) => p.id);
    const f = {
      title: h('input', { type: 'text', maxlength: 120, required: true, value: q ? q.title : '', placeholder: 'Ex.: Relatório semanal do cliente X' }),
      description: h('textarea', { rows: 5, placeholder: 'O que precisa ser feito, critérios de pronto, links úteis…' }),
      category: h('select', {}, CATEGORIES.map((c) => h('option', { value: c, selected: q ? q.category === c : c === 'geral' }, c))),
      difficulty: h('input', { type: 'range', min: 1, max: 5, value: q ? q.difficulty : 2 }),
      reward: h('input', { type: 'number', min: 0, max: 1000, step: 10, value: q ? q.reward_xp : 100 }),
      due: h('input', { type: 'date', value: q && q.due_date ? q.due_date : '' }),
      link: h('input', { type: 'url', placeholder: 'https://… (doc, tarefa no Asana/GitHub, pasta)', value: q && q.link ? q.link : '' }),
    };
    f.description.value = q ? q.description : '';
    const starsLabel = h('span', { class: 'qstars' }, stars(Number(f.difficulty.value)));
    f.difficulty.addEventListener('input', () => {
      starsLabel.textContent = stars(Number(f.difficulty.value));
      if (!q) f.reward.value = Number(f.difficulty.value) * 50;
    });
    const chosen = new Set(q ? q.assignees : []);
    const assign = h('div', { class: 'assign-list' }, people.map((p) => {
      const c = avatarThumb(normalizeAvatar(p.avatar), 22);
      const box = h('input', { type: 'checkbox', checked: chosen.has(p.id), onchange: (e) => { if (e.target.checked) chosen.add(p.id); else chosen.delete(p.id); } });
      return h('label', { class: 'assign' }, box, c, p.name);
    }));
    const save = async () => {
      const title = f.title.value.trim();
      if (title.length < 2) { f.title.focus(); return toast('Dê um título para a quest.', 'warn'); }
      const row = {
        title,
        description: f.description.value.trim(),
        category: f.category.value,
        difficulty: Number(f.difficulty.value),
        reward_xp: Math.max(0, Math.min(1000, Number(f.reward.value) || 0)),
        due_date: f.due.value || null,
        link: f.link.value.trim() || null,
        assignees: [...chosen],
      };
      try {
        if (q) {
          await this.app.backend.updateQuest(q.id, row);
          toast('Quest atualizada.', 'ok');
          await this.load();
          this.renderDetail(q.id);
        } else {
          row.status = row.assignees.length ? 'andamento' : 'aberta';
          const created = await this.app.backend.createQuest(row);
          this.announce('new', created || row);
          toast('Quest publicada no quadro! 📜', 'ok');
          await this.load();
          this.renderBoard();
        }
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    fill(this.body, 
      h('button', { type: 'button', class: 'btn-link', onclick: () => (q ? this.renderDetail(q.id) : this.renderBoard()) }, '← Voltar'),
      h('h3', {}, q ? 'Editar quest' : 'Nova quest'),
      h('div', { class: 'qform form-stack' },
        h('label', {}, 'Título', f.title),
        h('label', {}, 'Descrição', f.description),
        h('div', { class: 'grid3' },
          h('label', {}, 'Categoria', f.category),
          h('label', {}, h('span', {}, 'Dificuldade ', starsLabel), f.difficulty),
          h('label', {}, 'Recompensa (XP)', f.reward)),
        h('div', { class: 'grid2' }, h('label', {}, 'Prazo', f.due), h('label', {}, 'Link', f.link)),
        h('div', {}, h('div', { class: 'opt-label' }, 'Responsáveis (opcional — ou deixe livre para alguém aceitar)'), assign),
        h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn-primary', onclick: save }, q ? 'Salvar alterações' : '📜 Publicar quest'))));
    setTimeout(() => f.title.focus(), 30);
  }

  /** Usado pela integração do GitHub. */
  async createFrom(row) {
    const created = await this.app.backend.createQuest({ status: 'aberta', assignees: [], difficulty: 2, reward_xp: 100, category: 'dev', ...row });
    this.announce('new', created || row);
    await this.load();
    return created;
  }

  // ------------------------------------------------------------------ ranking
  async openRanking() {
    await this.app.refreshProfiles();
    const list = this.app.profiles.slice(0, 20);
    const medal = ['🥇', '🥈', '🥉'];
    const scores = await Promise.all(['snake', 'memory'].map((g) => this.app.backend.topScores(g).catch(() => [])));
    openModal({
      title: '🏅 Heróis da guilda',
      className: 'modal-wide',
      content: h('div', { class: 'ranking' },
        h('ol', { class: 'rank-list' }, list.length ? list.map((p, i) => {
          const lv = levelFromXp(p.xp);
          const c = avatarThumb(normalizeAvatar(p.avatar), 30);
          return h('li', {}, h('span', { class: 'rank-pos' }, medal[i] || `${i + 1}º`), c, h('strong', {}, p.name), h('span', { class: 'lv' }, `Lv${lv.level}`), h('span', { class: 'qxp' }, `${p.xp} XP`));
        }) : h('p', { class: 'muted' }, 'Ninguém concluiu quests ainda.')),
        h('div', { class: 'grid2' }, [['🐍 Cobrinha', scores[0]], ['🃏 Memória', scores[1]]].map(([n, s]) => h('div', {},
          h('div', { class: 'opt-label' }, `Recordes — ${n}`),
          s.length ? h('ol', { class: 'score-list' }, s.slice(0, 5).map((r) => h('li', {}, h('span', {}, r.name), h('strong', {}, r.score)))) : h('p', { class: 'muted small' }, 'Sem recordes ainda.'))))),
    });
  }
}
