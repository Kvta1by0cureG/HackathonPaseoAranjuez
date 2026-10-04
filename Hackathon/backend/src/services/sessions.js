import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ALGORITMO = 'HS256';
const TIPO_ENLACE = 'link';
const TIPO_ACCESO = 'access';

export class SesionError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'SesionError';
  }
}

/**
 * Sesiones del panel web. El flujo tiene dos tokens:
 *
 *  1. Token de ENLACE: va en el link que se envía por WhatsApp. Es de un solo
 *     uso y solo sirve para canjearlo.
 *  2. Token de ACCESO: se obtiene al canjear el enlace y viaja siempre en la
 *     cabecera Authorization. En cada petición se comprueba que su sesión siga
 *     activa en la base de datos, así que cerrar sesión lo invalida al instante.
 */
export function crearServicioSesiones({ config, sesiones, ahora = () => new Date() }) {
  const { secret, expiresIn } = config.jwt;

  function verificar(token, tipoEsperado) {
    // Mensajes pensados para el usuario del panel: hablan de "enlace" y "sesión".
    const mensaje = tipoEsperado === TIPO_ENLACE
      ? 'El enlace no es válido o expiró'
      : 'Tu sesión no es válida o expiró';

    if (typeof token !== 'string' || token === '') throw new SesionError(mensaje);

    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: [ALGORITMO] });
    } catch {
      throw new SesionError(mensaje);
    }
    if (typeof payload !== 'object' || payload.typ !== tipoEsperado || !payload.sub) {
      throw new SesionError(mensaje);
    }
    return payload;
  }

  return {
    /** Crea el token de enlace de un usuario y registra su sesión. */
    async crearEnlace(userId) {
      // El jti aleatorio hace único cada token aunque se pidan dos en el mismo segundo.
      const jti = crypto.randomUUID();
      const token = jwt.sign({ typ: TIPO_ENLACE }, secret, {
        algorithm: ALGORITMO,
        subject: String(userId),
        jwtid: jti,
        expiresIn
      });

      // La sesión expira exactamente cuando expira el JWT (misma fuente: JWT_EXPIRES).
      const { exp } = jwt.decode(token);
      const expiresAt = new Date(exp * 1000);
      await sesiones.crear({ jti, userId, expiresAt });

      return { token, expiresAt };
    },

    /** URL del panel con el token de enlace. */
    urlPanel(token) {
      return `${config.webapp.url}/?token=${encodeURIComponent(token)}`;
    },

    /** Canjea un token de enlace (una sola vez) por un token de acceso. */
    async canjear(tokenEnlace) {
      const payload = verificar(tokenEnlace, TIPO_ENLACE);
      const instante = ahora();
      const sesion = await sesiones.marcarUsada(payload.jti, instante);
      if (!sesion) throw new SesionError('El enlace ya fue usado o expiró');

      const segundosRestantes = Math.max(
        1,
        Math.floor((new Date(sesion.expiresAt).getTime() - instante.getTime()) / 1000)
      );
      const accessToken = jwt.sign({ typ: TIPO_ACCESO, sid: payload.jti }, secret, {
        algorithm: ALGORITMO,
        subject: String(payload.sub),
        expiresIn: segundosRestantes
      });

      return { accessToken, expiresAt: new Date(sesion.expiresAt) };
    },

    /** Valida un token de acceso y que su sesión siga activa. */
    async verificarAcceso(accessToken) {
      const payload = verificar(accessToken, TIPO_ACCESO);
      const sesion = await sesiones.buscarActiva(payload.sid, ahora());
      if (!sesion) throw new SesionError('Tu sesión no es válida o expiró');
      return { userId: String(payload.sub), sessionId: payload.sid };
    },

    async cerrar(sessionId) {
      await sesiones.revocar(sessionId, ahora());
    }
  };
}
