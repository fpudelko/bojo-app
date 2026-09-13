'use client';

import { useState } from 'react';
import { Loader2, LocateFixed } from 'lucide-react';
import { clsx } from 'clsx';
import { getCurrentLocation, geoErrorMessage } from '@/lib/geo';

/**
 * „Ustaw pinezkę na mojej lokalizacji" — jeden przycisk dla obu arkuszy
 * filtrów (`/wydarzenia` i `/mapa`).
 *
 * Powstał, bo dotąd zgoda na lokalizację była wyciągana UBOCZNIE: na
 * `/wydarzenia` systemowe pytanie wyskakiwało dopiero przy zatwierdzaniu
 * filtrów z ustawionym promieniem, czyli w momencie, w którym człowiek
 * myślał, że już wybiera wyniki. Pytanie o zgodę ma wychodzić z przycisku,
 * który ktoś nacisnął po to, żeby o nią poprosić.
 *
 * Błąd geolokalizacji pokazuje się TUTAJ, pod przyciskiem. Wywołujący nie
 * musi go obsługiwać — odmowa zgody to normalny stan tej kontrolki, nie
 * awaria ekranu.
 */
export default function PrzyciskMojaLokalizacja({
  onPozycja, etykieta = 'Ustaw pinezkę na mojej lokalizacji', className,
}: {
  onPozycja: (lat: number, lng: number) => void;
  etykieta?: string;
  className?: string;
}) {
  const [szuka, setSzuka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={szuka}
        onClick={async () => {
          setBlad(null);
          setSzuka(true);
          const res = await getCurrentLocation();
          setSzuka(false);
          if (res.ok) onPozycja(res.lat, res.lng);
          else setBlad(geoErrorMessage(res.kind));
        }}
        className={clsx(
          'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5',
          'text-sm font-medium text-slate-700 transition-colors hover:border-primary-400 hover:text-primary-700',
          'disabled:opacity-60 dark:border-slate-600 dark:text-slate-300',
        )}
      >
        {szuka
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          : <LocateFixed className="h-4 w-4 shrink-0" aria-hidden />}
        {szuka ? 'Szukam Cię…' : etykieta}
      </button>

      {blad && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {blad}
        </p>
      )}
    </div>
  );
}
