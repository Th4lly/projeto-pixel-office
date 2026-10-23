// Personalização do avatar com prévia animada nas 4 direções.
import { h, fill } from './dom.js';
import { ICONS } from './icons.js';
import { openModal } from './modal.js';
import { OPTIONS, PALETTES, PRESETS, avatarSprite, fromPreset, normalizeAvatar, randomAvatar } from '../art/avatar.js';

const robe = (c) => ['robe', 'priest', 'dress'].includes(c.outfit);

const SECTIONS = [
  { tab: 'Corpo', label: 'Tom de pele', key: 'skin', colors: PALETTES.skin },
  { tab: 'Corpo', label: 'Cor dos olhos', key: 'eyes', colors: PALETTES.eyes },
  { tab: 'Corpo', label: 'Óculos', key: 'glasses', options: OPTIONS.glasses },
  { tab: 'Cabelo', label: 'Penteado', key: 'hair', options: OPTIONS.hair },
  { tab: 'Cabelo', label: 'Cor do cabelo', key: 'hairColor', colors: PALETTES.hair, show: (c) => c.hair !== 'bald' },
  { tab: 'Roupa', label: 'Classe / roupa', key: 'outfit', options: OPTIONS.outfit },
  { tab: 'Roupa', label: 'Cor principal', key: 'outfitColor', colors: PALETTES.cloth },
  { tab: 'Roupa', label: 'Cor dos detalhes', key: 'trimColor', colors: PALETTES.cloth },
  { tab: 'Roupa', label: 'Parte de baixo', key: 'bottom', options: OPTIONS.bottom, show: (c) => !robe(c) },
  { tab: 'Roupa', label: 'Cor da parte de baixo', key: 'bottomColor', colors: PALETTES.cloth, show: (c) => !robe(c) },
  { tab: 'Roupa', label: 'Calçado', key: 'shoes', colors: PALETTES.shoes },
  { tab: 'Acessórios', label: 'Capa', key: 'cape', options: OPTIONS.cape },
  { tab: 'Acessórios', label: 'Cor da capa', key: 'capeColor', colors: PALETTES.cloth, show: (c) => c.cape !== 'none' },
  { tab: 'Acessórios', label: 'Enfeite de cabeça', key: 'headgear', options: OPTIONS.headgear },
  { tab: 'Acessórios', label: 'Cor do enfeite', key: 'gearColor', colors: PALETTES.gear, show: (c) => !['none', 'halo', 'star', 'crown', 'sprout', 'wings'].includes(c.headgear) },
];
const TABS = ['Modelos', 'Corpo', 'Cabelo', 'Roupa', 'Acessórios'];
const DIRS = ['down', 'left', 'up', 'right'];
const SC = 4;

export function openAvatarEditor(app, { welcome = false } = {}) {
  let cfg = normalizeAvatar(app.me.avatar);
  let tab = welcome ? 'Modelos' : 'Roupa';
  let raf = 0;

  const preview = h('canvas', { class: 'avatar-preview', width: 4 * 26 * SC + 3 * 14, height: 42 * SC + 8 });
  const nameInput = h('input', { type: 'text', maxlength: 24, value: app.me.name, placeholder: 'Seu nome', 'aria-label': 'Nome de exibição' });
  const tabsEl = h('div', { class: 'seg seg-wide' });
  const optionsBox = h('div', { class: 'avatar-options' });

  function drawPreview(t) {
    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.imageSmoothingEnabled = false;
    const walking = Math.floor(t / 1800) % 2 === 1;
    const frame = walking ? Math.floor(t / 130) % 4 : 0;
    DIRS.forEach((dir, i) => {
      const x = i * (26 * SC + 14);
      ctx.fillStyle = 'rgba(20,10,40,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 13 * SC, 40 * SC, 8 * SC, 2.4 * SC, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(avatarSprite(cfg, dir, frame), x, 0, 26 * SC, 42 * SC);
    });
    raf = requestAnimationFrame(drawPreview);
  }

  const set = (k, v) => { cfg = { ...cfg, [k]: v }; render(); };

  function render() {
    fill(tabsEl, ...TABS.map((t) => h('button', { type: 'button', class: t === tab ? 'on' : '', onclick: () => { tab = t; render(); } }, t)));
    if (tab === 'Modelos') {
      fill(optionsBox, h('div', { class: 'preset-grid' }, PRESETS.map((p) => {
        const c = fromPreset(p);
        const cv = h('canvas', { width: 52, height: 84 });
        const x = cv.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(avatarSprite(c, 'down', 0), 0, 0, 52, 84);
        return h('button', { type: 'button', class: 'preset', title: p.name, onclick: () => { cfg = c; tab = 'Roupa'; render(); } }, cv, h('span', {}, p.name));
      })));
      return;
    }
    fill(optionsBox, ...SECTIONS.filter((s) => s.tab === tab && (!s.show || s.show(cfg))).map((s) =>
      h('div', { class: 'opt-section' },
        h('div', { class: 'opt-label' }, s.label),
        s.options
          ? h('div', { class: 'chips' }, s.options.map(([v, label]) => h('button', { type: 'button', class: `chip ${cfg[s.key] === v ? 'on' : ''}`, onclick: () => set(s.key, v) }, label)))
          : h('div', { class: 'swatches' },
            s.colors.map((col) => h('button', {
              type: 'button', class: `swatch ${cfg[s.key].toLowerCase() === col.toLowerCase() ? 'on' : ''}`, style: `background:${col}`, title: col, 'aria-label': `Cor ${col}`, onclick: () => set(s.key, col),
            })),
            h('label', { class: 'swatch custom', title: 'Cor personalizada' },
              h('input', { type: 'color', value: cfg[s.key], oninput: (e) => { cfg = { ...cfg, [s.key]: e.target.value }; }, onchange: () => render() }), '+')))));
  }

  const content = h('div', { class: 'avatar-editor' },
    welcome ? h('p', { class: 'welcome' }, 'Bem-vindo à guilda! Escolha um modelo ou monte seu personagem. Dá para mudar quando quiser clicando no seu avatar (ou no guarda-roupa da sala de descanso).') : null,
    h('div', { class: 'avatar-stage' }, preview),
    h('div', { class: 'name-row' }, h('label', {}, 'Nome', nameInput)),
    tabsEl,
    optionsBox);

  const modal = openModal({
    title: 'Personalizar avatar',
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
  let saved = false;
  render();
  raf = requestAnimationFrame(drawPreview);
  return modal;
}
