import { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../components/Spinner.jsx';

const TABS = [
  { id: 'weather',  label: '🌤 Clima',       url: '/api/weather/history/weather',          cols: ['city', 'country', 'temperature', 'description', 'timestamp'] },
  { id: 'location', label: '📍 Localização', url: '/api/location/location/history',        cols: ['ip', 'city', 'country', 'lat', 'lon', 'timestamp'] },
  { id: 'person',   label: '🎂 Pessoas',     url: '/api/person/person/history',            cols: ['name', 'birthdate', 'age_years', 'zodiac_sign', 'timestamp'] },
];

export default function History() {
  const [tab, setTab]       = useState('weather');
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const current = TABS.find((t) => t.id === tab);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: rows } = await axios.get(current.url + '?limit=20');
      setData(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar histórico');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const fmt = (val, col) => {
    if (val === null || val === undefined) return '—';
    if (col === 'timestamp') return new Date(val).toLocaleString('pt-BR');
    if (typeof val === 'number') return val.toLocaleString('pt-BR');
    return String(val);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🗂 Histórico de Consultas</h1>

      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-gray-400 hover:text-white text-sm">↻ Atualizar</button>
      </div>

      {loading && <Spinner text="Carregando histórico..." />}
      {error   && <div className="card border-red-800 bg-red-950/30 text-red-400">{error}</div>}

      {!loading && !error && data.length === 0 && (
        <div className="card text-center text-gray-500 py-12">Nenhum registro encontrado. Faça uma consulta primeiro.</div>
      )}

      {!loading && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {current.cols.map((col) => (
                  <th key={col} className="text-left px-4 py-3 text-gray-400 font-medium uppercase text-xs whitespace-nowrap">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  {current.cols.map((col) => (
                    <td key={col} className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {fmt(row[col], col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
