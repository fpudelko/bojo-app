'use client';

import { useEffect, useState } from 'react';
import { useBottomNavHidden } from './bottomNavVisibility';

// Shared between CookieBanner and the landing StickyCta FAB: the FAB needs
// to know when the banner is on screen so it can get out of its way in the
// bottom-right corner instead of overlapping it.
const KEY = 'bojo_cookie_consent_v1';
const DISMISS_EVENT = 'bojo:cookie-consent-dismissed';
const SCROLL_THRESHOLD = 300;
const TIMER_MS = 6000;

function hasCookieConsent(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function dismissCookieConsent(): void {
  try { localStorage.setItem(KEY, '1'); } catch {}
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

/** True once the cookie banner is actually on screen: consent not yet given,
 *  and the visitor has scrolled past the hero (or 6s passed on a short page).
 *  Single source of truth so CookieBanner and StickyCta agree on the state
 *  without either one guessing at the other's timing. */
export function useCookieBannerVisible(): boolean {
  const [dismissed, setDismissed] = useState(true);
  const [revealed, setRevealed] = useState(false);
  // Ekran z WŁASNYM dolnym paskiem akcji (kreator, „Dołącz bez konta”,
  // „Mój zapis”) deklaruje to przez <HideBottomNav/>. Baner stał tam
  // `z-50` nad paskiem `z-30` i przykrywał go w całości: gracz z linku po
  // 6 sekundach widział zamiast „Dołącz bez konta” wyłącznie „OK, rozumiem”
  // (W-1, docs/faza1-przejscie-e2e-plan.md). Baner tylko INFORMUJE (zgody nie
  // zbiera, cookies są wyłącznie niezbędne), więc może poczekać: `revealed`
  // liczy się dalej, a baner pokaże się na pierwszym ekranie bez paska.
  const ekranZPaskiemAkcji = useBottomNavHidden();

  useEffect(() => {
    setDismissed(hasCookieConsent());
    return onCookieConsentDismissed(() => setDismissed(true));
  }, []);

  useEffect(() => {
    if (dismissed || revealed) return;

    const onScroll = () => {
      if (window.scrollY > SCROLL_THRESHOLD) setRevealed(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const timer = window.setTimeout(() => setRevealed(true), TIMER_MS);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, [dismissed, revealed]);

  return !dismissed && revealed && !ekranZPaskiemAkcji;
}

function onCookieConsentDismissed(callback: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, callback);
  return () => window.removeEventListener(DISMISS_EVENT, callback);
}
