const $ = (sel) => document.querySelector(sel);
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const estado = { token: localStorage.getItem('admin_token') || null, config: null, filtroTodos: false, editando: null };

function formatearMoneda(n) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

async function apiAdmin(path, opciones = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}), Authorization: `Bearer ${estado.token}` }
  });
  if (res.status === 401) {
    cerrarSesion();
    throw new Error('Sesión vencida');
  }
  return res;
}

/* ---------- Login ---------- */
function mostrarApp() {
  $('#paso-login').classList.add('oculto');
  $('#app-admin').classList.remove('oculto');
  $('#btn-logout').classList.remove('oculto');
}
function mostrarLogin() {
  $('#paso-login').classList.remove('oculto');
  $('#app-admin').classList.add('oculto');
  $('#btn-logout').classList.add('oculto');
}
function cerrarSesion() {
  estado.token = null;
  localStorage.removeItem('admin_token');
  mostrarLogin();
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = $('#error-login');
  errorEl.classList.add('oculto');
  const password = $('#input-password').value;

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) {
    errorEl.textContent = data.error || 'No se pudo iniciar sesión.';
    errorEl.classList.remove('oculto');
    return;
  }
  estado.token = data.token;
  localStorage.setItem('admin_token', data.token);
  iniciarApp();
});

$('#btn-logout').addEventListener('click', (e) => {
  e.preventDefault();
  cerrarSesion();
});

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('activo'));
    btn.classList.add('activo');
    $('#tab-turnos').classList.toggle('oculto', btn.dataset.tab !== 'turnos');
    $('#tab-config').classList.toggle('oculto', btn.dataset.tab !== 'config');
    if (btn.dataset.tab === 'config') cargarConfigTab();
  });
});

/* ---------- Arranque ---------- */
async function iniciarApp() {
  mostrarApp();
  const cfgRes = await fetch('/api/config');
  estado.config = await cfgRes.json();
  $('#nombre-negocio-admin').textContent = estado.config.negocio.nombre;
  $('#filtro-fecha').value = new Date().toISOString().slice(0, 10);
  cargarTurnos();
}

if (estado.token) {
  iniciarApp().catch(() => mostrarLogin());
} else {
  mostrarLogin();
}

/* ---------- Turnos ---------- */
$('#filtro-fecha').addEventListener('change', () => { estado.filtroTodos = false; cargarTurnos(); });
$('#filtro-estado').addEventListener('change', cargarTurnos);
$('#btn-ver-todos').addEventListener('click', () => { estado.filtroTodos = true; cargarTurnos(); });

async function cargarTurnos() {
  const params = new URLSearchParams();
  if (!estado.filtroTodos) params.set('fecha', $('#filtro-fecha').value);
  if ($('#filtro-estado').value) params.set('estado', $('#filtro-estado').value);
  const res = await apiAdmin(`/turnos?${params}`);
  const data = await res.json();
  renderTablaTurnos(data.turnos || []);
}

function renderTablaTurnos(turnos) {
  const tbody = $('#tabla-turnos-body');
  const sinTurnos = $('#sin-turnos');
  tbody.innerHTML = '';

  if (turnos.length === 0) {
    sinTurnos.classList.remove('oculto');
    return;
  }
  sinTurnos.classList.add('oculto');

  turnos.forEach((t) => {
    const tr = document.createElement('tr');
    const fechaCorta = estado.filtroTodos ? `${t.fecha} ` : '';
    const extrasTxt = t.extras.length ? t.extras.map((e) => e.nombre).join(', ') : '—';
    tr.innerHTML = `
      <td>${fechaCorta}${t.hora}</td>
      <td>${t.nombre}<br/><span style="color:#8a9296;font-size:0.8rem;">${t.telefono}${t.patente ? ' · ' + t.patente : ''}</span></td>
      <td>${t.vehiculoNombre} · ${t.lavadoNombre}</td>
      <td>${extrasTxt}</td>
      <td>${formatearMoneda(t.precio)}</td>
      <td><span class="chip-estado ${t.estado}">${t.estado}</span></td>
      <td>
        <div class="acciones-fila">
          ${t.estado !== 'confirmado' ? `<button class="boton boton-agua" data-accion="confirmar" data-id="${t.id}">Confirmar</button>` : ''}
          <button class="boton boton-fantasma" data-accion="editar" data-id="${t.id}">Reprogramar</button>
          ${t.estado !== 'cancelado' ? `<button class="boton boton-fantasma" data-accion="cancelar" data-id="${t.id}">Cancelar</button>` : ''}
          <button class="boton boton-peligro" data-accion="eliminar" data-id="${t.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => manejarAccionTurno(btn.dataset.accion, btn.dataset.id, turnos));
  });
}

async function manejarAccionTurno(accion, id, turnos) {
  if (accion === 'eliminar') {
    if (!confirm('¿Eliminar este turno definitivamente?')) return;
    await apiAdmin(`/turnos/${id}`, { method: 'DELETE' });
    cargarTurnos();
  } else if (accion === 'editar') {
    const turno = turnos.find((t) => t.id === id);
    abrirPanelEditar(turno);
  } else {
    const estadoNuevo = accion === 'confirmar' ? 'confirmado' : 'cancelado';
    await apiAdmin(`/turnos/${id}/estado`, { method: 'PUT', body: JSON.stringify({ estado: estadoNuevo }) });
    cargarTurnos();
  }
}

/* ---------- Reprogramar turno ---------- */
function abrirPanelEditar(turno) {
  estado.editando = { ...turno, extrasIds: turno.extras.map((e) => e.id) };
  const panel = $('#panel-editar');
  panel.classList.remove('oculto');
  panel.innerHTML = `
    <h3 style="font-family:var(--f-display); margin-top:0;">Reprogramar turno de ${turno.nombre}</h3>
    <div class="fila-2">
      <div class="campo">
        <label>Vehículo</label>
        <select id="ed-vehiculo"></select>
      </div>
      <div class="campo">
        <label>Lavado</label>
        <select id="ed-lavado"></select>
      </div>
    </div>
    <div class="campo">
      <label>Extras</label>
      <div class="lista-extras" id="ed-extras"></div>
    </div>
    <div class="fila-2">
      <div class="campo"><label>Día</label><input type="date" id="ed-fecha" /></div>
      <div class="campo"><label>Horario</label><div class="grilla-horarios" id="ed-horarios"></div></div>
    </div>
    <p class="error-msg oculto" id="ed-error"></p>
    <div class="acciones">
      <button class="boton boton-primario" id="ed-guardar">Guardar cambios</button>
      <button class="boton boton-fantasma" id="ed-cancelar">Cerrar</button>
    </div>
  `;

  const selVehiculo = $('#ed-vehiculo');
  estado.config.vehiculos.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id; opt.textContent = v.nombre;
    if (v.id === turno.vehiculoId) opt.selected = true;
    selVehiculo.appendChild(opt);
  });
  selVehiculo.addEventListener('change', () => {
    estado.editando.vehiculoId = selVehiculo.value;
    estado.editando.lavadoId = null;
    renderEdLavados();
  });

  $('#ed-fecha').value = turno.fecha;
  $('#ed-fecha').min = new Date().toISOString().slice(0, 10);
  $('#ed-fecha').addEventListener('change', () => {
    estado.editando.fecha = $('#ed-fecha').value;
    cargarEdDisponibilidad();
  });

  renderEdLavados();
  renderEdExtras();
  cargarEdDisponibilidad();

  $('#ed-cancelar').addEventListener('click', () => {
    panel.classList.add('oculto');
    panel.innerHTML = '';
    estado.editando = null;
  });
  $('#ed-guardar').addEventListener('click', guardarEdicion);

  panel.scrollIntoView({ behavior: 'smooth' });
}

function renderEdLavados() {
  const sel = $('#ed-lavado');
  sel.innerHTML = '';
  const lavados = estado.config.lavados.filter((l) => l.vehiculoId === estado.editando.vehiculoId);
  lavados.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = `${l.nombre} (${formatearMoneda(l.precio)})`;
    if (l.id === estado.editando.lavadoId || (!estado.editando.lavadoId && l.id === lavados[0]?.id)) {
      opt.selected = true;
      estado.editando.lavadoId = l.id;
    }
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    estado.editando.lavadoId = sel.value;
    cargarEdDisponibilidad();
  });
  cargarEdDisponibilidad();
}

function renderEdExtras() {
  const cont = $('#ed-extras');
  cont.innerHTML = '';
  estado.config.extras.forEach((ex) => {
    const marcado = estado.editando.extrasIds.includes(ex.id);
    const div = document.createElement('label');
    div.className = 'opcion-extra' + (marcado ? ' marcada' : '');
    div.innerHTML = `
      <span class="izq"><input type="checkbox" ${marcado ? 'checked' : ''} /><span class="nombre">${ex.nombre}</span></span>
      <span class="precio">+${formatearMoneda(ex.precio)}</span>
    `;
    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) estado.editando.extrasIds.push(ex.id);
      else estado.editando.extrasIds = estado.editando.extrasIds.filter((id) => id !== ex.id);
      div.classList.toggle('marcada', checkbox.checked);
      cargarEdDisponibilidad();
    });
    cont.appendChild(div);
  });
}

async function cargarEdDisponibilidad() {
  const grilla = $('#ed-horarios');
  if (!estado.editando.lavadoId || !estado.editando.fecha) return;
  grilla.innerHTML = '<p class="mensaje-vacio">Buscando…</p>';

  const params = new URLSearchParams({
    fecha: estado.editando.fecha,
    lavadoId: estado.editando.lavadoId,
    extras: estado.editando.extrasIds.join(','),
    excluirId: estado.editando.id
  });
  const res = await apiAdmin(`/disponibilidad?${params}`);
  const data = await res.json();
  const horarios = data.horarios || [];

  grilla.innerHTML = '';
  if (horarios.length === 0) {
    grilla.innerHTML = '<p class="mensaje-vacio">No hay horarios disponibles ese día.</p>';
    return;
  }
  horarios.forEach((h) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot' + (h === estado.editando.hora ? ' seleccionado' : '');
    btn.textContent = h;
    btn.addEventListener('click', () => {
      estado.editando.hora = h;
      document.querySelectorAll('#ed-horarios .slot').forEach((el) => el.classList.remove('seleccionado'));
      btn.classList.add('seleccionado');
    });
    grilla.appendChild(btn);
  });
}

async function guardarEdicion() {
  const errorEl = $('#ed-error');
  errorEl.classList.add('oculto');
  const { id, vehiculoId, lavadoId, extrasIds, fecha, hora } = estado.editando;
  if (!vehiculoId || !lavadoId || !fecha || !hora) {
    errorEl.textContent = 'Completá vehículo, lavado, día y horario.';
    errorEl.classList.remove('oculto');
    return;
  }
  const res = await apiAdmin(`/turnos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ vehiculoId, lavadoId, extras: extrasIds, fecha, hora })
  });
  const data = await res.json();
  if (!res.ok) {
    errorEl.textContent = data.error || 'No se pudo reprogramar.';
    errorEl.classList.remove('oculto');
    return;
  }
  $('#panel-editar').classList.add('oculto');
  $('#panel-editar').innerHTML = '';
  estado.editando = null;
  cargarTurnos();
}

/* ---------- Configuración ---------- */
async function cargarConfigTab() {
  const res = await apiAdmin('/config');
  const cfg = await res.json();
  estado.config = cfg;

  $('#cfg-nombre').value = cfg.negocio.nombre || '';
  $('#cfg-telefono').value = cfg.negocio.telefono || '';
  $('#cfg-direccion').value = cfg.negocio.direccion || '';

  renderLavadosConfig(cfg.lavados);
  renderExtrasConfig(cfg.extras);
  renderHorariosConfig(cfg.horarios);
}

function renderLavadosConfig(lavados) {
  const cont = $('#lista-cfg-lavados');
  cont.innerHTML = '';
  lavados.forEach((l, idx) => {
    const fila = document.createElement('div');
    fila.className = 'fila-item';
    fila.innerHTML = `
      <input type="text" value="${l.nombre}" data-campo="nombre" placeholder="Nombre del lavado" />
      <input type="text" value="${l.vehiculoId}" data-campo="vehiculoId" placeholder="auto / moto" />
      <input type="number" value="${l.duracionMin}" data-campo="duracionMin" placeholder="Minutos" min="5" step="5" />
      <input type="number" value="${l.precio}" data-campo="precio" placeholder="Precio" min="0" step="100" />
      <button type="button" class="boton boton-fantasma" data-quitar="${idx}">Quitar</button>
    `;
    cont.appendChild(fila);
  });
  cont.dataset.ids = JSON.stringify(lavados.map((l) => l.id));

  cont.querySelectorAll('[data-quitar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const actuales = leerLavadosDesdeUI();
      actuales.splice(Number(btn.dataset.quitar), 1);
      renderLavadosConfig(actuales);
    });
  });
}

$('#btn-agregar-lavado').addEventListener('click', () => {
  const actuales = leerLavadosDesdeUI();
  actuales.push({ id: `lav_${Date.now()}`, nombre: '', vehiculoId: 'auto', duracionMin: 30, precio: 0 });
  renderLavadosConfig(actuales);
});

function leerLavadosDesdeUI() {
  const cont = $('#lista-cfg-lavados');
  const ids = JSON.parse(cont.dataset.ids || '[]');
  const filas = [...cont.querySelectorAll('.fila-item')];
  return filas.map((fila, idx) => ({
    id: ids[idx] || `lav_${Date.now()}_${idx}`,
    nombre: fila.querySelector('[data-campo="nombre"]').value.trim(),
    vehiculoId: fila.querySelector('[data-campo="vehiculoId"]').value.trim() || 'auto',
    duracionMin: Number(fila.querySelector('[data-campo="duracionMin"]').value) || 30,
    precio: Number(fila.querySelector('[data-campo="precio"]').value) || 0
  }));
}

function renderExtrasConfig(extras) {
  const cont = $('#lista-cfg-extras');
  cont.innerHTML = '';
  extras.forEach((ex, idx) => {
    const fila = document.createElement('div');
    fila.className = 'fila-item extra';
    fila.innerHTML = `
      <input type="text" value="${ex.nombre}" data-campo="nombre" placeholder="Nombre del extra" />
      <input type="number" value="${ex.precio}" data-campo="precio" placeholder="Precio" min="0" step="100" />
      <input type="number" value="${ex.duracionMin || 0}" data-campo="duracionMin" placeholder="Minutos extra" min="0" step="5" />
      <button type="button" class="boton boton-fantasma" data-quitar="${idx}">Quitar</button>
    `;
    cont.appendChild(fila);
  });
  cont.dataset.ids = JSON.stringify(extras.map((e) => e.id));

  cont.querySelectorAll('[data-quitar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const actuales = leerExtrasDesdeUI();
      actuales.splice(Number(btn.dataset.quitar), 1);
      renderExtrasConfig(actuales);
    });
  });
}

$('#btn-agregar-extra').addEventListener('click', () => {
  const actuales = leerExtrasDesdeUI();
  actuales.push({ id: `extra_${Date.now()}`, nombre: '', precio: 0, duracionMin: 0 });
  renderExtrasConfig(actuales);
});

function leerExtrasDesdeUI() {
  const cont = $('#lista-cfg-extras');
  const ids = JSON.parse(cont.dataset.ids || '[]');
  const filas = [...cont.querySelectorAll('.fila-item')];
  return filas.map((fila, idx) => ({
    id: ids[idx] || `extra_${Date.now()}_${idx}`,
    nombre: fila.querySelector('[data-campo="nombre"]').value.trim(),
    precio: Number(fila.querySelector('[data-campo="precio"]').value) || 0,
    duracionMin: Number(fila.querySelector('[data-campo="duracionMin"]').value) || 0
  }));
}

function renderHorariosConfig(horarios) {
  const cont = $('#lista-cfg-horarios');
  cont.innerHTML = '';
  for (let dia = 0; dia <= 6; dia++) {
    const h = horarios[dia] || horarios[String(dia)];
    const cerrado = !h;
    const fila = document.createElement('div');
    fila.className = 'fila-horario' + (cerrado ? ' cerrado' : '');
    fila.dataset.dia = dia;
    fila.innerHTML = `
      <span class="dia-label">${NOMBRES_DIA[dia]}</span>
      <input type="time" value="${cerrado ? '08:00' : h.apertura}" data-campo="apertura" ${cerrado ? 'disabled' : ''} />
      <input type="time" value="${cerrado ? '19:00' : h.cierre}" data-campo="cierre" ${cerrado ? 'disabled' : ''} />
      <label style="display:flex;align-items:center;gap:0.4rem;font-weight:400;">
        <input type="checkbox" data-campo="cerrado" ${cerrado ? 'checked' : ''} style="width:auto;" /> Cerrado
      </label>
    `;
    const checkbox = fila.querySelector('[data-campo="cerrado"]');
    checkbox.addEventListener('change', () => {
      fila.classList.toggle('cerrado', checkbox.checked);
      fila.querySelectorAll('input[type="time"]').forEach((i) => (i.disabled = checkbox.checked));
    });
    cont.appendChild(fila);
  }
}

function leerHorariosDesdeUI() {
  const filas = [...$('#lista-cfg-horarios').querySelectorAll('.fila-horario')];
  const horarios = {};
  filas.forEach((fila) => {
    const dia = fila.dataset.dia;
    const cerrado = fila.querySelector('[data-campo="cerrado"]').checked;
    horarios[dia] = cerrado
      ? null
      : {
          apertura: fila.querySelector('[data-campo="apertura"]').value,
          cierre: fila.querySelector('[data-campo="cierre"]').value
        };
  });
  return horarios;
}

$('#btn-guardar-config').addEventListener('click', async () => {
  const errorEl = $('#error-config');
  const exitoEl = $('#exito-config');
  errorEl.classList.add('oculto');
  exitoEl.classList.add('oculto');

  const payload = {
    negocio: {
      nombre: $('#cfg-nombre').value.trim(),
      telefono: $('#cfg-telefono').value.trim(),
      direccion: $('#cfg-direccion').value.trim()
    },
    lavados: leerLavadosDesdeUI(),
    extras: leerExtrasDesdeUI(),
    horarios: leerHorariosDesdeUI(),
    vehiculos: estado.config.vehiculos
  };

  const res = await apiAdmin('/config', { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) {
    const data = await res.json();
    errorEl.textContent = data.error || 'No se pudo guardar.';
    errorEl.classList.remove('oculto');
    return;
  }
  exitoEl.classList.remove('oculto');
  setTimeout(() => exitoEl.classList.add('oculto'), 2500);
});
