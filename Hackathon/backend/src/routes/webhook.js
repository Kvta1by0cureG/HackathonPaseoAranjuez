import express from 'express';

/**
 * Webhook de WhatsApp Cloud API.
 * @param {object} deps { verificar, validarFirma, procesador, log }
 */
export function crearWebhookRouter({ verificar, validarFirma, procesador, log = console }) {
  const router = express.Router();

  router.get('/', verificar);

  router.post('/', validarFirma, (req, res) => {
    if (req.body?.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    // Se responde 200 de inmediato: si Meta tuviera que esperar al LLM,
    // reintentaría el envío y se duplicarían las respuestas. El procesamiento
    // sigue en segundo plano y cada mensaje se deduplica por su id.
    res.sendStatus(200);

    procesador.procesarPayload(req.body).catch((error) => {
      log.error('Error procesando el webhook:', error);
    });
    return undefined;
  });

  return router;
}
