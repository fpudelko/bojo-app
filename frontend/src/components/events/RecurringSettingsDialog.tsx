'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Ustawienia cyklicznego powtarzania, otwierane z kafelka „Wydarzenie
 * cykliczne” na kroku 2 kreatora meczu.
 *
 * Nic tu się nie zapisuje do bazy — to czysto lokalny stan kreatora. Dopiero
 * finalny submit meczu (jeśli kafelek jest włączony) tworzy szablon w
 * `recurring_events` przez `createRecurringEvent()` (patrz `lib/recurring.ts`
 * i `wydarzenia/nowe/page.tsx`). Dzięki temu odklikiwanie kafelka i ponowna
 * edycja przez ikonę ołówka to zwykłe operacje na stanie React, bez ryzyka
 * niespójnych zapisów częściowych.
 */
export default function RecurringSettingsDialog({
  dayOfWeekLabel,
  notifyDaysBefore,
  onSave,
  onClose,
}: {
  /** np. "poniedziałek" — wyliczone z wybranej daty w kreatorze. `null`, gdy
   *  data jeszcze nie wybrana. */
  dayOfWeekLabel: string | null;
  notifyDaysBefore: number;
  onSave: (notifyDaysBefore: number) => void;
  onClose: () => void;
}) {
  // Minimum 1: od migracji `073` ta wartość steruje AUTOMATYCZNYM tworzeniem
  // kolejnego terminu, a 0 znaczyłoby „utwórz mecz w dniu meczu" — za późno,
  // żeby ktokolwiek zdążył się zapisać.
  const [draft, setDraft] = useState(Math.max(1, notifyDaysBefore));

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-ink">Wydarzenie cykliczne</h2>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {dayOfWeekLabel ? (
            <p className="text-sm text-slate-700">
              Mecz będzie się powtarzał co tydzień, w <span className="font-semibold">{dayOfWeekLabel}</span>.
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              Najpierw wybierz datę meczu — dzień tygodnia ustawi się automatycznie.
            </p>
          )}

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Otwieraj zapisy: <span className="font-semibold text-primary-600">{draft} {draft === 1 ? 'dzień' : 'dni'} przed terminem</span>
            </label>
            <input
              type="range"
              min={1}
              max={14}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Kolejne terminy Bojo tworzy samo, z tym wyprzedzeniem. Gracze z poprzedniego meczu
            dostaną wtedy powiadomienie, że zapisy są otwarte — ustawienia (cena, płatności,
            bramkarze) każdy nowy termin dziedziczy po poprzednim.
          </p>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!dayOfWeekLabel}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
