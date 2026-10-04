import mongoose from 'mongoose';
import { PISO_MAX, PISO_MIN } from '../services/score.js';

const catalogSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  floor: {
    type: Number,
    required: true,
    min: PISO_MIN,
    max: PISO_MAX,
    validate: { validator: Number.isInteger, message: 'El piso debe ser un entero' }
  },
  description: { type: String, default: '' },
  price: { type: Number, default: 0, min: 0 },
  imageUrl: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Índice para consultar rápido el catálogo activo por piso.
catalogSchema.index({ floor: 1, active: 1 });

export const Catalog = mongoose.model('Catalog', catalogSchema);
