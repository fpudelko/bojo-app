'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import type { SportType } from '@/types';

export interface MapViewProps {
  className?: string;
  sport?: SportType;
  onlyAvailable?: boolean;
  search?: string;
}

const LeafletMapImpl = dynamic(() => import('./LeafletMapImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-gray-100 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <MapPin className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Ładowanie mapy…</p>
      </div>
    </div>
  ),
});

export default function MapView(props: MapViewProps) {
  return <LeafletMapImpl {...props} />;
}
