import { crearApp } from './app.js';
import { conectarDatabase, desconectarDatabase } from './config/database.js';
import { ConfigError, config, validarConfig } from './config/env.js';
import { crearServicios } from './container.js';

const TIEMPO_MAXIMO_DE_CIERRE_MS = 10000;

async function start() {
  const avisos = validarConfig(config);
  for (const aviso of avisos) console.warn(`⚠️ ${aviso}`);

  try {
    await conectarDatabase(config.db.url);
  } catch (error) {
    throw new Error(
      `No se pudo conectar a MongoDB (${error.message}). ` +
      'Comprueba DATABASE_URL y que la base de datos esté en marcha (docker compose up -d).',
      { cause: error }
    );
  }

  const servicios = crearServicios(config);
  const app = crearApp({ config, servicios });

  const server = app.listen(config.port, () => {
    const modo = config.whatsapp.mock ? ' (WhatsApp simulado)' : '';
    console.log(`Servidor listo en http://localhost:${config.port}${modo}`);
  });

  // Cierre ordenado: deja de aceptar conexiones y cierra la base de datos.
  let cerrando = false;
  const cerrar = (senal) => {
    if (cerrando) return;
    cerrando = true;
    console.log(`${senal} recibido. Cerrando el servidor...`);

    const forzar = setTimeout(() => process.exit(1), TIEMPO_MAXIMO_DE_CIERRE_MS);
    forzar.unref();

    server.close(async () => {
      await desconectarDatabase().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

start().catch((error) => {
  // Los errores de configuración y de conexión ya traen un mensaje claro.
  console.error(`❌ ${error.message}`);
  if (!(error instanceof ConfigError) && !error.cause) console.error(error);
  process.exit(1);
});
