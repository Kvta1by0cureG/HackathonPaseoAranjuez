/** 404 en JSON para rutas inexistentes. */
export function rutaNoEncontrada(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

/** Último middleware: convierte cualquier error en una respuesta JSON sin filtrar detalles. */
export function crearManejadorDeErrores({ log = console } = {}) {
  // Express reconoce el manejador de errores por sus 4 parámetros.
  // eslint-disable-next-line no-unused-vars
  return function manejarError(err, req, res, next) {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Cuerpo de la petición demasiado grande' });
    }

    log.error('Error no manejado:', err);
    if (res.headersSent) return undefined;
    return res.status(500).json({ error: 'Error interno del servidor' });
  };
}
