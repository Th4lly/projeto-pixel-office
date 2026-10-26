// Inventário e hotbar de construção.
// • items: { tipo: quantidade } — o que você possui para construir
// • hot: 9 atalhos (teclas 1–9 no modo Construir) e sel = atalho selecionado
// • zeny: moeda ganha na arena e na estação de trabalho; gasta com o Mercador
// Editores têm o "modo criativo": colocam do catálogo sem gastar itens.
// Membros constroem na área da própria mesa com o que têm no inventário.
import { h, fill, toast, uid } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { CAT, frameCanvas } from '../art/assets.js';
import { OBJECTS, objectThumb, dims } from '../art/objects.js';
import { blip } from '../audio.js';

const HOT = 9;
const START = { items: {}, hot: Array(HOT).fill(null), sel: 0, zeny: 500, creative: true };
const SHOP_CATS = ['Itens de mesa', 'Itens pequenos', 'Eletrônicos', 'Escritório', 'Escritório pixel', 'Decoração', 'Plantas', 'Móveis nobres', 'Café', 'Cantinho de leitura', 'Quadros', 'Móveis', 'Cantinho dos gatos', 'Natureza', 'Floresta', 'Tesouros', 'Itens', 'Mágico', 'Meus objetos'];

export class Inventory {
  constructor(app) {
    this.app = app;
    const saved = (app.user && app.user.inventory) || {};
    let local = {};
    if (app.user.guest) { try { local = JSON.parse(localStorage.getItem('po.inventory') || '{}'); } catch { /* ok */ } }
    this.s = { ...START, ...saved, ...local };
    this.s.items = { ...(this.s.items || {}) };
    this.s.loot = { ...(this.s.loot || {}) };
    this.s.hot = Array.from({ length: HOT }, (_, i) => (this.s.hot || [])[i] || null);
    this.lastCraft = 0;
    this.bar = h('div', { class: 'hotbar win', hidden: true });
    document.getElementById('app').append(this.bar);
    app.on('build', () => this.render());
    this.render();
  }

  get selected() { return this.s.hot[this.s.sel] || null; }
  get creative() { return !!(this.app.canEdit && this.s.creative); }
  count(type) { return this.s.items[type] || 0; }

  save() {
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      if (this.app.user.guest) { try { localStorage.setItem('po.inventory', JSON.stringify(this.s)); } catch { /* ok */ } return; }
      this.app.backend.saveProfile({ inventory: this.s }).catch(() => {});
    }, 800);
    this.render();
  }

  add(type, n = 1, { toHot = true } = {}) {
    if (!OBJECTS[type]) return;
    this.s.items[type] = this.count(type) + n;
    if (toHot && !this.s.hot.includes(type)) {
      const free = this.s.hot.indexOf(null);
      if (free >= 0) this.s.hot[free] = type;
    }
    this.save();
  }

  take(type, n = 1) {
    if (this.creative) return true;
    if (this.count(type) < n) return false;
    this.s.items[type] -= n;
    if (!this.s.items[type]) delete this.s.items[type];
    this.save();
    return true;
  }

  select(i) {
    this.s.sel = Math.max(0, Math.min(HOT - 1, i));
    const t = this.selected;
    if (t && this.app.build.on) {
      Object.assign(this.app.build, { tab: 'objects', tool: 'place', item: t, rot: null });
      this.app.buildPanel.render();
    }
    this.save();
  }

  /** Coloca o tipo na hotbar (atalho selecionado). */
  assign(type) {
    const i = this.s.hot.indexOf(type);
    if (i >= 0) { this.s.sel = i; } else this.s.hot[this.s.sel] = type;
    if (this.creative && !this.count(type)) this.s.items[type] = 0;
    this.save();
  }

  /** Drop de monstro (itens do RO): fica na bolsa e pode ser vendido ao Mercador. */
  addLoot(id, n = 1) {
    this.s.loot[id] = (this.s.loot[id] || 0) + n;
    this.save();
  }

  lootPrice(id) {
    const i = (CAT.loot || []).findIndex((l) => l.id === id);
    return 10 + ((Math.max(0, i) * 7) % 40);
  }

  lootEntries() {
    return Object.entries(this.s.loot).filter(([, n]) => n > 0).map(([id, n]) => [(CAT.loot || []).find((l) => l.id === id), n]).filter(([it]) => it);
  }

  addZeny(n) {
    this.s.zeny = Math.max(0, (this.s.zeny || 0) + n);
    this.save();
  }

  // ------------------------------------------------------------------ construir
  /** Membros sem permissão de edição: só dentro da área da própria mesa. */
  inMyDeskArea(x, y) {
    const w = this.app.world;
    const z = w.zonesAt(x, y).find((zz) => zz.kind === 'desk');
    const d = z && w.deskOfZone(z);
    return !!(d && d.data && d.data.owner && d.data.owner.uid === this.app.user.id);
  }

  canBuildAt(type, x, y, rot) {
    if (this.app.canEdit) return true;
    const { w, h: hh } = dims({ type, rot }, OBJECTS[type]);
    for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) if (!this.inMyDeskArea(x + i, y + j)) return false;
    return true;
  }

  async place(type, x, y, { rot = null, color = null } = {}) {
    const def = OBJECTS[type];
    if (!def) return false;
    if (!this.canBuildAt(type, x, y, rot)) { toast('Você só pode construir na área da sua mesa.', 'warn', 2200); return false; }
    if (!this.creative && this.count(type) < 1) { toast('Você não tem esse item. Compre no Mercador ou guarde um do mapa.', 'warn', 2600); return false; }
    const obj = { id: uid('o'), type, x, y, state: def.light && !def.light.always ? { on: true } : {}, data: {} };
    if (def.door) obj.state = { open: true };
    if (color) obj.color = color;
    if (rot !== null && rot !== undefined) obj.rot = rot;
    if (this.app.canEdit) {
      if (!this.creative) obj.data.placed_by = this.app.user.id;
      this.app.edit([{ t: 'add', obj }]);
    } else {
      try {
        const d = dims(obj, def);
        await this.app.backend.placeOwned(obj, d.w, d.h);
        obj.data.placed_by = this.app.user.id;
        this.app.world.apply([{ t: 'add', obj }]);
        this.app.room.send('edit', [{ t: 'add', obj }]);
        this.app.renderer.invalidate();
      } catch (e) { toast(e.message, 'error'); return false; }
    }
    this.take(type);
    blip(660, 0.05, 0.04);
    return true;
  }

  /** Guarda um objeto do mapa no inventário (editores, ou quem colocou). */
  async pickup(o, { quiet = true } = {}) {
    const app = this.app;
    const mine = o.data && o.data.placed_by === app.user.id;
    if (!app.canEdit && !mine) {
      if (!quiet) app.emote('👀');
      const { openObjectPanel } = await import('./objectMenu.js');
      openObjectPanel(app, o);
      return false;
    }
    try {
      if (app.canEdit) app.edit([{ t: 'del', id: o.id }]);
      else {
        await app.backend.pickupObject(o.id);
        app.world.apply([{ t: 'del', id: o.id }]);
        app.room.send('edit', [{ t: 'del', id: o.id }]);
        app.renderer.invalidate();
      }
    } catch (e) { toast(e.message, 'error'); return false; }
    this.add(o.type);
    app.floatText(o.x, o.y - 0.6, `🎒 +1 ${OBJECTS[o.type].name}`, '#ffd84d');
    return true;
  }

  /** Estação de trabalho: fabrica um item pequeno (1 por minuto). */
  craft(o, def) {
    if (Date.now() - this.lastCraft < 60000) return toast(`A ${def.name.toLowerCase()} ainda está esfriando…`, 'info', 1800);
    this.lastCraft = Date.now();
    const pool = CAT.props.filter((p) => p.small && ['Itens', 'Itens pequenos', 'Itens de mesa', 'Tesouros'].includes(p.cat));
    const p = pool[Math.floor(Math.random() * pool.length)];
    if (!p) return;
    this.add(p.id);
    this.addZeny(5);
    this.app.floatText(o.x, o.y - 0.8, `🔨 ${p.name} (+5z)`, '#ffd84d');
    this.app.emote('🔨');
  }

  price(type) {
    const d = OBJECTS[type];
    if (!d) return 0;
    return Math.max(10, Math.round((d.w * d.h * 40 + (d.small ? 10 : 30)) / 10) * 10);
  }

  // ------------------------------------------------------------------ hotbar
  render() {
    const show = !!this.app.build.on;
    this.bar.hidden = !show;
    if (!show) return;
    fill(this.bar,
      h('div', { class: 'hot-slots' }, this.s.hot.map((t, i) => h('button', {
        type: 'button', 'data-key': String(i + 1), class: `hot-slot ${i === this.s.sel ? 'on' : ''}`, title: t ? `${OBJECTS[t] ? OBJECTS[t].name : t} (${i + 1})` : `Vazio (${i + 1})`,
        onclick: () => this.select(i),
        oncontextmenu: (e) => { e.preventDefault(); this.s.hot[i] = null; this.save(); },
      }, h('kbd', {}, String(i + 1)), t && OBJECTS[t] ? objectThumb(t, 34) : null,
      t && !this.creative ? h('span', { class: 'hot-n' }, String(this.count(t))) : null))),
      h('div', { class: 'hot-side' },
        h('span', { class: 'zeny', title: 'Zeny' }, `🪙 ${this.s.zeny}z`),
        this.app.canEdit ? h('label', { class: 'check small', title: 'Editores colocam do catálogo sem gastar itens' },
          h('input', { type: 'checkbox', checked: !!this.s.creative, onchange: (e) => { this.s.creative = e.target.checked; this.save(); } }), 'Criativo') : null,
        h('button', { type: 'button', class: 'btn-link small', onclick: () => this.open() }, '🎒 Inventário')));
  }

  // ------------------------------------------------------------------ janelas
  open() {
    const body = h('div', { class: 'inv' });
    const m = openModal({ title: `🎒 Inventário — 🪙 ${this.s.zeny}z`, className: 'modal-wide', content: body });
    const paint = () => {
      const entries = Object.entries(this.s.items).filter(([t, n]) => OBJECTS[t] && n > 0);
      fill(body,
        h('p', { class: 'muted small' }, 'Clique num item para pôr no atalho selecionado da hotbar. No modo Construir, use as teclas 1–9, R para girar e clique no mapa para colocar.'),
        entries.length ? h('div', { class: 'palette' }, entries.map(([t, n]) => h('button', { type: 'button', class: 'pal-item', title: OBJECTS[t].name, onclick: () => { this.assign(t); m.close(); } },
          objectThumb(t, 46), h('span', {}, `${OBJECTS[t].name} ×${n}`)))) : h('p', { class: 'muted' }, 'Inventário vazio. Compre no Mercador, fabrique numa estação de trabalho ou guarde itens que você colocou.'),
        h('div', { class: 'opt-label' }, 'Bolsa de drops (monstros da arena)'),
        this.lootEntries().length ? h('div', { class: 'palette' }, this.lootEntries().map(([it, n]) => h('div', { class: 'pal-item', title: it.name }, frameCanvas(it.s, it.f, 40), h('span', {}, `${it.name} ×${n}`))))
          : h('p', { class: 'muted small' }, 'Derrote monstros na arena e pegue o que cair no chão (clique no item ou passe por cima).'));
    };
    paint();
  }

  /** Loja do Mercador. */
  openShop(npcName = 'Mercador') {
    const app = this.app;
    let cat = SHOP_CATS[0];
    let q = '';
    let page = 0;
    const PAGE = 40;
    const body = h('div', { class: 'shop' });
    const m = openModal({ title: `🛒 ${npcName}`, className: 'modal-xl', content: body });
    const paint = () => {
      const cats = SHOP_CATS.filter((c) => Object.values(OBJECTS).some((d) => d.cat === c && !d.functional));
      const list = Object.entries(OBJECTS).filter(([, d]) => !d.functional && !d.flat && (q ? d.name.toLowerCase().includes(q) : d.cat === cat));
      const pages = Math.ceil(list.length / PAGE);
      fill(body,
        h('div', { class: 'shop-head' }, h('strong', {}, `🪙 ${this.s.zeny}z`),
          h('input', { type: 'search', class: 'search', placeholder: 'Buscar item…', value: q, oninput: (e) => { q = e.target.value.toLowerCase(); page = 0; paint(); } })),
        h('div', { class: 'chips' }, cats.map((c) => h('button', { class: `chip ${c === cat && !q ? 'on' : ''}`, onclick: () => { cat = c; q = ''; page = 0; paint(); } }, c))),
        h('div', { class: 'palette' }, list.slice(page * PAGE, page * PAGE + PAGE).map(([t, d]) => {
          const p = this.price(t);
          return h('button', { type: 'button', class: 'pal-item shop-item', title: `${d.name} — ${p}z (você tem ${this.count(t)})`, onclick: () => {
            if (this.s.zeny < p) return toast('Zeny insuficiente. Ganhe na arena ou fabricando itens.', 'warn');
            this.s.zeny -= p;
            this.add(t);
            blip(880, 0.06, 0.05);
            toast(`Comprou ${d.name} por ${p}z.`, 'ok', 1500);
            paint();
          } }, objectThumb(t, 46), h('span', {}, d.name), h('em', { class: 'price' }, `${p}z`));
        })),
        pages > 1 ? h('div', { class: 'pager' },
          h('button', { class: 'chip', disabled: page === 0, onclick: () => { page -= 1; paint(); } }, '‹'), h('span', { class: 'muted small' }, `${page + 1} / ${pages}`),
          h('button', { class: 'chip', disabled: page >= pages - 1, onclick: () => { page += 1; paint(); } }, '›')) : null,
        h('div', { class: 'opt-label' }, 'Vender (metade do preço)'),
        h('div', { class: 'palette' }, Object.entries(this.s.items).filter(([t, n]) => OBJECTS[t] && n > 0).map(([t, n]) => h('button', {
          type: 'button', class: 'pal-item', title: `Vender ${OBJECTS[t].name}`, onclick: () => { this.take(t); this.addZeny(Math.round(this.price(t) / 2)); paint(); },
        }, objectThumb(t, 40), h('span', {}, `${OBJECTS[t].name} ×${n}`), h('em', { class: 'price' }, `+${Math.round(this.price(t) / 2)}z`)))),
        this.lootEntries().length ? h('div', { class: 'opt-label' }, 'Vender drops') : null,
        h('div', { class: 'palette' }, this.lootEntries().map(([it, n]) => h('button', {
          type: 'button', class: 'pal-item', title: `Vender ${it.name}`, onclick: () => { this.s.loot[it.id] -= 1; this.addZeny(this.lootPrice(it.id)); blip(990, 0.05, 0.05); paint(); },
        }, frameCanvas(it.s, it.f, 40), h('span', {}, `${it.name} ×${n}`), h('em', { class: 'price' }, `+${this.lootPrice(it.id)}z`)))));
      m.el.querySelector('.win-title h2').textContent = `🛒 ${npcName} — 🪙 ${this.s.zeny}z`;
    };
    paint();
    return app;
  }
}
