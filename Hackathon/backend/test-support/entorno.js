// Monta todos los servicios reales sobre repositorios en memoria y, si se pide,
// levanta la app HTTP en un puerto libre.
import { crearApp } from '../src/app.js';
import { crearAgente } from '../src/services/agent.js';
import { crearServicioCatalogo } from '../src/services/catalogService.js';
import { crearProcesadorEntrante } from '../src/services/inbound.js';
import { crearServicioScore } from '../src/services/scoreService.js';
import { crearServicioSesiones } from '../src/services/sessions.js';
import { crearHerramientas } from '../src/services/tools/index.js';
import { crearClienteWhatsAppMock } from '../src/services/whatsapp.js';
import { crearLimitador } from '../src/utils/rateLimiter.js';
import {
  CATALOGO_DE_PRUEBA,
  configDePrueba,
  crearCatalogoRepoFake,
  crearHistorialFake,
  crearMovimientosFake,
  crearProcesadosFake,
  crearSesionesRepoFake,
  crearUsuariosFake,
  logSilencioso
} from './fakes.js';

export function crearEntorno({
  env = {},
  usuariosIniciales = [],
  productos = CATALOGO_DE_PRUEBA,
  llm = null,
  mensajeria,
  ahora
} = {}) {
  const config = configDePrueba(env);
  const log = logSilencioso;

  const usuarios = crearUsuariosFake(usuariosIniciales);
  const catalogoRepo = crearCatalogoRepoFake(productos);
  const sesionesRepo = crearSesionesRepoFake();
  const movimientos = crearMovimientosFake();
  const historial = crearHistorialFake();
  const procesados = crearProcesadosFake();
  const whatsapp = mensajeria ?? crearClienteWhatsAppMock(config.whatsapp, { log });

  const sesiones = crearServicioSesiones({ config, sesiones: sesionesRepo, ahora });
  const catalogo = crearServicioCatalogo({ catalogo: catalogoRepo });
  const score = crearServicioScore({ usuarios, movimientos, catalogo: catalogoRepo, config });
  const herramientas = crearHerramientas({ usuarios, catalogo, sesiones, mensajeria: whatsapp }, { log });
  const agente = crearAgente({
    llm,
    herramientas,
    mensajeria: whatsapp,
    historial,
    usuarios,
    catalogo,
    sesiones,
    config: config.llm,
    log
  });
  const procesador = crearProcesadorEntrante({
    usuarios,
    procesados,
    agente,
    mensajeria: whatsapp,
    limitador: crearLimitador({ limite: config.limites.mensajesPorMinuto, ventanaMs: 60000 }),
    log
  });

  const servicios = { usuarios, sesiones, catalogo, score, mensajeria: whatsapp, agente, procesador };

  return {
    config,
    log,
    servicios,
    repos: { usuarios, catalogoRepo, sesionesRepo, movimientos, historial, procesados },
    herramientas,
    agente,
    whatsapp
  };
}

/** Levanta la app en un puerto libre. Devuelve la URL base y una función para cerrarla. */
export async function levantarApp(entorno) {
  const app = crearApp({ config: entorno.config, servicios: entorno.servicios, log: entorno.log });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    cerrar: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections?.();
    })
  };
}
