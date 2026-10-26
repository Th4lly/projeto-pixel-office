// Estilo "Ragnarok Online" para os itens do mapa.
// Todo móvel é redesenhado na mesma densidade de pixel (1 texel = 1 px de mundo, a mesma
// escala dos personagens), com cores levemente suavizadas e contorno escuro de 1 texel,
// como os sprites do RO. O resultado fica em cache por (imagem, recorte, tamanho).
// A escala de cada item vem do tamanho real dele em relação ao personagem (ver sizeOf).
import { image, drawFrame, TILE } from './assets.js';

const cache = new Map();
const MAX_CACHE = 1500;

// Altura de referência dos itens, na escala em que o personagem (corpo + cabeça do RO,
// ~70 px de mundo) mede 49 "unidades" (≈ 1,70 m; 1 unidade ≈ 3,5 cm). PX converte para px de mundo.
export const PX = 70 / 49;
// [regex sobre "nome categoria id", altura em unidades]
const SIZES = [
  [/boneco|dummy/i, 42],
  [/alvo|target/i, 34],
  [/trono|throne/i, 40],
  [/cadeira|chair|banqueta|stool/i, 32],
  [/poltrona|armchair|pufe|ottoman/i, 28],
  [/sof[aá]|loveseat|namoradeira|\bbanco\b|bench/i, 28],
  [/mesa com pc|mesa de trabalho|mesa com computador|escrivaninha|\bdesk\b/i, 40],
  [/mesa de reuni/i, 40],
  [/\bmesa|table|balc[aã]o|counter/i, 30],
  [/estante|bookshelf|guarda-roupa|wardrobe|arm[aá]rio|cabinet|gaveteiro|filing/i, 58],
  [/geladeira|fridge|refrigerator/i, 56],
  [/bebedouro|water.?cooler/i, 42],
  [/copiadora|impressora|printer|copier/i, 36],
  [/palmeira|palm/i, 54],
  [/[aá]rvore|\btree/i, 100],
  [/arbusto|bush/i, 26],
  [/planta|plant|vaso|flor|flower|suculenta|succulent|cacto|cactus/i, 26],
  [/lumin[aá]ria|floor.?lamp|\blamp/i, 50],
  [/quadro branco|whiteboard|tela de proje|quadro de gr[aá]fico|painel de gr/i, 50],
  [/\bporta\b|\bdoor/i, 62],
  [/est[aá]tua|statue/i, 58],
  [/coluna|column|pilar/i, 66],
  [/estandarte|banner|fl[aâ]mula/i, 60],
  [/fliperama|slot|arcade|jukebox/i, 46],
  [/piano/i, 40],
  [/lareira|fireplace/i, 46],
  [/caixote|crate/i, 22],
  [/barril|barrel/i, 26],
  [/\bba[uú]\b|chest/i, 20],
  [/\bsaco|sack/i, 16],
];

/** Altura alvo (px de mundo) de um tipo de objeto, ou null se não houver regra. */
export function sizeOf(def) {
  const s = def.skin;
  if (!s || s.small || def.small || def.flat || def.wall || s.custom) return null;
  if (s.hgt) return s.hgt * PX;
  if (/tesouro|itens|recursos|ferramentas|sombras/i.test(s.cat || '')) return null;
  const text = `${def.name} ${s.name || ''} ${s.id}`;
  for (const [re, h] of SIZES) if (re.test(text)) return h * PX;
  return null;
}

/** Canvas do recorte no estilo RO, com 1 texel de borda para o contorno. */
export function styledFrame(sid, f, tw, th) {
  tw = Math.max(1, Math.round(tw));
  th = Math.max(1, Math.round(th));
  const key = `${sid}|${f[0]},${f[1]},${f[2]},${f[3]}|${tw}x${th}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const img = image(sid);
  if (!img) return null;

  // 1) reduz para a grade do mundo; reduções grandes são feitas em etapas (média de área)
  let src = img;
  let sx = f[0];
  let sy = f[1];
  let sw = f[2];
  let sh = f[3];
  while (sw / 2 >= tw * 1.5 && sh / 2 >= th * 1.5) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(sw / 2);
    c.height = Math.ceil(sh / 2);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    src = c; sx = 0; sy = 0; sw = c.width; sh = c.height;
  }
  const shrink = f[2] / tw > 1.3;
  const out = document.createElement('canvas');
  out.width = tw + 2;
  out.height = th + 2;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = shrink;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 1, 1, tw, th);

  // 2) alfa binário, cores suavizadas (paleta mais curta, saturação um pouco menor)
  const id = ctx.getImageData(0, 0, out.width, out.height);
  const d = id.data;
  const W = out.width;
  const H = out.height;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    if (!shrink) continue;
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    for (let c = 0; c < 3; c++) {
      const v = l + (d[i + c] - l) * 0.9;
      d[i + c] = Math.max(0, Math.min(255, Math.round(v / 10) * 10));
    }
  }
  // 3) contorno escuro de 1 texel (só quando a arte foi reduzida: as de pixel já têm contorno)
  if (shrink) {
    const a = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) a[p] = d[p * 4 + 3] ? 1 : 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (a[p]) continue;
        let n = -1;
        if (x > 0 && a[p - 1]) n = p - 1;
        else if (x < W - 1 && a[p + 1]) n = p + 1;
        else if (y > 0 && a[p - W]) n = p - W;
        else if (y < H - 1 && a[p + W]) n = p + W;
        if (n < 0) continue;
        d[p * 4] = Math.round(d[n * 4] * 0.32);
        d[p * 4 + 1] = Math.round(d[n * 4 + 1] * 0.3);
        d[p * 4 + 2] = Math.round(d[n * 4 + 2] * 0.34);
        d[p * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(id, 0, 0);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

/**
 * Desenha um recorte no estilo RO. ws = px de mundo por px da arte; k = px de tela por px de mundo.
 * Mesma ancoragem do drawFrame: (cx, by) = centro da base.
 */
export function drawStyled(ctx, sid, f, cx, by, ws, k, flip = false, alpha = 1) {
  const c = styledFrame(sid, f, f[2] * ws, f[3] * ws);
  if (!c) return drawFrame(ctx, sid, f, cx, by, ws * k, flip, alpha);
  const w = c.width * k;
  const h = c.height * k;
  const x = Math.round(cx - w / 2);
  const y = Math.round(by - h + k);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0, Math.round(w), Math.round(h));
    ctx.restore();
  } else ctx.drawImage(c, x, y, Math.round(w), Math.round(h));
  if (alpha !== 1) ctx.globalAlpha = 1;
  return true;
}

export { TILE };
