'use client';

import { useState, useCallback } from 'react';
import { Search, Target, Sun, Disc, Circle, Dumbbell, Star, MapPin, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Header from '@/components/layout/Header';
import MapView from '@/components/map/MapView';
import EventsMapView from '@/components/map/EventsMapView';
import { FEATURE_RESERVATIONS } from '@/config/features';
import { PUBLIC_DATA_FILTERS, type DataKey } from '@/lib/fieldFilters';

interface SportChip {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
}

// Single place to define sport icons — swap LucideIcon for custom SVG here when ready (TODO: grafik).
// Futsal i gokarty usunięte z filtrów per spec.
const SPORT_CHIPS: SportChip[] = [
  { value: 'piłka nożna',       label: 'Piłka nożna',       Icon: Target,   color: '#15803d' },
  { value: 'siatkówka plażowa', label: 'Siatkówka plażowa', Icon: Sun,      color: '#d97706' }, // piaskowy — inny niż siatkówka
  { value: 'siatkówka',         label: 'Siatkówka',         Icon: Disc,     color: '#2563eb' }, // niebieski
  { value: 'koszykówka',        label: 'Koszykówka',        Icon: Circle,   color: '#ea580c' },
  { value: 'piłka ręczna',      label: 'Piłka ręczna',      Icon: Dumbbell, color: '#dc2626' },
  { value: 'inne',              label: 'Inne',              Icon: Star,     color: '#6b7280' }, // Star — neutralne, nie sugeruje zawodów
];

type MapTab = 'boiska' | 'mecze';

export default function MapaPage() {
  const [mapTab, setMapTab] = useState<MapTab>('boiska');
  const [activeSports, setActiveSports] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyBookable, setOnlyBookable] = useState(false);
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [dataKeys, setDataKeys] = useState<DataKey[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  const onDistrictsLoaded = useCallback((d: string[]) => setDistricts(d), []);

  function toggleSport(value: string) {
    setActiveSports((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function toggleData(value: DataKey) {
    setDataKeys((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas">
      <Header />

      {/* Map type tabs */}
      <div className="bg-white border-b border-slate-200/70 px-3 pt-2.5 pb-0 flex items-end gap-1">
        <button
          onClick={() => setMapTab('boiska')}
          className={[
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-xl border border-b-0 transition-colors',
            mapTab === 'boiska'
              ? 'bg-white border-slate-200 text-ink z-10 -mb-px'
              : 'bg-slate-50 border-transparent text-slate-500 hover:text-ink',
          ].join(' ')}
        >
          <MapPin className="w-3.5 h-3.5" /> Boiska
        </button>
        <button
          onClick={() => setMapTab('mecze')}
          className={[
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-xl border border-b-0 transition-colors',
            mapTab === 'mecze'
              ? 'bg-white border-slate-200 text-ink z-10 -mb-px'
              : 'bg-slate-50 border-transparent text-slate-500 hover:text-ink',
          ].join(' ')}
        >
          <Calendar className="w-3.5 h-3.5" /> Mecze
        </button>
      </div>

      {/* Search row — only for Boiska tab */}
      {mapTab === 'boiska' && (
        <div className="bg-white border-b border-slate-100 px-3 pt-2 pb-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj boiska po nazwie lub adresie…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-shadow"
              />
            </div>
            {districts.length > 0 && (
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="shrink-0 max-w-[45%] px-3 py-2 text-sm border border-slate-200 rounded-xl bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">Wszystkie dzielnice</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
          {/* Data filters (multi-select) */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-slate-400 shrink-0">Z danymi:</span>
            {PUBLIC_DATA_FILTERS.map(({ key, label }) => {
              const active = dataKeys.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleData(key)}
                  aria-pressed={active}
                  className={[
                    'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary-700 text-white border-primary-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
            {(dataKeys.length > 0 || district) && (
              <button
                onClick={() => { setDataKeys([]); setDistrict(''); }}
                className="shrink-0 text-xs text-slate-400 hover:text-slate-600 underline ml-1"
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sport filter chips — shared for both tabs */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm">
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
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
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

        {mapTab === 'boiska' && (
          <div className="shrink-0 flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
            <span className="text-sm text-slate-600 whitespace-nowrap">Dostępne</span>
            <button
              onClick={() => setOnlyAvailable(!onlyAvailable)}
              aria-pressed={onlyAvailable}
              className={[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-700 focus:ring-offset-1',
                onlyAvailable ? 'bg-primary-700' : 'bg-slate-200',
              ].join(' ')}
            >
              <span className={['inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', onlyAvailable ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
            </button>
          </div>
        )}

        {mapTab === 'boiska' && FEATURE_RESERVATIONS && (
          <div className="shrink-0 flex items-center gap-2 pl-3 border-l border-slate-200">
            <span className="text-sm text-slate-600 whitespace-nowrap">Rezerwacja</span>
            <button
              onClick={() => setOnlyBookable(!onlyBookable)}
              aria-pressed={onlyBookable}
              className={[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                onlyBookable ? 'bg-blue-600' : 'bg-slate-200',
              ].join(' ')}
            >
              <span className={['inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', onlyBookable ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
            </button>
          </div>
        )}

        {activeSports.length > 0 && (
          <button
            onClick={() => setActiveSports([])}
            className="shrink-0 ml-1 text-xs text-slate-400 hover:text-slate-600 underline whitespace-nowrap"
          >
            Wyczyść
          </button>
        )}
      </div>

      {/* Map fills remaining height */}
      <main className="flex-1 relative min-h-0">
        {mapTab === 'boiska' ? (
          <MapView
            sports={activeSports.length > 0 ? activeSports : undefined}
            onlyAvailable={onlyAvailable || undefined}
            onlyBookable={onlyBookable || undefined}
            search={search || undefined}
            district={district || undefined}
            dataKeys={dataKeys.length > 0 ? dataKeys : undefined}
            onDistrictsLoaded={onDistrictsLoaded}
          />
        ) : (
          <EventsMapView
            sports={activeSports.length > 0 ? activeSports : undefined}
          />
        )}
      </main>
    </div>
  );
}
