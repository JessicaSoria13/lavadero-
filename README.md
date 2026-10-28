# Turnos Lavadero

Sistema de reserva de turnos para un lavadero de autos y motos, con extras opcionales (perfume, cera, etc.) y panel de administración. El cliente reserva sin necesidad de código: vos gestionás todo (confirmar, reprogramar, cancelar) desde el panel.

## ¿Qué incluye?

- **Reservar turno** (`/index.html`): el cliente elige vehículo (auto/moto), el tipo de lavado disponible para ese vehículo, extras opcionales (que suman precio y, si corresponde, tiempo), día y horario libre, y carga sus datos. Al confirmar ve el resumen con el precio total.
- **Panel del lavadero** (`/admin/`): login con contraseña, ver los turnos del día (o de todos los días), **confirmarlos**, **reprogramarlos** (cambiar vehículo, lavado, extras, día u horario) o **cancelarlos**, y eliminarlos. También permite editar la configuración (vehículos, lavados y precios, extras, horarios de atención) sin tocar código.
- No hay gestión por parte del cliente (sin "mi turno" ni código): cualquier cambio lo hace el lavadero desde el panel.
- **Aviso por WhatsApp** al lavadero cada vez que entra una reserva (opcional, ver más abajo).

Dónde se guardan los datos:
- **Sitio publicado:** en una base de datos **PostgreSQL** (variable `DATABASE_URL`). Así los turnos no se pierden cuando el servidor se reinicia.
- **En tu compu, para probar:** si no hay `DATABASE_URL`, se usa el archivo `server/data/db.json`, que se crea solo. ⚠️ No lo uses en el sitio publicado: en Railway y similares ese archivo se borra en cada reinicio.

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

En el panel, la vista **"Próximos turnos"** (la que se abre por defecto) muestra todos los turnos de hoy en adelante. También podés elegir **"Un día"** o **"Todos (incluye pasados)"**.

## Publicar el sitio online (gratis: Vercel + Neon)

**Base de datos (Neon, gratis y permanente):**
1. Creá una cuenta en [neon.com](https://neon.com) y un proyecto nuevo (región: São Paulo o la más cercana).
2. Copiá el **connection string** (empieza con `postgresql://` y termina con `?sslmode=require`).

**Sitio (Vercel):**
1. Creá una cuenta en [vercel.com](https://vercel.com) entrando con GitHub.
2. **Add New → Project** → importá este repositorio. Vercel lee la configuración de `vercel.json`, así que no hace falta tocar los ajustes de build.
3. En **Environment Variables** agregá:
   - `DATABASE_URL` = el connection string de Neon (**obligatoria**: en Vercel no se puede guardar en archivos)
   - `ADMIN_PASSWORD_HASH` (generado con `scripts/generar-password.js`)
   - `JWT_SECRET` (una cadena larga cualquiera, por ejemplo 40 letras y números al azar)
   - Opcional: `WHATSAPP_TELEFONO` y `WHATSAPP_APIKEY`
4. **Deploy**.

Cómo funciona en Vercel: las páginas de `public/` se sirven directo y todo lo que empieza con `/api/` lo atiende `api/index.js`, que usa la misma app que `npm start`. Vercel puede correr varias copias de la app a la vez, así que el bloqueo que evita reservas en el mismo horario y el límite de intentos de login se guardan en PostgreSQL.

Cada vez que subís cambios a GitHub, Vercel vuelve a publicar solo. Los turnos no se pierden porque están en Neon.

⚠️ El plan gratis de Vercel (Hobby) es solo para uso **no comercial**. Para un lavadero que lo use de verdad, hace falta el plan Pro u otro hosting (el proyecto también funciona en cualquier servidor con `npm start`, por ejemplo Render).

La hora del servidor se fuerza a la de Argentina. Si algún día lo usás en otro país, configurá `ZONA_HORARIA` (por ejemplo `America/Montevideo`).

### Respaldos

- **Bajar un respaldo** del sitio publicado (config + todos los turnos) a tu compu:
  ```bash
  node scripts/descargar-respaldo.js https://tu-sitio.vercel.app "tuContraseña"
  ```
  Se guarda en `server/data/respaldo-AAAA-MM-DD.json`. Esa carpeta no se sube a GitHub porque tiene datos de clientes.
- **Cargar un respaldo** en PostgreSQL (con el connection string de Neon):
  ```bash
  node scripts/importar-respaldo.js server/data/respaldo-AAAA-MM-DD.json "postgresql://..."
  ```
  Los turnos que ya existen no se pisan.

## Aviso por WhatsApp de cada reserva

Usa [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/), que es gratis y manda los mensajes **a tu propio número** (uso personal).

1. Agendá en tu celular el número **+34 621 34 22 27**.
2. Desde tu WhatsApp, mandale exactamente: `I allow callmebot to send me messages`
3. En unos segundos te responde con tu **APIKEY**. Si no llega en 2 minutos, probá de nuevo al día siguiente.
4. En tu `.env` poné:
   ```
   WHATSAPP_TELEFONO=+5492475470012
   WHATSAPP_APIKEY=la-que-te-mandaron
   ```
   El número va con **+54 9**, la característica sin el 0 y el número sin el 15.
5. Corré `node scripts/probar-whatsapp.js`: te tiene que llegar un mensaje de prueba.
6. Cargá las dos variables también en Vercel.

Si el aviso falla, la reserva se guarda igual (el error queda en los logs).

## Estructura del proyecto

```
lavadero-turnos/
├── api/index.js               # entrada para Vercel (usa server/app.js)
├── vercel.json
├── server/
│   ├── app.js                 # la app Express (rutas, archivos, errores)
│   ├── index.js               # arranque con servidor propio (npm start)
│   ├── db.js                  # guardado de config y turnos (PostgreSQL o archivo local)
│   ├── routes/
│   │   ├── public.js          # config, disponibilidad, crear turno
│   │   └── admin.js           # login, listar/reprogramar/cancelar/eliminar, config
│   └── utils/
│       ├── slots.js           # cálculo de horarios disponibles
│       ├── combo.js           # cálculo de precio/duración de lavado + extras
│       ├── avisos.js          # aviso por WhatsApp de nuevas reservas
│       └── auth.js            # login con JWT + límite de intentos
├── public/
│   ├── index.html + js/main.js        # reservar turno
│   └── admin/                          # panel del lavadero
├── scripts/
│   ├── generar-password.js
│   ├── descargar-respaldo.js / importar-respaldo.js
│   └── probar-whatsapp.js
├── .env.example
└── package.json
```

## Notas de seguridad

- Cambiá la contraseña de administrador y el `JWT_SECRET` antes de publicar el sitio. Si falta `JWT_SECRET`, el servidor usa uno al azar (y las sesiones se cierran en cada reinicio).
- El login se bloquea 15 minutos después de 10 contraseñas incorrectas desde la misma conexión.
- Lo que escriben los clientes (nombre, notas, etc.) se muestra en el panel como texto, nunca como código.
