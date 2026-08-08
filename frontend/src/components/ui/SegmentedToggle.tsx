'use client';

import { clsx } from 'clsx';

/**
 * Dwustanowy przełącznik z przesuwającą się ramką — dla wyborów, w których
 * obie opcje mają być widoczne naraz („Gry | Obiekty" na mapie). Tam, gdzie
 * chodzi o włącz/wyłącz jednej cechy, właściwy jest `TogglePill`.
 *
 * `grid-cols-2` zamiast `flex`: wskaźnik ma stałą szerokość połowy kontenera,
 * więc segmenty muszą być równe — przy `flex` szerszy tekst przesunąłby
 * podświetlenie obok przycisku, który podświetla.
 */
export default function SegmentedToggle<T extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly [{ value: T; label: string }, { value: T; label: string }];
  ariaLabel: string;
}) {
  const drugaAktywna = value === options[1].value;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid shrink-0 grid-cols-2 rounded-full border border-slate-200 bg-white p-0.5 shadow-md"
    >
      <span
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-primary-50 ring-2 ring-primary-700 transition-transform duration-200 ease-out',
          drugaAktywna && 'translate-x-full',
        )}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative z-10 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
