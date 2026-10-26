// Biblioteca de imagens do jogo: tudo vem de assets/catalog.json, gerado por
// tools/build_assets.py a partir da pasta de sprites "Pixel office".
// Imagens carregam sob demanda; quem desenha recebe null até a imagem chegar
// e é avisado (onAssetLoad) para redesenhar.

export let CAT = null;
export const IDX = {};
const images = new Map();
const listeners = new Set();
export const TILE = 32;

export async function loadCatalog(url = 'assets/catalog.json?v=5') {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error('Não encontrei assets/catalog.json — rode tools/build_assets.py.');
  CAT = await res.json();
  for (const key of ['props', 'floors', 'walls', 'bodies', 'heads', 'headgears', 'weapons', 'pets', 'mobs', 'npcs', 'effects', 'emotes', 'icons', 'chairs', 'deskColors', 'palettes']) {
    IDX[key] = new Map((CAT[key] || []).map((e) => [e.id, e]));
  }
  return CAT;
}

export function onAssetLoad(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let notifyTimer = 0;
function notify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = 0;
    listeners.forEach((fn) => fn());
  }, 60);
}

/** Imagem pronta para desenhar, ou null (e começa a carregar). */
export function image(sid) {
  if (sid === undefined || sid === null || !CAT) return null;
  let rec = images.get(sid);
  if (!rec) {
    const img = new Image();
    img.decoding = 'async';
    rec = { img, ok: false };
    images.set(sid, rec);
    img.onload = () => { rec.ok = true; notify(); };
    img.onerror = () => { rec.failed = true; };
    img.src = CAT.sheets[sid];
  }
  return rec.ok ? rec.img : null;
}

export function url(sid) {
  return CAT && CAT.sheets[sid];
}

export function preload(sids) {
  return Promise.all([...new Set(sids)].filter((s) => s !== undefined).map((sid) => new Promise((resolve) => {
    if (image(sid)) return resolve();
    const rec = images.get(sid);
    rec.img.addEventListener('load', resolve, { once: true });
    rec.img.addEventListener('error', resolve, { once: true });
  })));
}

/**
 * Desenha um quadro [x,y,w,h] com a base centralizada em (cx, by).
 * k = escala final (pixels de tela por pixel da folha).
 */
export function drawFrame(ctx, sid, f, cx, by, k, flip = false, alpha = 1) {
  const img = image(sid);
  if (!img || !f) return false;
  const w = f[2] * k;
  const h = f[3] * k;
  const x = Math.round(cx - w / 2);
  const y = Math.round(by - h);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, Math.round(w), Math.round(h));
    ctx.restore();
  } else {
    ctx.drawImage(img, f[0], f[1], f[2], f[3], x, y, Math.round(w), Math.round(h));
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
  return true;
}

/** Desenha uma imagem inteira (sem recorte) com a base centralizada. */
export function drawWhole(ctx, sid, cx, by, k) {
  const img = image(sid);
  if (!img) return false;
  return drawFrame(ctx, sid, [0, 0, img.naturalWidth, img.naturalHeight], cx, by, k);
}

/** Canvas com um quadro, para usar em <img>/miniaturas. */
export function frameCanvas(sid, f, size = 48, pad = 2) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const paint = () => {
    ctx.clearRect(0, 0, size, size);
    const img = image(sid);
    if (!img) return false;
    const fr = f || [0, 0, img.naturalWidth, img.naturalHeight];
    const k = Math.min((size - pad * 2) / fr[2], (size - pad * 2) / fr[3]);
    drawFrame(ctx, sid, fr, size / 2, size / 2 + (fr[3] * k) / 2, k);
    return true;
  };
  if (!paint()) {
    const off = onAssetLoad(() => { if (paint()) off(); });
  }
  return c;
}

export function iconUrl(name, big = false) {
  const e = CAT && CAT.icons.find((i) => i.name.toLowerCase() === String(name).toLowerCase());
  if (!e) return '';
  return url(big ? e.big ?? e.small : e.small ?? e.big);
}

/** Peça de interface do Paper UI pelo caminho relativo (ex.: 'content/4-buttons/0'). */
export function paper(path) {
  const e = CAT && CAT.ui[`paper/${path.replace(/\//g, '-')}`];
  return e ? url(e.s) : '';
}

/** Primeiro item cujo id contém o trecho (para escolher "skins" pelo nome do arquivo). */
export function findProp(...needles) {
  if (!CAT) return null;
  for (const n of needles) {
    const low = n.toLowerCase();
    const hit = CAT.props.find((p) => p.id === low) || CAT.props.find((p) => p.id.includes(low)) || CAT.props.find((p) => p.name.toLowerCase() === low);
    if (hit) return hit;
  }
  return null;
}

export function findFloor(...needles) {
  if (!CAT) return null;
  for (const n of needles) {
    const hit = IDX.floors.get(n) || CAT.floors.find((f) => f.id.includes(n));
    if (hit) return hit;
  }
  return CAT.floors[0];
}

export function findIn(list, ...needles) {
  const arr = CAT[list] || [];
  for (const n of needles) {
    const low = n.toLowerCase();
    const hit = arr.find((e) => e.id === low) || arr.find((e) => e.id.includes(low)) || arr.find((e) => e.name.toLowerCase().includes(low));
    if (hit) return hit;
  }
  return null;
}

/** Quadro atual de uma animação (lista de quadros) no tempo t (segundos). */
export function frameAt(frames, t, fps = 8, loop = true) {
  if (!frames || !frames.length) return null;
  const i = Math.floor(t * fps);
  return frames[loop ? i % frames.length : Math.min(i, frames.length - 1)];
}

/** Imagem por URL (uploads: fundo, frente, objetos próprios). null até carregar. */
const urlImages = new Map();
export function loadUrl(u) {
  if (!u) return null;
  let rec = urlImages.get(u);
  if (!rec) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    rec = { img, ok: false };
    urlImages.set(u, rec);
    img.onload = () => { rec.ok = true; notify(); };
    img.src = u;
  }
  return rec.ok ? rec.img : null;
}
