// Pasek zakładek turnieju na ekranach POD turniejem: mecz i drużyna
// (decyzja właściciela z 2026-11-21). Wcześniej ekran meczu miał tylko
// strzałkę wstecz, więc z meczu do tabel grup trzeba było wrócić i szukać
// zakładki od nowa. Zakładki prowadzą na stronę turnieju (adres z nazwą,
// gdy jest), żadna nie jest tu zaznaczona: czytający stoi „pod” turniejem.
import Link from 'next/link';
import { ZAKLADKI_TURNIEJU, etykietaZakladkiTurnieju } from '@/lib/turniejEtykiety';
import type { Turniej } from '@/types';

export default function ZakladkiTurnieju({ adres, format, liczbaDruzyn }: {
  /** Adres turnieju z nazwą albo uuid. */
  adres: string;
  format: Turniej['format'];
  liczbaDruzyn?: number;
}) {
  return (
    <nav aria-label="Zakładki turnieju" className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide">
      {ZAKLADKI_TURNIEJU.map((z) => (
        <Link
          key={z}
          href={`/turnieje/${adres}?tab=${z}`}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {etykietaZakladkiTurnieju(z, format, liczbaDruzyn)}
        </Link>
      ))}
    </nav>
  );
}
