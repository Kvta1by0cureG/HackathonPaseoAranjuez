import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, cargarConfig, parsearDuracion, validarConfig } from '../src/config/env.js';

const BASE = {
  DATABASE_URL: 'mongodb://127.0.0.1:27017/app',
  JWT_SECRET: 'x'.repeat(48),
  WHATSAPP_TOKEN: 't',
  WHATSAPP_PHONE_ID: 'p',
  WHATSAPP_VERIFY_TOKEN: 'v',
  WHATSAPP_APP_SECRET: 's',
  LLM_API_KEY: 'k',
  ADMIN_API_KEY: 'a'.repeat(32)
};

function errores(env, secciones) {
  try {
    validarConfig(cargarConfig(env), secciones);
    return [];
  } catch (error) {
    assert.ok(error instanceof ConfigError);
    return error.errores;
  }
}

describe('cargarConfig', () => {
  it('define la URL base del LLM con valor por defecto (A2)', () => {
    assert.equal(cargarConfig(BASE).llm.baseUrl, 'https://api.openai.com/v1');
    assert.equal(
      cargarConfig({ ...BASE, LLM_BASE_URL: 'https://llm.ejemplo.com/v1/' }).llm.baseUrl,
      'https://llm.ejemplo.com/v1'
    );
  });

  it('convierte JWT_EXPIRES numérico a segundos (A6)', () => {
    assert.equal(cargarConfig({ ...BASE, JWT_EXPIRES: '900' }).jwt.expiresIn, 900);
    assert.equal(cargarConfig({ ...BASE, JWT_EXPIRES: '15m' }).jwt.expiresIn, '15m');
    assert.equal(cargarConfig(BASE).jwt.expiresIn, '15m');
  });

  it('parsearDuracion devuelve null con formatos inválidos', () => {
    assert.equal(parsearDuracion('quince minutos'), null);
    assert.equal(parsearDuracion('0'), null);
    assert.equal(parsearDuracion('2h'), '2h');
  });

  it('no usa ningún secreto JWT por defecto (S2)', () => {
    assert.equal(cargarConfig({}).jwt.secret, '');
  });

  it('usa WEBAPP_URL como origen CORS si no se indica otro', () => {
    const config = cargarConfig({ ...BASE, WEBAPP_URL: 'https://panel.ejemplo.com/' });
    assert.deepEqual(config.cors.origins, ['https://panel.ejemplo.com']);
    assert.deepEqual(
      cargarConfig({ ...BASE, CORS_ORIGINS: 'https://a.com, https://b.com' }).cors.origins,
      ['https://a.com', 'https://b.com']
    );
  });
});

describe('validarConfig', () => {
  it('acepta una configuración completa', () => {
    assert.deepEqual(validarConfig(cargarConfig(BASE)), []);
  });

  it('exige JWT_SECRET y rechaza el valor de ejemplo o uno corto (S2, A7)', () => {
    assert.match(errores({ ...BASE, JWT_SECRET: '' }).join(), /Falta JWT_SECRET/);
    assert.match(errores({ ...BASE, JWT_SECRET: 'cambia-esto-en-produccion' }).join(), /valor de ejemplo/);
    assert.match(errores({ ...BASE, JWT_SECRET: 'corto' }).join(), /al menos 32/);
  });

  it('exige las cuatro variables de WhatsApp, incluida APP_SECRET (A7)', () => {
    const lista = errores({ ...BASE, WHATSAPP_APP_SECRET: '', WHATSAPP_TOKEN: '' });
    assert.equal(lista.length, 1);
    assert.match(lista[0], /WHATSAPP_TOKEN, WHATSAPP_APP_SECRET/);
    assert.match(lista[0], /WHATSAPP_MOCK=true/);
  });

  it('el modo simulado no exige credenciales de WhatsApp (A4)', () => {
    const env = { DATABASE_URL: BASE.DATABASE_URL, JWT_SECRET: BASE.JWT_SECRET, WHATSAPP_MOCK: 'true' };
    const avisos = validarConfig(cargarConfig(env));
    assert.equal(avisos.length, 2); // faltan LLM_API_KEY y ADMIN_API_KEY: solo avisos
  });

  it('el modo simulado está prohibido en producción', () => {
    const lista = errores({ ...BASE, WHATSAPP_MOCK: 'true', NODE_ENV: 'production', WEBAPP_URL: 'https://p.com' });
    assert.match(lista.join(), /no está permitido/);
  });

  it('los scripts pueden validar solo la base de datos (A4)', () => {
    assert.deepEqual(validarConfig(cargarConfig({ DATABASE_URL: BASE.DATABASE_URL }), ['db']), []);
    assert.match(errores({}, ['db']).join(), /Falta DATABASE_URL/);
  });

  it('informa de todos los problemas a la vez', () => {
    assert.equal(errores({}).length, 3);
  });

  it('rechaza un JWT_EXPIRES inválido y exige WEBAPP_URL en producción', () => {
    assert.match(errores({ ...BASE, JWT_EXPIRES: 'mucho' }).join(), /JWT_EXPIRES/);
    assert.match(errores({ ...BASE, NODE_ENV: 'production' }).join(), /Falta WEBAPP_URL/);
  });
});
