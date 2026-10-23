import { h, $ } from './dom.js';
import { ICONS } from './icons.js';

/** Abre uma janela. Enquanto houver janela aberta, o personagem não anda. */
export function openModal({ title, content, footer, className = '', onClose, dismissible = true }) {
  const root = $('#modal-root');
  let closed = false;
  const closeBtn = dismissible ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fechar', html: ICONS.close, onclick: () => close() }) : null;
  const box = h('div', { class: `modal win ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'win-title' }, h('h2', {}, title), closeBtn),
    h('div', { class: 'modal-body' }, content),
    footer ? h('footer', { class: 'modal-foot' }, footer) : null);
  const overlay = h('div', { class: 'modal-overlay' }, box);
  if (dismissible) overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible && root.lastElementChild === overlay) {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  root.append(overlay);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => overlay.classList.add('show'));

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    if (!root.children.length) document.body.classList.remove('modal-open');
    if (onClose) onClose();
  }
  return { close, el: box, body: box.querySelector('.modal-body'), get closed() { return closed; } };
}

/** Confirmação simples. */
export function confirmBox(title, text, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    let ok = false;
    const m = openModal({
      title,
      content: h('p', {}, text),
      footer: [
        h('button', { type: 'button', class: 'btn-secondary', onclick: () => m.close() }, 'Cancelar'),
        h('button', { type: 'button', class: danger ? 'btn-danger' : 'btn-primary', onclick: () => { ok = true; m.close(); } }, okLabel),
      ],
      onClose: () => resolve(ok),
    });
  });
}

/** Pede um texto. Resolve null se cancelar. */
export function promptBox(title, label, value = '', { multiline = false, placeholder = '' } = {}) {
  return new Promise((resolve) => {
    let out = null;
    const input = multiline
      ? h('textarea', { rows: 5, placeholder })
      : h('input', { type: 'text', placeholder });
    input.value = value;
    const save = () => { out = input.value; m.close(); };
    const m = openModal({
      title,
      content: h('div', { class: 'form-stack' }, h('label', {}, label, input)),
      footer: [
        h('button', { type: 'button', class: 'btn-secondary', onclick: () => m.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn-primary', onclick: save }, 'Salvar'),
      ],
      onClose: () => resolve(out),
    });
    if (!multiline) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => input.focus(), 30);
  });
}
