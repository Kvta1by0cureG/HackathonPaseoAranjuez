import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  crearValidarFirmaWebhook,
  crearVerificarWebhook,
  firmarCuerpo
} from '../src/middlewares/validateWebhook.js';
import { logSilencioso } from '../test-support/fakes.js';

const SECRETO = 'app-secret-de-prueba';

function respuestaFalsa() {
  return {
    codigo: null,
    cuerpo: undefined,
    set() { return this; },
    status(codigo) { this.codigo = codigo; return this; },
    send(cuerpo) { this.cuerpo = cuerpo; return this; },
    sendStatus(codigo) { this.codigo = codigo; return this; }
  };
}

function validar(firma, cuerpo = '{"a":1}', secreto = SECRETO) {
  const middleware = crearValidarFirmaWebhook({ appSecret: secreto, log: logSilencioso });
  const req = {
    headers: firma === undefined ? {} : { 'x-hub-signature-256': firma },
    rawBody: cuerpo === null ? undefined : Buffer.from(cuerpo)
  };
  const res = respuestaFalsa();
  let continuo = false;
  middleware(req, res, () => { continuo = true; });
  return { codigo: res.codigo, continuo };
}

describe('validarFirmaWebhook', () => {
  it('acepta una firma correcta', () => {
    const firma = firmarCuerpo(Buffer.from('{"a":1}'), SECRETO);
    assert.deepEqual(validar(firma), { codigo: null, continuo: true });
  });

  it('responde 403 (no 500) si la firma falta, está vacía o tiene otra longitud (S8)', () => {
    for (const firma of [undefined, '', 'sha256=abc', 'x'.repeat(500)]) {
      assert.deepEqual(validar(firma), { codigo: 403, continuo: false }, String(firma));
    }
  });

  it('responde 403 si la firma tiene la longitud correcta pero no coincide', () => {
    const firma = firmarCuerpo(Buffer.from('{"a":2}'), SECRETO);
    assert.deepEqual(validar(firma), { codigo: 403, continuo: false });
  });

  it('responde 403 si no hay cuerpo crudo y 503 si falta el secreto', () => {
    const firma = firmarCuerpo(Buffer.from('{"a":1}'), SECRETO);
    assert.equal(validar(firma, null).codigo, 403);
    assert.equal(validar(firma, '{"a":1}', '').codigo, 503);
  });
});

describe('verificarWebhook', () => {
  function verificar(query, verifyToken = 'token-verificacion') {
    const res = respuestaFalsa();
    crearVerificarWebhook({ verifyToken })({ query }, res);
    return res;
  }

  it('devuelve el challenge con el token correcto', () => {
    const res = verificar({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'token-verificacion',
      'hub.challenge': '12345'
    });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo, '12345');
  });

  it('responde 403 con token incorrecto, ausente o sin token configurado', () => {
    assert.equal(verificar({ 'hub.mode': 'subscribe', 'hub.verify_token': 'otro' }).codigo, 403);
    assert.equal(verificar({}).codigo, 403);
    assert.equal(verificar({ 'hub.mode': 'subscribe', 'hub.verify_token': '' }, '').codigo, 403);
  });
});
