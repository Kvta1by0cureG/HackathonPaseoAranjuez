import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  crearClienteWhatsApp,
  crearClienteWhatsAppMock,
  cuerpoPlantilla
} from '../src/services/whatsapp.js';
import { logSilencioso } from '../test-support/fakes.js';

const CONFIG = { token: 'TOKEN', phoneId: '123', apiVersion: 'v21.0', templateLang: 'es' };

function fetchFalso(respuesta = { ok: true, status: 200, cuerpo: { messages: [{ id: 'wamid.1' }] } }) {
  const llamadas = [];
  const fetchImpl = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    return {
      ok: respuesta.ok,
      status: respuesta.status,
      json: async () => respuesta.cuerpo
    };
  };
  return { fetchImpl, llamadas };
}

describe('cuerpoPlantilla (H2)', () => {
  it('omite components cuando no hay parámetros', () => {
    const cuerpo = cuerpoPlantilla('59170000000', 'bienvenida');
    assert.equal('components' in cuerpo.template, false);
    assert.deepEqual(cuerpo.template.language, { code: 'es' });
  });

  it('incluye los parámetros y el idioma indicado', () => {
    const cuerpo = cuerpoPlantilla('59170000000', 'aviso', { parametros: ['Ana', 5], idioma: 'en_US' });
    assert.deepEqual(cuerpo.template.language, { code: 'en_US' });
    assert.deepEqual(cuerpo.template.components, [{
      type: 'body',
      parameters: [{ type: 'text', text: 'Ana' }, { type: 'text', text: '5' }]
    }]);
  });
});

describe('cliente real de WhatsApp', () => {
  it('envía texto a la URL de la Cloud API con el token', async () => {
    const { fetchImpl, llamadas } = fetchFalso();
    const cliente = crearClienteWhatsApp(CONFIG, { fetch: fetchImpl, log: logSilencioso });

    await cliente.enviarTexto('59170000000', 'hola');

    assert.equal(llamadas[0].url, 'https://graph.facebook.com/v21.0/123/messages');
    assert.equal(llamadas[0].opciones.headers.Authorization, 'Bearer TOKEN');
    assert.deepEqual(llamadas[0].cuerpo, {
      messaging_product: 'whatsapp',
      to: '59170000000',
      type: 'text',
      text: { body: 'hola' }
    });
  });

  it('recorta los textos que superan el máximo de WhatsApp', async () => {
    const { fetchImpl, llamadas } = fetchFalso();
    const cliente = crearClienteWhatsApp(CONFIG, { fetch: fetchImpl, log: logSilencioso });
    await cliente.enviarTexto('59170000000', 'a'.repeat(5000));
    assert.equal(llamadas[0].cuerpo.text.body.length, 4096);
  });

  it('usa el idioma configurado en las plantillas y permite cambiarlo', async () => {
    const { fetchImpl, llamadas } = fetchFalso();
    const cliente = crearClienteWhatsApp({ ...CONFIG, templateLang: 'es_MX' }, { fetch: fetchImpl, log: logSilencioso });
    await cliente.enviarPlantilla('59170000000', 'promo');
    await cliente.enviarPlantilla('59170000000', 'promo', { idioma: 'en' });
    assert.equal(llamadas[0].cuerpo.template.language.code, 'es_MX');
    assert.equal(llamadas[1].cuerpo.template.language.code, 'en');
  });

  it('lanza el mensaje de error de Meta', async () => {
    const { fetchImpl } = fetchFalso({ ok: false, status: 400, cuerpo: { error: { message: 'Invalid parameter' } } });
    const cliente = crearClienteWhatsApp(CONFIG, { fetch: fetchImpl, log: logSilencioso });
    await assert.rejects(cliente.enviarTexto('59170000000', 'hola'), /Invalid parameter/);
  });
});

describe('cliente simulado de WhatsApp (A4)', () => {
  it('guarda los mensajes sin llamar a la red', async () => {
    const cliente = crearClienteWhatsAppMock({}, { log: logSilencioso });
    await cliente.enviarTexto('59170000000', 'hola');
    await cliente.enviarBotonUrl('59170000000', 'Abre', 'Abrir mi panel', 'http://localhost:5173/?token=x');

    assert.equal(cliente.modo, 'mock');
    assert.equal(cliente.total, 2);
    assert.equal(cliente.enviados[0].text.body, 'hola');
    assert.equal(cliente.enviados[1].interactive.action.parameters.url, 'http://localhost:5173/?token=x');
  });
});
