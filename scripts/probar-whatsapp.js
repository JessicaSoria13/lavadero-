// Manda un WhatsApp de prueba para verificar que el aviso de reservas funciona.
// Uso: node scripts/probar-whatsapp.js   (usa WHATSAPP_TELEFONO y WHATSAPP_APIKEY del .env)
require('dotenv').config();
const { enviarWhatsApp } = require('../server/utils/avisos');

if (!process.env.WHATSAPP_TELEFONO || !process.env.WHATSAPP_APIKEY) {
  console.log('Faltan WHATSAPP_TELEFONO y/o WHATSAPP_APIKEY en el .env (ver README).');
  process.exit(1);
}

enviarWhatsApp('✅ Prueba: los avisos de nuevas reservas del lavadero funcionan.')
  .then(() => console.log('\n✅ Mensaje de prueba enviado. Revisá tu WhatsApp (puede tardar unos segundos).\n'))
  .catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  });
