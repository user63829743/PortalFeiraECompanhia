import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const checks = [
  'apps/portal-publico/server.js',
  'apps/cadastro/server.js',
  'apps/admin/server.js',
];
for (const file of checks) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  console.log(`${file}: syntax OK`);
}
for (const file of ['apps/portal-publico/vercel.json', 'apps/cadastro/vercel.json', 'apps/admin/vercel.json']) {
  JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`${file}: JSON OK`);
}
const ignore = fs.readFileSync('.gitignore', 'utf8');
if (!/(^|\n)\.env/m.test(ignore)) throw new Error('.gitignore must exclude .env');
const publicRoots = ['apps/portal-publico/public', 'apps/cadastro/public', 'apps/admin/public'];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full);
    else if (/\.(html|js|css)$/.test(entry.name)) files.push(full);
  }
}
for (const root of publicRoots) walk(root);
const localPattern = /localhost|127\.0\.0\.1/;
for (const file of files) {
  if (localPattern.test(fs.readFileSync(file, 'utf8'))) throw new Error(`Public localhost reference: ${file}`);
}
console.log('No localhost references in public files');
const layout = fs.readFileSync('apps/portal-publico/public/shared/layout.js', 'utf8');
const home = fs.readFileSync('apps/portal-publico/public/index.html', 'utf8');
if (!layout.includes('href="/cadastro/"') || !home.includes('href="/cadastro/"')) throw new Error('Cadastro link missing');
if (!layout.includes('https://tvegnews-zccwximc.manus.space/')) throw new Error('TVegNews link missing');
for (const file of ['apps/portal-publico/vercel.json', 'apps/cadastro/vercel.json', 'apps/admin/vercel.json']) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!config.builds?.[0]?.config?.includeFiles?.includes('public/**')) throw new Error(`${file}: public files are not included`);
}
console.log('Production links and Vercel static inclusion OK');
console.log('Vercel validation OK');
