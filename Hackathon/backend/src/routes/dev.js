import express from 'express';
import { asincrono, esTelefonoValido } from '../utils/http.js';

/**
 * Rutas de desarrollo. Solo se montan con WHATSAPP_MOCK=true fuera de
 * producción (ver app.js): permiten probar el proyecto sin cuenta de WhatsApp.
 */
export function crearDevRouter({ usuarios, sesiones, procesador, mensajeria }) {
  const router = express.Router();

  // Genera un enlace al panel para un teléfono (crea el usuario si no existe).
  router.post('/token', asincrono(async (req, res) => {
    const { telefono, nombre = '' } = req.body ?? {};
    if (!esTelefonoValido(telefono)) return res.status(400).json({ error: 'telefono inválido' });

    const user = await usuarios.obtenerOCrearPorTelefono(telefono, String(nombre));
    const { token, expiresAt } = await sesiones.crearEnlace(user._id);
    return res.json({ url: sesiones.urlPanel(token), expiresAt: expiresAt.toISOString() });
  }));

  // Simula un mensaje entrante de WhatsApp y devuelve lo que respondió el agente.
  router.post('/message', asincrono(async (req, res) => {
    const { telefono, texto, nombre = '' } = req.body ?? {};
    if (!esTelefonoValido(telefono)) return res.status(400).json({ error: 'telefono inválido' });
    if (typeof texto !== 'string') return res.status(400).json({ error: 'texto requerido' });

    const antes = mensajeria.total;
    const [resultado = 'ignorado'] = await procesador.procesarPayload({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: telefono, profile: { name: String(nombre) } }],
            messages: [{
              id: `dev.${Date.now()}.${Math.random().toString(36).slice(2)}`,
              from: telefono,
              type: 'text',
              text: { body: texto }
            }]
          }
        }]
      }]
    });

    const nuevos = mensajeria.total - antes;
    const respuestas = nuevos > 0
      ? mensajeria.enviados.slice(-nuevos).filter((m) => m.to === telefono)
      : [];
    return res.json({ resultado, respuestas });
  }));

  return router;
}
