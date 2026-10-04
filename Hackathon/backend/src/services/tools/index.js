import * as getCatalogByFloor from './getCatalogByFloor.js';
import * as getProgress from './getProgress.js';
import * as getUserScore from './getUserScore.js';
import * as sendPanelLink from './sendPanelLink.js';

// Herramientas que el LLM puede invocar. Todas son de lectura, salvo enviar el
// enlace del panel. No existe ninguna herramienta que modifique puntos.
const HERRAMIENTAS = [getUserScore, getProgress, getCatalogByFloor, sendPanelLink];

function parsearArgumentos(crudo) {
  if (crudo === undefined || crudo === null || crudo === '') return {};
  if (typeof crudo === 'object') return crudo;
  const valor = JSON.parse(crudo);
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new TypeError('Los argumentos deben ser un objeto JSON');
  }
  return valor;
}

/**
 * @param {object} servicios { usuarios, catalogo, sesiones, mensajeria }
 */
export function crearHerramientas(servicios, { log = console } = {}) {
  const porNombre = new Map(HERRAMIENTAS.map((h) => [h.definicion.function.name, h]));

  return {
    definiciones: HERRAMIENTAS.map((h) => h.definicion),

    /**
     * Ejecuta una herramienta para el usuario del turno. Nunca lanza: un fallo
     * se devuelve como `{ error }` para que el modelo pueda explicarlo.
     * @param {object} turno Estado del turno: { userId, panelEnviado }
     */
    async ejecutar(nombre, argumentosCrudos, turno) {
      const herramienta = porNombre.get(nombre);
      if (!herramienta) return { error: `Herramienta ${nombre} no disponible` };

      let args;
      try {
        args = parsearArgumentos(argumentosCrudos);
      } catch {
        return { error: 'Argumentos inválidos: se esperaba un objeto JSON' };
      }

      try {
        // Se recarga el usuario en cada llamada para trabajar siempre con su score actual.
        const user = await servicios.usuarios.buscarPorId(turno.userId);
        if (!user) return { error: 'Usuario no encontrado' };
        return await herramienta.ejecutar(args, { user, servicios, turno });
      } catch (error) {
        log.error(`Error en la herramienta ${nombre}:`, error.message);
        return { error: 'No se pudo completar la operación' };
      }
    }
  };
}
