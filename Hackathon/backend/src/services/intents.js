import { esPisoValido } from './score.js';
import { palabras } from '../utils/texto.js';

export const INTENCIONES = Object.freeze({
  PANEL: 'panel',
  PROGRESO: 'progreso',
  CATALOGO: 'catalogo',
  SCORE: 'score',
  SALUDO: 'saludo'
});

// El orden define la prioridad: una petición explícita del panel gana aunque el
// mensaje mencione puntos o productos ("quiero ver mi panel con mis puntos").
const REGLAS = [
  {
    intencion: INTENCIONES.PANEL,
    claves: ['panel', 'web', 'webapp', 'link', 'enlace', 'pagina', 'sitio', 'app']
  },
  {
    intencion: INTENCIONES.PROGRESO,
    claves: ['falta', 'faltan', 'subir', 'subo', 'progreso', 'avance', 'siguiente', 'proximo']
  },
  {
    intencion: INTENCIONES.CATALOGO,
    claves: ['catalogo', 'producto', 'productos', 'menu', 'carta', 'precio', 'precios', 'comprar']
  },
  {
    intencion: INTENCIONES.SCORE,
    claves: ['score', 'punto', 'puntos', 'puntaje', 'saldo', 'nivel', 'piso']
  },
  {
    intencion: INTENCIONES.SALUDO,
    claves: ['hola', 'buenas', 'buenos', 'hey', 'ayuda']
  }
];

/**
 * Detecta la intención de un mensaje comparando palabras completas
 * (así "web" no coincide dentro de "webinar"). Devuelve null si no reconoce nada.
 */
export function detectarIntencion(texto) {
  const tokens = new Set(palabras(texto));
  for (const regla of REGLAS) {
    if (regla.claves.some((clave) => tokens.has(clave))) return regla.intencion;
  }
  return null;
}

/** Número de piso mencionado en el mensaje ("productos del piso 2"), o null. */
export function extraerPiso(texto) {
  const tokens = palabras(texto);
  const indice = tokens.findIndex((token) => token === 'piso' || token === 'nivel');
  if (indice === -1) return null;
  const numero = Number(tokens[indice + 1]);
  return esPisoValido(numero) ? numero : null;
}
