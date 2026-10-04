// Pruebas de extremo a extremo de la API HTTP: Express real, servicios reales
// y repositorios en memoria (sin MongoDB, WhatsApp ni LLM).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { setTimeout as esperar } from 'node:timers/promises';
import { firmarCuerpo } from '../src/middlewares/validateWebhook.js';
import { crearEntorno, levantarApp } from '../test-support/entorno.js';

const TELEFONO = '59170000001';
const CLAVE_ADMIN = 'clave-admin-de-prueba-0123456789';
const APP_SECRET = 'app-secret-de-prueba';

async function iniciar(opciones = {}) {
  const entorno = crearEntorno({
    usuariosIniciales: [{ phone: TELEFONO, name: 'Ana', score: 120 }],
    ...opciones,
    env: { WHATSAPP_APP_SECRET: APP_SECRET, WHATSAPP_VERIFY_TOKEN: 'verificacion', ...opciones.env }
  });
  const servidor = await levantarApp(entorno);
  const [user] = entorno.repos.usuarios.todos();

  async function pedir(ruta, { metodo = 'GET', cuerpo, token, cabeceras = {} } = {}) {
    const headers = { ...cabeceras };
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const respuesta = await fetch(`${servidor.url}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
    });
    const texto = await respuesta.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = undefined; }
    return { status: respuesta.status, json, texto, headers: respuesta.headers };
  }

  async function abrirSesion(userId = user._id) {
    const { token } = await entorno.servicios.sesiones.crearEnlace(userId);
    const { json } = await pedir('/api/session/exchange', { metodo: 'POST', cuerpo: { token } });
    return { enlace: token, acceso: json.accessToken };
  }

  const admin = (ruta, opciones = {}) =>
    pedir(ruta, { ...opciones, cabeceras: { 'X-Admin-Key': CLAVE_ADMIN, ...opciones.cabeceras } });

  return { ...entorno, ...servidor, user, pedir, abrirSesion, admin };
}

describe('API: sesión del panel', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(() => ctx.cerrar());

  it('health responde sin autenticación y con cabeceras de seguridad (S5)', async () => {
    const { status, json, headers } = await ctx.pedir('/api/health');
    assert.equal(status, 200);
    assert.deepEqual(json, { ok: true, service: 'whatsapp-agent-backend' });
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(headers.get('x-powered-by'), null);
    assert.ok(Number(headers.get('ratelimit-limit')) > 0);
  });

  it('exige el token en la cabecera y no lo acepta por la URL (S3)', async () => {
    const { enlace, acceso } = await ctx.abrirSesion();
    assert.equal((await ctx.pedir('/api/session')).status, 401);
    assert.equal((await ctx.pedir(`/api/session?token=${acceso}`)).status, 401);
    assert.equal((await ctx.pedir('/api/session', { token: enlace })).status, 401);
    assert.equal((await ctx.pedir('/api/session', { token: acceso })).status, 200);
  });

  it('el enlace de WhatsApp es de un solo uso (S3)', async () => {
    const { token } = await ctx.servicios.sesiones.crearEnlace(ctx.user._id);
    const primero = await ctx.pedir('/api/session/exchange', { metodo: 'POST', cuerpo: { token } });
    const segundo = await ctx.pedir('/api/session/exchange', { metodo: 'POST', cuerpo: { token } });

    assert.equal(primero.status, 200);
    assert.ok(primero.json.accessToken);
    assert.ok(!Number.isNaN(Date.parse(primero.json.expiresAt)));
    assert.equal(segundo.status, 401);
    assert.match(segundo.json.error, /ya fue usado/);
  });

  it('el canje rechaza cuerpos inválidos con 401 o 400, nunca 500', async () => {
    for (const cuerpo of [{}, { token: 123 }, { token: { $ne: '' } }, { token: 'basura' }]) {
      const { status } = await ctx.pedir('/api/session/exchange', { metodo: 'POST', cuerpo });
      assert.equal(status, 401, JSON.stringify(cuerpo));
    }
    const roto = await ctx.pedir('/api/session/exchange', { metodo: 'POST', cuerpo: '{"token":' });
    assert.equal(roto.status, 400);
    assert.deepEqual(roto.json, { error: 'JSON inválido' });
  });

  it('devuelve el usuario con el piso calculado y su catálogo acumulado (D1, D4, W1)', async () => {
    const { acceso } = await ctx.abrirSesion();
    const { json } = await ctx.pedir('/api/session', { token: acceso });

    assert.deepEqual(json.user, { _id: ctx.user._id, name: 'Ana', phone: TELEFONO, score: 120, floor: 2 });
    assert.deepEqual(json.catalog.map((i) => [i.floor, i.name]), [
      [1, 'Café Americano'], [1, 'Pan dulce'], [2, 'Sándwich club']
    ]);
  });

  it('cerrar sesión invalida el token de acceso (S3)', async () => {
    const { acceso } = await ctx.abrirSesion();
    assert.equal((await ctx.pedir('/api/session/logout', { metodo: 'POST', token: acceso })).status, 200);
    assert.equal((await ctx.pedir('/api/session', { token: acceso })).status, 401);
  });

  it('responde 404 si el usuario del token ya no existe', async () => {
    const { acceso } = await ctx.abrirSesion('f'.repeat(24));
    assert.equal((await ctx.pedir('/api/session', { token: acceso })).status, 404);
  });

  it('rutas inexistentes responden 404 en JSON', async () => {
    const { status, json } = await ctx.pedir('/api/no-existe');
    assert.equal(status, 404);
    assert.deepEqual(json, { error: 'Ruta no encontrada' });
  });
});

describe('API: catálogo', () => {
  let ctx;
  let acceso;
  before(async () => {
    ctx = await iniciar();
    ({ acceso } = await ctx.abrirSesion());
  });
  after(() => ctx.cerrar());

  it('sin piso devuelve todos los pisos desbloqueados', async () => {
    const { status, json } = await ctx.pedir('/api/catalog', { token: acceso });
    assert.equal(status, 200);
    assert.equal(json.floor, null);
    assert.equal(json.items.length, 3);
  });

  it('con un piso desbloqueado devuelve solo ese piso', async () => {
    const { json } = await ctx.pedir('/api/catalog?floor=1', { token: acceso });
    assert.equal(json.floor, 1);
    assert.deepEqual(json.items.map((i) => i.name), ['Café Americano', 'Pan dulce']);
  });

  it('un piso bloqueado responde 403 (S6)', async () => {
    const { status, json } = await ctx.pedir('/api/catalog?floor=5', { token: acceso });
    assert.equal(status, 403);
    assert.deepEqual(json, { error: 'Ese piso todavía está bloqueado', pisoUsuario: 2, faltan: 880 });
  });

  it('rechaza pisos inválidos y operadores inyectados (S7)', async () => {
    for (const consulta of ['floor=0', 'floor=9', 'floor=abc', 'floor=1.5', 'floor=', 'floor[$gt]=0', 'floor=1&floor=2']) {
      const { status } = await ctx.pedir(`/api/catalog?${consulta}`, { token: acceso });
      assert.equal(status, 400, consulta);
    }
  });

  it('exige autenticación', async () => {
    assert.equal((await ctx.pedir('/api/catalog?floor=1')).status, 401);
  });
});

describe('API: administración y notificaciones', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(() => ctx.cerrar());

  it('un usuario normal del panel no puede enviar notificaciones (S4)', async () => {
    const { acceso } = await ctx.abrirSesion();
    const cuerpo = { telefono: '59179999999', plantilla: 'promo' };
    assert.equal((await ctx.pedir('/api/notifications/send', { metodo: 'POST', cuerpo, token: acceso })).status, 401);
    assert.equal((await ctx.pedir('/api/notifications/send', { metodo: 'POST', cuerpo })).status, 401);
    assert.equal(
      (await ctx.pedir('/api/notifications/send', { metodo: 'POST', cuerpo, cabeceras: { 'X-Admin-Key': 'incorrecta' } })).status,
      401
    );
    assert.equal(ctx.whatsapp.total, 0);
  });

  it('con la clave de administración envía la plantilla (H2)', async () => {
    const { status } = await ctx.admin('/api/notifications/send', {
      metodo: 'POST',
      cuerpo: { telefono: '59179999999', plantilla: 'promo_semanal', parametros: ['Ana'], idioma: 'es_MX' }
    });
    assert.equal(status, 200);
    const enviado = ctx.whatsapp.enviados.at(-1);
    assert.equal(enviado.to, '59179999999');
    assert.equal(enviado.template.name, 'promo_semanal');
    assert.equal(enviado.template.language.code, 'es_MX');
  });

  it('valida los datos de la notificación', async () => {
    const invalidos = [
      { plantilla: 'promo' },
      { telefono: '+59170000001', plantilla: 'promo' },
      { telefono: '59170000001' },
      { telefono: '59170000001', plantilla: 'Con Espacios' },
      { telefono: '59170000001', plantilla: 'promo', parametros: 'x' },
      { telefono: '59170000001', plantilla: 'promo', parametros: [{}] },
      { telefono: '59170000001', plantilla: 'promo', idioma: 'español' }
    ];
    for (const cuerpo of invalidos) {
      const { status } = await ctx.admin('/api/notifications/send', { metodo: 'POST', cuerpo });
      assert.equal(status, 400, JSON.stringify(cuerpo));
    }
  });

  it('registrar una compra otorga puntos y queda en la auditoría (D5, L10)', async () => {
    const cafe = ctx.repos.catalogoRepo.items.find((i) => i.name === 'Café Americano');
    const compra = await ctx.admin('/api/admin/purchases', {
      metodo: 'POST',
      cuerpo: { telefono: TELEFONO, productoId: cafe._id, cantidad: 2 }
    });
    assert.equal(compra.status, 201);
    assert.equal(compra.json.puntos, 5);
    assert.equal(compra.json.score, 125);

    const ajuste = await ctx.admin('/api/admin/score-adjustments', {
      metodo: 'POST',
      cuerpo: { telefono: TELEFONO, puntos: 200, motivo: 'Promoción de aniversario' }
    });
    assert.equal(ajuste.status, 201);
    assert.equal(ajuste.json.floor, 3);

    const { json } = await ctx.admin(`/api/admin/users/${TELEFONO}/movements`);
    assert.deepEqual(json.items.map((m) => [m.origen, m.puntos, m.scoreResultante]), [
      ['ajuste_admin', 200, 325],
      ['compra', 5, 125]
    ]);
  });

  it('las rutas de administración exigen la clave y validan los datos', async () => {
    const cuerpo = { telefono: TELEFONO, puntos: 5000, motivo: 'regalo' };
    assert.equal((await ctx.pedir('/api/admin/score-adjustments', { metodo: 'POST', cuerpo })).status, 401);

    const { acceso } = await ctx.abrirSesion();
    assert.equal((await ctx.pedir('/api/admin/score-adjustments', { metodo: 'POST', cuerpo, token: acceso })).status, 401);

    assert.equal((await ctx.admin('/api/admin/score-adjustments', { metodo: 'POST', cuerpo: { ...cuerpo, puntos: 'abc' } })).status, 400);
    assert.equal((await ctx.admin('/api/admin/score-adjustments', { metodo: 'POST', cuerpo: { ...cuerpo, puntos: -99999 } })).status, 409);
    assert.equal((await ctx.admin('/api/admin/purchases', { metodo: 'POST', cuerpo: { telefono: TELEFONO, productoId: 'x' } })).status, 404);
    assert.equal((await ctx.admin('/api/admin/purchases', { metodo: 'POST', cuerpo: { telefono: TELEFONO } })).status, 400);
    assert.equal((await ctx.admin('/api/admin/users/59179999999/movements')).status, 404);
  });
});

describe('API: sin clave de administración configurada', () => {
  it('las rutas de administración responden 503', async () => {
    const ctx = await iniciar({ env: { ADMIN_API_KEY: '' } });
    try {
      const { status } = await ctx.pedir('/api/notifications/send', {
        metodo: 'POST',
        cuerpo: { telefono: TELEFONO, plantilla: 'promo' },
        cabeceras: { 'X-Admin-Key': '' }
      });
      assert.equal(status, 503);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe('API: límites y CORS (S5)', () => {
  it('limita los intentos de canje por minuto', async () => {
    const ctx = await iniciar({ env: { MAX_CANJES_POR_MINUTO: '3' } });
    try {
      const estados = [];
      for (let i = 0; i < 5; i++) {
        const { status } = await ctx.pedir('/api/session/exchange', { metodo: 'POST', cuerpo: { token: 'x' } });
        estados.push(status);
      }
      assert.deepEqual(estados, [401, 401, 401, 429, 429]);
    } finally {
      await ctx.cerrar();
    }
  });

  it('limita las peticiones a la API y devuelve Retry-After', async () => {
    const ctx = await iniciar({ env: { MAX_PETICIONES_API_POR_MINUTO: '2' } });
    try {
      await ctx.pedir('/api/health');
      await ctx.pedir('/api/health');
      const { status, headers } = await ctx.pedir('/api/health');
      assert.equal(status, 429);
      assert.ok(Number(headers.get('retry-after')) > 0);
    } finally {
      await ctx.cerrar();
    }
  });

  it('solo permite el origen de la webapp', async () => {
    const ctx = await iniciar({ env: { WEBAPP_URL: 'https://panel.ejemplo.com' } });
    try {
      const propio = await ctx.pedir('/api/health', { cabeceras: { Origin: 'https://panel.ejemplo.com' } });
      const ajeno = await ctx.pedir('/api/health', { cabeceras: { Origin: 'https://malicioso.ejemplo.com' } });
      assert.equal(propio.headers.get('access-control-allow-origin'), 'https://panel.ejemplo.com');
      assert.equal(ajeno.headers.get('access-control-allow-origin'), null);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe('webhook de WhatsApp', () => {
  let ctx;
  before(async () => { ctx = await iniciar(); });
  after(() => ctx.cerrar());

  function payload(id, texto = 'score') {
    return JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: {
        contacts: [{ wa_id: TELEFONO, profile: { name: 'Ana' } }],
        messages: [{ id, from: TELEFONO, type: 'text', text: { body: texto } }]
      } }] }]
    });
  }

  const enviar = (cuerpo, firma = firmarCuerpo(Buffer.from(cuerpo), APP_SECRET)) =>
    ctx.pedir('/webhook', {
      metodo: 'POST',
      cuerpo,
      cabeceras: firma === null ? {} : { 'X-Hub-Signature-256': firma }
    });

  async function esperarEnvios(cantidad) {
    for (let i = 0; i < 100 && ctx.whatsapp.total < cantidad; i++) {
      await esperar(10);
    }
  }

  it('verifica la suscripción de Meta', async () => {
    const ok = await ctx.pedir('/webhook?hub.mode=subscribe&hub.verify_token=verificacion&hub.challenge=4242');
    assert.equal(ok.status, 200);
    assert.equal(ok.texto, '4242');
    assert.equal((await ctx.pedir('/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1')).status, 403);
  });

  it('una firma inválida, vacía o ausente responde 403, no 500 (S8)', async () => {
    const cuerpo = payload('wamid.firma');
    for (const firma of [null, '', 'sha256=abc', firmarCuerpo(Buffer.from(cuerpo), 'otro-secreto')]) {
      assert.equal((await enviar(cuerpo, firma)).status, 403, String(firma));
    }
    assert.equal(ctx.whatsapp.total, 0);
  });

  it('responde 200 y procesa el mensaje una sola vez aunque Meta lo reenvíe (L1, H1)', async () => {
    const cuerpo = payload('wamid.unico');
    assert.equal((await enviar(cuerpo)).status, 200);
    assert.equal((await enviar(cuerpo)).status, 200);
    assert.equal((await enviar(cuerpo)).status, 200);

    await esperarEnvios(1);
    await esperar(50);
    assert.equal(ctx.whatsapp.total, 1);
    assert.equal(ctx.whatsapp.enviados[0].text.body, 'Tu score es 120 y estás en el Piso 2 · Plata.');
  });

  it('ignora objetos que no son de WhatsApp Business', async () => {
    const cuerpo = JSON.stringify({ object: 'page', entry: [] });
    assert.equal((await enviar(cuerpo)).status, 404);
  });
});

describe('rutas de desarrollo (A5)', () => {
  it('con WhatsApp simulado permiten obtener un enlace y conversar', async () => {
    const ctx = await iniciar();
    try {
      const enlace = await ctx.pedir('/dev/token', { metodo: 'POST', cuerpo: { telefono: '59170000009', nombre: 'Luis' } });
      assert.equal(enlace.status, 200);
      const token = new URL(enlace.json.url).searchParams.get('token');
      const canje = await ctx.pedir('/api/session/exchange', { metodo: 'POST', cuerpo: { token } });
      const sesion = await ctx.pedir('/api/session', { token: canje.json.accessToken });
      assert.equal(sesion.json.user.name, 'Luis');

      const charla = await ctx.pedir('/dev/message', { metodo: 'POST', cuerpo: { telefono: '59170000009', texto: 'progreso' } });
      assert.equal(charla.json.resultado, 'atendido');
      assert.match(charla.json.respuestas[0].text.body, /Te faltan 100 para subir/);
    } finally {
      await ctx.cerrar();
    }
  });

  it('no existen si WhatsApp no está simulado', async () => {
    const ctx = await iniciar({
      env: { WHATSAPP_MOCK: 'false', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: 'p' }
    });
    try {
      const { status } = await ctx.pedir('/dev/token', { metodo: 'POST', cuerpo: { telefono: '59170000009' } });
      assert.equal(status, 404);
    } finally {
      await ctx.cerrar();
    }
  });
});
