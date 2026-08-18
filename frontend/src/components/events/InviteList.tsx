'use client';

import { useState } from 'react';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import OdpowiedzJednymKlikiem from '@/components/events/OdpowiedzJednymKlikiem';
import type { InviteWithEvent } from '@/lib/playerInvites';
import type { MyEventRelation } from '@/lib/events';
import type { EventItem } from '@/types';

interface InviteListProps {
  invites: InviteWithEvent[];
  statusFor: (event: EventItem) => MyEventRelation;
  /** Cap how many render — omit for no limit (the /moje-gry tab). */
  limit?: number;
  /** Shown instead of nothing when the list is empty — omit to render null
   *  (the dashboard's InvitesSection behaviour: the whole section vanishes). */
  emptyMessage?: React.ReactNode;
  /** Zbiór ukrytych zaproszeń, gdy rodzic nim zarządza — dziś nic ich nie
   *  dodaje, bo lista nie ma już przycisku odrzucania. Zostaje, bo licznik
   *  w nagłówku sekcji liczy się z tego samego zbioru. */
  dismissedIds?: Set<string>;
}

/**
 * Lista otwartych zaproszeń — wspólna dla strony głównej i zakładki
 * „Zaproszenia" w Moich grach, żeby obie renderowały to samo zamiast dwóch
 * kopii tego samego układu.
 *
 * Pod każdą kartą para małych przycisków „Gram" / „Nie gram"
 * (`OdpowiedzJednymKlikiem`). Dwa wcześniejsze podejścia — obwódka
 * z nagłówkiem „ZAPROSZENIE" i para PEŁNYCH przycisków pod kartą — odpadły,
 * bo przy trzech zaproszeniach lista robiła się ścianą kontrolek. Tu przyciski
 * mają rozmiar plakietki i stoją w jednym wierszu wyrównanym do prawej, więc
 * kolejne zaproszenia dokładają jeden wiersz, a nie osobny blok.
 *
 * Problem był prawdziwy i to jest jego rozwiązanie: bez tego „tak" kosztowało
 * więcej kliknięć niż „nie" (nic nie rób), w produkcie, którego sensem jest
 * zebranie składu.
 */
export function InviteList({ invites, statusFor, limit, emptyMessage, dismissedIds }: InviteListProps) {
  const [localDismissed] = useState<Set<string>>(new Set());
  const dismissed = dismissedIds ?? localDismissed;
  // Zaproszenia odpowiedziane W TEJ SESJI. Znikają od razu, bez czekania na
  // przeładowanie listy: karta, która po kliknięciu „Gram" dalej wisi jako
  // nieodpowiedziana, czyta się jak błąd zapisu i ludzie klikają drugi raz.
  const [odpowiedziane, setOdpowiedziane] = useState<Set<string>>(new Set());

  const visible = invites.filter(({ invite }) => !dismissed.has(invite.id) && !odpowiedziane.has(invite.id));
  const shown = limit ? visible.slice(0, limit) : visible;

  if (shown.length === 0) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  return (
    <div className="space-y-3">
      {shown.map(({ invite, event }) => (
        <div key={invite.id}>
          <EventBrowseCard event={event} relation={statusFor(event)} />
          <div className="mt-1.5 flex justify-end">
            <OdpowiedzJednymKlikiem
              eventId={event.id}
              onOdpowiedziano={() => setOdpowiedziane((prev) => new Set(prev).add(invite.id))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
