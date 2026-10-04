import { useState } from 'react';
import { puntosParaPiso } from '@shared/constants.js';
import ScoreCard from '../components/ScoreCard.jsx';
import FloorSelector from '../components/FloorSelector.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Dashboard({ user, catalog }) {
  const pisoUsuario = user?.floor || 1;
  // Piso que se está explorando; el del usuario no cambia al explorar.
  const [floor, setFloor] = useState(pisoUsuario);
  const [filtro, setFiltro] = useState('');

  const bloqueado = floor > pisoUsuario;
  const visibles = catalog
    .filter((i) => i.floor === floor)
    .filter((i) => i.name.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Hola,</p>
          <h1 className="text-xl font-bold text-gray-900">{user?.name || 'Usuario'}</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold">
          {(user?.name?.[0] || 'U').toUpperCase()}
        </div>
      </header>

      <ScoreCard user={user} />

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Explorar niveles</h2>
        <FloorSelector actual={floor} desbloqueadoHasta={pisoUsuario} onSelect={setFloor} />
      </section>

      <section>
        <input
          type="text"
          placeholder="Buscar productos..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Productos del piso {floor}</h2>
        {bloqueado ? (
          <div className="text-center text-sm text-gray-400 py-10">
            Te faltan {puntosParaPiso(user?.score, floor)} pts para desbloquear este piso.
          </div>
        ) : visibles.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">
            No hay productos en este piso.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visibles.map((item) => (
              <ProductCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
