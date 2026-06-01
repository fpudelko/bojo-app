'use client';

import { useEffect, useMemo, useState } from 'react';
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl';
import { MapPin } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Field, SportType } from '@/types';
import { getFields } from '@/lib/api';

// Center on Poznań
const POZNAN = { longitude: 16.9252, latitude: 52.4064, zoom: 12 };

interface MapViewProps {
  className?: string;
  /** Optional sport filter forwarded to the API. */
  sport?: SportType;
  /** Show only available fields. */
  onlyAvailable?: boolean;
}

export default function MapView({ className, sport, onlyAvailable }: MapViewProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getFields({ sport, available: onlyAvailable })
      .then((res) => {
        if (!cancelled) setFields(res.fields);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Błąd pobierania boisk');
      });

    return () => {
      cancelled = true;
    };
  }, [token, sport, onlyAvailable]);

  const markers = useMemo(
    () =>
      fields.map((field) => (
        <Marker
          key={field.id}
          longitude={field.lng}
          latitude={field.lat}
          anchor="bottom"
          onClick={(e) => {
            // Prevent the map's onClick from immediately closing the popup
            e.originalEvent.stopPropagation();
            setSelected(field);
          }}
        >
          <MapPin
            className={[
              'w-7 h-7 cursor-pointer drop-shadow-md transition-transform hover:scale-110',
              field.available ? 'text-primary-600' : 'text-gray-400',
            ].join(' ')}
            fill="currentColor"
            strokeWidth={1.5}
          />
        </Marker>
      )),
    [fields],
  );

  // No token configured — keep the helpful fallback UI.
  if (!token) {
    return (
      <div
        className={[
          'w-full h-full min-h-[400px] bg-gray-100 flex items-center justify-center',
          className ?? '',
        ].join(' ')}
        role="img"
        aria-label="Mapa boisk sportowych w Poznaniu"
      >
        <div className="text-center text-gray-500 p-8">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-lg text-gray-600">Mapa niedostępna</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">
            Ustaw zmienną NEXT_PUBLIC_MAPBOX_TOKEN aby wyświetlić mapę.
          </p>
          <a
            href="https://account.mapbox.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-primary-600 underline"
          >
            Uzyskaj token Mapbox →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={['w-full h-full min-h-[400px] relative', className ?? ''].join(' ')}>
      <Map
        mapboxAccessToken={token}
        initialViewState={POZNAN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelected(null)}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" trackUserLocation />

        {markers}

        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            onClose={() => setSelected(null)}
            closeOnClick={false}
            maxWidth="280px"
          >
            <div className="p-1">
              <h3 className="font-semibold text-gray-900 text-sm">{selected.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selected.address}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {selected.sport.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-[11px]"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="text-xs mt-2">
                <span
                  className={selected.available ? 'text-green-600' : 'text-gray-400'}
                >
                  {selected.available ? '● Dostępne' : '● Niedostępne'}
                </span>
                <span className="text-gray-400"> · {selected.surface}</span>
              </p>
              {selected.website && (
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-primary-600 underline"
                >
                  Strona boiska →
                </a>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 shadow">
          Nie udało się pobrać boisk: {error}
        </div>
      )}
    </div>
  );
}
