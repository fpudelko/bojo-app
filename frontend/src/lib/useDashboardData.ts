'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getMyParticipatedEvents,
  getMyGroupEvents,
  getPublicEvents,
  getMyParticipationMap,
  type MyEventRelation,
  type MyEventStatus,
} from '@/lib/events';
import { getMyGroups } from '@/lib/groups';
import { getMyInvites, type InviteWithEvent } from '@/lib/playerInvites';
import { getMyAlert } from '@/lib/alerts';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import { isEventJoinable, isUpcoming } from '@/lib/eventDates';
import type { EventItem, GameAlert, Group } from '@/types';
import type { MyEventRow } from '@/lib/myEvents';

export interface DashboardData {
  loading: boolean;
  /** Something failed to load — shown, don't pretend the dashboard is empty. */
  hadError: boolean;
  invites: InviteWithEvent[];
  myEvents: MyEventRow[];
  groupEvents: EventItem[];
  openEvents: EventItem[];
  groups: Group[];
  alert: GameAlert | null;
  statusFor: (event: EventItem) => MyEventRelation;
}

const EMPTY_STATE: Omit<DashboardData, 'statusFor'> = {
  loading: true,
  hadError: false,
  invites: [],
  myEvents: [],
  groupEvents: [],
  openEvents: [],
  groups: [],
  alert: null,
};

/**
 * Single entry point for everything the dashboard shows. Replaces five
 * independent effects (one per AppHome section, before this hook existed)
 * that each fired on every visit — three of them building their own copy of
 * the participation map via useMyParticipation(). This fetches it once and
 * hands every section the same `statusFor`.
 *
 * Promise.allSettled so one failing query (say, groups) doesn't blank the
 * sections that succeeded — hadError flags that something came back short,
 * without the dashboard silently pretending it's simply empty.
 */
export function useDashboardData(userId: string): DashboardData {
  const [state, setState] = useState<Omit<DashboardData, 'statusFor'>>(EMPTY_STATE);
  const [participationMap, setParticipationMap] = useState<Record<string, MyEventStatus>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      getMyInvites(userId),
      getMyParticipatedEvents(userId),
      getMyGroupEvents(userId),
      getPublicEvents(),
      getMyGroups(userId),
      getMyParticipationMap(userId),
      // Flag is off today — see lib/features.ts — but the shape stays ready
      // for when it isn't, without adding a round trip while it's dark.
      SHOW_GAME_ALERTS ? getMyAlert() : Promise.resolve(null),
    ]).then(([invitesR, myEventsR, groupEventsR, openEventsR, groupsR, mapR, alertR]) => {
      if (cancelled) return;

      const invites = invitesR.status === 'fulfilled'
        // `isEventJoinable`, nie `isUpcoming`: to drugie porównuje samą datę,
        // więc mecz dzisiejszy o 8:00 pozostawał „nadchodzący" jeszcze o 22:00
        // i wisiał w zaproszeniach po fakcie. Zaproszenie na mecz, który się
        // zaczął, nie jest już pytaniem, na które da się odpowiedzieć.
        ? invitesR.value.filter(({ event }) => isEventJoinable(event))
        : [];
      const myEvents = myEventsR.status === 'fulfilled' ? myEventsR.value : [];
      const groupEvents = groupEventsR.status === 'fulfilled'
        ? groupEventsR.value.filter(isUpcoming)
        : [];
      const openEvents = openEventsR.status === 'fulfilled' ? openEventsR.value : [];
      const groups = groupsR.status === 'fulfilled' ? groupsR.value : [];
      const map = mapR.status === 'fulfilled' ? mapR.value : {};
      const alert = alertR.status === 'fulfilled' ? (alertR.value as GameAlert | null) : null;

      const hadError = [invitesR, myEventsR, groupEventsR, openEventsR, groupsR, mapR, alertR]
        .some((r) => r.status === 'rejected');

      setParticipationMap(map);
      setState({ loading: false, hadError, invites, myEvents, groupEvents, openEvents, groups, alert });
    });

    return () => { cancelled = true; };
  }, [userId]);

  const statusFor = useCallback((event: EventItem): MyEventRelation => ({
    isOrganizer: event.organizerId === userId,
    status: participationMap[event.id] ?? 'none',
  }), [userId, participationMap]);

  return { ...state, statusFor };
}
