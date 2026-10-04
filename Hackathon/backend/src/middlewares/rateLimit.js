import { crearLimitador } from '../utils/rateLimiter.js';

/**
 * Límite de peticiones por cliente (por IP salvo que se indique otra clave).
 * Responde 429 con Retry-After cuando se supera.
 */
export function limitarPeticiones({
  limite,
  ventanaMs = 60000,
  clave = (req) => req.ip,
  mensaje = 'Demasiadas peticiones, inténtalo de nuevo en un momento'
}) {
  const limitador = crearLimitador({ limite, ventanaMs });

  return function limitar(req, res, next) {
    const consumo = limitador.consumir(String(clave(req) ?? 'desconocido'));
    const segundos = Math.ceil(consumo.reinicioEnMs / 1000);

    res.set('RateLimit-Limit', String(consumo.limite));
    res.set('RateLimit-Remaining', String(consumo.restantes));
    res.set('RateLimit-Reset', String(segundos));

    if (!consumo.permitido) {
      res.set('Retry-After', String(segundos));
      return res.status(429).json({ error: mensaje });
    }
    return next();
  };
}
