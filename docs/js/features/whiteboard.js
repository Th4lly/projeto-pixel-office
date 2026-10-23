// Quadro branco colaborativo (desenho em tempo real) + aba para incorporar um Miro / FigJam / link.
import { h, toast, uid, fill } from '../ui/dom.js';
import { openModal, confirmBox } from '../ui/modal.js';

const W = 1000;
const H = 600;
const COLORS = ['#1f1f2b', '#d64545', '#3f5aa8', '#3f8a5c', '#e3a12f', '#6e4aa0'];

function toEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('miro.com') && !u.pathname.includes('live-embed')) {
      const m = u.pathname.match(/\/app\/board\/([^/]+)/);
      if (m) return `https://miro.com/app/live-embed/${m[1]}/?embedMode=view_only_without_ui`;
    }
    if (u.hostname.includes('figma.com') && !u.hostname.startsWith('embed')) return `https://www.figma.com/embed?embed_host=pixeloffice&url=${encodeURIComponent(url)}`;
    return url;
  } catch {
    return '';
  }
}

export class Whiteboards {
  constructor(app) {
    this.app = app;
    this.current = null;
  }

  async open(o) {
    const app = this.app;
    const doc = await app.backend.getDoc(o.id).catch(() => ({}));
    const strokes = Array.isArray(doc.strokes) ? [...doc.strokes] : [];
    const ids = new Set(strokes.map((s) => s.id));
    let color = COLORS[0];
    let size = 4;
    let tab = doc.embed ? 'embed' : 'draw';

    const canvas = h('canvas', { class: 'wb-canvas', width: W, height: H });
    const ctx = canvas.getContext('2d');
    const redraw = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      for (const s of strokes) drawStroke(ctx, s);
    };

    let cur = null;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)];
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      cur = { id: uid('s'), c: color, w: color === 'erase' ? 28 : size, p: pos(e) };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!cur) return;
      const [x, y] = pos(e);
      const n = cur.p.length;
      if (Math.abs(cur.p[n - 2] - x) + Math.abs(cur.p[n - 1] - y) < 3) return;
      cur.p.push(x, y);
      drawStroke(ctx, { ...cur, p: cur.p.slice(-4) });
    });
    const end = async () => {
      if (!cur) return;
      const s = cur;
      cur = null;
      if (s.p.length === 2) s.p.push(s.p[0] + 1, s.p[1] + 1);
      strokes.push(s);
      ids.add(s.id);
      redraw();
      app.room.send('stroke', { obj: o.id, stroke: s });
      if (!(o.state && o.state.used)) app.setObjectState(o, { ...o.state, used: true });
      try { await app.backend.docAppend(o.id, 'strokes', s, 1500); } catch (err) { toast(err.message, 'error'); }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    const tools = h('div', { class: 'wb-tools' },
      ...COLORS.map((c) => h('button', { type: 'button', class: `swatch ${c === color ? 'on' : ''}`, style: `background:${c}`, 'aria-label': `Cor ${c}`, onclick: (e) => { color = c; mark(e.currentTarget); } })),
      h('button', { type: 'button', class: 'chip', onclick: (e) => { color = 'erase'; mark(e.currentTarget); } }, 'Borracha'),
      h('select', { onchange: (e) => { size = Number(e.target.value); } }, [2, 4, 8, 14].map((s) => h('option', { value: s, selected: s === 4 }, `${s}px`))),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn-secondary small', onclick: async () => {
        if (!(await confirmBox('Limpar quadro?', 'Apaga o desenho para todos.', 'Limpar', true))) return;
        strokes.length = 0;
        redraw();
        app.room.send('board-clear', { obj: o.id });
        app.setObjectState(o, { ...o.state, used: false });
        app.backend.docSet(o.id, 'strokes', []).catch((err) => toast(err.message, 'error'));
      } }, 'Limpar'));
    const mark = (btn) => { for (const b of tools.querySelectorAll('.swatch, .chip')) b.classList.remove('on'); btn.classList.add('on'); };

    const embedInput = h('input', { type: 'url', placeholder: 'Cole o link do quadro do Miro, FigJam ou outra página', value: doc.embed || '' });
    const frameBox = h('div', { class: 'embed-box' });
    const paintEmbed = (url) => {
      const src = toEmbed(url);
      fill(frameBox, src
        ? h('iframe', { src, allow: 'fullscreen; clipboard-read; clipboard-write', allowfullscreen: true, referrerpolicy: 'no-referrer-when-downgrade' })
        : h('p', { class: 'muted center' }, 'Cole o link de um quadro do Miro (Compartilhar → copiar link) para todo mundo usar junto.'));
    };
    paintEmbed(doc.embed || '');

    const drawPane = h('div', { class: 'wb-pane' }, tools, canvas);
    const embedPane = h('div', { class: 'wb-pane' },
      h('div', { class: 'row-input' }, embedInput, h('button', { type: 'button', class: 'btn-primary small', onclick: async () => {
        const url = embedInput.value.trim();
        paintEmbed(url);
        try { await app.backend.docSet(o.id, 'embed', url); app.room.send('doc', { id: o.id }); } catch (err) { toast(err.message, 'error'); }
      } }, 'Salvar')),
      frameBox,
      h('p', { class: 'muted small' }, 'Dica: no Miro, use Compartilhar → "Qualquer pessoa com o link pode editar" para o time desenhar junto sem login extra.'));
    const seg = h('div', { class: 'seg seg-wide' });
    const paintTabs = () => {
      fill(seg, 
        h('button', { type: 'button', class: tab === 'draw' ? 'on' : '', onclick: () => { tab = 'draw'; paintTabs(); } }, '✏️ Desenhar'),
        h('button', { type: 'button', class: tab === 'embed' ? 'on' : '', onclick: () => { tab = 'embed'; paintTabs(); } }, '🧩 Miro / link'));
      drawPane.hidden = tab !== 'draw';
      embedPane.hidden = tab !== 'embed';
    };
    paintTabs();
    redraw();

    this.current = { id: o.id, strokes, ids, redraw };
    openModal({
      title: 'Quadro branco',
      className: 'modal-xl',
      content: h('div', { class: 'wb' }, seg, drawPane, embedPane),
      onClose: () => { this.current = null; },
    });
  }

  onStroke({ obj, stroke }) {
    const c = this.current;
    if (!c || c.id !== obj || c.ids.has(stroke.id)) return;
    c.ids.add(stroke.id);
    c.strokes.push(stroke);
    c.redraw();
  }

  onClear({ obj }) {
    const c = this.current;
    if (!c || c.id !== obj) return;
    c.strokes.length = 0;
    c.redraw();
  }
}

function drawStroke(ctx, s) {
  const p = s.p;
  if (!p || p.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.c === 'erase' ? '#ffffff' : s.c;
  ctx.lineWidth = s.w;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.stroke();
}
