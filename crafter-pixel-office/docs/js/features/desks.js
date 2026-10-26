// Mesas pessoais: cada pessoa reivindica uma mesa (com a área em volta) e decora
// livremente — objetos em cima e ao redor, adesivos de apps, cores de cada item,
// modelo/cor da mesa e a cadeira. Também dá para ligar para alguém a partir da mesa.
import { h, fill, toast } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { CAT, IDX, TILE, drawFrame, image, onAssetLoad, frameCanvas, url } from '../art/assets.js';
import { OBJECTS, drawObjectSprite, objectThumb } from '../art/objects.js';
import { paintFloor, paintWall, FLOORS } from '../art/tiles.js';

const TOP_CATS = ['Itens de mesa', 'Itens pequenos', 'Itens', 'Eletrônicos', 'Escritório pixel', 'Cozinha', 'Mágico', 'Tesouros', 'Pets'];
const AROUND_CATS = ['Escritório', 'Escritório pixel', 'Decoração', 'Plantas', 'Móveis nobres', 'Cantinho de leitura', 'Café', 'Quadros', 'Móveis', 'Cantinho dos gatos', 'Natureza', 'Floresta'];
const MAX_ITEMS = 60;
const SCALE = 3; // zoom do editor

/** Desenha um item de decoração (objeto do catálogo ou adesivo de app). */
export function drawDecorItem(ctx, d, x, by, k, time = 0) {
  ctx.save();
  if (d.hue || d.sat !== undefined || d.bri !== undefined) {
    ctx.filter = `hue-rotate(${d.hue || 0}deg) saturate(${d.sat ?? 100}%) brightness(${d.bri ?? 100}%)`;
  }
  if (d.icon) {
    const ic = IDX.icons.get(d.icon);
    if (ic) {
      const sid = ic.big ?? ic.small;
      const img = image(sid);
      if (img) {
        const size = (d.size || 12) * k;
        if (d.flip) { ctx.translate(x, 0); ctx.scale(-1, 1); x = 0; }
        ctx.drawImage(img, x - size / 2, by - size, size, size);
      }
    }
  } else {
    const def = OBJECTS[d.p];
    if (def) {
      const kk = k * (d.k || 1);
      drawObjectSprite(ctx, { x: 0, y: 0, type: d.p, color: d.color, rot: d.rot, flip: d.flip }, def, x - (def.w * TILE * kk) / 2, by - def.h * TILE * kk, kk, time);
    }
  }
  ctx.restore();
}

export class Desks {
  constructor(app) {
    this.app = app;
  }

  get myDesk() {
    return this.app.world.deskOf(this.app.user.id);
  }

  zoneOf(desk) {
    return this.app.world.deskZoneOf(desk) || { x: desk.x - 1, y: desk.y - 1, w: (OBJECTS[desk.type].w || 2) + 2, h: 4 };
  }

  /** Visual próprio de uma cadeira/mesa por causa da personalização do dono. */
  skinFor(o) {
    const def = OBJECTS[o.type];
    if (!def) return null;
    if (def.desk && o.data && o.data.deskSkin && OBJECTS[o.data.deskSkin]) return { type: o.data.deskSkin, color: o.data.deskColor };
    if (def.sit) {
      const z = this.app.world.zonesAt(o.x, o.y).find((zz) => zz.kind === 'desk');
      const desk = z && this.app.world.deskOfZone(z);
      if (desk && desk.data && desk.data.chair && OBJECTS[desk.data.chair]) return { type: desk.data.chair, rot: desk.data.chairRot, color: desk.data.chairColor };
    }
    return null;
  }

  /** Aplica a mudança no mundo e avisa os outros (sem gravar pelo caminho do editor). */
  applyData(desk, data) {
    const ops = [{ t: 'data', id: desk.id, data }];
    this.app.world.apply(ops);
    this.app.room.send('edit', ops);
    this.app.renderer.invalidate();
    this.app.emitUi('world');
  }

  async claim(desk) {
    try {
      const data = await this.app.backend.claimDesk(desk.id);
      // a mesa antiga foi liberada no servidor: reflete aqui também
      const old = this.app.world.objects.find((o) => o !== desk && o.data && o.data.owner && o.data.owner.uid === this.app.user.id);
      if (old) {
        const { owner: _o, decor: _d, chair: _c, deskSkin: _s, deskColor: _k, ...rest } = old.data;
        this.applyData(old, rest);
      }
      this.applyData(desk, data || { ...(desk.data || {}), owner: { uid: this.app.user.id, name: this.app.me.name } });
      toast('Mesa reivindicada! Agora decore do seu jeito.', 'ok', 2500);
      this.app.emote('🪑');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async release(desk) {
    if (!(await confirmBox('Liberar a mesa?', 'A decoração desta mesa será apagada.', 'Liberar', true))) return;
    try {
      await this.app.backend.releaseDesk(desk.id);
      const { owner: _o, decor: _d, chair: _c, deskSkin: _s, deskColor: _k, ...rest } = desk.data || {};
      this.applyData(desk, rest);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async save(desk, patch) {
    const data = { ...(desk.data || {}), ...patch };
    try {
      await this.app.backend.setDeskDecor(desk.id, data.decor || [], data.chair || null, data.deskColor || null, data.deskSkin || null);
      this.applyData(desk, data);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  }

  // ------------------------------------------------------------------ janela da mesa
  open(desk) {
    const app = this.app;
    const owner = desk.data && desk.data.owner;
    const mine = owner && owner.uid === app.user.id;
    const body = h('div', { class: 'desk-menu' });
    const m = openModal({ title: owner ? `🪑 Mesa de ${owner.name}` : '🪑 Mesa livre', content: body, className: 'modal-wide' });
    fill(body,
      h('div', { class: 'desk-actions' },
        !owner && !app.user.guest ? h('button', { class: 'btn-primary', onclick: async () => { await this.claim(desk); m.close(); this.openDecorator(desk); } }, 'Reivindicar esta mesa') : null,
        mine ? h('button', { class: 'btn-primary', onclick: () => { m.close(); this.openDecorator(desk); } }, '🎨 Decorar minha mesa') : null,
        h('button', { class: 'btn-secondary', onclick: () => { m.close(); app.calls.openDialer({ from: 'mesa', place: owner ? `Mesa de ${owner.name}` : 'Mesa' }); } }, h('span', { class: 'phone-ic', html: ICONS.phone }), 'Ligar daqui'),
        owner && !mine ? h('button', { class: 'btn-secondary', onclick: () => { const p = [...app.players.values()].find((x) => x.uid === owner.uid); if (p) { m.close(); app.calls.call([p.id], { place: `Mesa de ${owner.name}` }); } else toast(`${owner.name} não está online.`, 'warn'); } }, `Ligar para ${owner.name}`) : null,
        (mine || app.user.admin) && owner ? h('button', { class: 'btn-link danger', onclick: async () => { m.close(); await this.release(desk); } }, 'Liberar mesa') : null),
      h('div', { class: 'opt-label' }, 'Notificações nesta mesa'),
      app.docs.feedList(desk),
      mine || app.canEdit ? [h('div', { class: 'opt-label' }, 'Conectar ferramentas'), app.docs.webhookBox(desk)] : null);
  }

  // ------------------------------------------------------------------ editor de decoração
  openDecorator(desk = this.myDesk) {
    const app = this.app;
    if (!desk) {
      toast('Você ainda não tem mesa. Vá até uma mesa livre no Escritório e reivindique.', 'warn', 4000);
      return null;
    }
    const zone = this.zoneOf(desk);
    const ddef = OBJECTS[desk.type];
    let decor = JSON.parse(JSON.stringify((desk.data && desk.data.decor) || []));
    let chair = (desk.data && desk.data.chair) || '';
    let deskSkin = (desk.data && desk.data.deskSkin) || '';
    let deskColor = (desk.data && desk.data.deskColor) || '';
    let layer = 'top';
    let cat = TOP_CATS[0];
    let pick = null; // {p} | {icon}
    let sel = -1;
    let drag = null;
    let raf = 0;
    let page = 0;
    const PAGE = 48;

    const W = zone.w * TILE;
    const H = zone.h * TILE;
    const canvas = h('canvas', { class: 'decor-canvas', width: W * SCALE, height: H * SCALE });
    const ctx = canvas.getContext('2d');
    const deskX = (desk.x - zone.x) * TILE;
    const deskY = (desk.y - zone.y) * TILE;
    const palette = h('div', { class: 'decor-palette' });
    const props = h('div', { class: 'decor-props' });
    const tabs = h('div', { class: 'seg seg-wide' });
    const counter = h('span', { class: 'muted small' });

    const deskObj = () => ({ ...desk, x: 0, y: 0, type: deskSkin && OBJECTS[deskSkin] ? deskSkin : desk.type, color: deskColor || desk.color, data: {} });

    const draw = (t) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(SCALE, SCALE);
      for (let y = 0; y < zone.h; y++) for (let x = 0; x < zone.w; x++) {
        const tt = app.world.floorAt(zone.x + x, zone.y + y);
        if (FLOORS[tt] && FLOORS[tt].wall) paintWall(ctx, tt, x, y, true); else paintFloor(ctx, tt, x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= zone.w; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke(); }
      for (let y = 0; y <= zone.h; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(W, y * TILE); ctx.stroke(); }
      ctx.restore();
      const items = decor.map((d, i) => ({ d, i, z: d.dy + (d.layer === 'top' ? 0.5 : 0) }));
      // cadeira e outros objetos reais dentro da área
      const others = app.world.objects.filter((o) => o !== desk && OBJECTS[o.type] && o.x >= zone.x && o.y >= zone.y && o.x < zone.x + zone.w && o.y < zone.y + zone.h);
      const list = [
        { z: deskY + ddef.h * TILE - 1, draw: () => drawObjectSprite(ctx, deskObj(), OBJECTS[deskObj().type], deskX * SCALE, deskY * SCALE, SCALE, t / 1000) },
        ...others.map((o) => ({ z: (o.y - zone.y + OBJECTS[o.type].h) * TILE, draw: () => {
          const ov = OBJECTS[o.type].sit && chair && OBJECTS[chair] ? { ...o, type: chair } : o;
          drawObjectSprite(ctx, ov, OBJECTS[ov.type], (o.x - zone.x) * TILE * SCALE, (o.y - zone.y) * TILE * SCALE, SCALE, t / 1000);
        } })),
        ...items.map((it) => ({ z: it.d.layer === 'top' ? deskY + ddef.h * TILE : it.d.dy, draw: () => {
          drawDecorItem(ctx, it.d, it.d.dx * SCALE, it.d.dy * SCALE, SCALE, t / 1000);
          if (it.i === sel) {
            ctx.strokeStyle = '#ffd84d';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(it.d.dx * SCALE - 14 * SCALE, it.d.dy * SCALE - 26 * SCALE, 28 * SCALE, 28 * SCALE);
            ctx.setLineDash([]);
          }
        } })),
      ].sort((a, b) => a.z - b.z);
      list.forEach((x) => x.draw());
      raf = requestAnimationFrame(draw);
    };

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const hit = (p) => {
      for (let i = decor.length - 1; i >= 0; i--) {
        const d = decor[i];
        if (Math.abs(p.x - d.dx) < 14 && p.y <= d.dy + 3 && p.y >= d.dy - 26) return i;
      }
      return -1;
    };
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      const i = hit(p);
      if (e.button === 2) {
        if (i >= 0) { decor.splice(i, 1); sel = -1; renderProps(); }
        return;
      }
      if (i >= 0 && !pick) {
        sel = i;
        drag = { i, ox: p.x - decor[i].dx, oy: p.y - decor[i].dy };
        canvas.setPointerCapture(e.pointerId);
        renderProps();
        return;
      }
      if (!pick) { sel = -1; renderProps(); return; }
      if (decor.length >= MAX_ITEMS) return toast(`Máximo de ${MAX_ITEMS} itens na mesa.`, 'warn');
      decor.push({ ...pick, dx: Math.round(p.x), dy: Math.round(p.y), layer });
      sel = decor.length - 1;
      renderProps();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = pos(e);
      decor[drag.i].dx = Math.round(Math.max(0, Math.min(W, p.x - drag.ox)));
      decor[drag.i].dy = Math.round(Math.max(4, Math.min(H, p.y - drag.oy)));
    });
    canvas.addEventListener('pointerup', () => { drag = null; });

    const slider = (label, key, min, max, def, unit = '') => {
      const d = decor[sel];
      const out = h('span', { class: 'muted small' }, `${d[key] ?? def}${unit}`);
      return h('label', { class: 'slider-row' }, label,
        h('input', { type: 'range', min, max, value: d[key] ?? def, oninput: (e) => { d[key] = Number(e.target.value); out.textContent = `${d[key]}${unit}`; } }), out);
    };

    function renderProps() {
      counter.textContent = `${decor.length}/${MAX_ITEMS} itens`;
      if (sel < 0 || !decor[sel]) {
        fill(props, h('p', { class: 'muted small' }, pick ? 'Clique na área para colocar o item escolhido. Clique com o botão direito num item para remover.' : 'Escolha um item na lista e clique na área da mesa. Clique num item já colocado para mover, mudar a cor ou o tamanho.'));
        return;
      }
      const d = decor[sel];
      const def = d.p && OBJECTS[d.p];
      fill(props,
        h('div', { class: 'opt-label' }, d.icon ? `Adesivo: ${(IDX.icons.get(d.icon) || {}).name}` : def ? def.name : 'Item'),
        slider('Cor (matiz)', 'hue', 0, 360, 0, '°'),
        slider('Saturação', 'sat', 0, 200, 100, '%'),
        slider('Brilho', 'bri', 40, 160, 100, '%'),
        d.icon ? slider('Tamanho', 'size', 6, 32, 12, 'px') : h('label', { class: 'slider-row' }, 'Tamanho',
          h('input', { type: 'range', min: 40, max: 160, value: Math.round((d.k || 1) * 100), oninput: (e) => { d.k = Number(e.target.value) / 100; } })),
        def && def.variants ? h('label', { class: 'slider-row' }, 'Cor do móvel', h('select', { onchange: (e) => { d.color = e.target.value; } }, Object.keys(def.variants).map((c) => h('option', { value: c, selected: d.color === c }, c)))) : null,
        h('div', { class: 'chips' },
          h('button', { type: 'button', class: 'chip', onclick: () => { d.flip = !d.flip; } }, '↔ Espelhar'),
          h('button', { type: 'button', class: 'chip', onclick: () => { d.layer = d.layer === 'top' ? 'around' : 'top'; renderProps(); } }, d.layer === 'top' ? 'Em cima da mesa' : 'Em volta'),
          h('button', { type: 'button', class: 'chip', onclick: () => { decor.push({ ...d, dx: d.dx + 6, dy: d.dy + 2 }); sel = decor.length - 1; renderProps(); } }, 'Duplicar'),
          h('button', { type: 'button', class: 'chip danger', onclick: () => { decor.splice(sel, 1); sel = -1; renderProps(); } }, 'Remover')));
    }

    function renderPalette() {
      const cats = layer === 'top' ? [...TOP_CATS, 'Adesivos'] : [...AROUND_CATS, 'Adesivos'];
      if (!cats.includes(cat)) cat = cats[0];
      const head = h('div', { class: 'chips' }, cats.map((c) => h('button', { type: 'button', class: `chip ${cat === c ? 'on' : ''}`, onclick: () => { cat = c; page = 0; renderPalette(); } }, c)));
      let entries;
      if (cat === 'Adesivos') {
        entries = CAT.icons.map((ic) => ({ key: `i:${ic.id}`, name: ic.name, pick: { icon: ic.id, size: 12 }, thumb: () => frameCanvas(ic.big ?? ic.small, null, 40) }));
      } else {
        entries = Object.entries(OBJECTS).filter(([, d]) => d.cat === cat && !d.functional && !d.flat)
          .map(([type, d]) => ({ key: type, name: d.name, pick: { p: type, ...(d.variants ? { color: Object.keys(d.variants)[0] } : {}) }, thumb: () => objectThumb(type, 40) }));
      }
      const pages = Math.ceil(entries.length / PAGE);
      fill(palette, head,
        h('div', { class: 'palette' }, entries.slice(page * PAGE, page * PAGE + PAGE).map((en) =>
          h('button', { type: 'button', class: `pal-item ${pick && (pick.p || `i:${pick.icon}`) === (en.pick.p || `i:${en.pick.icon}`) ? 'on' : ''}`, title: en.name,
            onclick: () => { pick = en.pick; sel = -1; renderPalette(); renderProps(); } }, en.thumb(), h('span', {}, en.name)))),
        pages > 1 ? h('div', { class: 'pager' },
          h('button', { type: 'button', class: 'chip', disabled: page === 0, onclick: () => { page -= 1; renderPalette(); } }, '‹'),
          h('span', { class: 'muted small' }, `${page + 1} / ${pages}`),
          h('button', { type: 'button', class: 'chip', disabled: page >= pages - 1, onclick: () => { page += 1; renderPalette(); } }, '›')) : null);
    }

    function renderTabs() {
      const chairs = Object.entries(OBJECTS).filter(([, d]) => d.sit && !d.functional && !d.flat);
      const desks = Object.entries(OBJECTS).filter(([, d]) => d.desk && !d.functional);
      fill(tabs,
        h('button', { type: 'button', class: layer === 'top' ? 'on' : '', onclick: () => { layer = 'top'; pick = null; renderTabs(); renderPalette(); } }, 'Em cima da mesa'),
        h('button', { type: 'button', class: layer === 'around' ? 'on' : '', onclick: () => { layer = 'around'; pick = null; renderTabs(); renderPalette(); } }, 'Em volta'),
        h('button', { type: 'button', class: layer === 'chair' ? 'on' : '', onclick: () => {
          layer = 'chair';
          renderTabs();
          fill(palette, h('div', { class: 'palette' },
            h('button', { type: 'button', class: `pal-item ${!chair ? 'on' : ''}`, onclick: () => { chair = ''; tabs.querySelector('.on').click(); } }, h('span', {}, 'Cadeira padrão')),
            chairs.map(([type, d]) => h('button', { type: 'button', class: `pal-item ${chair === type ? 'on' : ''}`, title: d.name, onclick: () => { chair = type; tabs.querySelector('.on').click(); } }, objectThumb(type, 40), h('span', {}, d.name)))));
        } }, 'Cadeira'),
        h('button', { type: 'button', class: layer === 'desk' ? 'on' : '', onclick: () => {
          layer = 'desk';
          renderTabs();
          const cur = deskSkin && OBJECTS[deskSkin];
          fill(palette,
            h('div', { class: 'palette' },
              h('button', { type: 'button', class: `pal-item ${!deskSkin ? 'on' : ''}`, onclick: () => { deskSkin = ''; deskColor = ''; tabs.querySelector('.on').click(); } }, objectThumb(desk.type, 40), h('span', {}, 'Mesa padrão')),
              desks.map(([type, d]) => h('button', { type: 'button', class: `pal-item ${deskSkin === type ? 'on' : ''}`, title: d.name, onclick: () => { deskSkin = type; deskColor = d.variants ? Object.keys(d.variants)[0] : ''; tabs.querySelector('.on').click(); } }, objectThumb(type, 40), h('span', {}, d.name)))),
            cur && cur.variants ? h('div', {}, h('div', { class: 'opt-label' }, 'Cor da mesa'),
              h('div', { class: 'chips' }, Object.keys(cur.variants).map((c) => {
                const sw = (CAT.deskColors || []).find((x) => x.id === c);
                return h('button', { type: 'button', class: `chip ${deskColor === c ? 'on' : ''}`, onclick: () => { deskColor = c; tabs.querySelector('.on').click(); } },
                  sw ? h('img', { src: url(sw.s), alt: '', class: 'swatch-img' }) : null, (sw && sw.name) || c);
              }))) : h('p', { class: 'muted small' }, 'As mesas da linha nobre têm 8 cores. Para os itens, use os controles de cor (matiz, saturação e brilho).'));
        } }, 'Modelo e cor da mesa'));
    }

    const content = h('div', { class: 'decorator' },
      h('div', { class: 'decor-left' }, canvas, h('div', { class: 'decor-foot' }, counter, h('span', { class: 'muted small' }, ' · arraste para mover · botão direito remove')), props),
      h('div', { class: 'decor-right' }, tabs, palette));

    const m = openModal({
      title: '🎨 Decorar minha mesa',
      content,
      className: 'modal-xl',
      footer: [
        h('button', { type: 'button', class: 'btn-secondary', onclick: () => { decor = []; sel = -1; renderProps(); } }, 'Limpar tudo'),
        h('button', { type: 'button', class: 'btn-primary', onclick: async () => {
          if (await this.save(desk, { decor, chair, deskSkin, deskColor })) { toast('Mesa decorada!', 'ok', 1800); m.close(); }
        } }, 'Salvar decoração'),
      ],
      onClose: () => cancelAnimationFrame(raf),
    });
    renderTabs();
    renderPalette();
    renderProps();
    raf = requestAnimationFrame(draw);
    return m;
  }
}

export { onAssetLoad, drawFrame };
