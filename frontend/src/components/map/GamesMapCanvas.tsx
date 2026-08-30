'use client';

import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type L from 'leaflet';
import MapAttribution from './MapAttribution';
import GamesMarkersLayer from './GamesMarkersLayer';
import LocateMeButton from './LocateMeButton';
import ZoomButtons from './ZoomButtons';
import { POLSKA, POLSKA_ZOOM } from './mapIcons';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { plural } from '@/lib/plural';
import { swipeEventId, type EventRow } from '@/lib/eventFilters';
import { useSwipe } from '@/lib/useSwipe';
import type { MyEventRelation } from '@/lib/events';
import type { EventItem } from '@/types';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Widok mapy w /wydarzenia (mobile-only, D9) — pinezki dla WSZYSTKICH
 * publicznych meczów, które przeszły filtry listy. Renderowana przez
 * `next/dynamic({ ssr: false })` w EventsListView, bo react-leaflet wymaga
 * `window`. Brak własnego fetcha ograniczonego do kadru — `rows` to już
 * gotowy, przefiltrowany zbiór z pipeline'u strony (ten sam co lista).
 */
export default function GamesMapCanvas({
  rows, statusFor,
}: {
  rows: EventRow[];
  statusFor?: (event: EventItem) => MyEventRelation | undefined;
}) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = rows.find((r) => r.event.id === selectedId) ?? null;

  // LICZNIK LICZY PINEZKI, NIE WIERSZE. Mecz bez współrzędnych nie trafia na
  // mapę (`GamesMarkersLayer` go pomija) — a licznik brał `rows.length`, więc
  // nad PUSTĄ mapą stało „12 meczy na mapie". To jest gorsze niż brak liczby:
  // czyta się jak zepsuta mapa, a jest brak lokalizacji w danych. Zgłoszone
  // wprost („na liście są, na mapie pusto").
  const zLokalizacja = rows.filter(({ event }) => event.lat != null && event.lng != null);
  const bezLokalizacji = rows.length - zLokalizacja.length;

  // Swipe w panelu przełącza na kolejny/poprzedni mecz w tej samej kolejności
  // co pinezki na mapie (ta sama tablica `rows`).
  const swipe = useSwipe(
    () => selectedRow && setSelectedId(swipeEventId(rows, selectedRow.event.id, 1)),
    () => selectedRow && setSelectedId(swipeEventId(rows, selectedRow.event.id, -1)),
  );

  const street = MAPBOX_TOKEN ? (
    <TileLayer
      attribution='&copy; Mapbox &copy; OpenStreetMap'
      url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
      tileSize={512} zoomOffset={-1}
    />
  ) : (
    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  );

  return (
    <div className="relative mx-4 mt-3 h-[65vh] min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={POLSKA}
        zoom={POLSKA_ZOOM}
        zoomControl={false}
        // Ten sam wzorzec i to samo uzasadnienie co w VenueExplorer.tsx —
        // domyślne 60 px/poziom pozwalało jednemu ruchowi kółka/trackpada
        // przeskoczyć kilka poziomów naraz.
        wheelPxPerZoomLevel={240}
        style={{ height: '100%', width: '100%' }}
        ref={setMapInstance}
      >
        <MapAttribution />
        {street}
        <GamesMarkersLayer rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[600] rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md">
        {zLokalizacja.length} {plural(zLokalizacja.length, 'mecz', 'mecze', 'meczy')} na mapie
        {bezLokalizacji > 0 && (
          <span className="text-slate-400"> · {bezLokalizacji} bez lokalizacji</span>
        )}
      </div>

      {/* Pusta mapa musi POWIEDZIEĆ, że jest pusta i dlaczego. Bez tego widać
          same kafelki i nie wiadomo, czy filtry wycięły wszystko, czy coś się
          zepsuło — a mecze cały czas są, tylko na liście. */}
      {zLokalizacja.length === 0 && rows.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[650] flex items-center justify-center p-6">
          <p className="pointer-events-auto max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-slate-600 shadow-lg">
            {rows.length === 1
              ? 'Ten mecz nie ma podanej lokalizacji, więc nie ma go na mapie.'
              : `Żaden z tych ${rows.length} meczów nie ma podanej lokalizacji, więc mapa jest pusta.`}
            <span className="mt-1 block text-xs text-slate-400">Na liście są wszystkie.</span>
          </p>
        </div>
      )}

      <LocateMeButton map={mapInstance} className="absolute right-3 bottom-3 z-[600]" />
      <ZoomButtons map={mapInstance} className="absolute left-3 bottom-3 z-[600]" />

      {selectedRow && (
        <div className="absolute inset-x-0 bottom-0 z-[700] p-3" {...swipe}>
          <EventBrowseCard
            event={selectedRow.event}
            distance={selectedRow.distance}
            relation={statusFor?.(selectedRow.event)}
          />
        </div>
      )}
    </div>
  );
}
