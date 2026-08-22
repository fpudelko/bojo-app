import { supabase } from './supabase';

/**
 * Numer BLIK organizatora — osobna tabela `event_blik` (migracja `120`),
 * nie kolumna w `events`.
 *
 * DLACZEGO OSOBNO. RLS w Postgresie jest WIERSZOWE, a `events` ma politykę
 * SELECT `USING (true)` — każdy, także niezalogowany, czyta każdy mecz.
 * Dopóki numer siedział w tym wierszu, leciał w każdej odpowiedzi `select('*')`
 * mimo że `canSeeBlikPhone()` (lib/payments.ts) chowa go w interfejsie.
 * Odebranie uprawnienia do samej kolumny wywróciłoby wszystkie `select('*')`
 * w repo, więc numer przeniósł się tam, gdzie da się go zamknąć polityką:
 * wiersz `event_blik` widzi organizator, delegat i uczestnik tego meczu.
 *
 * Reguła „dopiero godzinę przed meczem" zostaje w UI (`canSeeBlikPhone`) —
 * to wygoda dla uczestnika, nie ochrona przed nim.
 */

/** Wyciąga numer z wiersza `events` dociągniętego z `event_blik(...)`.
 *
 *  PostgREST przy relacji jeden-do-jeden (PK = FK) oddaje obiekt, ale przy
 *  starszym planie zapytania potrafi oddać tablicę — obsługujemy oba kształty,
 *  bo różnica jest niewidoczna w typach i wychodzi dopiero na produkcji. */
export function numerBlikZWiersza(row: Record<string, unknown> | null | undefined): string | undefined {
  const osadzone = (row as { event_blik?: unknown } | null | undefined)?.event_blik;
  const wiersz = Array.isArray(osadzone) ? osadzone[0] : osadzone;
  const numer = (wiersz as { blik_phone?: string } | null | undefined)?.blik_phone;
  return numer?.trim() || undefined;
}

/**
 * Zapisuje numer dla podanych meczów; pusty numer kasuje wiersz.
 *
 * Bierze LISTĘ meczów, bo seria cykliczna ustawia jeden numer na wszystkich
 * swoich terminach naraz (`updateSeriesSettings` w lib/series.ts).
 */
export async function zapiszNumerBlik(eventIds: string[], numer: string | null | undefined): Promise<void> {
  if (eventIds.length === 0) return;
  const czysty = numer?.trim() || null;

  if (!czysty) {
    const { error } = await supabase.from('event_blik').delete().in('event_id', eventIds);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from('event_blik')
    .upsert(
      eventIds.map((event_id) => ({ event_id, blik_phone: czysty, updated_at: new Date().toISOString() })),
      { onConflict: 'event_id' },
    );
  if (error) throw new Error(error.message);
}
