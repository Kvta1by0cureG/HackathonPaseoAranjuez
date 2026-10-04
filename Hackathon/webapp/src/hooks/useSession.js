import { useEffect, useState } from 'react';
import { iniciarSesion } from '../lib/session.js';

const ESTADO_INICIAL = { cargando: true, error: null, reintentable: false, user: null, catalog: [] };

export function useSession() {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  useEffect(() => {
    let activo = true;

    iniciarSesion().then(
      ({ user, catalog }) => {
        if (activo) setEstado({ cargando: false, error: null, reintentable: false, user, catalog });
      },
      (error) => {
        if (activo) {
          setEstado({
            cargando: false,
            error: error.message,
            // Fallo pasajero: recargar puede bastar, no hace falta otro enlace.
            reintentable: error.reintentable === true,
            user: null,
            catalog: []
          });
        }
      }
    );

    return () => {
      activo = false;
    };
  }, []);

  return estado;
}
