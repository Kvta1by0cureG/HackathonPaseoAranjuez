import { nombrePiso, progresoPiso } from '@shared/constants.js';

export default function ScoreCard({ user }) {
  if (!user) return null;

  const { score } = user;
  // El piso mostrado es siempre el del usuario, calculado a partir de su score.
  const info = progresoPiso(score);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Tu score</p>
          <p className="text-3xl font-bold text-gray-900">{score}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-400">Nivel</p>
          <p className="text-lg font-semibold text-brand-700">
            Piso {info.floor}
          </p>
          <p className="text-xs text-gray-500">{info.label}</p>
        </div>
      </div>

      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
          style={{ width: `${info.porcentaje}%` }}
        />
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {info.faltan === 0
          ? '¡Nivel máximo alcanzado!'
          : `Te faltan ${info.faltan} pts para subir al ${nombrePiso(info.siguientePiso)}`}
      </p>
    </div>
  );
}
