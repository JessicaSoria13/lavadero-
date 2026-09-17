const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos

function generarCodigo(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function minutosDesdeHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function hhmmDesdeMinutos(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Devuelve lista de horarios "HH:MM" disponibles para una fecha (YYYY-MM-DD) y duración de servicio (min)
function calcularDisponibilidad({ fecha, duracionMin, config, turnosDelDia, ahora }) {
  const [y, m, d] = fecha.split('-').map(Number);
  const fechaObj = new Date(y, m - 1, d);
  const diaSemana = fechaObj.getDay();
  const horario = config.horarios[diaSemana];
  if (!horario) return [];

  const apertura = minutosDesdeHHMM(horario.apertura);
  const cierre = minutosDesdeHHMM(horario.cierre);
  const paso = config.duracionSlotMin || 15;

  const ocupados = turnosDelDia
    .filter((t) => t.estado !== 'cancelado')
    .map((t) => {
      const inicio = minutosDesdeHHMM(t.hora);
      return { inicio, fin: inicio + t.duracionMin };
    });

  const disponibles = [];
  const esHoy =
    ahora &&
    ahora.getFullYear() === y &&
    ahora.getMonth() === m - 1 &&
    ahora.getDate() === d;
  const minutosAhora = esHoy ? ahora.getHours() * 60 + ahora.getMinutes() : -1;

  for (let inicio = apertura; inicio + duracionMin <= cierre; inicio += paso) {
    if (esHoy && inicio <= minutosAhora) continue;
    const fin = inicio + duracionMin;
    const solapa = ocupados.some((o) => inicio < o.fin && fin > o.inicio);
    if (!solapa) disponibles.push(hhmmDesdeMinutos(inicio));
  }

  return disponibles;
}

module.exports = { generarCodigo, calcularDisponibilidad, minutosDesdeHHMM };
