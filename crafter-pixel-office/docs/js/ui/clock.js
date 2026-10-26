// Relógio com o horário local, no canto inferior. O mostrador é o ciclo de dia e noite
// do Paper UI (amanhecer, dia, meio-dia, noite; chuva quando você está ausente).
import { h } from './dom.js';
import { paper } from '../art/assets.js';

const PHASES = [
  [0, 5, '4-night'], [5, 8, '1-dawn'], [8, 11, '2-day'], [11, 16, '3-noon'], [16, 18, '2-day'], [18, 19, '1-dawn'], [19, 24, '4-night'],
];

export class Clock {
  constructor(app) {
    this.app = app;
    this.face = h('img', { class: 'clock-face', alt: '' });
    this.time = h('strong', { class: 'clock-time' });
    this.date = h('span', { class: 'clock-date' });
    this.el = h('div', { class: 'clock win', title: 'Horário local' }, this.face, h('div', { class: 'clock-text' }, this.time, this.date));
    document.getElementById('app').append(this.el);
    this.frame = 1;
    this.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.el.title = `Horário local (${this.tz})`;
    this.paint();
    setInterval(() => this.paint(), 1000);
    setInterval(() => { this.frame = (this.frame % 10) + 1; this.paintFace(); }, 260);
  }

  phase() {
    const now = new Date();
    const hr = now.getHours() + now.getMinutes() / 60;
    if (this.app.calls && this.app.calls.ringing) return Math.floor(Date.now() / 900) % 2 ? '5-lightning-1' : '6-lightning-2';
    if (this.app.me && this.app.me.status === 'away') return '7-raining';
    return (PHASES.find(([a, b]) => hr >= a && hr < b) || PHASES[0])[2];
  }

  paintFace() {
    const src = paper(`day-night-cycle/full/${this.phase()}/${this.frame}`);
    if (src && this.face.getAttribute('src') !== src) this.face.src = src;
  }

  paint() {
    const now = new Date();
    this.time.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    this.date.textContent = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
    this.paintFace();
  }
}
