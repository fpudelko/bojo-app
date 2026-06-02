'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

export interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number, address: string) => void;
}

const Impl = dynamic(() => import('./LocationPickerImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[280px] bg-gray-100 flex items-center justify-center text-sm text-gray-400">
      <div className="text-center">
        <MapPin className="w-6 h-6 mx-auto mb-1 text-gray-300" />
        Ładowanie mapy…
      </div>
    </div>
  ),
});

export default function LocationPicker(props: LocationPickerProps) {
  return <Impl {...props} />;
}
