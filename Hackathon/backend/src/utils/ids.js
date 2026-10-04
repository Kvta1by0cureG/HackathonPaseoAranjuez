const FORMATO_OBJECT_ID = /^[a-f\d]{24}$/i;

/** `true` si el valor (texto u ObjectId) tiene forma de ObjectId de MongoDB. */
export function esObjectId(valor) {
  if (valor === null || valor === undefined || typeof valor === 'number') return false;
  if (typeof valor === 'object' && typeof valor.toHexString !== 'function') return false;
  return FORMATO_OBJECT_ID.test(String(valor));
}
