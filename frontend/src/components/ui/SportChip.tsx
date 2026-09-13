'use client';

import { clsx } from 'clsx';

/**
 * Pigułka wyboru sportu: ikona zawsze, podpis dopiero po wybraniu.
 *
 * Cztery sporty z podpisami zajmowały dwa wiersze arkusza filtrów na telefonie,
 * a podpis jest potrzebny dokładnie w jednym momencie — gdy trzeba przeczytać,
 * co się już wybrało. Niewybrane pigułki mówią to samo ikoną. Nazwa nie znika:
 * siedzi w `aria-label` i `title`, więc czytnik ekranu i kursor mają ją tak
 * samo jak przedtem.
 *
 * Jeden komponent, bo ten sam wybór stoi w dwóch miejscach (arkusz filtrów na
 * `/wydarzenia` i okno alertu) — rozjechałyby się przy pierwszej zmianie.
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
        'flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-medium transition-colors',
        // Niewybrana pigułka to sam emoji — bez `min-w` zrobiłby się cel
        // mniejszy niż palec.
        selected ? 'px-3' : 'min-w-[2.75rem] px-2',
        selected
          ? 'border-primary-700 bg-primary-50 text-primary-800 dark:bg-primary-950'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300',
      )}
    >
      <span aria-hidden="true">{emoji}</span>
      {selected && <span>{label}</span>}
    </button>
  );
}
