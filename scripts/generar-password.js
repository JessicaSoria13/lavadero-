// Uso: node scripts/generar-password.js "miContraseñaSecreta"
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.log('Uso: node scripts/generar-password.js "tuContraseña"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nCopiá esta línea dentro de tu archivo .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
