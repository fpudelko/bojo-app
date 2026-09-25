'use client';

import type { ReactNode } from 'react';
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
  value, onChange, options, ariaLabel, size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  /** `icon` zamiast napisu — patrz komentarz przy `zIkonami` niżej. Podpis
   *  z `label` zostaje wtedy nazwą dostępną (`aria-label`) i podpowiedzią. */
  options: readonly [
    { value: T; label: string; icon?: ReactNode },
    { value: T; label: string; icon?: ReactNode },
  ];
  ariaLabel: string;
  /** `sm` — dla przełącznika drugorzędnego obok głównego wyboru (np. „Lista |
   *  Mapa" przy „Gry | Obiekty" w scalonej wyszukiwarce). Mniejsza plakietka
   *  odróżnia „JAK patrzę" od „NA CO patrzę", więc oba naraz nie konkurują
   *  o uwagę. */
  size?: 'md' | 'sm';
}) {
  const drugaAktywna = value === options[1].value;
  const maly = size === 'sm';
  // WARIANT IKONOWY — 2026-09-14, zgłoszone wprost („Lista i Mapa zmienić na
  // ikonki, taki przełącznik jak jest, ale zamiast napisów ikonki"). Powód
  // jest mierzalny, nie estetyczny: pasek wyszukiwarki na telefonie łamał się
  // na dwa wiersze, a dwa napisy kosztują w nim więcej miejsca niż dwa
  // kwadraty 36×36. Kształt przełącznika zostaje ten sam, więc dalej widać
  // OBA stany naraz — a tylko to odróżniało go od guzika z ikoną.
  //
  // Ikony muszą być w OBU opcjach albo w żadnej: jedna ikona i jeden napis
  // rozjechałyby szerokości segmentów, czyli dokładnie to, przed czym broni
  // `grid-cols-2` wyżej.
  const zIkonami = options[0].icon != null && options[1].icon != null;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid shrink-0 grid-cols-2 rounded border border-slate-200 bg-white p-0.5 shadow-md"
    >
      <span
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded bg-primary-50 ring-2 ring-primary-700 transition-transform duration-200 ease-out',
          drugaAktywna && 'translate-x-full',
        )}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          // Nazwa dostępna z `label` także w wariancie ikonowym — inaczej
          // czytnik ekranu dostałby przycisk bez nazwy, a scenariusze
          // klikalności celują w `getByRole('radio', { name: 'Lista' })`.
          aria-label={zIkonami ? o.label : undefined}
          title={zIkonami ? o.label : undefined}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative z-10 flex items-center justify-center whitespace-nowrap rounded font-medium transition-colors',
            zIkonami
              ? 'h-9 w-9'
              : maly ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {zIkonami ? o.icon : o.label}
        </button>
      ))}
    </div>
  );
}
