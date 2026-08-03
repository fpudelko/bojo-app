'use client';

// DEAD CODE — not imported anywhere. Do not copy patterns from this file.
// The live map is components/map/VenueExplorer.tsx (route /mapa).

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

export interface EventsMapViewProps {
  className?: string;
  sports?: string[];
  dateFrom?: string;
  dateTo?: string;
}

const EventsMapImpl = dynamic(() => import('./EventsMapImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-slate-100 flex items-center justify-center">
      <div className="text-center text-slate-400">
        <MapPin className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Ładowanie mapy wydarzeń…</p>
      </div>
    </div>
  ),
});

export default function EventsMapView(props: EventsMapViewProps) {
  return <EventsMapImpl {...props} />;
}
