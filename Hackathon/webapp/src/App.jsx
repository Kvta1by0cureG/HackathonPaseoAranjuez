import { useState } from 'react';
import { useSession } from './hooks/useSession.js';
import Dashboard from './pages/Dashboard.jsx';
import Catalog from './pages/Catalog.jsx';

export default function App() {
  const { cargando, error, reintentable, user, catalog } = useSession();
  const [tab, setTab] = useState('dashboard');

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando tu panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm">
          <p className="text-lg font-semibold text-gray-900">No pudimos abrir tu panel</p>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
          <p className="text-xs text-gray-400 mt-4">
            {reintentable
              ? 'Espera un momento y recarga la página.'
              : 'Vuelve a WhatsApp y pide un nuevo enlace.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Las dos páginas siguen montadas: al cambiar de pestaña se conservan
          el piso explorado y el texto de búsqueda. */}
      <div hidden={tab !== 'dashboard'}>
        <Dashboard user={user} catalog={catalog} />
      </div>
      <div hidden={tab !== 'catalog'}>
        <Catalog catalog={catalog} />
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto grid grid-cols-2">
          <button
            onClick={() => setTab('dashboard')}
            aria-current={tab === 'dashboard' ? 'page' : undefined}
            className={`py-3 text-sm font-medium ${tab === 'dashboard' ? 'text-brand-700' : 'text-gray-400'}`}
          >
            Inicio
          </button>
          <button
            onClick={() => setTab('catalog')}
            aria-current={tab === 'catalog' ? 'page' : undefined}
            className={`py-3 text-sm font-medium ${tab === 'catalog' ? 'text-brand-700' : 'text-gray-400'}`}
          >
            Catálogo
          </button>
        </div>
      </nav>
    </div>
  );
}
