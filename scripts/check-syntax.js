// npm run check -> memeriksa sintaks semua file .js (frontend dan api) tanpa menjalankannya.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dirs = ['public/js', 'api', 'scripts'];
let failed = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      try {
        execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
      } catch (e) {
        failed++;
        console.error('GAGAL:', path.relative(root, p) + '\n' + String(e.stderr || e.message));
      }
    }
  }
}

dirs.forEach((d) => walk(path.join(root, d)));
if (failed) {
  console.error(`${failed} file bermasalah.`);
  process.exit(1);
}
console.log('Semua file JS lolos pemeriksaan sintaks.');
