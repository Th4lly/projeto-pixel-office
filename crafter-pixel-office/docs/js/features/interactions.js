// O que cada móvel faz ao interagir (tecla X ou clique).
import { h, toast, fill } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { blip, playNote } from '../audio.js';
import { openPiano } from './piano.js';
import { runCustomAction, openObjectPanel } from './objectMenu.js';
import { paper } from '../art/assets.js';

export const BUFFS = {
  coffee: ['☕', 'Cafeinado: +energia', 10, 'Café quentinho!'],
  tea: ['🍵', 'Chá calmante', 10, 'Um chá para acalmar.'],
  feast: ['🍗', 'Bem alimentado', 20, 'Banquete servido!'],
  drink: ['🧃', 'Refrescado', 10, 'Suco geladinho.'],
  soup: ['🍲', 'Sopa mágica: +foco', 15, 'Sopa da guilda!'],
  snack: ['🍰', 'Lanchinho', 10, 'Hora do lanche.'],
  water_drink: ['💧', 'Hidratado', 15, 'Água é vida.'],
};

const POTIONS = [
  ['🧪', 'Poção de Foco', '#5db3ff'], ['⚡', 'Poção de Agilidade', '#ffd84d'], ['💡', 'Poção de Criatividade', '#c38bff'],
  ['🛡️', 'Poção de Paciência', '#7be07b'], ['🔥', 'Poção de Motivação', '#ff7a5c'],
];

const FORTUNES = [
  'Uma ótima ideia vai surgir na próxima reunião.', 'Hoje é um bom dia para fechar aquela quest difícil.', 'Alguém do time vai te ajudar quando você menos esperar.',
  'Sua próxima entrega vai superar as expectativas.', 'Faça uma pausa: o descanso também dá XP.', 'O bug que você procura está mais perto do que imagina.',
  'Um cliente vai te surpreender positivamente.', 'Compartilhe o que aprendeu — sorte em dobro.', 'Beba água e respire: a sorte gosta de calma.',
  'Grandes conquistas começam com pequenas quests.',
];

const LOOT = ['🎁', '🍪', '💎', '🧸', '📎', '🪙', '🍀', '🎈'];

export function interact(app, o, def, useDefault = false) {
  const k = def.interact;
  const me = app.me;
  const st = o.state || {};
  const say = (e) => app.emote(e);
  if (!useDefault && runCustomAction(app, o, def)) return;

  if (BUFFS[k]) {
    const [e, label, min, msg] = BUFFS[k];
    app.addBuff(e, label, min);
    say(e);
    toast(`${msg} (${label} por ${min} min)`, 'ok', 2500);
    return;
  }

  switch (k) {
    case 'sit':
      app.clickTo({ x: o.x, y: o.y });
      break;
    case 'toggle':
      app.setObjectState(o, { ...st, on: !st.on });
      blip(st.on ? 330 : 520, 0.06);
      break;
    case 'door':
      if (st.open && app.world.solid && [...app.players.values()].some((p) => p.x === o.x && p.y === o.y)) return toast('Tem alguém na porta!', 'warn', 1500);
      app.setObjectState(o, { ...st, open: !st.open });
      blip(st.open ? 220 : 300, 0.08);
      break;
    case 'water': {
      const g = Math.min(3, (st.g || 0) + 1);
      app.setObjectState(o, { ...st, g, at: Date.now() });
      say('💧');
      app.floatText(o.x, o.y - 0.5, g >= 3 ? '🌸 Floresceu!' : '+1 🌱', '#7be07b');
      break;
    }
    case 'potion': {
      const [e, label, color] = POTIONS[(Math.random() * POTIONS.length) | 0];
      app.addBuff(e, label, 15);
      say(e);
      app.floatText(me.x, me.y - 1.3, label, color);
      break;
    }
    case 'dummy': {
      const crit = Math.random() < 0.18;
      const dmg = crit ? 400 + ((Math.random() * 600) | 0) : 10 + ((Math.random() * 190) | 0);
      app.setObjectState(o, { ...st, hit: Date.now() });
      app.floatText(o.x, o.y - 1.2, crit ? `${dmg}!! CRÍTICO` : String(dmg), crit ? '#ff5d73' : '#ffffff', crit);
      blip(crit ? 140 : 200, 0.07, 0.07);
      setTimeout(() => app.setObjectState(o, { ...o.state, hit: 0 }), 320);
      break;
    }
    case 'wish': {
      const f = FORTUNES[(Math.random() * FORTUNES.length) | 0];
      say('🪙');
      blip(1046, 0.15);
      setTimeout(() => toast(`✨ A fonte responde: “${f}”`, 'info', 6000), 400);
      break;
    }
    case 'loot': {
      const e = LOOT[(Math.random() * LOOT.length) | 0];
      app.floatText(o.x, o.y - 0.8, `Achou ${e}!`, '#ffd84d');
      say(e);
      break;
    }
    case 'print':
      say('🖨️');
      toast('Relatório impresso! (de mentirinha 😉)', 'ok', 2000);
      break;
    case 'rest':
      app.setStatus('away', 'Descansando');
      app.addBuff('💤', 'Descansando', 15);
      say('💤');
      toast('Bom descanso! Seu status mudou para Ausente.', 'info', 2500);
      break;
    case 'portal': {
      const next = app.world.nextPortal(o);
      if (!next) return toast('Coloque outro portal no mapa para criar a ligação.', 'warn');
      const exit = app.world.freeAround(next.x, next.y);
      app.teleport(exit.x, exit.y);
      app.renderer.float(exit.x, exit.y, '✨ Teletransporte!', '#9be8ff');
      break;
    }
    case 'pomodoro':
      startPomodoro(app);
      break;
    case 'worldclock':
      worldClock();
      break;
    case 'inspect':
      inspect(app, o, def);
      break;
    case 'leaderboard':
      app.quests.openRanking();
      break;
    case 'wardrobe':
      app.openAvatarEditor();
      break;
    case 'spotlight':
      spotlightInfo(app);
      break;
    case 'present':
      app.setObjectState(o, { ...st, on: true });
      if (!app.media.on) app.media.enable().then((ok) => ok && app.media.startScreen());
      else app.media.startScreen();
      break;
    case 'piano':
      openPiano(app, (note) => { playNote(note, 0.8); app.room.send('piano', { from: me.id, note }); });
      break;
    case 'board':
      app.boards.open(o);
      break;
    case 'quests':
      app.quests.open();
      break;
    case 'notes':
      app.notes.open();
      break;
    case 'arcade':
      app.games.openArcade();
      break;
    case 'tictactoe':
      app.games.openTicTacToe(o);
      break;
    case 'desk':
      app.desks.open(o);
      break;
    case 'meeting': {
      const z = app.world.zonesAt(o.x, o.y).find((zz) => zz.kind === 'private' || zz.meeting);
      app.meetings.open(z ? z.id : o.id, z ? z.name : 'Mesa de reunião');
      break;
    }
    case 'phone': {
      const z = app.world.zonesAt(o.x, o.y).find((zz) => zz.kind === 'private' || zz.meeting);
      app.calls.openDialer({ place: z ? z.name : 'telefone' });
      break;
    }
    case 'chart': {
      const z = app.world.zonesAt(o.x, o.y).find((zz) => zz.kind === 'private' || zz.meeting);
      app.meetings.open(z ? z.id : o.id, z ? z.name : def.name);
      break;
    }
    case 'notion':
      app.notion.open();
      break;
    case 'spawner':
      app.combat.summon(o);
      break;
    case 'arena':
      app.combat.openSheet();
      break;
    case 'slot':
      app.games.openArcade ? app.games.openArcade(o) : inspect(app, o, def);
      break;
    case 'feed':
      app.docs.openFeed(o);
      break;
    case 'links':
      app.docs.openLinks(o);
      break;
    case 'mural':
      app.docs.openMural(o);
      break;
    case 'stash':
      app.docs.openStash(o);
      break;
    case 'tv':
      app.docs.openTv(o);
      break;
    case 'jukebox':
      app.docs.openJukebox(o);
      break;
    case 'calendar':
      app.integrations.openCalendar();
      break;
    case 'npc':
      app.npcRoles.open(o);
      break;
    case 'screen':
      if (!(st.on)) app.setObjectState(o, { ...st, on: true });
      app.docs.openMedia(o, `🖥️ ${def.name}`, 'Cole o link de um site, Google Docs, Figma, Miro, planilha ou vídeo para abrir nesta tela (todos veem o mesmo).');
      break;
    case 'picture':
      openPicture(app, o, def);
      break;
    case 'window':
      openWindow(app, def);
      break;
    case 'pickup':
      app.inventory.pickup(o, { quiet: false });
      break;
    case 'table':
      app.addBuff('🍵', 'Pausa na mesa', 10);
      say('🍵');
      toast('Você fez uma pausa à mesa. (+ Pausa por 10 min)', 'ok', 2200);
      break;
    case 'pet':
      say('❤️');
      app.floatText(o.x, o.y - 0.8, ['Ronrom… 😺', 'Au au! 🐶', '❤️'][(Math.random() * 3) | 0], '#ff9ab5');
      break;
    case 'craft':
      app.inventory.craft(o, def);
      break;
    case 'examine':
      openObjectPanel(app, o);
      break;
    default:
      inspect(app, o, def);
  }
}

function openPicture(app, o, def) {
  const img = o.data && o.data.image;
  const text = (o.data && o.data.text) || '';
  if (img) {
    openModal({ title: def.name, className: 'modal-wide', content: h('div', {}, h('img', { src: img, alt: def.name, class: 'meet-preview' }), text ? h('p', {}, text) : null) });
    return;
  }
  openObjectPanel(app, o);
}

function openWindow(app, def) {
  const hr = new Date().getHours();
  const phase = hr < 5 || hr >= 19 ? ['4-night', 'Noite lá fora. Estrelas e silêncio.'] : hr < 8 ? ['1-dawn', 'Amanhecendo…'] : hr < 16 ? ['3-noon', 'Dia claro e ensolarado.'] : ['2-day', 'Fim de tarde, sol baixo.'];
  openModal({
    title: def.name,
    content: h('div', { class: 'window-view' }, h('img', { src: paper(`day-night-cycle/full/${phase[0]}/1`), alt: '', class: 'window-img' }), h('p', {}, phase[1]),
      h('p', { class: 'muted small' }, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))),
  });
}

function inspect(app, o, def) {
  const text = (o.data && o.data.text) || def.desc || '';
  openModal({
    title: def.name,
    content: h('div', { class: 'inspect' }, h('p', { class: 'inspect-text' }, text || 'Nada de especial por aqui.'),
      app.canEdit ? h('p', { class: 'muted small' }, 'Editores podem mudar este texto no modo Construir → Objetos → Editar texto.') : null),
  });
}

function spotlightInfo(app) {
  const z = app.world.zones.find((x) => x.kind === 'spotlight');
  const m = openModal({
    title: '📢 Palco (Destaque)',
    content: h('div', {},
      h('p', {}, 'Quem fica na área de Destaque com o microfone ligado é ouvido por todo o escritório — ideal para avisos e all-hands.'),
      h('p', { class: 'muted small' }, 'Para falar só com algumas pessoas, saia do palco. Para apresentar slides, use o Telão (compartilhar tela).')),
    footer: z ? [h('button', { class: 'btn-primary', onclick: () => { app.goTo(z.x + Math.floor(z.w / 2), z.y + Math.floor(z.h / 2)); m.close(); } }, 'Ir para o palco')] : null,
  });
}

function worldClock() {
  const cities = [['São Paulo', 'America/Sao_Paulo'], ['Miami', 'America/New_York'], ['Lisboa', 'Europe/Lisbon'], ['Londres', 'Europe/London'], ['Tóquio', 'Asia/Tokyo']];
  const list = h('ul', { class: 'clock-list' });
  const paint = () => fill(list, ...cities.map(([n, tz]) => h('li', {}, h('span', {}, n), h('strong', {}, new Date().toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })))));
  paint();
  const t = setInterval(paint, 10000);
  openModal({ title: '🌍 Fusos horários', content: list, onClose: () => clearInterval(t) });
}

let pomo = null;

function startPomodoro(app) {
  const el = document.getElementById('pomodoro');
  if (pomo) {
    clearInterval(pomo.timer);
    pomo = null;
    el.hidden = true;
    app.setStatus('online');
    toast('Pomodoro cancelado.', 'info', 1500);
    return;
  }
  const end = Date.now() + 25 * 60000;
  app.setStatus('busy', 'Em foco (Pomodoro)');
  app.addBuff('🍅', 'Em foco', 25);
  el.hidden = false;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    el.textContent = `🍅 ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (!left) {
      clearInterval(pomo.timer);
      pomo = null;
      el.hidden = true;
      app.setStatus('online');
      blip(880, 0.2); setTimeout(() => blip(1100, 0.3), 220);
      toast('🍅 Pomodoro concluído! Faça uma pausa de 5 minutos.', 'ok', 8000);
    }
  };
  pomo = { timer: setInterval(tick, 1000) };
  el.onclick = () => startPomodoro(app);
  el.title = 'Clique para cancelar';
  tick();
  toast('🍅 Foco de 25 minutos iniciado. Seu status ficou "Ocupado".', 'ok', 3000);
}
