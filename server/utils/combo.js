function calcularCombo(db, { lavadoId, extraIds }) {
  const lavado = db.config.lavados.find((l) => l.id === lavadoId);
  if (!lavado) return { error: 'Lavado inexistente' };

  const idsExtras = Array.isArray(extraIds) ? extraIds : [];
  const extras = [];
  for (const id of idsExtras) {
    const extra = db.config.extras.find((e) => e.id === id);
    if (!extra) return { error: `Extra inexistente: ${id}` };
    extras.push(extra);
  }

  const duracionMin = lavado.duracionMin + extras.reduce((acc, e) => acc + (e.duracionMin || 0), 0);
  const precio = lavado.precio + extras.reduce((acc, e) => acc + (e.precio || 0), 0);

  return { lavado, extras, duracionMin, precio };
}

module.exports = { calcularCombo };
