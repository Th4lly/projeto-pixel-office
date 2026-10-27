// Notion: mostra o board (kanban) da empresa ou o individual dentro do escritório.
// A leitura/escrita passa pela função "notion" do Supabase (supabase/functions/notion).
import { h, fill, toast } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { iconUrl } from '../art/assets.js';

const COLORS = { default: '#8a8f9c', gray: '#9b9a97', brown: '#a07a5a', orange: '#d9783a', yellow: '#d9b23a', green: '#3f8a5c', blue: '#3f6fd6', purple: '#7a4ab0', pink: '#c45aa8', red: '#c4434a' };

/** Aceita o link da base do Notion ou o id. */
export function notionId(v) {
  const s = String(v || '').trim();
  const m = /([0-9a-f]{32})/i.exec(s.replace(/-/g, ''));
  return m ? m[1] : '';
}

export class NotionBoards {
  constructor(app) {
    this.app = app;
  }

  async open() {
    const app = this.app;
    const body = h('div', { class: 'notion' });
    const m = openModal({ title: 'Notion — boards', className: 'modal-xl', content: body });
    const header = h('div', { class: 'notion-head' }, h('img', { src: iconUrl('Notion', true), alt: '', class: 'notion-logo' }));
    let boards = [];
    try { boards = await app.backend.notionBoards(); } catch (e) { fill(body, h('p', { class: 'form-error' }, e.message)); return; }
    const company = boards.filter((b) => b.scope === 'company');
    const mine = boards.filter((b) => b.scope === 'user');
    const tile = (b) => h('div', { class: 'notion-tile' },
      h('button', { class: 'notion-open', onclick: () => { m.close(); this.board(b); } }, h('strong', {}, b.title), h('span', { class: 'muted small' }, b.scope === 'company' ? 'Empresa' : 'Individual')),
      (b.scope === 'company' && app.user.admin) || b.owner === app.user.id ? h('button', { class: 'icon-btn danger', title: 'Remover', html: ICONS.trash, onclick: async () => {
        if (await confirmBox('Remover board?', `"${b.title}" sai da lista (nada muda no Notion).`, 'Remover', true)) { await app.backend.removeNotionBoard(b.id); m.close(); this.open(); }
      } }) : null);
    fill(body, header,
      h('div', { class: 'opt-label' }, 'Board da empresa'),
      company.length ? h('div', { class: 'notion-tiles' }, company.map(tile)) : h('p', { class: 'muted small' }, app.user.admin ? 'Conecte a base de tarefas da empresa abaixo.' : 'O administrador ainda não conectou o board da empresa.'),
      h('div', { class: 'opt-label' }, 'Meus boards'),
      mine.length ? h('div', { class: 'notion-tiles' }, mine.map(tile)) : h('p', { class: 'muted small' }, 'Conecte uma base pessoal ou veja só os seus cards no board da empresa.'),
      app.user.guest ? null : this.addForm(() => { m.close(); this.open(); }),
      app.user.guest ? null : this.tokenForm());
  }

  addForm(done) {
    const app = this.app;
    const title = h('input', { type: 'text', placeholder: 'Ex.: Sprint do time', maxlength: 60 });
    const link = h('input', { type: 'url', placeholder: 'Link da base no Notion (Copiar link)' });
    const scope = h('select', {}, h('option', { value: 'user' }, 'Individual (só eu vejo)'), app.user.admin ? h('option', { value: 'company' }, 'Empresa (todos veem)') : null);
    return h('details', { class: 'notion-add' }, h('summary', {}, '+ Conectar uma base do Notion'),
      h('div', { class: 'form-stack' }, h('label', {}, 'Nome', title), h('label', {}, 'Base de dados', link), h('label', {}, 'Para quem', scope),
        h('p', { class: 'muted small' }, 'No Notion, abra a base → ••• → Conexões → adicione a integração da empresa. Depois copie o link da base e cole aqui.'),
        h('button', { class: 'btn-primary small', onclick: async () => {
          const id = notionId(link.value);
          if (!id) return toast('Não reconheci o link da base do Notion.', 'warn');
          try { await app.backend.addNotionBoard({ title: title.value.trim() || 'Board', database_id: id, scope: scope.value }); done(); } catch (e) { toast(e.message, 'error'); }
        } }, 'Conectar')));
  }

  tokenForm() {
    const app = this.app;
    const tok = h('input', { type: 'password', placeholder: 'secret_… / ntn_… (opcional)', autocomplete: 'off' });
    return h('details', { class: 'notion-add' }, h('summary', {}, 'Usar meu próprio token do Notion (boards individuais)'),
      h('div', { class: 'form-stack' }, tok,
        h('p', { class: 'muted small' }, 'Crie uma integração interna em notion.so/my-integrations. O token fica no banco e só você consegue lê-lo; ele não é usado nos boards da empresa.'),
        h('div', { class: 'row-input' },
          h('button', { class: 'btn-primary small', onclick: async () => { try { await app.backend.saveNotionToken(tok.value.trim()); tok.value = ''; toast('Token salvo.', 'ok'); } catch (e) { toast(e.message, 'error'); } } }, 'Salvar'),
          h('button', { class: 'btn-link danger', onclick: async () => { try { await app.backend.saveNotionToken(''); toast('Token removido.', 'ok'); } catch (e) { toast(e.message, 'error'); } } }, 'Remover meu token'))));
  }

  async board(b, { mine = b.scope === 'user' } = {}) {
    const app = this.app;
    const body = h('div', { class: 'kanban-wrap' }, h('div', { class: 'spinner' }));
    const m = openModal({ title: `📋 ${b.title}`, className: 'modal-xl', content: body,
      footer: [
        h('button', { class: 'btn-secondary', onclick: () => { m.close(); this.open(); } }, '‹ Boards'),
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: mine, onchange: (e) => { m.close(); this.board(b, { mine: e.target.checked }); } }), 'Só os meus cards'),
        h('button', { class: 'btn-secondary', onclick: () => { m.close(); this.board(b, { mine }); } }, h('span', { html: ICONS.refresh }), 'Atualizar'),
      ] });
    let data;
    try { data = await app.backend.notion({ action: 'query', board: b.id, mine }); } catch (e) { fill(body, h('p', { class: 'form-error' }, e.message)); return; }
    const cols = data.columns.length ? data.columns : [{ name: '', color: 'default' }];
    const byCol = new Map(cols.map((c) => [c.name, []]));
    for (const c of data.cards) (byCol.get(c.status) || byCol.get(cols[0].name)).push(c);
    const move = async (card, to) => {
      try {
        await app.backend.notion({ action: 'move', board: b.id, page: card.id, to, statusProp: data.statusProp, statusType: data.statusType });
        toast(`"${card.title}" → ${to}`, 'ok', 1500);
        app.room.send('quest', { type: 'other', title: `moveu “${card.title.slice(0, 50)}” para ${to} no Notion`, by: app.me.name });
      } catch (e) { toast(e.message, 'error'); m.close(); this.board(b, { mine }); }
    };
    fill(body,
      h('div', { class: 'kanban' }, cols.map((col) => {
        const list = h('div', { class: 'kanban-list' }, byCol.get(col.name).map((card) => {
          const el = h('div', { class: 'kanban-card', draggable: true },
            h('a', { href: card.url, target: '_blank', rel: 'noopener' }, card.title || '(sem título)'),
            card.people ? h('span', { class: 'muted small' }, `👤 ${card.people}`) : null,
            card.extra.map(([k, v]) => h('span', { class: 'muted small' }, `${k}: ${v}`)));
          el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.id); el.classList.add('drag'); });
          el.addEventListener('dragend', () => el.classList.remove('drag'));
          el._card = card;
          return el;
        }));
        const colEl = h('div', { class: 'kanban-col' },
          h('header', {}, h('span', { class: 'dot', style: `background:${COLORS[col.color] || COLORS.default}` }), col.name || 'Sem status', h('span', { class: 'pill' }, String(byCol.get(col.name).length))),
          list,
          data.statusProp && !app.user.guest ? h('button', { class: 'btn-link small', onclick: async () => {
            const t = prompt(`Novo card em "${col.name}":`);
            if (!t) return;
            try { await app.backend.notion({ action: 'create', board: b.id, title: t, status: col.name, statusProp: data.statusProp, statusType: data.statusType }); m.close(); this.board(b, { mine }); } catch (e) { toast(e.message, 'error'); }
          } }, '+ Novo card') : null);
        colEl.addEventListener('dragover', (e) => { e.preventDefault(); colEl.classList.add('over'); });
        colEl.addEventListener('dragleave', () => colEl.classList.remove('over'));
        colEl.addEventListener('drop', (e) => {
          e.preventDefault();
          colEl.classList.remove('over');
          const id = e.dataTransfer.getData('text/plain');
          const el = [...body.querySelectorAll('.kanban-card')].find((x) => x._card.id === id);
          if (!el || el._card.status === col.name || !data.statusProp) return;
          list.append(el);
          el._card.status = col.name;
          move(el._card, col.name);
        });
        return colEl;
      })),
      data.cards.length ? null : h('p', { class: 'muted' }, mine ? 'Nenhum card com você como responsável.' : 'A base está vazia.'));
  }
}
