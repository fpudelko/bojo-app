'use client';

import { clsx } from 'clsx';

/**
 * Przełącznik z treścią, która pojawia się DOPIERO po włączeniu.
 *
 * PO CO. Krok „Kiedy" niósł wcześniej wszystkie ustawienia naraz — czas na
 * decyzję z rezerwy, koszt, metody płatności, tryby miejsc dla bramkarzy —
 * i było to kilkanaście kontrolek, z których typowy mecz nie potrzebuje ani
 * jednej. Formularz wyglądał jak deklaracja podatkowa, choć trzy czwarte pól
 * odpowiadało na pytania, których organizator sobie nie zadał.
 *
 * WSZYSTKIE TRZY SĄ DOMYŚLNIE WYŁĄCZONE. To jest decyzja produktowa, nie
 * kosmetyka: mecz bez rezerwy, za darmo i bez rozróżniania bramkarzy jest
 * najczęstszym meczem w Bojo, więc ma powstawać bez ani jednego dodatkowego
 * dotknięcia. Kto potrzebuje więcej, włącza to świadomie — i dopiero wtedy
 * widzi, o co pyta.
 *
 * `podpis` mówi, co się stanie po włączeniu, ZANIM ktoś włączy. Bez tego
 * przełącznik jest zagadką: „Rezerwa" nie znaczy nic komuś, kto nie wie, że
 * Bojo prowadzi kolejkę.
 */
export default function OpcjaMeczu({
  tytul, podpis, wlaczona, naZmiane, children,
}: {
  tytul: string;
  podpis: string;
  wlaczona: boolean;
  naZmiane: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={clsx(
      'rounded-2xl border transition-colors',
      wlaczona
        ? 'border-primary-200 bg-primary-50/40 dark:border-primary-800 dark:bg-primary-950/30'
        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
    )}>
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{tytul}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{podpis}</p>
        </div>
        {/* `min-h-[44px]` na obszarze dotykowym, nie na samym torze
            przełącznika — tor ma 24 px wysokości i sam w sobie jest celem
            poniżej progu, w który da się trafić kciukiem. */}
        <button
          type="button"
          role="switch"
          aria-checked={wlaczona}
          aria-label={tytul}
          onClick={() => naZmiane(!wlaczona)}
          className="flex min-h-[44px] shrink-0 items-center"
        >
          <span className={clsx(
            'relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors',
            wlaczona ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-600',
          )}>
            <span className={clsx(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              wlaczona ? 'translate-x-5' : 'translate-x-0',
            )} />
          </span>
        </button>
      </div>

      {/* Szczegóły montują się dopiero po włączeniu — nie są ukryte przez CSS.
          Ukryte pole formularza nadal bierze udział w walidacji i nadal jedzie
          w stanie, więc „wyłączone" znaczyłoby wtedy co innego niż wygląda. */}
      {wlaczona && children && (
        <div className="border-t border-primary-100 px-4 py-4 dark:border-primary-900">
          {children}
        </div>
      )}
    </div>
  );
}
