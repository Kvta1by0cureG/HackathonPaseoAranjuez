const UN_ANIO_EN_SEGUNDOS = 31536000;

/**
 * Cabeceras de seguridad para una API que solo devuelve JSON.
 * (Equivalente reducido de helmet, sin añadir dependencias.)
 */
export function cabecerasDeSeguridad({ esProduccion = false } = {}) {
  return function aplicarCabeceras(req, res, next) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cross-Origin-Resource-Policy', 'same-site');
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    // Las respuestas llevan datos personales: que no se guarden en cachés.
    res.set('Cache-Control', 'no-store');
    if (esProduccion) {
      res.set('Strict-Transport-Security', `max-age=${UN_ANIO_EN_SEGUNDOS}; includeSubDomains`);
    }
    next();
  };
}
