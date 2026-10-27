// Modo Construir, organizado nas camadas do mapa (grade de 32×32 px):
//   Pisos / Paredes (fundo) · Frente (por cima do avatar) · Objetos (giráveis, com inventário)
//   Efeitos de tile (intransitável, privada com ID, destaque, portal, spawn) · Áreas nomeadas · Importar
// Editores usam tudo. Membros (não convidados) constroem só na área da própria mesa, com o inventário.
import { $, h, uid, toast, fill } from './dom.js';
import { ICONS } from './icons.js';
import { openModal, confirmBox, promptBox } from './modal.js';
import { FLOORS, FLOOR_TYPES, WALL_TYPES, paintFloor, paintWall } from '../art/tiles.js';
import { OBJECTS, OBJECT_CATEGORIES, objectThumb, dims } from '../art/objects.js';
import { onAssetLoad, TILE } from '../art/assets.js';
import { normRect } from '../game/renderer.js';
import { FX, parseFx } from '../game/world.js';
import { Imports } from '../features/imports.js';
import { openObjectPanel, canManage, configureAction, rotateObject } from '../features/objectMenu.js';

const TABS = [['floors', 'Pisos'], ['walls', 'Paredes'], ['fg', 'Frente'], ['objects', 'Objetos'], ['effects', 'Efeitos'], ['zones', 'Áreas'], ['import', 'Importar']];
const KIND_LABEL = { area: 'Área comum', private: '🔒 Privada (reunião)', spotlight: '📢 Destaque (palco)', desk: '🪑 Área de mesa', arena: '🐉 Arena de monstros', pvp: '⚔️ Arena PvP' };
const PAGE = 90;

function tileThumb(type, size = 46) {
  const c = h('canvas', { width: size, height: size });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const paint = () => {
    ctx.setTransform(size / TILE, 0, 0, size / TILE, 0, 0);
    ctx.clearRect(0, 0, TILE, TILE);
    if (FLOORS[type].clear) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, TILE, TILE); return true; }
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
    Object.assign(this.state, { on: false, tab: 'objects', item: 'plant', tool: 'place', color: null, rot: null, hover: null, drag: null, filter: '', fx: 'x', fxId: 'A', portalFrom: null });
    this.painted = null;
    this.imports = new Imports(app);
  }

  /** Editores: tudo. Membros: só construir na própria mesa. */
  get limited() { return !this.app.canEdit; }

  toggle(force) {
    const on = force === undefined ? !this.state.on : force;
    if (on && this.app.user.guest) return toast('Convidados não constroem. Crie uma conta para ter sua mesa.', 'info');
    if (on && this.limited && !this.app.world.deskOf(this.app.user.id)) return toast('Reivindique uma mesa primeiro: você constrói na área dela.', 'info', 3000);
    this.state.on = on;
    this.el.hidden = !on;
    document.body.classList.toggle('building', on);
    if (on && this.limited) Object.assign(this.state, { tab: 'objects', tool: 'place' });
    if (on) this.render();
    this.app.emitUi('build');
  }

  setTab(tab) {
    const s = this.state;
    s.tab = tab;
    if (tab === 'floors') { s.item = FLOOR_TYPES.includes(s.item) ? s.item : FLOOR_TYPES[0]; s.tool = s.tool === 'rect' ? 'rect' : 'brush'; }
    if (tab === 'walls') { s.item = WALL_TYPES.includes(s.item) ? s.item : WALL_TYPES[0]; s.tool = s.tool === 'rect' ? 'rect' : 'brush'; }
    if (tab === 'fg') { s.item = FLOORS[s.item] && !FLOORS[s.item].clear ? s.item : WALL_TYPES[0]; s.tool = s.tool === 'rect' || s.tool === 'erase' ? s.tool : 'brush'; }
    if (tab === 'objects') { s.item = OBJECTS[s.item] ? s.item : 'plant'; s.tool = 'place'; s.color = null; s.rot = null; }
    if (tab === 'effects') { s.tool = s.tool === 'rect' || s.tool === 'erase' ? s.tool : 'brush'; }
    if (tab === 'zones') s.tool = 'zone';
    this.render();
  }

  render() {
    const s = this.state;
    const tool = (id, icon, label) => h('button', { type: 'button', class: `tool ${s.tool === id ? 'on' : ''}`, title: label, onclick: () => { s.tool = id; s.portalFrom = null; this.render(); } }, h('span', { html: ICONS[icon] }), label);
    let body;
    const tabs = this.limited ? [['objects', 'Minha mesa']] : TABS;
    if (s.tab === 'floors' || s.tab === 'walls' || s.tab === 'fg') {
      const types = s.tab === 'floors' ? FLOOR_TYPES : s.tab === 'walls' ? WALL_TYPES : [...WALL_TYPES, ...FLOOR_TYPES.filter((t) => !FLOORS[t].clear)];
      body = [
        h('div', { class: 'tools' }, tool('brush', 'brush', 'Pincel'), tool('rect', 'rect', 'Retângulo'), s.tab === 'fg' ? tool('erase', 'eraser', 'Apagar') : null),
        s.tab === 'fg' ? h('p', { class: 'muted small' }, 'Camada da frente: fica por cima do avatar (teto, lintel de porta, copa). Quando você passa por baixo, ela fica transparente em volta.') : null,
        h('div', { class: 'palette' }, types.map((t) => h('button', { type: 'button', class: `pal-item ${s.item === t ? 'on' : ''}`, title: `${FLOORS[t].name}${FLOORS[t].pack ? ` — ${FLOORS[t].pack}` : ''}`, onclick: () => { s.item = t; if (s.tool === 'erase') s.tool = 'brush'; this.render(); } },
          tileThumb(t), h('span', {}, FLOORS[t].name)))),
        s.tab === 'walls' ? h('p', { class: 'muted small' }, 'Paredes bloqueiam a passagem. Abra um vão e coloque uma Porta.') : s.tab === 'floors' ? h('p', { class: 'muted small' }, 'Clique e arraste no mapa para pintar. "Transparente" mostra o fundo importado.') : null,
      ];
    } else if (s.tab === 'objects') {
      const def = OBJECTS[s.item];
      const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar objeto…', value: s.filter, oninput: (e) => { s.filter = e.target.value; s.page = 0; this.renderList(listBox); } });
      const listBox = h('div', {});
      body = [
        h('div', { class: 'tools' }, tool('place', 'cursor', 'Colocar'), tool('rotate', 'refresh', 'Girar'), tool('edit', 'brush', 'Editar'), tool('erase', 'eraser', this.limited ? 'Guardar' : 'Remover')),
        s.tool === 'place' && def ? h('div', { class: 'color-row' }, `Rotação: ${s.rot ?? 0}°`,
          h('button', { type: 'button', class: 'chip', title: 'R', onclick: () => this.rotateGhost(45) }, '⟳ 45° (R)'),
          h('button', { type: 'button', class: 'chip', title: 'Shift+R', onclick: () => this.rotateGhost(15) }, '⟳ 15°')) : null,
        def && def.variants && s.tool === 'place'
          ? h('label', { class: 'color-row' }, 'Cor', h('select', { onchange: (e) => { s.color = e.target.value; } }, Object.keys(def.variants).map((c) => h('option', { value: c, selected: s.color === c }, c))))
          : null,
        s.tool === 'rotate' ? h('p', { class: 'muted small' }, 'Clique num objeto para girar 45° (Shift+clique: 15°). Botão direito abre todas as opções de ângulo.') : null,
        s.tool === 'edit' ? h('p', { class: 'muted small' }, 'Clique num objeto para configurar a ação dele (site, vídeo, texto, imagem…), editar NPCs e textos.') : null,
        this.limited ? h('p', { class: 'muted small' }, 'Você constrói na área da sua mesa com os itens do inventário (compre no Mercador). Teclas 1–9 escolhem o atalho.') : null,
        this.limited ? null : search,
        listBox,
      ];
      this.renderList(listBox, s.filter.toLowerCase());
    } else if (s.tab === 'effects') {
      body = [
        h('div', { class: 'tools' }, tool('brush', 'brush', 'Pincel'), tool('rect', 'rect', 'Retângulo'), tool('erase', 'eraser', 'Apagar')),
        h('div', { class: 'fx-list' }, Object.entries(FX).map(([k, f]) => h('button', { type: 'button', class: `fx-item ${s.fx === k ? 'on' : ''}`, onclick: () => { s.fx = k; s.portalFrom = null; if (s.tool === 'erase') s.tool = 'brush'; this.render(); } },
          h('span', { class: 'fx-swatch', style: `background:${f.color}` }), h('strong', {}, f.name), h('span', { class: 'muted small' }, f.desc)))),
        s.fx === 'p' ? h('label', { class: 'color-row' }, 'ID da área', h('input', { type: 'text', maxlength: 12, value: s.fxId, oninput: (e) => { s.fxId = e.target.value.trim() || 'A'; } })) : null,
        s.fx === 'o' ? h('p', { class: 'muted small' }, s.portalFrom ? `Origem ${s.portalFrom.x},${s.portalFrom.y} escolhida: agora clique no destino.` : 'Clique no tile do portal e depois no destino.') : null,
        h('p', { class: 'muted small' }, 'Os efeitos são invisíveis para todos; aqui eles aparecem coloridos. A camada da frente aparece com contorno verde.'),
      ];
    } else if (s.tab === 'import') {
      body = [this.imports.panel()];
    } else {
      body = [
        h('div', { class: 'tools' }, tool('zone', 'rect', 'Nova área'), tool('spawn', 'pin', 'Entrada')),
        h('p', { class: 'muted small' }, s.tool === 'spawn'
          ? 'Clique no mapa para definir o ponto de entrada padrão (os tiles de Spawn, na aba Efeitos, têm prioridade).'
          : 'Áreas dão nome às salas e definem mesas e arenas. Para isolar conversa por tile, use o efeito Área privada.'),
        h('ul', { class: 'zone-list' }, this.app.world.zones.map((z) => h('li', {},
          h('span', {}, KIND_LABEL[z.kind] ? `${KIND_LABEL[z.kind].split(' ')[0]} ` : '', z.name || '(sem nome)'),
          h('button', { type: 'button', class: 'icon-btn', title: 'Editar', html: ICONS.brush, onclick: () => this.editZone(z) }),
          h('button', { type: 'button', class: 'icon-btn danger', title: 'Remover área', html: ICONS.trash, onclick: () => { this.app.edit([{ t: 'zdel', id: z.id }]); this.render(); } })))),
      ];
    }

    const admin = this.app.user.admin;
    fill(this.el,
      h('header', { class: 'win-title' }, h('h3', {}, this.limited ? 'Construir na minha mesa' : 'Construir'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', html: ICONS.close, onclick: () => this.toggle(false) })),
      h('div', { class: 'seg seg-wrap' }, tabs.map(([id, label]) => h('button', { type: 'button', class: s.tab === id ? 'on' : '', onclick: () => this.setTab(id) }, label))),
      h('div', { class: 'panel-scroll' }, body),
      this.limited ? null : h('footer', { class: 'panel-foot' },
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!s.showFx, onchange: (e) => { s.showFx = e.target.checked; } }), 'Mostrar efeitos sempre'),
        admin ? h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!this.app.world.map.openEdit, onchange: (e) => this.app.edit([{ t: 'settings', openEdit: e.target.checked }]) }), 'Todos os membros podem editar') : null,
        h('button', { type: 'button', class: 'btn-link danger', onclick: () => this.confirmReset() }, h('span', { html: ICONS.refresh }), 'Restaurar escritório padrão')),
    );
  }

  renderList(box, q = this.state.filter.toLowerCase()) {
    const s = this.state;
    const inv = this.app.inventory;
    if (this.limited) {
      const owned = Object.entries(inv.s.items).filter(([t, n]) => OBJECTS[t] && n > 0);
      fill(box, owned.length ? h('div', { class: 'palette' }, owned.map(([type, n]) => h('button', {
        type: 'button', class: `pal-item ${s.item === type ? 'on' : ''}`, title: OBJECTS[type].name,
        onclick: () => { s.item = type; s.tool = 'place'; s.rot = null; inv.assign(type); this.render(); },
      }, objectThumb(type, 46), h('span', {}, `${OBJECTS[type].name} ×${n}`)))) : h('p', { class: 'muted' }, 'Inventário vazio. Fale com o Mercador (recepção) para comprar itens.'));
      return;
    }
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
        type: 'button', class: `pal-item ${s.item === type && s.tool === 'place' ? 'on' : ''}`, title: `${d.name} — ${d.cat} · X: ${d.label || ''}${d.desc ? ` — ${d.desc}` : ''}`,
        onclick: () => { s.item = type; s.tool = 'place'; s.color = d.variants ? Object.keys(d.variants)[0] : null; s.rot = null; inv.assign(type); this.render(); },
      }, objectThumb(type, 46), h('span', {}, d.name)))),
      pages > 1 ? h('div', { class: 'pager' },
        h('button', { type: 'button', class: 'chip', disabled: page === 0, onclick: () => { s.page = page - 1; this.renderList(box); } }, '‹'),
        h('span', { class: 'muted small' }, `${page + 1} / ${pages}`),
        h('button', { type: 'button', class: 'chip', disabled: page >= pages - 1, onclick: () => { s.page = page + 1; this.renderList(box); } }, '›')) : null);
  }

  rotateGhost(step) {
    const s = this.state;
    s.rot = (((s.rot ?? (OBJECTS[s.item] ? OBJECTS[s.item].face || 0 : 0)) + step) % 360 + 360) % 360;
    this.render();
  }

  objectAt(x, y) {
    const list = this.app.world.objectsAt(x, y);
    return [...list].reverse().find((o) => !OBJECTS[o.type].flat) || list.find((o) => OBJECTS[o.type].flat) || null;
  }

  canPlace(type, x, y) {
    const def = OBJECTS[type];
    const w = this.app.world;
    const { w: ww, h: hh } = dims({ type, rot: this.state.rot ?? undefined }, def);
    if (this.limited && !this.app.inventory.canBuildAt(type, x, y, this.state.rot)) return false;
    for (let yy = y; yy < y + hh; yy++) {
      for (let xx = x; xx < x + ww; xx++) {
        if (!w.inBounds(xx, yy) || w.floorAt(xx, yy) === 'void') return false;
        if (w.isWall(xx, yy) && !def.door && !def.wall) return false;
        if (def.wall || def.flat || def.small) continue;
        if (w.objectsAt(xx, yy).some((o) => { const d = OBJECTS[o.type]; return !d.flat && !d.small && !d.wall; })) return false;
      }
    }
    return true;
  }

  pointerDown(t, e) {
    const s = this.state;
    s.hover = t;
    if (e.button === 2) {
      const o = this.objectAt(t.x, t.y);
      if (o && s.tab === 'objects') openObjectPanel(this.app, o);
      else if (s.tab === 'effects' || s.tab === 'fg') this.paintCell(t, true);
      return;
    }
    if (s.tab === 'floors' || s.tab === 'walls' || s.tab === 'fg' || s.tab === 'effects') {
      if (s.tab === 'effects' && s.fx === 'o' && s.tool !== 'erase') return this.portalClick(t);
      if (s.tool === 'rect') s.drag = { start: t, end: t };
      else { this.painted = new Set(); this.paint(t); }
    } else if (s.tab === 'objects') {
      if (s.tool === 'place') {
        if (!this.canPlace(s.item, t.x, t.y)) { toast(this.limited ? 'Só na área livre da sua mesa.' : 'Não cabe aí — escolha um espaço livre.', 'warn', 1600); return; }
        this.app.inventory.place(s.item, t.x, t.y, { rot: s.rot, color: s.color });
      } else {
        const o = this.objectAt(t.x, t.y);
        if (!o) return;
        if (!canManage(this.app, o)) return toast('Esse objeto não é seu.', 'warn', 1500);
        if (s.tool === 'rotate') rotateObject(this.app, o, (o.rot ?? OBJECTS[o.type].face ?? 0) + (e.shiftKey ? 15 : 45));
        else if (s.tool === 'edit') this.editObject(o);
        else this.app.inventory.pickup(o);
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
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.push([x, y]);
    this.applyCells(cells);
  }

  /** Valor que o pincel aplica na aba atual. */
  value(erase = false) {
    const s = this.state;
    if (erase || s.tool === 'erase') return null;
    if (s.tab === 'effects') return s.fx === 'p' ? `p:${s.fxId || 'A'}` : s.fx;
    return s.item;
  }

  applyCells(cells, erase = false) {
    const s = this.state;
    const v = this.value(erase);
    if (s.tab === 'floors' || s.tab === 'walls') this.app.edit([{ t: 'floor', cells: cells.map(([x, y]) => [x, y, v]) }]);
    else if (s.tab === 'fg') this.app.edit([{ t: 'layer', layer: 'fg', cells: cells.map(([x, y]) => [x, y, v]) }]);
    else if (s.tab === 'effects') this.app.edit([{ t: 'layer', layer: 'fx', cells: cells.map(([x, y]) => [x, y, v]) }]);
  }

  paintCell(t, erase) {
    if (!this.app.world.inBounds(t.x, t.y)) return;
    this.applyCells([[t.x, t.y]], erase);
  }

  paint(t) {
    const w = this.app.world;
    const key = `${t.x},${t.y}`;
    if (!w.inBounds(t.x, t.y) || this.painted.has(key)) return;
    const s = this.state;
    if ((s.tab === 'floors' || s.tab === 'walls') && w.floorAt(t.x, t.y) === s.item) return;
    this.painted.add(key);
    this.applyCells([[t.x, t.y]]);
  }

  portalClick(t) {
    const s = this.state;
    if (!this.app.world.inBounds(t.x, t.y)) return;
    if (!s.portalFrom) {
      s.portalFrom = { x: t.x, y: t.y };
      this.render();
      return;
    }
    const from = s.portalFrom;
    s.portalFrom = null;
    this.app.edit([{ t: 'layer', layer: 'fx', cells: [[from.x, from.y, `o:${t.x},${t.y}`]] }]);
    toast(`Portal criado: ${from.x},${from.y} → ${t.x},${t.y}`, 'ok', 2000);
    this.render();
  }

  async editObject(o) {
    const def = OBJECTS[o.type];
    if (def.npc) return this.app.npcRoles.edit(o);
    if (['inspect', 'picture', 'examine'].includes(def.interact) && !(o.data && o.data.action)) {
      const v = await promptBox(`Texto: ${def.name}`, `Texto exibido ao interagir com "${def.name}" (deixe vazio para configurar outra ação)`, (o.data && o.data.text) || '', { multiline: true });
      if (v === null) return;
      if (v.trim()) {
        this.app.edit([{ t: 'data', id: o.id, data: { ...(o.data || {}), text: v.trim() } }]);
        return toast('Texto atualizado.', 'ok', 1500);
      }
    }
    configureAction(this.app, o);
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
        h('p', { class: 'muted small' }, 'Privada: chat "perto" e vídeo só entre quem está dentro. Destaque: todos ouvem. Área de mesa: o dono decora e constrói nela. Arena: monstros. Arena PvP: único lugar de luta entre jogadores.')),
      footer: [h('button', { type: 'button', class: 'btn-secondary', onclick: () => modal.close() }, 'Cancelar'), h('button', { type: 'button', class: 'btn-primary', onclick: save }, 'Salvar')],
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => name.focus(), 30);
  }

  async confirmReset() {
    if (await confirmBox('Restaurar escritório?', 'Apaga todas as alterações do mapa (pisos, camadas, objetos e áreas) para todo mundo. Não dá para desfazer.', 'Restaurar', true)) this.app.resetWorld();
  }
}

export { parseFx };
