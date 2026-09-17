const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const DEFAULT_DB = {
  config: {
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
  },
  turnos: []
};

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb, ensureDb, DEFAULT_DB };
