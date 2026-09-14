'use client';

import { clsx } from 'clsx';

/**
 * Ikona sportu w rzędzie wyboru — sam emoji, bez podpisu w środku.
 *
 * PODPIS ZSZEDŁ POD RZĄD IKON — 2026-09-14, zgłoszone wprost. Wcześniej
 * pigułka pokazywała nazwę po wybraniu, przez co wybrana rosła w poziomie
 * i przestawiała cały rząd: ikony skakały pod palcem przy każdym dotknięciu,
 * a przy dwóch wybranych rząd łamał się na dwa wiersze. Dziś każda ikona ma
 * stały kwadrat 44×44 px, więc rząd stoi w miejscu niezależnie od wyboru,
 * a co jest wybrane — mówi jedna linijka pod spodem (`multiLabel()`
 * w `lib/eventFilters.ts`).
 *
 * Nazwa nie znika z dostępności: siedzi w `aria-label` i `title`, więc
 * czytnik ekranu i kursor mają ją tak samo jak przedtem.
 *
 * NIE MA TU IKONY „WSZYSTKIE SPORTY". Brak wyboru ZNACZY wszystkie i tak
 * mówi podpis pod rzędem — osobna piąta ikona z tym samym 🏟️ była piątym
 * celem dotyku na to, żeby wrócić do stanu domyślnego, a przy okazji jedyną
 * ikoną w rzędzie, która nie jest sportem.
 *
 * Jeden komponent, bo ten sam wybór stoi w trzech miejscach (arkusze filtrów
 * na `/wydarzenia` i `/mapa` oraz okno alertu) — rozjechałyby się przy
 * pierwszej zmianie.
 */
export default function SportChip({ emoji, label, selected, onClick }: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={clsx(
        // Kwadrat 44 px: pełne pole dotyku (WCAG 2.5.5) i stała szerokość,
        // której wybór nie zmienia.
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg transition-colors',
        selected
          ? 'border-primary-700 bg-primary-50 dark:bg-primary-950'
          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700',
      )}
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}
