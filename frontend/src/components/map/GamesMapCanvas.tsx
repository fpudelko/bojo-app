'use client';

import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import MapAttribution from './MapAttribution';
import GamesMarkersLayer from './GamesMarkersLayer';
import { POLSKA, POLSKA_ZOOM } from './mapIcons';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { plural } from '@/lib/plural';
import type { EventRow } from '@/lib/eventFilters';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = rows.find((r) => r.event.id === selectedId) ?? null;

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
      <MapContainer center={POLSKA} zoom={POLSKA_ZOOM} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <MapAttribution />
        {street}
        <GamesMarkersLayer rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[600] rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md">
        {rows.length} {plural(rows.length, 'mecz', 'mecze', 'meczy')} na mapie
      </div>

      {selectedRow && (
        <div className="absolute inset-x-0 bottom-0 z-[700] p-3">
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
