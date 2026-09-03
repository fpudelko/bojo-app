import { supabase } from './supabase';

/**
 * App-wide analytics events. Fire-and-forget — analytics must never block or
 * break a user action, so all failures are swallowed with a console warning.
 * Read by the admin dashboard at /admin/analityka.
 */
export type AnalyticsEvent =
  | 'login'
  | 'event_created'
  | 'event_joined'
  | 'group_created'
  | 'group_joined'
  // ── LEJEK ORGANIZATORA (2026-09-03) ──────────────────────────────────────
  // Pięć zdarzeń wyżej mówi, ILE rzeczy powstało. Nie mówią, gdzie ludzie
  // odpadają — a audyt ścieżki organizatora sam sobie to wypomniał:
  // „dopóki nie wiadomo, ilu ludzi odpada na którym kroku, kolejność napraw
  // jest sądem, nie pomiarem”. Poniższe siedem odpowiada na pytania, których
  // bez nich nie da się zadać.
  /** Wejście na krok kreatora (`{ krok: 1|2|3 }`) — gdzie kończy się „dwie minuty”. */
  | 'wizard_step'
  /** Otwarcie okna „Tak zobaczą to gracze” — ilu doszło do publikacji i się wycofało. */
  | 'wizard_summary_open'
  /** Organizator wysłał link (`{ eventId, skad }`) — czy pętla viralowa w ogóle rusza. */
  | 'event_shared'
  /** Ktoś otworzył stronę meczu z linku spoza Bojo. Jedyne zdarzenie, które
   *  powstaje też dla NIEZALOGOWANYCH (polityka INSERT dopuszcza `user_id IS NULL`)
   *  — bez tego nie da się policzyć „ilu otworzyło link, ilu weszło do składu”,
   *  czyli miary, wokół której kręci się cała faza 1. */
  | 'event_link_opened'
  /** Zapis bez konta — jaka część składu wchodzi tą drogą. */
  | 'guest_joined'
  /** Gość zamienił wpis na konto — realna konwersja, dziś nieznana. */
  | 'guest_claimed'
  /** Organizator wysłał rozliczenie ekipie — czy domknięcie po meczu wychodzi poza jego ekran. */
  | 'settlement_shared';

export async function track(
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      event_type: eventType,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.warn('[analytics]', eventType, e);
  }
}
