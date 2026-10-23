// Gera a configuração pública do frontend usando .env ou a configuração já existente.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outputPath = path.join(root, 'docs', 'js', 'runtime-config.js');
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

let existingConfig = {};
if (fs.existsSync(outputPath)) {
  const source = fs.readFileSync(outputPath, 'utf8');
  const match = source.match(/^export const SUPABASE_CONFIG = (.+);$/m);
  if (!match) throw new Error('Não foi possível ler docs/js/runtime-config.js.');
  existingConfig = JSON.parse(match[1]);
}

const supabaseUrl = process.env.SUPABASE_URL ?? envFromFile.SUPABASE_URL ?? existingConfig.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? envFromFile.SUPABASE_ANON_KEY ?? existingConfig.SUPABASE_ANON_KEY ?? '';

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

const config = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
};
fs.writeFileSync(outputPath, `export const SUPABASE_CONFIG = ${JSON.stringify(config)};\n`);
console.log(supabaseUrl ? 'Configuração do Supabase gerada.' : 'Modo demonstração local configurado.');
