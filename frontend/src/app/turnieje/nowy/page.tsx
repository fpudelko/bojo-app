import { redirect } from 'next/navigation';

/**
 * `/turnieje/nowy` → `/turnieje/nowe`.
 *
 * Bez tego pliku literówka wpadała w trasę dynamiczną `/turnieje/[id]` jako
 * identyfikator turnieju i kończyła się komunikatem „Nie znaleziono turnieju" —
 * czyli zdaniem, które sugeruje, że turniej istniał i przepadł, zamiast że
 * adres jest zły. Trasa statyczna ma pierwszeństwo przed segmentem dynamicznym,
 * więc sam plik wystarcza.
 *
 * Ten sam wzorzec co `/gracze` → `/wydarzenia` (patrz AGENTS.md).
 */
export default function NowyTurniejPrzekierowanie() {
  redirect('/turnieje/nowe');
}
