// Objetos interativos da arena (como num campo de treino do RO):
// racks de armas e de escudos, pilhas de elmos e armaduras, alvos de arco e flecha,
// estandartes de equipe e o camarote para assistir às lutas.
// Equipamento da arena vale por 10 minutos e entra na ficha d20 (CA / acerto).
import { h, toast, fill } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { CAT, frameCanvas } from '../art/assets.js';
import { blip } from '../audio.js';
import { roll } from './d20.js';

const RACKS = {
  sword: ['Espada', 'Espada curta', 'Lança de espadachim'],
  axe: ['Machado', 'Machado de montaria', 'Maça'],
  spear: ['Lança', 'Lança de montaria', 'Lança de mercenário'],
  bow: ['Arco', 'Arco de arruaceiro', 'Arco de mercenário'],
  dagger: ['Adaga', 'Katar', 'Adaga de bardo'],
  long: ['Lança', 'Machado', 'Cajado', 'Lança de montaria'],
};
const RACK_NAME = { sword: 'espadas', axe: 'machados e maças', spear: 'lanças', bow: 'arcos', dagger: 'adagas', long: 'armas longas', any: 'armas' };
export const TEAMS = { vermelho: { name: 'Equipe Vermelha', color: '#ff5d5d' }, azul: { name: 'Equipe Azul', color: '#5da8ff' } };
const GEAR_MS = 10 * 60000;

function gearOf(app) {
  const g = app.me.gear || {};
  return g.until > Date.now() ? g : { ca: 0, hit: 0, until: 0 };
}

function equip(app, part, bonus, label, emoji) {
  const g = gearOf(app);
  const next = { ...g, [part]: bonus, until: Date.now() + GEAR_MS };
  next.ca = (part === 'shield' ? bonus.ca : (g.shield || {}).ca || 0) + (part === 'armor' ? bonus.ca : (g.armor || {}).ca || 0);
  next.hit = part === 'weapon' ? bonus.hit : (g.weapon || {}).hit || 0;
  app.me.gear = next;
  app.addBuff(emoji, label, 10);
  app.trackSoon();
  if (app.combat) app.combat.renderHud();
  blip(660, 0.08, 0.06);
}

function picker(title, items, thumb, onPick, note) {
  let page = 0;
  const per = 40;
  const body = h('div', { class: 'arena-pick' });
  const m = openModal({ title, className: 'modal-wide', content: body });
  const paint = () => {
    const list = items.slice(page * per, page * per + per);
    fill(body,
      note ? h('p', { class: 'muted small' }, note) : null,
      h('div', { class: 'palette arena-grid' }, list.map((x) => h('button', { type: 'button', class: 'pal-item', title: x.name, onclick: () => { onPick(x); m.close(); } }, thumb(x), h('span', {}, x.name)))),
      items.length > per ? h('div', { class: 'chips' },
        h('button', { class: 'chip', disabled: page === 0, onclick: () => { page -= 1; paint(); } }, '‹'),
        h('span', { class: 'muted small' }, `${page + 1}/${Math.ceil(items.length / per)}`),
        h('button', { class: 'chip', disabled: (page + 1) * per >= items.length, onclick: () => { page += 1; paint(); } }, '›')) : null);
  };
  paint();
}

export function arenaInteract(app, o, def) {
  const k = def.interact;
  const skin = def.skin || {};
  switch (k) {
    case 'weapons': {
      const rack = skin.rack || 'any';
      const groups = RACKS[rack];
      const list = (CAT.weapons || []).filter((w) => !groups || groups.includes(w.group));
      picker(`Rack de ${RACK_NAME[rack] || 'armas'}`, list, (w) => frameCanvas(w.s, w.icon, 44), (w) => {
        app.setAvatar({ ...app.me.avatar, weapon: w.id });
        equip(app, 'weapon', { hit: 1, id: w.id }, `${w.name}: +1 no acerto`, '⚔️');
        app.floatText(app.me.x, app.me.y - 1.6, `Equipou ${w.name}`, '#ffd84d');
      }, 'Pegue uma arma do rack: ela aparece no seu personagem e dá +1 no acerto por 10 minutos.');
      return true;
    }
    case 'helmets': {
      const list = (CAT.headgears || []).filter((x) => /elmo|capacete|helm|chap[eé]u|coroa|tiara|bon[eé]/i.test(`${x.name} ${x.group}`));
      picker('Pilha de elmos', list.length ? list : CAT.headgears, (x) => frameCanvas(x.s, x.dirs[0], 44), (x) => {
        app.setAvatar({ ...app.me.avatar, headgear: x.id });
        equip(app, 'armor', { ca: 1 }, `${x.name}: +1 CA`, '⛑️');
      }, 'Escolha um elmo: +1 de CA por 10 minutos.');
      return true;
    }
    case 'armory':
      equip(app, 'armor', { ca: 2 }, 'Armadura da arena: +2 CA', '🥋');
      app.floatText(o.x, o.y - 1, 'Armadura vestida! +2 CA', '#9be8ff');
      return true;
    case 'shield':
      equip(app, 'shield', { ca: 2 }, 'Escudo da arena: +2 CA', '🛡️');
      app.floatText(o.x, o.y - 1, 'Escudo equipado! +2 CA', '#9be8ff');
      return true;
    case 'archery': {
      const s = app.combat ? app.combat.sheet : { mods: { des: 0 }, bab: 0 };
      const d = roll('1d20');
      const total = d + (s.mods ? s.mods.des : 0) + Math.floor(s.bab || 0) + gearOf(app).hit;
      const pts = d === 20 || total >= 24 ? 10 : total >= 19 ? 8 : total >= 14 ? 5 : total >= 10 ? 2 : 0;
      const txt = pts === 10 ? 'NA MOSCA! 10' : pts ? `${pts} pontos` : 'Errou o alvo';
      if (app.combat) app.combat.broadcastFx({ fx: pts ? 'hit' : 'cast', x: o.x + 0.5, y: o.y + 0.8 });
      app.floatText(o.x, o.y - 1.2, `🎯 ${txt} (d20 ${d} → ${total})`, pts === 10 ? '#ff5d73' : pts ? '#ffd84d' : '#cfd8ff', pts === 10);
      blip(pts ? 880 : 220, 0.06, 0.06);
      let best = 0;
      try { best = Number(localStorage.getItem('po.archery.best') || 0); } catch (e) { /* sem storage */ }
      const series = (app._archery = (app._archery || []).concat(pts).slice(-3));
      if (series.length === 3) {
        const sum = series.reduce((a, b) => a + b, 0);
        app._archery = [];
        if (sum > best) { try { localStorage.setItem('po.archery.best', String(sum)); } catch (e) { /* sem storage */ } }
        app.inventory.addZeny(sum);
        toast(`Série de 3 flechas: ${sum} pontos (+${sum}z)${sum > best ? ' — novo recorde!' : ` · recorde ${best}`}`, 'ok', 3500);
      }
      return true;
    }
    case 'team': {
      const cur = app.me.team || '';
      const body = h('div', { class: 'npc-opts' },
        Object.entries(TEAMS).map(([id, t]) => h('button', { type: 'button', class: `npc-opt ${cur === id ? 'on' : ''}`, onclick: () => { setTeam(app, id); m.close(); } },
          h('span', { style: `color:${t.color}` }, '⚑ '), t.name)),
        h('button', { type: 'button', class: 'npc-opt', onclick: () => { setTeam(app, ''); m.close(); } }, 'Sair da equipe'));
      const m = openModal({ title: 'Estandarte das equipes', content: h('div', {}, h('p', {}, 'Na Arena PvP, quem é da mesma equipe não se ataca. O nome fica com a cor da equipe.'), body) });
      return true;
    }
    case 'watch':
      app.clickTo({ x: o.x + 1, y: o.y + 1 });
      app.renderer.zoomBy(-1);
      toast('Você está no camarote: a câmera afastou para ver a arena. Use + para aproximar.', 'info', 3500);
      return true;
    default:
      return false;
  }
}

export function setTeam(app, id) {
  app.me.team = id;
  app.trackSoon();
  if (id) toast(`Você entrou na ${TEAMS[id].name}!`, 'ok', 2000);
  else toast('Você saiu da equipe.', 'info', 1500);
}

/** Bônus de equipamento de alguém (presença) para a ficha d20. */
export function gearBonus(p) {
  const g = p && p.gear;
  return g && g.until > Date.now() ? { ca: g.ca || 0, hit: g.hit || 0 } : { ca: 0, hit: 0 };
}
