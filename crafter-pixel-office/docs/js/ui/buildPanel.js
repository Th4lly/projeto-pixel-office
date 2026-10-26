// Modo construção: pisos, paredes, objetos (com cor), textos/links dos objetos, áreas e permissões.
import { $, h, uid, toast, fill } from './dom.js';
import { ICONS } from './icons.js';
import { openModal, confirmBox, promptBox } from './modal.js';
import { FLOORS, FLOOR_TYPES, WALL_TYPES, paintFloor, paintWall } from '../art/tiles.js';
import { OBJECTS, OBJECT_CATEGORIES, objectThumb } from '../art/objects.js';
import { onAssetLoad, TILE } from '../art/assets.js';
import { normRect } from '../game/renderer.js';

const TABS = [['floors', 'Pisos'], ['walls', 'Paredes'], ['objects', 'Objetos'], ['zones', 'Áreas']];
const KIND_LABEL = { area: 'Área comum', private: '🔒 Privada (reunião)', spotlight: '📢 Destaque (palco)', desk: '🪑 Área de mesa', arena: '🐉 Arena de monstros', pvp: '⚔️ Arena PvP' };
const ROTS = [['s', '↓'], ['w', '←'], ['n', '↑'], ['e', '→']];
const PAGE = 90;

function tileThumb(type, size = 46) {
  const c = h('canvas', { width: size, height: size });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const paint = () => {
    ctx.setTransform(size / TILE, 0, 0, size / TILE, 0, 0);
    return FLOORS[type].wall ? paintWall(ctx, type, 0, 0, true) : paintFloor(ctx, type, 0, 0);
  };
  if (!paint()) { const off = onAssetLoad(() => { if (paint()) off(); }); }
  return c;
}

export class BuildPanel {
  constructor(app) {
    this.app = app;
    this.el = $('#build-panel');
    this.state = app.build;
    Object.assign(this.state, { on: false, tab: 'objects', item: 'plant', tool: 'place', color: null, hover: null, drag: null, filter: '' });
    this.painted = null;
  }

  toggle(force) {
    const on = force === undefined ? !this.state.on : force;
    if (on && !this.app.canEdit) return;
    this.state.on = on;
    this.el.hidden = !on;
    document.body.classList.toggle('building', on);
    if (on) this.render();
    this.app.emitUi('build');
  }

  setTab(tab) {
    const s = this.state;
    s.tab = tab;
    if (tab === 'floors') { s.item = FLOOR_TYPES.includes(s.item) ? s.item : FLOOR_TYPES[0]; s.tool = s.tool === 'rect' ? 'rect' : 'brush'; }
    if (tab === 'walls') { s.item = WALL_TYPES.includes(s.item) ? s.item : WALL_TYPES[0]; s.tool = s.tool === 'rect' ? 'rect' : 'brush'; }
    if (tab === 'objects') { s.item = OBJECTS[s.item] ? s.item : 'plant'; s.tool = 'place'; s.color = null; s.rot = null; }
    if (tab === 'zones') s.tool = 'zone';
    this.render();
  }

  render() {
    const s = this.state;
    const tool = (id, icon, label) => h('button', { type: 'button', class: `tool ${s.tool === id ? 'on' : ''}`, title: label, onclick: () => { s.tool = id; this.render(); } }, h('span', { html: ICONS[icon] }), label);
    let body;
    if (s.tab === 'floors' || s.tab === 'walls') {
      const types = s.tab === 'floors' ? FLOOR_TYPES : WALL_TYPES;
      body = [
        h('div', { class: 'tools' }, tool('brush', 'brush', 'Pincel'), tool('rect', 'rect', 'Retângulo')),
        h('div', { class: 'palette' }, types.map((t) => h('button', { type: 'button', class: `pal-item ${s.item === t ? 'on' : ''}`, title: `${FLOORS[t].name}${FLOORS[t].pack ? ` — ${FLOORS[t].pack}` : ''}`, onclick: () => { s.item = t; this.render(); } },
          tileThumb(t), h('span', {}, FLOORS[t].name)))),
        h('p', { class: 'muted small' }, s.tab === 'walls' ? 'Paredes bloqueiam a passagem. Abra um vão e coloque uma Porta (aba Objetos → Mágico).' : 'Clique e arraste no mapa para pintar.'),
      ];
    } else if (s.tab === 'objects') {
      const def = OBJECTS[s.item];
      const q = s.filter.toLowerCase();
      const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar objeto…', value: s.filter, oninput: (e) => { s.filter = e.target.value; this.renderList(listBox); } });
      const listBox = h('div', {});
      body = [
        h('div', { class: 'tools' }, tool('place', 'cursor', 'Colocar'), tool('edit', 'brush', 'Editar texto'), tool('erase', 'eraser', 'Remover')),
        def && def.variants && s.tool === 'place'
          ? h('label', { class: 'color-row' }, 'Cor', h('select', { onchange: (e) => { s.color = e.target.value; } }, Object.keys(def.variants).map((c) => h('option', { value: c, selected: s.color === c }, c))))
          : null,
        def && def.rot && s.tool === 'place'
          ? h('div', { class: 'color-row' }, 'Direção', ...ROTS.filter(([r]) => def.rot[r]).map(([r, l]) => h('button', { type: 'button', class: `chip ${s.rot === r ? 'on' : ''}`, onclick: () => { s.rot = r; this.render(); } }, l)))
          : null,
        s.tool === 'edit' ? h('p', { class: 'muted small' }, 'Clique numa placa, estandarte, quadro, TV ou portal para editar o texto ou link.') : null,
        search,
        listBox,
      ];
      this.renderList(listBox, q);
    } else {
      body = [
        h('div', { class: 'tools' }, tool('zone', 'rect', 'Nova área'), tool('spawn', 'pin', 'Entrada')),
        h('p', { class: 'muted small' }, s.tool === 'spawn'
          ? 'Clique no mapa para definir onde as pessoas aparecem ao entrar.'
          : 'Arraste no mapa para criar uma área. Privada: conversa e vídeo só entre quem está dentro. Destaque: quem está nela é ouvido pelo escritório inteiro.'),
        h('ul', { class: 'zone-list' }, this.app.world.zones.map((z) => h('li', {},
          h('span', {}, KIND_LABEL[z.kind] ? `${KIND_LABEL[z.kind].split(' ')[0]} ` : '', z.name || '(sem nome)'),
          h('button', { type: 'button', class: 'icon-btn', title: 'Editar', html: ICONS.brush, onclick: () => this.editZone(z) }),
          h('button', { type: 'button', class: 'icon-btn danger', title: 'Remover área', html: ICONS.trash, onclick: () => { this.app.edit([{ t: 'zdel', id: z.id }]); this.render(); } })))),
      ];
    }

    const admin = this.app.user.admin;
    fill(this.el, 
      h('header', { class: 'win-title' }, h('h3', {}, 'Construir'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', html: ICONS.close, onclick: () => this.toggle(false) })),
      h('div', { class: 'seg' }, TABS.map(([id, label]) => h('button', { type: 'button', class: s.tab === id ? 'on' : '', onclick: () => this.setTab(id) }, label))),
      h('div', { class: 'panel-scroll' }, body),
      h('footer', { class: 'panel-foot' },
        admin ? h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!this.app.world.map.openEdit, onchange: (e) => this.app.edit([{ t: 'settings', openEdit: e.target.checked }]) }), 'Todos os membros podem editar') : null,
        h('button', { type: 'button', class: 'btn-link danger', onclick: () => this.confirmReset() }, h('span', { html: ICONS.refresh }), 'Restaurar escritório padrão')),
    );
  }

  renderList(box, q = this.state.filter.toLowerCase()) {
    const s = this.state;
    s.cat = s.cat || 'Interativos';
    const catSel = h('select', { class: 'search', onchange: (e) => { s.cat = e.target.value; s.page = 0; this.renderList(box); } },
      h('option', { value: '*' }, `Todas as categorias (${Object.keys(OBJECTS).length})`),
      OBJECT_CATEGORIES.map((c) => h('option', { value: c, selected: s.cat === c }, `${c} (${Object.values(OBJECTS).filter((d) => d.cat === c).length})`)));
    const items = Object.entries(OBJECTS).filter(([, d]) => (s.cat === '*' || q || d.cat === s.cat) && (!q || d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q)));
    const page = s.page || 0;
    const slice = items.slice(page * PAGE, page * PAGE + PAGE);
    const pages = Math.ceil(items.length / PAGE);
    fill(box,
      catSel,
      h('div', { class: 'palette' }, slice.map(([type, d]) => h('button', {
        type: 'button', class: `pal-item ${s.item === type && s.tool === 'place' ? 'on' : ''}`, title: `${d.name} — ${d.cat}${d.desc ? ` — ${d.desc}` : ''}`,
        onclick: () => { s.item = type; s.tool = 'place'; s.color = d.variants ? Object.keys(d.variants)[0] : null; s.rot = d.rot ? 's' : null; this.render(); },
      }, objectThumb(type, 46), h('span', {}, d.name)))),
      pages > 1 ? h('div', { class: 'pager' },
        h('button', { type: 'button', class: 'chip', disabled: page === 0, onclick: () => { s.page = page - 1; this.renderList(box); } }, '‹'),
        h('span', { class: 'muted small' }, `${page + 1} / ${pages}`),
        h('button', { type: 'button', class: 'chip', disabled: page >= pages - 1, onclick: () => { s.page = page + 1; this.renderList(box); } }, '›')) : null);
  }

  objectAt(x, y) {
    const list = this.app.world.objectsAt(x, y);
    return [...list].reverse().find((o) => !OBJECTS[o.type].flat) || list.find((o) => OBJECTS[o.type].flat) || null;
  }

  canPlace(type, x, y) {
    const def = OBJECTS[type];
    const w = this.app.world;
    for (let yy = y; yy < y + def.h; yy++) {
      for (let xx = x; xx < x + def.w; xx++) {
        if (!w.inBounds(xx, yy) || w.floorAt(xx, yy) === 'void') return false;
        if (w.isWall(xx, yy) && !def.door && !def.wall) return false;
        if (def.wall) continue;
        if (!def.flat && !def.small && w.objectsAt(xx, yy).some((o) => !OBJECTS[o.type].flat && !OBJECTS[o.type].small && !OBJECTS[o.type].wall)) return false;
      }
    }
    return true;
  }

  pointerDown(t, e) {
    const s = this.state;
    s.hover = t;
    if (e.button === 2 && s.tab === 'objects') {
      const o = this.objectAt(t.x, t.y);
      if (o) this.app.edit([{ t: 'del', id: o.id }]);
      return;
    }
    if (s.tab === 'floors' || s.tab === 'walls') {
      if (s.tool === 'brush') { this.painted = new Set(); this.paint(t); } else s.drag = { start: t, end: t };
    } else if (s.tab === 'objects') {
      if (s.tool === 'place') {
        if (!this.canPlace(s.item, t.x, t.y)) { toast('Não cabe aí — escolha um espaço livre.', 'warn', 1600); return; }
        const def = OBJECTS[s.item];
        const obj = { id: uid('o'), type: s.item, x: t.x, y: t.y, state: def.light && !def.light.always ? { on: true } : {}, data: {} };
        if (def.door) obj.state = { open: true };
        if (def.variants && s.color) obj.color = s.color;
        if (def.rot && s.rot) obj.rot = s.rot;
        this.app.edit([{ t: 'add', obj }]);
      } else if (s.tool === 'edit') {
        const o = this.objectAt(t.x, t.y);
        if (o) this.editObject(o);
      } else {
        const o = this.objectAt(t.x, t.y);
        if (o) this.app.edit([{ t: 'del', id: o.id }]);
      }
    } else if (s.tab === 'zones') {
      if (s.tool === 'spawn') {
        if (this.app.world.walkable(t.x, t.y)) { this.app.edit([{ t: 'spawn', x: t.x, y: t.y }]); toast('Ponto de entrada definido.', 'ok', 1500); }
      } else s.drag = { start: t, end: t };
    }
  }

  pointerMove(t, e) {
    const s = this.state;
    s.hover = t;
    if (s.drag) s.drag.end = t;
    else if (this.painted && e.buttons & 1) this.paint(t);
  }

  pointerUp() {
    const s = this.state;
    if (this.painted) this.painted = null;
    if (!s.drag) return;
    const r = normRect(s.drag.start, s.drag.end);
    s.drag = null;
    const w = this.app.world;
    r.x = Math.max(0, r.x); r.y = Math.max(0, r.y);
    r.w = Math.min(w.width - r.x, r.w); r.h = Math.min(w.height - r.y, r.h);
    if (r.w < 1 || r.h < 1) return;
    if (s.tab === 'zones') return this.editZone({ id: uid('z'), name: '', kind: 'area', ...r }, true);
    const cells = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.push([x, y, s.item]);
    this.app.edit([{ t: 'floor', cells }]);
  }

  paint(t) {
    const w = this.app.world;
    const key = `${t.x},${t.y}`;
    if (!w.inBounds(t.x, t.y) || this.painted.has(key) || w.floorAt(t.x, t.y) === this.state.item) return;
    this.painted.add(key);
    this.app.edit([{ t: 'floor', cells: [[t.x, t.y, this.state.item]] }]);
  }

  async editObject(o) {
    const def = OBJECTS[o.type];
    const field = ['tv', 'jukebox'].includes(def.interact) ? 'url' : 'text';
    const label = field === 'url' ? 'Link padrão (YouTube, Spotify, Miro…)' : `Texto exibido ao interagir com "${def.name}"`;
    const v = await promptBox(`Editar: ${def.name}`, label, (o.data && o.data[field]) || '', { multiline: field === 'text' });
    if (v === null) return;
    this.app.edit([{ t: 'data', id: o.id, data: { ...(o.data || {}), [field]: v.trim() } }]);
    toast('Objeto atualizado.', 'ok', 1500);
  }

  editZone(zone, isNew = false) {
    const name = h('input', { type: 'text', maxlength: 40, value: zone.name || '', placeholder: 'Ex.: Sala de reunião, Time de vendas…' });
    const kind = h('select', {}, Object.entries(KIND_LABEL).map(([k, l]) => h('option', { value: k, selected: zone.kind === k }, l)));
    const save = () => {
      this.app.edit([{ t: 'zone', zone: { ...zone, name: name.value.trim(), kind: kind.value } }]);
      modal.close();
      this.render();
    };
    const modal = openModal({
      title: isNew ? 'Nova área' : 'Editar área',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Nome da área', name), h('label', {}, 'Tipo', kind),
        h('p', { class: 'muted small' }, 'Privada: chat "perto" e vídeo só entre quem está dentro (salas de reunião). Destaque: microfone chega a todo o escritório. Área de mesa: espaço que o dono da mesa decora. Arena: monstros. Arena PvP: único lugar onde jogadores podem lutar entre si.')),
      footer: [h('button', { type: 'button', class: 'btn-secondary', onclick: () => modal.close() }, 'Cancelar'), h('button', { type: 'button', class: 'btn-primary', onclick: save }, 'Salvar')],
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => name.focus(), 30);
  }

  async confirmReset() {
    if (await confirmBox('Restaurar escritório?', 'Apaga todas as alterações do mapa (pisos, objetos e áreas) para todo mundo. Não dá para desfazer.', 'Restaurar', true)) this.app.resetWorld();
  }
}
