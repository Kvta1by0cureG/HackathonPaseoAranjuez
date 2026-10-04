import { SesionError } from '../services/sessions.js';

const PREFIJO = 'Bearer ';

/**
 * Autentica las peticiones de la Mini WebApp.
 * El token de acceso solo se acepta en la cabecera Authorization (nunca en la
 * URL, donde quedaría en historiales y logs) y su sesión debe seguir activa.
 */
export function crearAutenticarWebApp({ sesiones }) {
  return async function autenticarWebApp(req, res, next) {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith(PREFIJO) ? cabecera.slice(PREFIJO.length).trim() : '';

    if (!token) {
      return res.status(401).json({ error: 'Falta el token de sesión (cabecera Authorization)' });
    }

    try {
      const { userId, sessionId } = await sesiones.verificarAcceso(token);
      req.userId = userId;
      req.sessionId = sessionId;
      req.token = token;
      return next();
    } catch (error) {
      if (error instanceof SesionError) {
        return res.status(401).json({ error: error.message });
      }
      return next(error);
    }
  };
}
