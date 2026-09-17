const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, writeDb } = require('../db');
const { firmarToken, requireAdmin } = require('../utils/auth');
const { calcularDisponibilidad } = require('../utils/slots');
const { calcularCombo } = require('../utils/combo');

const router = express.Router();

// Login del administrador del lavadero
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({
      error: 'El servidor no tiene configurada ADMIN_PASSWORD_HASH (ver README).'
    });
  }
  if (!password) return res.status(400).json({ error: 'Falta la contraseña' });

  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });

  res.json({ token: firmarToken() });
});

// A partir de acá, todo requiere estar logueado
router.use(requireAdmin);

// Listar turnos (con filtros opcionales)
router.get('/turnos', (req, res) => {
  const db = readDb();
  let turnos = db.turnos;
  if (req.query.fecha) turnos = turnos.filter((t) => t.fecha === req.query.fecha);
  if (req.query.estado) turnos = turnos.filter((t) => t.estado === req.query.estado);
  turnos = [...turnos].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  res.json({ turnos });
});

// Cambiar estado de un turno (pendiente | confirmado | cancelado)
router.put('/turnos/:id/estado', (req, res) => {
  const db = readDb();
  const turno = db.turnos.find((t) => t.id === req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
  const { estado } = req.body;
  if (!['pendiente', 'confirmado', 'cancelado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  turno.estado = estado;
  writeDb(db);
  res.json({ turno });
});

// Reprogramar / editar un turno (día, hora, vehículo, lavado o extras)
router.put('/turnos/:id', (req, res) => {
  const db = readDb();
  const turno = db.turnos.find((t) => t.id === req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });

  const {
    fecha = turno.fecha,
    hora = turno.hora,
    vehiculoId = turno.vehiculoId,
    lavadoId = turno.lavadoId,
    extras: extraIds = turno.extras.map((e) => e.id)
  } = req.body;

  const vehiculo = db.config.vehiculos.find((v) => v.id === vehiculoId);
  if (!vehiculo) return res.status(400).json({ error: 'Vehículo inexistente' });

  const combo = calcularCombo(db, { lavadoId, extraIds });
  if (combo.error) return res.status(400).json({ error: combo.error });
  if (combo.lavado.vehiculoId !== vehiculoId) {
    return res.status(400).json({ error: 'Ese lavado no corresponde a ese vehículo' });
  }

  const turnosDelDia = db.turnos.filter((t) => t.fecha === fecha && t.id !== turno.id);
  const disponibles = calcularDisponibilidad({
    fecha,
    duracionMin: combo.duracionMin,
    config: db.config,
    turnosDelDia,
    ahora: new Date()
  });
  if (!disponibles.includes(hora)) {
    return res.status(409).json({ error: 'Ese horario no está disponible para ese vehículo/lavado.' });
  }

  turno.fecha = fecha;
  turno.hora = hora;
  turno.vehiculoId = vehiculoId;
  turno.vehiculoNombre = vehiculo.nombre;
  turno.lavadoId = lavadoId;
  turno.lavadoNombre = combo.lavado.nombre;
  turno.extras = combo.extras.map((e) => ({ id: e.id, nombre: e.nombre, precio: e.precio }));
  turno.duracionMin = combo.duracionMin;
  turno.precio = combo.precio;
  turno.modificadoEn = new Date().toISOString();

  writeDb(db);
  res.json({ turno });
});

// Borrar un turno definitivamente
router.delete('/turnos/:id', (req, res) => {
  const db = readDb();
  const antes = db.turnos.length;
  db.turnos = db.turnos.filter((t) => t.id !== req.params.id);
  if (db.turnos.length === antes) return res.status(404).json({ error: 'Turno no encontrado' });
  writeDb(db);
  res.json({ ok: true });
});

// Disponibilidad para el admin (usada al reprogramar)
router.get('/disponibilidad', (req, res) => {
  const { fecha, lavadoId, excluirId } = req.query;
  const extraIds = req.query.extras ? String(req.query.extras).split(',').filter(Boolean) : [];
  if (!fecha || !lavadoId) return res.status(400).json({ error: 'Falta fecha o lavadoId' });

  const db = readDb();
  const combo = calcularCombo(db, { lavadoId, extraIds });
  if (combo.error) return res.status(404).json({ error: combo.error });

  const turnosDelDia = db.turnos.filter((t) => t.fecha === fecha && t.id !== excluirId);
  const horarios = calcularDisponibilidad({
    fecha,
    duracionMin: combo.duracionMin,
    config: db.config,
    turnosDelDia,
    ahora: new Date()
  });
  res.json({ horarios, duracionMin: combo.duracionMin, precio: combo.precio });
});

// Ver / editar configuración
router.get('/config', (req, res) => {
  const db = readDb();
  res.json(db.config);
});

router.put('/config', (req, res) => {
  const db = readDb();
  db.config = { ...db.config, ...req.body };
  writeDb(db);
  res.json(db.config);
});

module.exports = router;
