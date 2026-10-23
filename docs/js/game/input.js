// Teclado: setas/WASD. A última tecla pressionada tem prioridade.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function isTyping(e) {
  const t = e && e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export const blocked = () => document.body.classList.contains('modal-open');

export class Input {
  constructor() {
    this.held = [];
    window.addEventListener('keydown', (e) => {
      if (isTyping(e) || blocked() || e.ctrlKey || e.metaKey || e.altKey) return;
      const d = KEYMAP[e.code];
      if (!d) return;
      e.preventDefault();
      if (!this.held.includes(d)) this.held.push(d);
    });
    window.addEventListener('keyup', (e) => {
      const d = KEYMAP[e.code];
      if (d) this.held = this.held.filter((x) => x !== d);
    });
    window.addEventListener('blur', () => { this.held = []; });
  }

  direction() {
    if (blocked()) {
      this.held = [];
      return null;
    }
    return this.held[this.held.length - 1] || null;
  }
}
