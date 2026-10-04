import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// El .env vive en backend/.env, sin importar desde qué carpeta se ejecute el proceso.
const RUTA_ENV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: RUTA_ENV });

const LONGITUD_MINIMA_SECRETO = 32;
const LONGITUD_MINIMA_CLAVE_ADMIN = 24;
const SECRETOS_DE_EJEMPLO = new Set([
  'cambia-esto-en-produccion',
  'changeme',
  'secret',
  'secreto'
]);
const FORMATO_DURACION = /^\d+\s?(ms|s|m|h|d)$/;

export class ConfigError extends Error {
  constructor(errores) {
    super(`Configuración inválida:\n${errores.map((e) => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigError';
    this.errores = errores;
  }
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function booleano(valor) {
  return ['1', 'true', 'yes', 'si', 'sí'].includes(texto(valor).toLowerCase());
}

function enteroPositivo(valor, porDefecto) {
  const numero = Number(texto(valor));
  return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
}

function numeroPositivo(valor, porDefecto) {
  const numero = Number(texto(valor));
  return texto(valor) !== '' && Number.isFinite(numero) && numero > 0 ? numero : porDefecto;
}

function sinBarraFinal(url) {
  return url.replace(/\/+$/, '');
}

/**
 * jsonwebtoken interpreta un número como segundos, pero un número en texto
 * ("900") como milisegundos. Las variables de entorno siempre son texto, así
 * que aquí se convierte: "900" -> 900 (segundos) y "15m" se deja tal cual.
 * Devuelve `null` si el formato no es válido.
 */
export function parsearDuracion(valor, porDefecto = '15m') {
  const crudo = texto(valor);
  if (crudo === '') return porDefecto;
  if (/^\d+$/.test(crudo)) {
    const segundos = Number(crudo);
    return segundos > 0 ? segundos : null;
  }
  return FORMATO_DURACION.test(crudo) ? crudo : null;
}

function parsearTrustProxy(valor) {
  const crudo = texto(valor).toLowerCase();
  if (crudo === '' || crudo === 'false' || crudo === '0') return false;
  if (crudo === 'true') return true;
  return /^\d+$/.test(crudo) ? Number(crudo) : texto(valor);
}

/**
 * Construye la configuración a partir de las variables de entorno.
 * No valida ni termina el proceso: eso lo decide quien la use (ver validarConfig),
 * para que los scripts que solo necesitan la base de datos no exijan WhatsApp.
 */
export function cargarConfig(env = process.env) {
  const entorno = texto(env.NODE_ENV) || 'development';
  const esProduccion = entorno === 'production';
  const webappUrl = sinBarraFinal(
    texto(env.WEBAPP_URL) || (esProduccion ? '' : 'http://localhost:5173')
  );
  const origenes = texto(env.CORS_ORIGINS)
    .split(',')
    .map((origen) => sinBarraFinal(origen.trim()))
    .filter(Boolean);

  return {
    entorno,
    esProduccion,
    port: enteroPositivo(env.PORT, 3000),
    trustProxy: parsearTrustProxy(env.TRUST_PROXY),
    db: {
      url: texto(env.DATABASE_URL)
    },
    jwt: {
      secret: texto(env.JWT_SECRET),
      expiresIn: parsearDuracion(env.JWT_EXPIRES)
    },
    whatsapp: {
      mock: booleano(env.WHATSAPP_MOCK),
      token: texto(env.WHATSAPP_TOKEN),
      phoneId: texto(env.WHATSAPP_PHONE_ID),
      verifyToken: texto(env.WHATSAPP_VERIFY_TOKEN),
      appSecret: texto(env.WHATSAPP_APP_SECRET),
      apiVersion: texto(env.WHATSAPP_API_VERSION) || 'v21.0',
      templateLang: texto(env.WHATSAPP_TEMPLATE_LANG) || 'es'
    },
    llm: {
      apiKey: texto(env.LLM_API_KEY),
      model: texto(env.LLM_MODEL) || 'gpt-4o-mini',
      baseUrl: sinBarraFinal(texto(env.LLM_BASE_URL) || 'https://api.openai.com/v1'),
      timeoutMs: enteroPositivo(env.LLM_TIMEOUT_MS, 20000),
      maxIteraciones: 5,
      mensajesHistorial: enteroPositivo(env.LLM_HISTORY_MESSAGES, 10)
    },
    webapp: {
      url: webappUrl
    },
    cors: {
      origins: origenes.length > 0 ? origenes : [webappUrl].filter(Boolean)
    },
    admin: {
      apiKey: texto(env.ADMIN_API_KEY)
    },
    limites: {
      mensajesPorMinuto: enteroPositivo(env.MAX_MENSAJES_POR_MINUTO, 20),
      apiPorMinuto: enteroPositivo(env.MAX_PETICIONES_API_POR_MINUTO, 120),
      canjesPorMinuto: enteroPositivo(env.MAX_CANJES_POR_MINUTO, 10)
    },
    score: {
      // Puntos que otorga cada unidad monetaria gastada (0.1 = 1 punto cada 10).
      puntosPorUnidad: numeroPositivo(env.PUNTOS_POR_UNIDAD, 0.1)
    }
  };
}

function esUrlHttp(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const VALIDADORES = {
  db(config, errores) {
    if (!config.db.url) errores.push('Falta DATABASE_URL.');
  },

  jwt(config, errores) {
    const { secret, expiresIn } = config.jwt;
    if (!secret) {
      errores.push('Falta JWT_SECRET (genera uno con: npm run secret).');
    } else if (SECRETOS_DE_EJEMPLO.has(secret.toLowerCase())) {
      errores.push('JWT_SECRET usa un valor de ejemplo público; genera uno propio con: npm run secret.');
    } else if (secret.length < LONGITUD_MINIMA_SECRETO) {
      errores.push(`JWT_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`);
    }
    if (expiresIn === null) {
      errores.push('JWT_EXPIRES no es válido. Usa segundos ("900") o una unidad ("15m", "1h").');
    }
  },

  webapp(config, errores) {
    if (!config.webapp.url) {
      errores.push('Falta WEBAPP_URL (obligatoria en producción).');
    } else if (!esUrlHttp(config.webapp.url)) {
      errores.push('WEBAPP_URL debe ser una URL http(s) válida.');
    }
    for (const origen of config.cors.origins) {
      if (!esUrlHttp(origen)) errores.push(`CORS_ORIGINS contiene un origen inválido: ${origen}`);
    }
  },

  whatsapp(config, errores) {
    const { mock, token, phoneId, verifyToken, appSecret } = config.whatsapp;
    if (mock) {
      if (config.esProduccion) {
        errores.push('WHATSAPP_MOCK=true no está permitido con NODE_ENV=production.');
      }
      return;
    }
    const requeridas = {
      WHATSAPP_TOKEN: token,
      WHATSAPP_PHONE_ID: phoneId,
      WHATSAPP_VERIFY_TOKEN: verifyToken,
      WHATSAPP_APP_SECRET: appSecret
    };
    const faltantes = Object.keys(requeridas).filter((nombre) => !requeridas[nombre]);
    if (faltantes.length > 0) {
      errores.push(
        `Falta ${faltantes.join(', ')}. Para trabajar sin WhatsApp define WHATSAPP_MOCK=true.`
      );
    }
  },

  admin(config, errores, avisos) {
    const { apiKey } = config.admin;
    if (!apiKey) {
      avisos.push('ADMIN_API_KEY no definida: las rutas de administración y notificaciones responden 503.');
    } else if (apiKey.length < LONGITUD_MINIMA_CLAVE_ADMIN) {
      errores.push(`ADMIN_API_KEY debe tener al menos ${LONGITUD_MINIMA_CLAVE_ADMIN} caracteres.`);
    }
  },

  llm(config, errores, avisos) {
    if (!config.llm.apiKey) {
      avisos.push('LLM_API_KEY no definida: el agente responderá solo con el modo de palabras clave.');
    }
    if (!esUrlHttp(config.llm.baseUrl)) errores.push('LLM_BASE_URL debe ser una URL http(s) válida.');
  }
};

export const SECCIONES_SERVIDOR = Object.freeze(['db', 'jwt', 'webapp', 'whatsapp', 'admin', 'llm']);

/**
 * Valida solo las secciones pedidas y devuelve los avisos no bloqueantes.
 * Lanza ConfigError con todos los problemas encontrados (no solo el primero).
 */
export function validarConfig(config, secciones = SECCIONES_SERVIDOR) {
  const errores = [];
  const avisos = [];
  for (const seccion of secciones) {
    const validar = VALIDADORES[seccion];
    if (!validar) throw new Error(`Sección de configuración desconocida: ${seccion}`);
    validar(config, errores, avisos);
  }
  if (errores.length > 0) throw new ConfigError(errores);
  return avisos;
}

export const config = cargarConfig();
