// Mesas pessoais: cada pessoa reivindica uma mesa (com a área em volta) e decora
// livremente — objetos em cima e ao redor, adesivos de apps, cores de cada item,
// modelo/cor da mesa e a cadeira. Também dá para ligar para alguém a partir da mesa.
import { h, fill, toast } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { CAT, IDX, TILE, drawFrame, image, onAssetLoad, frameCanvas, url } from '../art/assets.js';
import { OBJECTS, drawObjectSprite, objectThumb } from '../art/objects.js';
import { paintFloor, paintWall, FLOORS } from '../art/tiles.js';
import { SLOTS, MAX_SLOTS, PCS, deskMeta, slotItems, drawDeskSet, drawPc } from './deskSlots.js';


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

  // ------------------------------------------------------------------ editor da mesa (slots)
  openDecorator(desk = this.myDesk) {
    const app = this.app;
    if (!desk) {
      toast('Você ainda não tem mesa. Vá até uma mesa livre no Escritório e reivindique.', 'warn', 4000);
      return null;
    }
    const zone = this.zoneOf(desk);
    const meta0 = deskMeta(desk);
    const items = Array(MAX_SLOTS).fill(null);
    for (const d of slotItems(desk)) items[d.slot] = { ...d };
    let pc = meta0.pc;
    let priv = meta0.private;
    let chair = (desk.data && desk.data.chair) || '';
    let deskSkin = (desk.data && desk.data.deskSkin) || '';
    let tab = 'itens';
    let cat = 'Tudo';
    let sel = items.findIndex((x) => !x);
    if (sel < 0) sel = 0;
    let raf = 0;

    const SC = 4;
    const W = zone.w * TILE;
    const H = zone.h * TILE;
    const canvas = h('canvas', { class: 'decor-canvas', width: W * SC, height: H * SC });
    const ctx = canvas.getContext('2d');
    const deskX = (desk.x - zone.x) * TILE;
    const deskY = (desk.y - zone.y) * TILE;
    const ddef = OBJECTS[desk.type];
    const right = h('div', { class: 'decor-palette' });
    const props = h('div', { class: 'decor-props' });
    const tabs = h('div', { class: 'seg seg-wide' });
    const slotBar = h('div', { class: 'chips slot-bar' });

    const decorList = () => [{ meta: 1, pc, private: priv }, ...items.map((d, i) => (d ? { ...d, slot: i } : null)).filter(Boolean)];
    const tmpDesk = () => ({ ...desk, data: { ...(desk.data || {}), decor: decorList() } });
    const deskType = () => (deskSkin && OBJECTS[deskSkin] ? deskSkin : desk.type);

    const draw = (t) => {
      const tt = t / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(SC, SC);
      for (let y = 0; y < zone.h; y++) for (let x = 0; x < zone.w; x++) {
        const ft = app.world.floorAt(zone.x + x, zone.y + y);
        if (FLOORS[ft] && FLOORS[ft].wall) paintWall(ctx, ft, x, y, true); else paintFloor(ctx, ft, x, y);
      }
      ctx.restore();
      const dt = deskType();
      const others = app.world.objects.filter((o) => o !== desk && OBJECTS[o.type] && OBJECTS[o.type].sit && o.x >= zone.x && o.y >= zone.y && o.x < zone.x + zone.w && o.y < zone.y + zone.h);
      drawObjectSprite(ctx, { ...desk, x: 0, y: 0, type: dt, data: {} }, OBJECTS[dt], deskX * SC, deskY * SC, SC, tt);
      drawDeskSet(ctx, tmpDesk(), ddef, deskX * SC, deskY * SC, SC, tt);
      for (const o of others) {
        const ov = chair && OBJECTS[chair] ? { ...o, type: chair } : o;
        drawObjectSprite(ctx, ov, OBJECTS[ov.type], (o.x - zone.x) * TILE * SC, (o.y - zone.y) * TILE * SC, SC, tt, 0.55);
      }
      // contorno dos espaços
      const cx = (deskX + (ddef.w * TILE) / 2) * SC;
      const by = (deskY + ddef.h * TILE - 2) * SC;
      if (tab === 'itens') {
        SLOTS.forEach(([dx, dy, mw, mh], i) => {
          const x = cx + (dx - mw / 2) * SC;
          const y = by + (dy - mh) * SC;
          ctx.setLineDash(i === sel ? [] : [3, 3]);
          ctx.lineWidth = i === sel ? 3 : 1.5;
          ctx.strokeStyle = i === sel ? '#ffd84d' : items[i] ? 'rgba(255,255,255,.35)' : 'rgba(155,232,255,.8)';
          ctx.strokeRect(x, y, mw * SC, mh * SC);
          ctx.setLineDash([]);
          ctx.fillStyle = i === sel ? '#ffd84d' : 'rgba(20,16,40,.75)';
          ctx.fillRect(x - 2, y - 14, 14, 13);
          ctx.fillStyle = i === sel ? '#1a1626' : '#fff';
          ctx.font = '700 11px monospace';
          ctx.fillText(String(i + 1), x + 1, y - 3);
        });
      }
      raf = requestAnimationFrame(draw);
    };

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      const cx = deskX + (ddef.w * TILE) / 2;
      const by = deskY + ddef.h * TILE - 2;
      // o menor espaço que contém o clique
      let best = -1; let area = 1e9;
      SLOTS.forEach(([dx, dy, mw, mh], i) => {
        const x = cx + dx - mw / 2 - 1; const y = by + dy - mh - 1;
        if (p.x >= x && p.x <= x + mw + 2 && p.y >= y && p.y <= y + mh + 2 && mw * mh < area) { best = i; area = mw * mh; }
      });
      if (best < 0) return;
      if (e.button === 2) { items[best] = null; }
      sel = best;
      tab = 'itens';
      render();
    });

    const slider = (label, key, min, max, def, unit = '', mul = 1) => {
      const d = items[sel];
      const val = Math.round((d[key] ?? def) * mul);
      const out = h('span', { class: 'muted small' }, `${val}${unit}`);
      return h('label', { class: 'slider-row' }, label,
        h('input', { type: 'range', min, max, value: val, oninput: (e) => { d[key] = Number(e.target.value) / mul; out.textContent = `${e.target.value}${unit}`; } }), out);
    };

    const ITEM_CATS = ['Tudo', 'Itens de mesa LPC', 'Itens de mesa', 'Itens', 'Itens pequenos', 'Plantas', 'Mágico', 'Tesouros', 'Cozinha', 'Pets'];
    const itemOk = (d) => d.small && d.interact !== 'screen' && !d.functional && !d.flat && !d.desk && !d.sit && d.skin && ITEM_CATS.includes(d.cat);

    function renderSlots() {
      fill(slotBar, SLOTS.map(([, , , , nm], i) => h('button', { type: 'button', class: `chip ${i === sel && tab === 'itens' ? 'on' : ''}`, title: nm,
        onclick: () => { sel = i; tab = 'itens'; render(); } },
      items[i] ? objectThumb(items[i].p, 18) : h('span', { class: 'muted' }, '＋'), ` ${i + 1}`)),
      h('span', { class: 'muted small' }, `${items.filter(Boolean).length}/${MAX_SLOTS} espaços`));
    }

    function renderProps() {
      const d = items[sel];
      if (tab !== 'itens') { fill(props); return; }
      if (!d) {
        fill(props, h('p', { class: 'muted small' }, `Espaço ${sel + 1} — ${SLOTS[sel][4]}: escolha um item na lista ao lado. Cada item é ajustado para caber no espaço, na escala da mesa.`));
        return;
      }
      const def = OBJECTS[d.p];
      fill(props,
        h('div', { class: 'opt-label' }, `Espaço ${sel + 1}: ${def ? def.name : 'Item'}`),
        slider('Cor (matiz)', 'hue', 0, 360, 0, '°'),
        slider('Saturação', 'sat', 0, 200, 100, '%'),
        slider('Brilho', 'bri', 40, 160, 100, '%'),
        slider('Tamanho', 'k', 60, 100, 1, '%', 100),
        def && def.variants ? h('label', { class: 'slider-row' }, 'Variação', h('select', { onchange: (e) => { d.color = e.target.value; } }, Object.keys(def.variants).map((c) => h('option', { value: c, selected: d.color === c }, c)))) : null,
        h('div', { class: 'chips' },
          h('button', { type: 'button', class: 'chip', onclick: () => { d.flip = !d.flip; } }, '↔ Espelhar'),
          h('button', { type: 'button', class: 'chip danger', onclick: () => { items[sel] = null; render(); } }, 'Esvaziar espaço')));
    }

    const pal = (list, isOn, onPick, thumb = (k) => objectThumb(k, 40)) => h('div', { class: 'palette' },
      list.map(([key, name]) => h('button', { type: 'button', class: `pal-item ${isOn(key) ? 'on' : ''}`, title: name, onclick: () => { onPick(key); render(); } }, thumb(key), h('span', {}, name))));

    function renderRight() {
      if (tab === 'itens') {
        const all = Object.entries(OBJECTS).filter(([, d]) => itemOk(d) && (cat === 'Tudo' || d.cat === cat));
        all.sort((a, b) => (a[1].cat === 'Itens de mesa LPC' ? 0 : 1) - (b[1].cat === 'Itens de mesa LPC' ? 0 : 1));
        fill(right,
          h('div', { class: 'chips' }, ITEM_CATS.map((c) => h('button', { type: 'button', class: `chip ${cat === c ? 'on' : ''}`, onclick: () => { cat = c; renderRight(); } }, c))),
          pal(all.slice(0, 160).map(([k, d]) => [k, d.name]), (k) => items[sel] && items[sel].p === k, (k) => {
            const d = OBJECTS[k];
            items[sel] = { p: k, ...(d.variants ? { color: Object.keys(d.variants)[0] } : {}) };
            // avança para o próximo espaço vazio
            const nx = items.findIndex((x, i) => !x && i > sel);
            if (nx >= 0) sel = nx;
          }));
      } else if (tab === 'pc') {
        fill(right, h('p', { class: 'muted small' }, 'O computador fica no centro da mesa, com teclado e mouse.'),
          pal(Object.entries(PCS), (k) => pc === k, (k) => { pc = k; }, (k) => pcThumb(k)));
      } else if (tab === 'cadeira') {
        const chairs = Object.entries(OBJECTS).filter(([, d]) => d.sit && d.rot && d.rot.n && d.w === 1 && !d.functional && !d.flat).map(([k, d]) => [k, d.name]);
        fill(right, h('p', { class: 'muted small' }, 'A cadeira fica virada para a mesa.'),
          pal([['', 'Cadeira padrão'], ...chairs], (k) => chair === k, (k) => { chair = k; }, (k) => objectThumb(k || 'chair', 40)));
      } else if (tab === 'mesa') {
        const desks = Object.entries(OBJECTS).filter(([k, d]) => d.desk && !d.functional && k.startsWith('lpc-')).map(([k, d]) => [k, d.name]);
        fill(right, pal([['', 'Mesa padrão'], ...desks], (k) => deskSkin === k, (k) => { deskSkin = k; }, (k) => objectThumb(k || desk.type, 40)));
      } else if (tab === 'priv') {
        fill(right,
          h('p', {}, 'Com a mesa privada, quem entra na área destacada da sua mesa fala só com quem está nela (áudio e vídeo), como numa cabine.'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', class: priv ? 'on' : '', onclick: () => { priv = true; render(); } }, '🔒 Mesa privada'),
            h('button', { type: 'button', class: priv ? '' : 'on', onclick: () => { priv = false; render(); } }, '🔓 Aberta')));
      }
    }

    function renderTabs() {
      const T = [['itens', '🧸 Itens (7)'], ['pc', '🖥️ Computador'], ['cadeira', '🪑 Cadeira'], ['mesa', '🗄️ Mesa'], ['priv', priv ? '🔒 Privada' : '🔓 Aberta']];
      fill(tabs, T.map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', onclick: () => { tab = k; render(); } }, l)));
    }

    function render() { renderTabs(); renderSlots(); renderProps(); renderRight(); }

    const content = h('div', { class: 'decorator' },
      h('div', { class: 'decor-left' }, canvas, slotBar, h('div', { class: 'decor-foot' }, h('span', { class: 'muted small' }, 'Clique num espaço numerado para escolher · botão direito esvazia')), props),
      h('div', { class: 'decor-right' }, tabs, right));

    const m = openModal({
      title: '🎨 Minha mesa',
      content,
      className: 'modal-xl',
      footer: [
        h('button', { type: 'button', class: 'btn-secondary', onclick: () => { items.fill(null); sel = 0; render(); } }, 'Esvaziar tudo'),
        h('button', { type: 'button', class: 'btn-primary', onclick: async () => {
          if (await this.save(desk, { decor: decorList(), chair, deskSkin, deskColor: '', private: priv })) { toast('Mesa salva!', 'ok', 1800); m.close(); }
        } }, 'Salvar mesa'),
      ],
      onClose: () => cancelAnimationFrame(raf),
    });
    render();
    raf = requestAnimationFrame(draw);
    return m;
  }
}

/** Miniatura de um computador. */
function pcThumb(k) {
  const c = h('canvas', { width: 40, height: 40 });
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  drawPc(x, k, 20, 40 + 18 * 1, 1, 0);
  if (k === 'nenhum') { x.fillStyle = '#ff5d73'; x.font = '20px sans-serif'; x.fillText('∅', 13, 27); }
  c.style.imageRendering = 'pixelated';
  return c;
}

export { onAssetLoad, drawFrame };
