'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, Users, X } from 'lucide-react';
import { createGroup, getGroup, getMyGroups } from '@/lib/groups';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import type { Group } from '@/types';

/**
 * Wybór grupy, do której należy tworzony mecz (krok 3 kreatora; reużywany
 * też na stronie meczu — badge grupy w pasku, tylko dla organizatora).
 *
 * Przypisanie do grupy jest ORTOGONALNE do widoczności — mecz grupy może być
 * publiczny — więc jest osobnym wierszem, nie trzecią kartą przy „Publiczne /
 * Prywatne".
 *
 * Układ i pobieranie grup jak w `InviteFromGroupDialog`: bottom sheet od
 * najmniejszych ekranów, wyśrodkowana karta od `sm:`.
 *
 * Zakładanie nowej grupy dzieje się TUTAJ, jako drugi tryb tego samego
 * dialogu — nie przez `<Link href="/grupy/nowe">`. Nawigacja na osobną trasę
 * wyrzucała organizatora z kreatora meczu w połowie wypełniania (i to nawet
 * gdy szkic w localStorage przeżywał, powrót przez „Wstecz" przeglądarki był
 * zaskoczeniem). Formularz jest tu celowo okrojony do nazwy i sportu — reszta
 * pól `/grupy/nowe` (miasto, boisko, opis) poczeka do edycji grupy później.
 *
 * Nazewnictwo ujednolicone na „grupa" — dawniej ten dialog i przyciski wokół
 * niego mówiły „ekipa", co obok badge'a „Grupa" na stronie meczu wyglądało
 * jak dwie różne, niedokończone funkcje zamiast jednej.
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

  const [tryb, setTryb] = useState<'lista' | 'nowa'>('lista');
  const [nazwaNowej, setNazwaNowej] = useState('');
  const [sportNowej, setSportNowej] = useState('');
  const [tworzenie, setTworzenie] = useState(false);
  const [bladNowej, setBladNowej] = useState<string | null>(null);

  useEffect(() => {
    getMyGroups(userId)
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : 'Nie udało się wczytać grup'))
      .finally(() => setLoading(false));
  }, [userId]);

  const zalozGrupe = async () => {
    const trimmed = nazwaNowej.trim();
    if (trimmed.length < 2) {
      setBladNowej('Nazwa musi mieć co najmniej 2 znaki');
      return;
    }
    setTworzenie(true);
    setBladNowej(null);
    try {
      const id = await createGroup({ name: trimmed, sport: sportNowej || undefined }, userId);
      const grupa = await getGroup(id);
      if (!grupa) throw new Error('Grupa została utworzona, ale nie udało się jej wczytać');
      onWybierz(grupa);
    } catch (e) {
      setBladNowej(e instanceof Error ? e.message : 'Nie udało się utworzyć grupy');
      setTworzenie(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          {tryb === 'nowa' ? (
            <button
              type="button"
              onClick={() => setTryb('lista')}
              className="-ml-1 text-slate-400 hover:text-slate-600"
              aria-label="Wróć do listy grup"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Users className="h-4 w-4 text-slate-400" />
          )}
          <h2 className="font-semibold text-ink">{tryb === 'nowa' ? 'Nowa grupa' : 'Mecz w ramach grupy'}</h2>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tryb === 'nowa' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="nazwa-nowej-grupy" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nazwa grupy
                </label>
                <input
                  id="nazwa-nowej-grupy"
                  value={nazwaNowej}
                  onChange={(e) => setNazwaNowej(e.target.value)}
                  placeholder="np. Czwartkowa gierka"
                  maxLength={60}
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Sport <span className="font-normal text-slate-400">— opcjonalnie</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_SPORTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSportNowej((v) => (v === s ? '' : s))}
                      className={
                        sportNowej === s
                          ? 'inline-flex items-center gap-1.5 rounded-xl border border-primary-600 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700'
                          : 'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
                      }
                    >
                      <span>{sportEmoji(s)}</span> {sportLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {bladNowej && <p className="text-sm text-red-600">{bladNowej}</p>}

              <button
                type="button"
                onClick={zalozGrupe}
                disabled={nazwaNowej.trim().length < 2 || tworzenie}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 disabled:opacity-50"
              >
                {tworzenie && <Loader2 className="h-4 w-4 animate-spin" />}
                Załóż i wybierz
              </button>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-red-600">{error}</p>
          ) : groups.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">
                Nie należysz jeszcze do żadnej grupy. Załóż ją, a mecz trafi do jej
                historii i zobaczą go wszyscy członkowie.
              </p>
              <button
                type="button"
                onClick={() => setTryb('nowa')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800"
              >
                <Users className="h-4 w-4" /> Załóż grupę
              </button>
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

              <button
                type="button"
                onClick={() => setTryb('nowa')}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
              >
                <Users className="h-4 w-4" /> Załóż nową grupę
              </button>
            </>
          )}
        </div>

        {tryb === 'lista' && wybranaId && (
          <div className="border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => onWybierz(null)}
              className="text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
            >
              Nie przypisuj do grupy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
