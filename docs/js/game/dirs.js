// Oito direções do personagem e dos móveis.
// Ângulo (graus) = para onde a coisa está virada, no sentido horário a partir de "para baixo":
//   0 baixo · 45 baixo-esq · 90 esq · 135 cima-esq · 180 cima · 225 cima-dir · 270 dir · 315 baixo-dir
export const DIRS8 = ['down', 'downleft', 'left', 'upleft', 'up', 'upright', 'right', 'downright'];

export const VEC = {
  down: [0, 1], downleft: [-1, 1], left: [-1, 0], upleft: [-1, -1],
  up: [0, -1], upright: [1, -1], right: [1, 0], downright: [1, 1],
};

/** Quadro do Ragnarok: as folhas têm 5 direções (S, SO, O, NO, N); o lado direito é espelhado. */
export const RO_DIR = {
  down: [0, false], downleft: [1, false], left: [2, false], upleft: [3, false],
  up: [4, false], upright: [3, true], right: [2, true], downright: [1, true],
};

export function dirFromVec(dx, dy) {
  if (!dx && !dy) return 'down';
  // atan2 com y para baixo; 0° = baixo, sentido horário
  let a = (Math.atan2(-dx, dy) * 180) / Math.PI;
  if (a < 0) a += 360;
  return DIRS8[Math.round(a / 45) % 8];
}

export function dirFromAngle(a = 0) {
  return DIRS8[Math.round((((a % 360) + 360) % 360) / 45) % 8];
}

export function angleOfDir(d) {
  const i = DIRS8.indexOf(d);
  return i < 0 ? 0 : i * 45;
}

/** Direção "simples" (4) para quem só tem 4 lados de arte. */
export function dir4(d) {
  if (d === 'downleft' || d === 'upleft') return 'left';
  if (d === 'downright' || d === 'upright') return 'right';
  return d || 'down';
}

export const isLeftish = (d) => d === 'left' || d === 'downleft' || d === 'upleft';
export const isRightish = (d) => d === 'right' || d === 'downright' || d === 'upright';
