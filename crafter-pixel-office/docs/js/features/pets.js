// Bichinhos do escritório: gatos, cachorros, porquinhos, sapos e coelhos, cada um com várias
// pelagens (skins). Andam um pouco em volta do cantinho deles, cochilam de vez em quando e
// respondem a carinho, petisco e brincadeira. Dá para adotar um como companheiro do avatar.
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { IDX, drawFrame, frameCanvas, TILE } from '../art/assets.js';
import { blip } from '../audio.js';

const MP = 'megapackfree-megapackfree-';
// anim: [id do pet no catálogo, escala, fps]
export const KINDS = {
  gato: {
    name: 'Gato', idle: [`${MP}catmegafree-mochifree-idle-png`, 0.78, 6], sleep: [`${MP}catmegafree-sleepingcatfree-sleepingcat1-png`, 0.55, 3],
    play: [`${MP}catmegafree-mochifree-box3-png`, 0.75, 5], sound: 'Miau!',
    skins: [['Creme', ''], ['Laranja', 'hue-rotate(-12deg) saturate(3.2) brightness(0.95)'], ['Cinza', 'grayscale(1) brightness(0.95)'], ['Preto', 'grayscale(1) brightness(0.42) contrast(1.4)'], ['Siamês', 'sepia(0.7) brightness(0.82) contrast(1.1)']],
  },
  cachorro: {
    name: 'Cachorro', idle: [`${MP}freeanimalpack-goldenbarking-png`, 0.7, 7], sleep: [`${MP}freeanimalpack-sleepdog-png`, 0.7, 3], sound: 'Au au!',
    skins: [['Caramelo', ''], ['Chocolate', 'brightness(0.62) saturate(1.4)'], ['Branco', 'grayscale(0.7) brightness(1.5)'], ['Preto', 'grayscale(1) brightness(0.36) contrast(1.3)']],
  },
  porquinho: {
    name: 'Porquinho', idle: [`${MP}freeanimalpack-pigidle-png`, 0.62, 4], sound: 'Óinc!',
    skins: [['Rosa', ''], ['Terra', 'hue-rotate(18deg) saturate(0.55) brightness(0.72)'], ['Preto', 'grayscale(1) brightness(0.42)'], ['Malhado', 'saturate(0.3) brightness(1.15)']],
  },
  sapo: {
    name: 'Sapo', idle: [`${MP}freeanimalpack-frogidle-png`, 0.62, 4], sound: 'Croac!',
    skins: [['Verde', ''], ['Azul', 'hue-rotate(110deg)'], ['Dourado', 'hue-rotate(-62deg) saturate(1.5)'], ['Roxo', 'hue-rotate(175deg) saturate(1.2)']],
  },
  coelho: {
    name: 'Coelho', idle: [`${MP}freeanimalpack-jumping-png`, 0.85, 6], sound: 'Fuc fuc!',
    skins: [['Marrom', ''], ['Branco', 'grayscale(0.85) brightness(1.55)'], ['Cinza', 'grayscale(1)'], ['Preto', 'grayscale(1) brightness(0.4)']],
  },
  gatinho: {
    name: 'Gatinho', idle: [`${MP}freeanimalpack-jumpcattt-png`, 0.9, 6], sound: 'Miau!',
    skins: [['Cinza', ''], ['Ruivo', 'sepia(1) saturate(3) hue-rotate(-15deg)'], ['Branco', 'grayscale(1) brightness(1.6)'], ['Tigrado', 'sepia(0.8) saturate(1.6)']],
  },
};

let WORLD = null;
export function setPetWorld(w) { WORLD = w; }

const hash = (s) => { let n = 0; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) | 0; return Math.abs(n); };

function anim(kind, name) {
  const K = KINDS[kind] || KINDS.gato;
  const a = K[name] || K.idle;
  const p = IDX.pets && IDX.pets.get(a[0]);
  if (!p) return null;
  return { p, sc: a[1], fps: a[2], frames: (p.idle && p.idle.length ? p.idle : p.frames) };
}

/** Desenha um bichinho (base em cx, by). */
export function drawPetSprite(ctx, kind, skin, name, t, cx, by, k, flip = false, alpha = 1) {
  const a = anim(kind, name);
  if (!a || !a.frames.length) return false;
  const K = KINDS[kind] || KINDS.gato;
  const sk = K.skins[skin || 0] || K.skins[0];
  const f = a.frames[Math.floor(t * a.fps) % a.frames.length];
  ctx.save();
  if (sk[1]) ctx.filter = sk[1];
  // sombra
  ctx.globalAlpha = 0.25 * alpha;
  ctx.fillStyle = '#140a28';
  ctx.beginPath();
  ctx.ellipse(cx, by - k, 8 * k, 2.5 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  drawFrame(ctx, a.p.s, f, cx, by + 2 * k, a.sc * k, flip);
  ctx.restore();
  return true;
}

/** Estado animado de um bichinho do mapa: posição (passeio), pose e para onde olha. */
export function petPose(o, t) {
  const now = Date.now();
  const st = o.state || {};
  const ph = (hash(o.id) % 1000) / 159;
  const K = KINDS[(o.data && o.data.kind) || 'gato'] || KINDS.gato;
  // cochila ~12 s a cada ~50 s (quem tem animação de sono)
  const cyc = (t + ph * 7) % 50;
  const sleeping = !!K.sleep && cyc > 38 && !(st.happy > now - 6000) && !(st.fed > now - 8000);
  if (sleeping) return { dx: 0, dy: 0, flip: false, name: 'sleep' };
  if (st.fed > now - 6000) return { dx: 0, dy: 0, flip: false, name: 'idle', bowl: true };
  // passeio suave em volta da casinha (só onde dá para andar)
  let dx = Math.sin(t * 0.33 + ph) * 1.3;
  let dy = Math.sin(t * 0.21 + ph * 2) * 0.6;
  if (WORLD) {
    const tx = Math.round(o.x + dx);
    const ty = Math.round(o.y + dy);
    if (!WORLD.walkable(tx, ty)) { dx *= 0.2; dy *= 0.2; }
  }
  const flip = Math.cos(t * 0.33 + ph) < 0;
  const hop = st.happy > now - 2500 ? Math.abs(Math.sin((now - st.happy) / 120)) * 6 : 0;
  return { dx, dy, flip, name: st.play > now - 15000 && K.play ? 'play' : 'idle', hop };
}

/** Bichinho do mapa (chamado pelo desenho de objetos). */
export function drawWorldPet(ctx, o, cx, by, k, t, alpha = 1) {
  const d = o.data || {};
  const pose = petPose(o, t);
  const x = cx + pose.dx * TILE * k;
  const y = by + pose.dy * TILE * k - (pose.hop || 0) * k;
  if (pose.bowl) {
    ctx.fillStyle = '#c0504d';
    ctx.fillRect(x + 6 * k, by - 4 * k, 9 * k, 3 * k);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x + 7 * k, by - 5 * k, 7 * k, 1.5 * k);
  }
  const ok = drawPetSprite(ctx, d.kind || 'gato', d.skin || 0, pose.name, t, x, y, k, pose.flip, alpha);
  if (o.state && o.state.happy > Date.now() - 2500) {
    ctx.font = `${10 * k}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('❤', x, y - 26 * k - ((Date.now() - o.state.happy) / 2500) * 10 * k);
    ctx.textAlign = 'left';
  }
  return ok;
}

export function petThumb(kind, skin, size = 48) {
  const a = anim(kind, 'idle');
  const c = a ? frameCanvas(a.p.s, a.frames[0], size) : h('canvas', { width: size, height: size });
  const sk = (KINDS[kind] || KINDS.gato).skins[skin || 0];
  if (sk && sk[1]) c.style.filter = sk[1];
  return c;
}

/** Diálogo do bichinho (tecla X perto dele). */
export function openPet(app, o) {
  const d = o.data || {};
  const kind = d.kind || 'gato';
  const K = KINDS[kind] || KINDS.gato;
  const skin = d.skin || 0;
  const nm = d.name || K.name;
  const body = h('div', { class: 'npc-dialog' });
  const m = openModal({ title: `🐾 ${nm}`, content: body, className: 'modal-wide' });
  const say = (txt) => app.floatText(o.x, o.y - 1, txt, '#ff9ab5');
  const opt = (label, fn) => h('button', { type: 'button', class: 'npc-opt', onclick: fn }, label);
  const paint = () => fill(body,
    h('div', { class: 'npc-head' }, petThumb(kind, (o.data || {}).skin || 0, 72),
      h('p', { class: 'npc-hello' }, `${nm} (${K.name.toLowerCase()} ${K.skins[(o.data || {}).skin || 0][0].toLowerCase()}) olha para você. ${K.sound}`)),
    h('div', { class: 'npc-opts' },
      opt('❤️ Fazer carinho', () => {
        app.setObjectState(o, { ...(o.state || {}), happy: Date.now() });
        say(K.sound); app.emote('❤️'); blip(880, 0.06, 0.05);
        app.addBuff('🐾', 'Carinho de pet: menos estresse', 10);
        m.close();
      }),
      opt('🍖 Dar um petisco', () => {
        app.setObjectState(o, { ...(o.state || {}), fed: Date.now(), happy: Date.now() });
        say('Nham nham!'); blip(660, 0.05, 0.05);
        app.addBuff('😊', 'Alegria de pet', 15);
        m.close();
      }),
      K.play ? opt('🎾 Brincar', () => {
        app.setObjectState(o, { ...(o.state || {}), play: Date.now(), happy: Date.now() });
        say('Brincadeira!'); m.close();
      }) : null,
      opt('🏠 Adotar como companheiro', () => {
        app.setAvatar({ ...app.me.avatar, pet: `pet:${kind}:${(o.data || {}).skin || 0}` });
        toast(`${nm} agora acompanha você pelo escritório! (troque no editor do avatar → Mascote)`, 'ok', 3500);
        m.close();
      }),
      app.canEdit ? opt('🎨 Trocar pelagem', () => {
        const next = (((o.data || {}).skin || 0) + 1) % K.skins.length;
        app.edit([{ t: 'data', id: o.id, data: { ...(o.data || {}), skin: next } }]);
        setTimeout(paint, 60);
      }) : null,
      app.canEdit ? opt('✏️ Dar um nome', () => {
        const v = prompt('Nome do bichinho:', nm);
        if (v) app.edit([{ t: 'data', id: o.id, data: { ...(o.data || {}), name: v.slice(0, 24) } }]);
        m.close();
      }) : null));
  paint();
}

/** Lista de companheiros para o editor do avatar (todas as espécies × pelagens). */
export function companionList() {
  const out = [];
  for (const [kind, K] of Object.entries(KINDS)) K.skins.forEach(([nm], i) => out.push({ id: `pet:${kind}:${i}`, kind, skin: i, name: `${K.name} ${nm.toLowerCase()}` }));
  return out;
}

export function parseCompanion(id) {
  if (!id || !id.startsWith('pet:')) return null;
  const [, kind, skin] = id.split(':');
  return KINDS[kind] ? { kind, skin: Number(skin) || 0 } : null;
}
