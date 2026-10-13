require('dotenv').config();

// Los servidores (Railway, etc.) corren en hora UTC: forzamos la hora de Argentina
// para que "hoy" y los horarios ya pasados se calculen bien.
process.env.TZ = process.env.ZONA_HORARIA || 'America/Argentina/Buenos_Aires';

const path = require('path');
const express = require('express');
const cors = require('cors');
const { almacen } = require('./db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
app.set('trust proxy', 1); // detrás del proxy de Railway, para conocer la IP real del visitante
app.use(cors());
app.use(express.json());

// Para servicios que mantienen el sitio despierto (no toca la base de datos)
app.get('/api/salud', (req, res) => res.json({ ok: true }));

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Servir el frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));

// Errores inesperados (por ejemplo, la base de datos no responde)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor. Probá de nuevo en un momento.' });
});

const PORT = process.env.PORT || 3000;

almacen
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚿 Lavadero app corriendo en http://localhost:${PORT}`);
      console.log(`   Datos guardados en: ${almacen.nombre}`);
      if (!process.env.WHATSAPP_APIKEY) console.log('   Avisos por WhatsApp: desactivados');
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar con la base de datos:', err.message);
    process.exit(1);
  });
