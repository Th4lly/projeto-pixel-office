// =====================================================================
// Configuração gerada por scripts/configure-supabase.js a partir do .env
// ou dos segredos do GitHub Actions. A chave "anon" é pública por natureza;
// a segurança fica nas regras (RLS) do banco.
//
// Se deixar em branco, o escritório roda em MODO DEMONSTRAÇÃO LOCAL:
// funciona só neste navegador (abra várias abas para simular pessoas).
// =====================================================================
import { SUPABASE_CONFIG } from './runtime-config.js';

export const CONFIG = {
  SUPABASE_URL: SUPABASE_CONFIG.SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_CONFIG.SUPABASE_ANON_KEY,

  APP_NAME: 'Crafter Pixel Office',

  // Distância (em tiles) para considerar duas pessoas "perto"
  PROXIMITY: 4,

  // Servidores para conexões de vídeo. Em redes corporativas restritas,
  // use credenciais TURN temporárias emitidas pelo seu backend autenticado.
  // Nunca coloque a chave administrativa do provedor TURN neste arquivo público.
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],

  // Integrações (cada uma precisa do provedor ativado no Supabase → Authentication → Providers)
  INTEGRATIONS: {
    google: true, // Google Agenda (status automático)
    azure: true, // Outlook / Microsoft 365 (status automático)
    github: true, // GitHub (importar issues como quests)
    spotify: true, // Spotify (mostrar o que está tocando)
  },
};
