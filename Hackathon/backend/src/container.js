import { catalogoRepo } from './repositories/catalog.js';
import { historialRepo } from './repositories/messages.js';
import { movimientosRepo } from './repositories/movements.js';
import { procesadosRepo } from './repositories/processedMessages.js';
import { sesionesRepo } from './repositories/sessions.js';
import { usuariosRepo } from './repositories/users.js';
import { crearAgente } from './services/agent.js';
import { crearServicioCatalogo } from './services/catalogService.js';
import { crearProcesadorEntrante } from './services/inbound.js';
import { crearClienteLLM } from './services/llm.js';
import { crearServicioScore } from './services/scoreService.js';
import { crearServicioSesiones } from './services/sessions.js';
import { crearHerramientas } from './services/tools/index.js';
import { crearClienteWhatsApp, crearClienteWhatsAppMock } from './services/whatsapp.js';
import { crearLimitador } from './utils/rateLimiter.js';

const UN_MINUTO_MS = 60000;

/**
 * Raíz de composición: crea los servicios reales (MongoDB, WhatsApp, LLM) y los
 * conecta entre sí. Es el único lugar donde se decide qué implementación se usa.
 */
export function crearServicios(config, { log = console } = {}) {
  const usuarios = usuariosRepo;

  const mensajeria = config.whatsapp.mock
    ? crearClienteWhatsAppMock(config.whatsapp, { log })
    : crearClienteWhatsApp(config.whatsapp, { log });

  const sesiones = crearServicioSesiones({ config, sesiones: sesionesRepo });
  const catalogo = crearServicioCatalogo({ catalogo: catalogoRepo });
  const score = crearServicioScore({
    usuarios,
    movimientos: movimientosRepo,
    catalogo: catalogoRepo,
    config
  });

  const herramientas = crearHerramientas({ usuarios, catalogo, sesiones, mensajeria }, { log });
  const agente = crearAgente({
    llm: crearClienteLLM(config.llm),
    herramientas,
    mensajeria,
    historial: historialRepo,
    usuarios,
    catalogo,
    sesiones,
    config: config.llm,
    log
  });

  const procesador = crearProcesadorEntrante({
    usuarios,
    procesados: procesadosRepo,
    agente,
    mensajeria,
    limitador: crearLimitador({ limite: config.limites.mensajesPorMinuto, ventanaMs: UN_MINUTO_MS }),
    log
  });

  return { usuarios, sesiones, catalogo, score, mensajeria, agente, procesador };
}
