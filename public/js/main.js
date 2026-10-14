const estado = {
  config: null,
  vehiculoId: null,
  lavadoId: null,
  extrasSeleccionados: new Set(),
  fecha: null,
  hora: null,
  duracionMin: null,
  precio: null,
  precioDebito: null
};

const $ = (sel) => document.querySelector(sel);

function formatearMoneda(n) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}
// Precio con débito (si no tiene uno propio, es igual al de contado)
function precioDebitoDe(item) {
  return item.precioDebito != null && item.precioDebito !== '' ? item.precioDebito : item.precio;
}

// "$50.000 contado / $60.000 débito", o un solo precio si son iguales
function htmlPrecios(contado, debito, prefijo = '') {
  if (debito == null || debito === contado) return `${prefijo}${formatearMoneda(contado)}`;
  return `${prefijo}${formatearMoneda(contado)} <span class="forma-pago">contado</span>` +
    `<span class="precio-debito">${prefijo}${formatearMoneda(debito)} <span class="forma-pago">débito</span></span>`;
}

function formatearFechaLarga(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function cargarConfig() {
  const res = await fetch('/api/config');
  estado.config = await res.json();
  $('#nombre-negocio').textContent = estado.config.negocio.nombre;
  document.title = `Reservar turno · ${estado.config.negocio.nombre}`;
  renderVehiculos();
  // Fecha mínima = hoy en hora de Argentina (toISOString usa UTC y después de las 21 daba "mañana")
  $('#input-fecha').min = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

function renderVehiculos() {
  const cont = $('#lista-vehiculos');
  cont.innerHTML = '';
  estado.config.vehiculos.forEach((v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opcion';
    btn.dataset.id = v.id;
    btn.innerHTML = `<span class="nombre">${v.nombre}</span>`;
    btn.addEventListener('click', () => seleccionarVehiculo(v.id));
    cont.appendChild(btn);
  });
}

function seleccionarVehiculo(id) {
  estado.vehiculoId = id;
  estado.lavadoId = null;
  estado.extrasSeleccionados.clear();
  document.querySelectorAll('#lista-vehiculos .opcion').forEach((el) => el.classList.toggle('seleccionada', el.dataset.id === id));
  $('#paso-lavado').setAttribute('aria-disabled', 'false');
  renderLavados();
  ocultarPasosDesde('paso-extras');
}

function renderLavados() {
  const cont = $('#lista-lavados');
  cont.innerHTML = '';
  const lavados = estado.config.lavados.filter((l) => l.vehiculoId === estado.vehiculoId);
  lavados.forEach((l) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opcion';
    btn.dataset.id = l.id;
    btn.innerHTML = `
      <span class="nombre">${l.nombre}</span>
      <span class="detalle">${l.duracionMin} min</span>
      <span class="precio">${htmlPrecios(l.precio, precioDebitoDe(l))}</span>
    `;
    btn.addEventListener('click', () => seleccionarLavado(l.id));
    cont.appendChild(btn);
  });
}

function seleccionarLavado(id) {
  estado.lavadoId = id;
  document.querySelectorAll('#lista-lavados .opcion').forEach((el) => el.classList.toggle('seleccionada', el.dataset.id === id));
  $('#paso-extras').setAttribute('aria-disabled', 'false');
  renderExtras();
  ocultarPasosDesde('paso-horario');
  if (estado.fecha) cargarDisponibilidad();
}

function renderExtras() {
  const cont = $('#lista-extras');
  cont.innerHTML = '';
  estado.config.extras.forEach((ex) => {
    const div = document.createElement('label');
    div.className = 'opcion-extra' + (estado.extrasSeleccionados.has(ex.id) ? ' marcada' : '');
    div.innerHTML = `
      <span class="izq">
        <input type="checkbox" data-id="${ex.id}" ${estado.extrasSeleccionados.has(ex.id) ? 'checked' : ''} />
        <span class="nombre">${ex.nombre}</span>
      </span>
      <span class="precio">${htmlPrecios(ex.precio, precioDebitoDe(ex), '+')}</span>
    `;
    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) estado.extrasSeleccionados.add(ex.id);
      else estado.extrasSeleccionados.delete(ex.id);
      div.classList.toggle('marcada', checkbox.checked);
      ocultarPasosDesde('paso-horario');
      if (estado.fecha) cargarDisponibilidad();
    });
    cont.appendChild(div);
  });
  $('#paso-fecha').setAttribute('aria-disabled', 'false');
}

function ocultarPasosDesde(idPaso) {
  const orden = ['paso-horario', 'paso-datos'];
  const idx = orden.indexOf(idPaso);
  orden.slice(idx).forEach((id) => $(`#${id}`).setAttribute('aria-disabled', 'true'));
  $('#grilla-horarios').innerHTML = '';
  estado.hora = null;
}

$('#input-fecha').addEventListener('change', (e) => {
  estado.fecha = e.target.value;
  ocultarPasosDesde('paso-horario');
  if (estado.lavadoId) cargarDisponibilidad();
});

async function cargarDisponibilidad() {
  const grilla = $('#grilla-horarios');
  const sinHorarios = $('#sin-horarios');
  grilla.innerHTML = '<p class="mensaje-vacio">Buscando horarios…</p>';
  sinHorarios.classList.add('oculto');

  const params = new URLSearchParams({
    fecha: estado.fecha,
    lavadoId: estado.lavadoId,
    extras: [...estado.extrasSeleccionados].join(',')
  });
  const res = await fetch(`/api/disponibilidad?${params}`);
  const data = await res.json();

  estado.duracionMin = data.duracionMin;
  estado.precio = data.precio;
  estado.precioDebito = data.precioDebito;

  $('#paso-horario').setAttribute('aria-disabled', 'false');
  grilla.innerHTML = '';

  if (!data.horarios || data.horarios.length === 0) {
    sinHorarios.classList.remove('oculto');
    return;
  }

  data.horarios.forEach((h) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.textContent = h;
    btn.addEventListener('click', () => seleccionarHorario(h, btn));
    grilla.appendChild(btn);
  });
}

function seleccionarHorario(hora, btnEl) {
  estado.hora = hora;
  document.querySelectorAll('.slot').forEach((el) => el.classList.remove('seleccionado'));
  btnEl.classList.add('seleccionado');
  $('#paso-datos').setAttribute('aria-disabled', 'false');
  renderResumenTotal();
}

function nombresExtras() {
  return [...estado.extrasSeleccionados].map((id) => estado.config.extras.find((e) => e.id === id));
}

function renderResumenTotal() {
  const lavado = estado.config.lavados.find((l) => l.id === estado.lavadoId);
  const extras = nombresExtras();
  let filas = `
    <div class="fila"><span class="k">${lavado.nombre}</span><span class="v">${formatearMoneda(lavado.precio)}</span></div>
  `;
  extras.forEach((ex) => {
    filas += `<div class="fila"><span class="k">+ ${ex.nombre}</span><span class="v">${formatearMoneda(ex.precio)}</span></div>`;
  });
  filas += filasTotal(estado.precio, estado.precioDebito);
  $('#resumen-total').innerHTML = filas;
}

// Total en contado y, si es distinto, también con débito
function filasTotal(contado, debito) {
  if (debito == null || debito === contado) {
    return `<div class="fila total"><span class="k">Total</span><span class="v">${formatearMoneda(contado)}</span></div>`;
  }
  return `
    <div class="fila total"><span class="k">Total contado / efectivo</span><span class="v">${formatearMoneda(contado)}</span></div>
    <div class="fila total"><span class="k">Total con débito</span><span class="v">${formatearMoneda(debito)}</span></div>
  `;
}

$('#form-reserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = $('#error-reserva');
  errorEl.classList.add('oculto');

  if (!estado.vehiculoId || !estado.lavadoId || !estado.fecha || !estado.hora) {
    errorEl.textContent = 'Completá todos los pasos antes de confirmar.';
    errorEl.classList.remove('oculto');
    return;
  }

  const btn = $('#btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Reservando…';

  try {
    const res = await fetch('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehiculoId: estado.vehiculoId,
        lavadoId: estado.lavadoId,
        extras: [...estado.extrasSeleccionados],
        fecha: estado.fecha,
        hora: estado.hora,
        nombre: $('#input-nombre').value,
        telefono: $('#input-telefono').value,
        patente: $('#input-patente').value,
        notas: $('#input-notas').value
      })
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'No pudimos crear la reserva.';
      errorEl.classList.remove('oculto');
      if (res.status === 409) cargarDisponibilidad();
      return;
    }

    mostrarConfirmacion(data.turno);
  } catch {
    errorEl.textContent = 'Hubo un problema de conexión. Intentá de nuevo.';
    errorEl.classList.remove('oculto');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar reserva';
  }
});

function mostrarConfirmacion(turno) {
  document.querySelectorAll('.paso').forEach((el) => el.classList.add('oculto'));
  $('#paso-confirmacion').classList.remove('oculto');

  let filas = `
    <div class="fila"><span class="k">Vehículo</span><span class="v">${turno.vehiculoNombre}</span></div>
    <div class="fila"><span class="k">Lavado</span><span class="v">${turno.lavadoNombre}</span></div>
  `;
  turno.extras.forEach((ex) => {
    filas += `<div class="fila"><span class="k">+ ${ex.nombre}</span><span class="v">${formatearMoneda(ex.precio)}</span></div>`;
  });
  filas += `
    <div class="fila"><span class="k">Día</span><span class="v">${formatearFechaLarga(turno.fecha)}</span></div>
    <div class="fila"><span class="k">Hora</span><span class="v">${turno.hora}</span></div>
    ${filasTotal(turno.precio, turno.precioDebito)}
  `;
  $('#resumen-confirmacion').innerHTML = filas;
}

$('#btn-nueva-reserva').addEventListener('click', () => window.location.reload());

cargarConfig();
