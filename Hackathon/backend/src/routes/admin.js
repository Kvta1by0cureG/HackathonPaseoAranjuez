import express from 'express';
import { ScoreError } from '../services/scoreService.js';
import { asincrono, esTelefonoValido } from '../utils/http.js';

function responderError(res, error) {
  if (!(error instanceof ScoreError)) throw error;
  return res.status(error.status).json({ error: error.message });
}

/**
 * Rutas de administración (detrás de la clave interna): la única forma de
 * modificar puntos. Cada operación queda registrada como movimiento.
 */
export function crearAdminRouter({ score }) {
  const router = express.Router();

  // Registra una compra hecha en tienda y otorga los puntos correspondientes.
  router.post('/purchases', asincrono(async (req, res) => {
    const { telefono, productoId, cantidad = 1 } = req.body ?? {};
    if (!esTelefonoValido(telefono)) return res.status(400).json({ error: 'telefono inválido' });
    if (typeof productoId !== 'string') return res.status(400).json({ error: 'productoId requerido' });

    try {
      return res.status(201).json(await score.registrarCompra({ telefono, productoId, cantidad }));
    } catch (error) {
      return responderError(res, error);
    }
  }));

  // Ajuste manual de puntos (positivo o negativo) con motivo obligatorio.
  router.post('/score-adjustments', asincrono(async (req, res) => {
    const { telefono, puntos, motivo } = req.body ?? {};
    if (!esTelefonoValido(telefono)) return res.status(400).json({ error: 'telefono inválido' });

    try {
      return res.status(201).json(await score.ajustar({ telefono, puntos, motivo }));
    } catch (error) {
      return responderError(res, error);
    }
  }));

  // Auditoría: últimos movimientos de puntos de un usuario.
  router.get('/users/:telefono/movements', asincrono(async (req, res) => {
    const { telefono } = req.params;
    if (!esTelefonoValido(telefono)) return res.status(400).json({ error: 'telefono inválido' });

    try {
      return res.json({ items: await score.movimientos(telefono) });
    } catch (error) {
      return responderError(res, error);
    }
  }));

  return router;
}
