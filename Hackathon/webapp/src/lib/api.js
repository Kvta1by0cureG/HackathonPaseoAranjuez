const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = 'ApiError';
    // 0 = no se pudo conectar con el servidor.
    this.status = status;
    // Fallo pasajero (sin conexión, límite de peticiones, error del servidor):
    // reintentar más tarde puede funcionar y el enlace sigue sin usarse.
    this.reintentable = status === 0 || status === 429 || status >= 500;
  }
}

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // El token viaja siempre en la cabecera, nunca en la URL.
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError('No pudimos conectar con el servidor', 0);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `Error ${res.status}`, res.status);
  }

  return data;
}

/** Canjea el token de un solo uso del enlace de WhatsApp por un token de acceso. */
export function canjearEnlace(tokenEnlace) {
  return request('/session/exchange', { method: 'POST', body: { token: tokenEnlace } });
}

/** Usuario y catálogo de sus pisos desbloqueados. */
export function getSession(token) {
  return request('/session', { token });
}
