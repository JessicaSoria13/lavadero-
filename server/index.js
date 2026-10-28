// Arranque con servidor propio (tu compu o Render). En Vercel se usa api/index.js.
const { app, prepararAlmacen } = require('./app');
const { almacen } = require('./db');

const PORT = process.env.PORT || 3000;

prepararAlmacen()
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
