'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { LANDING_CTA } from './content';
import { useCookieBannerVisible } from '@/lib/cookieConsent';

// Sticky mobile CTA: appears once the hero CTA scrolls out of view.
// Research puts the lift on long mobile pages at roughly 10-25%.
//
// It also has to get out of the way at the bottom. `Landing` pads its own
// sections (`pb-24`), but the footer is a sibling of <main> in app/page.tsx —
// outside that padding — so a bar pinned to the viewport bottom covered the
// footer links. By the time the footer is on screen the page has already shown
// LandingFinalCta, so hiding the sticky bar there costs nothing.
export default function StickyCta() {
  const [pastHero, setPastHero] = useState(false);
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('hero-cta-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      // Not merely "not intersecting" — that's also true before the sentinel
      // has ever been reached (it starts below the fold). Only show once the
      // sentinel has scrolled ABOVE the viewport (top < 0).
      ([entry]) => setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtFooter(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const visible = pastHero && !atFooter;
  // The cookie banner is a full-width bar pinned to the same edge — sit above
  // it instead of overlapping its bottom-right corner while both are up.
  const cookieBannerVisible = useCookieBannerVisible();

  return (
    <div
      className={`fixed right-4 z-[1000] transition-[transform,opacity,bottom] duration-200 motion-reduce:transition-none md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{
        bottom: cookieBannerVisible
          ? 'calc(5.5rem + env(safe-area-inset-bottom))'
          : 'calc(1.25rem + env(safe-area-inset-bottom))',
      }}
      aria-hidden={!visible}
    >
      <Link
        href={LANDING_CTA.primary.href}
        tabIndex={visible ? 0 : -1}
        aria-label={LANDING_CTA.primary.label}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-primary-950 shadow-lg shadow-black/25 transition-colors hover:bg-accent-400 active:scale-[0.96] motion-reduce:active:scale-100"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Link>
    </div>
  );
}
