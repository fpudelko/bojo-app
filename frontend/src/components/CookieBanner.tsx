'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'bojo_cookie_consent_v1';

// Structure prepared for future analytics consent.
// Currently only 'necessary' cookies are used (Supabase session).
type ConsentLevel = 'necessary'; // extend to 'analytics' | 'marketing' when needed

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch { /* SSR or private mode */ }
  }, []);

  function accept() {
    try {
      const consent: { level: ConsentLevel; date: string } = {
        level: 'necessary',
        date: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Informacja o plikach cookie"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-gray-900 border-t border-gray-700 px-4 py-3"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="flex-1 text-sm text-gray-300">
          Używamy tylko niezbędnych plików cookie do obsługi sesji logowania.
          Nie stosujemy śledzenia ani reklam.{' '}
          <Link href="/prywatnosc" className="text-primary-400 hover:text-primary-300 underline">
            Polityka prywatności
          </Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          OK, rozumiem
        </button>
      </div>
    </div>
  );
}
