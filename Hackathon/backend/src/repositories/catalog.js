import { Catalog } from '../models/Catalog.js';
import { esObjectId } from '../utils/ids.js';

function exigirEntero(nombre, valor) {
  // Nunca se pasa a Mongo un valor sin validar: un objeto como {"$gt": 0}
  // se interpretaría como operador de consulta.
  if (!Number.isInteger(valor)) throw new TypeError(`${nombre} debe ser un entero`);
}

export const catalogoRepo = {
  /** Productos activos de un piso concreto. */
  async listarPorPiso(floor) {
    exigirEntero('floor', floor);
    return Catalog.find({ floor, active: true }).sort({ name: 1 }).lean();
  },

  /** Productos activos de todos los pisos hasta `pisoMaximo` (acceso acumulativo). */
  async listarHastaPiso(pisoMaximo) {
    exigirEntero('pisoMaximo', pisoMaximo);
    return Catalog.find({ floor: { $lte: pisoMaximo }, active: true })
      .sort({ floor: 1, name: 1 })
      .lean();
  },

  async buscarActivoPorId(id) {
    if (!esObjectId(id)) return null;
    return Catalog.findOne({ _id: String(id), active: true }).lean();
  },

  async contar() {
    return Catalog.countDocuments({});
  }
};
