import express from 'express';
import { asincrono, esTelefonoValido } from '../utils/http.js';

const FORMATO_PLANTILLA = /^[a-z0-9_]{1,512}$/;
const FORMATO_IDIOMA = /^[a-z]{2,3}(_[A-Z]{2})?$/;
const MAXIMO_PARAMETROS = 20;

/**
 * Envío de plantillas proactivas. Ruta de administración: el router se monta
 * detrás del middleware de clave interna (ver app.js).
 */
export function crearNotificacionesRouter({ mensajeria, log = console }) {
  const router = express.Router();

  router.post('/send', asincrono(async (req, res) => {
    const { telefono, plantilla, parametros = [], idioma } = req.body ?? {};

    if (!esTelefonoValido(telefono)) {
      return res.status(400).json({ error: 'telefono debe tener entre 8 y 15 dígitos, sin "+"' });
    }
    if (typeof plantilla !== 'string' || !FORMATO_PLANTILLA.test(plantilla)) {
      return res.status(400).json({ error: 'plantilla inválida (minúsculas, números y "_")' });
    }
    if (
      !Array.isArray(parametros) ||
      parametros.length > MAXIMO_PARAMETROS ||
      parametros.some((p) => typeof p !== 'string' && typeof p !== 'number')
    ) {
      return res.status(400).json({ error: 'parametros debe ser una lista de textos o números' });
    }
    if (idioma !== undefined && (typeof idioma !== 'string' || !FORMATO_IDIOMA.test(idioma))) {
      return res.status(400).json({ error: 'idioma inválido (ejemplos: "es", "es_MX", "en_US")' });
    }

    try {
      const resultado = await mensajeria.enviarPlantilla(telefono, plantilla, { parametros, idioma });
      return res.json({ ok: true, resultado });
    } catch (error) {
      log.error('Error enviando notificación:', error.message);
      return res.status(502).json({ error: 'Error enviando notificación' });
    }
  }));

  return router;
}
