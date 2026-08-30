'use client';

import { useEffect, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import type L from 'leaflet';

/**
 * Kontrolki +/- przybliżenia — `zoomControl={false}` na `MapContainer` chowa
 * domyślną kontrolkę Leaflet, bo jej stały górny lewy róg koliduje na mobile
 * z nakładką szukania/filtrów. Własny przycisk, tym samym wzorem co
 * `LocateMeButton` (`className` steruje pozycją zależnie od kontekstu), więc
 * odstęp od dolnej nawigacji jest już rozwiązany tam, gdzie trzeba.
 *
 * Zgłoszone wprost z sesji QA: „brak kontrolek +/- na /mapa" — dotąd jedynym
 * sposobem przybliżenia było kółko myszy (osobno naprawione, patrz
 * `wheelPxPerZoomLevel`) albo gest szczypania na dotyku.
 */
export default function ZoomButtons({ map, className }: { map: L.Map | null; className?: string }) {
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const sync = () => setZoom(map.getZoom());
    sync();
    map.on('zoomend', sync);
    return () => { map.off('zoomend', sync); };
  }, [map]);

  const minZoom = map?.getMinZoom() ?? 0;
  const maxZoom = map?.getMaxZoom() ?? Infinity;

  return (
    <div className={clsx('flex flex-col overflow-hidden rounded-full border border-slate-200 bg-white shadow-md', className)}>
      <button
        type="button"
        onClick={() => map?.zoomIn()}
        disabled={!map || zoom === null || zoom >= maxZoom}
        title="Przybliż"
        aria-label="Przybliż"
        className="flex h-11 w-11 items-center justify-center text-primary-700 transition-colors hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <Plus className="h-5 w-5" />
      </button>
      <div className="h-px bg-slate-200" />
      <button
        type="button"
        onClick={() => map?.zoomOut()}
        disabled={!map || zoom === null || zoom <= minZoom}
        title="Oddal"
        aria-label="Oddal"
        className="flex h-11 w-11 items-center justify-center text-primary-700 transition-colors hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <Minus className="h-5 w-5" />
      </button>
    </div>
  );
}
