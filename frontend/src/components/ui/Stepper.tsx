'use client';

import { Minus, Plus } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Liczba z przyciskami − / +, dla filtrów, w których liczy się DOKŁADNA
 * wartość, a nie miejsce na osi.
 *
 * DLACZEGO NIE SUWAK — 2026-09-14, zgłoszone wprost („wolne miejsca niech nie
 * będzie suwakiem tylko przyciski plus i minus"). Suwak jest dobry, gdy
 * człowiek szuka PROGU i widzi cały zakres naraz (odległość, data). Przy
 * „wolnych miejscach" pytanie brzmi „ilu nas idzie" — odpowiedź to zwykle 1,
 * 2 albo 4, a trafienie palcem w konkretną liczbę na suwaku długim na cały
 * ekran jest trudniejsze niż dwa dotknięcia „+".
 *
 * Górna granica jest tu po to, żeby dało się wpisać wszystko, co realne,
 * a nie żeby zgadywać za użytkownika: żaden mecz nie ma stu wolnych miejsc,
 * więc `max` nie odcina niczego, co istnieje.
 */
export default function Stepper({
  label, value, onChange, min, max, formatValue, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  /** Jak przeczytać liczbę („co najmniej 3", „Dowolna liczba"). */
  formatValue: (v: number) => string;
  /** Jedna linijka pod spodem — dla znaczenia, którego sama liczba nie niesie. */
  hint?: string;
}) {
  const przycisk = 'flex h-11 w-11 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-ink">{formatValue(value)}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${label}: mniej`}
          className={clsx(przycisk, 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300')}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>

        {/* `role="status"` zamiast zwykłego tekstu: przy sterowaniu z klawiatury
            albo czytnikiem ekranu naciśnięcie „+" nie przenosi ogniskowej, więc
            bez tego nikt nie usłyszałby, co się zmieniło. */}
        <output
          aria-live="polite"
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-lg font-bold tabular-nums text-ink dark:border-slate-700"
        >
          {value}
        </output>

        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${label}: więcej`}
          className={clsx(przycisk, 'border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950')}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}
