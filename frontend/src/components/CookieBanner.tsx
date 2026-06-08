'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

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
      className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-md z-[9999] bg-gray-900 border border-gray-700 rounded-2xl shadow-xl px-4 py-3"
    >
      <button
        onClick={accept}
        aria-label="Zamknij i zaakceptuj informację o plikach cookie"
        className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <p className="text-xs sm:text-sm text-gray-300 pr-8 leading-relaxed">
        Używamy tylko niezbędnych cookies (logowanie). Bez śledzenia, bez reklam.{' '}
        <Link href="/prywatnosc" className="text-primary-400 hover:text-primary-300 underline">
          Szczegóły
        </Link>
      </p>
      <button
        onClick={accept}
        className="mt-2 w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
      >
        OK, rozumiem
      </button>
    </div>
  );
}
