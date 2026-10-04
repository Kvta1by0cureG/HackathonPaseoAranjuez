import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectarIntencion, extraerPiso } from '../src/services/intents.js';

describe('detectarIntencion', () => {
  it('prioriza la intención sobre el orden de las palabras (L4)', () => {
    assert.equal(detectarIntencion('quiero ver mi panel con mis puntos'), 'panel');
    assert.equal(detectarIntencion('mándame el link de la web con los productos'), 'panel');
  });

  it('entiende las preguntas de progreso (L5)', () => {
    assert.equal(detectarIntencion('cuánto me falta para subir de nivel'), 'progreso');
    assert.equal(detectarIntencion('¿Cuántos puntos me faltan?'), 'progreso');
  });

  it('compara palabras completas, no subcadenas (L4)', () => {
    assert.equal(detectarIntencion('me apunté a un webinar'), null);
    assert.equal(detectarIntencion('la telaraña del sótano'), null);
  });

  it('ignora mayúsculas y acentos', () => {
    assert.equal(detectarIntencion('CATÁLOGO'), 'catalogo');
    assert.equal(detectarIntencion('catalogo'), 'catalogo');
    assert.equal(detectarIntencion('Mis Puntos'), 'score');
    assert.equal(detectarIntencion('¡Hola!'), 'saludo');
  });

  it('devuelve null si no reconoce nada', () => {
    assert.equal(detectarIntencion('asdf qwerty'), null);
    assert.equal(detectarIntencion(''), null);
    assert.equal(detectarIntencion(undefined), null);
  });
});

describe('extraerPiso', () => {
  it('lee el piso mencionado', () => {
    assert.equal(extraerPiso('productos del piso 2'), 2);
    assert.equal(extraerPiso('catálogo nivel 5'), 5);
  });

  it('ignora pisos inexistentes o ausentes', () => {
    assert.equal(extraerPiso('productos del piso 9'), null);
    assert.equal(extraerPiso('catálogo'), null);
  });
});
