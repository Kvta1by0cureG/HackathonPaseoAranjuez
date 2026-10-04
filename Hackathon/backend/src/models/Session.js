import mongoose from 'mongoose';

// Una sesión nace con el enlace que se envía por WhatsApp (identificado por `jti`).
// - usedAt:    momento en que el enlace se canjeó (el enlace es de un solo uso).
// - revokedAt: cierre de sesión; a partir de ahí el token de acceso deja de valer.
const sessionSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }
}, {
  timestamps: true,
  // Colección nueva: la antigua `sessions` tenía un índice único sobre `token`
  // que chocaría con este esquema.
  collection: 'panel_sessions'
});

// MongoDB elimina solo las sesiones expiradas.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
