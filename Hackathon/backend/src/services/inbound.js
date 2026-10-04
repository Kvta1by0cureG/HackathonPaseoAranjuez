import { recortar } from '../utils/texto.js';

const LONGITUD_MAXIMA_TEXTO = 2000;

export const AVISOS = Object.freeze({
  soloTexto: 'Por ahora solo puedo leer mensajes de texto. Escríbeme tu consulta. 🙂',
  demasiadosMensajes: 'Estás enviando muchos mensajes seguidos. Espera un minuto y vuelve a escribirme.'
});

function textoDelMensaje(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body;
    case 'button':
      return message.button?.text;
    case 'interactive':
      return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
    default:
      return undefined;
  }
}

/**
 * Extrae TODOS los mensajes entrantes de un payload del webhook de WhatsApp
 * (puede traer varias entradas, cambios y mensajes; los estados de entrega se ignoran).
 */
export function extraerMensajes(body) {
  const mensajes = [];
  const entradas = Array.isArray(body?.entry) ? body.entry : [];

  for (const entrada of entradas) {
    const cambios = Array.isArray(entrada?.changes) ? entrada.changes : [];
    for (const cambio of cambios) {
      const value = cambio?.value;
      const recibidos = Array.isArray(value?.messages) ? value.messages : [];
      const contactos = Array.isArray(value?.contacts) ? value.contacts : [];

      for (const message of recibidos) {
        if (typeof message?.id !== 'string' || typeof message?.from !== 'string') continue;
        if (!/^\d{6,20}$/.test(message.from)) continue;

        const contacto = contactos.find((c) => c?.wa_id === message.from) ?? contactos[0];
        const texto = textoDelMensaje(message);
        mensajes.push({
          id: message.id,
          from: message.from,
          type: typeof message.type === 'string' ? message.type : 'desconocido',
          text: typeof texto === 'string' ? texto.trim() : '',
          name: typeof contacto?.profile?.name === 'string' ? contacto.profile.name : ''
        });
      }
    }
  }
  return mensajes;
}

/**
 * Procesa los mensajes entrantes fuera del ciclo petición/respuesta del webhook.
 * - Idempotencia: cada message.id se procesa una sola vez.
 * - Tope por usuario: limita el gasto en llamadas al LLM.
 * - Orden: los mensajes de un mismo teléfono se atienden de uno en uno.
 */
export function crearProcesadorEntrante({ usuarios, procesados, agente, mensajeria, limitador, log = console }) {
  const colas = new Map();

  async function enviarAviso(telefono, texto) {
    try {
      await mensajeria.enviarTexto(telefono, texto);
    } catch (error) {
      log.error('No se pudo enviar el aviso por WhatsApp:', error.message);
    }
  }

  async function procesarMensaje(mensaje) {
    const esNuevo = await procesados.registrar(mensaje.id);
    if (!esNuevo) return 'duplicado';

    const consumo = limitador.consumir(mensaje.from);
    if (!consumo.permitido) {
      if (consumo.primerExceso) await enviarAviso(mensaje.from, AVISOS.demasiadosMensajes);
      return 'limitado';
    }

    const user = await usuarios.obtenerOCrearPorTelefono(mensaje.from, mensaje.name);

    if (!mensaje.text) {
      await enviarAviso(mensaje.from, AVISOS.soloTexto);
      return 'no_texto';
    }

    await agente.atender({ user, text: recortar(mensaje.text, LONGITUD_MAXIMA_TEXTO) });
    return 'atendido';
  }

  function encolar(mensaje) {
    const anterior = colas.get(mensaje.from) ?? Promise.resolve();
    const tarea = anterior
      .then(() => procesarMensaje(mensaje))
      .catch((error) => {
        log.error(`Error procesando el mensaje ${mensaje.id}:`, error);
        return 'error';
      });

    colas.set(mensaje.from, tarea);
    tarea.finally(() => {
      if (colas.get(mensaje.from) === tarea) colas.delete(mensaje.from);
    });
    return tarea;
  }

  return {
    /**
     * Encola todos los mensajes del payload. La promesa devuelta se resuelve con
     * el resultado de cada uno y nunca se rechaza.
     */
    procesarPayload(body) {
      return Promise.all(extraerMensajes(body).map(encolar));
    }
  };
}
