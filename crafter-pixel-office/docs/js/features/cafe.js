// Cafeteria: preparar bebidas e comidas num minijogo de tempo (pare o ponteiro na faixa verde)
// e comer sentado à mesa. O que você prepara vai para a bandeja (inventário) e dá um bônus
// ao comer; o prato aparece na mesa para todo mundo ver por um minuto.
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { blip } from '../audio.js';

// estação → receitas. Cada passo: [nome, velocidade (voltas/s), largura da faixa (0–1)]
export const RECIPES = {
  espresso: { e: '☕', name: 'Espresso', st: 'bar', buff: 'Cafeinado: foco', min: 10, steps: [['Moer o café', 0.7, 0.24], ['Extrair o espresso', 0.9, 0.18]] },
  cappuccino: { e: '☕', name: 'Cappuccino', st: 'bar', buff: 'Cappuccino: foco e calma', min: 15, steps: [['Moer o café', 0.7, 0.24], ['Extrair', 0.9, 0.18], ['Vaporizar o leite', 1.0, 0.18], ['Desenhar a arte no leite', 1.2, 0.12]] },
  latte: { e: '🥛', name: 'Latte gelado', st: 'bar', buff: 'Refrescado', min: 12, steps: [['Gelo no copo', 0.6, 0.28], ['Extrair', 0.9, 0.18], ['Completar com leite', 1.0, 0.16]] },
  chocolate: { e: '🍫', name: 'Chocolate quente', st: 'bar', buff: 'Aconchego', min: 12, steps: [['Aquecer o leite', 0.8, 0.22], ['Mexer o cacau', 1.1, 0.16], ['Chantilly', 1.0, 0.16]] },
  cha: { e: '🍵', name: 'Chá da casa', st: 'bar', buff: 'Chá calmante', min: 12, steps: [['Ferver a água', 0.6, 0.26], ['Tempo de infusão', 0.8, 0.14]] },
  suco: { e: '🧃', name: 'Suco natural', st: 'bar', buff: 'Hidratado', min: 10, steps: [['Cortar as frutas', 1.0, 0.2], ['Espremer', 1.2, 0.16]] },
  pizza: { e: '🍕', name: 'Pizza no forno a lenha', st: 'forno', buff: 'Bem alimentado', min: 25, steps: [['Abrir a massa', 0.7, 0.24], ['Molho e queijo', 0.9, 0.2], ['Ponto do forno', 1.3, 0.1]] },
  paodequeijo: { e: '🧀', name: 'Pão de queijo', st: 'forno', buff: 'Lanchinho mineiro', min: 15, steps: [['Enrolar as bolinhas', 0.9, 0.2], ['Assar', 1.1, 0.14]] },
  espetinho: { e: '🍢', name: 'Espetinho', st: 'grelha', buff: 'Energia de churrasco', min: 20, steps: [['Virar', 1.0, 0.18], ['Virar de novo', 1.2, 0.16], ['Tirar no ponto', 1.4, 0.12]] },
  hamburguer: { e: '🍔', name: 'Hambúrguer', st: 'grelha', buff: 'Bem alimentado', min: 20, steps: [['Selar a carne', 1.0, 0.18], ['Derreter o queijo', 1.1, 0.16], ['Montar', 0.8, 0.22]] },
  panqueca: { e: '🥞', name: 'Panquecas', st: 'fogao', buff: 'Café da manhã reforçado', min: 18, steps: [['Bater a massa', 0.9, 0.22], ['Virar no ar', 1.3, 0.12]] },
  sopa: { e: '🍲', name: 'Sopa da guilda', st: 'fogao', buff: 'Sopa mágica: +foco', min: 20, steps: [['Picar os legumes', 1.0, 0.2], ['Temperar', 0.9, 0.16], ['Mexer', 1.2, 0.14]] },
  salada: { e: '🥗', name: 'Salada', st: 'bancada', buff: 'Leveza', min: 15, steps: [['Lavar as folhas', 0.7, 0.26], ['Picar', 1.2, 0.16], ['Temperar', 0.9, 0.18]] },
  sanduiche: { e: '🥪', name: 'Sanduíche', st: 'bancada', buff: 'Lanchinho', min: 12, steps: [['Fatiar o pão', 0.9, 0.2], ['Rechear', 1.0, 0.18]] },
  louca: { e: '🍽️', name: 'Lavar a louça (gorjeta)', st: 'pia', buff: '', min: 0, steps: [['Ensaboar', 1.0, 0.2], ['Enxaguar', 1.1, 0.18], ['Secar', 1.2, 0.16]] },
};
const STATIONS = { bar: 'Balcão do café', forno: 'Forno a lenha', grelha: 'Grelha', fogao: 'Fogão', bancada: 'Bancada', pia: 'Pia' };

function tray(app) {
  const s = app.inventory.s;
  if (!s.food) s.food = {};
  return s.food;
}

/** Abre a estação: escolha a receita e jogue. */
export function openStation(app, station = 'bar', title) {
  const list = Object.entries(RECIPES).filter(([, r]) => r.st === station);
  const body = h('div', { class: 'cafe' });
  const m = openModal({ title: title || STATIONS[station] || 'Cozinha', className: 'modal-wide', content: body });
  fill(body,
    h('p', { class: 'muted small' }, 'Escolha o que preparar. Em cada etapa, pare o ponteiro dentro da faixa verde (Espaço ou clique). Quanto mais perto do centro, melhor o prato e mais longo o bônus.'),
    h('div', { class: 'cafe-recipes' }, list.map(([id, r]) => h('button', { type: 'button', class: 'cafe-recipe', onclick: () => play(app, id, body, m) },
      h('span', { class: 'cafe-emoji' }, r.e), h('strong', {}, r.name), h('span', { class: 'muted small' }, `${r.steps.length} etapas${r.buff ? ` · ${r.buff}` : ' · ganha zeny'}`)))));
}

function play(app, id, body, m) {
  const r = RECIPES[id];
  let step = 0;
  const scores = [];
  const bar = h('div', { class: 'cafe-bar' });
  const zone = h('div', { class: 'cafe-zone' });
  const sweet = h('div', { class: 'cafe-sweet' });
  const needle = h('div', { class: 'cafe-needle' });
  bar.append(zone, sweet, needle);
  const label = h('div', { class: 'cafe-step' });
  const log = h('div', { class: 'cafe-log' });
  const btn = h('button', { type: 'button', class: 'btn-primary cafe-stop' }, 'Parar! (Espaço)');
  fill(body, h('div', { class: 'cafe-play' }, h('div', { class: 'cafe-title' }, h('span', { class: 'cafe-emoji big' }, r.e), h('strong', {}, r.name)), label, bar, btn, log));
  let t0 = performance.now();
  let center = 0.5;
  let width = 0.2;
  let speed = 1;
  let raf = 0;
  let stopped = false;
  const setup = () => {
    const [name, sp, wd] = r.steps[step];
    speed = sp;
    width = wd;
    center = wd / 2 + 0.05 + Math.random() * (0.9 - wd);
    zone.style.left = `${(center - width / 2) * 100}%`;
    zone.style.width = `${width * 100}%`;
    sweet.style.left = `${(center - width / 8) * 100}%`;
    sweet.style.width = `${(width / 4) * 100}%`;
    fill(label, `Etapa ${step + 1}/${r.steps.length}: `, h('strong', {}, name));
    t0 = performance.now();
    stopped = false;
  };
  const pos = () => {
    const u = (((performance.now() - t0) / 1000) * speed) % 2;
    return u < 1 ? u : 2 - u;
  };
  const frame = () => {
    if (!document.body.contains(bar)) return cancelAnimationFrame(raf);
    if (!stopped) needle.style.left = `${pos() * 100}%`;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const p = pos();
    const d = Math.abs(p - center);
    const sc = d <= width / 8 ? 3 : d <= width / 2 ? 2 : d <= width ? 1 : 0;
    scores.push(sc);
    const txt = ['Errou…', 'Quase!', 'Bom!', 'Perfeito!'][sc];
    log.append(h('div', { class: `cafe-res r${sc}` }, `${r.steps[step][0]}: ${txt}`));
    blip([200, 360, 560, 880][sc], 0.07, 0.06);
    step += 1;
    if (step < r.steps.length) setTimeout(setup, 450);
    else setTimeout(() => finish(app, id, scores, body, m), 500);
  };
  btn.addEventListener('click', stop);
  const key = (e) => {
    if (!document.body.contains(bar)) return window.removeEventListener('keydown', key, true);
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); stop(); }
  };
  window.addEventListener('keydown', key, true);
  setup();
  raf = requestAnimationFrame(frame);
}

function finish(app, id, scores, body, m) {
  const r = RECIPES[id];
  const max = r.steps.length * 3;
  const pts = scores.reduce((a, b) => a + b, 0);
  const stars = pts >= max * 0.85 ? 3 : pts >= max * 0.5 ? 2 : pts > 0 ? 1 : 0;
  const starTxt = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  if (id === 'louca') {
    const tip = 5 + stars * 10;
    app.inventory.addZeny(tip);
    fill(body, h('div', { class: 'cafe-done' }, h('span', { class: 'cafe-emoji big' }, '🍽️'), h('strong', {}, `Louça limpa! ${starTxt}`), h('p', {}, `Gorjeta da casa: +${tip}z`),
      h('button', { class: 'btn-primary', onclick: () => m.close() }, 'Fechar')));
    return;
  }
  if (!stars) {
    fill(body, h('div', { class: 'cafe-done' }, h('span', { class: 'cafe-emoji big' }, '💨'), h('strong', {}, 'Queimou… tente de novo!'),
      h('button', { class: 'btn-primary', onclick: () => play(app, id, body, m) }, 'Tentar de novo')));
    return;
  }
  const t = tray(app);
  const key = `${id}:${stars}`;
  t[key] = (t[key] || 0) + 1;
  app.inventory.save();
  app.renderer.float(app.me.x, app.me.y - 1.4, `${r.e} ${r.name} ${starTxt}`, '#ffd84d');
  fill(body, h('div', { class: 'cafe-done' },
    h('span', { class: 'cafe-emoji big' }, r.e),
    h('strong', {}, `${r.name} ${starTxt}`),
    h('p', { class: 'muted' }, 'Foi para a sua bandeja. Sente-se a uma mesa e aperte X nela para comer (o prato aparece para todos), ou coma agora.'),
    h('div', { class: 'chips' },
      h('button', { class: 'btn-primary', onclick: () => { m.close(); eatItem(app, key, null); } }, 'Comer agora'),
      h('button', { class: 'btn-secondary', onclick: () => play(app, id, body, m) }, 'Preparar outro'),
      h('button', { class: 'btn-secondary', onclick: () => m.close() }, 'Guardar'))));
}

/** Come um item da bandeja (opcionalmente numa mesa: o prato aparece nela). */
export function eatItem(app, key, table) {
  const t = tray(app);
  if (!t[key]) return;
  const [id, st] = key.split(':');
  const r = RECIPES[id];
  const stars = Number(st) || 1;
  t[key] -= 1;
  if (!t[key]) delete t[key];
  app.inventory.save();
  const sitting = !!app.world.seatAt(app.me.x, app.me.y) || app.me.floorSit;
  const min = Math.round(r.min * (0.6 + stars * 0.3) * (sitting ? 1.5 : 1));
  app.addBuff(r.e, r.buff, min);
  app.emote(r.e);
  if (table) app.setObjectState(table, { ...(table.state || {}), plate: r.e, plateUntil: Date.now() + 60000 });
  toast(`${r.e} ${r.name}: ${r.buff} por ${min} min${sitting ? ' (sentado: bônus maior)' : ''}`, 'ok', 2600);
}

/** X numa mesa da cafeteria: escolher o que comer da bandeja. */
export function openTable(app, table) {
  const t = tray(app);
  const items = Object.entries(t).filter(([, n]) => n > 0);
  if (!items.length) {
    toast('Sua bandeja está vazia. Prepare algo no balcão, no forno ou na cozinha (ou peça à barista).', 'info', 3500);
    return;
  }
  const body = h('div', { class: 'npc-opts' }, items.map(([key, n]) => {
    const [id, st] = key.split(':');
    const r = RECIPES[id];
    return h('button', { type: 'button', class: 'npc-opt', onclick: () => { m.close(); eatItem(app, key, table); } }, `${r.e} ${r.name} ${'★'.repeat(Number(st))} ×${n}`);
  }));
  const m = openModal({ title: 'O que vai comer?', content: h('div', {}, h('p', { class: 'muted small' }, 'Sentado o bônus dura 50% a mais.'), body) });
}

export function openMenu() {
  const by = {};
  for (const r of Object.values(RECIPES)) (by[r.st] = by[r.st] || []).push(r);
  openModal({
    title: '📜 Cardápio da cafeteria',
    content: h('div', { class: 'cafe-menu' }, Object.entries(by).map(([st, list]) => h('div', {},
      h('div', { class: 'opt-label' }, STATIONS[st]),
      h('ul', {}, list.map((r) => h('li', {}, `${r.e} ${r.name}${r.buff ? ` — ${r.buff}` : ''}`))))),
    h('p', { class: 'muted small' }, 'Cada estação tem seu minijogo: balcão (bebidas), forno a lenha, grelha, fogão, bancada e pia.')),
  });
}
