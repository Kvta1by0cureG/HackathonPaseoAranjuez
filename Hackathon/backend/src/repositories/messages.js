import { Message } from '../models/Message.js';

const LONGITUD_MAXIMA = 4096;

export const historialRepo = {
  async agregar(userId, role, content) {
    const texto = String(content ?? '').slice(0, LONGITUD_MAXIMA);
    if (!texto) return;
    await Message.create({ userId, role, content: texto });
  },

  /** Últimos `limite` mensajes del usuario, del más antiguo al más reciente. */
  async ultimos(userId, limite) {
    const recientes = await Message.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limite)
      .select({ role: 1, content: 1, _id: 0 })
      .lean();
    return recientes.reverse();
  }
};
