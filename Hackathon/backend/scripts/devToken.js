// Genera un enlace al panel web sin pasar por WhatsApp (solo para desarrollo).
// Uso: npm run dev:token -- 59170000000 "Nombre opcional"
import { conectarDatabase, desconectarDatabase } from '../src/config/database.js';
import { config, validarConfig } from '../src/config/env.js';
import { sesionesRepo } from '../src/repositories/sessions.js';
import { usuariosRepo } from '../src/repositories/users.js';
import { crearServicioSesiones } from '../src/services/sessions.js';
import { esTelefonoValido } from '../src/utils/http.js';

async function main() {
  const [telefono, nombre = ''] = process.argv.slice(2);

  if (!esTelefonoValido(telefono)) {
    console.error('Uso: npm run dev:token -- <telefono solo con dígitos> ["Nombre"]');
    return 1;
  }
  if (config.esProduccion) {
    console.error('❌ Este script es solo para desarrollo (NODE_ENV=production).');
    return 1;
  }

  validarConfig(config, ['db', 'jwt', 'webapp']);
  await conectarDatabase(config.db.url);

  const user = await usuariosRepo.obtenerOCrearPorTelefono(telefono, nombre);
  const sesiones = crearServicioSesiones({ config, sesiones: sesionesRepo });
  const { token, expiresAt } = await sesiones.crearEnlace(user._id);

  console.log(`\nUsuario: ${user.name || '(sin nombre)'} · ${user.phone} · score ${user.score}`);
  console.log(`Enlace (un solo uso, expira ${expiresAt.toLocaleString()}):\n`);
  console.log(`  ${sesiones.urlPanel(token)}\n`);
  return 0;
}

main()
  .catch((error) => {
    console.error(`❌ ${error.message}`);
    return 1;
  })
  .then(async (codigo) => {
    await desconectarDatabase().catch(() => {});
    process.exit(codigo);
  });
