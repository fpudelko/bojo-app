'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { getMyInvites, type InviteWithEvent } from './playerInvites';
import { getMyParticipationMap, type MyEventRelation, type MyEventStatus } from './events';
import { isUpcoming } from './eventDates';
import type { EventItem } from '@/types';

export interface UseMyInvitesResult {
  /** Invites still awaiting a reaction — same filter InvitesSection applies
   *  on the dashboard, so the badge on /wydarzenia and the tab count on
   *  /moje-gry agree with the home page on what counts as "open". */
  open: InviteWithEvent[];
  openCount: number;
  loading: boolean;
  statusFor: (event: EventItem) => MyEventRelation;
}

/**
 * Named match invites (event_player_invites, migracja 060) for the current
 * user. Self-contained (fetches its own participation map, same pattern as
 * useDashboardData) so it can be dropped into any page — /wydarzenia's badge
 * and /moje-gry's "Zaproszenia" tab both use it — without depending on the
 * home dashboard's hook.
 */
export function useMyInvites(): UseMyInvitesResult {
  const { user } = useAuth();
  const [invites, setInvites] = useState<InviteWithEvent[]>([]);
  const [participationMap, setParticipationMap] = useState<Record<string, MyEventStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setInvites([]); setParticipationMap({}); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([getMyInvites(user.id), getMyParticipationMap(user.id)]).then(([invitesR, mapR]) => {
      if (cancelled) return;
      setInvites(invitesR.status === 'fulfilled' ? invitesR.value.filter(({ event }) => isUpcoming(event)) : []);
      setParticipationMap(mapR.status === 'fulfilled' ? mapR.value : {});
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  const statusFor = useCallback((event: EventItem): MyEventRelation => ({
    isOrganizer: !!user && event.organizerId === user.id,
    status: participationMap[event.id] ?? 'none',
  }), [user, participationMap]);

  // Only 'invited' status counts as open — an invite the user already
  // answered (joined, observing, pending, reserve) no longer carries it, see
  // lib/events.ts#getMyParticipationMap.
  const open = useMemo(
    () => invites.filter(({ event }) => statusFor(event).status === 'invited'),
    [invites, statusFor],
  );

  return { open, openCount: open.length, loading, statusFor };
}
