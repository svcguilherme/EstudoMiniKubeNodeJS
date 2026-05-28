import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import Spinner from '../components/Spinner.jsx';
import MetricCard from '../components/MetricCard.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PROMETHEUS_BASE = import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9090';

const queryPrometheus = async (query) => {
  try {
    const { data } = await axios.get(`${PROMETHEUS_BASE}/api/v1/query`, { params: { query } });
    return data.data?.result || [];
  } catch {
    return [];
  }
};

const parseMetric = (result) => {
  if (!result.length) return '—';
  return parseFloat(result[0].value[1]).toFixed(2);
};

export default function Telemetry() {
  const [metrics, setMetrics]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchMetrics = async () => {
    setLoading(true);
    const [weatherReqs, locationReqs, personReqs,
           weatherDur, locationDur, personDur,
           cacheHits, cacheMisses] = await Promise.all([
      queryPrometheus('sum(http_requests_total{route="/weather"})'),
      queryPrometheus('sum(http_requests_total{route="/location"})'),
      queryPrometheus('sum(http_requests_total{route="/person"})'),
      queryPrometheus('histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{route="/weather"}[5m]))'),
      queryPrometheus('histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{route="/location"}[5m]))'),
      queryPrometheus('histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{route="/person"}[5m]))'),
      queryPrometheus('sum(cache_hits_total)'),
      queryPrometheus('sum(cache_misses_total)'),
    ]);

    setMetrics({
      weatherReqs:   parseMetric(weatherReqs),
      locationReqs:  parseMetric(locationReqs),
      personReqs:    parseMetric(personReqs),
      weatherDur:    parseMetric(weatherDur),
      locationDur:   parseMetric(locationDur),
      personDur:     parseMetric(personDur),
      cacheHits:     parseMetric(cacheHits),
      cacheMisses:   parseMetric(cacheMisses),
    });

    setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const barData = metrics && {
    labels: ['api-weather', 'api-location', 'api-person'],
    datasets: [{
      label: 'Total de Requisições',
      data: [metrics.weatherReqs, metrics.locationReqs, metrics.personReqs],
      backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(16,185,129,0.7)', 'rgba(168,85,247,0.7)'],
      borderColor:     ['#3b82f6', '#10b981', '#a855f7'],
      borderWidth: 1,
    }],
  };

  const cacheHitsNum   = parseFloat(metrics?.cacheHits)   || 0;
  const cacheMissesNum = parseFloat(metrics?.cacheMisses) || 0;
  const total          = cacheHitsNum + cacheMissesNum;
  const hitRate        = total > 0 ? ((cacheHitsNum / total) * 100).toFixed(1) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📊 Telemetria</h1>
        <div className="flex items-center gap-3">
          {lastUpdate && <span className="text-gray-500 text-xs">Atualizado: {lastUpdate}</span>}
          <button className="btn-primary text-sm py-1 px-4" onClick={fetchMetrics} disabled={loading}>
            Atualizar
          </button>
        </div>
      </div>

      <div className="card">
        <p className="text-gray-400 text-sm">
          Dados consultados via <span className="text-blue-400 font-mono">Prometheus</span>.
          Configure <span className="font-mono text-yellow-400">VITE_PROMETHEUS_URL</span> no .env para apontar para o Prometheus do cluster.
          Auto-refresh a cada 30 segundos.
        </p>
      </div>

      {loading && <Spinner text="Consultando Prometheus..." />}

      {metrics && (
        <>
          <div>
            <h2 className="text-sm uppercase text-gray-500 mb-3">Total de Requisições</h2>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="api-weather"  value={metrics.weatherReqs}  color="blue"   icon="🌤" />
              <MetricCard label="api-location" value={metrics.locationReqs} color="green"  icon="📍" />
              <MetricCard label="api-person"   value={metrics.personReqs}   color="purple" icon="🎂" />
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-gray-500 mb-3">Latência P95 (segundos)</h2>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="api-weather"  value={metrics.weatherDur}  unit="s" color="yellow" icon="⏱" />
              <MetricCard label="api-location" value={metrics.locationDur} unit="s" color="yellow" icon="⏱" />
              <MetricCard label="api-person"   value={metrics.personDur}   unit="s" color="yellow" icon="⏱" />
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-gray-500 mb-3">Cache Redis</h2>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Hits"    value={metrics.cacheHits}   color="green" icon="✅" />
              <MetricCard label="Misses"  value={metrics.cacheMisses} color="red"   icon="❌" />
              <MetricCard label="Hit Rate" value={hitRate}            unit="%"      color="blue" icon="📈" />
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Requisições por Serviço</h3>
            <Bar
              data={barData}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
                  y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' }, beginAtZero: true },
                },
              }}
            />
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">Links Externos</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                Grafana →
              </a>
              <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                Prometheus →
              </a>
              <a href="http://localhost:15672" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                RabbitMQ Management →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
