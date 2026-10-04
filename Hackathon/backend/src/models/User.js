import mongoose from 'mongoose';

// El piso NO se guarda: siempre se calcula a partir del score (ver services/score.js),
// así nunca queda desfasado si cambian los umbrales o se corrige un score.
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, trim: true },
  name: { type: String, default: '', trim: true, maxlength: 120 },
  score: {
    type: Number,
    default: 0,
    min: 0,
    validate: { validator: Number.isInteger, message: 'El score debe ser un entero' }
  }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
