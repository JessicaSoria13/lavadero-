// Descarga la configuración y todos los turnos del sitio publicado a un archivo en tu compu.
// Uso: node scripts/descargar-respaldo.js https://tu-sitio.up.railway.app "tuContraseña"
const fs = require('fs');
const path = require('path');

const [url, password] = process.argv.slice(2);
if (!url || !password) {
  console.log('Uso: node scripts/descargar-respaldo.js https://tu-sitio.up.railway.app "tuContraseña"');
  process.exit(1);
}

async function main() {
  const base = url.replace(/\/+$/, '');

  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const datosLogin = await login.json();
  if (!login.ok) throw new Error(datosLogin.error || `No se pudo iniciar sesión (${login.status})`);

  const headers = { Authorization: `Bearer ${datosLogin.token}` };
  const config = await (await fetch(`${base}/api/admin/config`, { headers })).json();
  const { turnos } = await (await fetch(`${base}/api/admin/turnos`, { headers })).json();

  const destino = path.join(__dirname, '..', 'server', 'data', `respaldo-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify({ config, turnos }, null, 2));

  console.log(`\n✅ Respaldo guardado en: ${destino}`);
  console.log(`   ${turnos.length} turno(s):\n`);
  turnos.forEach((t) => console.log(`   ${t.fecha} ${t.hora} · ${t.nombre} · ${t.telefono} · ${t.lavadoNombre} · ${t.estado}`));
  console.log('');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
