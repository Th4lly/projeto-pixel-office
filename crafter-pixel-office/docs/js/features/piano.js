// Piano: duas oitavas, mouse ou teclado. Quem está perto escuta.
import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';

const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const BLACK = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
const KEYS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16 };
const NAMES = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

export function openPiano(app, onNote) {
  const keys = new Map();
  const play = (n) => {
    onNote(12 + n);
    app.me.emote = { e: '🎵', t: performance.now() };
    const el = keys.get(n);
    if (el) { el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 160); }
  };
  const board = h('div', { class: 'piano' });
  WHITE.forEach((n, i) => {
    const el = h('button', { type: 'button', class: 'pkey white', onpointerdown: () => play(n) }, h('span', {}, NAMES[i % 7]));
    keys.set(n, el);
    board.append(el);
  });
  const wkw = 100 / WHITE.length;
  BLACK.forEach((n) => {
    const el = h('button', { type: 'button', class: 'pkey black', style: `left:calc(${(WHITE.indexOf(n - 1) + 1) * wkw}% - ${wkw * 0.3}%);width:${wkw * 0.6}%`, onpointerdown: () => play(n) });
    keys.set(n, el);
    board.append(el);
  });
  const onKey = (e) => {
    if (e.repeat) return;
    const n = KEYS[e.code];
    if (n !== undefined) { e.preventDefault(); play(n); }
  };
  window.addEventListener('keydown', onKey);
  return openModal({
    title: '🎹 Piano',
    className: 'modal-wide',
    content: h('div', {}, board, h('p', { class: 'muted small center' }, 'Clique nas teclas ou use A W S E D F T G Y H U J K. Quem estiver perto escuta.')),
    onClose: () => window.removeEventListener('keydown', onKey),
  });
}
