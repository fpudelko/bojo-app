'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { ostatniZamierzonyCel } from '@/lib/powrotPoLogowaniu';
import { WARSTWA } from '@/lib/warstwy';

/**
 * Modal wyboru roli, pokazywany raz — od razu po organicznej rejestracji
 * (bez konkretnego celu, np. dołączenia do meczu albo przejęcia wpisu
 * gościa). Cel dołączania trzymamy jako ALLOWLISTĘ neutralnych miejsc,
 * zamiast listy "kontekstów dołączania": bezpieczniejszy domyślny wynik —
 * nieznany cel NIE pokazuje modala, więc nowe ścieżki dołączania (grupa,
 * turniej, przejęcie wpisu gościa) nie muszą tu być osobno wymieniane, żeby
 * modal się nie wepchnął w środek ich flow.
 *
 * Ograniczenie do świeżych kont (utworzonych w ciągu ostatnich 10 minut)
 * chroni istniejących użytkowników przed niespodziewanym onboardingiem przy
 * pierwszym logowaniu po wdrożeniu tej funkcji.
 */
const CELE_NEUTRALNE = new Set(['/', '/wydarzenia', '/moje-gry', '/mapa']);
const SWIEZOSC_MS = 10 * 60 * 1000;

function kluczWidziano(uid: string) {
  return `bojo:onboarding-rola:${uid}`;
}

export default function PostSignupRoleModal() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(kluczWidziano(user.id))) return;

    const wiekMs = Date.now() - new Date(user.created_at).getTime();
    if (wiekMs >= SWIEZOSC_MS) return;

    const cel = ostatniZamierzonyCel();
    const neutralny = cel === null || CELE_NEUTRALNE.has(cel);
    if (!neutralny) return;

    setOpen(true);
  }, [user]);

  const zamknij = () => {
    if (user) localStorage.setItem(kluczWidziano(user.id), '1');
    setOpen(false);
  };

  const wybierz = (cel: string) => {
    zamknij();
    router.push(cel);
  };

  if (!open || !user) return null;

  return (
    <div
      className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4`}
      onClick={zamknij}
    >
      <div
        className="flex w-full max-w-sm flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-ink">Witaj w Bojo, {displayName(user)}!</h2>
          <button onClick={zamknij} className="text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-slate-600">Zanim zaczniesz — kim jesteś?</p>

          <button
            type="button"
            onClick={() => wybierz('/grupy/nowe')}
            className="w-full rounded-xl border-2 border-primary-600 bg-primary-50 p-4 text-left"
          >
            <span className="block text-sm font-semibold text-primary-800">🏆 Jestem organizatorem</span>
            <span className="mt-0.5 block text-xs text-primary-700">
              Załóż grupę i zbierz stałą ekipę na mecze
            </span>
          </button>

          <div className="rounded-xl border border-slate-200 p-4">
            <span className="block text-sm font-semibold text-ink">⚽ Jestem graczem</span>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => wybierz('/grupy')}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700"
              >
                Dołącz do swojej grupy
              </button>
              <button
                type="button"
                onClick={() => wybierz('/wydarzenia')}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700"
              >
                Przeglądaj aktywne mecze
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
