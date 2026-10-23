// Verificação rápida de sintaxe de todo o JavaScript (servidor + navegador).
// Uso: npm run check
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name === 'vendor' || f.name === 'functions' || f.name.startsWith('.')) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.js')) files.push(p);
  }
})(root);

let failed = 0;
for (const file of files) {
  const isModule = file.includes(`${path.sep}docs${path.sep}`);
  try {
    if (isModule) {
      execFileSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(file), stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    }
  } catch (e) {
    failed++;
    console.error(`✗ ${path.relative(root, file)}\n${e.stderr.toString()}`);
  }
}
console.log(failed ? `\n${failed} arquivo(s) com erro.` : `✓ ${files.length} arquivos OK`);
process.exit(failed ? 1 : 0);
