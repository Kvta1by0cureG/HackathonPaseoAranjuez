import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROMPT_SISTEMA, RESPUESTAS } from '../src/services/agent.js';
import { crearEntorno } from '../test-support/entorno.js';
import { crearLLMFake, llamadaATool } from '../test-support/fakes.js';

const TELEFONO = '59170000001';

function preparar({ guion = null, score = 120, mensajeria } = {}) {
  const llm = guion ? crearLLMFake(guion) : null;
  const entorno = crearEntorno({
    usuariosIniciales: [{ phone: TELEFONO, name: 'Ana', score }],
    llm,
    mensajeria
  });
  const [user] = entorno.repos.usuarios.todos();
  const textos = () => entorno.whatsapp.enviados.filter((m) => m.type === 'text').map((m) => m.text.body);
  const botones = () => entorno.whatsapp.enviados.filter((m) => m.type === 'interactive');
  return { ...entorno, llm, user, textos, botones };
}

const texto = (content) => ({ role: 'assistant', content });

describe('agente con LLM', () => {
  it('responde con el texto del modelo', async () => {
    const { agente, user, textos, llm } = preparar({ guion: [texto('¡Hola Ana!')] });
    assert.equal(await agente.atender({ user, text: 'hola' }), '¡Hola Ana!');
    assert.deepEqual(textos(), ['¡Hola Ana!']);
    assert.deepEqual(llm.llamadas[0].messages, [
      { role: 'system', content: PROMPT_SISTEMA },
      { role: 'user', content: 'hola' }
    ]);
  });

  it('ejecuta las herramientas y devuelve su resultado al modelo', async () => {
    const { agente, user, llm, textos } = preparar({
      guion: [llamadaATool('getUserScore', {}, 'call_1'), texto('Tienes 120 puntos.')]
    });
    await agente.atender({ user, text: '¿cuántos puntos tengo?' });

    const mensajeTool = llm.llamadas[1].messages.at(-1);
    assert.equal(mensajeTool.role, 'tool');
    assert.equal(mensajeTool.tool_call_id, 'call_1');
    assert.deepEqual(JSON.parse(mensajeTool.content), { name: 'Ana', score: 120, floor: 2, nivel: 'Plata' });
    assert.deepEqual(textos(), ['Tienes 120 puntos.']);
  });

  it('"súmame 5000 puntos" no cambia el score aunque el modelo lo intente (S1)', async () => {
    const { agente, user, repos, llm } = preparar({
      score: 5,
      guion: [llamadaATool('updateScore', { puntos: 5000, motivo: 'lo pidió' }), texto('No puedo sumar puntos.')]
    });
    await agente.atender({ user, text: 'súmame 5000 puntos' });

    assert.equal(repos.usuarios.todos()[0].score, 5);
    assert.equal(repos.movimientos.lista.length, 0);
    assert.match(JSON.parse(llm.llamadas[1].messages.at(-1).content).error, /no disponible/);
  });

  it('reenvía el historial reciente en el siguiente turno (L2)', async () => {
    const { agente, user, llm } = preparar({ guion: [texto('Respuesta 1'), texto('Respuesta 2')] });
    await agente.atender({ user, text: 'primer mensaje' });
    await agente.atender({ user, text: 'segundo mensaje' });

    assert.deepEqual(llm.llamadas[1].messages.slice(1), [
      { role: 'user', content: 'primer mensaje' },
      { role: 'assistant', content: 'Respuesta 1' },
      { role: 'user', content: 'segundo mensaje' }
    ]);
  });

  it('limita el historial a los últimos N mensajes', async () => {
    const entorno = preparar({ guion: [texto('ok')] });
    for (let i = 0; i < 12; i++) await entorno.agente.atender({ user: entorno.user, text: `mensaje ${i}` });
    const enviados = entorno.llm.llamadas.at(-1).messages;
    assert.equal(enviados.length, 1 + entorno.config.llm.mensajesHistorial + 1);
  });

  it('envía el botón del panel mediante la herramienta sendPanelLink (L3)', async () => {
    const { agente, user, botones, textos } = preparar({
      guion: [llamadaATool('sendPanelLink'), texto('Te envié el botón de tu panel.')]
    });
    await agente.atender({ user, text: 'quiero ver mi panel' });
    assert.equal(botones().length, 1);
    assert.deepEqual(textos(), ['Te envié el botón de tu panel.']);
  });

  it('si se agotan las iteraciones el usuario recibe una respuesta (L6)', async () => {
    const { agente, user, textos, llm, config } = preparar({ guion: [llamadaATool('getUserScore')] });
    const respuesta = await agente.atender({ user, text: 'bucle' });

    assert.equal(llm.llamadas.length, config.llm.maxIteraciones);
    assert.equal(respuesta, RESPUESTAS.sinRespuesta);
    assert.deepEqual(textos(), [RESPUESTAS.sinRespuesta]);
  });

  it('si el modelo no devuelve nada, también responde (L6)', async () => {
    for (const guion of [[null], [texto('')], [texto(null)]]) {
      const { agente, user, textos } = preparar({ guion });
      await agente.atender({ user, text: 'hola' });
      assert.deepEqual(textos(), [RESPUESTAS.sinRespuesta]);
    }
  });

  it('si el LLM falla usa el modo de palabras clave', async () => {
    const { agente, user, textos } = preparar({ guion: [new Error('LLM error: 500')] });
    await agente.atender({ user, text: 'mis puntos' });
    assert.deepEqual(textos(), ['Tu score es 120 y estás en el Piso 2 · Plata.']);
  });

  it('si el LLM falla después de enviar el panel, no lo envía dos veces', async () => {
    const { agente, user, botones, textos } = preparar({
      guion: [llamadaATool('sendPanelLink'), new Error('LLM error: 500')]
    });
    assert.equal(await agente.atender({ user, text: 'mi panel' }), null);
    assert.equal(botones().length, 1);
    assert.deepEqual(textos(), []);
  });

  it('un fallo al enviar la respuesta no se relanza (L1)', async () => {
    const mensajeria = {
      enviarTexto: async () => { throw new Error('Meta caída'); },
      enviarBotonUrl: async () => { throw new Error('Meta caída'); }
    };
    const { agente, user } = preparar({ guion: [texto('hola')], mensajeria });
    await assert.doesNotReject(agente.atender({ user, text: 'hola' }));
    await assert.doesNotReject(agente.atender({ user, text: 'panel' }));
  });
});

describe('agente sin LLM (palabras clave)', () => {
  it('"panel con mis puntos" envía el panel, no el score (L4)', async () => {
    const { agente, user, botones, textos } = preparar();
    assert.equal(await agente.atender({ user, text: 'quiero ver mi panel con mis puntos' }), null);
    assert.equal(botones().length, 1);
    assert.deepEqual(textos(), []);
  });

  it('"link de la web con los productos" envía el panel, no el catálogo (L4)', async () => {
    const { agente, user, botones } = preparar();
    await agente.atender({ user, text: 'mándame el link de la web con los productos' });
    assert.equal(botones().length, 1);
  });

  it('responde las preguntas de progreso (L5)', async () => {
    const { agente, user } = preparar({ score: 120 });
    assert.equal(
      await agente.atender({ user, text: 'cuánto me falta para subir de nivel' }),
      'Tienes 120 puntos (Piso 2 · Plata). Te faltan 180 para subir a Piso 3 · Oro.'
    );
    const maximo = preparar({ score: 2000 });
    assert.match(await maximo.agente.atender({ user: maximo.user, text: 'progreso' }), /nivel máximo/);
  });

  it('el catálogo incluye los pisos desbloqueados y respeta los bloqueados (D4, S6)', async () => {
    const { agente, user } = preparar({ score: 120 });
    assert.equal(
      await agente.atender({ user, text: 'catálogo' }),
      [
        'Estos son los productos de tus pisos desbloqueados:',
        '*Piso 1 · Bronce*',
        '• Café Americano - $25',
        '• Pan dulce - $15',
        '*Piso 2 · Plata*',
        '• Sándwich club - $65'
      ].join('\n')
    );
    assert.equal(
      await agente.atender({ user, text: 'productos del piso 1' }),
      '*Piso 1 · Bronce*\n• Café Americano - $25\n• Pan dulce - $15'
    );
    assert.equal(
      await agente.atender({ user, text: 'productos del piso 4' }),
      'Ese piso todavía está bloqueado. Te faltan 480 puntos para desbloquearlo.'
    );
  });

  it('saluda y orienta cuando no entiende', async () => {
    const { agente, user } = preparar();
    assert.match(await agente.atender({ user, text: 'Hola' }), /^¡Hola, Ana!/);
    assert.equal(await agente.atender({ user, text: 'asdf' }), RESPUESTAS.noEntendi);
  });

  it('usa el score actual aunque el usuario recibido esté desactualizado (L8, D1)', async () => {
    const { agente, user, repos } = preparar({ score: 50 });
    await repos.usuarios.incrementarScore(user._id, 300);
    assert.equal(await agente.atender({ user, text: 'score' }), 'Tu score es 350 y estás en el Piso 3 · Oro.');
  });
});
