import mongoose from 'mongoose';

const DIAS_DE_HISTORIAL = 30;

// Historial de conversación que se reenvía al LLM (solo texto de usuario y respuestas).
const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true, maxlength: 4096 }
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: DIAS_DE_HISTORIAL * 24 * 60 * 60 });

export const Message = mongoose.model('Message', messageSchema);
