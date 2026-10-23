// Gera a configuração pública usada pelo frontend sem versionar chaves.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const envFromFile = {};

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envFromFile[match[1]] = value;
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? envFromFile.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? envFromFile.SUPABASE_ANON_KEY ?? '';

if (!!supabaseUrl !== !!supabaseAnonKey) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_ANON_KEY juntos, ou deixe ambos vazios para o modo demonstração.');
}

if (supabaseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL não é uma URL válida.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('SUPABASE_URL precisa usar HTTP ou HTTPS.');
  }
}

const outputPath = path.join(root, 'docs', 'js', 'runtime-config.js');
const config = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
};
fs.writeFileSync(outputPath, `export const SUPABASE_CONFIG = ${JSON.stringify(config)};\n`);
console.log(supabaseUrl ? 'Configuração do Supabase gerada.' : 'Modo demonstração local configurado.');
