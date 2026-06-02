'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import MapView from '@/components/map/MapView';
import type { SportType } from '@/types';

const SPORT_OPTIONS: { value: SportType | ''; label: string }[] = [
  { value: '', label: 'Wszystkie' },
  { value: 'piłka nożna', label: 'Piłka nożna' },
  { value: 'futsal', label: 'Futsal' },
  { value: 'koszykówka', label: 'Koszykówka' },
  { value: 'siatkówka', label: 'Siatkówka' },
];

export default function MapaPage() {
  const [sport, setSport] = useState<SportType | ''>('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      {/* Filter bar — horizontal pills, scrollable on mobile, never covers the map */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0 z-10 shadow-sm">
        {SPORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSport(opt.value)}
            className={[
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap',
              sport === opt.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}

        <div className="shrink-0 flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
          <span className="text-sm text-gray-600 whitespace-nowrap">Dostępne</span>
          <button
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            aria-pressed={onlyAvailable}
            className={[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
              onlyAvailable ? 'bg-primary-600' : 'bg-gray-200',
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
      </div>

      {/* Map — fills remaining height, never obscured by filters */}
      <main className="flex-1 relative min-h-0">
        <MapView
          sport={sport || undefined}
          onlyAvailable={onlyAvailable || undefined}
        />
      </main>
    </div>
  );
}
