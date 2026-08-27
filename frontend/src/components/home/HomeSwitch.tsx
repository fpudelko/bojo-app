'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/**
 * There is still no server-side session (Supabase keeps it in localStorage,
 * no middleware.ts), so the server can't know FOR CERTAIN who's looking at
 * "/". What it does get is `hint` — a presentational cookie set by
 * AuthProvider (lib/auth.tsx via lib/sessionHint.ts) — so it can render the
 * right SHAPE on the first response instead of always guessing "logged out".
 *
 * While auth is resolving, both the server and this first client render see
 * `loading=true` and the same `hint` prop, so they produce identical markup
 * — no hydration mismatch.
 *
 * JEDEN PULPIT, NIE DWA (2026-08-23). Zalogowany nie dostaje tu już własnego
 * pulpitu (`AppHome`) — leci na `/moje-gry`. Powód: te dwa ekrany renderowały
 * te same sekcje (`InvitesSection`, `NextMatchCard`, `MyMatchesSection`), co
 * stało wprost w komentarzu w `/moje-gry`: „Ten sam układ co pulpit dla
 * zalogowanych (AppHome)". Do tego pulpit na „/" był poza dolną nawigacją —
 * pasek prowadzi na `/moje-gry`, `/mapa`, `/rozmowy`, `/grupy` i do kreatora,
 * więc na „/" wchodziło się WYŁĄCZNIE przez logo w nagłówku. Utrzymywaliśmy
 * drugi, trudniej dostępny pulpit, który sam z siebie rozjeżdżał się
 * z pierwszym. Wygrywa ten z paska.
 *
 * Landing zostaje bez zmian dla WYLOGOWANYCH i dla robotów — te nie mają
 * ciasteczka sesji, więc SEO „/" nie rusza się ani o milimetr.
 *
 * Przekierowanie jest klienckie, bo dopiero klient zna prawdziwą sesję;
 * ciasteczko-podpowiedź może być nieaktualne i nie wolno na nim opierać
 * nawigacji. `replace`, nie `push` — inaczej „wstecz" wracałoby na „/",
 * które natychmiast przekierowuje z powrotem, i przycisk „wstecz" przestaje
 * działać.
 *
 * A full fix (real server-side session via @supabase/ssr + middleware) is a
 * separate, later step — tracked in BACKLOG.md §5.
 */
export default function HomeSwitch({ hint, landing, skeleton }: {
  hint: boolean;
  landing: React.ReactNode;
  skeleton: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/moje-gry');
  }, [loading, user, router]);

  if (loading) return <>{hint ? skeleton : landing}</>;
  // Zalogowany widzi szkielet, nie landing, przez tę jedną klatkę do
  // przekierowania: mignięcie strony sprzedażowej komuś, kto ma konto, jest
  // gorsze niż mignięcie pustego szkieletu.
  return user ? <>{skeleton}</> : <>{landing}</>;
}
