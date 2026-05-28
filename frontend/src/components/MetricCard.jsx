export default function MetricCard({ label, value, unit = '', color = 'blue', icon = '' }) {
  const colorMap = {
    blue:   'text-blue-400  border-blue-800  bg-blue-950/30',
    green:  'text-green-400 border-green-800 bg-green-950/30',
    yellow: 'text-yellow-400 border-yellow-800 bg-yellow-950/30',
    red:    'text-red-400   border-red-800   bg-red-950/30',
    purple: 'text-purple-400 border-purple-800 bg-purple-950/30',
  };

  return (
    <div className={`border rounded-xl p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{icon} {label}</p>
      <p className="text-2xl font-bold">
        {value ?? '—'}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}
