import { CatalogoError } from '../catalogService.js';

export const definicion = {
  type: 'function',
  function: {
    name: 'getCatalogByFloor',
    description:
      'Devuelve los productos activos que el usuario puede ver. Sin "floor" devuelve todos los pisos desbloqueados; con "floor" solo ese piso (debe estar desbloqueado).',
    parameters: {
      type: 'object',
      properties: {
        floor: { type: 'integer', description: 'Número de piso (1 a 5). Opcional.' }
      },
      required: []
    }
  }
};

function resumir(item) {
  return { name: item.name, description: item.description, price: item.price, floor: item.floor };
}

export async function ejecutar(args, { user, servicios }) {
  try {
    // El esquema dice "integer", pero el LLM puede enviar cualquier cosa:
    // el servicio valida el piso antes de tocar la base de datos.
    const { floor, pisoUsuario, items } = await servicios.catalogo.consultar({
      score: user.score,
      floor: args.floor
    });
    return { floor, pisoUsuario, items: items.map(resumir) };
  } catch (error) {
    if (error instanceof CatalogoError) return { error: error.message, ...error.datos };
    throw error;
  }
}
