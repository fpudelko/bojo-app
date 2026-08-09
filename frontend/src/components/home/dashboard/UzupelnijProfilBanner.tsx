'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCog, X } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { isPelneImie } from '@/lib/profileName';

const KLUCZ = 'bojo_baner_nazwa_v1';

/**
 * „Gracze zobaczą Cię jako X — uzupełnij imię".
 *
 * Wyzwalacz z migracji `070` wysyła powiadomienie tylko NOWYM kontom bez nazwy.
 * Konta założone wcześniej nigdy go nie dostaną, a to właśnie one publikują dziś
 * mecze pod nazwą wyprowadzoną z adresu e-mail. Ten baner jest dla nich.
 *
 * Układ mobile-first: jedna kolumna od 320 px, bez media query.
 */
export default function UzupelnijProfilBanner() {
  const { user } = useAuth();
  // Zaczynamy od `true`, żeby baner nie mignął przed odczytem z localStorage.
  const [odrzucony, setOdrzucony] = useState(true);

  useEffect(() => {
    // Guarded storage — w trybie prywatnym dostęp potrafi rzucić wyjątkiem,
    // a to nie może wywrócić całego pulpitu (wzorzec z lib/eventDraft.ts).
    try {
      setOdrzucony(localStorage.getItem(KLUCZ) === '1');
    } catch {
      setOdrzucony(false);
    }
  }, []);

  const odrzuc = () => {
    setOdrzucony(true);
    try { localStorage.setItem(KLUCZ, '1'); } catch { /* nie szkodzi */ }
  };

  // `isPelneImie` (nie samo "czy jakieś pole nie jest puste") — Google OAuth
  // zawsze wypełnia `full_name`, więc słabszy check nigdy by tu nie zadziałał
  // dla kont z Google. Patrz `lib/profileName.ts`.
  if (!user || odrzucony || isPelneImie(displayName(user))) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
      <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Gracze zobaczą Cię jako <span className="font-semibold">{displayName(user)}</span>.
        </p>
        <Link
          href="/profil"
          className="mt-1 inline-block text-sm font-semibold text-amber-900 underline underline-offset-2 dark:text-amber-200"
        >
          Uzupełnij imię i nazwisko
        </Link>
      </div>
      <button
        type="button"
        onClick={odrzuc}
        aria-label="Zamknij"
        className="-mr-1 shrink-0 rounded-lg p-1 text-amber-700 transition hover:bg-amber-100 dark:hover:bg-amber-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
