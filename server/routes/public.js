const express = require('express');
const { readDb, writeDb } = require('../db');
const { generarCodigo, calcularDisponibilidad } = require('../utils/slots');
const { calcularCombo } = require('../utils/combo');

const router = express.Router();

// Config pública
router.get('/config', (req, res) => {
  const db = readDb();
  res.json(db.config);
});


// Disponibilidad para una fecha + lavado + extras elegidos
router.get('/disponibilidad', (req, res) => {
  const { fecha, lavadoId } = req.query;
  const extraIds = req.query.extras ? String(req.query.extras).split(',').filter(Boolean) : [];

  if (!fecha || !lavadoId) {
    return res.status(400).json({ error: 'Falta fecha o lavadoId' });
  }
  const db = readDb();
  const combo = calcularCombo(db, { lavadoId, extraIds });
  if (combo.error) return res.status(404).json({ error: combo.error });

  const turnosDelDia = db.turnos.filter((t) => t.fecha === fecha);
  const horarios = calcularDisponibilidad({
    fecha,
    duracionMin: combo.duracionMin,
    config: db.config,
    turnosDelDia,
    ahora: new Date()
  });
  res.json({ horarios, duracionMin: combo.duracionMin, precio: combo.precio });
});

// Crear turno
router.post('/turnos', (req, res) => {
  const db = readDb();
  const { vehiculoId, lavadoId, extras: extraIds, fecha, hora, nombre, telefono, patente, notas } = req.body;

  if (!vehiculoId || !lavadoId || !fecha || !hora || !nombre || !telefono) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  if (!/^\d{2}:\d{2}$/.test(hora)) return res.status(400).json({ error: 'Hora inválida' });

  const vehiculo = db.config.vehiculos.find((v) => v.id === vehiculoId);
  if (!vehiculo) return res.status(400).json({ error: 'Vehículo inexistente' });

  const combo = calcularCombo(db, { lavadoId, extraIds });
  if (combo.error) return res.status(400).json({ error: combo.error });
  if (combo.lavado.vehiculoId !== vehiculoId) {
    return res.status(400).json({ error: 'Ese lavado no corresponde a ese vehículo' });
  }

  // Revalidar disponibilidad (evitar carreras entre dos reservas al mismo tiempo)
  const turnosDelDia = db.turnos.filter((t) => t.fecha === fecha);
  const disponibles = calcularDisponibilidad({
    fecha,
    duracionMin: combo.duracionMin,
    config: db.config,
    turnosDelDia,
    ahora: new Date()
  });
  if (!disponibles.includes(hora)) {
    return res.status(409).json({ error: 'Ese horario ya no está disponible, elegí otro.' });
  }

  const turno = {
    id: generarCodigo(10),
    vehiculoId,
    vehiculoNombre: vehiculo.nombre,
    lavadoId,
    lavadoNombre: combo.lavado.nombre,
    extras: combo.extras.map((e) => ({ id: e.id, nombre: e.nombre, precio: e.precio })),
    duracionMin: combo.duracionMin,
    precio: combo.precio,
    fecha,
    hora,
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    patente: (patente || '').trim().toUpperCase(),
    notas: (notas || '').trim(),
    estado: 'pendiente', // pendiente | confirmado | cancelado
    creadoEn: new Date().toISOString()
  };

  db.turnos.push(turno);
  writeDb(db);

  res.status(201).json({ turno, negocio: db.config.negocio });
});

module.exports = router;
