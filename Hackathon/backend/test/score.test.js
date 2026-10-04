import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PISO_MAX,
  calcularPiso,
  esPisoValido,
  nombrePiso,
  progresoPiso,
  puntosParaPiso,
  puntosPorCompra,
  sumarScore
} from '../src/services/score.js';

describe('calcularPiso', () => {
  it('asigna el piso según los umbrales', () => {
    const casos = [[0, 1], [99, 1], [100, 2], [299, 2], [300, 3], [599, 3], [600, 4], [999, 4], [1000, 5], [50000, 5]];
    for (const [score, piso] of casos) assert.equal(calcularPiso(score), piso, `score ${score}`);
  });

  it('no deja huecos entre rangos con decimales (L13)', () => {
    assert.equal(calcularPiso(99.5), 1);
    assert.equal(calcularPiso(299.9), 2);
    assert.equal(calcularPiso(999.99), 4);
  });

  it('trata valores inválidos como score 0', () => {
    for (const valor of [undefined, null, NaN, 'abc', -10, Infinity]) {
      assert.equal(calcularPiso(valor), 1, String(valor));
    }
  });
});

describe('progresoPiso', () => {
  it('calcula lo que falta para el siguiente piso', () => {
    assert.deepEqual(progresoPiso(40), {
      floor: 1, label: 'Bronce', porcentaje: 40, faltan: 60, siguiente: 'Plata', siguientePiso: 2
    });
    assert.equal(progresoPiso(100).faltan, 200);
    assert.equal(progresoPiso(100).porcentaje, 0);
    assert.equal(progresoPiso(299).faltan, 1);
  });

  it('en el piso máximo no falta nada', () => {
    const progreso = progresoPiso(1500);
    assert.equal(progreso.floor, PISO_MAX);
    assert.equal(progreso.faltan, 0);
    assert.equal(progreso.porcentaje, 100);
    assert.equal(progreso.siguiente, null);
  });
});

describe('utilidades de piso', () => {
  it('esPisoValido solo acepta enteros existentes', () => {
    assert.equal(esPisoValido(1), true);
    assert.equal(esPisoValido(5), true);
    for (const valor of [0, 6, 1.5, '2', null, undefined, { $gt: 0 }]) {
      assert.equal(esPisoValido(valor), false, JSON.stringify(valor));
    }
  });

  it('puntosParaPiso y nombrePiso', () => {
    assert.equal(puntosParaPiso(40, 2), 60);
    assert.equal(puntosParaPiso(400, 2), 0);
    assert.equal(puntosParaPiso(0, 9), null);
    assert.equal(nombrePiso(2), 'Piso 2 · Plata');
  });
});

describe('sumarScore', () => {
  it('suma y resta sin bajar de 0', () => {
    assert.equal(sumarScore(10, 5), 15);
    assert.equal(sumarScore(10, -3), 7);
    assert.equal(sumarScore(10, -50), 0);
  });

  it('rechaza valores no enteros en vez de devolver NaN (L13)', () => {
    assert.throws(() => sumarScore(10, 'abc'), TypeError);
    assert.throws(() => sumarScore(10, 1.5), TypeError);
    assert.throws(() => sumarScore(undefined, 1), TypeError);
  });
});

describe('puntosPorCompra', () => {
  it('redondea hacia abajo', () => {
    assert.equal(puntosPorCompra(25, 0.1), 2);
    assert.equal(puntosPorCompra(30, 0.1), 3);
    assert.equal(puntosPorCompra(9, 0.1), 0);
    assert.equal(puntosPorCompra(2500, 0.1), 250);
  });

  it('rechaza importes o tasas inválidas', () => {
    assert.throws(() => puntosPorCompra(-1, 0.1), TypeError);
    assert.throws(() => puntosPorCompra(10, 0), TypeError);
    assert.throws(() => puntosPorCompra(NaN, 0.1), TypeError);
  });
});
