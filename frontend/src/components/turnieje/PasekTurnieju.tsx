'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  pobierzTurniejeNaPasek, trescPaska, ukryteDzis, ukryjDzis, type TurniejNaPasku,
} from '@/lib/pasekTurnieju';

/**
 * Pasek „trwa turniej” (migracja `198`). Dwa miejsca, dwa warianty:
 *  - `ciemny` — w hero landingu (niezalogowany na `/`),
 *  - `jasny`  — na górze `/moje-gry` (zalogowany trafia tam z `/`).
 *
 * Renderuje się WYŁĄCZNIE po pobraniu danych w przeglądarce: serwer nie wie,
 * kto patrzy, a stan turnieju zmienia się co minutę, więc HTML z serwera
 * i tak byłby nieaktualny (i rozjeżdżałby hydrację). Brak turnieju = nic.
 */
export default function PasekTurnieju({ wariant, className = '' }: {
  wariant: 'ciemny' | 'jasny';
  /** Odstępy wokół paska — nakładane tylko, gdy pasek się pokazuje. */
  className?: string;
}) {
  const { user, loading } = useAuth();
  const [lista, setLista] = useState<TurniejNaPasku[] | null>(null);
  const [ukryte, setUkryte] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    let aktualne = true;
    pobierzTurniejeNaPasek().then((l) => {
      if (!aktualne) return;
      setLista(l);
      setUkryte(ukryteDzis(l));
    });
    return () => { aktualne = false; };
    // Po zalogowaniu baza zna „moją drużynę”, więc pytamy jeszcze raz.
  }, [loading, user?.id]);

  const tresc = lista ? trescPaska(lista, ukryte) : null;
  if (!tresc || !lista) return null;
  const pierwszy = lista.find((t) => !ukryte.has(t.id))!;

  const ciemny = wariant === 'ciemny';
  return (
    <div className={className}>
    <div
      role="region"
      aria-label="Turniej"
      className={[
        'rounded-2xl border px-3 py-2.5 sm:px-4',
        ciemny
          ? 'border-amber-300/30 bg-amber-400/15 text-white backdrop-blur-sm'
          : 'border-amber-200 bg-amber-50 text-ink dark:border-amber-500/30 dark:bg-amber-500/10',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        <Link prefetch={false} href={tresc.link} className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className={[
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            'bg-amber-400 text-slate-900',
          ].join(' ')}>
            <Trophy className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              {pierwszy.status === 'trwa' && (
                <span className="relative mt-1.5 flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              )}
              <span className="line-clamp-2 text-sm font-semibold">{tresc.naglowek}</span>
            </span>
            {tresc.szczegol && (
              <span className={`mt-0.5 block truncate text-xs ${ciemny ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'}`}>
                {tresc.szczegol}
              </span>
            )}
            {tresc.ileInnych > 0 && (
              <span className={`mt-0.5 block text-[11px] ${ciemny ? 'text-white/60' : 'text-slate-500'}`}>
                +{tresc.ileInnych} {tresc.ileInnych === 1 ? 'inny turniej' : 'inne turnieje'}
              </span>
            )}
          </span>
          <ChevronRight className={`mt-1.5 h-4 w-4 shrink-0 ${ciemny ? 'text-white/60' : 'text-slate-400'}`} />
        </Link>
        <button
          type="button"
          onClick={() => { ukryjDzis(pierwszy.id); setUkryte((u) => new Set(u).add(pierwszy.id)); }}
          aria-label="Ukryj na dziś"
          className={`-mr-1 shrink-0 rounded-full p-1.5 ${ciemny ? 'text-white/60 hover:bg-white/10' : 'text-slate-400 hover:bg-amber-100 dark:hover:bg-white/10'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {tresc.linkZnajdz && (
        <Link
          prefetch={false}
          href={tresc.linkZnajdz}
          className={[
            'mt-2 flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold',
            ciemny ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-primary-700 text-white hover:bg-primary-800',
          ].join(' ')}
        >
          Grasz w turnieju? Znajdź swoją drużynę
        </Link>
      )}
    </div>
    </div>
  );
}
