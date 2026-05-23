import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import MapView from '@/components/map/MapView';
import { SportType } from '@/types';

export const metadata: Metadata = {
  title: 'Mapa boisk',
  description: 'Interaktywna mapa boisk sportowych w Poznaniu.',
};

const SPORT_OPTIONS: { value: SportType | ''; label: string }[] = [
  { value: '', label: 'Wszystkie sporty' },
  { value: 'piłka nożna', label: 'Piłka nożna' },
  { value: 'koszykówka', label: 'Koszykówka' },
  { value: 'siatkówka', label: 'Siatkówka' },
  { value: 'tenis', label: 'Tenis' },
  { value: 'futsal', label: 'Futsal' },
];

export default function MapaPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-lg">Filtry</h2>
            <p className="text-xs text-gray-500 mt-1">Zawęź wyniki wyszukiwania</p>
          </div>

          <div className="p-4 space-y-5">
            {/* Sport filter */}
            <div>
              <label
                htmlFor="sport-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Rodzaj sportu
              </label>
              <select
                id="sport-select"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                defaultValue=""
              >
                {SPORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability */}
            <div className="flex items-center justify-between">
              <label htmlFor="availability-toggle" className="text-sm font-medium text-gray-700">
                Tylko dostępne
              </label>
              <button
                id="availability-toggle"
                role="switch"
                aria-checked="false"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 aria-checked:bg-primary-600"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow translate-x-1 transition-transform aria-checked:translate-x-6" />
              </button>
            </div>

            {/* Surface type */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Nawierzchnia</p>
              <div className="space-y-2">
                {[
                  { id: 'surface-all', label: 'Wszystkie', value: '' },
                  { id: 'surface-grass', label: 'Trawa naturalna', value: 'grass' },
                  { id: 'surface-artificial', label: 'Sztuczna trawa', value: 'artificial' },
                  { id: 'surface-hardcourt', label: 'Tartan / asfalt', value: 'hardcourt' },
                  { id: 'surface-clay', label: 'Korty ziemne', value: 'clay' },
                ].map((surface) => (
                  <label
                    key={surface.id}
                    htmlFor={surface.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      id={surface.id}
                      name="surface"
                      value={surface.value}
                      defaultChecked={surface.value === ''}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{surface.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Indoor / outdoor */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Lokalizacja</p>
              <div className="flex gap-2">
                {['Wszystkie', 'Zewnętrzne', 'Kryte'].map((label, idx) => (
                  <button
                    key={label}
                    className={[
                      'flex-1 py-1.5 px-2 text-xs rounded-lg border font-medium transition-colors',
                      idx === 0
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-auto p-4 border-t border-gray-100 text-xs text-gray-400">
            {/* TODO: show count from API */}
            Łącznie: — boisk
          </div>
        </aside>

        {/* Map area */}
        <main className="flex-1 relative">
          <MapView />
        </main>
      </div>
    </div>
  );
}
