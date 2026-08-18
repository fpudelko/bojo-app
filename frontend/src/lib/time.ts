/** Konwersje zegarowego `HH:MM` na minuty od północy i z powrotem — do
 *  przesuwania godziny końca o deltę przy zmianie godziny startu (i vice
 *  versa), np. w modalach "Zmień termin" i "Powtórz mecz". */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * „Kiedy się zapisał" przy nazwisku w składzie.
 *
 * Format zależy od tego, jak dawno to było — bo inaczej czyta się każdą z tych
 * informacji. Przy meczu za trzy dni liczy się godzina („kto był pierwszy"),
 * przy zapisie sprzed dwóch tygodni sama data. Stąd:
 *
 *   dzisiaj      → „dziś 18:42"
 *   wczoraj      → „wczoraj 21:05"
 *   do 7 dni     → „pon 14:32"        (dzień tygodnia wystarcza do orientacji)
 *   dawniej      → „12 sie"           (godzina przestaje cokolwiek znaczyć)
 *
 * `teraz` wstrzykiwane, żeby funkcja była testowalna bez zamrażania zegara.
 * Pusty string dla pustego wejścia — wiersz bez daty (dane sprzed migracji
 * dodającej `created_at`) ma nie renderować nic zamiast „Invalid Date".
 */
const DNI_SKROT = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MIESIACE_SKROT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function etykietaZapisu(iso: string | null | undefined, teraz: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const godzina = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // Porównanie po DNIU kalendarzowym, nie po różnicy godzin: zapis o 23:50
  // i spojrzenie o 00:10 to „wczoraj", a nie „20 minut temu".
  const dzien = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const roznicaDni = Math.round((dzien(teraz) - dzien(d)) / 86_400_000);

  if (roznicaDni === 0) return `dziś ${godzina}`;
  if (roznicaDni === 1) return `wczoraj ${godzina}`;
  if (roznicaDni > 1 && roznicaDni < 7) return `${DNI_SKROT[d.getDay()]} ${godzina}`;
  return `${d.getDate()} ${MIESIACE_SKROT[d.getMonth()]}`;
}
