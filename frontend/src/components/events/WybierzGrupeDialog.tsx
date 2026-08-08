'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Users, Check } from 'lucide-react';
import { getMyGroups } from '@/lib/groups';
import type { Group } from '@/types';

/**
 * Wybór ekipy, do której należy tworzony mecz (krok 3 kreatora).
 *
 * Przypisanie do ekipy jest ORTOGONALNE do widoczności — mecz grupy może być
 * publiczny — więc jest osobnym wierszem, nie trzecią kartą przy „Publiczne /
 * Prywatne".
 *
 * Układ i pobieranie grup jak w `InviteFromGroupDialog`: bottom sheet od
 * najmniejszych ekranów, wyśrodkowana karta od `sm:`.
 */
export default function WybierzGrupeDialog({
  userId,
  wybranaId,
  onWybierz,
  onClose,
}: {
  userId: string;
  wybranaId?: string;
  onWybierz: (grupa: Group | null) => void;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyGroups(userId)
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : 'Nie udało się wczytać ekip'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-ink">Mecz w ramach ekipy</h2>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-red-600">{error}</p>
          ) : groups.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">
                Nie należysz jeszcze do żadnej ekipy. Załóż grupę, a mecz trafi do jej
                historii i zobaczą go wszyscy członkowie.
              </p>
              <Link
                href="/grupy/nowe"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800"
              >
                <Users className="h-4 w-4" /> Załóż ekipę
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {groups.map((g) => {
                  const wybrana = g.id === wybranaId;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => onWybierz(g)}
                        className="flex w-full items-center gap-3 py-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{g.name}</span>
                          {g.sport && <span className="block text-xs text-slate-500">{g.sport}</span>}
                        </span>
                        {wybrana && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <Link
                href="/grupy/nowe"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
              >
                <Users className="h-4 w-4" /> Załóż nową ekipę
              </Link>
            </>
          )}
        </div>

        {wybranaId && (
          <div className="border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => onWybierz(null)}
              className="text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
            >
              Nie przypisuj do ekipy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
