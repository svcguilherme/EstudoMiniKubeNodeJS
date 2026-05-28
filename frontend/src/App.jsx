import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar   from './components/Navbar.jsx';
import Home     from './pages/Home.jsx';
import Weather  from './pages/Weather.jsx';
import Location from './pages/Location.jsx';
import Person   from './pages/Person.jsx';
import Telemetry from './pages/Telemetry.jsx';
import History  from './pages/History.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/weather"   element={<Weather />} />
            <Route path="/location"  element={<Location />} />
            <Route path="/person"    element={<Person />} />
            <Route path="/telemetry" element={<Telemetry />} />
            <Route path="/history"   element={<History />} />
          </Routes>
        </main>
        <footer className="text-center text-gray-600 text-sm py-4 border-t border-gray-800">
          TemperaturaVS2 — Node.js · Kubernetes · RabbitMQ · Redis · MongoDB · SQLite
        </footer>
      </div>
    </BrowserRouter>
  );
}
