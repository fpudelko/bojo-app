'use client';

import { clsx } from 'clsx';
import {
  KIEDY_OPCJE, dataZKiedy, etykietaKiedy, type DateFilter,
} from '@/lib/eventFilters';

/** Jutro jako najwcześniejszy sensowny „własny termin": dzisiaj ma już swój
 *  przycisk, więc wybieranie go z kalendarza byłoby drugą drogą do tego
 *  samego. */
function jutro(teraz = new Date()): string {
  const d = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate() + 1);
  const dwie = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dwie(d.getMonth() + 1)}-${dwie(d.getDate())}`;
}

/**
 * „Kiedy" — cztery przyciski w JEDNEJ linii plus kalendarz dla własnego
 * terminu. 2026-09-14, zgłoszone wprost, w miejsce pięciopozycyjnego suwaka.
 *
 * DOTKNIĘCIE WYBRANEGO ODZNACZA i wraca do „wszystkich terminów" — bez tego
 * brak piątego przycisku „Wszystko" byłby pułapką: dałoby się zawęzić, ale nie
 * cofnąć. Ta sama mechanika co przy ikonach sportów, z tym samym podpisem pod
 * rzędem mówiącym, co jest teraz wybrane.
 *
 * Ten sam komponent stoi w arkuszu filtrów (wtedy znaczy „mecze w tym oknie")
 * i w oknie alertu (wtedy „jak długo powiadamiać"). To jedno pytanie zadane
 * dwa razy o co innego, ale o tym samym kształcie — dlatego `podpisWszystkich`
 * jest parametrem: „Wszystkie terminy" to co innego niż „Bezterminowo".
 */
export default function WyborKiedy({
  wartosc, naZmiane, label = 'Kiedy', podpisWszystkich,
}: {
  wartosc: DateFilter;
  naZmiane: (v: DateFilter) => void;
  label?: string;
  /** Co napisać pod rzędem przy braku wyboru. Domyślnie „Wszystkie terminy". */
  podpisWszystkich?: string;
}) {
  const wlasnaData = dataZKiedy(wartosc);
  const aktywna = wlasnaData ? 'wlasny' : wartosc;

  return (
    <div>
      <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {/* `grid-cols-4`, nie `flex`: cztery równe kolumny mieszczą się w jednej
          linii na najwęższym telefonie i nie przestawiają się, gdy podpis
          jednej z nich jest dłuższy. */}
      <div className="grid grid-cols-4 gap-1.5">
        {KIEDY_OPCJE.map((o) => {
          const wybrana = aktywna === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={wybrana}
              onClick={() => {
                if (wybrana) { naZmiane('wszystkie'); return; }
                naZmiane(o.value === 'wlasny' ? `do:${wlasnaData ?? jutro()}` : o.value);
              }}
              className={clsx(
                // 40 px wysokości: cel dotyku, a nie tylko podpis. Niżej niż
                // zalecane 44 px byłoby tylko po to, żeby zmieścić piąty
                // przycisk, którego tu nie ma.
                'flex h-10 items-center justify-center rounded-xl border px-1 text-xs font-semibold transition-colors',
                wybrana
                  ? 'border-primary-700 bg-primary-50 text-primary-800 dark:bg-primary-950'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {wlasnaData && (
        <input
          type="date"
          value={wlasnaData}
          min={jutro()}
          onChange={(e) => naZmiane(e.target.value ? `do:${e.target.value}` : 'wszystkie')}
          aria-label="Do dnia"
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      )}

      {/* Podpis pod rzędem — jedyne miejsce, gdzie skrócone „3 dni" i „Termin"
          rozwijają się w zdanie. Przy braku wyboru nazywa stan domyślny, który
          nie ma własnego przycisku. */}
      <p className="mt-2 text-sm font-medium text-ink">
        {wartosc === 'wszystkie' && podpisWszystkich ? podpisWszystkich : etykietaKiedy(wartosc)}
      </p>
    </div>
  );
}
