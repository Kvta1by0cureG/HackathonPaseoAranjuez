import {
  MAX_PUNTOS_POR_MOVIMIENTO,
  calcularPiso,
  puntosPorCompra
} from './score.js';

const MAX_UNIDADES_POR_COMPRA = 100;

export class ScoreError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = 'ScoreError';
    this.status = status;
  }
}

/**
 * Única vía para cambiar puntos. Vive en el servidor y solo la invocan rutas
 * de administración: el LLM ya no puede modificar el score.
 * Cada cambio es atómico y queda registrado en la colección de movimientos.
 */
export function crearServicioScore({ usuarios, movimientos, catalogo, config }) {
  async function aplicar({ user, puntos, origen, motivo, detalle }) {
    const actualizado = await usuarios.incrementarScore(user._id, puntos);
    if (!actualizado) {
      // Al restar, el filtro exige saldo suficiente; al sumar solo falla si el usuario ya no existe.
      if (puntos < 0) {
        throw new ScoreError('El usuario no tiene puntos suficientes para ese descuento', 409);
      }
      throw new ScoreError('Usuario no encontrado', 404);
    }

    const movimiento = await movimientos.registrar({
      userId: user._id,
      puntos,
      scoreResultante: actualizado.score,
      origen,
      motivo,
      detalle
    });

    return {
      userId: String(user._id),
      puntos,
      score: actualizado.score,
      floor: calcularPiso(actualizado.score),
      movimientoId: String(movimiento._id)
    };
  }

  async function usuarioPorTelefono(telefono) {
    const user = await usuarios.buscarPorTelefono(telefono);
    if (!user) throw new ScoreError('Usuario no encontrado', 404);
    return user;
  }

  return {
    /** Ajuste manual de un administrador (positivo o negativo), con motivo obligatorio. */
    async ajustar({ telefono, puntos, motivo }) {
      if (!Number.isInteger(puntos) || puntos === 0) {
        throw new ScoreError('puntos debe ser un entero distinto de cero', 400);
      }
      if (Math.abs(puntos) > MAX_PUNTOS_POR_MOVIMIENTO) {
        throw new ScoreError(`puntos no puede superar ${MAX_PUNTOS_POR_MOVIMIENTO} por movimiento`, 400);
      }
      if (typeof motivo !== 'string' || motivo.trim() === '') {
        throw new ScoreError('motivo es obligatorio', 400);
      }

      const user = await usuarioPorTelefono(telefono);
      return aplicar({ user, puntos, origen: 'ajuste_admin', motivo: motivo.trim(), detalle: null });
    },

    /** Registra una compra hecha en tienda y otorga los puntos que le corresponden. */
    async registrarCompra({ telefono, productoId, cantidad = 1 }) {
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_UNIDADES_POR_COMPRA) {
        throw new ScoreError(`cantidad debe ser un entero entre 1 y ${MAX_UNIDADES_POR_COMPRA}`, 400);
      }

      const user = await usuarioPorTelefono(telefono);
      const producto = await catalogo.buscarActivoPorId(productoId);
      if (!producto) throw new ScoreError('Producto no encontrado', 404);
      if (producto.floor > calcularPiso(user.score)) {
        throw new ScoreError('El producto pertenece a un piso que el usuario aún no desbloquea', 403);
      }

      const importe = producto.price * cantidad;
      const puntos = puntosPorCompra(importe, config.score.puntosPorUnidad);
      if (puntos === 0) {
        return {
          userId: String(user._id),
          puntos: 0,
          score: user.score,
          floor: calcularPiso(user.score),
          importe,
          movimientoId: null
        };
      }

      const resultado = await aplicar({
        user,
        puntos,
        origen: 'compra',
        motivo: `Compra: ${cantidad} × ${producto.name}`,
        detalle: { productoId: String(producto._id), cantidad, importe }
      });
      return { ...resultado, importe };
    },

    async movimientos(telefono) {
      const user = await usuarioPorTelefono(telefono);
      return movimientos.listarPorUsuario(user._id);
    }
  };
}
