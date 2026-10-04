import crypto from 'node:crypto';

/**
 * Compara dos textos en tiempo constante. A diferencia de crypto.timingSafeEqual,
 * no lanza si las longitudes difieren: compara sus hashes SHA-256.
 */
export function compararSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
