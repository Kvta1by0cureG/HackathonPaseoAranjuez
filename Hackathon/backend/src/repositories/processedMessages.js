import { ProcessedMessage } from '../models/ProcessedMessage.js';

const CODIGO_CLAVE_DUPLICADA = 11000;

export const procesadosRepo = {
  /**
   * Registra el id de un mensaje entrante. Devuelve `true` la primera vez y
   * `false` si ya se había registrado (mensaje reenviado por el proveedor).
   */
  async registrar(messageId) {
    try {
      await ProcessedMessage.create({ messageId: String(messageId) });
      return true;
    } catch (error) {
      if (error?.code === CODIGO_CLAVE_DUPLICADA) return false;
      throw error;
    }
  }
};
