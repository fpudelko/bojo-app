'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth';
import { getMyParticipationMap } from './events';
import type { CardStatus } from '@/components/EventBrowseCard';
import type { EventItem } from '@/types';

/**
 * Resolves how the signed-in user relates to an event, so list cards can show
 * "Grasz ✓" / "Obserwujesz" instead of inviting someone who is already in to
 * "Dołącz". Returns undefined for signed-out users and untouched events, which
 * keeps the default CTA.
 */
export function useMyParticipation() {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, { rsvp: 'yes' | 'maybe'; isReserve: boolean }>>({});

  useEffect(() => {
    if (!user) { setMap({}); return; }
    let cancelled = false;
    getMyParticipationMap(user.id)
      .then((m) => { if (!cancelled) setMap(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  return useCallback((event: EventItem): CardStatus | undefined => {
    if (!user) return undefined;
    if (event.organizerId === user.id) return 'organizer';
    const mine = map[event.id];
    if (!mine) return undefined;
    if (mine.rsvp === 'maybe') return 'observing';
    return mine.isReserve ? 'reserve' : 'player';
  }, [user, map]);
}
