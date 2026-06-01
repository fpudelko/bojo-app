'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';

const POZNAN_CENTER: [number, number] = [16.9252, 52.4064];
// OpenFreeMap — completely free, no token, production-ready
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽',
  'koszykówka': '🏀',
  'siatkówka': '🏐',
  'tenis': '🎾',
  'futsal': '⚽',
  'wielofunkcyjne': '🏃',
};

interface MapViewProps {
  className?: string;
  sport?: string;
  onlyAvailable?: boolean;
  surface?: string;
}

export default function MapView({ className, sport, onlyAvailable, surface }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof import('maplibre-gl')['Map']['prototype']['constructor']> | null>(null);
  const markersRef = useRef<{ remove: () => void }[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFields({
        sport: sport || undefined,
        available: onlyAvailable || undefined,
        surface: surface || undefined,
      });
      setFields(res.fields);
    } catch {
      setError('Nie udało się załadować boisk. Sprawdź połączenie z API.');
    } finally {
      setLoading(false);
    }
  }, [sport, onlyAvailable, surface]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: InstanceType<typeof import('maplibre-gl').Map>;

    import('maplibre-gl').then((maplibre) => {
      import('maplibre-gl/dist/maplibre-gl.css' as string);

      map = new maplibre.Map({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: POZNAN_CENTER,
        zoom: 12,
        attributionControl: true,
      });

      map.addControl(new maplibre.NavigationControl(), 'top-right');
      map.addControl(
        new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        'top-right',
      );

      mapRef.current = map as unknown as typeof mapRef.current;
    });

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current as unknown as import('maplibre-gl').Map | null;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    import('maplibre-gl').then((maplibre) => {
      fields.forEach((field) => {
        const emoji = field.sport?.[0] ? (SPORT_EMOJI[field.sport[0]] ?? '📍') : '📍';

        const el = document.createElement('div');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', field.name);
        el.style.cssText = `
          width: 36px; height: 36px; border-radius: 50%;
          background: ${field.available ? '#16a34a' : '#9ca3af'};
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; cursor: pointer;
          transition: transform 0.15s;
        `;
        el.textContent = emoji;
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
        el.addEventListener('click', () => setSelectedField(field));

        const marker = new maplibre.Marker({ element: el, anchor: 'center' })
          .setLngLat([field.lng, field.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    });
  }, [fields]);

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-md px-4 py-2 text-sm text-gray-600 flex items-center gap-2">
          <span className="animate-spin">⟳</span> Ładowanie boisk…
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 rounded-lg shadow px-4 py-2 text-sm text-red-600 max-w-xs text-center">
          {error}
        </div>
      )}

      {!loading && !error && fields.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-full shadow-md px-3 py-1.5 text-xs font-medium text-gray-600">
          {fields.length} boisk
        </div>
      )}

      {selectedField && (
        <div className="absolute bottom-6 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
          <button
            onClick={() => setSelectedField(null)}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full text-sm"
            aria-label="Zamknij"
          >
            ✕
          </button>

          <h3 className="font-semibold text-gray-900 pr-6 text-sm leading-snug">
            {selectedField.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{selectedField.address}</p>

          <div className="flex gap-1.5 mt-2 flex-wrap">
            {selectedField.sport.map((s) => (
              <span key={s} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {s}
              </span>
            ))}
            {selectedField.surface && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {selectedField.surface}
              </span>
            )}
            {selectedField.isIndoor && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                kryty
              </span>
            )}
          </div>

          <div className="mt-2">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                selectedField.available
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {selectedField.available ? '● Dostępne' : '● Niedostępne'}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            {selectedField.phone && (
              <a
                href={`tel:${selectedField.phone}`}
                className="flex-1 text-center text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
              >
                📞 Zadzwoń
              </a>
            )}
            {selectedField.website && (
              <a
                href={selectedField.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 transition-colors"
              >
                🌐 Strona
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
