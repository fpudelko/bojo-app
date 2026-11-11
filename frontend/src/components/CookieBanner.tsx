'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCookieBannerVisible, dismissCookieConsent } from '@/lib/cookieConsent';
import { useJestWidget } from '@/lib/widget';

export default function CookieBanner() {
  const visible = useCookieBannerVisible();
  const jestWidget = useJestWidget();

  const ref = useRef<HTMLDivElement>(null);
  const pokazany = visible && !jestWidget;

  // MIEJSCE NA BANER (audyt 7, 2026-11-11). Baner jest `fixed`, więc treść
  // strony nie wiedziała, że coś ją przykrywa: „Utwórz turniej" na dole
  // kreatora lądował pod banerem i dolnym menu i nie dało się go dotknąć.
  // Dopóki baner jest na ekranie, jego wysokość trafia do `--cookie-h`,
  // a <body> dostaje tyle samo dopełnienia (globals.css).
  useEffect(() => {
    const html = document.documentElement;
    const el = ref.current;
    if (!pokazany || !el) {
      delete html.dataset.cookieBaner;
      html.style.removeProperty('--cookie-h');
      return;
    }
    const ustaw = () => html.style.setProperty('--cookie-h', `${el.offsetHeight}px`);
    ustaw();
    html.dataset.cookieBaner = '1';
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ustaw) : null;
    obs?.observe(el);
    return () => {
      obs?.disconnect();
      delete html.dataset.cookieBaner;
      html.style.removeProperty('--cookie-h');
    };
  }, [pokazany]);

  if (!pokazany) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Informacja o cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      // Baner jest `fixed`, więc dopełnienie <body> go nie dotyczy — musi
      // sam odsunąć się o wysokość dolnej nawigacji. --bottom-nav-h wynosi
      // 0 px wszędzie tam, gdzie paska nie ma (wylogowany, desktop, strona
      // ze schowanym paskiem), więc warunek z useAuth/useBottomNavHidden
      // przestał być potrzebny.
      style={{ marginBottom: 'var(--dol-bezpieczny)' }}
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
