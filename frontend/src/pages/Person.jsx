import { useState } from 'react';
import axios from 'axios';
import MetricCard from '../components/MetricCard.jsx';
import Spinner    from '../components/Spinner.jsx';

export default function Person() {
  const [name, setName]         = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const calculate = async () => {
    if (!name.trim() || !birthdate) return;
    setLoading(true);
    setError('');
    try {
      const { data: result } = await axios.post('/api/person/person', { name, birthdate });
      setData(result);
    } catch (err) {
      const errs = err.response?.data?.errors;
      setError(errs ? errs.map((e) => e.msg).join(', ') : (err.response?.data?.error || 'Erro ao calcular idade'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🎂 Calculadora de Idade</h1>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome completo</label>
            <input
              className="input-field"
              placeholder="João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Data de nascimento</label>
            <input
              type="date"
              className="input-field"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
        <button className="btn-primary" onClick={calculate} disabled={loading || !name || !birthdate}>
          Calcular
        </button>
      </div>

      {loading && <Spinner text="Calculando..." />}
      {error   && <div className="card border-red-800 bg-red-950/30 text-red-400">{error}</div>}

      {data && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">
              {data.is_birthday_today ? '🎉' : '👤'}
            </span>
            <div>
              <h2 className="text-xl font-bold">{data.name}</h2>
              <p className="text-gray-400">Nascido em {new Date(data.birthdate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              {data.is_birthday_today && (
                <span className="badge bg-yellow-900 text-yellow-300 border border-yellow-700 mt-1">
                  🎉 Feliz Aniversário!
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard label="Anos"         value={data.age_years}          color="blue"   icon="📅" />
            <MetricCard label="Meses (+)"     value={data.age_months}        color="blue"   icon="🗓" />
            <MetricCard label="Dias (+)"      value={data.age_days}          color="blue"   icon="📆" />
            <MetricCard label="Total de Dias" value={data.total_days?.toLocaleString('pt-BR')} color="purple" icon="⏳" />
            <MetricCard label="Signo"         value={data.zodiac_sign}       color="yellow" icon="⭐" />
            <MetricCard label="Dias p/ aniv." value={data.days_until_birthday} color="green" icon="🎁" />
          </div>
        </div>
      )}
    </div>
  );
}
