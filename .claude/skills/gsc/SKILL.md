---
name: gsc
description: Punkt wejścia do wszystkiego, co dotyczy Google Search Console dla bojo.pl. Używaj, gdy użytkownik wkleja mail od GSC („Nowe problemy…”, „Nowy powód uniemożliwiający zindeksowanie…”), zrzut ekranu z search.google.com, eksport ZIP/CSV (Wykres.csv, Problemy krytyczne.csv, Zapytania.csv, Strony.csv…), komunikat weryfikacji („Sprawdź poprawkę”, „Nie można kontynuować weryfikacji”, „Weryfikacja nie powiodła się”), prosi o przegląd SEO, pyta o indeksację, CTR, pozycje, sitemapę, wyniki rozszerzone albo widoczność w AI Overviews, także bez słowa „GSC”. Rozpoznaje raport skryptem, daje werdykt „zamierzone czy błąd” wg mapy SEO Bojo, kieruje do gsc-dane-strukturalne, gsc-indeksowanie lub gsc-skutecznosc i pilnuje cyklu poprawka → deploy → weryfikacja → pomiar w docs/gsc-dziennik.md.
---

# Search Console w Bojo: punkt wejścia

Ruch organiczny Bojo przychodzi prawie w całości przez ~32 tys. stron obiektów
(980 z 1000 stron z wyświetleniami to `/boisko/*`). Search Console to jedyne miejsce,
gdzie widać, co Google o nich myśli. Ten skill zamienia to, co przychodzi
z GSC (mail, zrzut, eksport), w **werdykt dla tego konkretnego serwisu** i w listę
kroków. Nie daje ogólnej porady SEO.

Najdroższy błąd w tym repo to „naprawianie” rzeczy zamierzonych. Większość wierszy
„nie zindeksowano” w Bojo jest celowa: obiekty Tier 3 mają `noindex`, minione mecze
mają `noindex`, a kody dołączenia są zablokowane w robots.txt. Drugi najdroższy błąd
to uznanie realnego błędu za zamierzony: tak było z przekierowaniami w sitemapie do
2026-09-26 (patrz `references/mapa-seo-bojo.md`). Dlatego werdykt zawsze opiera się
na przykładowych adresach, nie na samej nazwie problemu.

## 1. Rozpoznaj, co przyszło

| Wejście | Pierwszy ruch |
|---|---|
| Eksport ZIP/CSV (dowolny raport) | `node .claude/skills/gsc/scripts/gsc-eksport.mjs <plik>`: rozpozna raport i wypisze werdykty |
| Lista adresów (przykłady z raportu, eksport „Tabela”) | `gsc-eksport.mjs <plik> --adresy`: typy stron, warianty adresu obiektu, hosty |
| Mail od GSC albo zrzut ekranu | Odczytaj raport i problem (`references/statusy-i-komunikaty.md`), poproś o eksport ZIP tego raportu, jeśli liczby mają znaczenie |
| Komunikat weryfikacji poprawki | `references/weryfikacja-poprawek.md`: najpierw sprawdź, czy poprawka jest już na produkcji |
| „Zrób przegląd”, „co w GSC” | Sekcja 4 (przegląd okresowy) |

Potem przekaż pracę dalej:

- **Ulepszenia** (Wydarzenia, Menu nawigacyjne, „Brakujące pole…”, dane strukturalne) → skill `gsc-dane-strukturalne`
- **Indeksowanie → Strony**, Mapy witryn, Sprawdzanie adresu URL, statystyki skanowania → skill `gsc-indeksowanie`
- **Skuteczność** (kliknięcia, CTR, pozycje, zapytania), raport AI, Discover → skill `gsc-skutecznosc`
- **Podstawowe wskaźniki internetowe** → ten skill, `references/dane-i-dostep.md` („Core Web Vitals”), plus docs/seo-geo-strategia.md 7a.1 (tam są już podjęte decyzje, m.in. pułapka z polyfillami)

## 2. Narzędzia

Wszystkie skrypty są bez zależności (Node ≥ 18), uruchamiane z katalogu głównego repo.

| Skrypt | Do czego |
|---|---|
| `scripts/gsc-eksport.mjs` | Dowolny eksport GSC → typ raportu, tabele, werdykty dla Bojo, `--json` do dalszej analizy |
| `scripts/gsc-api.mjs` | Dane wprost z API (bez ręcznego eksportu i bez limitu 1000 wierszy): `skutecznosc`, `inspekcja`, `mapy`, `witryny`, `psi`. Wymaga klucza w środowisku (`references/dane-i-dostep.md`) |
| `scripts/lib/mapa-bojo.mjs` | Adres → typ strony, plik, który ją renderuje, oczekiwany status indeksacji. Reguły robots.txt czyta z `frontend/src/app/robots.ts` |
| `scripts/lib/przyczyny.mjs` | Powody z raportu „Strony” (PL i EN) z werdyktem dla Bojo i sposobem sprawdzenia |
| `../gsc-dane-strukturalne/scripts/sprawdz-jsonld.mjs` | JSON-LD strony wobec wymagań Google |
| `../gsc-skutecznosc/scripts/gsc-okazje.mjs` | Okazje w Skuteczności: luka CTR, blisko TOP 3, zero kliknięć, marka, trend |

Testy skryptów: `node --test $(find .claude/skills -name '*.test.mjs')` (uruchamia je też CI).

## 3. Zasady, które już raz kosztowały

1. **„Sprawdź poprawkę” dopiero, gdy poprawka jest na produkcji.** 2026-09-24 cztery
   z pięciu weryfikacji odpadły, bo kliknięto je, zanim Vercel skończył deploy; piąta,
   kliknięta chwilę później, ruszyła. Google sprawdza na starcie kilka stron na żywo
   i jeden stary HTML kończy weryfikację. Szczegóły: `references/weryfikacja-poprawek.md`.
2. **Eksport z interfejsu ma najwyżej 1000 wierszy na tabelę.** Przy długim ogonie
   Bojo wnioski o „wszystkich stronach” wymagają API.
3. **Ostatnie 2–3 dni w GSC są niepełne.** Nie porównuj ich z pełnymi dniami.
4. **„Wykryte strony” w Mapach witryn liczy wpisy, nie różne adresy.** 32 tys. wpisów
   dawało do 2026-09-26 ~10,6 tys. różnych adresów (PR #435).
5. **FAQ i HowTo nie dadzą wyników rozszerzonych.** Google wycofał je (HowTo 2023, FAQ
   2026). Pusta tabela „Wygląd w wynikach wyszukiwania” to nie jest sygnał „jeszcze
   za wcześnie”. Stan Google na 2026: `references/nowosci-google.md`.
6. **Z kontenera agenta nie widać bojo.pl** (sieć). Żywą stronę sprawdza właściciel
   (Test wyników z elementami rozszerzonymi, Sprawdzanie adresu URL) albo agent przez
   API GSC, lokalny build lub HTML zapisany z przeglądarki (`references/dane-i-dostep.md`).
7. **Każdy odczyt i każda zmiana idą do `docs/gsc-dziennik.md`**, z datą i terminem
   ponownego odczytu. Bez linii bazowej za miesiąc nie odróżnisz efektu od szumu. Przy
   deployu zmieniającym SEO podaj właścicielowi tekst adnotacji do wykresu w GSC
   (prawy klik na wykres → „Dodaj adnotację”, do 120 znaków).

## 4. Przegląd okresowy (co 2 tygodnie albo na prośbę)

1. Przeczytaj `docs/gsc-dziennik.md`: co czeka na odczyt, jakie są linie bazowe.
2. Zbierz dane: przez API (`gsc-api.mjs skutecznosc --wyjscie …`, `mapy`, `inspekcja`
   dla 10–20 adresów z każdego typu strony), a bez klucza poproś o eksporty: Skuteczność
   (3 miesiące, z porównaniem), Strony, Ulepszenia z problemami, Mapy witryn.
3. Przepuść każdy eksport przez `gsc-eksport.mjs`, Skuteczność także przez `gsc-okazje.mjs`.
4. Zestaw z dziennikiem: co się zmieniło od ostatniego odczytu i czy to efekt którejś
   zmiany (daty deployów, `git log` na plikach z mapy SEO).
5. Zapisz odczyt w dzienniku (wzór: istniejące wpisy; szablon w
   `../gsc-skutecznosc/references/metodyka.md`, sekcja 6) i zaktualizuj tabelę
   „Czeka na odczyt”. Nowe problemy → PR zgodnie z konwencjami repo (zielone CI,
   merge przez agenta).
6. Podsumuj właścicielowi: 3–5 zdań, co się zmieniło, co jest do zrobienia, co kliknąć.

## 5. Jak odpowiadać właścicielowi

Po polsku, krótko, zaczynając od werdyktu: **co jest błędem, co jest zamierzone i co
kliknąć**. Liczby podawaj z datą i źródłem (eksport z dnia X, API, zrzut). Gdy czegoś
nie da się sprawdzić z kontenera, powiedz wprost, kto i jak to sprawdzi. Nie proś
o wklejanie kluczy ani haseł do czatu. Klucze trafiają do ustawień środowiska.

## Materiały

- `references/mapa-seo-bojo.md`: typy stron, co je renderuje, zamierzona indeksacja, historia napraw, otwarte tematy
- `references/statusy-i-komunikaty.md`: maile, stany weryfikacji, komunikaty raportów (PL ↔ EN)
- `references/weryfikacja-poprawek.md`: cykl „Sprawdź poprawkę” i czego się spodziewać
- `references/dane-i-dostep.md`: eksporty, API (konfiguracja), Supabase, Vercel, ograniczenia sieci
- `references/nowosci-google.md`: co Google zmienił w 2025–2026 i co z tego wynika dla Bojo
