// Galeria zdjęć turnieju na zakładce Info — publiczna (migracja `159`).
// Zarządzanie (dodawanie, kolejność, usuwanie) mieszka w panelu, nie tutaj:
// jedno miejsce na zmiany, a strona turnieju zostaje stroną do oglądania.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Images } from 'lucide-react';
import Lightbox from './Lightbox';
import type { TurniejZdjecie } from '@/types';

export interface GaleriaProps {
  zdjecia: readonly TurniejZdjecie[];
  /** Zarządzający widzi sekcję także pustą — z drogą do panelu. */
  mozeZarzadzac: boolean;
  linkDoPanelu: string;
}

export default function Galeria({ zdjecia, mozeZarzadzac, linkDoPanelu }: GaleriaProps) {
  const [otwarte, setOtwarte] = useState<number | null>(null);

  if (zdjecia.length === 0 && !mozeZarzadzac) return null;

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Images className="h-4 w-4 text-slate-400" /> Galeria
        </h2>
        {mozeZarzadzac && (
          <Link href={linkDoPanelu} className="text-sm font-medium text-primary-600">
            {zdjecia.length === 0 ? '+ Ustaw wygląd strony' : 'Wygląd strony'}
          </Link>
        )}
      </div>

      {zdjecia.length === 0 ? (
        <p className="text-sm text-slate-400">
          Zdjęcia z poprzedniej edycji albo z boiska pokażą, jak wygląda ten turniej. Widzisz tę sekcję, bo zarządzasz turniejem.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {zdjecia.map((z, i) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setOtwarte(i)}
              aria-label={`Otwórz zdjęcie ${i + 1}`}
              className="aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={z.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox zdjecia={zdjecia} indeks={otwarte} onZmien={setOtwarte} onZamknij={() => setOtwarte(null)} />
    </div>
  );
}
