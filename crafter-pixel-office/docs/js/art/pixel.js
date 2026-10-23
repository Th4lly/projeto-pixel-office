// Ferramentas de pixel art. Tudo é desenhado em código numa grade de 24 "pixels de arte"
// por tile e ampliado sem suavização. O contorno é "suave": cada borda recebe uma versão
// escura da própria cor vizinha (visual de RPG anime), em vez de um preto chapado.

export const TILE_ART = 24;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function hexToRgb(hex) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Clareia (amt > 0) ou escurece (amt < 0) uma cor. */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return toHex(f(r), f(g), f(b));
}

/** Mistura duas cores (t = 0 → a, t = 1 → b). */
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** Desloca o matiz para um tom mais quente/frio nas sombras (aparência pintada). */
export function shadow(hex, amt = 0.32) {
  return mix(shade(hex, -amt), '#3b2a5c', 0.18);
}

export function light(hex, amt = 0.3) {
  return mix(shade(hex, amt), '#fff4d6', 0.12);
}

/** Gerador pseudoaleatório determinístico. */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Pincel com primitivas simples, usado por todos os desenhos. */
export function brush(ctx) {
  const g = {
    ctx,
    r(x, y, w, h, c) {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    },
    px(x, y, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    },
    /** Elipse preenchida alinhada aos pixels. */
    el(cx, cy, rx, ry, c) {
      ctx.fillStyle = c;
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
        const dy = (y - cy) / ry;
        const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
        const x0 = Math.round(cx - half);
        const x1 = Math.round(cx + half);
        if (x1 >= x0) ctx.fillRect(x0, y, x1 - x0 + 1, 1);
      }
    },
    /** Linha (Bresenham). */
    line(x0, y0, x1, y1, c) {
      ctx.fillStyle = c;
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    /** Bloco com luz em cima/esquerda e sombra embaixo/direita. */
    box(x, y, w, h, c, o = {}) {
      g.r(x, y, w, h, c);
      g.r(x, y, w, 1, light(c, o.l ?? 0.28));
      g.r(x, y + 1, 1, h - 1, light(c, (o.l ?? 0.28) / 2));
      g.r(x + w - 1, y + 1, 1, h - 1, shadow(c, (o.d ?? 0.25) * 0.7));
      g.r(x, y + h - 1, w, 1, shadow(c, o.d ?? 0.25));
      if (o.round) {
        ctx.clearRect(x, y, 1, 1);
        ctx.clearRect(x + w - 1, y, 1, 1);
        ctx.clearRect(x, y + h - 1, 1, 1);
        ctx.clearRect(x + w - 1, y + h - 1, 1, 1);
      }
    },
    /** Degradê vertical em faixas (aparência pintada). */
    grad(x, y, w, h, c1, c2, steps = 4) {
      for (let i = 0; i < h; i++) {
        const t = Math.floor((i / Math.max(1, h - 1)) * steps) / steps;
        g.r(x, y + i, w, 1, mix(c1, c2, t));
      }
    },
    /** Sombra no chão (elipse translúcida). */
    floorShadow(cx, cy, rx, ry) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      g.el(cx, cy, rx, ry, '#1d1430');
      ctx.restore();
    },
    clear(x, y, w = 1, h = 1) {
      ctx.clearRect(x, y, w, h);
    },
  };
  return g;
}

/**
 * Cria um sprite (w x h pixels de arte) com 1px de margem para o contorno.
 * draw(g, ctx) recebe o pincel.
 */
export function art(w, h, draw, outline = 'soft') {
  const c = makeCanvas(w + 2, h + 2);
  const ctx = c.getContext('2d');
  ctx.translate(1, 1);
  draw(brush(ctx), ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (outline) addOutline(c, outline);
  return c;
}

/** Contorno de 1px ao redor do que não é transparente. */
export function addOutline(c, mode = 'soft') {
  const ctx = c.getContext('2d');
  const { width: w, height: h } = c;
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const out = ctx.createImageData(w, h);
  out.data.set(d);
  const solid = (i) => d[i + 3] > 140;
  const fixed = mode !== 'soft' ? hexToRgb(mode) : null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0) continue;
      let n = -1;
      if (y < h - 1 && solid(i + w * 4)) n = i + w * 4;
      else if (y > 0 && solid(i - w * 4)) n = i - w * 4;
      else if (x > 0 && solid(i - 4)) n = i - 4;
      else if (x < w - 1 && solid(i + 4)) n = i + 4;
      if (n < 0) continue;
      if (fixed) {
        out.data[i] = fixed[0]; out.data[i + 1] = fixed[1]; out.data[i + 2] = fixed[2];
      } else {
        // versão escura e levemente arroxeada da cor vizinha
        out.data[i] = d[n] * 0.32 + 22;
        out.data[i + 1] = d[n + 1] * 0.28 + 14;
        out.data[i + 2] = d[n + 2] * 0.34 + 34;
      }
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}
