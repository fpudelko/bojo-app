// Akapity bezpośredniej odpowiedzi dla hubów katalogu boisk — `/boiska/[sport]`
// i `/boiska/woj/[wojewodztwo]`. Wzorem `content/miasta.ts#zdanieOKatalogu()`:
// generowane z danych, nie z JSX, żeby dało się testować bez renderowania
// i żeby liczba w tekście była zawsze tą, którą strona faktycznie policzyła
// (zapytaniem `count: 'exact'` w page.tsx), nie osobnym literałem.
//
// Do 2026-08-24 obie strony miały pod H1 wyłącznie jedną linijkę
// „Znalezionych obiektów: N" — dla wyszukiwarki to strona listingowa bez
// treści, dokładnie ten typ, który przegrywa z serwisem opisującym, co jest
// na liście. Ten sam akapit mówi też wprost, czym Bojo NIE jest (patrz
// content/miasta.ts#CZYM_BOJO_NIE_JEST) — bez tego zdania model generatywny
// myli hub katalogu z systemem rezerwacji obiektów.

export function wstepHubuSportu(ile: number, dopelniaczSportu: string): string {
  return (
    `W katalogu Bojo jest ${ile} obiektów do gry w ${dopelniaczSportu} — od orlików ` +
    'i boisk osiedlowych po hale. Dane pochodzą z OpenStreetMap, a szczegóły takie ' +
    'jak nawierzchnia i oświetlenie potwierdzają gracze przy poszczególnych obiektach. ' +
    'Bojo nie wynajmuje tych obiektów: służy do zebrania składu na termin, który już masz.'
  );
}

export function wstepHubuWojewodztwa(ile: number, wojewodztwoLabel: string): string {
  return (
    `W katalogu Bojo jest ${ile} obiektów sportowych w województwie ${wojewodztwoLabel} ` +
    '— od orlików i boisk osiedlowych po hale. Dane pochodzą z OpenStreetMap, ' +
    'a szczegóły takie jak nawierzchnia i oświetlenie potwierdzają gracze przy ' +
    'poszczególnych obiektach. Bojo nie wynajmuje tych obiektów: służy do zebrania ' +
    'składu na termin, który już masz.'
  );
}
