// Importação de imagens, como no Gather:
// • Objeto próprio: a imagem é redimensionada (sem borrar) para caber em N×M tiles de 32 px
//   e vira um objeto no catálogo ("Meus objetos"), com colisão e ação opcionais.
// • Fundo: uma imagem inteira do mapa (feita no Tiled, Icograms, Aseprite…) por baixo de tudo;
//   depois é só pintar os efeitos (intransitável, privada, portal…) por cima.
// • Frente: imagem que fica por cima do avatar (telhados, copas, letreiros).
// • Exportar: baixa o fundo atual em PNG na grade de 32 px para editar fora e reimportar.
import { h, fill, toast, uid } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';
import { CAT, TILE, onAssetLoad } from '../art/assets.js';
import { OBJECTS, objectThumb } from '../art/objects.js';
import { paintFloor, paintWall, FLOORS } from '../art/tiles.js';

/** Cria os tipos "c:<id>" no catálogo a partir das linhas de custom_objects. */
export function registerCustomObjects(rows = []) {
  for (const r of rows) addCustomType(r);
}

export function addCustomType(r) {
  if (!CAT) return null;
  let sid = CAT.sheets.indexOf(r.url);
  if (sid < 0) { CAT.sheets.push(r.url); sid = CAT.sheets.length - 1; }
  const pw = r.px_w || r.w * TILE;
  const ph = r.px_h || r.h * TILE;
  const type = `c:${r.id}`;
  const skin = { id: type, name: r.name, cat: 'Meus objetos', s: sid, f: [0, 0, pw, ph], sc: 1, w: r.w, h: r.h, custom: true };
  OBJECTS[type] = {
    name: r.name, cat: 'Meus objetos', w: r.w, h: r.layer === 'flat' ? r.h : Math.max(1, Math.min(r.h, Math.ceil(r.h / 2))),
    skin, solid: !!r.solid && r.layer === 'object', flat: r.layer === 'flat', walk: r.layer === 'flat', wall: r.layer === 'wall',
    interact: 'examine', label: 'examinar', custom: true, face: 0, __type: type,
  };
  if (r.action && r.action.type) OBJECTS[type].defaultAction = r.action;
  return type;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não consegui abrir a imagem.'));
    img.src = url;
  });
}

/** Redimensiona sem borrar (pixel art) para w×h tiles, mantendo a proporção e alinhando embaixo/centro. */
function fitToGrid(img, wTiles, hTiles) {
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  const k = Math.min(W / img.naturalWidth, H / img.naturalHeight);
  // escala inteira quando ampliar (pixel perfeito); fracionária só para reduzir
  const kk = k >= 1 ? Math.max(1, Math.floor(k)) : k;
  const dw = Math.round(img.naturalWidth * kk);
  const dh = Math.round(img.naturalHeight * kk);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = kk < 1;
  ctx.drawImage(img, Math.round((W - dw) / 2), H - dh, dw, dh);
  return c;
}

const toBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));

export class Imports {
  constructor(app) {
    this.app = app;
  }

  panel() {
    const app = this.app;
    const box = h('div', { class: 'imports' });
    const mine = Object.entries(OBJECTS).filter(([t]) => t.startsWith('c:'));
    fill(box,
      h('div', { class: 'opt-label' }, 'Objeto próprio'),
      h('p', { class: 'muted small' }, 'Logos, letreiros, móveis sob medida. A imagem é ajustada à grade de 32 px.'),
      h('button', { class: 'btn-secondary small', onclick: () => this.importObject() }, '⬆ Enviar imagem de objeto'),
      mine.length ? h('div', { class: 'palette' }, mine.map(([t, d]) => h('button', { type: 'button', class: 'pal-item', title: d.name, onclick: () => {
        Object.assign(app.build, { tab: 'objects', tool: 'place', item: t });
        app.inventory.assign(t);
        app.buildPanel.render();
      } }, objectThumb(t, 46), h('span', {}, d.name)))) : null,
      h('div', { class: 'opt-label' }, 'Fundo do mapa (background)'),
      h('p', { class: 'muted small' }, 'Imagem inteira do mapa, desenhada fora (Tiled, Icograms, Aseprite). Use múltiplos de 32 px. Depois pinte os efeitos por cima.'),
      h('div', { class: 'chips' },
        h('button', { class: 'chip', onclick: () => this.importMapImage('bg') }, '⬆ Enviar fundo'),
        app.world.map.bg ? h('button', { class: 'chip danger', onclick: () => app.edit([{ t: 'image', which: 'bg', value: null }]) }, 'Tirar fundo') : null,
        h('button', { class: 'chip', onclick: () => this.exportBackground() }, '⬇ Baixar fundo atual (PNG)')),
      h('div', { class: 'opt-label' }, 'Frente (foreground)'),
      h('p', { class: 'muted small' }, 'Imagem transparente que fica por cima dos avatares (telhados, copas de árvore, arcos).'),
      h('div', { class: 'chips' },
        h('button', { class: 'chip', onclick: () => this.importMapImage('fgImg') }, '⬆ Enviar frente'),
        app.world.map.fgImg ? h('button', { class: 'chip danger', onclick: () => app.edit([{ t: 'image', which: 'fgImg', value: null }]) }, 'Tirar frente') : null));
    return box;
  }

  async pick(accept = 'image/png,image/gif,image/webp,image/jpeg') {
    return new Promise((resolve) => {
      const inp = h('input', { type: 'file', accept });
      inp.addEventListener('change', () => resolve(inp.files[0] || null));
      inp.click();
    });
  }

  async importObject() {
    const app = this.app;
    const file = await this.pick();
    if (!file) return;
    let img;
    try { img = await readImage(file); } catch (e) { return toast(e.message, 'error'); }
    const name = h('input', { type: 'text', maxlength: 40, value: file.name.replace(/\.[^.]+$/, '') });
    const w = h('input', { type: 'number', min: 1, max: 20, value: Math.max(1, Math.round(img.naturalWidth / TILE)) });
    const hh = h('input', { type: 'number', min: 1, max: 20, value: Math.max(1, Math.round(img.naturalHeight / TILE)) });
    const layer = h('select', {}, h('option', { value: 'object' }, 'Objeto (fica em pé, ordenado com os avatares)'), h('option', { value: 'flat' }, 'No chão (tapete, piso decorado)'), h('option', { value: 'wall' }, 'Na parede (quadro, letreiro)'));
    const solid = h('input', { type: 'checkbox', checked: true });
    const prev = h('canvas', { class: 'import-prev' });
    const redraw = () => {
      const c = fitToGrid(img, Number(w.value) || 1, Number(hh.value) || 1);
      prev.width = c.width; prev.height = c.height;
      const ctx = prev.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(c, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      for (let x = 0; x <= c.width; x += TILE) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, c.height); ctx.stroke(); }
      for (let y = 0; y <= c.height; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(c.width, y + 0.5); ctx.stroke(); }
    };
    w.addEventListener('input', redraw);
    hh.addEventListener('input', redraw);
    redraw();
    const m = openModal({
      title: 'Importar objeto', className: 'modal-wide',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Nome', name),
        h('div', { class: 'row-input' }, h('label', {}, 'Largura (tiles)', w), h('label', {}, 'Altura (tiles)', hh)),
        h('label', {}, 'Camada', layer), h('label', { class: 'check' }, solid, ' Bloqueia a passagem'),
        h('p', { class: 'muted small' }, `Original: ${img.naturalWidth}×${img.naturalHeight} px → ${Number(w.value) * TILE}×${Number(hh.value) * TILE} px (grade de 32).`),
        h('div', { class: 'import-prev-box' }, prev)),
      footer: [h('button', { class: 'btn-primary', onclick: async () => {
        try {
          const W = Math.max(1, Math.min(20, Number(w.value) || 1));
          const H = Math.max(1, Math.min(20, Number(hh.value) || 1));
          const blob = await toBlob(fitToGrid(img, W, H));
          const url = await app.backend.uploadMapAsset(blob, `${name.value || 'objeto'}.png`);
          const row = await app.backend.addCustomObject({ id: uid('c'), name: name.value.trim() || 'Objeto', url, w: W, h: H, px_w: W * TILE, px_h: H * TILE, solid: solid.checked, layer: layer.value });
          const type = addCustomType(row);
          app.room.send('custom', row);
          app.inventory.assign(type);
          Object.assign(app.build, { tab: 'objects', tool: 'place', item: type });
          app.buildPanel.render();
          toast('Objeto importado! Ele está na hotbar e em "Meus objetos".', 'ok', 3000);
          m.close();
        } catch (e) { toast(e.message, 'error', 5000); }
      } }, 'Importar')],
    });
  }

  async importMapImage(which) {
    const app = this.app;
    const file = await this.pick();
    if (!file) return;
    let img;
    try { img = await readImage(file); } catch (e) { return toast(e.message, 'error'); }
    const W = app.world.width * TILE;
    const H = app.world.height * TILE;
    const okGrid = img.naturalWidth % TILE === 0 && img.naturalHeight % TILE === 0;
    const clear = h('input', { type: 'checkbox', checked: which === 'bg' });
    const scale = h('select', {}, h('option', { value: '1' }, '1× (cada 32 px da imagem = 1 tile)'), h('option', { value: '2' }, '2× (imagem em 16 px por tile)'), h('option', { value: 'fit' }, 'Esticar para o mapa inteiro'));
    const m = openModal({
      title: which === 'bg' ? 'Importar fundo do mapa' : 'Importar frente do mapa',
      content: h('div', { class: 'form-stack' },
        h('p', {}, `Imagem: ${img.naturalWidth}×${img.naturalHeight} px. Mapa: ${W}×${H} px (${app.world.width}×${app.world.height} tiles).`),
        okGrid ? null : h('p', { class: 'form-error' }, 'Atenção: o tamanho não é múltiplo de 32 px; o alinhamento com a grade pode ficar torto.'),
        h('label', {}, 'Escala', scale),
        which === 'bg' ? h('label', { class: 'check' }, clear, ' Deixar o piso transparente onde a imagem cobre (as paredes viram intransitáveis)') : null),
      footer: [h('button', { class: 'btn-primary', onclick: async () => {
        try {
          const k = scale.value === 'fit' ? null : Number(scale.value);
          const dw = k ? img.naturalWidth * k : W;
          const dh = k ? img.naturalHeight * k : H;
          const url = await app.backend.uploadMapAsset(file, file.name);
          const ops = [{ t: 'image', which, value: { url, w: dw, h: dh } }];
          if (which === 'bg' && clear.checked) {
            const cells = [];
            const fx = [];
            for (let y = 0; y < Math.min(app.world.height, Math.ceil(dh / TILE)); y++) {
              for (let x = 0; x < Math.min(app.world.width, Math.ceil(dw / TILE)); x++) {
                if (app.world.isWall(x, y)) fx.push([x, y, 'x']);
                cells.push([x, y, 'none']);
              }
            }
            ops.push({ t: 'floor', cells });
            if (fx.length) ops.push({ t: 'layer', layer: 'fx', cells: fx });
          }
          app.edit(ops);
          toast('Imagem aplicada. Use a aba Efeitos para marcar paredes, áreas privadas e portais.', 'ok', 4000);
          m.close();
        } catch (e) { toast(e.message, 'error', 5000); }
      } }, 'Aplicar')],
    });
  }

  /** Baixa o fundo atual (pisos + paredes + objetos de chão) como PNG, na grade de 32. */
  exportBackground() {
    const w = this.app.world;
    const c = document.createElement('canvas');
    c.width = w.width * TILE;
    c.height = w.height * TILE;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const paint = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) {
        const t = w.floorAt(x, y);
        if (FLOORS[t] && FLOORS[t].wall) paintWall(ctx, t, x, y, !w.isWall(x, y + 1)); else paintFloor(ctx, t, x, y);
      }
    };
    paint();
    setTimeout(() => {
      paint();
      c.toBlob((b) => {
        const a = h('a', { href: URL.createObjectURL(b), download: 'pixeloffice-fundo-32px.png' });
        document.body.append(a);
        a.click();
        a.remove();
      });
    }, 600);
    onAssetLoad(() => {});
  }
}

export { confirmBox };
