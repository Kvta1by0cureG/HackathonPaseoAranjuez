// Carga el catálogo de prueba. Uso:
//   npm run seed              (solo si el catálogo está vacío)
//   npm run seed -- --force   (borra el catálogo actual y lo vuelve a cargar)
import { conectarDatabase, desconectarDatabase } from '../src/config/database.js';
import { config, validarConfig } from '../src/config/env.js';
import { Catalog } from '../src/models/Catalog.js';

const productos = [
  // Piso 1 · Bronce
  { name: 'Café Americano', floor: 1, description: 'Café negro clásico', price: 25, active: true },
  { name: 'Pan dulce', floor: 1, description: 'Concha recién horneada', price: 15, active: true },
  { name: 'Agua 600ml', floor: 1, description: 'Botella fría', price: 12, active: true },

  // Piso 2 · Plata
  { name: 'Sándwich club', floor: 2, description: 'Pollo, tocino y aguacate', price: 65, active: true },
  { name: 'Ensalada César', floor: 2, description: 'Lechuga romana y crutones', price: 70, active: true },
  { name: 'Jugo natural', floor: 2, description: 'Naranja recién exprimido', price: 35, active: true },

  // Piso 3 · Oro
  { name: 'Pasta Alfredo', floor: 3, description: 'Con camarones', price: 145, active: true },
  { name: 'Salmón a la plancha', floor: 3, description: 'Con verduras al vapor', price: 180, active: true },
  { name: 'Vino tinto copa', floor: 3, description: 'Cabernet Sauvignon', price: 90, active: true },

  // Piso 4 · Platino
  { name: 'Corte Ribeye', floor: 4, description: '400g término medio', price: 380, active: true },
  { name: 'Langosta', floor: 4, description: 'Al ajillo con mantequilla', price: 450, active: true },
  { name: 'Whisky 18 años', floor: 4, description: 'Single malt', price: 320, active: true },

  // Piso 5 · Diamante
  { name: 'Caviar Beluga', floor: 5, description: '30g con blinis', price: 1200, active: true },
  { name: 'Champagne Dom Pérignon', floor: 5, description: 'Botella 750ml', price: 2500, active: true },
  { name: 'Trufa negra', floor: 5, description: 'Por gramo', price: 800, active: true }
];

async function seed() {
  const forzar = process.argv.includes('--force');

  // El seed solo necesita la base de datos: no exige credenciales de WhatsApp.
  validarConfig(config, ['db']);
  await conectarDatabase(config.db.url);

  const existentes = await Catalog.countDocuments({});
  if (existentes > 0 && !forzar) {
    console.error(
      `⚠️ El catálogo ya tiene ${existentes} productos y no se ha modificado.\n` +
      '   Para borrarlo y volver a cargarlo ejecuta: npm run seed -- --force'
    );
    return 1;
  }

  if (existentes > 0) {
    console.log(`Borrando ${existentes} productos del catálogo anterior...`);
    await Catalog.deleteMany({});
  }

  console.log('Insertando productos...');
  await Catalog.insertMany(productos);
  console.log(`✅ ${productos.length} productos insertados`);
  return 0;
}

seed()
  .catch((error) => {
    console.error('❌ Error en seed:', error.message);
    return 1;
  })
  .then(async (codigo) => {
    await desconectarDatabase().catch(() => {});
    process.exit(codigo);
  });
