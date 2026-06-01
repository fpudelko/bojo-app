'use client';

// TODO: implement full Mapbox GL JS map
// Dependencies: react-map-gl, mapbox-gl
// Requires: NEXT_PUBLIC_MAPBOX_TOKEN env variable
//
// Implementation checklist:
//  1. Import Map, Marker, Popup from 'react-map-gl'
//  2. Import 'mapbox-gl/dist/mapbox-gl.css' in layout or this file
//  3. Fetch fields from API and render <Marker> for each
//  4. On marker click, show <Popup> with FieldCard details
//  5. Add navigation controls (NavigationControl)
//  6. Center on Poznań: lng=16.9252, lat=52.4064, zoom=12

import { MapPin } from 'lucide-react';

interface MapViewProps {
  className?: string;
}

export default function MapView({ className }: MapViewProps) {
  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

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
        <p className="font-semibold text-lg text-gray-600">
          {hasToken ? 'Mapa wczytuje się…' : 'Mapa niedostępna'}
        </p>
        <p className="text-sm mt-1 max-w-xs mx-auto">
          {hasToken
            ? 'Inicjalizacja Mapbox GL JS…'
            : 'Ustaw zmienną NEXT_PUBLIC_MAPBOX_TOKEN aby wyświetlić mapę.'}
        </p>
        {!hasToken && (
          <a
            href="https://account.mapbox.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-primary-600 underline"
          >
            Uzyskaj token Mapbox →
          </a>
        )}
      </div>
    </div>
  );
}
