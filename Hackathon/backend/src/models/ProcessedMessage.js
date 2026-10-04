import mongoose from 'mongoose';

const DIAS_DE_RETENCION = 7;

// Idempotencia del webhook: el índice único sobre messageId garantiza que un
// mensaje reenviado por Meta se procese una sola vez.
const processedMessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

processedMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: DIAS_DE_RETENCION * 24 * 60 * 60 }
);

export const ProcessedMessage = mongoose.model('ProcessedMessage', processedMessageSchema);
