// Tytuły i opisy pisane POD WYNIK WYSZUKIWANIA — osobno od JSX, żeby dały się
// testować bez renderowania (AGENTS.md, „Copy stron treści i landingu żyje
// w frontend/src/content/*.ts"). Do 2026-09-01 stały wprost w `app/layout.tsx`
// i `app/dlaczego-bojo/page.tsx`, więc nie pilnował ich żaden test: metadane nie
// mają odpowiednika w interfejsie, więc ich utraty nie widzą ani zrzuty ekranu,
// ani Playwright.
//
// DLACZEGO BRZMIĄ TAK, A NIE JAK HASŁO REKLAMOWE — to jest wniosek z pomiaru,
// nie kwestia gustu. Search Console (docs/seo-geo-strategia.md 7a.2, pomiar
// właściciela 2026-08-29, pierwszy w historii projektu): w trzy miesiące
// 56 wyświetleń, 0 kliknięć, średnia pozycja 9,4 — i WSZYSTKIE zapytania markowe:
// „co to bojo" (18 wyświetleń), „bojo" (8), „bojo co to" (7).
//
// To jest jedyny klaster zapytań, na którym Bojo dziś realnie się wyświetla,
// i jedyny z twardymi danymi zamiast szacunku. Zero kliknięć przy pozycji ~9
// ma przyczynę nazwaną w rozdz. 2c strategii: „bojo" to w polszczyźnie potocznej
// „boisko", więc wynik stoi w SERP-ie obok definicji słownikowej. Poprzedni tytuł
// („Bojo — zbierz ekipę, zagraj dziś | Boiska i mecze w Polsce") nie miał ani
// jednego słowa, które by tę definicję podważało — „boiska", „zagraj",
// „zbierz ekipę" wszystkie ją POTWIERDZAŁY. Człowiek pytający „co to jest bojo"
// nie dostawał odpowiedzi na swoje pytanie, więc nie miał po co klikać.
//
// Odróżnia encję od słowa pospolitego dokładnie jedna rzecz: RZECZOWNIK KATEGORII
// postawiony przy marce. To ta sama zasada, którą maszynom mówi wprost
// `disambiguatingDescription` w `lib/structuredData.ts` i którą rozdz. 6.1
// nakazuje przy każdej wzmiance o marce („Bojo (bojo.pl)", nigdy samo „Bojo").

/**
 * `title.default` z `app/layout.tsx` — tytuł strony głównej i awaryjny dla stron
 * bez własnego. BEZ ręcznego sufiksu „| Bojo": dokłada go `title.template`
 * stronom podrzędnym, a tutaj dałby „| Bojo | Bojo" (dług P3).
 */
export const TYTUL_DOMYSLNY = 'Bojo (bojo.pl) — aplikacja do organizowania amatorskich meczów';

/**
 * `description` z `app/layout.tsx`. Zaczyna się od nazwy encji, bo w wynikach
 * generatywnych ten akapit trafia do modelu wyrwany z kontekstu strony — ta sama
 * zasada co w `llm-context.md`. Sprzedaje jedną wartość, tę z
 * `docs/outreach-organizatorzy.md` §2: gracze dołączają bez zakładania konta
 * (RPC `dolacz_do_meczu_jako_goscie()`, migracje 082–088 — obietnica z pokryciem).
 */
export const OPIS_DOMYSLNY =
  'Bojo to aplikacja dla organizatora amatorskich meczów: zakładasz mecz, ' +
  'wysyłasz jeden link i widzisz, kto gra. Gracze dołączają bez zakładania konta.';

/**
 * Tytuł `/dlaczego-bojo` — DRUGIEJ i jedynej poza landingiem strony, którą Google
 * miał w indeksie 2026-08-29. Wyświetla się na te same zapytania markowe, czyli
 * trafia do kogoś, kto jeszcze nie wie, czym Bojo jest; „Dlaczego Bojo" samo
 * w sobie tę wiedzę zakładało. Sufiks „| Bojo" dokłada `title.template`.
 */
export const TYTUL_DLACZEGO = 'Dlaczego Bojo — aplikacja zamiast grupy na WhatsAppie i Facebooku';

/**
 * Podgląd linku (czat, media społecznościowe) i nazwa pod ikoną PWA
 * (`app/manifest.ts`) ZOSTAJĄ przy haśle — świadomie, nie przez przeoczenie.
 * Te powierzchnie odpowiadają na inne pytanie niż wynik wyszukiwania: przy
 * podglądzie linku i przy ikonie na ekranie telefonu odbiorca już wie, czym Bojo
 * jest, bo dostał link od organizatora albo sam zainstalował aplikację.
 * Rozdzielenie jest celem — nie ujednolicaj tego „dla spójności".
 */
export const HASLO_PODGLADU = 'Bojo — zbierz ekipę, zagraj dziś';
