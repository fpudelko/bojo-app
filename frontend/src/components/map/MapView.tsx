'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import type { DataKey } from '@/lib/fieldFilters';
export interface MapViewProps {
  className?: string;
  sports?: string[];       // undefined = all; array = multi-select filter
  onlyAvailable?: boolean;
  onlyBookable?: boolean;
  search?: string;
  district?: string;       // undefined = all districts
  dataKeys?: DataKey[];    // AND requirements: only venues with all of these
  onDistrictsLoaded?: (districts: string[]) => void;
}

const LeafletMapImpl = dynamic(() => import('./LeafletMapImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-slate-100 flex items-center justify-center">
      <div className="text-center text-slate-400">
        <MapPin className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Ładowanie mapy…</p>
      </div>
    </div>
  ),
});

export default function MapView(props: MapViewProps) {
  return <LeafletMapImpl {...props} />;
}
