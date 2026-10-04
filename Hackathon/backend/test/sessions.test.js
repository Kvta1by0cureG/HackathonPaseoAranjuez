import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { SesionError, crearServicioSesiones } from '../src/services/sessions.js';
import { configDePrueba, crearSesionesRepoFake, nuevoId } from '../test-support/fakes.js';

function preparar(env) {
  const config = configDePrueba(env);
  const repo = crearSesionesRepoFake();
  let desfaseMs = 0;
  const servicio = crearServicioSesiones({
    config,
    sesiones: repo,
    ahora: () => new Date(Date.now() + desfaseMs)
  });
  return { config, repo, servicio, avanzar: (ms) => { desfaseMs += ms; } };
}

describe('servicio de sesiones', () => {
  it('dos enlaces pedidos en el mismo segundo son distintos (L11)', async () => {
    const { servicio, repo } = preparar();
    const userId = nuevoId();
    const [a, b] = await Promise.all([servicio.crearEnlace(userId), servicio.crearEnlace(userId)]);
    assert.notEqual(a.token, b.token);
    assert.equal(repo.porJti.size, 2);
  });

  it('la sesión expira cuando expira el JWT, según JWT_EXPIRES (A6, A9)', async () => {
    for (const [valor, segundos] of [['900', 900], ['15m', 900], ['1h', 3600]]) {
      const { servicio, config } = preparar({ JWT_EXPIRES: valor });
      const antes = Date.now();
      const { token, expiresAt } = await servicio.crearEnlace(nuevoId());
      const { exp, iat } = jwt.verify(token, config.jwt.secret);

      assert.equal(exp - iat, segundos, `JWT_EXPIRES=${valor}`);
      assert.equal(expiresAt.getTime(), exp * 1000);
      assert.ok(expiresAt.getTime() - antes > (segundos - 2) * 1000);
    }
  });

  it('el enlace se canjea una sola vez (S3)', async () => {
    const { servicio } = preparar();
    const userId = nuevoId();
    const { token } = await servicio.crearEnlace(userId);

    const { accessToken } = await servicio.canjear(token);
    assert.deepEqual(Object.keys(await servicio.verificarAcceso(accessToken)), ['userId', 'sessionId']);
    assert.equal((await servicio.verificarAcceso(accessToken)).userId, userId);

    await assert.rejects(servicio.canjear(token), SesionError);
  });

  it('de dos canjes simultáneos solo uno tiene éxito (S3)', async () => {
    const { servicio } = preparar();
    const { token } = await servicio.crearEnlace(nuevoId());
    const resultados = await Promise.allSettled([servicio.canjear(token), servicio.canjear(token)]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  });

  it('un token de enlace no sirve como token de acceso, ni al revés', async () => {
    const { servicio } = preparar();
    const { token } = await servicio.crearEnlace(nuevoId());
    await assert.rejects(servicio.verificarAcceso(token), SesionError);

    const { accessToken } = await servicio.canjear(token);
    await assert.rejects(servicio.canjear(accessToken), SesionError);
  });

  it('cerrar la sesión invalida el token de acceso al instante (S3)', async () => {
    const { servicio } = preparar();
    const { token } = await servicio.crearEnlace(nuevoId());
    const { accessToken } = await servicio.canjear(token);
    const { sessionId } = await servicio.verificarAcceso(accessToken);

    await servicio.cerrar(sessionId);
    await assert.rejects(servicio.verificarAcceso(accessToken), /no es válida o expiró/);
  });

  it('rechaza tokens forjados con otro secreto, incluido el de ejemplo (S2)', async () => {
    const { servicio } = preparar();
    for (const secreto of ['cambia-esto-en-produccion', 'otro-secreto']) {
      const forjado = jwt.sign({ typ: 'access', sid: 'x' }, secreto, { subject: nuevoId(), expiresIn: 900 });
      await assert.rejects(servicio.verificarAcceso(forjado), SesionError);
    }
    await assert.rejects(servicio.verificarAcceso('no-es-un-jwt'), SesionError);
    await assert.rejects(servicio.verificarAcceso(undefined), SesionError);
    await assert.rejects(servicio.canjear({ $ne: null }), SesionError);
  });

  it('una sesión expirada deja de ser válida aunque el reloj del JWT no haya vencido', async () => {
    const { servicio, avanzar } = preparar({ JWT_EXPIRES: '15m' });
    const { token } = await servicio.crearEnlace(nuevoId());
    const { accessToken } = await servicio.canjear(token);
    avanzar(16 * 60 * 1000);
    await assert.rejects(servicio.verificarAcceso(accessToken), SesionError);
  });

  it('no se puede canjear un enlace expirado', async () => {
    const { servicio, avanzar } = preparar({ JWT_EXPIRES: '15m' });
    const { token } = await servicio.crearEnlace(nuevoId());
    avanzar(16 * 60 * 1000);
    await assert.rejects(servicio.canjear(token), /ya fue usado o expiró/);
  });

  it('urlPanel codifica el token en la URL de la webapp', () => {
    const { servicio } = preparar({ WEBAPP_URL: 'https://panel.ejemplo.com/' });
    assert.equal(servicio.urlPanel('a.b+c'), 'https://panel.ejemplo.com/?token=a.b%2Bc');
  });
});
