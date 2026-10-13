// Carga un respaldo (config + turnos) en la base PostgreSQL.
// Uso: node scripts/importar-respaldo.js server/data/respaldo-AAAA-MM-DD.json "postgresql://..."
// (si no pasás la URL, usa DATABASE_URL del .env)
require('dotenv').config();
const fs = require('fs');
const { crearAlmacenPostgres } = require('../server/db');

const [archivo, urlArg] = process.argv.slice(2);
const url = urlArg || process.env.DATABASE_URL;
if (!archivo || !url) {
  console.log('Uso: node scripts/importar-respaldo.js server/data/respaldo-AAAA-MM-DD.json "postgresql://..."');
  process.exit(1);
}

async function main() {
  const { config, turnos } = JSON.parse(fs.readFileSync(archivo, 'utf-8'));
  const almacen = crearAlmacenPostgres(url);
  try {
    await almacen.init();
    await almacen.guardarConfig(config);
    for (const turno of turnos) await almacen.importarTurno(turno);
    console.log(`\n✅ Importados: configuración + ${turnos.length} turno(s) (los que ya existían no se tocaron).\n`);
  } finally {
    await almacen.cerrar();
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
