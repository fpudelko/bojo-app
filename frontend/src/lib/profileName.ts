// Nazwa, pod którą użytkownik pokazuje się innym graczom.
//
// Selektory `displayName` / `firstName` / `avatarUrl` mieszkają tutaj, a nie
// w `auth.tsx`, z jednego praktycznego powodu: to czyste funkcje, a Vitest nie
// potrafi transformować `.tsx` przy `jsx: preserve` z tsconfig.json. W pliku
// z kontekstem Reacta byłyby nietestowalne — a to właśnie one decydują o tym,
// co zobaczy obcy człowiek na stronie meczu. `auth.tsx` re-eksportuje je, więc
// wszystkie dotychczasowe importy z `@/lib/auth` działają bez zmian.
//
// Powód istnienia: `organizer_name` i `event_participants.name` trafiają na
// publiczną, indeksowaną stronę meczu (razem z JSON-LD). Konto założone
// e-mailem bez wypełnienia opcjonalnego wtedy pola „Imię" publikowało mecz pod
// PEŁNYM adresem e-mail organizatora — `displayName()` spadało na `user.email`,
// podczas gdy `firstName()` obcinało adres na „@" od dawna. Ta niespójność
// między dwiema funkcjami w jednym pliku była wyciekiem danych, nie kosmetyką.

import type { User } from '@supabase/supabase-js';

/** Lokalna część adresu e-mail. Nigdy nie pokazujemy całego adresu publicznie. */
export function nazwaZEmaila(email: string | null | undefined): string {
  if (!email) return '';
  return email.split('@')[0]?.trim() ?? '';
}

// Litery, myślnik i apostrof — nic więcej. Cyfry i znaki specjalne odpadają,
// bo to ma być imię i nazwisko, nie pseudonim z forum.
//
// Zakresy wypisane wprost zamiast `\p{L}`: właściwości Unicode wymagają flagi
// `u`, a ta jest niedostępna przy `target: ES5` z tsconfig.json (TS1501).
// À-Ö, Ø-ö, ø-ÿ to litery Latin-1 (m.in. ó, ü, é), Ā-ſ to Latin Extended-A
// (ą, ć, ę, ł, ń, ś, ź, ż oraz reszta alfabetów środkowoeuropejskich).
const LITERY = "A-Za-zÀ-ÖØ-öø-ÿĀ-ſ";
const CZLON = new RegExp(`^[${LITERY}][${LITERY}'-]*$`);

/** Imię i nazwisko: co najmniej dwa człony po ≥2 znaki.
 *  Odrzuca „Jan", „J K", „   ", „Jan 2000". */
export function isPelneImie(v: string | null | undefined): boolean {
  if (!v) return false;
  const czlony = v.trim().split(/\s+/).filter(Boolean);
  if (czlony.length < 2) return false;
  return czlony.every((c) => c.length >= 2 && CZLON.test(c));
}

/** Returns the avatar URL stored in user metadata, or null. */
export function avatarUrl(user: User | null): string | null {
  return user?.user_metadata?.avatar_url ?? null;
}

/** Preferred display name: custom → Google full name → email local part → fallback.
 *
 *  Ostatnie ogniwo to CELOWO sama lokalna część adresu, nie cały adres. Ta nazwa
 *  trafia do `organizer_name` i `event_participants.name`, czyli na publiczną,
 *  indeksowaną stronę meczu razem z JSON-LD — pełny e-mail organizatora nie ma
 *  prawa tam wyjść. `firstName()` niżej obcinało adres od dawna; tu tego
 *  brakowało i to była jedyna różnica między tymi dwiema funkcjami. */
export function displayName(user: User | null): string {
  if (!user) return '';
  return (
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    nazwaZEmaila(user.email) ||
    'Gracz'
  );
}

/** First name only, for compact greetings ("Cześć, Janek 👋"). Cuts a bare
 *  e-mail down at the "@" first, so a user with no display name never greets
 *  themselves by their full address. */
export function firstName(user: User | null): string {
  const name = displayName(user);
  if (!name) return '';
  const first = name.split('@')[0].trim().split(/\s+/)[0] ?? '';
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1);
}
