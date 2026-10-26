// Painel de qualquer objeto: examinar, girar (todos os ângulos), espelhar, mover para o
// inventário, remover e configurar uma ação própria (site, vídeo, texto, imagem, nota, link).
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { ICONS } from '../ui/icons.js';
import { OBJECTS, rotOf, dims, drawObjectSprite } from '../art/objects.js';
import { TILE, onAssetLoad } from '../art/assets.js';
import { toEmbedUrl } from './docs.js';

export const ACTIONS = [
  ['', 'Padrão do objeto'],
  ['site', 'Abrir site incorporado (Docs, Figma, Miro, Spotify…)'],
  ['video', 'Tocar vídeo (YouTube, Vimeo)'],
  ['text', 'Mostrar um texto'],
  ['image', 'Mostrar uma imagem'],
  ['link', 'Abrir link em nova aba'],
  ['note', 'Bloco de notas compartilhado'],
];

const ANGLES = [[0, '↓'], [45, '↙'], [90, '←'], [135, '↖'], [180, '↑'], [225, '↗'], [270, '→'], [315, '↘']];

/** Pode mexer neste objeto? Editores, ou quem colocou (na própria mesa). */
export function canManage(app, o) {
  return !!(app.canEdit || (o.data && o.data.placed_by && o.data.placed_by === app.user.id));
}

/** Gira um objeto (graus, horário a partir de "para baixo"). */
export function rotateObject(app, o, angle) {
  const def = OBJECTS[o.type];
  const rot = ((Math.round(angle) % 360) + 360) % 360;
  const before = dims(o, def);
  const after = dims({ ...o, rot }, def);
  // mantém o centro no lugar quando a área muda de tamanho
  const x = o.x + Math.round((before.w - after.w) / 2);
  const y = o.y + Math.round((before.h - after.h) / 2);
  app.edit([{ t: 'move', id: o.id, rot, x, y }]);
}

export function runCustomAction(app, o, def) {
  const a = (o.data && o.data.action) || def.defaultAction;
  if (!a || !a.type) return false;
  const title = a.title || def.name;
  switch (a.type) {
    case 'site':
    case 'video': {
      const src = a.type === 'video' ? toEmbedUrl(a.url) : a.url;
      openModal({ title, className: 'modal-xl', content: h('div', { class: 'embed-box tall' }, h('iframe', { src, allow: 'autoplay; encrypted-media; fullscreen; clipboard-write', allowfullscreen: true })),
        footer: [h('a', { class: 'btn-secondary', href: a.url, target: '_blank', rel: 'noopener' }, 'Abrir no navegador')] });
      return true;
    }
    case 'text':
      openModal({ title, content: h('p', { class: 'inspect-text' }, a.text || '') });
      return true;
    case 'image':
      openModal({ title, className: 'modal-wide', content: h('img', { src: a.url, alt: title, class: 'meet-preview' }) });
      return true;
    case 'link':
      window.open(a.url, '_blank', 'noopener');
      return true;
    case 'note':
      app.docs.openStash(o);
      return true;
    default:
      return false;
  }
}

function bigPreview(o, def) {
  const c = h('canvas', { width: 220, height: 180, class: 'obj-preview' });
  const paint = () => {
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const dm = dims(o, def);
    const k = Math.min(180 / (dm.w * TILE), 120 / (dm.h * TILE), 3);
    drawObjectSprite(ctx, { ...o, x: 0, y: 0 }, def, (c.width - dm.w * TILE * k) / 2, c.height - 20 - dm.h * TILE * k, k, performance.now() / 1000);
  };
  paint();
  const off = onAssetLoad(paint);
  setTimeout(off, 5000);
  return c;
}

export function configureAction(app, o, after) {
  const def = OBJECTS[o.type];
  const cur = (o.data && o.data.action) || {};
  const type = h('select', {}, ACTIONS.map(([v, l]) => h('option', { value: v, selected: (cur.type || '') === v }, l)));
  const title = h('input', { type: 'text', maxlength: 60, placeholder: def.name, value: cur.title || '' });
  const url = h('input', { type: 'url', placeholder: 'https://…', value: cur.url || '' });
  const text = h('textarea', { rows: 4, maxlength: 2000, placeholder: 'Texto exibido ao interagir' }, cur.text || '');
  const rowsFor = () => {
    const t = type.value;
    url.parentElement.hidden = !['site', 'video', 'image', 'link'].includes(t);
    text.parentElement.hidden = t !== 'text';
  };
  type.addEventListener('change', rowsFor);
  const m = openModal({
    title: `Ação de "${def.name}"`,
    content: h('div', { class: 'form-stack' }, h('label', {}, 'Ao apertar X', type), h('label', {}, 'Título', title), h('label', {}, 'Link', url), h('label', {}, 'Texto', text),
      h('p', { class: 'muted small' }, 'Como no Gather: qualquer objeto pode abrir um site incorporado, um vídeo, um texto ou uma imagem quando alguém chega perto e aperta X.')),
    footer: [h('button', { class: 'btn-primary', onclick: () => {
      const t = type.value;
      if (['site', 'video', 'image', 'link'].includes(t) && !/^https?:\/\//.test(url.value.trim())) return toast('Informe um link começando com https://', 'warn');
      const data = { ...(o.data || {}) };
      if (!t) delete data.action;
      else data.action = { type: t, title: title.value.trim(), url: url.value.trim(), text: text.value.trim() };
      app.edit([{ t: 'data', id: o.id, data }]);
      m.close();
      toast('Ação salva.', 'ok', 1500);
      if (after) after();
    } }, 'Salvar')],
  });
  rowsFor();
}

/** Painel do objeto (botão direito em qualquer móvel, ou "Examinar"). */
export function openObjectPanel(app, o) {
  const def = OBJECTS[o.type];
  if (!def) return;
  const manage = canManage(app, o);
  const body = h('div', { class: 'obj-panel' });
  const m = openModal({ title: def.name, content: body, className: 'modal-wide' });
  const paint = () => {
    const rot = rotOf(o, def);
    const text = (o.data && (o.data.text || (o.data.action && o.data.action.text))) || def.desc || '';
    fill(body,
      h('div', { class: 'obj-head' }, bigPreview(o, def),
        h('div', { class: 'obj-info' },
          h('strong', {}, def.name), h('span', { class: 'muted small' }, def.cat),
          text ? h('p', {}, text) : null,
          h('p', { class: 'muted small' }, `X: ${def.label || 'interagir'}${o.data && o.data.action && o.data.action.type ? ` · ação própria: ${ACTIONS.find(([v]) => v === o.data.action.type)[1]}` : ''}`),
          h('div', { class: 'chips' },
            h('button', { class: 'chip', onclick: () => { m.close(); app.interact(o, true); } }, `▶ ${def.label || 'usar'}`)))),
      manage ? [
        h('div', { class: 'opt-label' }, `Rotação: ${rot}°`),
        h('div', { class: 'chips rot-chips' },
          ANGLES.map(([a, l]) => h('button', { class: `chip ${rot === a ? 'on' : ''}`, title: `${a}°`, onclick: () => { rotateObject(app, o, a); setTimeout(paint, 30); } }, l)),
          h('button', { class: 'chip', title: '−15°', onclick: () => { rotateObject(app, o, rot - 15); setTimeout(paint, 30); } }, '⟲ 15°'),
          h('button', { class: 'chip', title: '+15°', onclick: () => { rotateObject(app, o, rot + 15); setTimeout(paint, 30); } }, '⟳ 15°'),
          h('label', { class: 'slider-row rot-slider' }, 'Livre', h('input', { type: 'range', min: 0, max: 359, value: rot, onchange: (e) => { rotateObject(app, o, Number(e.target.value)); setTimeout(paint, 30); } }))),
        h('div', { class: 'chips' },
          h('button', { class: 'chip', onclick: () => { app.edit([{ t: 'move', id: o.id, flip: !o.flip }]); setTimeout(paint, 30); } }, '↔ Espelhar'),
          h('button', { class: 'chip', onclick: () => configureAction(app, o, paint) }, h('span', { html: ICONS.link }), 'Configurar ação'),
          app.canEdit ? h('span', { class: 'nudge' }, 'Alinhar ½:',
            ...[['←', -16, 0], ['→', 16, 0], ['↑', 0, -16], ['↓', 0, 16], ['⊙', 0, 0]].map(([l, dx, dy]) => h('button', { class: 'chip', onclick: () => {
              const d = { ...(o.data || {}) };
              if (!dx && !dy) { delete d.ox; delete d.oy; } else { d.ox = Math.max(-16, Math.min(16, (d.ox || 0) + dx)); d.oy = Math.max(-16, Math.min(16, (d.oy || 0) + dy)); }
              app.edit([{ t: 'data', id: o.id, data: d }]);
            } }, l))) : null,
          !def.npc ? h('button', { class: 'chip', onclick: async () => { m.close(); await app.inventory.pickup(o); } }, '🎒 Guardar no inventário') : null,
          app.canEdit ? h('button', { class: 'chip danger', onclick: () => { m.close(); app.edit([{ t: 'del', id: o.id }]); } }, h('span', { html: ICONS.trash }), 'Remover')
            : null),
      ] : h('p', { class: 'muted small' }, 'Só editores (ou quem colocou este item na própria mesa) podem girar ou mover.'));
  };
  paint();
}
