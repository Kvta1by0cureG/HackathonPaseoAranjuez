// Reglas de puntos del lado del servidor. Los umbrales viven en shared/constants.js
// (fuente única que también usa la webapp).
export {
  UMBRALES_PISO,
  PISO_MIN,
  PISO_MAX,
  calcularPiso,
  esPisoValido,
  infoPiso,
  nombrePiso,
  progresoPiso,
  puntosParaPiso
} from '../../../shared/constants.js';

/** Tope de puntos que se pueden mover en una sola operación. */
export const MAX_PUNTOS_POR_MOVIMIENTO = 100000;

function exigirEntero(nombre, valor) {
  if (!Number.isInteger(valor)) {
    throw new TypeError(`${nombre} debe ser un número entero (recibido: ${String(valor)})`);
  }
}

/**
 * Suma (o resta) puntos a un score. Ambos valores deben ser enteros;
 * el resultado nunca baja de 0.
 */
export function sumarScore(scoreActual, puntos) {
  exigirEntero('scoreActual', scoreActual);
  exigirEntero('puntos', puntos);
  return Math.max(0, scoreActual + puntos);
}

/** Puntos que otorga una compra: se redondea hacia abajo, nunca negativos. */
export function puntosPorCompra(importe, puntosPorUnidad) {
  if (!Number.isFinite(importe) || importe < 0) {
    throw new TypeError(`importe inválido: ${String(importe)}`);
  }
  if (!Number.isFinite(puntosPorUnidad) || puntosPorUnidad <= 0) {
    throw new TypeError(`puntosPorUnidad inválido: ${String(puntosPorUnidad)}`);
  }
  // El epsilon evita perder un punto por errores de coma flotante (p. ej. 30 * 0.1).
  return Math.floor(importe * puntosPorUnidad + 1e-9);
}
