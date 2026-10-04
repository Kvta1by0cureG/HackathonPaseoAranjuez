import mongoose from 'mongoose';

export const ORIGENES_MOVIMIENTO = Object.freeze(['compra', 'ajuste_admin']);

// Auditoría: cada cambio de puntos deja un registro inmutable con su motivo.
const scoreMovementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  puntos: { type: Number, required: true },
  scoreResultante: { type: Number, required: true },
  origen: { type: String, required: true, enum: ORIGENES_MOVIMIENTO },
  motivo: { type: String, default: '', trim: true, maxlength: 300 },
  detalle: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

scoreMovementSchema.index({ userId: 1, createdAt: -1 });

export const ScoreMovement = mongoose.model('ScoreMovement', scoreMovementSchema);
