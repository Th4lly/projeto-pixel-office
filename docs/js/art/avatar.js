// Avatares chibi (24x40 px de arte): cabeça grande, olhos de anime, sombreamento suave.
// 4 direções, 4 quadros de caminhada e pose sentada. Tudo gerado a partir da configuração.
import { art, shade, mix, light, shadow } from './pixel.js';

const OFF = 4; // espaço acima da cabeça para chapéus e orelhas
const GOLD = '#f2c14e';

export const OPTIONS = {
  hair: [['short', 'Curto'], ['long', 'Longo'], ['ponytail', 'Rabo de cavalo'], ['twintails', 'Maria-chiquinha'], ['bob', 'Chanel'], ['spiky', 'Espetado'], ['bun', 'Coque'], ['braid', 'Trança'], ['fluffy', 'Volumoso'], ['bald', 'Careca']],
  outfit: [['tunic', 'Aventureiro'], ['robe', 'Mago'], ['armor', 'Cavaleiro'], ['vest', 'Arqueiro'], ['apron', 'Mercador'], ['priest', 'Clérigo'], ['suit', 'Social'], ['hoodie', 'Moletom'], ['dress', 'Vestido'], ['casual', 'Camiseta']],
  bottom: [['pants', 'Calça'], ['shorts', 'Bermuda'], ['skirt', 'Saia']],
  cape: [['none', 'Sem capa'], ['short', 'Capa curta'], ['long', 'Capa longa']],
  headgear: [['none', 'Nenhum'], ['cat', 'Orelhas de gato'], ['bunny', 'Orelhas de coelho'], ['halo', 'Auréola'], ['wings', 'Tiara de asas'], ['star', 'Presilha de estrela'], ['ribbon', 'Laço'], ['flower', 'Flor'], ['crown', 'Coroa'], ['witch', 'Chapéu de bruxa'], ['beret', 'Boina'], ['horns', 'Chifrinhos'], ['sprout', 'Brotinho'], ['goggles', 'Óculos de aviador']],
  glasses: [['none', 'Sem óculos'], ['round', 'Redondos'], ['shades', 'Escuros']],
};

export const PALETTES = {
  skin: ['#ffe6d4', '#f9d3b6', '#efbf98', '#d9a077', '#b97d55', '#8a5a3a', '#5e3b26', '#cfe8d0', '#d8d4ff'],
  hair: ['#3a2a3a', '#5e3a2a', '#8a5432', '#c98b4a', '#f2d27a', '#f4efe6', '#a9aec4', '#7a7f9a', '#d64545', '#ff8fb8', '#b06bff', '#5d7fd6', '#3fb6a8', '#7bc86a'],
  eyes: ['#4a2e1e', '#2f6fd6', '#3f8a5c', '#a8343f', '#8a4fd6', '#d98a2b', '#3fb6c8', '#5a5a6a'],
  cloth: ['#a8343f', '#d9783a', '#e3b64a', '#3f8a5c', '#2f8a8a', '#3f5aa8', '#24356a', '#6e4aa0', '#c45aa8', '#f3ead6', '#ffffff', '#8a8f9c', '#3b3b48', '#7a4e2c', '#c9a96a', '#9bd7ff'],
  shoes: ['#3b2a20', '#5a3720', '#2b2b38', '#f3ead6', '#a8343f', '#3f5aa8'],
  gear: [GOLD, '#ffffff', '#ff8fb8', '#d64545', '#3f5aa8', '#6e4aa0', '#3b3b48', '#7bc86a', '#9bd7ff', '#f3ead6'],
};

export const DEFAULT_AVATAR = {
  skin: '#f9d3b6',
  eyes: '#4a2e1e',
  hair: 'short',
  hairColor: '#5e3a2a',
  outfit: 'tunic',
  outfitColor: '#3f5aa8',
  trimColor: '#e3b64a',
  bottom: 'pants',
  bottomColor: '#7a4e2c',
  shoes: '#3b2a20',
  cape: 'none',
  capeColor: '#a8343f',
  headgear: 'none',
  gearColor: '#f2c14e',
  glasses: 'none',
};

export const PRESETS = [
  { name: 'Aprendiz', hair: 'short', hairColor: '#8a5432', outfit: 'tunic', outfitColor: '#c9a96a', trimColor: '#7a4e2c', bottom: 'pants', bottomColor: '#7a4e2c' },
  { name: 'Maga', hair: 'long', hairColor: '#b06bff', eyes: '#8a4fd6', outfit: 'robe', outfitColor: '#6e4aa0', trimColor: '#e3b64a', headgear: 'witch', gearColor: '#6e4aa0', skin: '#ffe6d4' },
  { name: 'Cavaleiro', hair: 'spiky', hairColor: '#3a2a3a', eyes: '#2f6fd6', outfit: 'armor', outfitColor: '#c9cbd6', trimColor: '#3f5aa8', cape: 'long', capeColor: '#3f5aa8', bottom: 'pants', bottomColor: '#3b3b48' },
  { name: 'Arqueira', hair: 'ponytail', hairColor: '#f2d27a', eyes: '#3f8a5c', outfit: 'vest', outfitColor: '#3f8a5c', trimColor: '#f3ead6', bottom: 'shorts', bottomColor: '#7a4e2c', headgear: 'flower', gearColor: '#ff8fb8' },
  { name: 'Clériga', hair: 'twintails', hairColor: '#a9aec4', eyes: '#d98a2b', outfit: 'priest', outfitColor: '#ffffff', trimColor: '#3f5aa8', headgear: 'wings', gearColor: '#ffffff' },
  { name: 'Mercador', hair: 'fluffy', hairColor: '#d64545', outfit: 'apron', outfitColor: '#c9a96a', trimColor: '#f3ead6', bottom: 'pants', bottomColor: '#3b3b48', headgear: 'beret', gearColor: '#24356a', skin: '#d9a077' },
  { name: 'Ladina', hair: 'bob', hairColor: '#3a2a3a', eyes: '#a8343f', outfit: 'vest', outfitColor: '#3b3b48', trimColor: '#a8343f', bottom: 'pants', bottomColor: '#24356a', cape: 'short', capeColor: '#24356a', headgear: 'cat', gearColor: '#3a2a3a' },
  { name: 'Executivo', hair: 'short', hairColor: '#3a2a3a', outfit: 'suit', outfitColor: '#24356a', trimColor: '#a8343f', bottom: 'pants', bottomColor: '#24356a', glasses: 'round', skin: '#b97d55' },
  { name: 'Dev', hair: 'fluffy', hairColor: '#5d7fd6', outfit: 'hoodie', outfitColor: '#3b3b48', trimColor: '#ffffff', bottom: 'pants', bottomColor: '#3f5aa8', headgear: 'goggles', gearColor: '#7a4e2c', shoes: '#f3ead6' },
  { name: 'Princesa', hair: 'bun', hairColor: '#ff8fb8', eyes: '#3fb6c8', outfit: 'dress', outfitColor: '#ff8fb8', trimColor: '#ffffff', headgear: 'crown', gearColor: GOLD },
  { name: 'Anjinho', hair: 'braid', hairColor: '#f4efe6', eyes: '#2f6fd6', outfit: 'robe', outfitColor: '#f3ead6', trimColor: GOLD, headgear: 'halo', gearColor: GOLD, skin: '#ffe6d4' },
  { name: 'Diabinho', hair: 'spiky', hairColor: '#d64545', eyes: '#d98a2b', outfit: 'casual', outfitColor: '#3b3b48', trimColor: '#d64545', bottom: 'shorts', bottomColor: '#a8343f', headgear: 'horns', gearColor: '#3b3b48' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function normalizeAvatar(a) {
  const out = { ...DEFAULT_AVATAR };
  if (a && typeof a === 'object') {
    for (const k of Object.keys(DEFAULT_AVATAR)) {
      const v = a[k];
      if (typeof v !== 'string') continue;
      const opts = OPTIONS[k];
      if (opts ? opts.some((o) => o[0] === v) : HEX.test(v)) out[k] = v;
    }
  }
  return out;
}

export function fromPreset(p) {
  const { name, ...rest } = p;
  return normalizeAvatar(rest);
}

export function randomAvatar() {
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const opt = (k) => pick(OPTIONS[k])[0];
  return normalizeAvatar({
    skin: pick(PALETTES.skin.slice(0, 7)),
    eyes: pick(PALETTES.eyes),
    hair: pick(OPTIONS.hair.slice(0, 9))[0],
    hairColor: pick(PALETTES.hair),
    outfit: opt('outfit'),
    outfitColor: pick(PALETTES.cloth),
    trimColor: pick(PALETTES.cloth),
    bottom: opt('bottom'),
    bottomColor: pick(PALETTES.cloth),
    shoes: pick(PALETTES.shoes),
    cape: Math.random() < 0.25 ? pick(['short', 'long']) : 'none',
    capeColor: pick(PALETTES.cloth),
    headgear: Math.random() < 0.5 ? 'none' : opt('headgear'),
    gearColor: pick(PALETTES.gear),
    glasses: Math.random() < 0.15 ? 'round' : 'none',
  });
}

// =====================================================================
// Desenho
// =====================================================================

const LASH = '#2a1a22';

function pal(c) {
  return {
    skin: c.skin, skinD: shadow(c.skin, 0.16), skinL: light(c.skin, 0.25), blush: mix(c.skin, '#ff7a8a', 0.35),
    hair: c.hairColor, hairD: shadow(c.hairColor, 0.3), hairL: light(c.hairColor, 0.35),
    oc: c.outfitColor, ocD: shadow(c.outfitColor, 0.28), ocL: light(c.outfitColor, 0.22),
    tc: c.trimColor, tcD: shadow(c.trimColor, 0.25),
    bc: c.bottomColor, bcD: shadow(c.bottomColor, 0.28),
    cc: c.capeColor, ccD: shadow(c.capeColor, 0.3), ccL: light(c.capeColor, 0.2),
    gc: c.gearColor, gcD: shadow(c.gearColor, 0.3), gcL: light(c.gearColor, 0.35),
    shoe: c.shoes, shoeL: light(c.shoes, 0.3),
    eye: c.eyes, eyeL: light(c.eyes, 0.35),
  };
}

const FACE_ROWS = [[6, 7, 16], [7, 6, 17], [8, 5, 18], [9, 4, 19], [10, 4, 19], [11, 4, 19], [12, 4, 19], [13, 4, 19], [14, 4, 19], [15, 4, 19], [16, 4, 19], [17, 4, 19], [18, 5, 18], [19, 6, 17], [20, 8, 15]];
const HEAD_ROWS = [[1, 9, 14], [2, 7, 16], [3, 5, 18], [4, 4, 19], [5, 3, 20], [6, 3, 20], [7, 3, 20], [8, 3, 20], ...FACE_ROWS.slice(3).map(([y, a, b]) => [y, a - 1, b + 1])];

const robeLike = (o) => o === 'robe' || o === 'priest' || o === 'dress';
const sleeveLong = (o) => !['casual', 'dress', 'vest'].includes(o);

// ---------------------------------------------------------------- corpo (frente/costas)
function body(R, c, P, frame, sit, back) {
  const step = sit ? 0 : frame === 1 ? 1 : frame === 3 ? 2 : 0;
  const robe = robeLike(c.outfit);

  // pernas e sapatos
  if (sit) {
    if (!robe) {
      const lc = c.bottom === 'pants' ? P.bc : c.bottom === 'shorts' ? P.bc : P.skin;
      R(8, 29, 3, 2, lc); R(13, 29, 3, 2, lc);
      R(8, 31, 3, 1, c.bottom === 'pants' ? P.bcD : P.skin); R(13, 31, 3, 1, c.bottom === 'pants' ? P.bcD : P.skin);
    }
    R(7, 32, 4, 2, P.shoe); R(13, 32, 4, 2, P.shoe);
  } else if (robe) {
    R(8 - (step === 1 ? 1 : 0), 34, 4, 2, P.shoe); R(12 + (step === 2 ? 1 : 0), 34, 4, 2, P.shoe);
  } else {
    for (const [x, up] of [[8, step === 1], [13, step === 2]]) {
      const o = up ? 1 : 0;
      for (let y = 29; y <= 32 - o; y++) {
        let col = P.bc;
        if (c.bottom === 'shorts' && y >= 31) col = P.skin;
        if (c.bottom === 'skirt' && y >= 31) col = P.skin;
        R(x, y, 3, 1, col);
      }
      R(x, 29, 1, 32 - o - 28, shade(c.bottom === 'pants' ? P.bc : P.skin, 0.06));
      R(x - 1 + (x > 12 ? 1 : 0), 33 - o, 4, 2, P.shoe);
      if (!back) R(x - 1 + (x > 12 ? 1 : 0), 33 - o, 4, 1, P.shoeL);
      R(x - 1 + (x > 12 ? 1 : 0), 35 - o, 4, 1, shadow(c.shoes, 0.3));
    }
  }

  // capa (atrás do corpo, na frente só as bordas)
  if (c.cape !== 'none') {
    const end = c.cape === 'long' ? 34 : 29;
    if (back) {
      for (let y = 21; y <= end; y++) {
        const spread = Math.min(3, ((y - 21) / 4) | 0);
        R(6 - spread, y, 12 + spread * 2, 1, y % 5 === 0 ? P.ccD : P.cc);
      }
      R(6, 21, 12, 1, P.ccL);
      R(5, end, 14, 1, P.ccD);
    } else {
      R(5, 22, 2, end - 21, P.ccD); R(17, 22, 2, end - 21, P.ccD);
      R(4, 25, 1, end - 24, P.cc); R(19, 25, 1, end - 24, P.cc);
    }
  }

  // tronco
  const oc = P.oc;
  R(8, 21, 8, 8, oc);
  R(8, 21, 8, 1, P.ocL);
  R(15, 22, 1, 6, P.ocD);

  if (robe) {
    const rows = [[29, 7, 10], [30, 7, 10], [31, 6, 12], [32, 6, 12], [33, 5, 14]];
    if (sit) rows.length = 3;
    for (const [y, x, w] of rows) R(x, y, w, 1, oc);
    const last = sit ? 31 : 33;
    R(5, last, 14, 1, c.outfit === 'dress' ? P.tc : P.ocD);
    if (c.outfit !== 'dress') { R(11, 22, 2, last - 21, P.tc); R(6, last, 12, 1, P.tc); }
    if (c.outfit === 'dress') { R(7, 28, 10, 1, P.tc); for (let x = 6; x < 18; x += 2) R(x, last, 1, 1, light(c.trimColor, 0.3)); }
    R(16, 29, 1, last - 28, P.ocD);
  }

  if (!back) {
    switch (c.outfit) {
      case 'tunic':
        R(11, 21, 2, 2, P.skin); R(10, 21, 1, 2, P.tc); R(13, 21, 1, 2, P.tc);
        R(8, 28, 8, 1, '#5a3720'); R(11, 28, 2, 1, GOLD);
        if (!sit) { R(7, 29, 10, 1, oc); R(7, 30, 10, 1, P.tc); }
        break;
      case 'robe':
        R(10, 21, 4, 1, P.tc); R(8, 27, 8, 1, P.tcD);
        break;
      case 'priest':
        R(9, 21, 6, 2, P.tc); R(11, 23, 2, 4, GOLD); R(10, 24, 4, 1, GOLD);
        break;
      case 'armor':
        R(9, 22, 6, 5, P.ocL); R(10, 23, 4, 3, oc); R(11, 23, 2, 1, '#ffffff');
        R(8, 28, 8, 1, P.tc); R(11, 28, 2, 1, GOLD);
        if (!sit) { R(8, 29, 3, 1, P.ocD); R(13, 29, 3, 1, P.ocD); }
        break;
      case 'vest':
        R(10, 21, 4, 8, P.tc); R(11, 21, 2, 1, P.skin); R(8, 28, 8, 1, '#5a3720'); R(13, 28, 1, 1, GOLD);
        break;
      case 'apron':
        R(8, 21, 8, 8, P.tc); R(10, 23, 4, 6, oc); R(9, 22, 1, 2, oc); R(14, 22, 1, 2, oc); R(11, 25, 2, 1, P.ocD);
        if (!sit) R(10, 29, 4, 2, oc);
        break;
      case 'suit':
        R(11, 21, 2, 4, '#ffffff'); R(11, 22, 2, 4, P.tc); R(10, 21, 1, 3, P.ocD); R(13, 21, 1, 3, P.ocD); R(9, 26, 1, 1, '#ffffff');
        break;
      case 'hoodie':
        R(8, 20, 8, 1, P.ocD); R(10, 22, 1, 3, '#f3ead6'); R(13, 22, 1, 3, '#f3ead6'); R(9, 26, 6, 2, P.ocD);
        break;
      case 'dress':
        R(10, 21, 4, 1, P.tc); R(8, 26, 8, 1, P.tc);
        break;
      default:
        R(11, 21, 2, 1, P.skin); R(10, 24, 4, 2, P.tc);
    }
  } else {
    if (c.outfit === 'hoodie') { R(8, 18, 8, 4, P.ocD); R(9, 18, 6, 1, P.oc); }
    if (c.outfit === 'apron') { R(11, 23, 2, 1, oc); R(10, 22, 1, 1, oc); R(13, 22, 1, 1, oc); }
    if (c.outfit === 'armor' || c.outfit === 'tunic' || c.outfit === 'vest') R(8, 28, 8, 1, '#5a3720');
    if (c.outfit === 'tunic' && !sit) { R(7, 29, 10, 1, oc); R(7, 30, 10, 1, P.tc); }
  }

  // braços
  const sleeve = c.outfit === 'armor' ? P.ocL : c.outfit === 'apron' ? P.tc : c.outfit === 'vest' ? P.tc : P.oc;
  const arm = (x, dy, wide) => {
    const long = sleeveLong(c.outfit);
    const sl = long ? 6 : 2;
    R(x - (wide ? 1 : 0), 21 + dy, 2 + (wide ? 1 : 0), sl, sleeve);
    R(x, 21 + dy + sl, 2, 6 - sl, P.skin);
    R(x, 27 + dy, 2, 1, P.skinD);
  };
  const bell = c.outfit === 'robe' || c.outfit === 'priest';
  arm(6, step === 2 ? 1 : 0, bell && true);
  arm(16, step === 1 ? 1 : 0, false);
  if (bell) R(17, 21 + (step === 1 ? 1 : 0), 1, 6, sleeve);
  if (c.outfit === 'armor') { R(5, 20, 4, 3, P.tc); R(15, 20, 4, 3, P.tc); R(5, 20, 4, 1, light(c.trimColor, 0.3)); R(15, 20, 4, 1, light(c.trimColor, 0.3)); }

  if (c.cape !== 'none' && !back) { R(8, 21, 1, 1, GOLD); R(15, 21, 1, 1, GOLD); }

  // pescoço
  R(11, 20, 2, 1, P.skinD);
}

// ---------------------------------------------------------------- cabelo
function hairFrontBack(R, c, P) {
  const h = P.hair;
  switch (c.hair) {
    case 'long':
      R(2, 9, 3, 19, h); R(19, 9, 3, 19, h); R(2, 27, 2, 1, P.hairD); R(20, 27, 2, 1, P.hairD);
      R(3, 12, 1, 12, P.hairD); R(20, 12, 1, 12, P.hairD);
      break;
    case 'twintails':
      for (const x of [0, 20]) { R(x, 9, 4, 16, h); R(x + 1, 25, 2, 2, h); R(x + (x ? 2 : 1), 11, 1, 12, P.hairD); R(x, 8, 4, 2, P.tc || GOLD); }
      break;
    case 'bob':
      R(2, 9, 3, 9, h); R(19, 9, 3, 9, h); R(3, 18, 2, 1, h); R(19, 18, 2, 1, h);
      break;
    case 'braid':
      for (let y = 12; y < 30; y += 3) { R(19, y, 3, 2, h); R(20, y + 2, 2, 1, P.hairD); }
      R(19, 30, 3, 1, P.tc || GOLD);
      break;
    case 'ponytail':
      R(20, 11, 2, 10, h); R(21, 13, 1, 7, P.hairD);
      break;
    case 'fluffy':
      R(1, 8, 4, 10, h); R(19, 8, 4, 10, h); R(2, 18, 2, 1, h); R(20, 18, 2, 1, h); R(1, 12, 1, 3, P.hairD); R(22, 12, 1, 3, P.hairD);
      break;
    default:
  }
}

function hairCap(R, c, P) {
  const h = P.hair;
  if (c.hair === 'bald') {
    R(8, 6, 4, 1, P.skinL);
    return;
  }
  const rows = [[1, 9, 14], [2, 7, 16], [3, 5, 18], [4, 4, 19], [5, 3, 20], [6, 3, 20], [7, 3, 20], [8, 3, 20]];
  for (const [y, a, b] of rows) R(a, y, b - a + 1, 1, h);
  // franja
  for (const [a, b] of [[3, 7], [9, 10], [12, 14], [16, 20]]) R(a, 9, b - a + 1, 1, h);
  for (const [a, b] of [[3, 5], [9, 9], [13, 14], [18, 20]]) R(a, 10, b - a + 1, 1, h);
  R(3, 11, 2, 4, h); R(19, 11, 2, 4, h);
  R(3, 14, 1, 1, P.hairD); R(20, 14, 1, 1, P.hairD);
  // brilho em arco
  R(6, 3, 4, 1, P.hairL); R(5, 4, 3, 1, P.hairL); R(13, 4, 3, 1, light(c.hairColor, 0.2));
  R(4, 8, 16, 1, shade(c.hairColor, -0.08));
  if (c.hair === 'spiky') {
    R(5, 0, 2, 2, h); R(10, -1, 2, 3, h); R(15, 0, 2, 2, h); R(18, 2, 2, 2, h); R(2, 4, 2, 2, h); R(20, 5, 2, 2, h); R(1, 7, 2, 2, h);
  }
  if (c.hair === 'fluffy') {
    R(2, 3, 20, 6, h); R(1, 5, 1, 4, h); R(22, 5, 1, 4, h); R(5, 1, 14, 1, h); R(6, 3, 4, 1, P.hairL);
  }
  if (c.hair === 'bun') {
    const B = (x, y, w, hh, col) => R(x, y, w, hh, col);
    B(9, -2, 6, 4, h); B(8, -1, 8, 2, h); B(10, -2, 2, 1, P.hairL);
  }
}

function hairBackView(R, c, P) {
  const h = P.hair;
  if (c.hair === 'bald') return;
  for (const [y, a, b] of HEAD_ROWS) if (y <= 18) R(a, y, b - a + 1, 1, h);
  R(6, 3, 5, 1, P.hairL); R(5, 4, 3, 1, P.hairL);
  R(5, 17, 14, 1, P.hairD);
  if (c.hair === 'spiky') { R(5, 0, 2, 2, h); R(10, -1, 2, 3, h); R(15, 0, 2, 2, h); R(2, 4, 2, 2, h); R(20, 4, 2, 2, h); }
  if (c.hair === 'fluffy') { R(1, 4, 22, 14, h); R(3, 2, 18, 2, h); }
  if (c.hair === 'bun') { R(9, -2, 6, 4, h); R(8, -1, 8, 2, h); R(9, 1, 6, 1, P.hairD); }
  if (c.hair === 'long') { R(3, 17, 18, 11, h); R(4, 27, 16, 1, P.hairD); R(11, 18, 1, 9, P.hairD); }
  if (c.hair === 'bob') R(3, 17, 18, 2, h);
  if (c.hair === 'ponytail') { R(10, 15, 4, 11, h); R(10, 14, 4, 1, P.tc || GOLD); R(11, 17, 1, 8, P.hairD); }
  if (c.hair === 'braid') { for (let y = 16; y < 30; y += 3) { R(10, y, 4, 2, h); R(11, y + 2, 2, 1, P.hairD); } R(10, 30, 4, 1, GOLD); }
  if (c.hair === 'twintails') for (const x of [0, 20]) { R(x, 9, 4, 16, h); R(x + 1, 25, 2, 2, h); R(x, 8, 4, 2, GOLD); }
}

// ---------------------------------------------------------------- rosto
function face(R, c, P) {
  for (const [y, a, b] of FACE_ROWS) R(a, y, b - a + 1, 1, P.skin);
  R(4, 16, 1, 2, P.skinD); R(19, 16, 1, 2, P.skinD);
  R(3, 12, 1, 3, P.skin); R(20, 12, 1, 3, P.skin);
  // olhos grandes
  for (const [x, tail] of [[7, 6], [14, 17]]) {
    R(x, 12, 3, 1, LASH); R(tail, 12, 1, 1, LASH);
    R(x, 13, 3, 3, P.eye);
    R(x, 13, 1, 1, '#ffffff');
    R(x + 1, 15, 1, 1, P.eyeL);
    R(x + 2, 14, 1, 1, shadow(c.eyes, 0.3));
  }
  R(6, 16, 2, 1, P.blush); R(16, 16, 2, 1, P.blush);
  R(11, 17, 2, 1, shadow(c.skin, 0.35));
  if (c.glasses === 'round') {
    const g = '#3b3b48';
    R(6, 11, 5, 1, g); R(13, 11, 5, 1, g); R(6, 16, 5, 1, g); R(13, 16, 5, 1, g); R(6, 12, 1, 4, g); R(10, 12, 1, 4, g); R(13, 12, 1, 4, g); R(17, 12, 1, 4, g); R(11, 13, 2, 1, g);
  } else if (c.glasses === 'shades') {
    R(6, 12, 5, 3, '#1e1e28'); R(13, 12, 5, 3, '#1e1e28'); R(11, 12, 2, 1, '#1e1e28'); R(7, 12, 2, 1, '#5a5a7a'); R(14, 12, 2, 1, '#5a5a7a');
  }
}

// ---------------------------------------------------------------- enfeites de cabeça
function headgear(R, c, P, view) {
  const g = P.gc;
  const gD = P.gcD;
  const gL = P.gcL;
  const side = view === 'side';
  switch (c.headgear) {
    case 'cat':
      for (const [x, m] of side ? [[11, 1]] : [[5, 1], [16, 1]]) {
        R(x, -2, 2, 1, g); R(x - 1 * m + 1, -1, 3, 1, g); R(x - 1, 0, 4, 3, g); R(x, 0, 2, 2, view === 'back' ? gD : '#ffb3c6');
      }
      break;
    case 'bunny':
      for (const x of side ? [12] : [6, 15]) { R(x, -4, 3, 8, g); R(x + 1, -3, 1, 6, view === 'back' ? gD : '#ffb3c6'); R(x, -4, 3, 1, gL); }
      break;
    case 'halo':
      R(7, -3, 10, 1, GOLD); R(6, -2, 2, 1, GOLD); R(16, -2, 2, 1, GOLD); R(7, -1, 10, 1, shade(GOLD, -0.15)); R(8, -3, 3, 1, '#fff6c2');
      break;
    case 'wings':
      if (side) { R(14, 3, 6, 2, '#ffffff'); R(16, 5, 5, 2, '#e8ecf6'); R(18, 1, 3, 2, '#ffffff'); }
      else for (const [x, d] of [[0, 1], [20, -1]]) { R(x, 3, 4, 2, '#ffffff'); R(x + (d > 0 ? 0 : 1), 5, 3, 2, '#e8ecf6'); R(x + (d > 0 ? 1 : 0), 7, 3, 1, '#d6dceb'); R(x + (d > 0 ? 0 : 2), 1, 2, 2, '#ffffff'); }
      R(side ? 8 : 5, 3, side ? 8 : 14, 1, GOLD);
      break;
    case 'star':
      if (view !== 'back') { const x = side ? 13 : 16; R(x + 1, 2, 1, 1, GOLD); R(x, 3, 3, 1, GOLD); R(x - 1, 4, 5, 1, GOLD); R(x, 5, 3, 1, GOLD); R(x - 1, 6, 1, 1, GOLD); R(x + 3, 6, 1, 1, GOLD); R(x + 1, 4, 1, 1, '#fff6c2'); }
      break;
    case 'ribbon':
      R(13, -1, 4, 4, g); R(19, -1, 4, 4, g); R(17, 0, 2, 2, gD); R(14, 0, 2, 1, gL); R(20, 0, 2, 1, gL); R(16, 3, 2, 2, g); R(19, 3, 2, 2, g);
      break;
    case 'flower':
      if (view !== 'back') { const x = side ? 12 : 17; R(x - 2, 4, 2, 2, g); R(x + 1, 4, 2, 2, g); R(x - 1, 2, 2, 2, g); R(x - 1, 6, 2, 2, g); R(x, 4, 1, 2, '#ffd84d'); R(x - 1, 5, 1, 1, '#ffd84d'); }
      break;
    case 'crown':
      R(7, 0, 10, 3, GOLD); R(7, -2, 2, 2, GOLD); R(11, -3, 2, 3, GOLD); R(15, -2, 2, 2, GOLD); R(7, 2, 10, 1, shade(GOLD, -0.2));
      R(11, 1, 2, 1, '#d64545'); R(8, 1, 1, 1, '#5db3ff'); R(15, 1, 1, 1, '#7be07b'); R(8, 0, 3, 1, '#fff6c2');
      break;
    case 'witch':
      R(0, 6, 24, 2, g); R(1, 8, 22, 1, gD); R(2, 5, 20, 1, g);
      R(6, 1, 12, 4, g); R(8, -1, 8, 2, g); R(10, -3, 5, 2, g); R(13, -4, 4, 1, g); R(16, -3, 2, 1, g);
      R(6, 4, 12, 1, GOLD); R(8, 1, 2, 3, gL);
      break;
    case 'beret':
      R(3, 1, 17, 4, g); R(2, 3, 2, 2, g); R(4, 0, 12, 1, g); R(11, -1, 2, 1, gD); R(5, 1, 5, 1, gL); R(3, 5, 17, 1, gD);
      break;
    case 'horns':
      for (const [x, d] of side ? [[11, 1]] : [[5, -1], [17, 1]]) { R(x, 1, 2, 3, '#f3ead6'); R(x + d, -1, 2, 2, '#f3ead6'); R(x + d * 2, -2, 1, 1, '#d6c9a8'); }
      break;
    case 'sprout':
      R(11, -3, 1, 5, '#4f9b3f'); R(8, -4, 3, 2, '#62b552'); R(12, -5, 3, 2, '#7bc86a'); R(9, -4, 1, 1, '#9be08a');
      break;
    case 'goggles':
      R(3, 6, 18, 2, g); if (view !== 'back') { R(6, 5, 5, 4, '#3b3b48'); R(13, 5, 5, 4, '#3b3b48'); R(7, 6, 3, 2, '#9bd7ff'); R(14, 6, 3, 2, '#9bd7ff'); R(7, 6, 1, 1, '#ffffff'); R(14, 6, 1, 1, '#ffffff'); }
      break;
    default:
  }
}

// ---------------------------------------------------------------- vista lateral (virado para a esquerda)
function sideView(R, c, P, frame, sit) {
  const robe = robeLike(c.outfit);
  const stride = !sit && (frame === 1 || frame === 3);
  const back = frame === 1;

  // capa
  if (c.cape !== 'none') {
    const end = c.cape === 'long' ? 34 : 29;
    for (let y = 21; y <= end; y++) R(14, y, 3 + Math.min(2, ((y - 21) / 5) | 0), 1, y % 5 === 0 ? P.ccD : P.cc);
  }

  // pernas
  const lc = (y) => (c.bottom === 'pants' ? P.bc : c.bottom === 'shorts' ? (y < 31 ? P.bc : P.skin) : y < 30 ? P.bc : P.skin);
  if (sit) {
    if (!robe) { R(5, 28, 8, 3, lc(29)); R(5, 31, 3, 2, lc(32)); }
    R(3, 32, 5, 2, P.shoe);
  } else if (robe) {
    R(stride ? 6 : 8, 34, 5, 2, P.shoe); if (stride) R(13, 34, 4, 2, shadow(c.shoes, 0.2));
  } else if (stride) {
    for (let y = 29; y <= 32; y++) { R(back ? 13 : 7, y, 3, 1, shadow(lc(y), 0.12)); R(back ? 7 : 13, y, 3, 1, lc(y)); }
    R(back ? 12 : 5, 33, 5, 2, shadow(c.shoes, 0.15)); R(back ? 5 : 12, 33, 5, 2, P.shoe);
  } else {
    for (let y = 29; y <= 32; y++) R(9, y, 5, 1, lc(y));
    R(7, 33, 6, 2, P.shoe); R(7, 33, 6, 1, P.shoeL);
  }

  // tronco
  R(8, 21, 8, 8, P.oc); R(8, 21, 8, 1, P.ocL); R(15, 22, 1, 6, P.ocD);
  if (robe) {
    const rows = sit ? [[29, 6, 10], [30, 5, 11]] : [[29, 7, 10], [30, 7, 10], [31, 6, 11], [32, 6, 11], [33, 5, 12]];
    for (const [y, x, w] of rows) R(x, y, w, 1, P.oc);
    R(5, rows[rows.length - 1][0], 12, 1, c.outfit === 'dress' ? P.tc : P.ocD);
  }
  if (c.outfit === 'tunic' && !sit) { R(7, 29, 10, 1, P.oc); R(7, 30, 10, 1, P.tc); }
  if (['tunic', 'armor', 'vest'].includes(c.outfit)) R(8, 28, 8, 1, '#5a3720');
  if (c.outfit === 'apron') { R(8, 23, 3, 7, P.oc); R(8, 21, 8, 2, P.tc); }
  if (c.outfit === 'suit') { R(8, 21, 2, 5, '#ffffff'); R(8, 22, 1, 4, P.tc); }
  if (c.outfit === 'hoodie') R(13, 19, 4, 3, P.ocD);
  if (c.outfit === 'armor') { R(10, 20, 6, 3, P.tc); R(10, 20, 6, 1, light(c.trimColor, 0.3)); }
  if (c.outfit === 'priest') R(8, 22, 2, 6, P.tc);

  // braço
  const ax = sit ? 9 : frame === 1 ? 9 : frame === 3 ? 12 : 10;
  const sl = sleeveLong(c.outfit) ? 6 : 2;
  const sleeve = c.outfit === 'armor' ? P.ocL : c.outfit === 'vest' || c.outfit === 'apron' ? P.tc : P.oc;
  R(ax, 21, 3, sl, shadow(sleeve, 0.08)); R(ax, 21 + sl, 3, 6 - sl, P.skin); R(ax, 27, 3, 1, P.skinD);

  // cabeça
  R(11, 20, 2, 1, P.skinD);
  for (const [y, a, b] of FACE_ROWS) R(a, y, b - a + 1, 1, P.skin);
  R(3, 14, 1, 2, P.skin); // nariz
  R(3, 18, 1, 1, P.skin);
  // olho
  R(5, 12, 3, 1, LASH); R(5, 13, 2, 3, P.eye); R(5, 13, 1, 1, '#ffffff'); R(6, 15, 1, 1, P.eyeL);
  R(5, 16, 2, 1, P.blush); R(4, 17, 2, 1, shadow(c.skin, 0.35));
  R(13, 13, 2, 3, P.skinD); // orelha
  if (c.glasses === 'round') { R(4, 11, 5, 1, '#3b3b48'); R(4, 16, 5, 1, '#3b3b48'); R(8, 12, 1, 4, '#3b3b48'); R(9, 13, 5, 1, '#3b3b48'); }
  if (c.glasses === 'shades') { R(4, 12, 5, 3, '#1e1e28'); R(9, 12, 5, 1, '#1e1e28'); }

  // cabelo (perfil)
  const h = P.hair;
  if (c.hair !== 'bald') {
    for (const [y, a, b] of [[1, 9, 15], [2, 7, 17], [3, 6, 19], [4, 5, 20], [5, 5, 20], [6, 5, 20], [7, 5, 20], [8, 5, 20]]) R(a, y, b - a + 1, 1, h);
    R(5, 9, 3, 1, h); R(5, 10, 2, 1, h); R(11, 9, 10, 1, h);
    R(13, 10, 8, 4, h); R(15, 14, 6, 3, h); R(16, 17, 4, 1, P.hairD);
    R(7, 3, 4, 1, P.hairL); R(6, 4, 3, 1, P.hairL);
    if (c.hair === 'long') { R(14, 17, 6, 11, h); R(15, 27, 4, 1, P.hairD); }
    if (c.hair === 'bob') R(14, 16, 6, 3, h);
    if (c.hair === 'ponytail') { R(19, 9, 3, 10, h); R(20, 10, 1, 8, P.hairD); R(19, 8, 2, 1, GOLD); }
    if (c.hair === 'twintails') { R(15, 9, 4, 16, h); R(15, 8, 4, 2, GOLD); R(16, 11, 1, 12, P.hairD); }
    if (c.hair === 'braid') { for (let y = 15; y < 29; y += 3) { R(16, y, 3, 2, h); R(17, y + 2, 2, 1, P.hairD); } R(16, 29, 3, 1, GOLD); }
    if (c.hair === 'spiky') { R(8, -1, 2, 2, h); R(13, -1, 2, 2, h); R(18, 1, 2, 2, h); R(20, 4, 2, 2, h); R(3, 6, 2, 2, h); }
    if (c.hair === 'fluffy') { R(4, 2, 18, 8, h); R(15, 10, 7, 8, h); R(6, 0, 12, 2, h); }
    if (c.hair === 'bun') { R(14, -1, 6, 4, h); R(15, -2, 4, 1, h); }
  } else {
    R(7, 7, 3, 1, P.skinL);
  }
  headgear(R, c, P, 'side');
}

function draw(g, c, dir, frame, sit) {
  const P = pal(c);
  const bob = !sit && (frame === 1 || frame === 3) ? -1 : 0;
  const seatDrop = sit ? 2 : 0;
  // R desenha em coordenadas do corpo; parte superior acompanha o "balanço" do passo
  const R = (x, y, w, h, col) => g.r(x, y + OFF + (y < 29 ? bob + seatDrop : seatDrop), w, h, col);

  if (dir === 'left') return sideView(R, c, P, frame, sit);
  const back = dir === 'up';
  if (back) {
    body(R, c, P, frame, sit, true);
    for (const [y, a, b] of FACE_ROWS) R(a, y, b - a + 1, 1, P.skin);
    hairBackView(R, c, P);
    headgear(R, c, P, 'back');
    return;
  }
  hairFrontBack(R, c, P); // mechas que ficam atrás dos ombros
  body(R, c, P, frame, sit, false);
  if (c.hair === 'long' || c.hair === 'bob' || c.hair === 'braid' || c.hair === 'fluffy') hairFrontBack(R, c, P);
  face(R, c, P);
  hairCap(R, c, P);
  headgear(R, c, P, 'front');
}

export const SPRITE_W = 24;
export const SPRITE_H = 40;

const cache = new Map();

/** Sprite do avatar (canvas 26x42 com contorno). */
export function avatarSprite(cfg, dir = 'down', frame = 0, sit = false) {
  const key = `${Object.values(cfg).join(',')}|${dir}|${frame}|${sit ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    s = art(SPRITE_W, SPRITE_H, (g, ctx) => {
      if (dir === 'right') { ctx.translate(SPRITE_W, 0); ctx.scale(-1, 1); }
      draw(g, cfg, dir === 'right' ? 'left' : dir, frame, sit);
    });
    if (cache.size > 2500) cache.clear();
    cache.set(key, s);
  }
  return s;
}

/** Miniatura focada no rosto. */
export function avatarThumb(cfg, size = 36, target) {
  const c = target || document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  const spr = avatarSprite(cfg, 'down', 0, false);
  // recorta do topo do chapéu até os ombros (26 x 26)
  ctx.drawImage(spr, 0, 1, 26, 26, 0, 0, size, size);
  return c;
}
