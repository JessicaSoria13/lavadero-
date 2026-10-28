// Aviso por WhatsApp cada vez que entra una reserva (vía CallMeBot, gratis, a tu propio número).
// Se activa configurando WHATSAPP_TELEFONO y WHATSAPP_APIKEY (ver README).

function formatearMoneda(n) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function formatearFecha(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dia = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' });
  return `${dia} ${d}/${m}`;
}

function textoNuevoTurno(turno) {
  const extras = turno.extras.length ? turno.extras.map((e) => e.nombre).join(', ') : 'sin extras';
  return [
    '🚗 *Nueva reserva*',
    '',
    `📅 ${formatearFecha(turno.fecha)} a las ${turno.hora}`,
    `👤 ${turno.nombre} · ${turno.telefono}`,
    `🚘 ${turno.vehiculoNombre}${turno.patente ? ' · ' + turno.patente : ''}`,
    `🧽 ${turno.lavadoNombre} (${extras})`,
    turno.precioDebito != null && turno.precioDebito !== turno.precio
      ? `💲 ${formatearMoneda(turno.precio)} contado / ${formatearMoneda(turno.precioDebito)} débito`
      : `💲 ${formatearMoneda(turno.precio)}`,
    turno.notas ? `📝 ${turno.notas}` : null
  ]
    .filter((linea) => linea !== null)
    .join('\n');
}

async function enviarWhatsApp(texto) {
  const telefono = process.env.WHATSAPP_TELEFONO;
  const apikey = process.env.WHATSAPP_APIKEY;
  if (!telefono || !apikey) return false;

  const params = new URLSearchParams({ phone: telefono, text: texto, apikey });
  const res = await fetch(`https://api.callmebot.com/whatsapp.php?${params}`, {
    signal: AbortSignal.timeout(8000)
  });
  const cuerpo = await res.text();
  if (!res.ok || /error/i.test(cuerpo)) {
    throw new Error(`CallMeBot respondió ${res.status}: ${cuerpo.replace(/<[^>]+>/g, ' ').trim().slice(0, 300)}`);
  }
  return true;
}

// Devuelve una promesa que nunca falla: hay que esperarla (await) antes de responder,
// porque en Vercel la función se congela apenas manda la respuesta y el aviso se perdería.
// Si el aviso falla, la reserva sigue igual: solo queda registrado en los logs.
function avisarNuevoTurno(turno) {
  return enviarWhatsApp(textoNuevoTurno(turno)).catch((err) => {
    console.error('No se pudo enviar el aviso por WhatsApp:', err.message);
  });
}

module.exports = { avisarNuevoTurno, enviarWhatsApp };
