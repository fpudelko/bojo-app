'use client';

import { useState } from 'react';
import { Search, Target, Sun, Disc, Circle, Zap, Dumbbell, Gauge, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Header from '@/components/layout/Header';
import MapView from '@/components/map/MapView';
import { FEATURE_RESERVATIONS } from '@/config/features';

interface SportChip {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
}

// Single place to define sport icons — swap LucideIcon for custom SVG here when ready.
// Ordered: piłka nożna, siatkówka plażowa, siatkówka, koszykówka, futsal, piłka ręczna, gokarty, inne
const SPORT_CHIPS: SportChip[] = [
  { value: 'piłka nożna',       label: 'Piłka nożna',  Icon: Target,     color: '#15803d' },
  { value: 'siatkówka plażowa',  label: 'Plaża',        Icon: Sun,        color: '#d4a574' },
  { value: 'siatkówka',         label: 'Siatkówka',    Icon: Disc,       color: '#2563eb' },
  { value: 'koszykówka',        label: 'Koszykówka',   Icon: Circle,     color: '#ea580c' },
  { value: 'futsal',            label: 'Futsal',       Icon: Zap,        color: '#7c3aed' },
  { value: 'piłka ręczna',      label: 'Piłka ręczna', Icon: Dumbbell,   color: '#dc2626' },
  { value: 'gokarty',           label: 'Gokarty',      Icon: Gauge,      color: '#0d9488' },
  { value: 'inne',              label: 'Inne',         Icon: LayoutGrid, color: '#6b7280' },
];

export default function MapaPage() {
  const [activeSports, setActiveSports] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyBookable, setOnlyBookable] = useState(false);
  const [search, setSearch] = useState('');

  function toggleSport(value: string) {
    setActiveSports((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f8faf9' }}>
      <Header />

      {/* Search row */}
      <div className="bg-white border-b border-gray-100 px-3 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj boiska po nazwie lub adresie…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Sport filter chips — multi-select */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm">
        {SPORT_CHIPS.map(({ value, label, Icon, color }) => {
          const active = activeSports.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleSport(value)}
              className={[
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap',
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
              ].join(' ')}
              style={active ? { background: color, borderColor: color } : {}}
            >
              <Icon
                className="w-3.5 h-3.5 shrink-0"
                style={active ? { color: 'white' } : { color }}
              />
              {label}
            </button>
          );
        })}

        <div className="shrink-0 flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
          <span className="text-sm text-gray-600 whitespace-nowrap">Dostępne</span>
          <button
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            aria-pressed={onlyAvailable}
            className={[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-1',
              onlyAvailable ? 'bg-green-700' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                onlyAvailable ? 'translate-x-4' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>

        {FEATURE_RESERVATIONS && (
          <div className="shrink-0 flex items-center gap-2 pl-3 border-l border-gray-200">
            <span className="text-sm text-gray-600 whitespace-nowrap">Rezerwacja</span>
            <button
              onClick={() => setOnlyBookable(!onlyBookable)}
              aria-pressed={onlyBookable}
              className={[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                onlyBookable ? 'bg-blue-600' : 'bg-gray-200',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                  onlyBookable ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>
        )}

        {activeSports.length > 0 && (
          <button
            onClick={() => setActiveSports([])}
            className="shrink-0 ml-1 text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
          >
            Wyczyść
          </button>
        )}
      </div>

      {/* Map fills remaining height */}
      <main className="flex-1 relative min-h-0">
        <MapView
          sports={activeSports.length > 0 ? activeSports : undefined}
          onlyAvailable={onlyAvailable || undefined}
          onlyBookable={onlyBookable || undefined}
          search={search || undefined}
        />
      </main>
    </div>
  );
}
