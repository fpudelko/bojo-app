'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, X } from 'lucide-react';

const STORAGE_KEY = 'bojo_cup_announce_dismissed_v1';

/**
 * Top utility bar promoting the Cup tournament — the primary acquisition hook.
 * Dismissible (persists per-browser). Hidden on the /turniej page itself
 * to avoid duplicating the CTA.
 */
export default function AnnouncementBar() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid SSR flash

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch { /* ignore */ }
  }, []);

  if (dismissed) return null;
  if (pathname?.startsWith('/turniej')) return null;

  function close() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="relative hidden md:block bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm font-medium">
        <Trophy className="w-4 h-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 truncate">
          <span className="font-bold">BOJO Cup</span>
          <span className="hidden sm:inline"> — pierwszy amatorski puchar Poznania. </span>
          <Link
            href="/turniej"
            className="underline underline-offset-2 font-semibold hover:text-amber-900 ml-1"
          >
            Zgłoś drużynę →
          </Link>
        </p>
        <button
          onClick={close}
          aria-label="Zamknij pasek turniejowy"
          className="shrink-0 p-1 rounded hover:bg-amber-600/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
