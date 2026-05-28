import { useState } from 'react';
import axios from 'axios';
import MetricCard from '../components/MetricCard.jsx';
import Spinner    from '../components/Spinner.jsx';

export default function Location() {
  const [data, setData]     = useState(null);
  const [ip, setIp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const lookup = async (customIp = '') => {
    setLoading(true);
    setError('');
    try {
      const url = customIp
        ? `/api/location/location?ip=${encodeURIComponent(customIp)}`
        : '/api/location/location';
      const { data: loc } = await axios.get(url);
      setData(loc);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar localização');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📍 Localização por IP</h1>

      <div className="card flex gap-3">
        <input
          className="input-field"
          placeholder="IP específico (deixe vazio para usar o seu)"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookup(ip)}
        />
        <button className="btn-primary whitespace-nowrap" onClick={() => lookup(ip)} disabled={loading}>
          Localizar
        </button>
      </div>

      {loading && <Spinner text="Consultando localização..." />}
      {error   && <div className="card border-red-800 bg-red-950/30 text-red-400">{error}</div>}

      {data && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📌</span>
            <div>
              <h2 className="text-xl font-bold">{data.city}, {data.region}</h2>
              <p className="text-gray-400">{data.country} ({data.countryCode}) · {data.zip}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard label="Latitude"  value={data.lat}      color="green"  icon="🧭" />
            <MetricCard label="Longitude" value={data.lon}      color="green"  icon="🧭" />
            <MetricCard label="IP"        value={data.ip}       color="blue"   icon="🌐" />
            <MetricCard label="Fuso"      value={data.timezone} color="purple" icon="🕐" />
            <MetricCard label="ISP"       value={data.isp}      color="gray"   icon="📡" />
            <MetricCard label="Org"       value={data.org}      color="gray"   icon="🏢" />
          </div>

          {data.lat && data.lon && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${data.lat}&mlon=${data.lon}&zoom=12`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              Ver no mapa →
            </a>
          )}

          <p className="text-gray-600 text-xs">Fonte: {data.source} · {new Date(data.timestamp).toLocaleString('pt-BR')}</p>
        </div>
      )}
    </div>
  );
}
