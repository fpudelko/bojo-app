'use client';

import GreetingBar from './dashboard/GreetingBar';
import NextMatchCard from './dashboard/NextMatchCard';
import {
  InvitesSection,
  MyMatchesSection,
  ObservingSection,
  GroupGamesSection,
  OpenGamesSection,
  MyGroupsSection,
  OnboardingSection,
} from './dashboard/DashboardSections';
import LandingFaq from './landing/LandingFaq';
import { DashboardContentSkeleton } from './AppHomeSkeleton';
import { useDashboardData } from '@/lib/useDashboardData';
import { splitMyEvents, nextMatch } from '@/lib/myEvents';

/**
 * Dashboard shown to signed-in users. Rebuilt around one question a
 * returning user actually has — "what and when am I playing" — instead of
 * opening with the same marketing hero the logged-out landing uses. Data
 * comes from a single useDashboardData() call (§3.3 of the redesign plan)
 * instead of five independent effects each rebuilding their own copy of the
 * participation map.
 */
export default function AppHome({ userId }: { userId: string }) {
  const data = useDashboardData(userId);

  if (data.loading) {
    return (
      <>
        <GreetingBar />
        <DashboardContentSkeleton />
      </>
    );
  }

  const { playing, observing } = splitMyEvents(data.myEvents);
  const next = nextMatch(data.myEvents);
  const restPlaying = playing.filter(({ event }) => event.id !== next?.event.id);

  return (
    <>
      <GreetingBar />
      <section className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 pt-2">
        <InvitesSection invites={data.invites} statusFor={data.statusFor} />
        <NextMatchCard row={next} />
        <MyMatchesSection items={restPlaying} />
        <ObservingSection items={observing} />
        <GroupGamesSection events={data.groupEvents} statusFor={data.statusFor} />
        <MyGroupsSection groups={data.groups} />
        <OpenGamesSection events={data.openEvents} statusFor={data.statusFor} alert={data.alert} />
        <OnboardingSection />
      </section>
      <LandingFaq />
    </>
  );
}
