/**
 * Ile miejsc w składzie jest zajętych, licząc z surowych wierszy
 * `event_participants`: bez rezerwy, bez czekających na akceptację i BEZ
 * OBSERWUJĄCYCH (`rsvp = 'maybe'`). Ten sam warunek co `winienWplate()`
 * (`lib/payments.ts`) i `kolejkaRezerwy.ts`.
 *
 * Czysta funkcja bez importów, bo woła ją też serwerowa strona zaproszenia do
 * ekipy (`app/g/[code]/page.tsx`), która do W-8
 * (docs/faza1-przejscie-e2e-plan.md) liczyła obserwujących jako graczy.
 */
export function liczZajeteMiejsca(
  wiersze: ReadonlyArray<{ is_reserve?: boolean | null; pending_approval?: boolean | null; rsvp?: string | null }> | null | undefined,
): number {
  if (!Array.isArray(wiersze)) return 0;
  return wiersze.filter((p) => !p.is_reserve && !p.pending_approval && p.rsvp !== 'maybe').length;
}
