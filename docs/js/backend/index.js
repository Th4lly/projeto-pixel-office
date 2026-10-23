// Escolhe o backend: Supabase (produção) ou local (demonstração neste navegador).
import { CONFIG } from '../config.js';

export async function createBackend() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const { SupabaseBackend } = await import('./supabase.js');
    const b = new SupabaseBackend(CONFIG);
    await b.init();
    return b;
  }
  const { LocalBackend } = await import('./local.js');
  const b = new LocalBackend(CONFIG);
  await b.init();
  return b;
}

/** Nível a partir do XP (curva suave: 100, 300, 600, 1000...). */
export function levelFromXp(xp = 0) {
  let lv = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    lv++;
    need = lv * 100;
  }
  return { level: lv, into: xp - acc, need };
}

export const PROVIDERS = {
  google: { name: 'Google Agenda', scopes: 'https://www.googleapis.com/auth/calendar.readonly', icon: '📅' },
  azure: { name: 'Outlook / Microsoft 365', scopes: 'openid email profile offline_access Calendars.Read', icon: '📆' },
  github: { name: 'GitHub', scopes: 'repo read:user', icon: '🐙' },
  spotify: { name: 'Spotify', scopes: 'user-read-currently-playing user-read-playback-state', icon: '🎧' },
};
