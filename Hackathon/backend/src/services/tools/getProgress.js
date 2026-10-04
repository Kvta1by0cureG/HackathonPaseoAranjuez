import { progresoPiso } from '../score.js';

export const definicion = {
  type: 'function',
  function: {
    name: 'getProgress',
    description:
      'Indica cuántos puntos le faltan al usuario para subir al siguiente piso (nivel) y su porcentaje de avance.',
    parameters: { type: 'object', properties: {}, required: [] }
  }
};

export async function ejecutar(_args, { user }) {
  return { score: user.score, ...progresoPiso(user.score) };
}
