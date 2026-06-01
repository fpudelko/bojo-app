'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';
import type { SportType } from '@/types';

// MapView must be loaded client-side only (maplibre-gl uses browser APIs)
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-400">
        <div className="text-4xl mb-3 animate-bounce">🗺️</div>
        <p className="text-sm">Ładowanie mapy…</p>
      </div>
    </div>
  ),
});

const SPORT_OPTIONS: { value: SportType | ''; label: string; emoji: string }[] = [
  { value: '', label: 'Wszystkie sporty', emoji: '🏃' },
  { value: 'piłka nożna', label: 'Piłka nożna', emoji: '⚽' },
  { value: 'koszykówka', label: 'Koszykówka', emoji: '🏀' },
  { value: 'siatkówka', label: 'Siatkówka', emoji: '🏐' },
  { value: 'tenis', label: 'Tenis', emoji: '🎾' },
  { value: 'futsal', label: 'Futsal', emoji: '⚽' },
];

const SURFACE_OPTIONS = [
  { value: '', label: 'Wszystkie' },
  { value: 'grass', label: 'Trawa' },
  { value: 'artificial', label: 'Sztuczna' },
  { value: 'hardcourt', label: 'Tartan/asfalt' },
  { value: 'clay', label: 'Ziemna' },
];

export default function MapaPage() {
  const [sport, setSport] = useState<SportType | ''>('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [surface, setSurface] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar toggle button (mobile) */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute top-3 left-3 z-20 md:hidden bg-white shadow rounded-full w-9 h-9 flex items-center justify-center text-gray-600 border border-gray-200"
          aria-label={sidebarOpen ? 'Ukryj filtry' : 'Pokaż filtry'}
        >
          {sidebarOpen ? '✕' : '⚙'}
        </button>

        {/* Sidebar */}
        <aside
          className={[
            'bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0 transition-all duration-200',
            'absolute md:relative z-10 h-full',
            sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-0',
          ].join(' ')}
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Filtry</h2>
              <p className="text-xs text-gray-400 mt-0.5">Zawęź wyniki</p>
            </div>
            <button
              onClick={() => { setSport(''); setOnlyAvailable(false); setSurface(''); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Resetuj
            </button>
          </div>

          <div className="p-4 space-y-5 overflow-y-auto">
            {/* Sport */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Rodzaj sportu</p>
              <div className="space-y-1">
                {SPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSport(opt.value as SportType | '')}
                    className={[
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                      sport === opt.value
                        ? 'bg-green-600 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Availability toggle */}
            <div className="flex items-center justify-between py-1">
              <label htmlFor="availability-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                Tylko dostępne
              </label>
              <button
                id="availability-toggle"
                role="switch"
                aria-checked={onlyAvailable}
                onClick={() => setOnlyAvailable((v) => !v)}
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
                  onlyAvailable ? 'bg-green-600' : 'bg-gray-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    onlyAvailable ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>

            {/* Surface */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Nawierzchnia</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SURFACE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSurface(opt.value)}
                    className={[
                      'py-1.5 px-2 text-xs rounded-lg border font-medium transition-colors',
                      surface === opt.value
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-400',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <MapView
            sport={sport || undefined}
            onlyAvailable={onlyAvailable || undefined}
            surface={surface || undefined}
          />
        </main>
      </div>
    </div>
  );
}
