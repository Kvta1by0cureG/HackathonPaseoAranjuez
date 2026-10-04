import { calcularPiso, infoPiso } from '../score.js';

export const definicion = {
  type: 'function',
  function: {
    name: 'getUserScore',
    description: 'Obtiene el score, el piso (nivel) y el nombre del usuario actual.',
    parameters: { type: 'object', properties: {}, required: [] }
  }
};

export async function ejecutar(_args, { user }) {
  const floor = calcularPiso(user.score);
  return {
    name: user.name,
    score: user.score,
    floor,
    nivel: infoPiso(floor).label
  };
}
