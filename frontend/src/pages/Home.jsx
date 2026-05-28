import { Link } from 'react-router-dom';

const services = [
  { path: '/weather',   icon: '🌤', title: 'Clima',       desc: 'Temperatura atual e previsão por cidade', color: 'blue' },
  { path: '/location',  icon: '📍', title: 'Localização', desc: 'Geolocalização via IP do usuário',        color: 'green' },
  { path: '/person',    icon: '🎂', title: 'Pessoa',       desc: 'Calcule idade, signo e aniversário',     color: 'purple' },
  { path: '/telemetry', icon: '📊', title: 'Telemetria',   desc: 'Métricas em tempo real dos serviços',   color: 'yellow' },
  { path: '/history',   icon: '🗂',  title: 'Histórico',   desc: 'Todas as consultas realizadas',          color: 'gray' },
];

const stack = [
  ['Node.js', 'APIs REST'],
  ['Kubernetes', 'Orquestração'],
  ['RabbitMQ', 'Event-Driven'],
  ['Redis', 'Cache'],
  ['MongoDB', 'Consultas JSON'],
  ['SQLite', 'Transações'],
  ['Prometheus', 'Métricas'],
  ['Grafana', 'Dashboards'],
  ['OpenTelemetry', 'Tracing'],
];

export default function Home() {
  return (
    <div className="space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-white">🌡 TemperaturaVS2</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Plataforma de microsserviços distribuídos rodando em Kubernetes (Minikube),
          demonstrando event-driven, cache, observabilidade e persistência.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(({ path, icon, title, desc }) => (
          <Link key={path} to={path}
            className="card hover:border-blue-700 hover:bg-gray-800 transition-all group"
          >
            <div className="text-3xl mb-2">{icon}</div>
            <h2 className="font-semibold text-white group-hover:text-blue-400 transition-colors">{title}</h2>
            <p className="text-gray-400 text-sm mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-300 mb-3 text-sm uppercase tracking-wide">Stack Tecnológico</h2>
        <div className="flex flex-wrap gap-2">
          {stack.map(([tech, role]) => (
            <span key={tech} className="badge bg-gray-800 text-gray-300 border border-gray-700 px-3 py-1 rounded-full text-xs">
              <span className="text-blue-400 font-medium">{tech}</span>
              <span className="text-gray-500 ml-1">· {role}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
