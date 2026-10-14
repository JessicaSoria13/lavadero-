const express = require('express');
const { almacen, enExclusiva } = require('../db');
const { generarCodigo, calcularDisponibilidad } = require('../utils/slots');
const { calcularCombo, precioDebitoDe } = require('../utils/combo');
const { avisarNuevoTurno } = require('../utils/avisos');

const router = express.Router();

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const HORA_VALIDA = /^\d{2}:\d{2}$/;

// Recorta y limita el largo de lo que escribe el cliente
function texto(valor, max) {
  return String(valor ?? '').trim().slice(0, max);
}

// Config pública
router.get('/config', async (req, res) => {
  res.json(await almacen.obtenerConfig());
});


// Disponibilidad para una fecha + lavado + extras elegidos
router.get('/disponibilidad', async (req, res) => {
  const { fecha, lavadoId } = req.query;
  const extraIds = req.query.extras ? String(req.query.extras).split(',').filter(Boolean) : [];

  if (!fecha || !lavadoId) {
    return res.status(400).json({ error: 'Falta fecha o lavadoId' });
  }
  if (!FECHA_VALIDA.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });

  const config = await almacen.obtenerConfig();
  const combo = calcularCombo(config, { lavadoId, extraIds });
  if (combo.error) return res.status(404).json({ error: combo.error });

  const turnosDelDia = await almacen.listarTurnos({ fecha });
  const horarios = calcularDisponibilidad({
    fecha,
    duracionMin: combo.duracionMin,
    config,
    turnosDelDia,
    ahora: new Date()
  });
  res.json({ horarios, duracionMin: combo.duracionMin, precio: combo.precio, precioDebito: combo.precioDebito });
});

// Crear turno
router.post('/turnos', async (req, res) => {
  const { vehiculoId, lavadoId, extras: extraIds, fecha, hora } = req.body;
  const nombre = texto(req.body.nombre, 80);
  const telefono = texto(req.body.telefono, 30);

  if (!vehiculoId || !lavadoId || !fecha || !hora || !nombre || !telefono) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  if (!FECHA_VALIDA.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  if (!HORA_VALIDA.test(hora)) return res.status(400).json({ error: 'Hora inválida' });

  const resultado = await enExclusiva(async () => {
    const config = await almacen.obtenerConfig();

    const vehiculo = config.vehiculos.find((v) => v.id === vehiculoId);
    if (!vehiculo) return { status: 400, body: { error: 'Vehículo inexistente' } };

    const combo = calcularCombo(config, { lavadoId, extraIds });
    if (combo.error) return { status: 400, body: { error: combo.error } };
    if (combo.lavado.vehiculoId !== vehiculoId) {
      return { status: 400, body: { error: 'Ese lavado no corresponde a ese vehículo' } };
    }

    // Revalidar disponibilidad (evitar carreras entre dos reservas al mismo tiempo)
    const turnosDelDia = await almacen.listarTurnos({ fecha });
    const disponibles = calcularDisponibilidad({
      fecha,
      duracionMin: combo.duracionMin,
      config,
      turnosDelDia,
      ahora: new Date()
    });
    if (!disponibles.includes(hora)) {
      return { status: 409, body: { error: 'Ese horario ya no está disponible, elegí otro.' } };
    }

    const turno = {
      id: generarCodigo(10),
      vehiculoId,
      vehiculoNombre: vehiculo.nombre,
      lavadoId,
      lavadoNombre: combo.lavado.nombre,
      extras: combo.extras.map((e) => ({ id: e.id, nombre: e.nombre, precio: e.precio, precioDebito: precioDebitoDe(e) })),
      duracionMin: combo.duracionMin,
      precio: combo.precio,
      precioDebito: combo.precioDebito,
      fecha,
      hora,
      nombre,
      telefono,
      patente: texto(req.body.patente, 15).toUpperCase(),
      notas: texto(req.body.notas, 300),
      estado: 'pendiente', // pendiente | confirmado | cancelado
      creadoEn: new Date().toISOString()
    };

    await almacen.crearTurno(turno);
    return { status: 201, body: { turno, negocio: config.negocio } };
  });

  if (resultado.status === 201) avisarNuevoTurno(resultado.body.turno);
  res.status(resultado.status).json(resultado.body);
});

module.exports = router;
