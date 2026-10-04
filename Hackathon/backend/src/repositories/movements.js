import { ScoreMovement } from '../models/ScoreMovement.js';
import { esObjectId } from '../utils/ids.js';

export const movimientosRepo = {
  async registrar({ userId, puntos, scoreResultante, origen, motivo = '', detalle = null }) {
    const movimiento = await ScoreMovement.create({
      userId,
      puntos,
      scoreResultante,
      origen,
      motivo: String(motivo).slice(0, 300),
      detalle
    });
    return movimiento.toObject();
  },

  async listarPorUsuario(userId, limite = 50) {
    if (!esObjectId(userId)) return [];
    return ScoreMovement.find({ userId }).sort({ createdAt: -1 }).limit(limite).lean();
  }
};
