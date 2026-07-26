'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth';
import { getMyParticipationMap, type MyEventStatus, type MyEventRelation } from './events';
import type { EventItem } from '@/types';

/**
 * Resolves how the signed-in user relates to an event, so list cards can show
 * "Grasz ✓" / "Obserwujesz" instead of inviting someone who is already in to
 * "Dołącz", and flag matches they organize.
 *
 * Returns undefined for signed-out users — cards then fall back to the plain
 * "Dołącz" call to action.
 */
export function useMyParticipation() {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, MyEventStatus>>({});

  useEffect(() => {
    if (!user) { setMap({}); return; }
    let cancelled = false;
    getMyParticipationMap(user.id)
      .then((m) => { if (!cancelled) setMap(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  return useCallback((event: EventItem): MyEventRelation | undefined => {
    if (!user) return undefined;
    return {
      isOrganizer: event.organizerId === user.id,
      status: map[event.id] ?? 'none',
    };
  }, [user, map]);
}
