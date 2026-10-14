// Precio con débito de un lavado o extra (si no tiene uno propio, es igual al de contado)
function precioDebitoDe(item) {
  return item.precioDebito != null && item.precioDebito !== '' ? item.precioDebito : item.precio;
}

function calcularCombo(config, { lavadoId, extraIds }) {
  const lavado = config.lavados.find((l) => l.id === lavadoId);
  if (!lavado) return { error: 'Lavado inexistente' };

  const idsExtras = Array.isArray(extraIds) ? extraIds : [];
  const extras = [];
  for (const id of idsExtras) {
    const extra = config.extras.find((e) => e.id === id);
    if (!extra) return { error: `Extra inexistente: ${id}` };
    extras.push(extra);
  }

  const duracionMin = lavado.duracionMin + extras.reduce((acc, e) => acc + (e.duracionMin || 0), 0);
  // precio = contado / efectivo
  const precio = lavado.precio + extras.reduce((acc, e) => acc + (e.precio || 0), 0);
  const precioDebito = precioDebitoDe(lavado) + extras.reduce((acc, e) => acc + (precioDebitoDe(e) || 0), 0);

  return { lavado, extras, duracionMin, precio, precioDebito };
}

module.exports = { calcularCombo, precioDebitoDe };
