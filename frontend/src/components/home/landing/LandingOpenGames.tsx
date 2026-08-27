import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getPublicEvents } from '@/lib/events';
import { isEventJoinable } from '@/lib/eventDates';
import { EventBrowseCard } from '@/components/EventBrowseCard';

/**
 * Proof, not promise: shows real open games when there are any.
 *
 * Server component, nie kliencki ze stanem `loading` — do 2026-08-24 dane
 * dociągały się w `useEffect`, więc ta sekcja nie istniała w HTML pierwszej
 * odpowiedzi serwera: strona główna nie miała ani jednego linku do meczu
 * w tym, co dostaje robot (docs/seo-geo-strategia.md, D18). `relation` na
 * karcie zostaje bez wartości: to jest landing wyłącznie dla NIEZALOGOWANYCH
 * (HomeSwitch w app/page.tsx), więc dla każdego odwiedzającego wynik
 * `useMyParticipation()` i tak zawsze był `undefined` — ten sam stan, tylko
 * liczony po stronie klienta zamiast wprost.
 *
 * Puste zapytanie nadal renderuje `null`: pusta/szkieletowa sekcja na zimnej
 * bazie mówiłaby pierwszy raz odwiedzającemu, że produkt jest pusty.
 */
export default async function LandingOpenGames() {
  const events = await getPublicEvents().catch(() => []);

  const openEvents = events.filter((e) => {
    if (e.status === 'cancelled') return false;
    const taken = e.participantsCount ?? 0;
    return isEventJoinable(e) && taken < e.maxPlayers;
  });

  if (openEvents.length === 0) return null;

  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Możesz dołączyć już dziś
          </h2>
          <Link href="/wydarzenia" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800">
            Wszystkie <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="space-y-3">
          {openEvents.slice(0, 3).map((e) => (
            <EventBrowseCard key={e.id} event={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
