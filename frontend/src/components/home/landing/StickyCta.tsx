'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LANDING_CTA } from './content';

// Sticky mobile CTA: appears once the hero CTA scrolls out of view.
// Research puts the lift on long mobile pages at roughly 10-25%.
export default function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('hero-cta-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      // Not merely "not intersecting" — that's also true before the sentinel
      // has ever been reached (it starts below the fold). Only show once the
      // sentinel has scrolled ABOVE the viewport (top < 0).
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[1000] border-t border-black/10 bg-white/95 px-4 pt-3 backdrop-blur-md transition-transform duration-200 motion-reduce:transition-none md:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      aria-hidden={!visible}
    >
      <Link
        href={LANDING_CTA.primary.href}
        tabIndex={visible ? 0 : -1}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent-500 text-sm font-bold text-primary-950 shadow-sm transition-colors hover:bg-accent-400 active:scale-[0.98] motion-reduce:active:scale-100"
      >
        {LANDING_CTA.primary.label}
      </Link>
    </div>
  );
}
