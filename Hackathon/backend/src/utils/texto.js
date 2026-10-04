/** Minúsculas y sin acentos: "Catálogo" -> "catalogo". */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Palabras completas de un texto ya normalizado (letras y dígitos). */
export function palabras(texto) {
  return normalizar(texto).match(/[a-z0-9ñ]+/g) ?? [];
}

/** Recorta un texto a `maximo` caracteres añadiendo "…" si se cortó. */
export function recortar(texto, maximo) {
  const valor = String(texto ?? '');
  return valor.length <= maximo ? valor : `${valor.slice(0, maximo - 1)}…`;
}
