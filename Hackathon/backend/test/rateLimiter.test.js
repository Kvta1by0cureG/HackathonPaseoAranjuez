import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearLimitador } from '../src/utils/rateLimiter.js';

describe('crearLimitador', () => {
  it('permite hasta el límite y luego bloquea', () => {
    let reloj = 1000;
    const limitador = crearLimitador({ limite: 3, ventanaMs: 60000, ahora: () => reloj });

    assert.deepEqual(
      [1, 2, 3, 4, 5].map(() => limitador.consumir('a').permitido),
      [true, true, true, false, false]
    );
    reloj += 59999;
    assert.equal(limitador.consumir('a').permitido, false);
  });

  it('marca solo el primer exceso de cada ventana', () => {
    const limitador = crearLimitador({ limite: 1, ventanaMs: 1000, ahora: () => 0 });
    assert.equal(limitador.consumir('a').primerExceso, false);
    assert.equal(limitador.consumir('a').primerExceso, true);
    assert.equal(limitador.consumir('a').primerExceso, false);
  });

  it('reinicia al terminar la ventana y separa las claves', () => {
    let reloj = 0;
    const limitador = crearLimitador({ limite: 1, ventanaMs: 1000, ahora: () => reloj });

    assert.equal(limitador.consumir('a').permitido, true);
    assert.equal(limitador.consumir('b').permitido, true);
    assert.equal(limitador.consumir('a').permitido, false);
    reloj = 1000;
    const consumo = limitador.consumir('a');
    assert.equal(consumo.permitido, true);
    assert.equal(consumo.restantes, 0);
    assert.equal(consumo.reinicioEnMs, 1000);
  });

  it('descarta las ventanas vencidas para no crecer sin límite', () => {
    let reloj = 0;
    const limitador = crearLimitador({ limite: 5, ventanaMs: 10, ahora: () => reloj });
    for (let i = 0; i < 400; i++) limitador.consumir(`clave-${i}`);
    reloj = 100;
    for (let i = 0; i < 200; i++) limitador.consumir('otra');
    assert.ok(limitador.claves < 50, `quedan ${limitador.claves} claves`);
  });

  it('valida sus parámetros', () => {
    assert.throws(() => crearLimitador({ limite: 0, ventanaMs: 1000 }), TypeError);
    assert.throws(() => crearLimitador({ limite: 1, ventanaMs: 0 }), TypeError);
  });
});
