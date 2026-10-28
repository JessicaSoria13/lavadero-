require('dotenv').config({ quiet: true });

// Los servidores (Vercel, Render, etc.) corren en hora UTC: forzamos la hora de Argentina
// para que "hoy" y los horarios ya pasados se calculen bien.
process.env.TZ = process.env.ZONA_HORARIA || 'America/Argentina/Buenos_Aires';

const path = require('path');
const express = require('express');
const cors = require('cors');
const { almacen } = require('./db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

// Crea las tablas la primera vez. En Vercel la app arranca "en frío" con la primera visita,
// así que se prepara una sola vez y las siguientes visitas reutilizan la misma promesa.
let preparacion = null;
function prepararAlmacen() {
  if (!preparacion) {
    preparacion = almacen.init().catch((err) => {
      preparacion = null; // reintentar en la próxima visita
      throw err;
    });
  }
  return preparacion;
}

const app = express();
app.set('trust proxy', 1); // detrás del proxy del hosting, para conocer la IP real del visitante
app.use(cors());
app.use(express.json());

// Para servicios que mantienen el sitio despierto (no toca la base de datos)
app.get('/api/salud', (req, res) => res.json({ ok: true }));

app.use('/api', async (req, res, next) => {
  try {
    await prepararAlmacen();
    next();
  } catch (err) {
    next(err);
  }
});
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Servir el frontend estático (en Vercel lo sirve directamente su CDN desde public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Errores inesperados (por ejemplo, la base de datos no responde)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor. Probá de nuevo en un momento.' });
});

module.exports = { app, prepararAlmacen };
