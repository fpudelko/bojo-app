'use client';
import Link from 'next/link';
import { useCookieBannerVisible, dismissCookieConsent } from '@/lib/cookieConsent';

export default function CookieBanner() {
  const visible = useCookieBannerVisible();

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Informacja o cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      // Baner jest `fixed`, więc dopełnienie <body> go nie dotyczy — musi
      // sam odsunąć się o wysokość dolnej nawigacji. --bottom-nav-h wynosi
      // 0 px wszędzie tam, gdzie paska nie ma (wylogowany, desktop, strona
      // ze schowanym paskiem), więc warunek z useAuth/useBottomNavHidden
      // przestał być potrzebny.
      style={{ marginBottom: 'var(--bottom-nav-h)' }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
        <p className="flex-1 text-slate-600 leading-snug">
          Używamy tylko niezbędnych cookies (logowanie). Bez śledzenia, bez reklam.{' '}
          <Link href="/prywatnosc" className="font-medium text-primary-700 underline underline-offset-2">
            Szczegóły
          </Link>
        </p>
        <button
          onClick={dismissCookieConsent}
          className="shrink-0 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95"
        >
          OK, rozumiem
        </button>
      </div>
    </div>
  );
}
