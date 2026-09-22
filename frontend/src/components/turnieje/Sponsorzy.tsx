// Sponsorzy turnieju na zakładce Info — publiczni (migracja `159`). Sponsor
// bez logo to plakietka z samą nazwą: mały sponsor bez przygotowanej grafiki
// nie ma być gorzej widoczny, niż musi.
'use client';

import { bezpiecznyLinkSponsora } from '@/lib/turniejGaleria';
import type { TurniejSponsor } from '@/types';

export default function Sponsorzy({ sponsorzy }: { sponsorzy: readonly TurniejSponsor[] }) {
  if (sponsorzy.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">Sponsorzy</h2>
      <ul className="flex flex-wrap items-center gap-3">
        {sponsorzy.map((s) => {
          const link = bezpiecznyLinkSponsora(s.link);
          const tresc = s.logoUrl ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-100 dark:border-slate-700 bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logoUrl} alt={s.nazwa} className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <span className="inline-flex h-16 items-center rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              {s.nazwa}
            </span>
          );
          return (
            <li key={s.id}>
              {link ? (
                // `sponsored`: link płatny w rozumieniu wyszukiwarek — bez tego
                // strona turnieju przekazywałaby sponsorom „głos" w rankingu.
                <a href={link} target="_blank" rel="sponsored noopener noreferrer" title={s.nazwa}>
                  {tresc}
                </a>
              ) : (
                <span title={s.nazwa}>{tresc}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
