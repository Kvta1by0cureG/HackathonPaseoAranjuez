import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearEntorno } from '../test-support/entorno.js';

function preparar(score = 120) {
  const entorno = crearEntorno({ usuariosIniciales: [{ phone: '59170000001', name: 'Ana', score }] });
  const [user] = entorno.repos.usuarios.todos();
  const turno = { userId: user._id, panelEnviado: false };
  return { ...entorno, user, turno };
}

describe('herramientas del agente', () => {
  it('no expone ninguna herramienta que modifique puntos (S1)', () => {
    const { herramientas } = preparar();
    const nombres = herramientas.definiciones.map((d) => d.function.name);
    assert.deepEqual(nombres, ['getUserScore', 'getProgress', 'getCatalogByFloor', 'sendPanelLink']);
  });

  it('updateScore ya no existe: pedirla no cambia el score (S1)', async () => {
    const { herramientas, turno, repos, user } = preparar(5);
    const resultado = await herramientas.ejecutar('updateScore', '{"puntos":5000}', turno);
    assert.match(resultado.error, /no disponible/);
    assert.equal((await repos.usuarios.buscarPorId(user._id)).score, 5);
  });

  it('getUserScore calcula el piso a partir del score (D1)', async () => {
    const { herramientas, turno } = preparar(350);
    assert.deepEqual(await herramientas.ejecutar('getUserScore', '{}', turno), {
      name: 'Ana', score: 350, floor: 3, nivel: 'Oro'
    });
  });

  it('getProgress indica lo que falta para subir (L5)', async () => {
    const { herramientas, turno } = preparar(120);
    const resultado = await herramientas.ejecutar('getProgress', '', turno);
    assert.equal(resultado.faltan, 180);
    assert.equal(resultado.siguiente, 'Oro');
    assert.equal(resultado.score, 120);
  });

  it('getCatalogByFloor rechaza operadores de Mongo y valores no enteros (S7)', async () => {
    const { herramientas, turno } = preparar(120);
    for (const floor of [{ $gt: 0 }, '2', 1.5, 0, 99, [1]]) {
      const resultado = await herramientas.ejecutar('getCatalogByFloor', JSON.stringify({ floor }), turno);
      assert.match(resultado.error, /entero válido/, JSON.stringify(floor));
      assert.equal(resultado.items, undefined);
    }
  });

  it('getCatalogByFloor no deja ver pisos bloqueados (S6)', async () => {
    const { herramientas, turno } = preparar(120); // piso 2
    const resultado = await herramientas.ejecutar('getCatalogByFloor', '{"floor":5}', turno);
    assert.match(resultado.error, /bloqueado/);
    assert.equal(resultado.pisoUsuario, 2);
    assert.equal(resultado.faltan, 880);
  });

  it('getCatalogByFloor sin piso devuelve los pisos desbloqueados, sin inactivos (D4)', async () => {
    const { herramientas, turno } = preparar(120);
    const { items, pisoUsuario } = await herramientas.ejecutar('getCatalogByFloor', '{}', turno);
    assert.equal(pisoUsuario, 2);
    assert.deepEqual(items.map((i) => i.name), ['Café Americano', 'Pan dulce', 'Sándwich club']);
    assert.deepEqual(Object.keys(items[0]), ['name', 'description', 'price', 'floor']);
  });

  it('usa el score actual del usuario en cada llamada (L8)', async () => {
    const { herramientas, turno, repos, user } = preparar(50);
    assert.equal((await herramientas.ejecutar('getCatalogByFloor', '{}', turno)).pisoUsuario, 1);
    await repos.usuarios.incrementarScore(user._id, 300);
    assert.equal((await herramientas.ejecutar('getCatalogByFloor', '{}', turno)).pisoUsuario, 3);
  });

  it('sendPanelLink envía un solo botón por turno (L3)', async () => {
    const { herramientas, turno, whatsapp, config } = preparar();
    assert.deepEqual(await herramientas.ejecutar('sendPanelLink', '{}', turno), { enviado: true });
    await herramientas.ejecutar('sendPanelLink', '{}', turno);

    assert.equal(whatsapp.total, 1);
    const { url } = whatsapp.enviados[0].interactive.action.parameters;
    assert.ok(url.startsWith(`${config.webapp.url}/?token=`));
    assert.equal(whatsapp.enviados[0].to, '59170000001');
  });

  it('devuelve un error controlado con argumentos que no son JSON', async () => {
    const { herramientas, turno } = preparar();
    for (const crudo of ['{no json', '[1,2]', '"texto"', 'null']) {
      const resultado = await herramientas.ejecutar('getCatalogByFloor', crudo, turno);
      assert.match(resultado.error, /Argumentos inválidos/, crudo);
    }
  });

  it('devuelve un error si el usuario ya no existe', async () => {
    const { herramientas } = preparar();
    const resultado = await herramientas.ejecutar('getUserScore', '{}', { userId: 'f'.repeat(24) });
    assert.deepEqual(resultado, { error: 'Usuario no encontrado' });
  });
});
