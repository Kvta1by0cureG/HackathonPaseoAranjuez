const LIMPIEZA_CADA = 500;

/**
 * Limitador de ventana fija en memoria.
 * Cada clave puede consumir hasta `limite` unidades por ventana de `ventanaMs`.
 * Es local al proceso: si se despliegan varias instancias, usar un almacén compartido.
 */
export function crearLimitador({ limite, ventanaMs, ahora = Date.now }) {
  if (!Number.isInteger(limite) || limite <= 0) throw new TypeError('limite debe ser un entero positivo');
  if (!Number.isInteger(ventanaMs) || ventanaMs <= 0) throw new TypeError('ventanaMs debe ser un entero positivo');

  const ventanas = new Map();
  let consumosDesdeLimpieza = 0;

  function limpiar(instante) {
    for (const [clave, ventana] of ventanas) {
      if (ventana.reinicio <= instante) ventanas.delete(clave);
    }
  }

  return {
    /**
     * Consume una unidad de la clave.
     * `primerExceso` es true solo la primera vez que se supera el límite en la ventana.
     */
    consumir(clave) {
      const instante = ahora();

      consumosDesdeLimpieza += 1;
      if (consumosDesdeLimpieza >= LIMPIEZA_CADA) {
        consumosDesdeLimpieza = 0;
        limpiar(instante);
      }

      let ventana = ventanas.get(clave);
      if (!ventana || ventana.reinicio <= instante) {
        ventana = { usados: 0, reinicio: instante + ventanaMs };
        ventanas.set(clave, ventana);
      }

      ventana.usados += 1;
      const permitido = ventana.usados <= limite;

      return {
        permitido,
        limite,
        restantes: Math.max(0, limite - ventana.usados),
        reinicioEnMs: ventana.reinicio - instante,
        primerExceso: ventana.usados === limite + 1
      };
    },

    get claves() {
      return ventanas.size;
    }
  };
}
