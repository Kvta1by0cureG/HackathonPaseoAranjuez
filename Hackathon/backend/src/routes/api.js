import express from 'express';
import { CatalogoError } from '../services/catalogService.js';
import { calcularPiso } from '../services/score.js';
import { SesionError } from '../services/sessions.js';
import { asincrono } from '../utils/http.js';

function usuarioPublico(user) {
  return {
    _id: String(user._id),
    name: user.name,
    phone: user.phone,
    score: user.score,
    // El piso siempre se calcula a partir del score; no se guarda en la BD.
    floor: calcularPiso(user.score)
  };
}

/**
 * API de la Mini WebApp.
 * @param {object} deps { sesiones, usuarios, catalogo, autenticar, limitarCanje }
 */
export function crearApiRouter({ sesiones, usuarios, catalogo, autenticar, limitarCanje }) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, service: 'whatsapp-agent-backend' });
  });

  // Canjea el token de un solo uso del enlace de WhatsApp por un token de acceso.
  router.post('/session/exchange', limitarCanje, asincrono(async (req, res) => {
    try {
      const { accessToken, expiresAt } = await sesiones.canjear(req.body?.token);
      res.json({ accessToken, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      if (!(error instanceof SesionError)) throw error;
      res.status(401).json({ error: error.message });
    }
  }));

  router.get('/session', autenticar, asincrono(async (req, res) => {
    const user = await usuarios.buscarPorId(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Catálogo de todos los pisos que el usuario tiene desbloqueados.
    const { items } = await catalogo.consultar({ score: user.score });
    return res.json({ user: usuarioPublico(user), catalog: items });
  }));

  router.get('/catalog', autenticar, asincrono(async (req, res) => {
    const user = await usuarios.buscarPorId(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const crudo = req.query.floor;
    let floor;
    if (crudo !== undefined) {
      // Solo se acepta un entero escrito con dígitos ("2"); cualquier otra cosa
      // (listas, objetos como floor[$gt]=0, decimales) se rechaza.
      floor = typeof crudo === 'string' && /^\d{1,3}$/.test(crudo) ? Number(crudo) : NaN;
    }

    try {
      const resultado = await catalogo.consultar({ score: user.score, floor });
      return res.json({ floor: resultado.floor, items: resultado.items });
    } catch (error) {
      if (!(error instanceof CatalogoError)) throw error;
      return res.status(error.status).json({ error: error.message, ...error.datos });
    }
  }));

  router.post('/session/logout', autenticar, asincrono(async (req, res) => {
    await sesiones.cerrar(req.sessionId);
    res.json({ ok: true });
  }));

  return router;
}
