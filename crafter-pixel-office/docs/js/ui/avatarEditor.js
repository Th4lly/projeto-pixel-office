// Personalização: avatar do Ragnarok (classe, cabelo, acessório, arma, mascote) e a aba
// "Minha mesa" para decorar a própria mesa. Prévia animada nas 4 direções.
import { h, fill } from './dom.js';
import { companionList, petThumb } from '../features/pets.js';
import { ICONS } from './icons.js';
import { openModal } from './modal.js';
import { CAT, IDX, frameCanvas } from '../art/assets.js';
import { drawAvatar, normalizeAvatar, randomAvatar, bodiesFor, headsFor } from '../art/avatar.js';
import { classOf, CLASSES } from '../features/d20.js';

const TABS = ['Classe', 'Cabelo', 'Acessório', 'Arma', 'Mascote', 'Minha mesa'];
const DIRS = ['down', 'downleft', 'left', 'upleft', 'up', 'upright', 'right', 'downright'];
const PAGE = 60;

/** Busto (cabeça e ombros) grande, para ver o rosto e o cabelo de perto. */
function bust(cfg, size = 64, zoom = 34) {
  const c = h('canvas', { width: size, height: size, class: 'bust' });
  const paint = () => {
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const k = size / zoom;
    drawAvatar(ctx, cfg, 'down', 'stand', 0, size / 2, size * (zoom === 34 ? 1.98 : 1.62), k);
  };
  paint();
  import('../art/assets.js').then(({ onAssetLoad }) => { const off = onAssetLoad(paint); setTimeout(off, 6000); });
  return c;
}

function portrait(cfg, w = 60, hgt = 76) {
  const c = h('canvas', { width: w, height: hgt });
  const paint = () => {
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, hgt);
    drawAvatar(ctx, cfg, 'down', 'stand', 0, w / 2, hgt - 3, hgt / 78);
  };
  paint();
  import('../art/assets.js').then(({ onAssetLoad }) => { const off = onAssetLoad(paint); setTimeout(off, 6000); });
  return c;
}

export function openAvatarEditor(app, { welcome = false, tab: startTab } = {}) {
  let cfg = normalizeAvatar(app.me.avatar);
  let tab = startTab || 'Classe';
  let raf = 0;
  let page = 0;
  let hairColor = (IDX.heads.get(cfg.head) || {}).colorKey || 'black';
  let group = '';

  const preview = h('canvas', { class: 'avatar-preview', width: 760, height: 170 });
  const nameInput = h('input', { type: 'text', maxlength: 24, value: app.me.name, placeholder: 'Seu nome', 'aria-label': 'Nome de exibição' });
  const tabsEl = h('div', { class: 'seg seg-wide' });
  const optionsBox = h('div', { class: 'avatar-options' });
  const info = h('p', { class: 'muted small class-info' });

  function drawPreview(t) {
    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.imageSmoothingEnabled = false;
    const phase = Math.floor(t / 2200) % 3;
    const action = phase === 1 ? 'walk' : phase === 2 ? 'attack' : 'stand';
    // retrato grande de frente (rosto bem visível) + as 8 direções animadas
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 0, 150, 170);
    drawAvatar(ctx, cfg, 'down', 'stand', 0, 75, 252, 3.6);
    DIRS.forEach((dir, i) => {
      const cx = 190 + i * 74;
      ctx.fillStyle = 'rgba(20,10,40,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, 160, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      drawAvatar(ctx, cfg, dir, action, action === 'attack' ? ((t % 2200) / 1000) % 0.6 : t / 1000, cx, 162, 1.75);
    });
    raf = requestAnimationFrame(drawPreview);
  }

  const set = (patch) => { cfg = normalizeAvatar({ ...cfg, ...patch }); render(); };

  function pager(total) {
    const pages = Math.ceil(total / PAGE);
    if (pages <= 1) return null;
    return h('div', { class: 'pager' },
      h('button', { type: 'button', class: 'chip', disabled: page === 0, onclick: () => { page -= 1; render(); } }, '‹'),
      h('span', { class: 'muted small' }, `${page + 1} / ${pages}`),
      h('button', { type: 'button', class: 'chip', disabled: page >= pages - 1, onclick: () => { page += 1; render(); } }, '›'));
  }

  function grid(items, isOn, onPick, thumb) {
    return h('div', { class: 'preset-grid' }, items.slice(page * PAGE, page * PAGE + PAGE).map((it) =>
      h('button', { type: 'button', class: `preset ${isOn(it) ? 'on' : ''}`, title: it.name, onclick: () => onPick(it) }, thumb(it), h('span', {}, it.name))));
  }

  function render() {
    fill(tabsEl, ...TABS.map((t) => h('button', { type: 'button', class: t === tab ? 'on' : '', onclick: () => { tab = t; page = 0; group = ''; render(); } }, t)));
    const C = CLASSES[classOf(`${cfg.body} ${(IDX.bodies.get(cfg.body) || {}).name}`)];
    info.textContent = `Combate d20: ${C.name} — dado de vida d${C.die}, foco ${C.focus.map((f) => f.toUpperCase()).join('/')}. Habilidade: ${C.skill.name}.`;
    const gender = h('div', { class: 'chips' },
      h('button', { type: 'button', class: `chip ${cfg.gender === 'm' ? 'on' : ''}`, onclick: () => set({ gender: 'm', body: '', head: '' }) }, 'Masculino'),
      h('button', { type: 'button', class: `chip ${cfg.gender === 'f' ? 'on' : ''}`, onclick: () => set({ gender: 'f', body: '', head: '' }) }, 'Feminino'));
    if (tab === 'Classe') {
      const list = bodiesFor(cfg.gender);
      fill(optionsBox, gender, grid(list, (b) => b.id === cfg.body, (b) => set({ body: b.id }), (b) => portrait({ ...cfg, body: b.id })), pager(list.length));
    } else if (tab === 'Cabelo') {
      const all = headsFor(cfg.gender);
      const colors = [...new Map(all.map((x) => [x.colorKey, x.color])).entries()];
      const list = all.filter((x) => x.colorKey === hairColor);
      fill(optionsBox, gender,
        h('div', { class: 'chips' }, colors.map(([k, label]) => h('button', { type: 'button', class: `chip ${hairColor === k ? 'on' : ''}`, onclick: () => { hairColor = k; page = 0; render(); } }, label))),
        grid(list, (x) => x.id === cfg.head, (x) => set({ head: x.id }), (x) => bust({ ...cfg, head: x.id, headgear: 'none' }, 64)), pager(list.length));
    } else if (tab === 'Acessório') {
      const groups = [...new Set(CAT.headgears.map((x) => x.group))];
      const list = CAT.headgears.filter((x) => !group || x.group === group);
      fill(optionsBox,
        h('div', { class: 'chips' }, h('button', { type: 'button', class: `chip ${cfg.headgear === 'none' ? 'on' : ''}`, onclick: () => set({ headgear: 'none' }) }, 'Nenhum'),
          groups.map((g) => h('button', { type: 'button', class: `chip ${group === g ? 'on' : ''}`, onclick: () => { group = g; page = 0; render(); } }, g))),
        grid(list, (x) => x.id === cfg.headgear, (x) => set({ headgear: x.id }), (x) => bust({ ...cfg, headgear: x.id }, 64, 44)), pager(list.length));
    } else if (tab === 'Arma') {
      const groups = [...new Set(CAT.weapons.map((x) => x.group))];
      const list = CAT.weapons.filter((x) => !group || x.group === group);
      fill(optionsBox,
        h('p', { class: 'muted small' }, 'A arma aparece nos ataques da arena. O dano segue a sua classe no sistema d20.'),
        h('div', { class: 'chips' }, h('button', { type: 'button', class: `chip ${cfg.weapon === 'none' ? 'on' : ''}`, onclick: () => set({ weapon: 'none' }) }, 'Mãos vazias'),
          groups.map((g) => h('button', { type: 'button', class: `chip ${group === g ? 'on' : ''}`, onclick: () => { group = g; page = 0; render(); } }, g))),
        grid(list, (x) => x.id === cfg.weapon, (x) => set({ weapon: x.id }), (x) => frameCanvas(x.s, x.icon, 48)), pager(list.length));
    } else if (tab === 'Mascote') {
      fill(optionsBox,
        h('p', { class: 'muted small' }, 'O companheiro anda ao seu lado. Também dá para adotar um dos bichinhos do escritório (aperte X perto dele).'),
        h('div', { class: 'chips' }, h('button', { type: 'button', class: `chip ${cfg.pet === 'none' ? 'on' : ''}`, onclick: () => set({ pet: 'none' }) }, 'Sem mascote')),
        grid(companionList(), (x) => x.id === cfg.pet, (x) => set({ pet: x.id }), (x) => petThumb(x.kind, x.skin, 48)));
    } else {
      fill(optionsBox, h('div', { class: 'desk-tab' },
        h('p', {}, 'Cada pessoa tem a sua mesa com uma área em volta. Lá você coloca objetos em cima e ao redor, escolhe as cores e troca a cadeira.'),
        h('button', { type: 'button', class: 'btn-primary', onclick: () => { modal.close(); app.desks.openDecorator(); } }, 'Decorar minha mesa'),
        app.world.deskOf(app.user.id) ? null : h('p', { class: 'muted small' }, 'Você ainda não tem mesa: vá até uma mesa livre no Escritório e escolha "Reivindicar".')));
    }
  }

  const content = h('div', { class: 'avatar-editor' },
    welcome ? h('p', { class: 'welcome' }, 'Bem-vindo! Monte seu personagem no estilo Ragnarok. Dá para mudar quando quiser clicando no seu avatar.') : null,
    h('div', { class: 'avatar-stage' }, preview),
    info,
    h('div', { class: 'name-row' }, h('label', {}, 'Nome', nameInput)),
    tabsEl,
    optionsBox);

  let saved = false;
  const modal = openModal({
    title: 'Personalizar',
    content,
    className: 'modal-wide',
    footer: [
      h('button', { type: 'button', class: 'btn-secondary', onclick: () => { cfg = randomAvatar(); render(); } }, h('span', { html: ICONS.dice }), 'Aleatório'),
      h('button', { type: 'button', class: 'btn-primary', onclick: () => {
        const name = nameInput.value.trim();
        app.setAvatar(cfg, name.length >= 2 ? name : undefined);
        saved = true;
        modal.close();
      } }, 'Salvar avatar'),
    ],
    onClose: () => {
      cancelAnimationFrame(raf);
      if (welcome && !saved) app.setAvatar(cfg);
    },
  });
  render();
  raf = requestAnimationFrame(drawPreview);
  return modal;
}
