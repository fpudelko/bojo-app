'use client';

import { useState } from 'react';
import { EventBrowseCard } from '@/components/EventBrowseCard';
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
 * Same karty, bez przycisków odpowiedzi. Próbowaliśmy dwóch układów —
 * obwódki z nagłówkiem „ZAPROSZENIE" i pary przycisków „Dołączam"/„Odrzuć" —
 * i oba przeciążały listę wizualnie. Odpowiada się z poziomu meczu.
 * Odpowiadanie z listy wraca do backlogu jako osobne zadanie projektowe,
 * bo problem jest prawdziwy: dziś „tak" kosztuje więcej kliknięć niż „nie".

 */
export function InviteList({ invites, statusFor, limit, emptyMessage, dismissedIds }: InviteListProps) {
  const [localDismissed] = useState<Set<string>>(new Set());
  const dismissed = dismissedIds ?? localDismissed;

  const visible = invites.filter(({ invite }) => !dismissed.has(invite.id));
  const shown = limit ? visible.slice(0, limit) : visible;

  if (shown.length === 0) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  return (
    <div className="space-y-3">
      {shown.map(({ invite, event }) => (
        <EventBrowseCard key={invite.id} event={event} relation={statusFor(event)} />
      ))}
    </div>
  );
}
