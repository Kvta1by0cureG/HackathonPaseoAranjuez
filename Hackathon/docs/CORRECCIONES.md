# Correcciones aplicadas

Respuesta punto por punto al informe de errores (53 hallazgos, commit `e53f5f5`).

**Resumen:** 49 corregidos, 1 parcial (D5) y 3 pendientes (W8, R1 y R4), que no se pueden cerrar sin acceso al registro de npm o sin decidir sobre el historial del repositorio.

## Cómo se comprobó cada cosa

El entorno donde se hicieron las correcciones **no tenía acceso al registro de npm ni a MongoDB**. Por eso:

| Marca | Significado |
|---|---|
| **Test** | Hay un test automático en `backend/test/` que lo cubre y pasa. Los tests se ejecutaron con sustitutos locales mínimos de `express`, `cors` y `jsonwebtoken` (misma API, escritos a mano), no con los paquetes reales. |
| **Navegador** | Se probó la webapp en Chromium real contra el backend del proyecto con datos en memoria. Se empaquetó con esbuild y Tailwind 4 locales, no con `vite build`. |
| **Ejecutado** | Se ejecutó el comando o script y se observó el resultado. |
| **Revisado** | Solo revisión de código; no se pudo ejecutar aquí. |

**Falta por ejecutar en una máquina con npm y MongoDB:** `npm install`, `npm test` con los paquetes reales, los tests de integración (`backend/test/integration/`, escritos pero nunca ejecutados), `vite build` y `docker compose up`.

## A. Arranque y configuración

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| A1 | Corregido | `server.js` movido a `backend/src/`; `npm run dev` y `npm start` ya apuntan a un archivo que existe. | Ejecutado (arranca hasta conectar la BD) |
| A2 | Corregido | `config.llm.baseUrl` definido a partir de `LLM_BASE_URL`, con valor por defecto. | Test |
| A3 | Corregido | Archivo renombrado a `seedCatalog.js` y script `npm run seed` añadido. | Ejecutado |
| A4 | Corregido | `env.js` ya no termina el proceso al importarse. Cada programa valida solo lo que usa: el seed solo `DATABASE_URL`. Modo `WHATSAPP_MOCK=true` con cliente simulado. | Test, Ejecutado |
| A5 | Corregido | Script `npm run dev:token` y rutas `/dev/token` y `/dev/message` (solo con mock y fuera de producción). | Test |
| A6 | Corregido | `JWT_EXPIRES=900` se convierte a número (segundos); se valida el formato. | Test |
| A7 | Corregido | `JWT_SECRET`, `WHATSAPP_APP_SECRET` y `WEBAPP_URL` (en producción) se validan al arrancar; se listan todos los errores a la vez. | Test |
| A8 | Corregido | `.env.example` movido a `backend/` y README alineado. El `.gitignore` ya contenía `!.env.example` (línea 71), así que no hizo falta tocarlo: los nuevos `.env.example` aparecen como archivos sin ignorar. | Ejecutado (`git status`) |
| A9 | Corregido | `expiresAt` de la sesión se deriva del `exp` del JWT. | Test |
| A10 | Corregido | `engines` en los tres `package.json`. Se fijó `>=20.19` en lugar de `>=18.11`: Node 18 ya no tiene soporte y el linter exige 20.19 como mínimo. | Revisado |
| A11 | Corregido | Eliminada la clave `version` de `docker-compose.yml`. | Revisado |
| A12 | Corregido | El cliente de WhatsApp vive en `services/whatsapp.js` (unificado, con versión real y simulada); `config/whatsapp.js` eliminado. | Test |

## B. Seguridad

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| S1 | Corregido | `updateScore` ya no existe como herramienta del LLM. Los puntos solo cambian desde rutas de administración. | Test ("súmame 5000 puntos" no cambia el score) |
| S2 | Corregido | Sin secreto por defecto: el servidor no arranca sin `JWT_SECRET`, con el valor de ejemplo o con menos de 32 caracteres. | Test (un token forjado con el secreto de ejemplo se rechaza) |
| S3 | Corregido | El enlace de WhatsApp es de un solo uso y se canjea por un token de acceso. El token solo se acepta por cabecera, cada petición comprueba que la sesión siga activa y existe cierre de sesión. | Test, Navegador |
| S4 | Corregido | `/api/notifications/send` exige la clave interna `X-Admin-Key`; se validan teléfono, plantilla, parámetros e idioma. | Test |
| S5 | Corregido | Límite de peticiones por IP, límite más estricto para el canje, tope de mensajes por usuario (gasto en LLM), cabeceras de seguridad y CORS restringido a `WEBAPP_URL`. Se implementó con middlewares propios en vez de `helmet` y `express-rate-limit` para no añadir dependencias que aquí no se podían instalar ni fijar en el lockfile. | Test |
| S6 | Corregido | El catálogo (API y herramienta) solo devuelve pisos desbloqueados; un piso superior responde 403. | Test, Navegador |
| S7 | Corregido | El piso se valida con `Number.isInteger` antes de llegar a Mongo, en la herramienta, la API y el repositorio. | Test (`{"$gt":0}` se rechaza) |
| S8 | Corregido | Se comparan longitudes antes de `timingSafeEqual`: firma vacía, ausente o de otra longitud responde 403. | Test |
| S9 | Corregido | Mongo se publica solo en `127.0.0.1` y exige usuario y contraseña (`.env` de la raíz). | Revisado |

## C. Lógica del agente y del backend

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| L1 | Corregido | Idempotencia por `message.id` (índice único), respuesta 200 antes de procesar y un fallo de envío ya no se relanza. | Test |
| L2 | Corregido | Se guardan los mensajes y se reenvían al LLM los últimos N (`LLM_HISTORY_MESSAGES`, por defecto 10). | Test |
| L3 | Corregido | Herramienta `sendPanelLink` (un botón por turno). | Test |
| L4 | Corregido | Intenciones por prioridad y por palabras completas, sin acentos ni mayúsculas. | Test (las dos frases del informe) |
| L5 | Corregido | Herramienta `getProgress` e intención "progreso" en el modo de palabras clave. | Test |
| L6 | Corregido | Al agotar las iteraciones o recibir una respuesta vacía se envía un mensaje por defecto. | Test |
| L7 | Corregido | Audio, imagen y otros tipos reciben "solo texto" y no llegan al LLM. | Test |
| L8 | Corregido | Cada herramienta recarga el usuario antes de ejecutarse. | Test |
| L9 | Corregido | `findOneAndUpdate` con `$inc`; al restar, el filtro exige saldo suficiente. | Test con doble en memoria; la atomicidad real en Mongo está en los tests de integración (no ejecutados) |
| L10 | Corregido | Colección `ScoreMovement` con puntos, score resultante, origen, motivo y detalle; consulta por administración. | Test |
| L11 | Corregido | Cada token lleva un `jti` aleatorio. | Test |
| L12 | Corregido | Upsert atómico, con recuperación si dos peticiones chocan con el índice único. | Revisado; test de integración (no ejecutado) |
| L13 | Corregido | Rangos continuos (solo `min`), `sumarScore` rechaza no enteros en vez de devolver `NaN`. | Test |

## D. Datos y modelo

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| D1 | Corregido | El campo `floor` se eliminó del modelo: el piso se calcula siempre del score. | Test, Navegador |
| D2 | Corregido | `shared/constants.js` es la única fuente: el backend la importa y la webapp usa el alias `@shared`. Se eliminó la copia de la webapp. | Test, Navegador (el alias en Vite, Revisado) |
| D3 | Corregido | El seed no borra un catálogo existente sin `--force`. | Revisado |
| D4 | Decidido | Acceso acumulativo: se ven el piso propio y los anteriores. | Test, Navegador |
| D5 | Parcial | Forma legítima de ganar puntos: compras registradas por la tienda y ajustes de administrador, ambos auditados. **No** se implementó el canje de puntos ni un flujo de compra con pago: son decisiones de negocio. | Test |

## E. Webapp

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| W1 | Corregido | La sesión trae el catálogo de todos los pisos desbloqueados: el selector muestra productos reales y "Catálogo completo" lo es. Los pisos bloqueados indican cuántos puntos faltan. Se eliminó `getCatalog`, que no se usaba. | Navegador |
| W2 | Corregido | `ScoreCard` recibe el usuario real; explorar un piso no cambia su nivel. | Navegador |
| W3 | Corregido | El token de acceso se guarda en `sessionStorage` y se reutiliza al recargar. | Navegador |
| W4 | Corregido | El arranque de la sesión se comparte entre las dos ejecuciones del efecto: un solo canje y sin error momentáneo. | Navegador (StrictMode activo) |
| W5 | Corregido | Quitados `user-scalable=no` y `maximum-scale`. | Navegador |
| W6 | Corregido | Las dos páginas siguen montadas y la inactiva se oculta. | Navegador |
| W7 | Corregido | Contador "N de M productos"; el selector y los textos usan "Piso N · Nombre". | Navegador |
| W8 | **Pendiente** | No se puede generar `webapp/package-lock.json` sin acceso al registro de npm. Se resuelve con `cd webapp && npm install` y subiendo el archivo. | — |

## F. Dependencias, código muerto y repositorio

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| R1 | **Pendiente** | Actualizar vite y tailwind implica saltos de versión mayor que no se pudieron instalar ni compilar aquí; hacerlo a ciegas podía romper la compilación. Las vulnerabilidades son de herramientas de desarrollo y no van en el bundle. | — |
| R2 | Corregido | `LIMITES` sustituido por límites reales en la configuración; `req.token` se asigna; `Session.used` es ahora `usedAt` y se consulta en cada petición (el índice TTL ya tiene efecto); `getCatalog` y `getToken` eliminados; `lastMessageAt` eliminado. | Test, linter |
| R3 | Corregido | 135 tests (`node:test`), ESLint y flujo de CI en GitHub Actions. | Tests y linter ejecutados; el CI no se ha ejecutado |
| R4 | **Pendiente** | El historial y las ramas del repositorio remoto no se pueden arreglar desde una copia: reescribir el historial compartido es una decisión del equipo. El README incluye la convención de commits y ramas a seguir. | — |

## G. Dependen de WhatsApp Business

| ID | Estado | Qué se hizo | Comprobación |
|---|---|---|---|
| H1 | Corregido | Se procesan todos los mensajes del payload, deduplicados y en orden por teléfono, tras responder 200. | Test (sin cuenta real de Meta) |
| H2 | Corregido | Idioma configurable (`WHATSAPP_TEMPLATE_LANG` o por petición) y `components` solo si hay parámetros. | Test (sin cuenta real de Meta) |

## Decisiones que conviene revisar

1. **Catálogo acumulativo (D4).** Si se prefieren pisos excluyentes, el cambio está en `services/catalogService.js`.
2. **Regla de puntos (D5).** 1 punto cada 10 unidades monetarias (`PUNTOS_POR_UNIDAD=0.1`), otorgados por compras que registra la tienda. Es un supuesto.
3. **Restar puntos.** Un ajuste negativo mayor que el saldo se rechaza (409) en lugar de dejar el score en 0.
4. **Duración de la sesión.** El enlace y la sesión comparten `JWT_EXPIRES` (15 minutos por defecto), contados desde que se envía el enlace.
5. **Límites en memoria.** Los contadores de peticiones viven en el proceso; con varias instancias haría falta un almacén compartido (Redis).
6. **Piso bloqueado en el panel.** Se puede seleccionar para ver cuántos puntos faltan; el estado "bloqueado" del selector es nuevo en la interfaz.
