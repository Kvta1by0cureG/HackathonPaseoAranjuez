// Fuente única de las reglas de niveles ("pisos").
// La usan el backend (backend/src/services/score.js) y la webapp (alias @shared).
// No dupliques estos valores en otro archivo: importa desde aquí.

/**
 * Cada piso empieza en `min` y termina justo antes del `min` del siguiente,
 * así no quedan huecos entre rangos (un score de 99.5 sigue siendo piso 1).
 */
export const UMBRALES_PISO = Object.freeze([
  Object.freeze({ floor: 1, min: 0, label: 'Bronce' }),
  Object.freeze({ floor: 2, min: 100, label: 'Plata' }),
  Object.freeze({ floor: 3, min: 300, label: 'Oro' }),
  Object.freeze({ floor: 4, min: 600, label: 'Platino' }),
  Object.freeze({ floor: 5, min: 1000, label: 'Diamante' })
]);

export const PISO_MIN = UMBRALES_PISO[0].floor;
export const PISO_MAX = UMBRALES_PISO[UMBRALES_PISO.length - 1].floor;

/** Devuelve el umbral de un piso, o `undefined` si el piso no existe. */
export function infoPiso(floor) {
  return UMBRALES_PISO.find((u) => u.floor === floor);
}

/** `true` si `valor` es un número de piso existente. */
export function esPisoValido(valor) {
  return Number.isInteger(valor) && valor >= PISO_MIN && valor <= PISO_MAX;
}

/**
 * Piso que corresponde a un score.
 * Un score ausente, negativo o no numérico se trata como 0 (piso 1).
 */
export function calcularPiso(score) {
  const valor = Number.isFinite(score) ? score : 0;
  let piso = PISO_MIN;
  for (const umbral of UMBRALES_PISO) {
    if (valor >= umbral.min) piso = umbral.floor;
  }
  return piso;
}

/** Texto unificado para mostrar un piso: "Piso 2 · Plata". */
export function nombrePiso(floor) {
  const info = infoPiso(floor);
  return info ? `Piso ${info.floor} · ${info.label}` : `Piso ${floor}`;
}

/**
 * Avance del usuario dentro de su piso y lo que le falta para el siguiente.
 * En el piso máximo: porcentaje 100, faltan 0 y `siguiente` es null.
 */
export function progresoPiso(score) {
  const valor = Number.isFinite(score) ? Math.max(0, score) : 0;
  const floor = calcularPiso(valor);
  const actual = infoPiso(floor);
  const siguiente = infoPiso(floor + 1);

  if (!siguiente) {
    return {
      floor,
      label: actual.label,
      porcentaje: 100,
      faltan: 0,
      siguiente: null,
      siguientePiso: null
    };
  }

  const tramo = siguiente.min - actual.min;
  const avance = valor - actual.min;

  return {
    floor,
    label: actual.label,
    porcentaje: Math.min(100, Math.max(0, Math.floor((avance / tramo) * 100))),
    faltan: Math.ceil(siguiente.min - valor),
    siguiente: siguiente.label,
    siguientePiso: siguiente.floor
  };
}

/** Puntos que faltan para desbloquear un piso concreto (0 si ya está desbloqueado). */
export function puntosParaPiso(score, floor) {
  const info = infoPiso(floor);
  if (!info) return null;
  const valor = Number.isFinite(score) ? Math.max(0, score) : 0;
  return Math.max(0, Math.ceil(info.min - valor));
}
