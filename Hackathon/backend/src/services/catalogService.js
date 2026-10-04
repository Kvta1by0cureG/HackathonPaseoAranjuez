import { calcularPiso, esPisoValido, puntosParaPiso } from './score.js';

export class CatalogoError extends Error {
  constructor(mensaje, { status, codigo, datos = {} }) {
    super(mensaje);
    this.name = 'CatalogoError';
    this.status = status;
    this.codigo = codigo;
    this.datos = datos;
  }
}

/**
 * Reglas de acceso al catálogo, compartidas por la API y por el agente:
 * - Acceso acumulativo: un usuario ve su piso y todos los anteriores.
 * - Los pisos superiores están bloqueados hasta alcanzar el score necesario.
 */
export function crearServicioCatalogo({ catalogo }) {
  return {
    /**
     * @param {number} score  Score actual del usuario.
     * @param {unknown} [floor] Piso pedido. Si se omite, devuelve todos los accesibles.
     */
    async consultar({ score, floor }) {
      const pisoUsuario = calcularPiso(score);

      if (floor === undefined || floor === null) {
        const items = await catalogo.listarHastaPiso(pisoUsuario);
        return { floor: null, pisoUsuario, items };
      }

      if (!esPisoValido(floor)) {
        throw new CatalogoError('El piso debe ser un número entero válido', {
          status: 400,
          codigo: 'piso_invalido'
        });
      }

      if (floor > pisoUsuario) {
        throw new CatalogoError('Ese piso todavía está bloqueado', {
          status: 403,
          codigo: 'piso_bloqueado',
          datos: { pisoUsuario, faltan: puntosParaPiso(score, floor) }
        });
      }

      const items = await catalogo.listarPorPiso(floor);
      return { floor, pisoUsuario, items };
    }
  };
}
