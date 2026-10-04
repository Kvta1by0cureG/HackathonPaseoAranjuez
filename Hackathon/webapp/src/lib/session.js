import { canjearEnlace, getSession } from './api.js';

const CLAVE_TOKEN = 'panel.accessToken';

function leerGuardado() {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null; // almacenamiento bloqueado (modo privado, etc.)
  }
}

function guardar(token) {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento la sesión funciona igual, pero no sobrevive a una recarga.
  }
}

function borrarGuardado() {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // nada que borrar
  }
}

/** Token de un solo uso que trae el enlace de WhatsApp (?token=... o #token=...). */
function leerTokenDeEnlace() {
  const enQuery = new URLSearchParams(window.location.search).get('token');
  if (enQuery) return enQuery;
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
}

/** Quita el token de la barra de direcciones para que no quede en el historial. */
function limpiarUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}

async function cargarSesion() {
  const tokenEnlace = leerTokenDeEnlace();
  let acceso = leerGuardado();

  if (tokenEnlace) {
    try {
      ({ accessToken: acceso } = await canjearEnlace(tokenEnlace));
      guardar(acceso);
      limpiarUrl();
    } catch (error) {
      // En un fallo pasajero el enlace sigue sin usarse: se deja en la URL para
      // que recargar la página lo reintente.
      if (!error.reintentable) limpiarUrl();
      // Un enlace ya usado no impide seguir con la sesión guardada en esta pestaña.
      if (!acceso) throw error;
    }
  }

  if (!acceso) {
    throw new Error('No encontramos tu enlace de acceso');
  }

  try {
    return await getSession(acceso);
  } catch (error) {
    if (error.status === 401) borrarGuardado();
    throw error;
  }
}

let arranque = null;

/**
 * Inicia la sesión una sola vez por carga de página. Todas las llamadas
 * comparten la misma promesa: en desarrollo, React.StrictMode ejecuta los
 * efectos dos veces y el enlace de un solo uso no debe canjearse dos veces.
 */
export function iniciarSesion() {
  if (!arranque) arranque = cargarSesion();
  return arranque;
}
