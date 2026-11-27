// Karta drużyny na publicznej stronie turnieju: nazwa, rozstawienie, status,
// a po rozwinięciu najbliższy mecz i wyniki tej drużyny.
//
// WYNIKI, NIE SKŁAD (decyzja właściciela z 2026-11-22). Rozwinięta karta
// pokazywała listę nazwisk, a na liście drużyn ktoś pyta raczej „jak im
// idzie i kiedy grają”. Skład z odnośnikami do profili zawodników żyje na
// ekranie drużyny (`/turnieje/[id]/druzyna/[id]`), do którego prowadzi
// „Zobacz mecze i skład”. Wyniki i terminarz są publiczne, więc karta nie
// potrzebuje już ściany logowania.
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import { STATUS_DRUZYNY, odmienZawodnikow, terminMeczuNaKarcie } from '@/lib/turniejEtykiety';
import { meczeDruzyny } from '@/lib/turniejWynik';
import type { TurniejDruzyna, TurniejMecz } from '@/types';

const BILANS: Record<'Z' | 'R' | 'P', { tytul: string; ton: string }> = {
  Z: { tytul: 'Zwycięstwo', ton: 'bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300' },
  R: { tytul: 'Remis', ton: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200' },
  P: { tytul: 'Porażka', ton: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100' },
};

export default function KartaDruzyny({
  d, zalogowany, czyMoja, onZamienWEkipe, mecze = [], nazwaSlotu, wMojejDruzynie = false,
}: {
  d: TurniejDruzyna;
  zalogowany: boolean;
  /** Zalogowany jest KAPITANEM tej drużyny („Zarządzaj drużyną”). */
  czyMoja: boolean;
  /** Zalogowany gra w tej drużynie: obwódka i tło w kolorze marki, bez napisu. */
  wMojejDruzynie?: boolean;
  onZamienWEkipe: (d: TurniejDruzyna) => void;
  /** Wszystkie mecze turnieju; karta sama wybiera mecze tej drużyny. */
  mecze?: readonly TurniejMecz[];
  /** Nazwa strony meczu (drużyna albo „Zwycięzca A”), jak na karcie meczu. */
  nazwaSlotu?: (m: TurniejMecz, strona: 'a' | 'b') => string;
}) {
  const [rozwinieta, setRozwinieta] = useState(false);
  const status = STATUS_DRUZYNY[d.status];
  const adresDruzyny = `/turnieje/${d.turniejId}/druzyna/${d.id}`;
  const { najblizszy, wyniki } = meczeDruzyny(mecze, d.id);
  const przeciwnik = (m: TurniejMecz) => {
    const strona = m.druzynaAId === d.id ? 'b' : 'a';
    return nazwaSlotu?.(m, strona) ?? '?';
  };
  return (
    <div className={`overflow-hidden rounded-xl ${wMojejDruzynie
      ? 'border-2 border-primary-400 bg-primary-50 dark:border-primary-700 dark:bg-primary-950/40'
      : 'border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
      {/* DWA CELE: nazwa prowadzi na ekran drużyny, strzałka rozwija mecze.
          Oba mają pełną wysokość wiersza, żeby trafić kciukiem. */}
      <div className="flex items-stretch">
        <Link prefetch={false}
          href={adresDruzyny}
          className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
        >
          {d.rozstawienie !== undefined && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {d.rozstawienie}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className={`block line-clamp-2 break-words leading-snug ${wMojejDruzynie ? 'font-bold text-primary-800 dark:text-primary-300' : 'font-medium text-ink'}`}>{d.nazwa}</span>
            {zalogowany && d.liczbaZawodnikow !== undefined && (
              <span className="text-xs text-slate-400">{odmienZawodnikow(d.liczbaZawodnikow)}</span>
            )}
          </div>
          {d.status !== 'przyjeta' && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
          )}
        </Link>
        <button
          onClick={() => setRozwinieta((v) => !v)}
          aria-expanded={rozwinieta}
          aria-label={rozwinieta ? 'Ukryj mecze' : 'Pokaż mecze'}
          className="flex w-11 shrink-0 items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${rozwinieta ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {rozwinieta && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-3.5 space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Najbliższy mecz</p>
            {najblizszy ? (
              <Link prefetch={false}
                href={`/turnieje/${d.turniejId}/mecz/${najblizszy.id}`}
                className="-mx-2 flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
              >
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {najblizszy.status === 'trwa'
                    ? 'Na żywo'
                    : najblizszy.zaplanowanyAt
                      ? (() => { const t = terminMeczuNaKarcie(najblizszy.zaplanowanyAt); return `${t.dzien} ${t.godzina}`; })()
                      : `M${najblizszy.numer}`}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">z {przeciwnik(najblizszy)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Brak kolejnych meczów.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Wyniki</p>
            {wyniki.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Jeszcze nie grali.</p>
            ) : (
              <ul className="space-y-0.5">
                {wyniki.map((w) => (
                  <li key={w.mecz.id}>
                    <Link prefetch={false}
                      href={`/turnieje/${d.turniejId}/mecz/${w.mecz.id}`}
                      className="-mx-2 flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      <span
                        title={BILANS[w.bilans].tytul}
                        aria-label={BILANS[w.bilans].tytul}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${BILANS[w.bilans].ton}`}
                      >
                        {w.bilans}
                      </span>
                      <span className="w-10 shrink-0 font-mono font-semibold text-ink">
                        {w.mecz.status === 'walkower' ? 'wo.' : `${w.zdobyte}:${w.stracone}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">z {przeciwnik(w.mecz)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Wejście na ekran drużyny: skład z profilami, wszystkie mecze,
              a dla kapitana link dla kolegów i dopisywanie zawodników. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link prefetch={false} href={adresDruzyny} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary-600">
              {czyMoja ? 'Zarządzaj drużyną' : 'Zobacz mecze i skład'}
              <ChevronRight className="h-4 w-4" />
            </Link>
            {czyMoja && (
              <button
                onClick={() => onZamienWEkipe(d)}
                className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary-600"
              >
                <Repeat className="h-4 w-4" /> Zamień drużynę w ekipę
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
