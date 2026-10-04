import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AVISOS, extraerMensajes } from '../src/services/inbound.js';
import { crearEntorno } from '../test-support/entorno.js';
import { crearLLMFake } from '../test-support/fakes.js';

const TELEFONO = '59170000001';

function mensaje(id, extra = { type: 'text', text: { body: 'score' } }, from = TELEFONO) {
  return { id, from, ...extra };
}

function payload(mensajes, nombre = 'Ana') {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          contacts: [{ wa_id: mensajes[0]?.from ?? TELEFONO, profile: { name: nombre } }],
          messages: mensajes
        }
      }]
    }]
  };
}

const textos = (entorno) => entorno.whatsapp.enviados.map((m) => m.text?.body);

describe('extraerMensajes', () => {
  it('extrae todos los mensajes de todas las entradas y cambios (H1)', () => {
    const body = {
      entry: [
        { changes: [{ value: { messages: [mensaje('a'), mensaje('b')] } }, { value: { messages: [mensaje('c')] } }] },
        { changes: [{ value: { messages: [mensaje('d')] } }] }
      ]
    };
    assert.deepEqual(extraerMensajes(body).map((m) => m.id), ['a', 'b', 'c', 'd']);
  });

  it('lee texto, botones y respuestas interactivas', () => {
    const body = payload([
      mensaje('1', { type: 'text', text: { body: '  hola  ' } }),
      mensaje('2', { type: 'button', button: { text: 'Ver panel' } }),
      mensaje('3', { type: 'interactive', interactive: { button_reply: { title: 'Catálogo' } } }),
      mensaje('4', { type: 'audio', audio: { id: 'x' } })
    ]);
    assert.deepEqual(extraerMensajes(body).map((m) => [m.type, m.text]), [
      ['text', 'hola'], ['button', 'Ver panel'], ['interactive', 'Catálogo'], ['audio', '']
    ]);
  });

  it('ignora estados de entrega y payloads mal formados', () => {
    assert.deepEqual(extraerMensajes({ entry: [{ changes: [{ value: { statuses: [{ id: 'x' }] } }] }] }), []);
    for (const body of [undefined, null, {}, { entry: 'x' }, { entry: [{ changes: [{ value: { messages: [{}, { id: 1, from: 2 }, { id: 'a', from: 'no-es-telefono' }] } }] }] }]) {
      assert.deepEqual(extraerMensajes(body), []);
    }
  });
});

describe('procesador de mensajes entrantes', () => {
  it('crea el usuario y responde', async () => {
    const entorno = crearEntorno();
    const resultados = await entorno.servicios.procesador.procesarPayload(payload([mensaje('m1')]));

    assert.deepEqual(resultados, ['atendido']);
    assert.deepEqual(entorno.repos.usuarios.todos().map((u) => [u.phone, u.name, u.score]), [[TELEFONO, 'Ana', 0]]);
    assert.deepEqual(textos(entorno), ['Tu score es 0 y estás en el Piso 1 · Bronce.']);
  });

  it('un mensaje reenviado por el proveedor se procesa una sola vez (L1, H1)', async () => {
    const entorno = crearEntorno();
    const { procesador } = entorno.servicios;

    assert.deepEqual(await procesador.procesarPayload(payload([mensaje('m1')])), ['atendido']);
    assert.deepEqual(await procesador.procesarPayload(payload([mensaje('m1')])), ['duplicado']);
    assert.deepEqual(await procesador.procesarPayload(payload([mensaje('m1'), mensaje('m1')])), ['duplicado', 'duplicado']);
    assert.equal(entorno.whatsapp.total, 1);
  });

  it('procesa todos los mensajes del payload, en orden (H1)', async () => {
    const llm = crearLLMFake([{ role: 'assistant', content: 'ok' }]);
    const entorno = crearEntorno({ llm });
    const resultados = await entorno.servicios.procesador.procesarPayload(payload([
      mensaje('m1', { type: 'text', text: { body: 'uno' } }),
      mensaje('m2', { type: 'text', text: { body: 'dos' } }),
      mensaje('m3', { type: 'text', text: { body: 'tres' } })
    ]));

    assert.deepEqual(resultados, ['atendido', 'atendido', 'atendido']);
    assert.deepEqual(llm.llamadas.map((l) => l.messages.at(-1).content), ['uno', 'dos', 'tres']);
    assert.equal(entorno.repos.usuarios.todos().length, 1);
  });

  it('los mensajes sin texto no llegan al LLM: se avisa al usuario (L7)', async () => {
    const llm = crearLLMFake([{ role: 'assistant', content: 'ok' }]);
    const entorno = crearEntorno({ llm });
    const resultados = await entorno.servicios.procesador.procesarPayload(payload([
      mensaje('m1', { type: 'audio', audio: { id: 'x' } }),
      mensaje('m2', { type: 'image', image: { id: 'y' } }),
      mensaje('m3', { type: 'text', text: { body: '   ' } })
    ]));

    assert.deepEqual(resultados, ['no_texto', 'no_texto', 'no_texto']);
    assert.equal(llm.llamadas.length, 0);
    assert.deepEqual(textos(entorno), [AVISOS.soloTexto, AVISOS.soloTexto, AVISOS.soloTexto]);
  });

  it('aplica el tope de mensajes por usuario y avisa una sola vez (S5)', async () => {
    const llm = crearLLMFake([{ role: 'assistant', content: 'ok' }]);
    const entorno = crearEntorno({ llm, env: { MAX_MENSAJES_POR_MINUTO: '3' } });
    const mensajes = Array.from({ length: 6 }, (_, i) => mensaje(`m${i}`));
    const resultados = await entorno.servicios.procesador.procesarPayload(payload(mensajes));

    assert.deepEqual(resultados, ['atendido', 'atendido', 'atendido', 'limitado', 'limitado', 'limitado']);
    assert.equal(llm.llamadas.length, 3);
    assert.deepEqual(textos(entorno).filter((t) => t === AVISOS.demasiadosMensajes).length, 1);

    const otro = await entorno.servicios.procesador.procesarPayload(payload([mensaje('x1', undefined, '59170000002')]));
    assert.deepEqual(otro, ['atendido']);
  });

  it('recorta los mensajes muy largos antes de enviarlos al LLM', async () => {
    const llm = crearLLMFake([{ role: 'assistant', content: 'ok' }]);
    const entorno = crearEntorno({ llm });
    await entorno.servicios.procesador.procesarPayload(
      payload([mensaje('m1', { type: 'text', text: { body: 'a'.repeat(10000) } })])
    );
    assert.equal(llm.llamadas[0].messages.at(-1).content.length, 2000);
  });

  it('un error con un mensaje no impide procesar los siguientes', async () => {
    const entorno = crearEntorno();
    const original = entorno.repos.usuarios.obtenerOCrearPorTelefono;
    let fallos = 0;
    entorno.repos.usuarios.obtenerOCrearPorTelefono = async (...args) => {
      if (fallos++ === 0) throw new Error('BD caída');
      return original(...args);
    };

    const resultados = await entorno.servicios.procesador.procesarPayload(payload([mensaje('m1'), mensaje('m2')]));
    assert.deepEqual(resultados, ['error', 'atendido']);
  });

  it('guarda el nombre del contacto si el usuario aún no lo tenía', async () => {
    const entorno = crearEntorno({ usuariosIniciales: [{ phone: TELEFONO, name: '', score: 10 }] });
    await entorno.servicios.procesador.procesarPayload(payload([mensaje('m1')], 'Ana María'));
    assert.equal(entorno.repos.usuarios.todos()[0].name, 'Ana María');
  });
});
