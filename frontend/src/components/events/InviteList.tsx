'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
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
        // Przycisk odrzucania na całą szerokość, w odstępie od karty, czytał się
        // jak osobny wiersz listy — przy trzech zaproszeniach pod rząd nie było
        // wiadomo, którego dotyczy. Teraz jest wąski, dosunięty do prawej
        // krawędzi karty i bez przerwy nad sobą, więc widać, do czego należy.
        <div key={invite.id}>
          <EventBrowseCard event={event} relation={statusFor(event)} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => dismiss(invite.id)}
              className="inline-flex items-center gap-1 rounded-b-xl border border-t-0 border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              Odrzuć
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
