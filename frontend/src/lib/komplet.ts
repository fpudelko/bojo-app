/**
 * Wygląd stanu „komplet" — jedno miejsce dla całej aplikacji.
 *
 * PO CO TO POWSTAŁO: ten sam stan malowały cztery karty i każda inaczej.
 * `EventBrowseCard` dawała pasek `#dc2626` i plakietkę czerwoną, `GameFeedCard`
 * pasek `#ef4444` (inna czerwień) i inną plakietkę, `EventListCard` sam czerwony
 * napis bez tła, a `/cykliczne` szarą plakietkę. Do tego pasek bywał zielony
 * (kolor sportu) albo bursztynowy przy 80% — więc ta sama karta zmieniała barwę
 * trzy razy, zanim doszła do kompletu.
 *
 * DLACZEGO NIE CZERWONY: czerwień w tej aplikacji znaczy „coś poszło źle" —
 * odwołany mecz, błąd, usunięcie. Komplet nie jest awarią, tylko stanem, o
 * który się gra: mecz się odbędzie, jest komu grać. Czerwona plakietka mówiła
 * organizatorowi „masz problem" dokładnie w chwili, w której osiągnął cel.
 *
 * DLACZEGO NIEBIESKI (decyzja właściciela, 2026-08-19): to ma być kolor
 * informacyjny, nie alarmowy, i ma być JEDEN. Uwaga na kolizję: `AGENTS.md`
 * rezerwuje `blue-*` dla „wymaga akceptacji uczestnictwa". Komplet jest stanem
 * pojemności, nie prośbą o decyzję, więc te dwa znaczenia są rozłączne — ale
 * jeśli kiedykolwiek staną obok siebie na jednej karcie, trzeba to rozstrzygnąć
 * na nowo, a nie dokładać trzecie znaczenie po cichu.
 */

/** Kolor wypełnienia paska postępu przy komplecie (`blue-600`). */
export const KOLOR_PASKA_KOMPLET = '#2563eb';

/** Klasy Tailwinda plakietki „Komplet" — tło, tekst, obramowanie. */
export const PLAKIETKA_KOMPLET = 'bg-blue-50 text-blue-700 border border-blue-200';

/** Klasy Tailwinda wypełnienia paska, gdy pasek malowany jest klasą, nie stylem. */
export const PASEK_KOMPLET = 'bg-blue-600';
