'use client';

import { useAuth } from '@/lib/auth';
import { useBottomNavHidden } from '@/lib/bottomNavVisibility';
import BottomNav from './BottomNav';

/**
 * Mounts the (previously dead — zero importers before this change)
 * BottomNav for signed-in users only, in one place in app/layout.tsx instead
 * of every page importing it individually. ~75% of phone use is one-thumb;
 * tap accuracy in the bottom third of the screen is far higher than near the
 * top — so the dashboard's main actions belong down here, not just in
 * Header's hamburger menu.
 *
 * Never mounted alongside the landing's StickyCta: that one only renders for
 * signed-out visitors, this one only for signed-in ones. Both use z-[1000]
 * but can't collide.
 *
 * Hidden while any <HideBottomNav/> is mounted — e.g. the match wizard (it
 * distracts the organizer) or the event page before the user has joined (it
 * would cover the "Dołącz"/"Obserwuj" bar).
 */
export default function BottomNavGate() {
  const { user, loading } = useAuth();
  const hidden = useBottomNavHidden();
  if (loading || !user || hidden) return null;
  return <BottomNav />;
}
