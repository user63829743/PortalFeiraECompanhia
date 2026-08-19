const { spawn } = require('node:child_process');
const path = require('node:path');

const applications = [
  { name: 'Portal', directory: 'apps/portal-publico', file: 'server.js' },
  { name: 'Cadastro', directory: 'apps/cadastro', file: 'server.js' },
  { name: 'Admin', directory: 'apps/admin', file: 'server.js' },
];

const children = applications.map(({ name, directory, file }) => {
  const child = spawn(process.execPath, [file], {
    cwd: path.join(__dirname, '..', directory),
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code && !stopping) console.error(`[${name}] encerrou com código ${code}.`);
  });

  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

console.log('Portal, cadastro e admin iniciados. Pressione Ctrl+C para encerrar todos.');
