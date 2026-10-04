import { compararSeguro } from '../utils/seguridad.js';

/**
 * Protege las rutas de administración con una clave interna (cabecera X-Admin-Key).
 * Si ADMIN_API_KEY no está configurada, las rutas quedan deshabilitadas (503).
 */
export function crearAutenticarAdmin({ apiKey }) {
  return function autenticarAdmin(req, res, next) {
    if (!apiKey) {
      return res.status(503).json({ error: 'Administración no configurada (falta ADMIN_API_KEY)' });
    }

    const recibida = req.headers['x-admin-key'];
    if (typeof recibida !== 'string' || !compararSeguro(recibida, apiKey)) {
      return res.status(401).json({ error: 'Clave de administración inválida' });
    }
    return next();
  };
}
