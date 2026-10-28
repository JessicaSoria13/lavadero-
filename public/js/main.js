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
const ZONA = 'America/Argentina/Buenos_Aires';
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ICONOS = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16H3.5a.5.5 0 0 1-.5-.5V13l2-5h11l3.5 5H21a1 1 0 0 1 1 1v1.5a.5.5 0 0 1-.5.5H19"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/><path d="M9 16.5h6M5 13h14"/></svg>',
  moto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><path d="M5 16l4-6h5l3 6M14 10l-1-3h3M9 10l3 6h4"/></svg>',
  ubicacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  telefono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'
};

function formatearMoneda(n) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

// Los datos de la configuración se escapan antes de ir al HTML
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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

// 45 → "45 min", 60 → "1 h", 135 → "2 h 15 min"
function formatearDuracion(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatearFechaLarga(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Día de la semana (0 = domingo) y minutos desde las 00:00, en hora de Argentina
function ahoraAR() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday);
  return { dia, minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

function minutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function horarioDelDia(dia) {
  const h = estado.config.horarios;
  return h[dia] || h[String(dia)] || null;
}

// Link de WhatsApp a partir del teléfono del negocio (formato Argentina: 549 + característica + número)
function linkWhatsApp(mensaje) {
  let digitos = String(estado.config.negocio.telefono || '').replace(/\D/g, '');
  if (!digitos) return null;
  if (!digitos.startsWith('54')) digitos = '549' + digitos.replace(/^0/, '');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

/* ---------- Portada ---------- */
function renderPortada() {
  const { negocio } = estado.config;
  const nombre = negocio.nombre || 'Lavadero';

  $('#nombre-negocio').textContent = nombre;
  $('#pie-nombre').textContent = nombre;
  document.title = `${nombre} · Reservá tu turno`;

  // Título con la última palabra resaltada
  const palabras = nombre.split(' ');
  const ultima = palabras.pop();
  $('#hero-titulo').innerHTML = `${esc(palabras.join(' '))} <span class="resaltado">${esc(ultima)}</span>`;
  if (negocio.eslogan) $('#hero-texto').textContent = negocio.eslogan;

  const vehiculos = estado.config.vehiculos.map((v) => v.nombre.toLowerCase() + 's');
  $('#hero-etiqueta').textContent = vehiculos.length ? vehiculos.join(' y ').replace(/^./, (c) => c.toUpperCase()) : 'Lavadero';

  if (negocio.direccion) {
    $('#hero-direccion').textContent = `📍 ${negocio.direccion}`;
    $('#hero-direccion').classList.remove('oculto');
  }

  const wa = linkWhatsApp('¡Hola! Quería hacer una consulta por un turno.');
  if (wa) {
    $('#hero-whatsapp').href = wa;
    $('#hero-whatsapp').classList.remove('oculto');
  }

  renderEstadoAbierto();
  renderDestacados();
  renderServicios();
  renderHorarios();
  renderContacto();
}

function renderEstadoAbierto() {
  const { dia, minutos: ahora } = ahoraAR();
  const hoy = horarioDelDia(dia);
  let clase = 'cerrado';
  let texto;

  if (hoy && ahora >= minutos(hoy.apertura) && ahora < minutos(hoy.cierre)) {
    clase = 'abierto';
    texto = `Abierto ahora · hasta las ${hoy.cierre}`;
  } else if (hoy && ahora < minutos(hoy.apertura)) {
    texto = `Cerrado · abre hoy a las ${hoy.apertura}`;
  } else {
    texto = 'Cerrado ahora';
    for (let i = 1; i <= 7; i++) {
      const d = (dia + i) % 7;
      const h = horarioDelDia(d);
      if (h) {
        texto += ` · abre ${i === 1 ? 'mañana' : 'el ' + NOMBRES_DIA[d].toLowerCase()} a las ${h.apertura}`;
        break;
      }
    }
  }
  $('#hero-estado').innerHTML = `<i class="punto ${clase}"></i> ${esc(texto)}`;
}

function renderDestacados() {
  const lista = $('#hero-servicios');
  const lavados = [...estado.config.lavados].sort((a, b) => a.precio - b.precio).slice(0, 5);
  lista.innerHTML = lavados
    .map((l) => {
      const vehiculo = estado.config.vehiculos.find((v) => v.id === l.vehiculoId);
      const sufijo = estado.config.vehiculos.length > 1 && vehiculo && !l.nombre.toLowerCase().includes(vehiculo.nombre.toLowerCase())
        ? ` <span class="k">(${esc(vehiculo.nombre.toLowerCase())})</span>`
        : '';
      return `<li><span class="k">${esc(l.nombre)}${sufijo}</span><span class="v">${formatearMoneda(l.precio)}</span></li>`;
    })
    .join('');
}

function renderServicios() {
  const cont = $('#lista-servicios');
  cont.innerHTML = '';

  estado.config.vehiculos.forEach((v) => {
    const lavados = estado.config.lavados.filter((l) => l.vehiculoId === v.id);
    if (!lavados.length) return;

    const grupo = document.createElement('div');
    grupo.className = 'grupo-servicios';
    grupo.innerHTML = `<h3>${esc(v.nombre)}s</h3><div class="grilla-servicios"></div>`;
    const grilla = grupo.querySelector('.grilla-servicios');

    lavados.forEach((l) => {
      const debito = precioDebitoDe(l);
      const tarjeta = document.createElement('article');
      tarjeta.className = 'servicio';
      tarjeta.innerHTML = `
        <div class="cabeza">
          <h4>${esc(l.nombre)}</h4>
          <span class="duracion">⏱ ${formatearDuracion(l.duracionMin)}</span>
        </div>
        <div class="precios">
          <div class="precio-principal">${formatearMoneda(l.precio)} ${debito !== l.precio ? '<small>efectivo</small>' : ''}</div>
          ${debito !== l.precio ? `<div class="precio-alt">${formatearMoneda(debito)} <small>con débito</small></div>` : ''}
        </div>
        <button type="button" class="boton boton-oscuro boton-ancho">Reservar</button>
      `;
      tarjeta.querySelector('button').addEventListener('click', () => reservarServicio(v.id, l.id));
      grilla.appendChild(tarjeta);
    });
    cont.appendChild(grupo);
  });

  const extras = estado.config.extras;
  $('#extras-portada').classList.toggle('oculto', !extras.length);
  $('#lista-extras-portada').innerHTML = extras
    .map((ex) => `<span class="chip">${esc(ex.nombre)}<strong>+${formatearMoneda(ex.precio)}</strong></span>`)
    .join('');
}

// Desde la tarjeta de un servicio: lo deja elegido en el formulario y baja a los extras
function reservarServicio(vehiculoId, lavadoId) {
  seleccionarVehiculo(vehiculoId);
  seleccionarLavado(lavadoId);
  $('#paso-extras').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHorarios() {
  const { dia: hoy } = ahoraAR();
  const orden = [1, 2, 3, 4, 5, 6, 0]; // de lunes a domingo
  $('#tabla-horarios').innerHTML = orden
    .map((d) => {
      const h = horarioDelDia(d);
      return `<tr class="${d === hoy ? 'hoy' : ''}">
        <td>${NOMBRES_DIA[d]}</td>
        <td>${h ? `${esc(h.apertura)} a ${esc(h.cierre)}` : '<span class="cerrado-dia">Cerrado</span>'}</td>
      </tr>`;
    })
    .join('');
}

function renderContacto() {
  const { negocio } = estado.config;
  const items = [];
  if (negocio.direccion) {
    items.push(`<li><span class="icono">${ICONOS.ubicacion}</span><div><span class="k">Dirección</span><span class="v">${esc(negocio.direccion)}</span></div></li>`);
  }
  if (negocio.telefono) {
    items.push(`<li><span class="icono">${ICONOS.telefono}</span><div><span class="k">Teléfono / WhatsApp</span><a class="v" href="tel:${esc(negocio.telefono.replace(/[^\d+]/g, ''))}">${esc(negocio.telefono)}</a></div></li>`);
  }
  $('#lista-contacto').innerHTML = items.join('') || '<li class="mensaje-vacio">Pronto vas a ver acá nuestros datos de contacto.</li>';

  const acciones = [];
  if (negocio.direccion) {
    const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${negocio.direccion} ${negocio.nombre || ''}`)}`;
    acciones.push(`<a class="boton boton-fantasma" href="${esc(mapa)}" target="_blank" rel="noopener">Cómo llegar</a>`);
  }
  const wa = linkWhatsApp('¡Hola! Quería hacer una consulta.');
  if (wa) acciones.push(`<a class="boton boton-whatsapp" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`);
  $('#acciones-contacto').innerHTML = acciones.join('');

  $('#pie-datos').textContent = [negocio.direccion, negocio.telefono].filter(Boolean).join(' · ');
}

/* ---------- Reserva ---------- */
async function cargarConfig() {
  const res = await fetch('/api/config');
  estado.config = await res.json();
  renderPortada();
  renderVehiculos();
  // Fecha mínima = hoy en hora de Argentina (toISOString usa UTC y después de las 21 daba "mañana")
  $('#input-fecha').min = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
}

function renderVehiculos() {
  const cont = $('#lista-vehiculos');
  cont.innerHTML = '';
  estado.config.vehiculos.forEach((v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opcion opcion-vehiculo';
    btn.dataset.id = v.id;
    btn.innerHTML = `${ICONOS[v.id] || ''}<span class="nombre">${esc(v.nombre)}</span>`;
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
      <span class="nombre">${esc(l.nombre)}</span>
      <span class="detalle">${formatearDuracion(l.duracionMin)}</span>
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
        <input type="checkbox" data-id="${esc(ex.id)}" ${estado.extrasSeleccionados.has(ex.id) ? 'checked' : ''} />
        <span class="nombre">${esc(ex.nombre)}</span>
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
    <div class="fila"><span class="k">${esc(lavado.nombre)}</span><span class="v">${formatearMoneda(lavado.precio)}</span></div>
  `;
  extras.forEach((ex) => {
    filas += `<div class="fila"><span class="k">+ ${esc(ex.nombre)}</span><span class="v">${formatearMoneda(ex.precio)}</span></div>`;
  });
  filas += `<div class="fila"><span class="k">Duración aproximada</span><span class="v">${formatearDuracion(estado.duracionMin)}</span></div>`;
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
  document.querySelectorAll('.reserva .paso').forEach((el) => el.classList.add('oculto'));
  $('#paso-confirmacion').classList.remove('oculto');
  $('#reservar').scrollIntoView({ behavior: 'smooth', block: 'start' });

  let filas = `
    <div class="fila"><span class="k">Vehículo</span><span class="v">${esc(turno.vehiculoNombre)}</span></div>
    <div class="fila"><span class="k">Servicio</span><span class="v">${esc(turno.lavadoNombre)}</span></div>
  `;
  turno.extras.forEach((ex) => {
    filas += `<div class="fila"><span class="k">+ ${esc(ex.nombre)}</span><span class="v">${formatearMoneda(ex.precio)}</span></div>`;
  });
  filas += `
    <div class="fila"><span class="k">Día</span><span class="v">${formatearFechaLarga(turno.fecha)}</span></div>
    <div class="fila"><span class="k">Hora</span><span class="v">${esc(turno.hora)}</span></div>
    ${filasTotal(turno.precio, turno.precioDebito)}
  `;
  $('#resumen-confirmacion').innerHTML = filas;

  const wa = linkWhatsApp(`¡Hola! Reservé un turno para el ${formatearFechaLarga(turno.fecha)} a las ${turno.hora} (${turno.lavadoNombre}). Soy ${turno.nombre}.`);
  if (wa) {
    $('#confirmacion-whatsapp').href = wa;
    $('#confirmacion-whatsapp').classList.remove('oculto');
  }
}

$('#btn-nueva-reserva').addEventListener('click', () => window.location.reload());

cargarConfig();
