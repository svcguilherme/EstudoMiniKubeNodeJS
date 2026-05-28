import { useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import MetricCard from '../components/MetricCard.jsx';
import Spinner    from '../components/Spinner.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Weather() {
  const [city, setCity]         = useState('');
  const [current, setCurrent]   = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const search = async () => {
    if (!city.trim()) return;
    setLoading(true);
    setError('');
    try {
      const [cur, fore] = await Promise.all([
        axios.get(`/api/weather/weather?city=${encodeURIComponent(city)}`),
        axios.get(`/api/forecast/?city=${encodeURIComponent(city)}&days=5`),
      ]);
      setCurrent(cur.data);
      setForecast(fore.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar dados de clima');
    } finally {
      setLoading(false);
    }
  };

  const chartData = forecast && {
    labels: forecast.forecast.map((d) => d.date),
    datasets: [
      {
        label: 'Máx (°C)',
        data: forecast.forecast.map((d) => d.temp_max),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Mín (°C)',
        data: forecast.forecast.map((d) => d.temp_min),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🌤 Consulta de Clima</h1>

      <div className="card flex gap-3">
        <input
          className="input-field"
          placeholder="Digite o nome da cidade (ex: São Paulo)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn-primary whitespace-nowrap" onClick={search} disabled={loading}>
          Buscar
        </button>
      </div>

      {loading && <Spinner text="Consultando clima..." />}
      {error   && <div className="card border-red-800 bg-red-950/30 text-red-400">{error}</div>}

      {current && (
        <>
          <div className="card">
            <div className="flex items-center gap-4 mb-4">
              <img src={current.icon} alt={current.description} className="w-16 h-16" />
              <div>
                <h2 className="text-xl font-bold">{current.city}, {current.country}</h2>
                <p className="text-gray-400 capitalize">{current.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Temperatura" value={current.temperature?.toFixed(1)} unit="°C" color="yellow" icon="🌡" />
              <MetricCard label="Sensação"    value={current.feels_like?.toFixed(1)}  unit="°C" color="blue"   icon="🤔" />
              <MetricCard label="Humidade"    value={current.humidity}                unit="%"  color="blue"   icon="💧" />
              <MetricCard label="Vento"       value={current.wind_speed}              unit="m/s" color="green" icon="💨" />
            </div>
            <p className="text-gray-600 text-xs mt-3">Atualizado: {new Date(current.timestamp).toLocaleString('pt-BR')} · Fonte: {current.source}</p>
          </div>

          {forecast && (
            <div className="card">
              <h3 className="font-semibold mb-4">Previsão para 5 dias</h3>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  plugins: { legend: { labels: { color: '#9ca3af' } } },
                  scales: {
                    x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
                    y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
                  },
                }}
              />
              <div className="mt-4 grid grid-cols-5 gap-2">
                {forecast.forecast.map((day) => (
                  <div key={day.date} className="text-center text-xs">
                    <p className="text-gray-400">{day.date.slice(5)}</p>
                    <img src={day.icon} alt="" className="w-8 h-8 mx-auto" />
                    <p className="text-yellow-400">{day.temp_max?.toFixed(0)}°</p>
                    <p className="text-blue-400">{day.temp_min?.toFixed(0)}°</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
