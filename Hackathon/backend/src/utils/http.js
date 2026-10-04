/**
 * Envuelve un manejador async para que sus errores lleguen al middleware de
 * errores (Express 4 no captura promesas rechazadas por sí solo).
 */
export function asincrono(manejador) {
  return function manejadorAsincrono(req, res, next) {
    Promise.resolve(manejador(req, res, next)).catch(next);
  };
}

const FORMATO_TELEFONO = /^\d{8,15}$/;

/** Teléfono en formato internacional sin "+": solo dígitos (8 a 15). */
export function esTelefonoValido(valor) {
  return typeof valor === 'string' && FORMATO_TELEFONO.test(valor);
}
