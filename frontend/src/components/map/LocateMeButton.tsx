'use client';

import { useCallback, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { clsx } from 'clsx';
import type L from 'leaflet';

/** Przycisk „pokaż moją okolicę" — wspólny dla /mapa i widoku mapy w
 *  /wydarzenia, żeby nie utrzymywać dwóch kopii tej samej geolokalizacji.
 *  `className` steruje pozycją (kontekst pełnoekranowej mapy vs. mapy
 *  osadzonej w karcie mają różne bezpieczne odstępy). */
export default function LocateMeButton({ map, className }: { map: L.Map | null; className?: string }) {
  const [locating, setLocating] = useState(false);

  const locateMe = useCallback(() => {
    if (!map || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.setView([pos.coords.latitude, pos.coords.longitude], 12);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, [map]);

  return (
    <button
      type="button"
      onClick={locateMe}
      disabled={locating}
      title="Pokaż moją okolicę"
      aria-label="Pokaż moją okolicę"
      className={clsx(
        'flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition-colors hover:bg-slate-50 disabled:opacity-60',
        className,
      )}
    >
      <LocateFixed className={`h-5 w-5 ${locating ? 'text-slate-300' : 'text-primary-700'}`} />
    </button>
  );
}
