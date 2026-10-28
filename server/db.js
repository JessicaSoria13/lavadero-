const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const DEFAULT_CONFIG = {
  negocio: {
    nombre: 'Lavadero Full Auto',
    telefono: '',
    direccion: ''
  },
  // 0 = domingo ... 6 = sábado. null = cerrado ese día.
  horarios: {
    0: null,
    1: { apertura: '08:00', cierre: '19:00' },
    2: { apertura: '08:00', cierre: '19:00' },
    3: { apertura: '08:00', cierre: '19:00' },
    4: { apertura: '08:00', cierre: '19:00' },
    5: { apertura: '08:00', cierre: '19:00' },
    6: { apertura: '08:00', cierre: '14:00' }
  },
  duracionSlotMin: 15,

  vehiculos: [
    { id: 'auto', nombre: 'Auto' },
    { id: 'moto', nombre: 'Moto' }
  ],

  lavados: [
    { id: 'basico_auto', vehiculoId: 'auto', nombre: 'Lavado Básico', duracionMin: 30, precio: 5000 },
    { id: 'premium_auto', vehiculoId: 'auto', nombre: 'Lavado Premium', duracionMin: 50, precio: 8500 },
    { id: 'basico_moto', vehiculoId: 'moto', nombre: 'Lavado Básico', duracionMin: 20, precio: 3000 },
    { id: 'premium_moto', vehiculoId: 'moto', nombre: 'Lavado Premium', duracionMin: 30, precio: 4500 }
  ],

  extras: [
    { id: 'perfume', nombre: 'Perfume', precio: 500, duracionMin: 0 },
    { id: 'cera', nombre: 'Cera / Encerado', precio: 2000, duracionMin: 15 },
    { id: 'tapizados', nombre: 'Limpieza de tapizados', precio: 3500, duracionMin: 20 },
    { id: 'motor', nombre: 'Lavado de motor', precio: 2500, duracionMin: 15 }
  ]
};

// Filtro común: { fecha, desde, estado, excluirId }
function coincide(t, { fecha, desde, estado, excluirId } = {}) {
  if (fecha && t.fecha !== fecha) return false;
  if (desde && t.fecha < desde) return false;
  if (estado && t.estado !== estado) return false;
  if (excluirId && t.id === excluirId) return false;
  return true;
}

function ordenarTurnos(turnos) {
  return [...turnos].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

/* ---------- Archivo JSON (para probar en la compu, sin DATABASE_URL) ---------- */
function crearAlmacenArchivo() {
  function leer() {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify({ config: DEFAULT_CONFIG, turnos: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }
  function escribir(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  // Con un solo servidor alcanza con ordenar las operaciones en memoria
  let cola = Promise.resolve();
  const intentosFallidos = new Map(); // ip -> { cantidad, desde }

  return {
    nombre: 'archivo local (server/data/db.json)',
    async init() {
      leer();
    },
    async obtenerConfig() {
      return leer().config;
    },
    async guardarConfig(config) {
      const db = leer();
      db.config = config;
      escribir(db);
    },
    async listarTurnos(filtro) {
      return ordenarTurnos(leer().turnos.filter((t) => coincide(t, filtro)));
    },
    async obtenerTurno(id) {
      return leer().turnos.find((t) => t.id === id) || null;
    },
    async crearTurno(turno) {
      const db = leer();
      db.turnos.push(turno);
      escribir(db);
    },
    async actualizarTurno(turno) {
      const db = leer();
      const i = db.turnos.findIndex((t) => t.id === turno.id);
      if (i === -1) return;
      db.turnos[i] = turno;
      escribir(db);
    },
    async eliminarTurno(id) {
      const db = leer();
      const antes = db.turnos.length;
      db.turnos = db.turnos.filter((t) => t.id !== id);
      if (db.turnos.length === antes) return false;
      escribir(db);
      return true;
    },
    enExclusiva(fn) {
      const resultado = cola.then(fn);
      cola = resultado.catch(() => {});
      return resultado;
    },
    async loginBloqueado(ip, maxIntentos, ventanaMs) {
      const registro = intentosFallidos.get(ip);
      if (!registro || Date.now() - registro.desde > ventanaMs) return false;
      return registro.cantidad >= maxIntentos;
    },
    async registrarLoginFallido(ip, ventanaMs) {
      const registro = intentosFallidos.get(ip);
      if (!registro || Date.now() - registro.desde > ventanaMs) {
        intentosFallidos.set(ip, { cantidad: 1, desde: Date.now() });
      } else {
        registro.cantidad++;
      }
    },
    async registrarLoginExitoso(ip) {
      intentosFallidos.delete(ip);
    },
    async cerrar() {}
  };
}

/* ---------- PostgreSQL (producción: los datos no se borran al reiniciar) ---------- */
const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS config (
    id INT PRIMARY KEY,
    datos JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS turnos (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    estado TEXT NOT NULL,
    datos JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS turnos_fecha_idx ON turnos (fecha);
  CREATE TABLE IF NOT EXISTS intentos_login (
    ip TEXT PRIMARY KEY,
    cantidad INT NOT NULL,
    desde TIMESTAMPTZ NOT NULL
  );
`;

// Número fijo para el bloqueo de PostgreSQL que ordena las reservas de a una
const LLAVE_BLOQUEO_TURNOS = 734512;

function crearAlmacenPostgres(url) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    // En Vercel cada copia de la app atiende de a una visita: no hacen falta muchas conexiones
    max: process.env.VERCEL ? 2 : 10
  });

  async function guardarTurno(turno, { soloSiNoExiste = false } = {}) {
    await pool.query(
      `INSERT INTO turnos (id, fecha, hora, estado, datos) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO ${soloSiNoExiste ? 'NOTHING' : 'UPDATE SET fecha = $2, hora = $3, estado = $4, datos = $5'}`,
      [turno.id, turno.fecha, turno.hora, turno.estado, JSON.stringify(turno)]
    );
  }

  return {
    nombre: 'PostgreSQL',
    async init() {
      await pool.query(ESQUEMA);
      await pool.query('INSERT INTO config (id, datos) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [
        JSON.stringify(DEFAULT_CONFIG)
      ]);
    },
    async obtenerConfig() {
      const { rows } = await pool.query('SELECT datos FROM config WHERE id = 1');
      return rows[0].datos;
    },
    async guardarConfig(config) {
      await pool.query(
        'INSERT INTO config (id, datos) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET datos = $1',
        [JSON.stringify(config)]
      );
    },
    async listarTurnos({ fecha, desde, estado, excluirId } = {}) {
      const condiciones = [];
      const valores = [];
      const agregar = (sql, valor) => {
        valores.push(valor);
        condiciones.push(sql.replace('?', `$${valores.length}`));
      };
      if (fecha) agregar('fecha = ?', fecha);
      if (desde) agregar('fecha >= ?', desde);
      if (estado) agregar('estado = ?', estado);
      if (excluirId) agregar('id <> ?', excluirId);
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT datos FROM turnos ${where} ORDER BY fecha, hora`, valores);
      return rows.map((r) => r.datos);
    },
    async obtenerTurno(id) {
      const { rows } = await pool.query('SELECT datos FROM turnos WHERE id = $1', [id]);
      return rows[0] ? rows[0].datos : null;
    },
    async crearTurno(turno) {
      await guardarTurno(turno);
    },
    async actualizarTurno(turno) {
      await guardarTurno(turno);
    },
    async eliminarTurno(id) {
      const { rowCount } = await pool.query('DELETE FROM turnos WHERE id = $1', [id]);
      return rowCount > 0;
    },
    // Usado por scripts/importar-respaldo.js: no pisa turnos que ya existen
    async importarTurno(turno) {
      await guardarTurno(turno, { soloSiNoExiste: true });
    },

    // Ejecuta fn de a una aunque haya varias copias de la app corriendo (Vercel):
    // el bloqueo lo lleva PostgreSQL y se libera solo al terminar la transacción.
    async enExclusiva(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query('SELECT pg_advisory_xact_lock($1)', [LLAVE_BLOQUEO_TURNOS]);
        const resultado = await fn();
        await cliente.query('COMMIT');
        return resultado;
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    },

    // Intentos fallidos de login por IP (guardados en la base para que valgan en todas las copias)
    async loginBloqueado(ip, maxIntentos, ventanaMs) {
      const { rows } = await pool.query(
        'SELECT cantidad FROM intentos_login WHERE ip = $1 AND desde > now() - ($2 || \' milliseconds\')::interval',
        [ip, ventanaMs]
      );
      return rows.length > 0 && rows[0].cantidad >= maxIntentos;
    },
    async registrarLoginFallido(ip, ventanaMs) {
      await pool.query(
        `INSERT INTO intentos_login (ip, cantidad, desde) VALUES ($1, 1, now())
         ON CONFLICT (ip) DO UPDATE SET
           cantidad = CASE WHEN intentos_login.desde > now() - ($2 || ' milliseconds')::interval THEN intentos_login.cantidad + 1 ELSE 1 END,
           desde = CASE WHEN intentos_login.desde > now() - ($2 || ' milliseconds')::interval THEN intentos_login.desde ELSE now() END`,
        [ip, ventanaMs]
      );
    },
    async registrarLoginExitoso(ip) {
      await pool.query('DELETE FROM intentos_login WHERE ip = $1', [ip]);
    },

    async cerrar() {
      await pool.end();
    }
  };
}

if (process.env.VERCEL && !process.env.DATABASE_URL) {
  // En Vercel no se puede escribir en archivos: sin base de datos se perderían los turnos
  throw new Error('Falta la variable DATABASE_URL (en Vercel es obligatoria).');
}

const almacen = process.env.DATABASE_URL ? crearAlmacenPostgres(process.env.DATABASE_URL) : crearAlmacenArchivo();

function enExclusiva(fn) {
  return almacen.enExclusiva(fn);
}

module.exports = { almacen, enExclusiva, DEFAULT_CONFIG, crearAlmacenPostgres };
