# Turnos Lavadero

Sistema de reserva de turnos para un lavadero de autos y motos, con extras opcionales (perfume, cera, etc.) y panel de administración. El cliente reserva sin necesidad de código: vos gestionás todo (confirmar, reprogramar, cancelar) desde el panel.

## ¿Qué incluye?

- **Reservar turno** (`/index.html`): el cliente elige vehículo (auto/moto), el tipo de lavado disponible para ese vehículo, extras opcionales (que suman precio y, si corresponde, tiempo), día y horario libre, y carga sus datos. Al confirmar ve el resumen con el precio total.
- **Panel del lavadero** (`/admin/`): login con contraseña, ver los turnos del día (o de todos los días), **confirmarlos**, **reprogramarlos** (cambiar vehículo, lavado, extras, día u horario) o **cancelarlos**, y eliminarlos. También permite editar la configuración (vehículos, lavados y precios, extras, horarios de atención) sin tocar código.
- No hay gestión por parte del cliente (sin "mi turno" ni código): cualquier cambio lo hace el lavadero desde el panel.

Los datos se guardan en un archivo `server/data/db.json` que se crea solo, sin necesidad de instalar una base de datos aparte.

## Requisitos

- [Node.js](https://nodejs.org) versión 18 o superior.

## Instalación

```bash
npm install
cp .env.example .env
```

Por defecto la contraseña de administrador es **`barberia123`** (heredada de la plantilla base). Cambiala generando un hash nuevo:

```bash
node scripts/generar-password.js "tuNuevaContraseña"
```

Pegá la línea `ADMIN_PASSWORD_HASH=...` que te muestra dentro de tu `.env`.

## Ejecutar

```bash
npm start
```

- `http://localhost:3000/` → sitio de reservas
- `http://localhost:3000/admin/` → panel del lavadero

Para desarrollo con reinicio automático:

```bash
npm run dev
```

## Personalizar tu lavadero

Desde el panel → pestaña **Configuración**:

- Nombre, teléfono y dirección del negocio.
- **Lavados por vehículo**: cada lavado tiene un nombre, a qué vehículo corresponde (escribí exactamente `auto` o `moto`), duración en minutos y precio. Podés agregar tantos como quieras (por ejemplo "Lavado Express", "Lavado + Aspirado", etc.) para cada vehículo.
- **Extras**: nombre, precio, y minutos que agrega a la duración del turno (podés poner 0 si no suma tiempo, como el perfume).
- **Horarios de atención** por día (o marcar un día como cerrado).

Si en algún momento querés agregar otro tipo de vehículo (por ejemplo "camioneta"), avisame y te ayudo a sumarlo en el código (hoy los tipos de vehículo válidos son "auto" y "moto").

## Cómo funciona la reserva

1. El cliente elige vehículo → lavado disponible para ese vehículo → extras opcionales → día y horario libre (el sistema calcula la duración total sumando el lavado y los extras elegidos, y solo muestra horarios donde entra completo sin pisarse con otro turno).
2. Al confirmar, el turno queda en estado **pendiente**. No se le entrega ningún código al cliente.
3. Vos, desde el panel, lo marcás como **confirmado** cuando corresponda (por ejemplo al llamarlo o coordinar), lo **reprogramás** si hace falta cambiar día/hora/lavado/extras, o lo **cancelás**.

## Publicar el sitio online

Mismo proceso que cualquier proyecto Node: subir a un hosting como Railway, Render o Fly.io, configurar las variables de entorno (`ADMIN_PASSWORD_HASH`, `JWT_SECRET`) y que ejecute `npm install` + `npm start`. Si ya publicaste otro proyecto similar antes, el proceso es idéntico.

## Estructura del proyecto

```
lavadero-turnos/
├── server/
│   ├── index.js
│   ├── db.js                  # vehículos, lavados, extras, horarios, turnos
│   ├── routes/
│   │   ├── public.js          # config, disponibilidad, crear turno
│   │   └── admin.js           # login, listar/reprogramar/cancelar/eliminar, config
│   └── utils/
│       ├── slots.js           # cálculo de horarios disponibles
│       ├── combo.js           # cálculo de precio/duración de lavado + extras
│       └── auth.js            # login con JWT
├── public/
│   ├── index.html + js/main.js        # reservar turno
│   └── admin/                          # panel del lavadero
├── scripts/generar-password.js
├── .env.example
└── package.json
```

## Notas de seguridad

- Cambiá la contraseña de administrador y el `JWT_SECRET` antes de publicar el sitio.
