import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ScoreError } from '../src/services/scoreService.js';
import { crearEntorno } from '../test-support/entorno.js';

const TELEFONO = '59170000001';

function preparar(score = 0) {
  const entorno = crearEntorno({ usuariosIniciales: [{ phone: TELEFONO, name: 'Ana', score }] });
  const producto = (nombre) => entorno.repos.catalogoRepo.items.find((i) => i.name === nombre);
  return { ...entorno, score: entorno.servicios.score, producto };
}

const rechaza = (promesa, status) => assert.rejects(promesa, (error) => {
  assert.ok(error instanceof ScoreError, error.message);
  assert.equal(error.status, status);
  return true;
});

describe('servicio de puntos', () => {
  it('una compra otorga puntos y deja un movimiento de auditoría (D5, L10)', async () => {
    const { score, producto, repos } = preparar(95);
    const resultado = await score.registrarCompra({
      telefono: TELEFONO,
      productoId: producto('Café Americano')._id,
      cantidad: 4
    });

    assert.equal(resultado.importe, 100);
    assert.equal(resultado.puntos, 10);
    assert.equal(resultado.score, 105);
    assert.equal(resultado.floor, 2);

    assert.equal(repos.movimientos.lista.length, 1);
    const [movimiento] = repos.movimientos.lista;
    assert.equal(movimiento.origen, 'compra');
    assert.equal(movimiento.puntos, 10);
    assert.equal(movimiento.scoreResultante, 105);
    assert.equal(movimiento.motivo, 'Compra: 4 × Café Americano');
    assert.deepEqual(movimiento.detalle, {
      productoId: producto('Café Americano')._id, cantidad: 4, importe: 100
    });
  });

  it('no permite comprar productos de un piso bloqueado ni inactivos', async () => {
    const { score, producto } = preparar(0);
    await rechaza(score.registrarCompra({ telefono: TELEFONO, productoId: producto('Caviar Beluga')._id }), 403);
    await rechaza(score.registrarCompra({ telefono: TELEFONO, productoId: producto('Producto retirado')._id }), 404);
  });

  it('valida la cantidad, el producto y el usuario', async () => {
    const { score, producto } = preparar(0);
    const productoId = producto('Pan dulce')._id;
    for (const cantidad of [0, -1, 1.5, '2', 101]) {
      await rechaza(score.registrarCompra({ telefono: TELEFONO, productoId, cantidad }), 400);
    }
    await rechaza(score.registrarCompra({ telefono: TELEFONO, productoId: 'f'.repeat(24) }), 404);
    await rechaza(score.registrarCompra({ telefono: '59179999999', productoId }), 404);
  });

  it('una compra que no alcanza un punto no genera movimiento', async () => {
    const { score, repos } = preparar(0);
    repos.catalogoRepo.items.push({ _id: 'a'.repeat(24), name: 'Chicle', floor: 1, price: 5, active: true });

    const resultado = await score.registrarCompra({ telefono: TELEFONO, productoId: 'a'.repeat(24) });
    assert.equal(resultado.puntos, 0);
    assert.equal(resultado.score, 0);
    assert.equal(resultado.movimientoId, null);
    assert.equal(repos.movimientos.lista.length, 0);
  });

  it('los puntos de una compra se redondean hacia abajo', async () => {
    const { score, producto } = preparar(0);
    const resultado = await score.registrarCompra({ telefono: TELEFONO, productoId: producto('Pan dulce')._id });
    assert.equal(resultado.importe, 15);
    assert.equal(resultado.puntos, 1);
  });

  it('el ajuste manual exige motivo, entero distinto de cero y un tope', async () => {
    const { score } = preparar(50);
    await rechaza(score.ajustar({ telefono: TELEFONO, puntos: 10, motivo: '' }), 400);
    await rechaza(score.ajustar({ telefono: TELEFONO, puntos: 10 }), 400);
    for (const puntos of [0, 1.5, 'abc', NaN, 100001, -100001]) {
      await rechaza(score.ajustar({ telefono: TELEFONO, puntos, motivo: 'prueba' }), 400);
    }
  });

  it('el ajuste manual suma, resta y queda auditado', async () => {
    const { score, repos } = preparar(50);
    assert.equal((await score.ajustar({ telefono: TELEFONO, puntos: 100, motivo: 'Promoción' })).score, 150);
    assert.equal((await score.ajustar({ telefono: TELEFONO, puntos: -30, motivo: 'Corrección' })).score, 120);
    assert.deepEqual(repos.movimientos.lista.map((m) => [m.origen, m.puntos, m.scoreResultante, m.motivo]), [
      ['ajuste_admin', 100, 150, 'Promoción'],
      ['ajuste_admin', -30, 120, 'Corrección']
    ]);
  });

  it('no deja el score en negativo: restar más del saldo responde 409', async () => {
    const { score, repos } = preparar(50);
    await rechaza(score.ajustar({ telefono: TELEFONO, puntos: -51, motivo: 'Corrección' }), 409);
    assert.equal(repos.usuarios.todos()[0].score, 50);
    assert.equal(repos.movimientos.lista.length, 0);
  });

  it('varias sumas a la vez se aplican todas (L9)', async () => {
    const { score, repos } = preparar(0);
    await Promise.all(
      Array.from({ length: 20 }, () => score.ajustar({ telefono: TELEFONO, puntos: 5, motivo: 'lote' }))
    );
    assert.equal(repos.usuarios.todos()[0].score, 100);
    assert.equal(repos.movimientos.lista.length, 20);
  });
});
