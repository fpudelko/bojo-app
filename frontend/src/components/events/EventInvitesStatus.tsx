'use client';

import { useEffect, useState } from 'react';
import { Users, Check, Clock, X } from 'lucide-react';
import { getEventInvitesWithNames, type InviteWithName } from '@/lib/playerInvites';
import { inviteStatus, compareByInviteStatus, type InviteStatus } from '@/lib/inviteStatus';

const BADGE: Record<InviteStatus, { label: string; cls: string; icon: typeof Check }> = {
  joined:   { label: 'Dołączył(a)',  cls: 'bg-green-100 text-green-800',  icon: Check },
  waiting:  { label: 'Czeka',        cls: 'bg-slate-100 text-slate-600',  icon: Clock },
  declined: { label: 'Nie tym razem', cls: 'bg-red-50 text-red-600',      icon: X },
};

/**
 * „Kogo zaprosiłem, kto odpowiedział" — tylko dla organizatora (RLS i tak nie
 * przepuści reszty: SELECT na `event_player_invites`, migracja `060`, widzi
 * organizator, sam zaproszony i admin).
 *
 * `dismissed_at` istniał w bazie od migracji `060`, ale nigdzie się go nie
 * pokazywało — „odpowiedź" na zaproszenie to zwykłe dołączenie na stronie
 * meczu, więc status „Dołączył(a)" liczymy z uczestnictwa, które strona ma
 * już wczytane (`joinedUserIds`), bez drugiego zapytania o `event_participants`.
 */
export default function EventInvitesStatus({ eventId, joinedUserIds }: {
  eventId: string;
  joinedUserIds: Set<string>;
}) {
  const [invites, setInvites] = useState<InviteWithName[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEventInvitesWithNames(eventId)
      .then((rows) => { if (!cancelled) setInvites(rows); })
      .catch(() => { if (!cancelled) setInvites([]); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!invites || invites.length === 0) return null;

  const sorted = [...invites].sort((a, b) => compareByInviteStatus(
    inviteStatus(a.dismissedAt, a.userId, joinedUserIds),
    inviteStatus(b.dismissedAt, b.userId, joinedUserIds),
  ));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Users className="h-4 w-4" /> Zaproszeni ({invites.length})
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {sorted.map((inv) => {
          const status = inviteStatus(inv.dismissedAt, inv.userId, joinedUserIds);
          const { label, cls, icon: Icon } = BADGE[status];
          return (
            <li key={inv.id} className="flex items-center gap-2.5 py-2">
              {inv.avatarUrl
                ? <img src={inv.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {inv.name.charAt(0).toUpperCase()}
                  </span>
                )}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{inv.name}</span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
                <Icon className="h-3 w-3" strokeWidth={2.5} /> {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
