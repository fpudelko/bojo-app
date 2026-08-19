'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, Users as UsersIcon, MessageCircle } from 'lucide-react';
import { WARSTWA } from '@/lib/warstwy';
import { etykietaZapisu } from '@/lib/time';
import { rozmowyZNieprzeczytanymi, type RozmowaNieprzeczytana } from '@/lib/comments';
import { rozmowyGrupZNieprzeczytanymi } from '@/lib/groupPosts';
import { getMyGroups } from '@/lib/groups';

interface Wpis extends RozmowaNieprzeczytana {
  typ: 'mecz' | 'grupa';
}

/**
 * Panel otwierany przytrzymaniem „Moje" na dolnej nawigacji (`BottomNav.tsx`,
 * `useDlugieWcisniecie`) — lista WSZYSTKICH rozmów z nieprzeczytanymi
 * wiadomościami, meczów i ekip razem, od najnowszej. Nie zastępuje istniejącego
 * filtra „tylko nieprzeczytane" na `/moje-gry`: filtr zawęża listę meczów,
 * ten panel przeskakuje wprost do rozmowy, także w ekipie.
 *
 * Dane dopiero przy otwarciu — zwykłe tapnięcie „Moje" (bez przytrzymania)
 * nie robi ani jednego dodatkowego zapytania.
 */
export default function PanelRozmow({
  otwarty, naZamknij, userId,
}: {
  otwarty: boolean;
  naZamknij: () => void;
  userId: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [ladowanie, setLadowanie] = useState(true);
  const [wpisy, setWpisy] = useState<Wpis[]>([]);

  useEffect(() => {
    if (!otwarty) return;
    let aktualne = true;
    setLadowanie(true);
    (async () => {
      const grupy = await getMyGroups(userId);
      const [mecze, ekipy] = await Promise.all([
        rozmowyZNieprzeczytanymi(userId),
        rozmowyGrupZNieprzeczytanymi(userId, grupy),
      ]);
      if (!aktualne) return;
      const polaczone: Wpis[] = [
        ...mecze.map((r) => ({ ...r, typ: 'mecz' as const })),
        ...ekipy.map((r) => ({ ...r, typ: 'grupa' as const })),
      ].sort((a, b) => b.najnowsza.localeCompare(a.najnowsza));
      setWpisy(polaczone);
      setLadowanie(false);
    })().catch(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [otwarty, userId]);

  useEffect(() => {
    if (!otwarty) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') naZamknij(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [otwarty, naZamknij]);

  if (!otwarty || !mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 ${WARSTWA.modal}`}>
      <div className="absolute inset-0 bg-black/40" onClick={naZamknij} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nieprzeczytane rozmowy"
        className="fixed inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-t-2xl bg-white shadow-xl dark:bg-slate-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-700">
          <h2 className="text-base font-bold text-ink">Nieprzeczytane rozmowy</h2>
          <button
            type="button"
            onClick={naZamknij}
            aria-label="Zamknij"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {ladowanie ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[56px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
              ))}
            </div>
          ) : wpisy.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl">💬</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nic nowego do przeczytania</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50 dark:divide-slate-700">
              {wpisy.map((w) => (
                <li key={`${w.typ}-${w.id}`}>
                  <Link
                    href={w.typ === 'mecz' ? `/wydarzenia/${w.id}?tab=rozmowa` : `/grupy/${w.id}?tab=tablica`}
                    onClick={naZamknij}
                    className="flex items-center gap-3 py-3 active:opacity-70"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg dark:bg-slate-700" aria-hidden="true">
                      {w.typ === 'mecz' ? '⚽' : <UsersIcon className="h-4 w-4 text-slate-500" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{w.tytul || 'Bez nazwy'}</span>
                      <span className="block text-[11px] text-slate-400">{etykietaZapisu(w.najnowsza)}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-bold text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                      <MessageCircle className="h-3 w-3" /> {w.ile}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
