const express = require('express');
const bcrypt = require('bcryptjs');
const { almacen, enExclusiva } = require('../db');
const {
  firmarToken,
  requireAdmin,
  loginBloqueado,
  registrarLoginFallido,
  registrarLoginExitoso
} = require('../utils/auth');
const { calcularDisponibilidad } = require('../utils/slots');
const { calcularCombo, precioDebitoDe } = require('../utils/combo');

const router = express.Router();

// Login del administrador del lavadero
router.post('/login', async (req, res) => {
  if (await loginBloqueado(req.ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.' });
  }

  const { password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({
      error: 'El servidor no tiene configurada ADMIN_PASSWORD_HASH (ver README).'
    });
  }
  if (!password) return res.status(400).json({ error: 'Falta la contraseña' });

  const ok = await bcrypt.compare(String(password), hash);
  if (!ok) {
    await registrarLoginFallido(req.ip);
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  await registrarLoginExitoso(req.ip);
  res.json({ token: firmarToken() });
});

// A partir de acá, todo requiere estar logueado
router.use(requireAdmin);

// Listar turnos (con filtros opcionales: fecha exacta, desde una fecha, estado)
router.get('/turnos', async (req, res) => {
  const { fecha, desde, estado } = req.query;
  const turnos = await almacen.listarTurnos({ fecha, desde, estado });
  res.json({ turnos });
});

// Cambiar estado de un turno (pendiente | confirmado | cancelado)
router.put('/turnos/:id/estado', async (req, res) => {
  const turno = await almacen.obtenerTurno(req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
  const { estado } = req.body;
  if (!['pendiente', 'confirmado', 'cancelado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  turno.estado = estado;
  await almacen.actualizarTurno(turno);
  res.json({ turno });
});

// Reprogramar / editar un turno (día, hora, vehículo, lavado o extras)
router.put('/turnos/:id', async (req, res) => {
  const resultado = await enExclusiva(async () => {
    const turno = await almacen.obtenerTurno(req.params.id);
    if (!turno) return { status: 404, body: { error: 'Turno no encontrado' } };

    const {
      fecha = turno.fecha,
      hora = turno.hora,
      vehiculoId = turno.vehiculoId,
      lavadoId = turno.lavadoId,
      extras: extraIds = turno.extras.map((e) => e.id)
    } = req.body;

    const config = await almacen.obtenerConfig();
    const vehiculo = config.vehiculos.find((v) => v.id === vehiculoId);
    if (!vehiculo) return { status: 400, body: { error: 'Vehículo inexistente' } };

    const combo = calcularCombo(config, { lavadoId, extraIds });
    if (combo.error) return { status: 400, body: { error: combo.error } };
    if (combo.lavado.vehiculoId !== vehiculoId) {
      return { status: 400, body: { error: 'Ese lavado no corresponde a ese vehículo' } };
    }

    const turnosDelDia = await almacen.listarTurnos({ fecha, excluirId: turno.id });
    const disponibles = calcularDisponibilidad({
      fecha,
      duracionMin: combo.duracionMin,
      config,
      turnosDelDia,
      ahora: new Date()
    });
    if (!disponibles.includes(hora)) {
      return { status: 409, body: { error: 'Ese horario no está disponible para ese vehículo/lavado.' } };
    }

    turno.fecha = fecha;
    turno.hora = hora;
    turno.vehiculoId = vehiculoId;
    turno.vehiculoNombre = vehiculo.nombre;
    turno.lavadoId = lavadoId;
    turno.lavadoNombre = combo.lavado.nombre;
    turno.extras = combo.extras.map((e) => ({ id: e.id, nombre: e.nombre, precio: e.precio, precioDebito: precioDebitoDe(e) }));
    turno.duracionMin = combo.duracionMin;
    turno.precio = combo.precio;
    turno.precioDebito = combo.precioDebito;
    turno.modificadoEn = new Date().toISOString();

    await almacen.actualizarTurno(turno);
    return { status: 200, body: { turno } };
  });

  res.status(resultado.status).json(resultado.body);
});

// Borrar un turno definitivamente
router.delete('/turnos/:id', async (req, res) => {
  const borrado = await almacen.eliminarTurno(req.params.id);
  if (!borrado) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json({ ok: true });
});

// Disponibilidad para el admin (usada al reprogramar)
router.get('/disponibilidad', async (req, res) => {
  const { fecha, lavadoId, excluirId } = req.query;
  const extraIds = req.query.extras ? String(req.query.extras).split(',').filter(Boolean) : [];
  if (!fecha || !lavadoId) return res.status(400).json({ error: 'Falta fecha o lavadoId' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });

  const config = await almacen.obtenerConfig();
  const combo = calcularCombo(config, { lavadoId, extraIds });
  if (combo.error) return res.status(404).json({ error: combo.error });

  const turnosDelDia = await almacen.listarTurnos({ fecha, excluirId });
  const horarios = calcularDisponibilidad({
    fecha,
    duracionMin: combo.duracionMin,
    config,
    turnosDelDia,
    ahora: new Date()
  });
  res.json({ horarios, duracionMin: combo.duracionMin, precio: combo.precio, precioDebito: combo.precioDebito });
});

// Ver / editar configuración
router.get('/config', async (req, res) => {
  res.json(await almacen.obtenerConfig());
});

router.put('/config', async (req, res) => {
  const config = { ...(await almacen.obtenerConfig()), ...req.body };
  await almacen.guardarConfig(config);
  res.json(config);
});

module.exports = router;
