// Pruebas de integración contra un MongoDB real. Comprueban lo que los dobles en
// memoria no pueden: índices únicos y operaciones atómicas bajo concurrencia.
//
// Solo se ejecutan si TEST_DATABASE_URL apunta a una base cuyo nombre termina
// en "_test" (se borran sus colecciones). Ejemplo:
//   TEST_DATABASE_URL=mongodb://127.0.0.1:27017/whatsapp_agent_test npm test
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { Catalog } from '../../src/models/Catalog.js';
import { Message } from '../../src/models/Message.js';
import { ProcessedMessage } from '../../src/models/ProcessedMessage.js';
import { ScoreMovement } from '../../src/models/ScoreMovement.js';
import { Session } from '../../src/models/Session.js';
import { User } from '../../src/models/User.js';
import { catalogoRepo } from '../../src/repositories/catalog.js';
import { historialRepo } from '../../src/repositories/messages.js';
import { movimientosRepo } from '../../src/repositories/movements.js';
import { procesadosRepo } from '../../src/repositories/processedMessages.js';
import { sesionesRepo } from '../../src/repositories/sessions.js';
import { usuariosRepo } from '../../src/repositories/users.js';

const URL_PRUEBAS = process.env.TEST_DATABASE_URL;
const MODELOS = [User, Catalog, Session, ScoreMovement, Message, ProcessedMessage];
const omitir = URL_PRUEBAS ? false : 'define TEST_DATABASE_URL para ejecutar las pruebas con MongoDB';

describe('repositorios sobre MongoDB', { skip: omitir }, () => {
  before(async () => {
    await mongoose.connect(URL_PRUEBAS, { serverSelectionTimeoutMS: 5000 });
    assert.match(
      mongoose.connection.name,
      /_test$/,
      'Por seguridad, la base de datos de pruebas debe terminar en "_test"'
    );
    // Los índices únicos deben existir antes de probar la concurrencia.
    await Promise.all(MODELOS.map((modelo) => modelo.init()));
  });

  beforeEach(async () => {
    await Promise.all(MODELOS.map((modelo) => modelo.deleteMany({})));
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it('crear usuarios en paralelo no genera duplicados (L12)', async () => {
    const usuarios = await Promise.all(
      Array.from({ length: 10 }, () => usuariosRepo.obtenerOCrearPorTelefono('59170000001', 'Ana'))
    );
    assert.equal(new Set(usuarios.map((u) => String(u._id))).size, 1);
    assert.equal(await User.countDocuments({}), 1);
    assert.equal(usuarios[0].name, 'Ana');
    assert.equal(usuarios[0].score, 0);
  });

  it('completa el nombre de un usuario que aún no lo tenía', async () => {
    await usuariosRepo.obtenerOCrearPorTelefono('59170000001');
    const user = await usuariosRepo.obtenerOCrearPorTelefono('59170000001', 'Ana');
    assert.equal(user.name, 'Ana');
    assert.equal((await usuariosRepo.obtenerOCrearPorTelefono('59170000001', 'Otro')).name, 'Ana');
  });

  it('las sumas simultáneas de puntos no se pierden (L9)', async () => {
    const user = await usuariosRepo.obtenerOCrearPorTelefono('59170000001');
    await Promise.all(Array.from({ length: 20 }, () => usuariosRepo.incrementarScore(user._id, 5)));
    assert.equal((await usuariosRepo.buscarPorId(user._id)).score, 100);
  });

  it('restar más puntos de los disponibles no modifica el score', async () => {
    const user = await usuariosRepo.obtenerOCrearPorTelefono('59170000001');
    await usuariosRepo.incrementarScore(user._id, 30);

    assert.equal(await usuariosRepo.incrementarScore(user._id, -31), null);
    assert.equal((await usuariosRepo.incrementarScore(user._id, -30)).score, 0);
    assert.equal(await usuariosRepo.incrementarScore('no-es-un-id', 5), null);
    assert.equal(await usuariosRepo.incrementarScore(user._id, 1.5), null);
  });

  it('un mensaje se registra como procesado una sola vez (L1, H1)', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => procesadosRepo.registrar('wamid.repetido'))
    );
    assert.equal(resultados.filter(Boolean).length, 1);
    assert.equal(await procesadosRepo.registrar('wamid.otro'), true);
  });

  it('un enlace solo se puede marcar como usado una vez (S3)', async () => {
    const user = await usuariosRepo.obtenerOCrearPorTelefono('59170000001');
    const ahora = new Date();
    const expiresAt = new Date(ahora.getTime() + 60000);
    await sesionesRepo.crear({ jti: 'jti-1', userId: user._id, expiresAt });
    await sesionesRepo.crear({ jti: 'jti-2', userId: user._id, expiresAt });

    assert.equal(await sesionesRepo.buscarActiva('jti-1', ahora), null);

    const canjes = await Promise.all(Array.from({ length: 5 }, () => sesionesRepo.marcarUsada('jti-1', ahora)));
    assert.equal(canjes.filter(Boolean).length, 1);
    assert.equal((await sesionesRepo.buscarActiva('jti-1', ahora)).jti, 'jti-1');

    await sesionesRepo.revocar('jti-1', ahora);
    assert.equal(await sesionesRepo.buscarActiva('jti-1', ahora), null);

    const despuesDeExpirar = new Date(expiresAt.getTime() + 1);
    assert.equal(await sesionesRepo.marcarUsada('jti-2', despuesDeExpirar), null);
  });

  it('el catálogo filtra por piso, omite inactivos y rechaza operadores (S7, D4)', async () => {
    await Catalog.insertMany([
      { name: 'Pan dulce', floor: 1, price: 15 },
      { name: 'Café Americano', floor: 1, price: 25 },
      { name: 'Retirado', floor: 1, price: 5, active: false },
      { name: 'Sándwich club', floor: 2, price: 65 },
      { name: 'Caviar Beluga', floor: 5, price: 1200 }
    ]);

    assert.deepEqual((await catalogoRepo.listarPorPiso(1)).map((i) => i.name), ['Café Americano', 'Pan dulce']);
    assert.deepEqual(
      (await catalogoRepo.listarHastaPiso(2)).map((i) => i.name),
      ['Café Americano', 'Pan dulce', 'Sándwich club']
    );
    await assert.rejects(catalogoRepo.listarPorPiso({ $gt: 0 }), TypeError);
    await assert.rejects(catalogoRepo.listarHastaPiso('5'), TypeError);

    const [cafe] = await catalogoRepo.listarPorPiso(1);
    assert.equal((await catalogoRepo.buscarActivoPorId(String(cafe._id))).name, 'Café Americano');
    assert.equal(await catalogoRepo.buscarActivoPorId({ $ne: null }), null);
    assert.equal(await catalogoRepo.buscarActivoPorId('abc'), null);
  });

  it('el historial devuelve los últimos mensajes en orden cronológico (L2)', async () => {
    const user = await usuariosRepo.obtenerOCrearPorTelefono('59170000001');
    for (const [role, content] of [['user', 'uno'], ['assistant', 'dos'], ['user', 'tres']]) {
      await historialRepo.agregar(user._id, role, content);
    }
    assert.deepEqual(await historialRepo.ultimos(user._id, 2), [
      { role: 'assistant', content: 'dos' },
      { role: 'user', content: 'tres' }
    ]);
  });

  it('los movimientos de puntos se guardan y solo admiten orígenes conocidos (L10)', async () => {
    const user = await usuariosRepo.obtenerOCrearPorTelefono('59170000001');
    await movimientosRepo.registrar({ userId: user._id, puntos: 10, scoreResultante: 10, origen: 'compra', motivo: 'A' });
    await movimientosRepo.registrar({ userId: user._id, puntos: -5, scoreResultante: 5, origen: 'ajuste_admin', motivo: 'B' });

    const lista = await movimientosRepo.listarPorUsuario(user._id);
    assert.deepEqual(lista.map((m) => m.motivo).sort(), ['A', 'B']);
    await assert.rejects(
      movimientosRepo.registrar({ userId: user._id, puntos: 1, scoreResultante: 1, origen: 'llm' })
    );
  });
});
