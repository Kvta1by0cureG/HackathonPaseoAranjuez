import mongoose from 'mongoose';

let listenersRegistrados = false;

function registrarListeners(log) {
  if (listenersRegistrados) return;
  listenersRegistrados = true;

  mongoose.connection.on('disconnected', () => {
    log.warn('⚠️ Conexión a la BD perdida. Reconectando...');
  });
  mongoose.connection.on('reconnected', () => {
    log.info('✅ Reconexión exitosa a la BD');
  });
}

/**
 * Conecta con MongoDB. Lanza el error si no puede conectar: quien llama decide
 * cómo terminar (el servidor y los scripts tienen cada uno su propio manejo).
 */
export async function conectarDatabase(url, { log = console } = {}) {
  if (!url) throw new Error('Falta la URL de la base de datos (DATABASE_URL).');

  registrarListeners(log);
  await mongoose.connect(url, { serverSelectionTimeoutMS: 5000 });
  log.info('✅ Base de datos conectada');
}

export async function desconectarDatabase() {
  await mongoose.disconnect();
}

export { mongoose };
