// Entrada para Vercel: todas las rutas /api/... llegan acá (ver vercel.json).
// Las páginas (public/) las sirve Vercel directamente.
const { app } = require('../server/app');

module.exports = app;
