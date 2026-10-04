// Dobles en memoria de los repositorios y servicios externos.
// Implementan la misma interfaz que los repositorios de MongoDB
// (src/repositories), para probar la lógica sin base de datos.
import crypto from 'node:crypto';
import { cargarConfig } from '../src/config/env.js';

export function nuevoId() {
  return crypto.randomBytes(12).toString('hex');
}

export const logSilencioso = { info() {}, warn() {}, error() {}, log() {} };

export function configDePrueba(env = {}) {
  return cargarConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'mongodb://127.0.0.1:27017/test',
    JWT_SECRET: 'secreto-de-prueba-con-mas-de-32-caracteres',
    JWT_EXPIRES: '15m',
    WHATSAPP_MOCK: 'true',
    WEBAPP_URL: 'http://localhost:5173',
    ADMIN_API_KEY: 'clave-admin-de-prueba-0123456789',
    ...env
  });
}

export function crearUsuariosFake(iniciales = []) {
  const porId = new Map();
  for (const u of iniciales) {
    const user = { _id: nuevoId(), name: '', score: 0, ...u };
    porId.set(String(user._id), user);
  }
  const copia = (u) => (u ? { ...u } : null);

  return {
    todos: () => [...porId.values()].map(copia),
    async buscarPorId(id) {
      return copia(porId.get(String(id)));
    },
    async buscarPorTelefono(phone) {
      return copia([...porId.values()].find((u) => u.phone === String(phone)));
    },
    async obtenerOCrearPorTelefono(phone, name = '') {
      let user = [...porId.values()].find((u) => u.phone === String(phone));
      if (!user) {
        user = { _id: nuevoId(), phone: String(phone), name: String(name || ''), score: 0 };
        porId.set(user._id, user);
      } else if (name && !user.name) {
        user.name = String(name);
      }
      return copia(user);
    },
    async incrementarScore(id, puntos) {
      const user = porId.get(String(id));
      if (!user || !Number.isInteger(puntos)) return null;
      if (puntos < 0 && user.score < -puntos) return null;
      user.score += puntos;
      return copia(user);
    }
  };
}

export function crearCatalogoRepoFake(productos = []) {
  const items = productos.map((p) => ({ _id: nuevoId(), description: '', active: true, ...p }));
  const ordenar = (a, b) => a.floor - b.floor || a.name.localeCompare(b.name);
  const exigirEntero = (valor) => {
    if (!Number.isInteger(valor)) throw new TypeError('se esperaba un entero');
  };

  return {
    items,
    async listarPorPiso(floor) {
      exigirEntero(floor);
      return items.filter((i) => i.active && i.floor === floor).sort(ordenar);
    },
    async listarHastaPiso(pisoMaximo) {
      exigirEntero(pisoMaximo);
      return items.filter((i) => i.active && i.floor <= pisoMaximo).sort(ordenar);
    },
    async buscarActivoPorId(id) {
      return items.find((i) => i.active && i._id === id) ?? null;
    },
    async contar() {
      return items.length;
    }
  };
}

export function crearSesionesRepoFake() {
  const porJti = new Map();
  return {
    porJti,
    async crear({ jti, userId, expiresAt }) {
      if (porJti.has(jti)) {
        const error = new Error('E11000 duplicate key');
        error.code = 11000;
        throw error;
      }
      porJti.set(jti, { jti, userId, expiresAt, usedAt: null, revokedAt: null });
    },
    async marcarUsada(jti, ahora) {
      const s = porJti.get(String(jti));
      if (!s || s.usedAt || s.revokedAt || s.expiresAt <= ahora) return null;
      s.usedAt = ahora;
      return { ...s };
    },
    async buscarActiva(jti, ahora) {
      const s = porJti.get(String(jti));
      if (!s || !s.usedAt || s.revokedAt || s.expiresAt <= ahora) return null;
      return { ...s };
    },
    async revocar(jti, ahora) {
      const s = porJti.get(String(jti));
      if (s && !s.revokedAt) s.revokedAt = ahora;
    }
  };
}

export function crearMovimientosFake() {
  const lista = [];
  return {
    lista,
    async registrar(movimiento) {
      const guardado = { _id: nuevoId(), createdAt: new Date(), ...movimiento };
      lista.push(guardado);
      return { ...guardado };
    },
    async listarPorUsuario(userId) {
      return lista.filter((m) => String(m.userId) === String(userId)).reverse();
    }
  };
}

export function crearHistorialFake() {
  const lista = [];
  return {
    lista,
    async agregar(userId, role, content) {
      lista.push({ userId: String(userId), role, content });
    },
    async ultimos(userId, limite) {
      return lista
        .filter((m) => m.userId === String(userId))
        .slice(-limite)
        .map(({ role, content }) => ({ role, content }));
    }
  };
}

export function crearProcesadosFake() {
  const vistos = new Set();
  return {
    vistos,
    async registrar(messageId) {
      if (vistos.has(messageId)) return false;
      vistos.add(messageId);
      return true;
    }
  };
}

/**
 * LLM guionizado: cada llamada devuelve el siguiente mensaje de `guion`
 * (o lanza si el elemento es un Error). Guarda lo que recibió en `llamadas`.
 */
export function crearLLMFake(guion) {
  const pendientes = [...guion];
  const llamadas = [];
  return {
    llamadas,
    async completar(messages, tools) {
      llamadas.push({ messages: structuredClone(messages), tools });
      const siguiente = pendientes.length > 1 ? pendientes.shift() : pendientes[0];
      if (siguiente instanceof Error) throw siguiente;
      return { choices: siguiente === null ? [] : [{ message: siguiente }] };
    }
  };
}

export function llamadaATool(nombre, args = {}, id = `call_${nuevoId()}`) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name: nombre, arguments: JSON.stringify(args) } }]
  };
}

export const CATALOGO_DE_PRUEBA = [
  { name: 'Café Americano', floor: 1, price: 25 },
  { name: 'Pan dulce', floor: 1, price: 15 },
  { name: 'Sándwich club', floor: 2, price: 65 },
  { name: 'Pasta Alfredo', floor: 3, price: 145 },
  { name: 'Corte Ribeye', floor: 4, price: 380 },
  { name: 'Caviar Beluga', floor: 5, price: 1200 },
  { name: 'Producto retirado', floor: 1, price: 5, active: false }
];
