// Tema claro/escuro da interface (o mapa continua igual).
const KEY = 'po.theme';

export function currentTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* sem storage */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme = currentTheme()) {
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, next); } catch { /* ok */ }
  return applyTheme(next);
}
