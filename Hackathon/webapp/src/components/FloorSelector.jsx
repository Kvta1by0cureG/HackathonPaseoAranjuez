import { UMBRALES_PISO, nombrePiso } from '@shared/constants.js';

/**
 * @param {number} actual             Piso que se está explorando.
 * @param {number} desbloqueadoHasta  Piso del usuario: los superiores están bloqueados.
 */
export default function FloorSelector({ actual, desbloqueadoHasta, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {UMBRALES_PISO.map((u) => {
        const activo = u.floor === actual;
        const bloqueado = u.floor > desbloqueadoHasta;
        const nombre = nombrePiso(u.floor);
        return (
          <button
            key={u.floor}
            onClick={() => onSelect(u.floor)}
            aria-pressed={activo}
            aria-label={bloqueado ? `${nombre} (bloqueado)` : undefined}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition
              ${activo
                ? 'bg-brand-600 text-white border-brand-600'
                : `bg-white border-gray-200 hover:border-brand-500 ${bloqueado ? 'text-gray-400' : 'text-gray-700'}`}`}
          >
            {nombre}
          </button>
        );
      })}
    </div>
  );
}
