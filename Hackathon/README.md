# WhatsApp Agent App

MVP: agente de IA en WhatsApp + Mini WebApp por niveles ("pisos").

El usuario escribe por WhatsApp, un agente (LLM con herramientas, o palabras clave si no hay LLM) le responde con su score, su progreso y el catálogo, y puede enviarle un enlace personal a un panel web.

> El detalle de cada corrección aplicada sobre el informe de errores está en [`docs/CORRECCIONES.md`](docs/CORRECCIONES.md).

## Estructura

```
backend/            API Express + MongoDB + agente
  src/
    server.js         arranque (valida configuración, conecta la BD, escucha)
    app.js            aplicación Express (rutas y middlewares)
    container.js      crea y conecta los servicios reales
    config/           variables de entorno y conexión a la BD
    middlewares/      autenticación, firma del webhook, límites, cabeceras
    models/           esquemas de Mongoose
    repositories/     acceso a datos (operaciones atómicas)
    routes/           /webhook, /api, /api/admin, /api/notifications, /dev
    services/         agente, sesiones, puntos, catálogo, WhatsApp, LLM
  scripts/            seed del catálogo, enlace de desarrollo, generador de secretos
  test/               tests (node:test)
webapp/             Mini WebApp (React + Vite + Tailwind)
shared/             reglas de niveles compartidas por backend y webapp
                    (el backend la importa: despliega el repositorio completo, no solo backend/)
docs/               documentación
```

## Requisitos

- Node.js 20.19 o superior (recomendado 22 LTS)
- MongoDB: con Docker (incluido en `docker-compose.yml`) o Atlas
- Opcional: cuenta Meta for Developers con WhatsApp Cloud API y ngrok
- Opcional: clave de un LLM compatible con la API de OpenAI

## Puesta en marcha (sin cuenta de WhatsApp)

Con `WHATSAPP_MOCK=true` el proyecto funciona completo sin Meta: los mensajes salientes se muestran por consola y se habilitan rutas de desarrollo.

> En Windows (cmd) usa `copy` en lugar de `cp`.

### 1. Base de datos

```bash
cp .env.example .env          # en la raíz: cambia MONGO_PASSWORD
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run secret                # copia el resultado en JWT_SECRET
```

Edita `backend/.env`: pega `JWT_SECRET` y pon en `DATABASE_URL` la misma contraseña que en el `.env` de la raíz. Después:

```bash
npm run seed                  # carga el catálogo de prueba
npm run dev                   # http://localhost:3000
```

### 3. WebApp

```bash
cd webapp
npm install
npm run dev                   # http://localhost:5173
```

### 4. Abrir el panel y hablar con el agente

```bash
# Enlace al panel para un teléfono (crea el usuario si no existe)
cd backend
npm run dev:token -- 59170000001 "Ana"

# Simular un mensaje de WhatsApp y ver la respuesta del agente
curl -X POST http://localhost:3000/dev/message \
  -H "Content-Type: application/json" \
  -d '{"telefono":"59170000001","texto":"cuánto me falta para subir de nivel"}'
```

El enlace del panel es de **un solo uso**: al abrirlo se canjea por una sesión que dura lo que indique `JWT_EXPIRES`. Recargar la página mantiene la sesión.

## Con WhatsApp real

1. En `backend/.env` pon `WHATSAPP_MOCK=false` y rellena `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_APP_SECRET`.
2. Expón el backend: `ngrok http 3000` y define `TRUST_PROXY=1`.
3. En Meta > WhatsApp > Configuration, usa `https://<tu-dominio-ngrok>/webhook` como URL y tu `WHATSAPP_VERIFY_TOKEN`.
4. `WEBAPP_URL` debe ser la dirección pública de la webapp (es la que se envía en el botón).

## Variables de entorno

Todas están documentadas en [`backend/.env.example`](backend/.env.example). Las imprescindibles:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a MongoDB |
| `JWT_SECRET` | Sí | Mínimo 32 caracteres; no hay valor por defecto (`npm run secret`) |
| `JWT_EXPIRES` | No | Segundos (`900`) o con unidad (`15m`). Por defecto `15m` |
| `WHATSAPP_MOCK` | No | `true` para trabajar sin Meta. Prohibido en producción |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Si no hay mock | Credenciales de WhatsApp Cloud API |
| `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | No | Sin clave, el agente responde por palabras clave |
| `WEBAPP_URL` | En producción | URL de la webapp; también es el origen CORS permitido |
| `ADMIN_API_KEY` | No | Clave de las rutas de administración; sin ella responden 503 |

El servidor valida la configuración al arrancar y muestra todos los problemas a la vez. Los scripts solo exigen lo que usan (el seed, por ejemplo, solo `DATABASE_URL`).

## Reglas de negocio

- **Pisos**: Bronce (0), Plata (100), Oro (300), Platino (600), Diamante (1000). Definidos una sola vez en `shared/constants.js`. El piso nunca se guarda: se calcula a partir del score.
- **Catálogo acumulativo**: cada usuario ve los productos de su piso y de los anteriores. Los pisos superiores están bloqueados.
- **Puntos**: solo los modifica el servidor, nunca el LLM. Se ganan con compras registradas por la tienda (`PUNTOS_POR_UNIDAD`, por defecto 1 punto cada 10 unidades monetarias) o con ajustes manuales de un administrador. Cada cambio queda auditado en la colección de movimientos.

## API

### Panel web (`/api`)

| Método y ruta | Autenticación | Descripción |
|---|---|---|
| `GET /api/health` | — | Estado del servicio |
| `POST /api/session/exchange` | Token del enlace en el cuerpo (`{ "token": "..." }`) | Canjea el enlace (un solo uso) por un token de acceso |
| `GET /api/session` | `Authorization: Bearer <token de acceso>` | Usuario y catálogo de sus pisos desbloqueados |
| `GET /api/catalog?floor=N` | Bearer | Catálogo de un piso desbloqueado (sin `floor`: todos los desbloqueados) |
| `POST /api/session/logout` | Bearer | Cierra la sesión (invalida el token al instante) |

### Administración (cabecera `X-Admin-Key: <ADMIN_API_KEY>`)

| Método y ruta | Descripción |
|---|---|
| `POST /api/admin/purchases` | Registra una compra y otorga puntos: `{ "telefono", "productoId", "cantidad" }` |
| `POST /api/admin/score-adjustments` | Ajuste manual: `{ "telefono", "puntos", "motivo" }` |
| `GET /api/admin/users/:telefono/movements` | Auditoría de movimientos de puntos |
| `POST /api/notifications/send` | Envía una plantilla: `{ "telefono", "plantilla", "parametros", "idioma" }` |

```bash
curl -X POST http://localhost:3000/api/admin/score-adjustments \
  -H "Content-Type: application/json" -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"telefono":"59170000001","puntos":150,"motivo":"Promoción de bienvenida"}'
```

### Webhook y desarrollo

| Método y ruta | Descripción |
|---|---|
| `GET /webhook` | Verificación de Meta |
| `POST /webhook` | Mensajes entrantes (firma `X-Hub-Signature-256` obligatoria) |
| `POST /dev/token`, `POST /dev/message` | Solo con `WHATSAPP_MOCK=true` y fuera de producción |

## Flujo

1. El usuario escribe a WhatsApp.
2. El webhook valida la firma, responde 200 de inmediato y procesa en segundo plano (cada mensaje una sola vez).
3. El agente consulta sus herramientas (score, progreso, catálogo, enlace al panel) y responde.
4. Si pide su panel, recibe un botón con un enlace de un solo uso.
5. La webapp canjea el enlace por una sesión y muestra el panel.

## Calidad

```bash
npm run lint            # desde la raíz (ESLint)
cd backend && npm test  # tests del backend (no necesitan MongoDB)

# Tests de integración contra un MongoDB real (la base debe terminar en "_test")
TEST_DATABASE_URL=mongodb://usuario:clave@127.0.0.1:27017/whatsapp_agent_test?authSource=admin npm test
```

El flujo de CI (`.github/workflows/ci.yml`) ejecuta el linter, los tests, la integración con MongoDB y la compilación de la webapp en cada push y pull request.

## Migración desde la versión anterior

- `JWT_SECRET` es obligatorio y `backend/.env.example` se movió a `backend/`.
- Las sesiones usan una colección nueva (`panel_sessions`); la antigua `sessions` puede borrarse.
- El campo `floor` de los usuarios existentes se ignora (el piso se calcula del score).
- `POST /api/session/use` se sustituye por `POST /api/session/exchange`.
- `POST /api/notifications/send` exige ahora la cabecera `X-Admin-Key`.

## Convención de commits

Mensajes en imperativo que digan qué cambia y por qué, por ejemplo `fix(webhook): deduplicar mensajes por id` o `feat(panel): mostrar pisos bloqueados`. Trabaja en ramas cortas (`fix/...`, `feat/...`) y bórralas al fusionarlas en `main`.
