// Karta drużyny na publicznej stronie turnieju: nazwa, rozstawienie, status,
// a po rozwinięciu — skład.
//
// OSOBNY PLIK, bo skład jest jedynym miejscem w module turniejowym, w którym
// widać konkretnego CZŁOWIEKA, a nie drużynę — i jedynym, z którego da się
// wyjść na jego profil. Reguła „zawodnik z kontem jest odnośnikiem, dopisany
// z ręki nie jest" musi dać się sprawdzić testem, a nie tylko okiem na ekranie
// (skład stoi za ścianą logowania, więc nie widzi go żaden zrzut).
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import SciankaLogowania from './SciankaLogowania';
import { STATUS_DRUZYNY, odmienZawodnikow } from '@/lib/turniejEtykiety';
import type { TurniejDruzyna } from '@/types';

export default function KartaDruzyny({
  d, zalogowany, czyMoja, onZamienWEkipe,
}: {
  d: TurniejDruzyna; zalogowany: boolean; czyMoja: boolean; onZamienWEkipe: (d: TurniejDruzyna) => void;
}) {
  const [rozwinieta, setRozwinieta] = useState(false);
  const status = STATUS_DRUZYNY[d.status];
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      {/* DWA CELE, NIE JEDEN. Cała karta była przyciskiem rozwijającym, więc
          nazwa drużyny nie prowadziła nigdzie, a do ekranu drużyny trzeba było
          najpierw rozwinąć kartę i dopiero kliknąć odnośnik w środku. Kapitan
          nie miał drogi do własnej drużyny inaczej niż przez zachowany link.
          Do tego nazwa niebędąca odnośnikiem nie daje się ani skopiować, ani
          otworzyć w nowej karcie.

          Teraz nazwa jest odnośnikiem, a skład rozwija osobny przycisk ze
          strzałką. Oba cele mają pełną wysokość wiersza, więc na telefonie
          trafia się w nie kciukiem. Odnośnik w środku zostaje, bo dla własnej
          drużyny mówi co innego („Zarządzaj drużyną"). */}
      <div className="flex items-stretch">
        <Link
          href={`/turnieje/${d.turniejId}/druzyna/${d.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
        >
          {d.rozstawienie !== undefined && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {d.rozstawienie}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{d.nazwa}</span>
            {zalogowany && d.liczbaZawodnikow !== undefined && (
              <span className="text-xs text-slate-400">{odmienZawodnikow(d.liczbaZawodnikow)}</span>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
        </Link>
        <button
          onClick={() => setRozwinieta((v) => !v)}
          aria-expanded={rozwinieta}
          aria-label={rozwinieta ? 'Ukryj skład' : 'Pokaż skład'}
          className="flex shrink-0 items-center px-3 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${rozwinieta ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {rozwinieta && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-3.5 space-y-3">
          {!zalogowany ? (
            <SciankaLogowania tytul={`Skład drużyny ${d.nazwa}`} />
          ) : d.zawodnicy && d.zawodnicy.length > 0 ? (
            /* Zawodnik z kontem prowadzi do swojego profilu — skład to jedyne
               miejsce w module, gdzie widać konkretnego człowieka, a nazwisko
               bez odnośnika kończy drogę. Zawodnik dopisany z ręki, bez konta,
               zostaje zwykłym tekstem: nie ma dokąd prowadzić. */
            <ul className="space-y-0.5">
              {d.zawodnicy.map((z) => {
                const tresc = (
                  <>
                    {z.numer !== undefined && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-[11px] font-mono">{z.numer}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{z.imie}</span>
                    {z.kapitan && <span className="shrink-0 text-xs text-slate-400">kapitan</span>}
                  </>
                );
                return (
                  <li key={z.id}>
                    {z.userId ? (
                      <Link
                        href={`/gracz/${z.userId}`}
                        className="-mx-2 flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                      >
                        {tresc}
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </Link>
                    ) : (
                      <span className="-mx-2 flex min-h-[44px] items-center gap-2 px-2 text-sm text-slate-600 dark:text-slate-300">
                        {tresc}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Skład jeszcze pusty.</p>
          )}
          {/* Wejście na ekran drużyny — tam mieszka stały link do wysłania
              kolegom, licznik składu, dopisywanie zawodników i zaproszenia
              z ekipy. Pokazuje się KAŻDEMU, nie tylko kapitanowi: dla reszty
              to podgląd składu i meczów tej drużyny. */}
          <Link
            href={`/turnieje/${d.turniejId}/druzyna/${d.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600"
          >
            {czyMoja ? 'Zarządzaj drużyną' : 'Otwórz drużynę'}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          {czyMoja && (
            <button
              onClick={() => onZamienWEkipe(d)}
              className="ml-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600"
            >
              <Repeat className="h-3.5 w-3.5" /> Zamień drużynę w ekipę
            </button>
          )}
        </div>
      )}
    </div>
  );
}
