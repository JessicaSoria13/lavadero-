require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { ensureDb } = require('./db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

ensureDb();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Servir el frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚿 Lavadero app corriendo en http://localhost:${PORT}`);
});
