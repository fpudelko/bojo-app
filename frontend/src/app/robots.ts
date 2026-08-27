import type { MetadataRoute } from 'next';

// Paths that must never be indexed:
//   /admin   — admin panel
//   /api     — server routes, no user-facing content
//   /profil, /moje-gry — per-user pages, useless to a crawler
//   /d/, /g/ — join codes are the only access control on private events and
//              groups; a code sitting in a search index defeats it
//
// Dopisane 2026-08-23 po audycie SEO. Wszystkie poniższe trasy to komponenty
// klienckie ('use client'), a taki plik NIE MOŻE wyeksportować `metadata` —
// więc `noindex` per trasa odpada bez przebudowy każdej z nich na wrapper
// serwerowy. robots.txt jest tu jedyną dźwignią. Trzy grupy:
//
//   1. Techniczne: /auth/ (callback i reset hasła), /logowanie, /zglos-blad.
//   2. Kreatory i edycja: /wydarzenia/nowe, /grupy/nowe, */edytuj. Formularze
//      za logowaniem; /wydarzenia/nowe jest przy tym linkowane ze stopki
//      i z czterech CTA landingu, więc realnie zbierało odesłania.
//   3. Funkcje ZA WYŁĄCZONYMI FLAGAMI: /turniej (SHOW_CUP), /cykliczne
//      (SHOW_RECURRING), /obiekt i /rezerwacje (FEATURE_RESERVATIONS).
//      docs/funkcje.md mówi wprost: „reklamowanie ich wyszukiwarce obiecuje
//      coś, czego użytkownik nie znajdzie w interfejsie". Flagi chowają
//      wejścia w nawigacji, nie trasy — te odpowiadają normalnie.
//
// /gracz/ to publiczne profile graczy: imię, statystyki, historia meczów.
// Decyzja o prywatności, nie o SEO — profil w wynikach wyszukiwania to co
// innego niż profil pod linkiem. Domyślnie poza indeksem.
//
// UWAGA: robots.txt blokuje SKANOWANIE, nie usuwa z indeksu tego, co już tam
// jest. Gdyby Search Console pokazała któryś z tych adresów jako zaindeksowany,
// trzeba go najpierw wypuścić z `noindex` (wrapper serwerowy), a dopiero potem
// zablokować tutaj — patrz docs/seo-geo-strategia.md, P4.
const DISALLOW = [
  '/admin',
  '/api',
  '/profil',
  '/moje-gry',
  '/d/',
  '/g/',
  '/auth/',
  '/logowanie',
  '/zglos-blad',
  '/wydarzenia/nowe',
  '/wydarzenia/*/edytuj',
  '/grupy/nowe',
  '/grupy/*/edytuj',
  '/turniej',
  '/cykliczne',
  '/obiekt',
  '/rezerwacje',
  '/gracz/',
];

// Spelled out rather than left to the wildcard so the stance towards AI
// crawlers is a decision on record, not a side effect.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
];

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    // Indeks (sitemap-index.xml/route.ts) zamiast samego sitemap.xml — ten
    // ostatni ma dziś tylko strony statyczne i huby, boiska partycjonowane
    // po województwie żyją w osobnych plikach zebranych przez ten indeks.
    sitemap: `${base}/sitemap-index.xml`,
  };
}
