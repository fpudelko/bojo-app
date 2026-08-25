'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useBottomNavHidden } from '@/lib/bottomNavVisibility';
import { useJestWidget } from '@/lib/widget';
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
  const jestWidget = useJestWidget();
  const visible = !loading && !!user && !hidden && !jestWidget;

  // Zaznaczamy obecność paska na <html>, żeby CSS mógł odjąć jego wysokość od
  // pełnego ekranu (--bottom-nav-h w globals.css). Element-dystans tego nie
  // załatwiał: gate montuje się w layoucie PO {children}, więc dystans lądował
  // poza kontenerem `min-h-screen` strony i tylko wydłużał dokument.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.dataset.bottomNav = '1';
    return () => { delete document.documentElement.dataset.bottomNav; };
  }, [visible]);

  if (!visible) return null;
  return <BottomNav />;
}
