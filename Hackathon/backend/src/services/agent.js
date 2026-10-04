import { INTENCIONES, detectarIntencion, extraerPiso } from './intents.js';
import { CatalogoError } from './catalogService.js';
import { calcularPiso, nombrePiso, progresoPiso } from './score.js';
import { TEXTO_BOTON_PANEL, TEXTO_PANEL } from './tools/sendPanelLink.js';

export const PROMPT_SISTEMA = `Eres el asistente de WhatsApp de una tienda organizada por pisos (niveles).
Responde siempre en español, de forma breve y amable.
Usa las herramientas para consultar datos reales; nunca inventes puntos, niveles ni productos.
- getUserScore: score y piso del usuario.
- getProgress: cuánto le falta para subir de piso.
- getCatalogByFloor: productos de los pisos que tiene desbloqueados.
- sendPanelLink: envía el botón con el enlace a su panel web. Úsala si pide su panel, la web o un enlace.
No puedes sumar, restar ni regalar puntos: se obtienen únicamente con compras registradas en la tienda. Si el usuario lo pide, explícaselo con amabilidad.`;

export const RESPUESTAS = Object.freeze({
  sinRespuesta: 'No pude completar tu solicitud. Intenta de nuevo o escribe "score", "catálogo", "progreso" o "panel".',
  noEntendi: 'No entendí. Escribe "score", "catálogo", "progreso" o "panel".',
  panelEnviado: 'Te envié el botón para abrir tu panel.',
  error: 'Tuvimos un problema al procesar tu mensaje. Inténtalo de nuevo en unos minutos.'
});

function saludo(user) {
  const nombre = user.name ? `, ${user.name}` : '';
  return `¡Hola${nombre}! Puedo ayudarte con tu "score", el "catálogo", tu "progreso" o enviarte tu "panel".`;
}

function textoCatalogo({ floor, pisoUsuario, items }) {
  if (items.length === 0) {
    return floor ? `No hay productos en el piso ${floor}.` : 'Todavía no hay productos disponibles.';
  }
  const lineas = [];
  let pisoActual = null;
  for (const item of items) {
    if (item.floor !== pisoActual) {
      pisoActual = item.floor;
      lineas.push(`*${nombrePiso(pisoActual)}*`);
    }
    lineas.push(`• ${item.name} - $${item.price}`);
  }
  if (!floor && pisoUsuario > 1) lineas.unshift('Estos son los productos de tus pisos desbloqueados:');
  return lineas.join('\n');
}

function textoProgreso(score) {
  const progreso = progresoPiso(score);
  if (!progreso.siguiente) {
    return `Tienes ${score} puntos y ya estás en el nivel máximo (${nombrePiso(progreso.floor)}). 🎉`;
  }
  return `Tienes ${score} puntos (${nombrePiso(progreso.floor)}). Te faltan ${progreso.faltan} para subir a ${nombrePiso(progreso.siguientePiso)}.`;
}

/**
 * Agente conversacional. Recibe sus dependencias por parámetro para poder
 * probarlo sin LLM, base de datos ni WhatsApp reales.
 *
 * @param {object} deps
 * @param {object|null} deps.llm          Cliente LLM, o null para usar solo palabras clave.
 * @param {object} deps.herramientas      { definiciones, ejecutar }
 * @param {object} deps.mensajeria        Cliente de WhatsApp.
 * @param {object} deps.historial         { ultimos, agregar }
 * @param {object} deps.usuarios          Repositorio de usuarios.
 * @param {object} deps.catalogo          Servicio de catálogo.
 * @param {object} deps.sesiones          Servicio de sesiones.
 * @param {object} deps.config            Sección `llm` de la configuración.
 */
export function crearAgente({
  llm,
  herramientas,
  mensajeria,
  historial,
  usuarios,
  catalogo,
  sesiones,
  config,
  log = console
}) {
  /** Respuesta sin LLM, por palabras clave. Devuelve null si ya respondió con el botón. */
  async function responderPorPalabrasClave(user, texto, turno) {
    const intencion = detectarIntencion(texto);

    if (intencion === INTENCIONES.PANEL) {
      if (!turno.panelEnviado) {
        const { token } = await sesiones.crearEnlace(user._id);
        await mensajeria.enviarBotonUrl(user.phone, TEXTO_PANEL, TEXTO_BOTON_PANEL, sesiones.urlPanel(token));
        turno.panelEnviado = true;
      }
      return null;
    }

    if (intencion === INTENCIONES.PROGRESO) return textoProgreso(user.score);

    if (intencion === INTENCIONES.CATALOGO) {
      try {
        const resultado = await catalogo.consultar({
          score: user.score,
          floor: extraerPiso(texto) ?? undefined
        });
        return textoCatalogo(resultado);
      } catch (error) {
        if (!(error instanceof CatalogoError)) throw error;
        return `Ese piso todavía está bloqueado. Te faltan ${error.datos.faltan} puntos para desbloquearlo.`;
      }
    }

    if (intencion === INTENCIONES.SCORE) {
      return `Tu score es ${user.score} y estás en el ${nombrePiso(calcularPiso(user.score))}.`;
    }

    if (intencion === INTENCIONES.SALUDO) return saludo(user);

    return RESPUESTAS.noEntendi;
  }

  /** Conversación con el LLM y sus herramientas. Devuelve el texto final. */
  async function responderConLLM(texto, previos, turno) {
    const messages = [
      { role: 'system', content: PROMPT_SISTEMA },
      ...previos,
      { role: 'user', content: texto }
    ];

    for (let i = 0; i < config.maxIteraciones; i++) {
      const completion = await llm.completar(messages, herramientas.definiciones);
      const eleccion = completion?.choices?.[0]?.message;
      if (!eleccion) break;

      messages.push(eleccion);

      if (Array.isArray(eleccion.tool_calls) && eleccion.tool_calls.length > 0) {
        for (const llamada of eleccion.tool_calls) {
          const resultado = await herramientas.ejecutar(
            llamada.function?.name,
            llamada.function?.arguments,
            turno
          );
          messages.push({
            role: 'tool',
            tool_call_id: llamada.id,
            content: JSON.stringify(resultado)
          });
        }
        continue;
      }

      const contenido = typeof eleccion.content === 'string' ? eleccion.content.trim() : '';
      if (contenido) return contenido;
      break;
    }

    // Se agotaron las iteraciones o el modelo no devolvió texto: el usuario
    // siempre recibe una respuesta.
    return turno.panelEnviado ? RESPUESTAS.panelEnviado : RESPUESTAS.sinRespuesta;
  }

  async function guardarEnHistorial(userId, role, contenido) {
    try {
      await historial.agregar(userId, role, contenido);
    } catch (error) {
      log.error('No se pudo guardar el historial:', error.message);
    }
  }

  return {
    /**
     * Atiende un mensaje de texto de un usuario y le responde por WhatsApp.
     * Nunca lanza: un fallo se registra y, si es posible, se avisa al usuario.
     * Devuelve el texto enviado (o null si solo se envió el botón del panel).
     */
    async atender({ user, text }) {
      const turno = { userId: user._id, panelEnviado: false };
      let respuesta;

      try {
        let previos = [];
        if (llm) {
          try {
            previos = await historial.ultimos(user._id, config.mensajesHistorial);
          } catch (error) {
            log.error('No se pudo leer el historial:', error.message);
          }
        }

        if (llm) {
          try {
            respuesta = await responderConLLM(text, previos, turno);
          } catch (error) {
            log.error('Error en agente LLM, se usa el modo de palabras clave:', error.message);
          }
        }

        if (respuesta === undefined) {
          const actual = (await usuarios.buscarPorId(user._id)) ?? user;
          respuesta = await responderPorPalabrasClave(actual, text, turno);
        }
      } catch (error) {
        log.error('Error atendiendo el mensaje:', error);
        respuesta = RESPUESTAS.error;
      }

      await guardarEnHistorial(user._id, 'user', text);

      if (respuesta === null) {
        await guardarEnHistorial(user._id, 'assistant', RESPUESTAS.panelEnviado);
        return null;
      }

      try {
        await mensajeria.enviarTexto(user.phone, respuesta);
        await guardarEnHistorial(user._id, 'assistant', respuesta);
      } catch (error) {
        // No se relanza: un fallo de envío no debe provocar que el proveedor
        // reintente el webhook y se repita todo el turno.
        log.error('No se pudo enviar la respuesta por WhatsApp:', error.message);
      }
      return respuesta;
    }
  };
}
