'use client';

import { useState } from 'react';
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
        <div key={invite.id} className="space-y-1.5">
          <EventBrowseCard event={event} relation={statusFor(event)} />
          <button
            onClick={() => dismiss(invite.id)}
            className="px-1 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Nie tym razem
          </button>
        </div>
      ))}
    </div>
  );
}
