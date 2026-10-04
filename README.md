# Jarvis Paseo — Asistente inteligente de fidelización para Paseo Aranjuez

Hackathon by Paseo Aranjuez

## Descripción general

Jarvis Paseo es un MVP que integra los tres retos planteados en la hackathon en un solo flujo: un asistente conversacional en WhatsApp que gestiona un programa de puntos y da acceso a un catálogo de beneficios desde el celular del cliente, sin requerir la instalación de aplicaciones ni registros adicionales.

El cliente interactúa por WhatsApp, acumula puntos por sus compras y accede a un panel web personal donde consulta su saldo, su progreso y los beneficios disponibles según su nivel.

---

## Resolución de los tres retos

### Reto 1 — Paseo Points: fidelización y recompensas

Cada compra registrada en el sistema se convierte en puntos acreditados a la cuenta del cliente. Los puntos determinan el nivel del cliente, y cada nivel desbloquea una sección del catálogo de beneficios en su panel web.

Funcionalidades implementadas:

- Consulta de puntos y progreso hacia el siguiente nivel, directamente desde la conversación de WhatsApp.
- Panel web con saldo de puntos, historial y catálogo de beneficios desbloqueados.
- Rutas de administración para registrar compras, aplicar ajustes de puntos y auditar cada movimiento.

Resultado: el sistema reconoce la frecuencia de compra del cliente y le da una razón concreta para regresar.

### Reto 2 — Jarvis Paseo: asistente inteligente

El asistente opera dentro de WhatsApp, el canal que el cliente ya utiliza. No requiere descargas ni aprendizaje de nuevas interfaces.

Funcionalidades implementadas:

- Respuestas en lenguaje natural mediante un modelo de IA con herramientas propias conectadas a los datos reales del sistema (puntos, progreso y catálogo).
- Envío de un enlace personal, de un solo uso y con expiración, que abre el panel web del cliente.

Resultado: la información del Paseo se centraliza en un único punto de contacto conversacional.

### Reto 3 — PaseoYa: comercio digital orientado a visita presencial

El catálogo de beneficios se explora desde el celular antes de acudir al Paseo. Para hacer uso de los beneficios, el cliente debe presentarse físicamente.

Funcionalidades implementadas:

- Exploración del catálogo filtrado por nivel desde el panel web.
- El asistente funciona como vitrina digital: recomienda productos y beneficios según las consultas del cliente.

Resultado: el canal digital opera como mecanismo de generación de tráfico presencial hacia los comercios del Paseo, bajo un modelo de retiro presencial y no de delivery.

---

## Flujo integral

1. El cliente conversa con el asistente por WhatsApp (Reto 2).
2. Realiza una compra en un comercio del Paseo y se acreditan puntos (Reto 1).
3. Los puntos elevan su nivel y desbloquean beneficios.
4. El cliente explora el catálogo desde su panel web (Reto 3).
5. Acude físicamente al Paseo a hacer uso del beneficio y realiza nuevas compras.

El ciclo se repite: el asistente gestiona la relación, los puntos sostienen la recurrencia y el catálogo digital dirige visitas hacia el espacio físico.

---

## Características del MVP

- Sin fricción para el usuario final: se accede por WhatsApp y un enlace, sin contraseñas ni instalaciones.
- Seguridad: enlaces personales de un solo uso con expiración, firma de webhook validada y control de acceso por tokens.
- Escalabilidad: los comercios se incorporan mediante el registro de compras y beneficios; el asistente trabaja sobre el catálogo real.
- Demostrable en vivo: funciona con WhatsApp real o en modo de simulación para presentaciones.

---

Proyecto desarrollado para la Hackathon by Paseo Aranjuez.
