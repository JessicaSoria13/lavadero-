// Uso: node scripts/generar-password.js
// (te pide la contraseña; así la terminal no le cambia símbolos como $ o !)
// También se puede pasar como argumento: node scripts/generar-password.js 'miContraseña'
const readline = require('readline');
const bcrypt = require('bcryptjs');

function generar(password) {
  if (!password) {
    console.log('No escribiste ninguna contraseña.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 10);
  console.log(`\nTu contraseña tiene ${password.length} caracteres. Primera letra: "${password[0]}", última: "${password[password.length - 1]}".`);
  console.log('\nEn Render → Environment → ADMIN_PASSWORD_HASH pegá SOLO esta línea (sin espacios antes ni después):\n');
  console.log(hash);
  console.log('\nEn tu .env la línea completa es:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
}

if (process.argv[2]) {
  generar(process.argv[2]);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Escribí la contraseña nueva del panel y apretá Enter: ', (respuesta) => {
    rl.close();
    generar(respuesta.trim());
  });
}
