// Regras do "Ragnarok d20" (guia de combate em PDF): núcleo d20 com atributos,
// defesas e status do Ragnarok Online. Funções puras — o combate em tempo real usa isto.

export const ATTRS = ['for', 'agi', 'vit', 'int', 'des', 'sor'];
export const ATTR_NAMES = { for: 'FOR', agi: 'AGI', vit: 'VIT', int: 'INT', des: 'DES', sor: 'SOR' };

export const mod = (v) => Math.floor((v - 10) / 2);
export const d = (n) => 1 + Math.floor(Math.random() * n);

/** Rola "XdY+Z" (ou "XdY-Z"). max = true dá o valor máximo (crítico). */
export function roll(expr, max = false) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ''));
  if (!m) return Number(expr) || 0;
  const [, n, s, b] = m;
  let total = Number(b || 0);
  for (let i = 0; i < Number(n); i++) total += max ? Number(s) : d(Number(s));
  return total;
}

// ------------------------------------------------------------------ classes (matriz do PDF + famílias extras no mesmo molde)
export const CLASSES = {
  cavaleiro: {
    name: 'Espadachim / Cavaleiro', die: 12, focus: ['for', 'vit'], armor: 6, bab: 1, weapon: '1d10', range: 1, element: 'Neutro',
    attrs: { for: 16, agi: 10, vit: 15, int: 8, des: 12, sor: 9 },
    skill: { id: 'bowling', name: 'Impacto de Tyr', sp: 22, desc: 'Ataque adjacente: dano da arma +2d8 e empurra 2 células; quem colidir sofre o mesmo dano (Fortitude CD 14 ou cai).' },
    unique: 'Montaria: dobra o deslocamento e dá vantagem em investidas.',
  },
  bruxo: {
    name: 'Mago / Bruxo', die: 4, focus: ['int', 'des'], armor: 0, bab: 0.5, weapon: '1d4', range: 5, element: 'Água', magic: true,
    attrs: { for: 8, agi: 11, vit: 10, int: 17, des: 15, sor: 10 },
    skill: { id: 'stormgust', name: 'Nevasca', sp: 78, desc: '1 turno de conjuração; raio de 5 células; 4d6 de Água por rodada por 3 rodadas. Reflexos CD 16 por rodada; 3 falhas = Congelamento.' },
    unique: 'Amplificação Mística: ação bônus para +50% no próximo feitiço.',
  },
  algoz: {
    name: 'Gatuno / Algoz', die: 8, focus: ['agi', 'des', 'sor'], armor: 2, bab: 0.75, weapon: '1d6', range: 1, element: 'Neutro', dual: true,
    attrs: { for: 12, agi: 17, vit: 10, int: 8, des: 15, sor: 14 },
    skill: { id: 'sonicblow', name: 'Lâminas Destruidoras', sp: 34, desc: '8 cortes num alvo, ataque com vantagem: 8d4 + AGI. Fortitude CD 15 ou Atordoamento.' },
    unique: 'Empunhadura dupla com Katar: ataque extra sem penalidade. +5 em Furtividade.',
  },
  sacerdote: {
    name: 'Noviço / Sacerdote', die: 8, focus: ['int', 'vit', 'sor'], armor: 4, bab: 0.75, weapon: '1d6', range: 4, element: 'Sagrado', magic: true,
    attrs: { for: 10, agi: 10, vit: 14, int: 15, des: 11, sor: 14 },
    skill: { id: 'magnificat', name: 'Magnificat', sp: 40, desc: 'Aliados até 9 m (6 células): regeneração de SP dobrada por 5 rodadas e vantagem contra Maldição e Silêncio.' },
    skill2: { id: 'heal', name: 'Curar', sp: 12, desc: 'Cura 2d8 + INT. Contra Morto-Vivo/Demônio vira dano Sagrado que ignora a CA.' },
    unique: 'Aura Divina: curas causam dano Sagrado a Morto-Vivo e Demônio.',
  },
  arqueiro: {
    name: 'Arqueiro / Caçador', die: 8, focus: ['des', 'agi'], armor: 2, bab: 0.75, weapon: '1d8', range: 6, element: 'Neutro',
    attrs: { for: 11, agi: 14, vit: 11, int: 10, des: 17, sor: 12 },
    skill: { id: 'doublestrafe', name: 'Rajada Dupla', sp: 12, desc: 'Dois disparos no mesmo alvo, cada um com +1 no acerto.' },
    unique: 'Ataques à distância (6 células).',
  },
  mercador: {
    name: 'Mercador / Ferreiro', die: 10, focus: ['for', 'vit'], armor: 3, bab: 0.75, weapon: '1d8', range: 1, element: 'Neutro',
    attrs: { for: 15, agi: 10, vit: 14, int: 10, des: 13, sor: 12 },
    skill: { id: 'bash', name: 'Golpe Fulminante', sp: 8, desc: '+2 no acerto e +1d6 de dano.' },
    unique: 'Carrinho: carrega mais itens (mascote "Carrinho").',
  },
  aprendiz: {
    name: 'Aprendiz', die: 8, focus: ['for', 'agi'], armor: 1, bab: 0.75, weapon: '1d6', range: 1, element: 'Neutro',
    attrs: { for: 12, agi: 12, vit: 12, int: 11, des: 12, sor: 11 },
    skill: { id: 'bash', name: 'Golpe Fulminante', sp: 8, desc: '+2 no acerto e +1d6 de dano.' },
    unique: 'Versátil: ainda não escolheu a classe.',
  },
};

const CLASS_RULES = [
  [/knight|crusader|lord|paladin|rune|swordman|templ|cavaleir|lorde/i, 'cavaleiro'],
  [/mage|wizard|warlock|sorcerer|scholar|sage|mago|bruxo|feiti|professor|arquimago/i, 'bruxo'],
  [/assassin|thief|rogue|ninja|guillotine|stalker|algoz|mercen|sic[aá]rio/i, 'algoz'],
  [/acolyte|priest|monk|bishop|champion|novi[cç]o|sacerdote|monge|arcebispo|mestre/i, 'sacerdote'],
  [/archer|hunter|bard|dancer|gypsy|minstrel|sniper|gunslinger|wanderer|maestro|arqueir|ca[cç]ador|bardo|odalisca|cigana|menestrel|musa|justiceiro/i, 'arqueiro'],
  [/merchant|alchemist|genetic|blacksmith|mastersmith|mercador|alquimista|bioqu/i, 'mercador'],
];

export function classOf(bodyIdOrName = '') {
  for (const [re, k] of CLASS_RULES) if (re.test(bodyIdOrName)) return k;
  return 'aprendiz';
}

/** Ficha de combate a partir da classe, nível de base e pontos distribuídos. */
export function sheet(cls, baseLevel = 1, extra = {}) {
  const C = CLASSES[cls] || CLASSES.aprendiz;
  const attrs = { ...C.attrs };
  for (const k of ATTRS) attrs[k] += extra[k] || 0;
  // +1 no atributo de foco a cada 4 níveis
  const bonus = Math.floor((baseLevel - 1) / 4);
  for (let i = 0; i < bonus; i++) attrs[C.focus[i % C.focus.length]] += 1;
  const m = Object.fromEntries(ATTRS.map((k) => [k, mod(attrs[k])]));
  const avg = Math.floor(C.die / 2) + 1;
  // PV do PDF (dado de vida + VIT por nível) × 4: no tempo real os golpes chegam a cada ~1,5 s,
  // então um personagem de nível 1 precisa aguentar mais que 2 golpes de um Orc.
  const maxHp = HP_SCALE * Math.max(4, C.die + m.vit + (baseLevel - 1) * Math.max(1, avg + m.vit));
  // SP mínimo: dá para usar a habilidade da classe ao menos uma vez já no nível 1
  const maxSp = Math.max(C.skill.sp + 6, 10 + m.int * 4 + (baseLevel - 1) * Math.max(1, 2 + m.int) + (C.magic ? 20 : 0));
  return {
    cls, className: C.name, level: baseLevel, attrs, mods: m, maxHp, maxSp,
    bab: Math.floor(baseLevel * C.bab),
    ca: 10 + m.agi + C.armor, // CA = 10 + AGI + Hard DEF
    hardDef: C.armor,
    softDef: Math.max(0, m.vit), // físico
    softMdef: Math.max(0, m.int), // mágico
    critRange: 20 - Math.max(0, Math.floor(m.sor / 3)),
    luck: Math.max(0, m.sor), // esquiva perfeita
    weapon: C.weapon, range: C.range, element: C.element, magic: !!C.magic,
    extraAttack: m.agi >= 4 || !!C.dual, // ASPD
  };
}

/** Ficha de um monstro do bestiário. */
export function mobSheet(m) {
  const attrs = m.attrs || { for: 10 + (m.atk || 2), agi: 10, vit: 10, int: 6, des: 10 + (m.atk || 2), sor: 8 };
  const md = Object.fromEntries(ATTRS.map((k) => [k, mod(attrs[k] || 10)]));
  return {
    cls: 'mob', className: m.name, level: Math.max(1, Math.round((m.hp || 10) / 8)), attrs, mods: md,
    maxHp: m.hp || 10, maxSp: 0, bab: 0, ca: m.ca || 11, hardDef: Math.max(0, (m.ca || 11) - 10 - md.agi), softDef: m.softDef || 0,
    softMdef: m.mdef || 0, critRange: m.critRange || 20, luck: Math.max(0, md.sor), weapon: m.dmg || '1d6', atk: m.atk || 2, range: 1,
    element: m.element || 'Neutro', immune: m.immune || [], weak: m.weak || {}, xp: m.xp || 10, boss: !!m.boss,
  };
}

// Tabela elemental resumida (atacante → defensor)
const ELEMENT = {
  Água: { Fogo: 2, Água: 0.25, Vento: 0.5 },
  Fogo: { Terra: 2, Água: 0.5, Fogo: 0.25 },
  Vento: { Água: 2, Terra: 0.5, Vento: 0.25 },
  Terra: { Vento: 2, Fogo: 0.5, Terra: 0.25 },
  Sagrado: { Sombrio: 2, 'Morto-Vivo': 2, Sagrado: 0 },
  Sombrio: { Sagrado: 2, Sombrio: 0 },
};

export function elementMod(atkEl, def) {
  if (def.immune && def.immune.includes(atkEl)) return 0;
  if (def.weak && def.weak[atkEl]) return def.weak[atkEl];
  const el = def.statusElement || def.element;
  return (ELEMENT[atkEl] && ELEMENT[atkEl][el]) ?? 1;
}

/**
 * Teste de ataque físico: d20 + DES + BAB (+bônus) vs CA.
 * Esquiva perfeita (SOR do alvo) e margem de crítico (SOR do atacante).
 * Devolve { hit, crit, perfect, nat, total, dmg, text }.
 */
export function attack(a, t, { bonus = 0, dice, extraDice, element, magic = false, advantage = false, status = {} } = {}) {
  let nat = d(20);
  if (advantage) nat = Math.max(nat, d(20));
  const cursedA = status.attackerCursed;
  const crit = !cursedA && nat >= a.critRange;
  const tgtLuck = t.statusCursed ? 0 : t.luck;
  if (!crit && nat <= tgtLuck && nat !== 20) {
    return { hit: false, perfect: true, nat, total: nat, dmg: 0, text: 'Esquiva perfeita!' };
  }
  const atkMod = magic ? a.mods.int : a.mods.des;
  const total = nat + atkMod + a.bab + bonus + (a.atk || 0);
  const ca = t.frozen || t.stunned ? 10 + t.hardDef : t.ca; // atordoado/congelado: CA de AGI vai a 0
  const hit = crit || nat === 20 || (nat !== 1 && total >= ca);
  if (!hit) return { hit: false, nat, total, ca, dmg: 0, text: `Errou (${total} vs CA ${ca})` };
  const expr = dice || a.weapon;
  let base = cursedA ? Number(/^(\d+)/.exec(expr)[1]) : roll(expr, crit);
  if (extraDice) base += roll(extraDice, crit);
  base += magic ? Math.max(0, a.mods.int) : Math.max(0, a.mods.for);
  const el = element || a.element || 'Neutro';
  const mult = elementMod(el, t);
  const soft = magic ? t.softMdef : Math.floor(t.softDef * (t.poisoned ? 0.75 : 1));
  const dmg = Math.max(mult === 0 ? 0 : 1, Math.round(base * mult) - soft);
  return { hit: true, crit, nat, total, ca, dmg, mult, text: crit ? `CRÍTICO! ${dmg}` : `${dmg}` };
}

/** Teste de resistência: d20 + mod vs CD. */
export function save(sheetObj, kind, dc, advantage = false) {
  const m = kind === 'fort' ? sheetObj.mods.vit : kind === 'ref' ? sheetObj.mods.agi : sheetObj.mods.int;
  let r = d(20);
  if (advantage) r = Math.max(r, d(20));
  return r + m >= dc;
}

// Condições de status do PDF (duração em rodadas; 1 rodada = 3 s no tempo real)
export const STATUS = {
  stun: { name: 'Atordoamento', icon: '💫', save: 'fort', dc: (src) => 10 + (src ? src.mods.for : 0), rounds: 1, desc: 'Não age nem reage; CA de AGI cai a 0.' },
  freeze: { name: 'Congelamento', icon: '🧊', save: 'fort', dc: () => 12, rounds: 3, desc: 'Não age; vira Água 1 (+100% de Vento); quebra com dano físico.' },
  petrify: { name: 'Petrificação', icon: '🗿', save: 'fort', dc: () => 14, rounds: 3, desc: '1ª rodada lento; depois paralisado, Hard DEF +5 e vira Terra 1 (+100% de Fogo).' },
  curse: { name: 'Maldição', icon: '💀', save: 'will', dc: () => 13, rounds: 3, desc: 'Move 1 célula por turno; SOR 0 (sem crítico nem esquiva perfeita); dano mínimo.' },
  silence: { name: 'Silêncio', icon: '🤐', save: 'will', dc: () => 12, rounds: 3, desc: 'Não conjura habilidades com custo de SP.' },
  poison: { name: 'Envenenamento', icon: '🤢', save: 'fort', dc: () => 11, rounds: 4, desc: 'Perde 1d6 + VIT do atacante por turno; Soft DEF −25%.' },
};

export const ROUND_MS = 3000;
export const HP_SCALE = 4;
export const ACTION_MS = 1500;

/** Experiência de base/classe para o próximo nível. */
export function expToNext(level) {
  return Math.round(40 * level * level + 60 * level);
}

export function addExp(state, amount) {
  const s = { baseLevel: 1, baseExp: 0, jobLevel: 1, jobExp: 0, ...state };
  s.baseExp += amount;
  s.jobExp += Math.round(amount * 0.75);
  let up = 0;
  while (s.baseExp >= expToNext(s.baseLevel) && s.baseLevel < 99) { s.baseExp -= expToNext(s.baseLevel); s.baseLevel += 1; up += 1; }
  while (s.jobExp >= expToNext(s.jobLevel) && s.jobLevel < 50) { s.jobExp -= expToNext(s.jobLevel); s.jobLevel += 1; }
  return { state: s, up };
}
