import { User } from '../models/User.js';
import { esObjectId } from '../utils/ids.js';

const CODIGO_CLAVE_DUPLICADA = 11000;

export const usuariosRepo = {
  async buscarPorId(id) {
    if (!esObjectId(id)) return null;
    return User.findById(id).lean();
  },

  async buscarPorTelefono(phone) {
    return User.findOne({ phone: String(phone) }).lean();
  },

  /**
   * Devuelve el usuario de ese teléfono, creándolo si no existe. El upsert es
   * atómico: dos mensajes simultáneos de un número nuevo no crean duplicados.
   */
  async obtenerOCrearPorTelefono(phone, name = '') {
    const telefono = String(phone);
    const nombre = String(name || '').trim().slice(0, 120);
    let user;

    try {
      user = await User.findOneAndUpdate(
        { phone: telefono },
        { $setOnInsert: { name: nombre } },
        { upsert: true, new: true, lean: true }
      );
    } catch (error) {
      // Dos upserts simultáneos pueden chocar con el índice único: el otro ya lo creó.
      if (error?.code !== CODIGO_CLAVE_DUPLICADA) throw error;
      user = await User.findOne({ phone: telefono }).lean();
    }

    if (nombre && !user.name) {
      const actualizado = await User.findOneAndUpdate(
        { _id: user._id, name: '' },
        { $set: { name: nombre } },
        { new: true, lean: true }
      );
      if (actualizado) user = actualizado;
    }

    return user;
  },

  /**
   * Suma o resta puntos de forma atómica con $inc (sin leer-modificar-guardar).
   * Al restar exige saldo suficiente en el propio filtro, así el score nunca
   * queda negativo aunque haya operaciones simultáneas.
   * Devuelve el usuario actualizado, o `null` si no existe o no tiene saldo.
   */
  async incrementarScore(id, puntos) {
    if (!esObjectId(id) || !Number.isInteger(puntos)) return null;
    const filtro = puntos < 0 ? { _id: id, score: { $gte: -puntos } } : { _id: id };
    return User.findOneAndUpdate(filtro, { $inc: { score: puntos } }, { new: true, lean: true });
  }
};
