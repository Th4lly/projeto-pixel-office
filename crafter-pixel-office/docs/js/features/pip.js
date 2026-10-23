// Modo mini: janela flutuante (Document Picture-in-Picture no Chrome/Edge) com os vídeos,
// controles de câmera/microfone e quem está perto. Nos outros navegadores, vira um modo compacto.
import { $, h, toast, fill } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { isNear } from '../game/world.js';

export class MiniMode {
  constructor(app) {
    this.app = app;
    this.win = null;
    app.on('players', () => this.paint());
    app.on('media', () => this.paint());
  }

  async toggle() {
    if (this.win) return this.close();
    if (document.body.classList.contains('compact')) {
      document.body.classList.remove('compact');
      return;
    }
    if (!('documentPictureInPicture' in window)) {
      document.body.classList.add('compact');
      toast('Modo compacto ativado (seu navegador não tem janela flutuante — use Chrome ou Edge). Clique de novo para sair.', 'info', 5000);
      return;
    }
    try {
      this.win = await window.documentPictureInPicture.requestWindow({ width: 340, height: 420 });
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
    const d = this.win.document;
    for (const link of document.querySelectorAll('link[rel=stylesheet]')) d.head.append(link.cloneNode());
    d.documentElement.dataset.theme = document.documentElement.dataset.theme;
    d.body.className = 'pip-body';
    this.strip = $('#video-strip');
    this.placeholder = h('div', { hidden: true });
    this.strip.replaceWith(this.placeholder);
    this.root = d.createElement('div');
    this.root.className = 'pip';
    this.info = d.createElement('div');
    d.body.append(this.root);
    this.root.append(this.strip, this.info);
    this.strip.classList.add('in-pip');
    this.win.addEventListener('pagehide', () => this.restore());
    this.paint();
  }

  close() {
    if (this.win) this.win.close();
  }

  restore() {
    if (!this.strip) return;
    this.strip.classList.remove('in-pip');
    this.placeholder.replaceWith(this.strip);
    this.win = null;
    this.strip = null;
    for (const v of $('#video-strip').querySelectorAll('video')) v.play().catch(() => {});
  }

  paint() {
    if (!this.win || !this.info) return;
    const app = this.app;
    const m = app.me.media || {};
    const near = [...app.players.values()].filter((p) => p !== app.me && isNear(app.world, app.me, p, app.proximity));
    const doc = this.win.document;
    const btn = (icon, title, on, fn) => {
      const b = doc.createElement('button');
      b.className = `bar-btn ${on ? 'on' : ''}`;
      b.title = title;
      b.innerHTML = ICONS[icon];
      b.onclick = fn;
      return b;
    };
    const bar = doc.createElement('div');
    bar.className = 'pip-bar';
    bar.append(
      btn('video', m.on ? 'Desligar' : 'Ligar câmera/mic', m.on, () => app.media.toggle()),
      ...(m.on ? [btn(m.mic ? 'mic' : 'micOff', 'Microfone', m.mic, () => app.media.toggleTrack('audio')), btn(m.cam ? 'cam' : 'camOff', 'Câmera', m.cam, () => app.media.toggleTrack('video'))] : []),
    );
    const list = doc.createElement('p');
    list.className = 'pip-near';
    list.textContent = near.length ? `Perto: ${near.map((p) => p.name).join(', ')}` : 'Ninguém por perto agora.';
    fill(this.info, bar, list);
  }
}
