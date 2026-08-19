import portal from '../apps/portal-publico/server.js';
import cadastro from '../apps/cadastro/server.js';
import admin from '../apps/admin/server.js';

for (const [name, handler] of [['portal', portal], ['cadastro', cadastro], ['admin', admin]]) {
  if (typeof handler !== 'function') throw new Error(`${name} handler missing`);
  console.log(`${name}: handler loaded`);
}
