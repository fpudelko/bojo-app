'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';

const VenueExplorer = dynamic(() => import('@/components/map/VenueExplorer'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-slate-100">
      <div className="text-center text-slate-400">
        <MapPin className="mx-auto mb-2 h-8 w-8" />
        <p className="text-sm">Ładowanie mapy…</p>
      </div>
    </div>
  ),
});

export default function MapaPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <Header />
      <Suspense fallback={
        <div className="flex flex-1 items-center justify-center bg-slate-100">
          <div className="text-center text-slate-400">
            <MapPin className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm">Ładowanie mapy…</p>
          </div>
        </div>
      }>
        <VenueExplorer />
      </Suspense>
    </div>
  );
}
