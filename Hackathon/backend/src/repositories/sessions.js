import { Session } from '../models/Session.js';

export const sesionesRepo = {
  async crear({ jti, userId, expiresAt }) {
    await Session.create({ jti, userId, expiresAt });
  },

  /**
   * Marca el enlace como usado solo si todavía no lo estaba (operación atómica):
   * de dos canjes simultáneos del mismo enlace, solo uno obtiene la sesión.
   */
  async marcarUsada(jti, ahora) {
    return Session.findOneAndUpdate(
      { jti: String(jti), usedAt: null, revokedAt: null, expiresAt: { $gt: ahora } },
      { $set: { usedAt: ahora } },
      { new: true, lean: true }
    );
  },

  /** Sesión ya canjeada, sin revocar y sin expirar. */
  async buscarActiva(jti, ahora) {
    return Session.findOne({
      jti: String(jti),
      usedAt: { $ne: null },
      revokedAt: null,
      expiresAt: { $gt: ahora }
    }).lean();
  },

  async revocar(jti, ahora) {
    await Session.updateOne({ jti: String(jti), revokedAt: null }, { $set: { revokedAt: ahora } });
  }
};
