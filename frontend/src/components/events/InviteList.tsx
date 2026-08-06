'use client';

import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { dismissInvite, type InviteWithEvent } from '@/lib/playerInvites';
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
  /** Controlled mode: parent owns the dismissed-ids set, e.g. so a header
   *  count can shrink in step with the list. Omit both props for
   *  uncontrolled mode — the list tracks its own dismissals. */
  dismissedIds?: Set<string>;
  onDismiss?: (inviteId: string) => void;
}

/**
 * "Nie tym razem" + EventBrowseCard for a list of open invites — shared by
 * the dashboard's InvitesSection and the "Zaproszenia" tab on /moje-gry so
 * both render identically instead of two copies of the same markup.
 */
export function InviteList({ invites, statusFor, limit, emptyMessage, dismissedIds, onDismiss }: InviteListProps) {
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());
  const dismissed = dismissedIds ?? localDismissed;

  const dismiss = (inviteId: string) => {
    if (onDismiss) { onDismiss(inviteId); return; }
    // Optimistic: the invite disappears immediately — dismissing never
    // breaks anything, so waiting on the network here would just look like
    // a stall.
    setLocalDismissed((prev) => new Set(prev).add(inviteId));
    dismissInvite(inviteId).catch(() => {});
  };

  const visible = invites.filter(({ invite }) => !dismissed.has(invite.id));
  const shown = limit ? visible.slice(0, limit) : visible;

  if (shown.length === 0) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  return (
    <div className="space-y-3">
      {shown.map(({ invite, event }) => (
        // Zaproszenie NIE jest meczem, w którym się gra — ktoś dopiero pyta.
        // Bez wyróżnienia karta zaproszenia wygląda identycznie jak karta
        // „Twoje najbliższe mecze" i czyta się jak zobowiązanie, którego nie ma.
        // Stąd obwódka, tło i nagłówek nad kartą.
        <div
          key={invite.id}
          className="rounded-2xl border-2 border-primary-200 bg-primary-50/60 p-2.5"
        >
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Mail className="h-3.5 w-3.5 shrink-0 text-primary-700" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Zaproszenie
            </span>
          </div>

          <EventBrowseCard event={event} relation={statusFor(event)} />

          {/* „Nie tym razem" było szarym tekstem 12 px i czytało się jak podpis
              pod kartą, nie jak akcja — stąd zgłoszenie, że nie da się odrzucić
              zaproszenia. Teraz to przycisk z obwódką i ikoną. */}
          <button
            type="button"
            onClick={() => dismiss(invite.id)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
            Odrzuć zaproszenie
          </button>
        </div>
      ))}
    </div>
  );
}
