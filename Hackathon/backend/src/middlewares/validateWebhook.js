import crypto from 'node:crypto';
import { compararSeguro } from '../utils/seguridad.js';

/** GET: Meta verifica el webhook al configurarlo. */
export function crearVerificarWebhook({ verifyToken }) {
  return function verificarWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (verifyToken && mode === 'subscribe' && compararSeguro(String(token ?? ''), verifyToken)) {
      // Texto plano: el challenge llega en la URL y no debe interpretarse como HTML.
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(String(challenge ?? ''));
    }
    return res.sendStatus(403);
  };
}

/** Firma esperada de un cuerpo crudo: "sha256=<hmac hex>". */
export function firmarCuerpo(rawBody, appSecret) {
  return `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

/**
 * POST: valida la firma X-Hub-Signature-256 de Meta sobre el cuerpo crudo.
 * Una firma ausente, vacía o de otra longitud responde 403 (nunca 500).
 */
export function crearValidarFirmaWebhook({ appSecret, log = console }) {
  return function validarFirmaWebhook(req, res, next) {
    if (!appSecret) {
      log.error('❌ Falta WHATSAPP_APP_SECRET: no se puede validar el webhook');
      return res.sendStatus(503);
    }

    const firmaRecibida = req.headers['x-hub-signature-256'];
    if (typeof firmaRecibida !== 'string' || !Buffer.isBuffer(req.rawBody)) {
      return res.sendStatus(403);
    }

    const recibida = Buffer.from(firmaRecibida);
    const calculada = Buffer.from(firmarCuerpo(req.rawBody, appSecret));

    // timingSafeEqual lanza si las longitudes difieren: se comprueba antes.
    if (recibida.length !== calculada.length || !crypto.timingSafeEqual(recibida, calculada)) {
      log.warn('⚠️ Firma de webhook inválida.');
      return res.sendStatus(403);
    }
    return next();
  };
}
