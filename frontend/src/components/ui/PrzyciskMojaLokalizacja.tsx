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
  wariant = 'pelny', children,
}: {
  onPozycja: (lat: number, lng: number) => void;
  etykieta?: string;
  className?: string;
  /**
   * `pelny` — przycisk na całą szerokość z podpisem. Tak stoi na
   * `/wydarzenia`, pod suwakiem odległości, gdzie nie ma obok pola adresu
   * i musi sam powiedzieć, co robi.
   *
   * `ikona` — kwadrat 44×44 px z samą pinezką, sklejony w JEDEN WIERSZ
   * z polem adresu podanym w `children`. Powód z 2026-09-14 (zgłoszone
   * wprost): pinezka i wpisanie miejscowości to dwie drogi do tej samej
   * rzeczy, a stały jedna nad drugą jako dwa osobne, pełnowymiarowe pola —
   * przez co arkusz filtrów zaczynał się od trzech rzędów poświęconych
   * wyłącznie lokalizacji. Obok siebie czytają się jako jeden wybór: „wpisz
   * albo dotknij pinezki".
   */
  wariant?: 'pelny' | 'ikona';
  /** Pole adresu — tylko dla `wariant='ikona'`, staje w wierszu po lewej. */
  children?: React.ReactNode;
}) {
  const [szuka, setSzuka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const klik = async () => {
    setBlad(null);
    setSzuka(true);
    const res = await getCurrentLocation();
    setSzuka(false);
    if (res.ok) onPozycja(res.lat, res.lng);
    else setBlad(geoErrorMessage(res.kind));
  };

  // Błąd renderuje się POD całym wierszem, nie obok przycisku — inaczej
  // w wariancie ikony rozpychałby wiersz i zostawiał pole adresu wiszące
  // w pionie na środku.
  const komunikatBledu = blad && (
    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      {blad}
    </p>
  );

  if (wariant === 'ikona') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{children}</div>
          <button
            type="button"
            disabled={szuka}
            onClick={klik}
            aria-label={etykieta}
            title={etykieta}
            className={clsx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300',
              'text-slate-600 transition-colors hover:border-primary-400 hover:text-primary-700',
              'disabled:opacity-60 dark:border-slate-600 dark:text-slate-300',
            )}
          >
            {szuka
              ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
              : <LocateFixed className="h-5 w-5 shrink-0" aria-hidden />}
          </button>
        </div>
        {komunikatBledu}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={szuka}
        onClick={klik}
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

      {komunikatBledu}
    </div>
  );
}
