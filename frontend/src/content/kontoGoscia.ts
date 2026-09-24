// Korzyści konta dla gościa bez konta (F-6, docs/faza1-organizator-plan.md).
//
// Jedno źródło dla dwóch ekranów tej samej ścieżki — okno po zapisie na
// stronie meczu (`EventDetailClient.tsx`) i `/gracz/przejmij/[token]` —
// które dotąd obiecywały dwie NIEPRAWDZIWE rzeczy: „Dołączysz do ekipy"
// (konto nie dołącza do żadnej ekipy samo z siebie) i „Przejrzysz otwarte
// gry w okolicy" (otwartych gier jest dziś za mało, co landing mówi sam,
// `LANDING_MISJA.uczciwie`). Mail `zaloz_konto`
// (`supabase/functions/powiadom-goscia/tresc.ts`) ma listę uczciwą i
// konkretną od początku — te dwa ekrany dostają dziś TĘ SAMĄ treść.
//
// Druga pozycja jest prawdziwa DOPIERO po F-5 („Powtórz mecz" zaprasza
// poprzedni skład) — stąd ten plik wchodzi w PR-C, po PR-B.
//
// Funkcja brzegowa jest w Deno i nie importuje z frontendu, więc mail ma
// WŁASNĄ kopię tej samej listy — `__tests__/kontoGoscia.test.ts` czyta
// `tresc.ts` jako tekst i sprawdza, że każda pozycja występuje tam
// dosłownie. Dopisując/zmieniając pozycję tutaj, zmień ją też tam.
export const KORZYSCI_KONTA = [
  'Na kolejny mecz zapisujesz się jednym kliknięciem, bez wpisywania danych',
  'Organizator zaprosi Cię na następny termin, a Ty dostaniesz powiadomienie',
  'Widzisz wszystkie swoje mecze w jednym miejscu',
] as const;
