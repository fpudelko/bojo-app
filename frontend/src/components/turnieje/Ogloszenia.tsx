// Ogłoszenia organizatora — publiczne (widzi każdy, tak jak terminarz),
// pisze i kasuje wyłącznie zarządzający turniejem (migracja `150`).
'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Megaphone, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { TurniejOgloszenie } from '@/types';

export interface OgloszeniaProps {
  ogloszenia: readonly TurniejOgloszenie[];
  /** Zapytanie padło. Puste miejsce ma wtedy powiedzieć co innego niż „brak ogłoszeń". */
  blad?: boolean;
  mozeZarzadzac: boolean;
  onDodaj: (tresc: string) => Promise<void>;
  onUsun: (id: string) => Promise<void>;
}

export default function Ogloszenia({ ogloszenia, blad, mozeZarzadzac, onDodaj, onUsun }: OgloszeniaProps) {
  const [tresc, setTresc] = useState('');
  const [wysylam, setWysylam] = useState(false);

  if (blad) {
    return (
      <p className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400 shadow-sm">
        Nie udało się wczytać ogłoszeń. Reszta turnieju działa normalnie.
      </p>
    );
  }

  if (ogloszenia.length === 0 && !mozeZarzadzac) return null;

  const wyslij = async () => {
    if (tresc.trim().length === 0) return;
    setWysylam(true);
    try {
      await onDodaj(tresc.trim());
      setTresc('');
    } finally {
      setWysylam(false);
    }
  };

  return (
    <div className="rounded-2xl border border-pink-100 dark:border-pink-900/40 bg-pink-50/40 dark:bg-pink-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-pink-700 dark:text-pink-400">
        <Megaphone className="h-4 w-4" /> Ogłoszenia
      </div>

      {ogloszenia.length === 0 ? (
        <p className="text-sm text-slate-400">Jeszcze żadnych ogłoszeń.</p>
      ) : (
        <ul className="space-y-2">
          {ogloszenia.map((o) => (
            <li key={o.id} className="rounded-xl bg-white dark:bg-slate-800 p-3 text-sm shadow-sm">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{o.tresc}</p>
                {mozeZarzadzac && (
                  <button onClick={() => onUsun(o.id)} aria-label="Usuń ogłoszenie" className="shrink-0 text-slate-300 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {format(parseISO(o.createdAt), 'd MMMM, HH:mm', { locale: pl })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {mozeZarzadzac && (
        <div className="space-y-2 border-t border-pink-100 dark:border-pink-900/40 pt-3">
          <textarea
            value={tresc}
            onChange={(e) => setTresc(e.target.value)}
            placeholder="Napisz coś do wszystkich drużyn…"
            rows={2}
            maxLength={1000}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Button size="sm" onClick={wyslij} disabled={tresc.trim().length === 0 || wysylam}>
            Opublikuj ogłoszenie
          </Button>
        </div>
      )}
    </div>
  );
}
