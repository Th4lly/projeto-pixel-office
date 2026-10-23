// Catálogo de objetos. Todos têm alguma interação (tecla X ou clique).
// w/h = área no chão (tiles) · ah = altura do desenho (px de arte, 24 por tile)
// solid = bloqueia passagem · sit = dá para sentar · flat = desenhado no chão
// walk = dá para pisar · anim = desenho animado (4 quadros) · light = brilha quando ligado
import { art, shade, mix, light, shadow, rng } from './pixel.js';

const WOOD = { top: '#d9a86b', topL: '#efc98f', front: '#a76f3e', dark: '#6d4325', leg: '#57341c' };
const GOLD = '#f2c14e';
const IRON = '#7c8096';

// ---------------------------------------------------------------- peças reutilizáveis
function tableTop(g, w, y, h = 10, wood = WOOD) {
  g.r(0, y, w, h, wood.top);
  g.r(0, y, w, 1, wood.topL);
  g.r(1, y + 1, w - 2, 1, light(wood.top, 0.1));
  g.r(0, y + h, w, 7, wood.front);
  g.r(0, y + h, w, 1, shadow(wood.front, 0.2));
  g.r(0, y + h + 6, w, 1, shadow(wood.front, 0.35));
}

function legs(g, w, y, h, c = WOOD.leg, inset = 2) {
  g.r(inset, y, 3, h, c);
  g.r(w - inset - 3, y, 3, h, c);
  g.r(inset, y, 1, h, light(c, 0.15));
}

function deskBase(g) {
  tableTop(g, 48, 10, 10);
  g.r(30, 22, 16, 5, shade(WOOD.front, -0.06));
  g.r(36, 24, 4, 1, GOLD);
  legs(g, 48, 27, 6);
}

function pot(g, x, y, w, h, c = '#c8693e') {
  g.r(x, y, w, 2, light(c, 0.2));
  g.r(x + 1, y + 2, w - 2, h - 2, c);
  g.r(x + w - 3, y + 2, 2, h - 2, shadow(c, 0.2));
  g.r(x + 2, y + 3, 1, h - 4, light(c, 0.15));
}

function leafBlob(g, cx, cy, rx, ry, c) {
  g.el(cx, cy, rx, ry, c);
  g.el(cx - rx * 0.25, cy - ry * 0.3, rx * 0.55, ry * 0.45, light(c, 0.18));
  g.px(Math.round(cx + rx * 0.3), Math.round(cy - ry * 0.2), light(c, 0.35));
}

function flame(g, cx, y, f, big = 1) {
  const sway = [0, 1, 0, -1][f % 4];
  g.el(cx + sway, y + 3 * big, 2 * big, 3.5 * big, '#ff8a2a');
  g.el(cx + sway, y + 4 * big, 1.2 * big, 2.3 * big, '#ffd84d');
  g.px(cx + sway, y + 1, '#fff6c2');
}

function cushion(g, x, y, w, h, c) {
  g.box(x, y, w, h, c, { round: true, l: 0.25, d: 0.25 });
}

function screen(g, x, y, w, h, on, f = 0, scheme = 'blue') {
  g.r(x, y, w, h, '#232332');
  if (!on) {
    g.r(x + 1, y + 1, w - 2, h - 2, '#2f3346');
    g.r(x + 2, y + 2, Math.max(1, (w / 3) | 0), 1, '#454b64');
    return;
  }
  const bg = scheme === 'green' ? '#14301f' : '#2f6fc9';
  g.r(x + 1, y + 1, w - 2, h - 2, bg);
  const ink = scheme === 'green' ? '#5cff8f' : '#d8ecff';
  for (let i = 0; i < (h - 3) / 2; i++) g.r(x + 2, y + 2 + i * 2, ((w - 4) * (0.4 + (((i + f) * 37) % 50) / 100)) | 0, 1, ink);
}

// ---------------------------------------------------------------- catálogo
export const OBJECTS = {
  // ======================== MÓVEIS ========================
  desk: {
    name: 'Mesa de trabalho', cat: 'Móveis', w: 2, h: 1, ah: 34, solid: true, interact: 'desk', label: 'abrir a mesa',
    desc: 'Mesa pessoal. Reivindique para receber notificações (GitHub, Asana...) nela.',
    draw(g) {
      deskBase(g);
      g.r(6, 11, 9, 7, '#f6efdc'); g.r(7, 12, 7, 1, '#cfc2a3'); g.r(7, 14, 5, 1, '#cfc2a3'); g.r(8, 10, 9, 7, '#fffaf0');
      g.r(9, 12, 6, 1, '#cfc2a3'); g.r(9, 14, 4, 1, '#cfc2a3');
      g.r(34, 8, 4, 6, '#2b2b3b'); g.px(35, 9, '#5a6aa8'); g.line(37, 3, 34, 9, '#e9e1cf');
      g.box(22, 10, 8, 3, '#8e3b46'); g.box(23, 7, 7, 3, '#3b6b8e'); g.box(22, 4, 8, 3, '#5e8e3b');
    },
  },
  desk_pc: {
    name: 'Mesa com computador', cat: 'Móveis', w: 2, h: 1, ah: 36, solid: true, interact: 'desk', label: 'abrir a mesa',
    desc: 'Estação de trabalho com computador.',
    draw(g, o) {
      deskBase(g);
      g.box(14, 0, 20, 15, '#e6e0d2'); screen(g, 16, 2, 16, 10, true, 0);
      g.r(22, 15, 4, 2, '#cfc7b6'); g.r(18, 17, 12, 1, '#b8af9c');
      g.box(13, 18, 16, 3, '#d9d3c4'); g.box(32, 18, 3, 3, '#d9d3c4');
      g.r(3, 12, 6, 6, '#3f7d4a'); pot(g, 3, 15, 6, 5, '#d8d0be');
      g.box(39, 13, 5, 5, '#e9e3d6'); g.r(40, 14, 3, 2, '#7a4a2a');
      if (o.state && o.state.badge) g.px(46, 10, '#ff4d6d');
    },
  },
  desk_magic: {
    name: 'Mesa do arcano', cat: 'Móveis', w: 2, h: 1, ah: 36, solid: true, interact: 'desk', label: 'abrir a mesa', anim: true,
    desc: 'Mesa de estudos com bola de cristal.',
    draw(g, o, f) {
      deskBase(g);
      g.box(19, 14, 10, 4, GOLD);
      const glow = ['#9bd7ff', '#b7a4ff', '#9bd7ff', '#c7f0ff'][f];
      g.el(24, 8, 6, 6, '#5d7fd6'); g.el(24, 8, 5, 5, glow); g.el(22, 6, 2, 2, '#ffffff');
      g.r(4, 13, 12, 5, '#f3e5bf'); g.r(4, 13, 2, 5, '#c9a96a'); g.r(14, 13, 2, 5, '#c9a96a'); g.r(7, 15, 5, 1, '#8a6a4a');
      g.r(38, 8, 3, 9, '#f6efe0'); flame(g, 39, 2, f, 0.8);
    },
  },
  chair: {
    name: 'Cadeira', cat: 'Móveis', w: 1, h: 1, ah: 30, sit: true, colorable: true, color: '#6b3fa0', interact: 'sit', label: 'sentar',
    desc: 'Ande até ela para sentar.',
    draw(g, o) {
      const c = o.color;
      g.r(4, 0, 16, 2, WOOD.dark); g.r(3, 2, 18, 12, WOOD.front); cushion(g, 5, 3, 14, 10, c);
      g.r(2, 14, 20, 7, WOOD.front); cushion(g, 3, 13, 18, 6, light(c, 0.05));
      legs(g, 24, 21, 8, WOOD.leg, 3);
    },
  },
  stool: {
    name: 'Banquinho', cat: 'Móveis', w: 1, h: 1, ah: 18, sit: true, interact: 'sit', label: 'sentar',
    desc: 'Banquinho de taverna.',
    draw(g) {
      g.el(12, 4, 9, 4, WOOD.top); g.el(11, 3, 6, 2, WOOD.topL); g.r(3, 5, 18, 3, WOOD.front);
      g.r(5, 8, 3, 9, WOOD.leg); g.r(16, 8, 3, 9, WOOD.leg); g.r(10, 8, 3, 8, shade(WOOD.leg, -0.15)); g.r(6, 13, 12, 2, WOOD.dark);
    },
  },
  bench: {
    name: 'Banco', cat: 'Móveis', w: 2, h: 1, ah: 22, sit: true, interact: 'sit', label: 'sentar',
    desc: 'Banco comprido de madeira.',
    draw(g) {
      g.r(0, 0, 48, 3, WOOD.dark); g.r(1, 3, 46, 6, WOOD.front); g.r(1, 3, 46, 1, light(WOOD.front, 0.2)); g.r(1, 6, 46, 1, shadow(WOOD.front, 0.2));
      g.r(0, 9, 48, 6, WOOD.top); g.r(0, 9, 48, 1, WOOD.topL); g.r(0, 15, 48, 2, WOOD.front);
      legs(g, 48, 17, 5, WOOD.leg, 3); g.r(22, 17, 4, 5, WOOD.leg);
    },
  },
  sofa: {
    name: 'Sofá', cat: 'Móveis', w: 2, h: 1, ah: 28, sit: true, colorable: true, color: '#a8343f', interact: 'sit', label: 'sentar',
    desc: 'Sofá estofado.',
    draw(g, o) {
      const c = o.color;
      g.box(2, 0, 44, 14, c, { round: true }); g.r(23, 2, 2, 11, shadow(c, 0.2));
      g.box(0, 7, 7, 17, shadow(c, 0.08), { round: true }); g.box(41, 7, 7, 17, shadow(c, 0.08), { round: true });
      cushion(g, 7, 13, 17, 9, light(c, 0.06)); cushion(g, 24, 13, 17, 9, light(c, 0.06));
      g.r(3, 24, 4, 3, WOOD.leg); g.r(41, 24, 4, 3, WOOD.leg);
      g.px(10, 4, GOLD); g.px(37, 4, GOLD);
    },
  },
  armchair: {
    name: 'Poltrona', cat: 'Móveis', w: 1, h: 1, ah: 28, sit: true, colorable: true, color: '#3f5aa8', interact: 'sit', label: 'sentar',
    desc: 'Poltrona confortável.',
    draw(g, o) {
      const c = o.color;
      g.box(2, 0, 20, 14, c, { round: true });
      g.box(0, 7, 5, 16, shadow(c, 0.08), { round: true }); g.box(19, 7, 5, 16, shadow(c, 0.08), { round: true });
      cushion(g, 5, 13, 14, 9, light(c, 0.06));
      g.r(2, 23, 3, 4, WOOD.leg); g.r(19, 23, 3, 4, WOOD.leg);
    },
  },
  throne: {
    name: 'Trono', cat: 'Móveis', w: 1, h: 1, ah: 40, sit: true, colorable: true, color: '#a8343f', interact: 'sit', label: 'sentar no trono',
    desc: 'Para o chefe da guilda (ou quem chegar primeiro).',
    draw(g, o) {
      g.box(2, 0, 20, 26, GOLD); g.px(11, 1, '#e8f4ff'); g.px(5, 3, '#ff5d73'); g.px(18, 3, '#5db3ff');
      g.r(5, 4, 14, 19, o.color); g.r(6, 5, 12, 2, light(o.color, 0.2));
      g.box(0, 18, 24, 12, shade(GOLD, -0.1)); cushion(g, 3, 19, 18, 7, o.color);
      g.r(1, 30, 4, 9, shade(GOLD, -0.25)); g.r(19, 30, 4, 9, shade(GOLD, -0.25));
    },
  },
  beanbag: {
    name: 'Puff', cat: 'Móveis', w: 1, h: 1, ah: 16, sit: true, colorable: true, color: '#e07a5f', interact: 'sit', label: 'sentar',
    desc: 'Puff macio.',
    draw(g, o) {
      g.el(12, 9, 11, 7, shadow(o.color, 0.15)); g.el(12, 7, 10, 6, o.color); g.el(9, 5, 5, 3, light(o.color, 0.22)); g.px(8, 4, light(o.color, 0.45));
    },
  },
  table_round: {
    name: 'Mesinha', cat: 'Móveis', w: 1, h: 1, ah: 24, solid: true, interact: 'tea', label: 'servir um chá',
    desc: 'Mesinha redonda.',
    draw(g) {
      g.el(12, 6, 11, 6, WOOD.top); g.el(11, 5, 8, 3, WOOD.topL); g.r(1, 7, 22, 4, WOOD.front);
      g.r(10, 11, 4, 9, WOOD.leg); g.el(12, 21, 6, 2, WOOD.dark);
      g.box(13, 2, 5, 3, '#f6f1e8'); g.px(14, 2, '#8a5a3a');
    },
  },
  table_long: {
    name: 'Mesa de banquete', cat: 'Móveis', w: 3, h: 1, ah: 30, solid: true, interact: 'feast', label: 'servir o banquete',
    desc: 'Mesa comprida para refeições da guilda.',
    draw(g) {
      tableTop(g, 72, 8, 10);
      g.r(4, 9, 64, 8, '#f3ead6'); g.r(4, 9, 64, 1, '#fffaf0'); g.r(4, 16, 64, 1, '#d8ccb0');
      g.el(14, 11, 5, 3, '#d8d0c4'); g.el(14, 10, 3, 2, '#c97a3a');
      g.el(36, 11, 6, 3, '#d8d0c4'); g.el(36, 10, 4, 2, '#e3b64a'); g.px(35, 9, '#7ab84f');
      g.el(58, 11, 5, 3, '#d8d0c4'); g.el(58, 10, 3, 2, '#b8433f');
      g.r(25, 5, 3, 7, '#c9d7e8'); g.r(46, 5, 3, 7, '#e8c9c9');
      legs(g, 72, 25, 5, WOOD.leg, 4); g.r(34, 25, 4, 5, WOOD.leg);
    },
  },
  meeting_table: {
    name: 'Mesa de reunião', cat: 'Móveis', w: 4, h: 2, ah: 48, solid: true, interact: 'notes', label: 'abrir notas da reunião',
    desc: 'Inicie aqui as notas e transcrição da reunião.',
    draw(g) {
      g.r(0, 4, 96, 30, '#8a5a36'); g.r(2, 5, 92, 28, WOOD.top); g.r(2, 5, 92, 2, WOOD.topL);
      g.r(6, 9, 84, 20, '#3f8a5c'); g.r(8, 11, 80, 16, '#4f9b6a'); g.r(8, 11, 80, 1, '#6fbb8a');
      g.r(0, 34, 96, 7, WOOD.front); g.r(0, 40, 96, 1, shadow(WOOD.front, 0.3));
      g.box(14, 14, 12, 8, '#f6efdc'); g.r(16, 16, 8, 1, '#a89878'); g.r(16, 18, 6, 1, '#a89878');
      g.box(66, 15, 10, 7, '#2b2b3b'); g.r(67, 16, 8, 4, '#5aa0e8');
      g.el(46, 18, 4, 4, '#cfe8ff'); g.el(45, 17, 2, 2, '#ffffff');
      legs(g, 96, 41, 7, WOOD.leg, 6);
    },
  },
  bed: {
    name: 'Cama', cat: 'Móveis', w: 1, h: 2, ah: 50, solid: true, colorable: true, color: '#5b7fd6', interact: 'rest', label: 'tirar um cochilo',
    desc: 'Descanse: seu status fica "Ausente".',
    draw(g, o) {
      g.box(0, 0, 24, 14, WOOD.front); g.r(3, 3, 18, 1, light(WOOD.front, 0.3));
      g.r(1, 12, 22, 34, '#f6f1e8'); cushion(g, 3, 13, 18, 8, '#ffffff');
      g.r(1, 22, 22, 24, o.color); g.r(1, 22, 22, 2, light(o.color, 0.3)); g.r(3, 26, 18, 1, shadow(o.color, 0.15)); g.r(3, 32, 18, 1, shadow(o.color, 0.15));
      g.r(0, 46, 24, 4, WOOD.dark);
    },
  },
  bookshelf: {
    name: 'Estante', cat: 'Móveis', w: 2, h: 1, ah: 52, solid: true, interact: 'links', label: 'abrir a biblioteca de links',
    desc: 'Biblioteca de links e documentos do time.',
    draw(g) {
      g.r(0, 0, 48, 52, '#6d4325'); g.r(0, 0, 48, 3, '#8a5a36'); g.r(0, 0, 48, 1, '#a8713f');
      const colors = ['#a8343f', '#3f5aa8', '#3f8a5c', '#e3b64a', '#6e4aa0', '#d9783a', '#2f8a8a', '#efe3c9'];
      for (let s = 0; s < 3; s++) {
        const sy = 4 + s * 16;
        g.r(3, sy, 42, 14, '#3d2414');
        const r = rng(s * 17 + 3);
        let x = 4;
        while (x < 43) {
          const bw = 2 + ((r() * 3) | 0);
          const bh = 8 + ((r() * 5) | 0);
          if (x + bw > 44) break;
          if (r() < 0.12) { g.el(x + 2, sy + 11, 2, 2, '#9bd7ff'); x += 5; continue; }
          const c = colors[(r() * colors.length) | 0];
          g.r(x, sy + 14 - bh, bw, bh, c); g.r(x, sy + 14 - bh, bw, 1, light(c, 0.35)); g.r(x, sy + 14 - bh + 3, bw, 1, GOLD);
          x += bw + (r() < 0.2 ? 1 : 0);
        }
        g.r(2, sy + 14, 44, 2, '#8a5a36');
      }
    },
  },
  wardrobe: {
    name: 'Guarda-roupa', cat: 'Móveis', w: 1, h: 1, ah: 46, solid: true, interact: 'wardrobe', label: 'trocar de roupa',
    desc: 'Personalize seu avatar.',
    draw(g) {
      g.box(0, 0, 24, 46, WOOD.front); g.r(0, 0, 24, 3, WOOD.dark);
      g.box(2, 4, 9, 36, light(WOOD.front, 0.08)); g.box(13, 4, 9, 36, light(WOOD.front, 0.08));
      g.r(9, 20, 1, 4, GOLD); g.r(14, 20, 1, 4, GOLD);
      g.r(4, 7, 5, 6, shade(WOOD.front, -0.08)); g.r(15, 7, 5, 6, shade(WOOD.front, -0.08));
      g.r(2, 42, 3, 4, WOOD.leg); g.r(19, 42, 3, 4, WOOD.leg);
    },
  },
  chest: {
    name: 'Baú', cat: 'Móveis', w: 1, h: 1, ah: 20, solid: true, colorable: true, color: '#a76f3e', interact: 'stash', label: 'abrir o baú (bloco de notas)',
    desc: 'Bloco de notas compartilhado.',
    draw(g, o) {
      const c = o.color;
      g.el(12, 5, 11, 5, light(c, 0.05)); g.r(1, 5, 22, 14, c);
      g.r(1, 8, 22, 2, shadow(c, 0.25)); g.r(1, 5, 22, 1, light(c, 0.25));
      g.r(4, 1, 2, 18, IRON); g.r(18, 1, 2, 18, IRON);
      g.box(10, 8, 4, 5, GOLD); g.px(11, 10, '#5a3a10');
    },
  },
  counter: {
    name: 'Balcão', cat: 'Móveis', w: 1, h: 1, ah: 30, solid: true, interact: 'drink', label: 'pedir uma bebida',
    desc: 'Balcão da taverna.',
    draw(g) {
      g.r(0, 6, 24, 8, WOOD.top); g.r(0, 6, 24, 1, WOOD.topL); g.r(0, 13, 24, 1, shadow(WOOD.top, 0.25));
      g.r(0, 14, 24, 16, WOOD.front); g.r(0, 14, 24, 1, light(WOOD.front, 0.15));
      g.r(1, 17, 22, 1, shadow(WOOD.front, 0.2)); g.r(1, 23, 22, 1, shadow(WOOD.front, 0.2)); g.r(11, 14, 2, 16, shadow(WOOD.front, 0.15));
    },
  },
  potion_shelf: {
    name: 'Prateleira de poções', cat: 'Móveis', w: 2, h: 1, ah: 40, solid: true, interact: 'potion', label: 'tomar uma poção',
    desc: 'Poções de foco, energia e criatividade (buffs divertidos).',
    draw(g) {
      g.r(0, 0, 48, 40, '#5a3720'); g.r(0, 0, 48, 2, '#7d4f30');
      const cols = ['#ff5d73', '#5db3ff', '#7be07b', '#f2c14e', '#c38bff', '#ff9a4d'];
      for (let s = 0; s < 2; s++) {
        const sy = 3 + s * 18;
        g.r(2, sy, 44, 16, '#3a2312');
        for (let i = 0; i < 6; i++) {
          const x = 4 + i * 7;
          const c = cols[(i + s * 2) % 6];
          g.r(x + 1, sy + 3, 2, 3, '#d8e6f0');
          g.el(x + 2, sy + 11, 3, 4, c); g.px(x + 1, sy + 9, '#ffffff');
          g.r(x + 1, sy + 2, 2, 1, '#8a5a36');
        }
        g.r(1, sy + 15, 46, 2, '#7d4f30');
      }
    },
  },
  cauldron: {
    name: 'Caldeirão', cat: 'Cozinha', w: 1, h: 1, ah: 24, solid: true, interact: 'soup', label: 'pegar uma sopa', anim: true,
    desc: 'Sopa quentinha da guilda.',
    draw(g, o, f) {
      flame(g, 7, 16, f, 0.9); flame(g, 16, 16, (f + 2) % 4, 0.9);
      g.el(12, 13, 11, 8, '#2d2d38'); g.el(12, 9, 10, 3, '#3b3b48'); g.el(12, 9, 8, 2, '#7bd06a');
      g.px(9 + f, 8, '#b6f5a0'); g.px(15 - f, 9, '#b6f5a0');
      g.el(9, 11, 3, 4, '#4a4a5a');
      if (f % 2) g.el(14, 4, 2, 2, 'rgba(255,255,255,.5)'); else g.el(10, 3, 2, 2, 'rgba(255,255,255,.5)');
    },
  },

  // ======================== DECORAÇÃO ========================
  plant: {
    name: 'Vaso de planta', cat: 'Decoração', w: 1, h: 1, ah: 30, solid: true, interact: 'water', label: 'regar a planta',
    desc: 'Regue para ela crescer.',
    draw(g, o) {
      const s = (o.state && o.state.g) || 0;
      const leaf = '#4f9b3f';
      leafBlob(g, 12, 13 - s, 7 + s, 6 + s, leaf);
      leafBlob(g, 7, 10 - s, 4, 4, shade(leaf, 0.06)); leafBlob(g, 17, 9 - s, 4, 4, shade(leaf, -0.04));
      if (s >= 2) { g.px(9, 8 - s, '#ff9ec2'); g.px(15, 11 - s, '#fff2a8'); g.px(12, 5 - s, '#ff9ec2'); }
      pot(g, 5, 20, 14, 10);
    },
  },
  plant_big: {
    name: 'Palmeira', cat: 'Decoração', w: 1, h: 1, ah: 44, solid: true, interact: 'water', label: 'regar a planta',
    desc: 'Planta alta de interior.',
    draw(g, o) {
      const s = (o.state && o.state.g) || 0;
      g.r(11, 12, 2, 22, '#6d8a3a');
      for (const [x, y, rx, ry, c] of [[6, 9, 6, 4, '#4f9b3f'], [17, 7, 6, 4, '#5aa84a'], [8, 3, 5, 4, '#62b552'], [16, 15, 6, 4, '#4f9b3f'], [6, 18, 5, 4, '#5aa84a']]) leafBlob(g, x, y - s, rx + s * 0.5, ry, c);
      if (s >= 2) g.px(12, 1, '#fff2a8');
      pot(g, 4, 33, 16, 11, '#e9e1cf');
    },
  },
  tree: {
    name: 'Árvore', cat: 'Decoração', w: 1, h: 1, ah: 64, solid: true, interact: 'water', label: 'regar a árvore',
    desc: 'Árvore de jardim.',
    draw(g, o) {
      const s = (o.state && o.state.g) || 0;
      g.floorShadow(12, 60, 11, 4);
      g.r(9, 36, 6, 26, '#7a4e2c'); g.r(9, 36, 2, 26, '#946240'); g.r(6, 58, 12, 4, '#7a4e2c');
      const c = '#4c9a3c';
      leafBlob(g, 12, 26, 13, 12, shadow(c, 0.1)); leafBlob(g, 6, 20, 8, 8, c); leafBlob(g, 18, 18, 8, 8, c); leafBlob(g, 12, 10, 10, 9, light(c, 0.05));
      if (s >= 1) { g.px(6, 18, '#ff5d73'); g.px(17, 24, '#ff5d73'); }
      if (s >= 2) { g.px(13, 7, '#ff5d73'); g.px(4, 26, '#ff5d73'); g.px(20, 13, '#ff5d73'); }
    },
  },
  flowers: {
    name: 'Canteiro de flores', cat: 'Decoração', w: 1, h: 1, ah: 18, solid: true, colorable: true, color: '#ff8fb8', interact: 'water', label: 'regar as flores',
    desc: 'Flores que desabrocham quando regadas.',
    draw(g, o) {
      const s = (o.state && o.state.g) || 0;
      g.r(1, 10, 22, 8, '#7a4e2c'); g.r(1, 10, 22, 1, '#946240');
      for (let i = 0; i < 5; i++) {
        const x = 3 + i * 4;
        g.r(x + 1, 4 + (i % 2) * 2, 1, 7, '#4f9b3f'); g.px(x, 7 + (i % 2), '#62b552');
        if (s >= 1 || i % 2 === 0) { g.el(x + 1, 3 + (i % 2) * 2, 2, 2, i % 2 ? '#fff2a8' : o.color); g.px(x + 1, 3 + (i % 2) * 2, '#ffd84d'); }
      }
    },
  },
  bush: {
    name: 'Arbusto', cat: 'Decoração', w: 1, h: 1, ah: 20, solid: true, interact: 'water', label: 'regar o arbusto',
    desc: 'Arbusto redondo.',
    draw(g, o) {
      const s = (o.state && o.state.g) || 0;
      g.floorShadow(12, 17, 11, 3);
      leafBlob(g, 12, 11, 11, 8, '#4a8f3a'); leafBlob(g, 8, 8, 5, 4, '#5aa84a'); leafBlob(g, 16, 9, 5, 4, '#56a046');
      if (s >= 1) { g.px(7, 7, '#ff9ec2'); g.px(17, 12, '#fff'); g.px(12, 5, '#ff9ec2'); }
    },
  },
  rug: {
    name: 'Tapete', cat: 'Decoração', w: 3, h: 2, ah: 48, flat: true, walk: true, colorable: true, color: '#a8343f', interact: 'inspect', label: 'olhar o tapete',
    desc: 'Tapete decorado.',
    draw(g, o) {
      const c = o.color;
      g.r(0, 0, 72, 48, shadow(c, 0.25)); g.r(2, 2, 68, 44, c); g.r(5, 5, 62, 38, mix(c, GOLD, 0.6)); g.r(6, 6, 60, 36, c);
      for (let i = 0; i < 12; i++) { g.r(36 - i * 2, 12 + i, 1 + i * 4, 1, light(c, 0.15)); g.r(36 - i * 2, 35 - i, 1 + i * 4, 1, light(c, 0.15)); }
      g.el(36, 24, 5, 5, mix(c, GOLD, 0.6));
      for (let x = 0; x < 72; x += 3) { g.px(x, 0, '#f3ead6'); g.px(x, 47, '#f3ead6'); }
    },
  },
  rug_round: {
    name: 'Tapete redondo', cat: 'Decoração', w: 2, h: 2, ah: 48, flat: true, walk: true, colorable: true, color: '#3f5aa8', interact: 'inspect', label: 'olhar o tapete',
    desc: 'Tapete redondo.',
    draw(g, o) {
      g.el(24, 24, 23, 22, shadow(o.color, 0.2)); g.el(24, 24, 21, 20, o.color); g.el(24, 24, 15, 14, mix(o.color, GOLD, 0.45)); g.el(24, 24, 13, 12, light(o.color, 0.1)); g.el(24, 24, 5, 5, mix(o.color, GOLD, 0.6));
    },
  },
  banner: {
    name: 'Estandarte', cat: 'Decoração', w: 1, h: 1, ah: 52, solid: true, colorable: true, color: '#3f5aa8', interact: 'inspect', label: 'ler o estandarte',
    desc: 'Estandarte da guilda. Editores podem mudar o texto.',
    draw(g, o) {
      g.r(11, 0, 2, 50, '#6d4325'); g.el(12, 1, 2, 2, GOLD); g.r(6, 48, 12, 4, '#4f301c');
      g.r(3, 5, 18, 2, '#8a5a36');
      g.r(4, 7, 16, 26, o.color); g.r(4, 7, 16, 2, light(o.color, 0.2)); g.r(18, 9, 2, 24, shadow(o.color, 0.2));
      g.r(4, 33, 5, 3, o.color); g.r(15, 33, 5, 3, o.color); g.r(9, 33, 6, 1, o.color);
      g.el(12, 18, 4, 5, GOLD); g.el(12, 18, 2, 3, light(o.color, 0.1)); g.r(4, 9, 16, 1, GOLD); g.r(4, 31, 16, 1, GOLD);
    },
  },
  painting: {
    name: 'Quadro', cat: 'Decoração', w: 1, h: 1, ah: 40, solid: true, interact: 'inspect', label: 'apreciar o quadro',
    desc: 'Pintura de paisagem.',
    draw(g) {
      g.r(10, 18, 4, 20, '#6d4325'); g.r(5, 36, 14, 4, '#4f301c'); g.line(12, 24, 4, 38, '#6d4325'); g.line(12, 24, 20, 38, '#6d4325');
      g.box(0, 0, 24, 20, GOLD); g.r(2, 2, 20, 16, '#8fd0f2'); g.r(2, 11, 20, 7, '#62b552'); g.el(15, 11, 6, 4, '#7e8ea8'); g.el(15, 9, 3, 2, '#ffffff'); g.el(6, 5, 2, 2, '#fff2a8');
    },
  },
  statue: {
    name: 'Estátua do herói', cat: 'Decoração', w: 1, h: 1, ah: 46, solid: true, interact: 'leaderboard', label: 'ver os heróis (ranking de XP)',
    desc: 'Mostra quem mais ganhou XP com quests.',
    draw(g) {
      g.box(1, 34, 22, 12, '#b8b2c4'); g.r(3, 38, 18, 1, '#9a93a6'); g.r(8, 40, 8, 3, GOLD);
      const s = '#d6d2de';
      g.el(12, 6, 5, 5, s); g.r(8, 11, 8, 12, s); g.r(5, 12, 3, 9, s); g.r(16, 12, 3, 9, s); g.r(8, 23, 3, 11, s); g.r(13, 23, 3, 11, s);
      g.r(19, 2, 2, 20, '#c9c4d4'); g.r(17, 6, 6, 2, '#c9c4d4');
      g.r(9, 13, 2, 8, light(s, 0.3)); g.px(10, 5, light(s, 0.4));
    },
  },
  trophy: {
    name: 'Estante de troféus', cat: 'Decoração', w: 1, h: 1, ah: 42, solid: true, interact: 'leaderboard', label: 'ver os troféus (ranking)',
    desc: 'Ranking de XP e recordes do fliperama.',
    draw(g) {
      g.r(0, 0, 24, 42, '#5a3720'); g.r(2, 2, 20, 36, '#c9e6f2'); g.r(2, 2, 20, 36, 'rgba(255,255,255,.35)');
      g.r(2, 20, 20, 2, '#7d4f30');
      g.el(12, 9, 5, 4, GOLD); g.r(10, 13, 4, 3, GOLD); g.r(8, 16, 8, 3, '#7d4f30'); g.px(10, 8, '#fff6c2');
      g.el(7, 30, 3, 3, '#c9cbd6'); g.r(6, 33, 3, 4, '#c9cbd6'); g.el(17, 31, 3, 3, '#d9934a'); g.r(16, 34, 3, 3, '#d9934a');
      g.r(3, 4, 1, 14, 'rgba(255,255,255,.8)');
    },
  },
  barrel: {
    name: 'Barril', cat: 'Cozinha', w: 1, h: 1, ah: 26, solid: true, interact: 'drink', label: 'tirar um suco do barril',
    desc: 'Barril da taverna.',
    draw(g) {
      g.el(12, 4, 9, 4, '#8a5a36'); g.el(12, 4, 7, 2, '#5a3720');
      g.r(3, 4, 18, 20, '#a76f3e'); g.r(2, 7, 20, 14, '#a76f3e'); g.r(4, 4, 3, 20, light('#a76f3e', 0.18)); g.r(17, 4, 3, 20, shadow('#a76f3e', 0.2));
      g.r(2, 8, 20, 2, IRON); g.r(2, 18, 20, 2, IRON); g.el(12, 24, 9, 2, '#8a5a36');
      g.r(10, 13, 3, 2, '#c9cbd6');
    },
  },
  crate: {
    name: 'Caixote', cat: 'Decoração', w: 1, h: 1, ah: 24, solid: true, interact: 'loot', label: 'abrir o caixote',
    desc: 'Às vezes tem um presente dentro.',
    draw(g) {
      g.r(1, 0, 22, 6, '#d6a86a'); g.r(1, 6, 22, 17, '#b8864e');
      g.r(1, 0, 22, 1, '#ecc78f'); g.r(1, 6, 22, 1, '#8a5a36'); g.r(1, 22, 22, 1, '#7a4e2c');
      g.line(2, 8, 21, 21, '#8a5a36'); g.line(3, 8, 22, 21, '#9c6a3c'); g.r(1, 6, 2, 17, '#8a5a36'); g.r(21, 6, 2, 17, '#8a5a36');
    },
  },
  candelabra: {
    name: 'Candelabro', cat: 'Iluminação', w: 1, h: 1, ah: 42, solid: true, interact: 'toggle', label: 'acender/apagar', anim: true, light: { r: 3, color: 'rgba(255,190,90,0.33)' },
    desc: 'Clique para acender.',
    draw(g, o, f) {
      const on = o.state && o.state.on;
      g.ctx.translate(0, 8);
      g.r(11, 12, 2, 18, GOLD); g.el(12, 31, 6, 2, shade(GOLD, -0.2)); g.r(4, 12, 16, 2, GOLD); g.r(4, 8, 2, 5, GOLD); g.r(18, 8, 2, 5, GOLD);
      for (const x of [5, 12, 19]) {
        g.r(x - 1, 4 + (x === 12 ? -2 : 0), 2, 5, '#f6efe0');
        if (on) flame(g, x, -3 + (x === 12 ? -2 : 0), (f + x) % 4, 0.8);
      }
    },
  },
  torch: {
    name: 'Tocha', cat: 'Iluminação', w: 1, h: 1, ah: 40, solid: true, interact: 'toggle', label: 'acender/apagar', anim: true, light: { r: 3.2, color: 'rgba(255,160,70,0.35)' },
    desc: 'Tocha de pé.',
    draw(g, o, f) {
      const on = o.state && o.state.on;
      g.r(11, 14, 3, 24, '#6d4325'); g.el(12, 38, 6, 2, '#4f301c');
      g.r(8, 10, 9, 5, IRON); g.r(9, 9, 7, 1, light(IRON, 0.2));
      if (on) flame(g, 12, 1, f, 1.4); else g.el(12, 9, 3, 2, '#3b3b48');
    },
  },
  lamp: {
    name: 'Luminária', cat: 'Iluminação', w: 1, h: 1, ah: 40, solid: true, interact: 'toggle', label: 'acender/apagar', light: { r: 3.4, color: 'rgba(255,214,130,0.3)' },
    desc: 'Luminária de pé.',
    draw(g, o) {
      const on = o.state && o.state.on;
      const s = on ? '#ffe08a' : '#e9dfc8';
      g.el(12, 6, 8, 6, shade(s, -0.12)); g.r(4, 2, 16, 8, s); g.r(4, 2, 16, 1, light(s, 0.3)); g.r(3, 9, 18, 2, shade(s, -0.18));
      g.r(11, 11, 2, 26, '#5a4a3a'); g.el(12, 38, 6, 2, '#5a4a3a');
    },
  },
  fireplace: {
    name: 'Lareira', cat: 'Iluminação', w: 2, h: 1, ah: 44, solid: true, interact: 'toggle', label: 'acender/apagar a lareira', anim: true, light: { r: 4.5, color: 'rgba(255,140,60,0.32)' },
    desc: 'Lareira de pedra.',
    draw(g, o, f) {
      const on = o.state && o.state.on;
      g.box(0, 0, 48, 44, '#9a93a6'); g.r(0, 0, 48, 5, '#6d4325'); g.r(0, 0, 48, 1, '#8a5a36');
      for (let y = 7; y < 42; y += 6) for (let x = (y % 12 ? 0 : 6); x < 48; x += 12) g.r(x, y, 1, 5, '#7c7590');
      g.r(10, 16, 28, 26, '#2a1f2a'); g.el(24, 16, 14, 6, '#2a1f2a');
      g.r(12, 38, 24, 3, '#5a3720'); g.r(14, 36, 20, 2, '#7a4e2c');
      if (on) { flame(g, 18, 22, f, 1.6); flame(g, 26, 20, (f + 1) % 4, 2); flame(g, 32, 24, (f + 3) % 4, 1.3); }
      g.r(8, 6, 6, 4, GOLD); g.r(34, 6, 6, 4, '#c0d6ea');
    },
  },
  fountain: {
    name: 'Fonte dos desejos', cat: 'Decoração', w: 2, h: 2, ah: 54, solid: true, interact: 'wish', label: 'jogar uma moeda e fazer um desejo', anim: true,
    desc: 'Faça um pedido e receba uma mensagem da sorte.',
    draw(g, o, f) {
      g.floorShadow(24, 48, 23, 5);
      g.el(24, 38, 23, 12, '#b8b2c4'); g.el(24, 36, 20, 9, '#5aa9e0'); g.el(20, 34, 8, 3, '#8fd0f2');
      g.r(21, 14, 6, 22, '#c9c4d4'); g.r(21, 14, 2, 22, '#e2deea');
      g.el(24, 14, 10, 4, '#c9c4d4'); g.el(24, 13, 8, 2, '#5aa9e0');
      const d = f * 2;
      g.r(23, 4 - (f % 2), 2, 9, '#bfe6ff'); g.px(18 - d % 3, 10 + d, '#bfe6ff'); g.px(30 + d % 3, 10 + d, '#bfe6ff');
      g.px(24, 2, '#ffffff'); g.r(14 + d, 37, 3, 1, '#d9f1ff'); g.r(30 - d, 39, 3, 1, '#d9f1ff');
      g.px(17, 38, GOLD); g.px(31, 36, GOLD);
    },
  },
  signpost: {
    name: 'Placa', cat: 'Decoração', w: 1, h: 1, ah: 32, solid: true, interact: 'inspect', label: 'ler a placa',
    desc: 'Placa com texto editável.',
    draw(g) {
      g.r(10, 10, 4, 22, '#6d4325'); g.box(1, 2, 22, 11, WOOD.top); g.r(4, 5, 14, 1, WOOD.dark); g.r(4, 8, 10, 1, WOOD.dark);
      g.r(20, 3, 4, 9, WOOD.top);
    },
  },
  clock: {
    name: 'Relógio Pomodoro', cat: 'Trabalho', w: 1, h: 1, ah: 50, solid: true, interact: 'pomodoro', label: 'iniciar um pomodoro', anim: true,
    desc: 'Foco de 25 min: seu status vira "Ocupado".',
    draw(g, o, f) {
      g.box(3, 0, 18, 48, '#7a4e2c'); g.el(12, 3, 9, 4, '#7a4e2c');
      g.el(12, 11, 7, 7, GOLD); g.el(12, 11, 6, 6, '#fffaf0'); g.r(12, 6, 1, 6, '#3b3b48'); g.line(12, 11, 15, 13, '#3b3b48');
      g.r(7, 22, 10, 20, '#3d2414'); const sw = [-3, 0, 3, 0][f]; g.line(12, 22, 12 + sw, 36, GOLD); g.el(12 + sw, 37, 2, 2, GOLD);
      g.r(4, 46, 3, 4, '#57341c'); g.r(17, 46, 3, 4, '#57341c');
    },
  },
  globe: {
    name: 'Globo', cat: 'Decoração', w: 1, h: 1, ah: 32, solid: true, interact: 'worldclock', label: 'ver os fusos horários',
    desc: 'Horário nas cidades do time.',
    draw(g) {
      g.r(11, 22, 2, 7, '#6d4325'); g.el(12, 29, 7, 2, '#6d4325');
      g.el(12, 12, 9, 9, '#4f8fd6'); g.el(9, 9, 4, 3, '#62b552'); g.el(15, 15, 3, 3, '#62b552'); g.el(14, 6, 2, 1, '#62b552'); g.px(7, 7, '#cfe8ff');
      g.line(3, 12, 6, 2, GOLD); g.line(12, 22, 21, 12, GOLD);
    },
  },
  column: {
    name: 'Coluna', cat: 'Decoração', w: 1, h: 1, ah: 58, solid: true, interact: 'inspect', label: 'examinar a coluna',
    desc: 'Coluna de mármore.',
    draw(g) {
      g.box(1, 0, 22, 6, '#e2deea'); g.r(3, 6, 18, 46, '#d6d2de'); for (let x = 5; x < 20; x += 4) g.r(x, 7, 1, 44, '#bdb7c9'); g.r(4, 6, 2, 46, '#efedf3');
      g.box(1, 51, 22, 7, '#c9c4d4');
    },
  },
  window: {
    name: 'Janela', cat: 'Decoração', w: 1, h: 1, ah: 30, solid: true, interact: 'inspect', label: 'olhar pela janela',
    desc: 'Mostra se é dia ou noite agora.',
    draw(g) {
      g.box(0, 0, 24, 26, '#8a5a36'); const h = new Date().getHours(); const night = h < 6 || h >= 19;
      g.r(2, 2, 20, 22, night ? '#2b3170' : '#9fd8f5'); if (night) { g.px(6, 6, '#fff'); g.px(16, 9, '#fff'); g.el(16, 6, 2, 2, '#fff2a8'); } else { g.el(7, 7, 3, 3, '#fff2a8'); g.el(16, 16, 5, 2, '#ffffff'); }
      g.r(11, 2, 2, 22, '#8a5a36'); g.r(2, 12, 20, 2, '#8a5a36'); g.r(0, 26, 24, 4, '#6d4325');
    },
  },

  // ======================== TRABALHO E REUNIÃO ========================
  whiteboard: {
    name: 'Quadro branco', cat: 'Trabalho', w: 2, h: 1, ah: 44, solid: true, interact: 'board', label: 'abrir o quadro (desenhar / Miro)',
    desc: 'Quadro colaborativo: desenhe junto ou abra um Miro.',
    draw(g, o) {
      g.box(0, 0, 48, 30, '#a9aebb'); g.r(2, 2, 44, 26, '#fcfcfe');
      if (o.state && o.state.used) { g.line(6, 8, 18, 8, '#3f5aa8'); g.line(6, 12, 26, 12, '#333'); g.line(6, 16, 20, 16, '#333'); g.el(36, 15, 6, 5, '#d64545'); g.el(36, 15, 4, 3, '#fcfcfe'); }
      else g.r(6, 8, 14, 1, '#e3e6ee');
      g.r(4, 28, 40, 2, '#8a8f9c'); g.r(8, 27, 4, 1, '#d64545'); g.r(14, 27, 4, 1, '#3f5aa8');
      g.r(4, 30, 3, 12, '#8a8f9c'); g.r(41, 30, 3, 12, '#8a8f9c'); g.r(1, 41, 9, 3, '#6d7280'); g.r(38, 41, 9, 3, '#6d7280');
    },
  },
  notice_board: {
    name: 'Mural de avisos', cat: 'Trabalho', w: 2, h: 1, ah: 42, solid: true, interact: 'mural', label: 'ler o mural de avisos',
    desc: 'Avisos fixados pelo time.',
    draw(g) {
      g.box(0, 0, 48, 30, '#7a4e2c'); g.r(2, 2, 44, 26, '#c9935a'); for (let i = 0; i < 20; i++) g.px((i * 17) % 44 + 2, (i * 7) % 26 + 2, '#b8824a');
      g.r(5, 5, 11, 9, '#fff6c2'); g.px(10, 5, '#d64545'); g.r(6, 8, 8, 1, '#b8a87a'); g.r(6, 10, 6, 1, '#b8a87a');
      g.r(20, 4, 10, 12, '#ffffff'); g.px(25, 4, '#3f5aa8'); g.r(21, 7, 8, 1, '#c0c0c8'); g.r(21, 9, 7, 1, '#c0c0c8'); g.r(21, 11, 5, 1, '#c0c0c8');
      g.r(33, 6, 10, 9, '#c9f0d6'); g.px(38, 6, '#3f8a5c'); g.r(8, 17, 12, 8, '#ffd6e0'); g.px(14, 17, '#d64545'); g.r(25, 18, 14, 7, '#e0e8ff');
      g.r(10, 30, 3, 12, '#6d4325'); g.r(35, 30, 3, 12, '#6d4325');
    },
  },
  quest_board: {
    name: 'Quadro de quests', cat: 'Trabalho', w: 2, h: 1, ah: 60, solid: true, interact: 'quests', label: 'abrir o quadro de quests', anim: true,
    desc: 'Missões (tarefas) do time: crie, aceite e conclua para ganhar XP.',
    draw(g, o, f) {
      g.ctx.translate(0, 10);
      g.r(3, 8, 3, 42, '#6d4325'); g.r(42, 8, 3, 42, '#6d4325');
      g.box(0, 6, 48, 34, '#8a5a36'); g.r(3, 9, 42, 28, '#e6c48c');
      g.r(0, 2, 48, 6, '#5a3720'); g.r(2, 0, 44, 3, '#6d4325'); g.r(16, 1, 16, 5, GOLD); g.r(18, 3, 12, 1, '#7a4e10');
      const papers = [[6, 12, '#fffaf0'], [17, 11, '#fff2c8'], [28, 13, '#fffaf0'], [8, 24, '#fff2c8'], [20, 25, '#fffaf0'], [33, 24, '#fff2c8']];
      papers.forEach(([x, y, c], i) => { g.r(x, y, 9, 10, c); g.px(x + 4, y, '#d64545'); g.r(x + 1, y + 3, 7, 1, '#b8a37a'); g.r(x + 1, y + 5, 5, 1, '#b8a37a'); if (i === 1) g.r(x + 1, y + 7, 3, 1, '#d64545'); });
      const bob = [0, -1, -2, -1][f];
      g.el(24, -6 + bob, 4, 4, GOLD); g.r(23, -9 + bob, 2, 5, '#5a3a10'); g.px(23, -3 + bob, '#5a3a10');
    },
  },
  tv: {
    name: 'Tela de vídeo', cat: 'Trabalho', w: 2, h: 1, ah: 40, solid: true, interact: 'tv', label: 'ligar a tela / assistir', anim: true, light: { r: 2.6, color: 'rgba(120,180,255,0.22)' },
    desc: 'Liga e mostra um vídeo ou link compartilhado.',
    draw(g, o, f) {
      const on = o.state && o.state.on;
      g.r(0, 28, 48, 12, '#6d4325'); g.r(0, 28, 48, 1, '#8a5a36'); g.r(6, 33, 10, 1, '#4f301c'); g.r(32, 33, 10, 1, '#4f301c');
      g.r(2, 0, 44, 26, '#16161f'); g.r(22, 26, 4, 2, '#16161f');
      if (on) { const cols = ['#ff5d73', '#f2c14e', '#7be07b', '#5db3ff', '#c38bff']; for (let i = 0; i < 5; i++) g.r(4 + i * 8, 2, 8, 15, cols[(i + f) % 5]); g.r(4, 17, 40, 7, '#22305a'); g.r(6, 19, 18, 1, '#c9e6ff'); g.r(6, 21, 12, 1, '#7a8ab8'); }
      else { g.r(4, 2, 40, 22, '#262a3a'); g.r(6, 4, 10, 1, '#3a4058'); g.r(6, 6, 5, 1, '#3a4058'); }
    },
  },
  projector: {
    name: 'Telão', cat: 'Trabalho', w: 3, h: 1, ah: 52, solid: true, interact: 'present', label: 'apresentar (compartilhar tela)',
    desc: 'Compartilhe sua tela para quem estiver no auditório.',
    draw(g, o) {
      g.r(0, 0, 72, 4, '#3b3b48'); g.r(2, 4, 68, 38, '#f6f6fa'); g.r(2, 4, 68, 2, '#d6d6e2');
      if (o.state && o.state.on) { g.r(8, 10, 56, 26, '#3f5aa8'); g.r(12, 14, 30, 3, '#ffffff'); g.r(12, 20, 40, 2, '#c9d7ff'); g.r(12, 25, 34, 2, '#c9d7ff'); g.el(54, 28, 5, 5, GOLD); }
      g.r(2, 42, 68, 2, '#3b3b48'); g.r(6, 44, 2, 8, '#3b3b48'); g.r(64, 44, 2, 8, '#3b3b48');
    },
  },
  podium: {
    name: 'Púlpito (palco)', cat: 'Trabalho', w: 1, h: 1, ah: 32, solid: true, interact: 'spotlight', label: 'saber como falar para todos',
    desc: 'Fique na área de Destaque para ser ouvido por todo o escritório.',
    draw(g) {
      g.r(3, 8, 18, 24, '#7a4e2c'); g.r(3, 8, 18, 2, '#946240'); g.r(1, 4, 22, 6, '#946240'); g.r(1, 4, 22, 1, '#b07a4e');
      g.el(12, 18, 4, 4, GOLD); g.el(12, 18, 2, 2, '#a8343f');
      g.r(15, 0, 1, 5, '#3b3b48'); g.el(15, 0, 2, 1, '#5a5a6a');
    },
  },
  printer: {
    name: 'Impressora', cat: 'Trabalho', w: 1, h: 1, ah: 26, solid: true, interact: 'print', label: 'imprimir',
    desc: 'Imprime um relatório (de mentirinha).',
    draw(g) {
      g.r(5, 0, 14, 7, '#ffffff'); g.r(6, 2, 10, 1, '#d6d6e2');
      g.box(1, 6, 22, 16, '#e3e6ee'); g.r(4, 12, 16, 2, '#4a4f60'); g.px(18, 9, '#62d27a'); g.r(1, 22, 22, 3, '#b8bdcc');
    },
  },
  mailbox: {
    name: 'Caixa de notificações', cat: 'Trabalho', w: 1, h: 1, ah: 34, solid: true, interact: 'feed', label: 'ver notificações',
    desc: 'Objeto inteligente: recebe webhooks (GitHub, Asana, HubSpot, n8n...).',
    draw(g, o) {
      g.r(10, 16, 4, 18, '#6d4325');
      g.el(12, 6, 10, 5, '#3f5aa8'); g.r(2, 6, 20, 12, '#3f5aa8'); g.r(2, 6, 20, 1, light('#3f5aa8', 0.3)); g.r(5, 9, 14, 3, '#24356a');
      const has = o.state && o.state.badge;
      g.r(19, has ? 0 : 6, 2, has ? 10 : 6, '#d64545'); if (has) g.r(19, 0, 4, 3, '#d64545');
    },
  },
  server: {
    name: 'Servidor', cat: 'Trabalho', w: 1, h: 1, ah: 44, solid: true, interact: 'feed', label: 'ver status / notificações', anim: true,
    desc: 'Objeto inteligente para alertas de sistema (deploys, CI, monitoramento).',
    draw(g, o, f) {
      g.box(1, 0, 22, 44, '#2f3346');
      for (let i = 0; i < 6; i++) { const y = 3 + i * 6; g.r(3, y, 18, 4, '#20232f'); g.px(5, y + 1, (i + f) % 3 ? '#62d27a' : '#1f4a2a'); g.px(7, y + 1, (i * 2 + f) % 4 ? '#f2c14e' : '#4a3a10'); g.r(10, y + 1, 9, 1, '#3c4258'); }
      g.r(1, 40, 22, 4, '#1c1e28');
    },
  },
  calendar: {
    name: 'Calendário', cat: 'Trabalho', w: 1, h: 1, ah: 36, solid: true, interact: 'calendar', label: 'ver minha agenda',
    desc: 'Seus próximos compromissos (Google Agenda / Outlook).',
    draw(g) {
      g.r(10, 22, 4, 14, '#6d4325'); g.box(1, 0, 22, 24, '#ffffff'); g.r(1, 0, 22, 6, '#d64545'); g.r(5, 0, 2, 2, '#3b3b48'); g.r(17, 0, 2, 2, '#3b3b48');
      for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) g.r(3 + x * 4, 8 + y * 5, 2, 2, x + y * 5 === 7 ? '#d64545' : '#c0c4d0');
    },
  },
  water: {
    name: 'Bebedouro', cat: 'Cozinha', w: 1, h: 1, ah: 38, solid: true, interact: 'water_drink', label: 'beber água',
    desc: '💧 Hidrate-se!',
    draw(g) {
      g.r(6, 0, 12, 13, '#7fd0f5'); g.r(7, 1, 3, 11, '#b9e8ff'); g.r(8, 13, 8, 1, '#4fb6e8');
      g.box(4, 14, 16, 24, '#eef1f5'); g.r(7, 20, 3, 3, '#e57373'); g.r(14, 20, 3, 3, '#64b5f6'); g.r(6, 26, 12, 1, '#b8c0cc'); g.r(4, 35, 16, 3, '#cfd6e0');
    },
  },
  coffee: {
    name: 'Cafeteira', cat: 'Cozinha', w: 1, h: 1, ah: 30, solid: true, interact: 'coffee', label: 'pegar um café',
    desc: '☕ Buff de energia por 10 min.',
    draw(g) {
      g.r(0, 16, 24, 14, '#a9b4c2'); g.r(0, 16, 24, 2, '#dfe6ee');
      g.box(3, 0, 18, 17, '#2d2f3a'); g.r(5, 2, 14, 4, '#525868'); g.r(6, 7, 5, 2, '#00e5a0'); g.r(15, 7, 2, 2, '#ff6b6b');
      g.r(10, 10, 4, 2, '#525868'); g.box(8, 12, 8, 5, '#fbfbfb'); g.r(9, 13, 6, 1, '#6d4325');
    },
  },
  fridge: {
    name: 'Geladeira', cat: 'Cozinha', w: 1, h: 1, ah: 44, solid: true, interact: 'snack', label: 'pegar um lanche',
    desc: '🍰 Lanche da guilda.',
    draw(g) {
      g.box(2, 0, 20, 44, '#e9eef3'); g.r(2, 15, 20, 1, '#b8c0cc'); g.r(17, 4, 2, 8, '#8a939c'); g.r(17, 19, 2, 14, '#8a939c');
      g.r(5, 4, 4, 4, '#f2c14e'); g.r(6, 20, 5, 4, '#ff6b6b'); g.r(5, 26, 3, 3, '#5db3ff');
    },
  },

  // ======================== MÁGICO ========================
  portal: {
    name: 'Portal de teletransporte', cat: 'Mágico', w: 1, h: 1, ah: 30, walk: true, interact: 'portal', label: 'entrar no portal', anim: true, light: { r: 2.2, color: 'rgba(120,200,255,0.30)', always: true },
    desc: 'Pise para ir até o próximo portal do mapa.',
    draw(g, o, f) {
      g.el(12, 23, 11, 5, '#3f5aa8'); g.el(12, 23, 9, 4, '#7ad0ff'); g.el(12, 23, 6, 2, '#e3f7ff');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + f * 0.6;
        const x = Math.round(12 + Math.cos(a) * 8);
        const y = Math.round(16 - ((i * 4 + f * 3) % 16));
        g.px(x, y, i % 2 ? '#bfe9ff' : '#ffffff');
      }
      g.r(11, 6 - (f % 2), 2, 14, 'rgba(190,235,255,0.55)');
    },
  },
  door: {
    name: 'Porta', cat: 'Mágico', w: 1, h: 1, ah: 36, door: true, interact: 'door', label: 'abrir/fechar a porta',
    desc: 'Bloqueia a passagem quando fechada.',
    draw(g, o) {
      const open = o.state && o.state.open;
      g.r(0, 0, 24, 4, '#5a3720'); g.r(0, 0, 3, 36, '#5a3720'); g.r(21, 0, 3, 36, '#5a3720');
      if (open) { g.r(3, 4, 18, 32, 'rgba(0,0,0,0.25)'); g.r(3, 4, 4, 32, '#8a5a36'); g.r(4, 4, 1, 32, '#a76f3e'); }
      else { g.r(3, 4, 18, 32, '#8a5a36'); for (let x = 5; x < 21; x += 5) g.r(x, 4, 1, 32, '#6d4325'); g.r(3, 4, 18, 1, '#a76f3e'); g.r(3, 12, 18, 2, IRON); g.r(3, 26, 18, 2, IRON); g.el(17, 20, 1, 1, GOLD); }
    },
  },

  // ======================== LAZER ========================
  piano: {
    name: 'Piano', cat: 'Lazer', w: 2, h: 1, ah: 40, solid: true, interact: 'piano', label: 'tocar piano',
    desc: 'Quem estiver perto escuta.',
    draw(g) {
      g.box(0, 0, 48, 30, '#22202c'); g.r(0, 0, 48, 4, '#3a3646');
      g.r(14, 6, 20, 8, '#3a3646'); g.r(15, 7, 18, 6, '#f4ecd8'); g.r(17, 8, 1, 3, '#333'); g.r(22, 8, 1, 4, '#333'); g.r(27, 9, 1, 2, '#333');
      g.r(2, 17, 44, 8, '#fafafa'); for (let x = 5; x < 46; x += 4) g.r(x, 17, 1, 8, '#cfcfcf');
      for (const x of [4, 8, 16, 20, 24, 32, 36, 44]) if (x < 46) g.r(x, 17, 2, 4, '#111');
      g.r(3, 30, 4, 10, '#22202c'); g.r(41, 30, 4, 10, '#22202c'); g.r(21, 36, 6, 1, GOLD);
    },
  },
  arcade: {
    name: 'Fliperama', cat: 'Lazer', w: 1, h: 1, ah: 48, solid: true, colorable: true, color: '#6e4aa0', interact: 'arcade', label: 'jogar no fliperama', anim: true, light: { r: 1.8, color: 'rgba(170,120,255,0.22)', always: true },
    desc: 'Jogos com placar do time.',
    draw(g, o, f) {
      const c = o.color;
      g.box(1, 0, 22, 48, c); g.r(1, 0, 22, 6, shadow(c, 0.2)); g.r(4, 1, 16, 4, '#ffd84d'); g.r(6, 2, 12, 2, '#ff5d73');
      g.r(3, 8, 18, 16, '#14141c');
      g.r(5, 10, 14, 12, '#0d2b1a'); g.r(6 + (f * 3) % 10, 15, 3, 2, '#5cff8f'); g.r(8, 12, 2, 2, '#ff5d73'); g.r(14, 19 - (f % 2), 2, 1, '#ffd84d');
      g.r(2, 25, 20, 8, shade(c, 0.12)); g.r(6, 27, 2, 4, '#2b2b38'); g.el(7, 26, 2, 2, '#ff5d73'); g.el(14, 29, 1, 1, '#5db3ff'); g.el(17, 29, 1, 1, '#ffd84d');
      g.r(3, 35, 18, 10, shadow(c, 0.1)); g.r(10, 39, 4, 3, '#14141c');
    },
  },
  game_table: {
    name: 'Mesa de jogos', cat: 'Lazer', w: 1, h: 1, ah: 24, solid: true, interact: 'tictactoe', label: 'jogar jogo da velha',
    desc: 'Jogo da velha multiplayer.',
    draw(g) {
      g.r(1, 2, 22, 10, WOOD.top); g.r(1, 2, 22, 1, WOOD.topL); g.r(1, 12, 22, 4, WOOD.front);
      g.r(4, 3, 16, 8, '#f3ead6'); g.r(9, 3, 1, 8, '#6d4325'); g.r(14, 3, 1, 8, '#6d4325'); g.r(4, 6, 16, 1, '#6d4325'); g.r(4, 8, 16, 1, '#6d4325');
      g.px(6, 4, '#d64545'); g.px(16, 9, '#3f5aa8'); g.px(11, 7, '#d64545');
      legs(g, 24, 16, 8, WOOD.leg, 2);
    },
  },
  jukebox: {
    name: 'Jukebox', cat: 'Lazer', w: 1, h: 1, ah: 44, solid: true, interact: 'jukebox', label: 'escolher a música', anim: true, light: { r: 2, color: 'rgba(255,120,200,0.2)', always: true },
    desc: 'Toque uma playlist (Spotify / YouTube) para o time.',
    draw(g, o, f) {
      g.el(12, 10, 11, 10, '#a8343f'); g.r(1, 10, 22, 34, '#a8343f'); g.el(12, 10, 8, 7, '#ffd84d'); g.el(12, 10, 6, 5, '#ff9ec2');
      g.r(4, 20, 16, 10, '#2b1b2b'); for (let i = 0; i < 4; i++) g.r(6 + i * 3, 22 + ((i + f) % 3), 2, 6 - ((i + f) % 3), '#ffd84d');
      g.r(4, 32, 16, 8, '#6d1f2a'); for (let x = 5; x < 19; x += 3) g.r(x, 33, 1, 6, '#ffd84d'); g.r(1, 41, 22, 3, '#6d1f2a');
    },
  },
  dummy: {
    name: 'Boneco de treino', cat: 'Lazer', w: 1, h: 1, ah: 42, solid: true, interact: 'dummy', label: 'bater no boneco (alivia o estresse)',
    desc: 'Mostra o dano causado. Ótimo para segundas-feiras.',
    draw(g, o) {
      const hit = o.state && o.state.hit && Date.now() - o.state.hit < 300;
      const dx = hit ? 2 : 0;
      g.r(11, 26, 3, 14, '#6d4325'); g.el(12, 40, 7, 2, '#4f301c');
      g.el(12 + dx, 7, 6, 6, '#e3c48c'); g.r(8 + dx, 5, 2, 2, '#6d4325'); g.r(14 + dx, 5, 2, 2, '#6d4325');
      g.r(6 + dx, 13, 12, 14, '#d6b87a'); g.r(2 + dx, 15, 20, 3, '#c9a96a'); g.r(6 + dx, 18, 12, 2, '#a8343f'); g.r(8 + dx, 22, 8, 1, '#a8713f');
    },
  },
};

export const OBJECT_CATEGORIES = ['Móveis', 'Decoração', 'Iluminação', 'Trabalho', 'Cozinha', 'Lazer', 'Mágico'];

const cache = new Map();

export function objectSprite(o, def = OBJECTS[o.type], frame = 0) {
  const color = def.colorable ? o.color || def.color : '';
  const st = o.state || {};
  const f = def.anim ? frame % 4 : 0;
  const hit = st.hit && Date.now() - st.hit < 300 ? 1 : 0;
  const key = `${o.type}|${color}|${st.on ? 1 : 0}|${st.open ? 1 : 0}|${st.g || 0}|${st.used ? 1 : 0}|${st.badge ? 1 : 0}|${hit}|${f}`;
  let s = cache.get(key);
  if (!s) {
    s = art(def.w * 24, def.ah, (g) => def.draw(g, { ...o, color, state: st }, f));
    if (cache.size > 1500) cache.clear();
    cache.set(key, s);
  }
  return s;
}
