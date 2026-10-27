// Barra inferior, dica de interação, faixa da área atual e timer Pomodoro.
import { $, $$, h, fill } from './dom.js';
import { ICONS } from './icons.js';
import { openModal } from './modal.js';
import { avatarThumb } from '../art/avatar.js';
import { OBJECTS } from '../art/objects.js';
import { levelFromXp } from '../backend/index.js';
import { toggleTheme, currentTheme } from './theme.js';
import { iconUrl, CAT, url, frameCanvas } from '../art/assets.js';

export const EMOTES = ['👋', '❤️', '😂', '👍', '🎉', '✋'];

export class Hud {
  constructor(app) {
    this.app = app;
    this.lastHint = null;
    this.lastZone = undefined;

    for (const el of $$('#app [data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';
    for (const el of $$('#app [data-app-icon]')) el.src = iconUrl(el.dataset.appIcon, true);
    $('#btn-phone').addEventListener('click', () => app.calls.openDialer());
    $('#btn-notion').addEventListener('click', () => app.notion.open());
    $('#btn-desk').addEventListener('click', () => (app.desks.myDesk ? app.desks.openDecorator() : app.openAvatarEditor({ tab: 'Minha mesa' })));
    const bar = $('#emote-bar');
    EMOTES.forEach((e, i) => bar.append(h('button', { class: 'bar-btn emote', title: `${e} (tecla ${i + 1})`, onclick: () => app.emote(e) }, e)));
    bar.append(h('button', { class: 'bar-btn emote more', title: 'Mais emotes (Ragnarok e balões)', onclick: () => openEmotePicker(app) }, '＋'));

    const paintTheme = () => { $('#btn-theme').innerHTML = currentTheme() === 'dark' ? ICONS.sun : ICONS.moon; };
    paintTheme();
    $('#btn-theme').addEventListener('click', () => { toggleTheme(); paintTheme(); });
    $('#me-avatar').addEventListener('click', () => app.openAvatarEditor());
    $('#status-select').addEventListener('change', (e) => { app.setStatus(e.target.value); e.target.blur(); });
    $('#btn-media').addEventListener('click', () => app.media.toggle());
    $('#btn-mic').addEventListener('click', () => app.media.toggleTrack('audio'));
    $('#btn-cam').addEventListener('click', () => app.media.toggleTrack('video'));
    $('#btn-screen').addEventListener('click', () => app.media.toggleScreen());
    $('#btn-build').addEventListener('click', () => app.buildPanel.toggle());
    $('#btn-quests').addEventListener('click', () => app.quests.open());
    $('#btn-notes').addEventListener('click', () => app.notes.open());
    $('#btn-people').addEventListener('click', () => app.sidebar.toggle('people'));
    $('#btn-chat').addEventListener('click', () => app.sidebar.toggle('chat'));
    $('#btn-pip').addEventListener('click', () => app.mini.toggle());
    $('#btn-integrations').addEventListener('click', () => app.integrations.open());
    $('#btn-zoom-in').addEventListener('click', () => app.renderer.zoomBy(1));
    $('#btn-zoom-out').addEventListener('click', () => app.renderer.zoomBy(-1));
    $('#btn-help').addEventListener('click', () => showHelp());
    $('#btn-logout').addEventListener('click', () => app.logout());

    app.on('me', () => this.renderMe());
    app.on('media', () => this.renderMedia());
    app.on('world', () => { $('#btn-build').hidden = !!app.user.guest; });
    app.on('build', () => $('#btn-build').classList.toggle('on', app.build.on));
    app.on('sidebar', () => {
      const open = !$('#sidebar').hidden;
      $('#btn-people').classList.toggle('on', open && app.sidebar.tab === 'people');
      $('#btn-chat').classList.toggle('on', open && app.sidebar.tab === 'chat');
      document.body.classList.toggle('sidebar-open', open);
    });
    app.on('unread', (n) => {
      $('#chat-badge').hidden = !n;
      $('#chat-badge').textContent = n > 9 ? '9+' : n;
    });
    const reactions = h('details', { class: 'hud-menu' }, h('summary', { title: 'Reações e emotes' }, '☺ Reações'));
    bar.before(reactions);
    reactions.append(bar);
    const more = h('details', { class: 'hud-menu' }, h('summary', {}, 'Mais'));
    const actions = h('div', { class: 'hud-actions' });
    for (const id of ['btn-notes', 'btn-notion', 'btn-desk', 'btn-build', 'btn-pip', 'btn-integrations', 'btn-theme', 'btn-help', 'btn-logout']) {
      const button = document.getElementById(id);
      button.append(h('span', { class: 'action-label' }, button.title));
      actions.append(button);
    }
    more.append(actions);
    document.querySelector('.bottombar').append(more);
    for (const menu of [reactions, more]) {
      menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); } });
      menu.addEventListener('click', (e) => { if (e.target.closest('button')) menu.open = false; });
    }
    const backendLabel = this.app.backend.mode === 'local' ? 'Demonstração: conexão somente entre abas deste navegador.' : 'Escritório online';
    $('#status-select').title = backendLabel;
    const mode = h('span', { class: 'backend-mode', title: backendLabel }, this.app.backend.mode === 'local' ? 'Demo local' : 'Online');
    document.querySelector('.bottombar').append(mode);
    this.renderMedia();
  }

  renderMe() {
    const { me } = this.app;
    avatarThumb(me.avatar, 36, $('#me-avatar canvas'));
    $('#me-name').textContent = me.name;
    const lv = levelFromXp(me.xp || 0);
    $('#me-level').textContent = `Lv${lv.level}`;
    $('#me-xp').style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
    $('#me-xp').parentElement.title = `${lv.into} / ${lv.need} XP para o nível ${lv.level + 1}`;
    $('#status-select').value = me.status;
    $('#btn-build').hidden = !!this.app.user.guest;
  }

  renderMedia() {
    const m = this.app.me.media || {};
    const media = $('#btn-media');
    media.classList.toggle('on', !!m.on);
    media.title = m.on ? 'Desligar câmera e microfone' : 'Ativar câmera e microfone';
    for (const id of ['#btn-mic', '#btn-cam', '#btn-screen']) $(id).hidden = !m.on;
    $('#btn-mic').innerHTML = m.mic ? ICONS.mic : ICONS.micOff;
    $('#btn-cam').innerHTML = m.cam ? ICONS.cam : ICONS.camOff;
    $('#btn-mic').classList.toggle('off', !m.mic);
    $('#btn-cam').classList.toggle('off', !m.cam);
    $('#btn-screen').classList.toggle('on', !!m.screen);
  }

  update() {
    const { app } = this;
    const t = app.target;
    const hint = t ? t.id : null;
    if (hint !== this.lastHint) {
      this.lastHint = hint;
      const el = $('#interact-hint');
      el.hidden = !t;
      if (t) fill(el, h('kbd', {}, 'X'), ` para ${OBJECTS[t.type].label}`);
    }
    const zone = app.world.zoneAt(app.me.x, app.me.y);
    const zid = zone ? `${zone.id}|${zone.name}|${zone.kind}` : null;
    if (zid !== this.lastZone) {
      this.lastZone = zid;
      const el = $('#zone-banner');
      el.hidden = !zone || !zone.name;
      el.classList.remove('private', 'spotlight', 'arena', 'pvp', 'desk');
      if (zone && zone.name) {
        const sub = zone.kind === 'private' ? ' · área privada' : zone.kind === 'spotlight' ? ' · destaque: todos ouvem você'
          : zone.kind === 'pvp' ? ' · PvP liberado! (F ataca, R habilidade)' : zone.kind === 'arena' ? ' · monstros! (F ataca, R habilidade)'
          : zone.kind === 'desk' ? (() => { const d = app.world.deskOfZone(zone); const o = d && d.data && d.data.owner; return o ? ` · mesa de ${o.name}` : ' · mesa livre'; })() : '';
        fill(el, ...[
          zone.kind === 'private' ? h('span', { html: ICONS.lock }) : zone.kind === 'spotlight' ? h('span', {}, '📢') : zone.kind === 'pvp' ? h('span', {}, '⚔️') : zone.kind === 'arena' ? h('span', {}, '🐉') : null,
          h('strong', {}, zone.name), sub ? h('span', { class: 'muted' }, sub) : null].filter(Boolean));
        if (zone.kind !== 'area') el.classList.add(zone.kind);
      }
    }
  }
}

function openEmotePicker(app) {
  const grid = h('div', { class: 'palette emote-grid' });
  const m = openModal({ title: 'Emotes', content: grid, className: 'modal-wide' });
  for (const e of CAT.emotes) {
    const thumb = e.files ? h('img', { src: url(e.files[0]), alt: '' }) : frameCanvas(e.s, e.frames[0], 40);
    grid.append(h('button', { type: 'button', class: 'pal-item', title: e.name, onclick: () => { app.emote(`img:${e.id}`); m.close(); } }, thumb));
  }
}

function showHelp() {
  const row = (k, d) => h('tr', {}, h('td', {}, ...k.map((x) => h('kbd', {}, x))), h('td', {}, d));
  openModal({
    title: 'Ajuda e atalhos',
    content: h('div', { class: 'help' },
      h('table', {},
        row(['W', 'A', 'S', 'D'], 'Andar (ou setas, ou clique no mapa)'),
        row(['X'], 'Interagir com o objeto destacado (ou clique nele)'),
        row(['Enter'], 'Abrir o chat'),
        row(['Q'], 'Quadro de quests'),
        row(['L'], 'Telefone: ligar para quem você escolher'),
        row(['F'], 'Arena: atacar o alvo mais perto (ou clique no monstro)'),
        row(['R', 'T'], 'Arena: habilidades da classe (d20)'),
        row(['N'], 'Notas de reunião (transcrição + resumo por IA)'),
        row(['1', '…', '6'], 'Reações'),
        row(['+', '−'], 'Zoom (ou roda do mouse)'),
        row(['B'], 'Construir (editores: mapa todo · membros: a área da sua mesa)'),
        row(['1', '…', '9'], 'Construir: escolher o item da hotbar'),
        row(['R'], 'Construir: girar 45° (Shift+R: 15°)'),
        row(['I'], 'Inventário'),
        row(['🖱️ dir.'], 'Botão direito num móvel: examinar, girar, ação, guardar'),
        row(['🖱️ dir.'], 'Botão direito num colega: seguir (Esc para parar)'),
        row(['Insert', 'C'], 'Sentar no chão (regenera HP/SP em dobro)'),
        row(['Esc'], 'Fechar janelas')),
      h('ul', { class: 'tips' },
        h('li', {}, 'Ative câmera/microfone e chegue perto de alguém: a conversa abre sozinha. O som vem do lado em que a pessoa está.'),
        h('li', {}, 'Áreas 🔒 privadas isolam a conversa. A área 📢 Palco faz você ser ouvido por todos.'),
        h('li', {}, 'Na lista de Pessoas, use 👋 para acenar e chamar a atenção de alguém.'),
        h('li', {}, 'O botão de telefone liga para qualquer pessoa, onde ela estiver. Nas salas de reunião, use o telefone da sala para trazer alguém para a reunião.'),
        h('li', {}, 'Reivindique uma mesa no Escritório e decore com objetos, adesivos e cores (botão Minha mesa).'),
        h('li', {}, 'Ao lado do jardim fica a Ala das Arenas: monstros à esquerda e a Arena PvP — único lugar onde dá para lutar com outras pessoas.'),
        h('li', {}, 'No Campo de Treino: racks de armas, escudos e elmos dão +acerto/+CA por 10 min; série de 3 flechas nos alvos rende zeny.'),
        h('li', {}, 'Monstros derrubam itens no chão: clique no item (ou passe por cima) para pegar. Venda os drops ao Mercador.'),
        h('li', {}, 'Quase todo móvel faz algo: regue plantas, bata no boneco de treino, jogue uma moeda na fonte, use os portais…'))),
  });
}
