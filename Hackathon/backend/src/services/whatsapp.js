import { recortar } from '../utils/texto.js';

const LIMITE_TEXTO = 4096; // máximo de la Cloud API para un mensaje de texto
const LIMITE_TEXTO_BOTON = 20;
const TIEMPO_MAXIMO_MS = 10000;
const MAXIMO_MENSAJES_SIMULADOS = 200;

function cuerpoTexto(para, texto) {
  return {
    messaging_product: 'whatsapp',
    to: para,
    type: 'text',
    text: { body: recortar(texto, LIMITE_TEXTO) }
  };
}

function cuerpoBotonUrl(para, texto, textoBoton, url) {
  return {
    messaging_product: 'whatsapp',
    to: para,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: recortar(texto, 1024) },
      action: {
        name: 'cta_url',
        parameters: { display_text: recortar(textoBoton, LIMITE_TEXTO_BOTON), url }
      }
    }
  };
}

/**
 * Plantilla aprobada por Meta. El idioma es configurable y `components` solo
 * se envía si hay parámetros: Meta rechaza un body vacío en plantillas sin variables.
 */
export function cuerpoPlantilla(para, nombre, { parametros = [], idioma = 'es' } = {}) {
  const template = { name: nombre, language: { code: idioma } };
  if (parametros.length > 0) {
    template.components = [{
      type: 'body',
      parameters: parametros.map((valor) => ({ type: 'text', text: String(valor) }))
    }];
  }
  return { messaging_product: 'whatsapp', to: para, type: 'template', template };
}

/** Cliente real de la WhatsApp Cloud API. */
export function crearClienteWhatsApp({ token, phoneId, apiVersion, templateLang = 'es' }, {
  fetch: fetchImpl = globalThis.fetch,
  log = console
} = {}) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;

  async function enviar(datos) {
    const respuesta = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });

    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      log.error('⚠️ Meta respondió con error:', json);
      throw new Error(json.error?.message || `Error ${respuesta.status} en WhatsApp API`);
    }
    return json;
  }

  return {
    modo: 'real',
    enviarTexto: (para, texto) => enviar(cuerpoTexto(para, texto)),
    enviarBotonUrl: (para, texto, textoBoton, enlace) =>
      enviar(cuerpoBotonUrl(para, texto, textoBoton, enlace)),
    enviarPlantilla: (para, nombre, { parametros = [], idioma = templateLang } = {}) =>
      enviar(cuerpoPlantilla(para, nombre, { parametros, idioma }))
  };
}

/**
 * Cliente simulado (WHATSAPP_MOCK=true): no llama a Meta, guarda los mensajes
 * en memoria y los muestra por consola. Permite desarrollar sin cuenta de WhatsApp.
 */
export function crearClienteWhatsAppMock({ templateLang = 'es' } = {}, { log = console } = {}) {
  const enviados = [];
  let total = 0;

  function registrar(datos) {
    total += 1;
    enviados.push(datos);
    if (enviados.length > MAXIMO_MENSAJES_SIMULADOS) enviados.shift();
    log.info('📨 [WhatsApp simulado]', JSON.stringify(datos));
    return Promise.resolve({ simulado: true });
  }

  return {
    modo: 'mock',
    enviados,
    /** Total de mensajes enviados desde el arranque (`enviados` solo guarda los últimos). */
    get total() {
      return total;
    },
    enviarTexto: (para, texto) => registrar(cuerpoTexto(para, texto)),
    enviarBotonUrl: (para, texto, textoBoton, enlace) =>
      registrar(cuerpoBotonUrl(para, texto, textoBoton, enlace)),
    enviarPlantilla: (para, nombre, { parametros = [], idioma = templateLang } = {}) =>
      registrar(cuerpoPlantilla(para, nombre, { parametros, idioma }))
  };
}
