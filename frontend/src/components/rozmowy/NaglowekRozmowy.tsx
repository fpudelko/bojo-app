'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWstecz } from '@/lib/historia';

/**
 * Wspólny nagłówek pełnoekranowej rozmowy: wstecz · kogo/czego dotyczy ·
 * odnośnik do miejsca, z którego ta rozmowa wyrasta.
 *
 * DLACZEGO OSOBNY EKRAN, A NIE ZAKŁADKA. Lista rozmów prowadziła wcześniej
 * do `/grupy/[id]?tab=tablica` i `/wydarzenia/[id]?tab=rozmowa` — czyli
 * z komunikatora WYRZUCAŁA na stronę ekipy albo meczu z paskiem zakładek.
 * Człowiek dotykał rozmowy, a dostawał skład, statystyki i przyciski
 * zarządzania; wstecz wracało wtedy na `/grupy`, nie do listy rozmów.
 * Rozmowa otwarta z listy rozmów ZOSTAJE rozmową — tak jak w każdym
 * komunikatorze.
 *
 * ODNOŚNIK ZAMIAST ZAKŁADEK. Kontekst („co to za ekipa", „kiedy ten mecz")
 * jest w rozmowie potrzebny, ale jako WYJŚCIE na żądanie, nie jako pasek
 * nawigacji nad każdą wiadomością. Stąd jeden wiersz: awatar, nazwa,
 * podpis mówiący dokąd prowadzi, strzałka. Cały wiersz jest celem dotknięcia
 * (44 px wysokości), bo na telefonie sama nazwa to za mały cel.
 */
export default function NaglowekRozmowy({
  tytul, podtytul, href, awatar, zapasowyCel = '/rozmowy',
}: {
  tytul: string;
  /** Dokąd prowadzi odnośnik, słowami — „Otwórz ekipę", „Otwórz mecz". */
  podtytul: string;
  href: string;
  awatar: React.ReactNode;
  zapasowyCel?: string;
}) {
  const wstecz = useWstecz(zapasowyCel);
  return (
    <div className="flex items-center gap-1">
      {/* Wstecz = poprzedni ekran. Do rozmowy ekipy wchodzi się z listy
          rozmów, ale też ze strony ekipy — sztywny cel byłby złą odpowiedzią
          w jednym z tych dwóch przypadków (lib/historia.tsx). */}
      <button
        type="button"
        onClick={wstecz}
        aria-label="Wróć"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <Link
        href={href}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-700 to-primary-900 text-base">
          {awatar}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-tight text-ink">{tytul}</span>
          <span className="block truncate text-[11px] font-medium leading-tight text-slate-400">{podtytul}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
      </Link>
    </div>
  );
}
