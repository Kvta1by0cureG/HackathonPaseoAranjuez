import { useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';

function contarProductos(cantidad) {
  return `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`;
}

/** Catálogo completo: todos los productos de los pisos que el usuario tiene desbloqueados. */
export default function Catalog({ catalog = [] }) {
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState('nombre');

  const visibles = useMemo(() => {
    const lista = catalog
      .filter((i) => i.name.toLowerCase().includes(filtro.toLowerCase()))
      .slice();

    if (orden === 'precio-asc') lista.sort((a, b) => a.price - b.price);
    if (orden === 'precio-desc') lista.sort((a, b) => b.price - a.price);
    if (orden === 'nombre') lista.sort((a, b) => a.name.localeCompare(b.name));

    return lista;
  }, [catalog, filtro, orden]);

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Catálogo completo</h1>
        <p className="text-xs text-gray-400">
          {filtro
            ? `${visibles.length} de ${contarProductos(catalog.length)}`
            : contarProductos(catalog.length)}
        </p>
      </header>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
        >
          <option value="nombre">Nombre</option>
          <option value="precio-asc">Precio ↑</option>
          <option value="precio-desc">Precio ↓</option>
        </select>
      </div>

      {visibles.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-10">
          Nada por aquí todavía.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibles.map((item) => (
            <ProductCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
