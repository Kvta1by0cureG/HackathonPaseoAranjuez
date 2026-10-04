export default function ProductCard({ item }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-40 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          Sin imagen
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-brand-700 font-bold">
            ${Number(item.price || 0).toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">Piso {item.floor}</span>
        </div>
      </div>
    </div>
  );
}