import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',          label: 'Home' },
  { to: '/weather',   label: 'Clima' },
  { to: '/location',  label: 'Localização' },
  { to: '/person',    label: 'Pessoa' },
  { to: '/telemetry', label: 'Telemetria' },
  { to: '/history',   label: 'Histórico' },
];

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
        <span className="text-blue-400 font-bold text-lg tracking-tight">🌡 TemperaturaVS2</span>
        <ul className="flex gap-1">
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
