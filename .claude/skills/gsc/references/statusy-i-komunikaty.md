# Statusy i komunikaty Search Console (PL ↔ EN)

Werdykty dla powodów z raportu „Strony” są w kodzie: `scripts/lib/przyczyny.mjs`
(tam dopisuj nowe; test `test/eksport.test.mjs` pilnuje, że każda znana nazwa ma
werdykt). Tu jest reszta: maile, weryfikacje, komunikaty raportów rozszerzonych.

## Maile od Google

| Temat maila (PL) | O co chodzi | Dokąd |
|---|---|---|
| „Nowe problemy (<raport>) wykryte w witrynie …” | nowy typ problemu w raporcie wyników rozszerzonych albo indeksowania | eksport ZIP tego raportu → `gsc-eksport.mjs` |
| „Nowy powód uniemożliwiający zindeksowanie stron w witrynie …” | nowa przyczyna w raporcie Strony | skill `gsc-indeksowanie` |
| „Wzrost liczby problemów …” | istniejący problem objął więcej stron | eksport + porównanie z dziennikiem |
| „Weryfikacja poprawki …” (rozpoczęta / zakończona / nie powiodła się) | cykl „Sprawdź poprawkę” | `references/weryfikacja-poprawek.md` |
| „Problemy z podstawowymi wskaźnikami internetowymi …” | adresy przeszły do „Wymaga poprawy”/„Słabe” | eksport CWV + `gsc-api.mjs psi` |
| Ręczne działania / Problemy z bezpieczeństwem | kara albo zhakowanie | **pilne**: pełny opis z GSC do właściciela, nic nie zmieniać na ślepo |

„Najważniejsze problemy niekrytyczne” w mailu = ostrzeżenia: strona jest prawidłowa
(nadal może dostać wynik rozszerzony), brakuje pól zalecanych.

## Stany weryfikacji

| PL | EN | Znaczenie |
|---|---|---|
| Nie rozpoczęto | Not started | nikt nie kliknął „Sprawdź poprawkę” |
| Rozpoczęto | Started | prekontrola przeszła, Google sprawdza resztę |
| Nie można kontynuować weryfikacji | (validation could not continue) | prekontrola trafiła na stronę z problemem |
| Niepowodzenie | Failed | po pełnym sprawdzeniu część stron nadal ma problem |
| Naprawiono / Poprawka zweryfikowana | Passed | wszystkie przykłady czyste |

## Komunikaty w raportach wyników rozszerzonych

| PL | EN | Waga | Co zwykle znaczy |
|---|---|---|---|
| Brakujące pole „X” | Missing field "X" | krytyczna, jeśli X wymagane; inaczej niekrytyczna | budowniczy nie emituje pola (sprawdź warunki `...(x ? {…} : {})`) |
| Brakujące pole „X” (w „Y”) | Missing field "X" (in "Y") | jw. | pole zagnieżdżone, np. `offers.availability` |
| Nieprawidłowa wartość w polu „X” | Invalid value in field "X" | krytyczna przy polu wymaganym | zły format daty, wyliczenia, ceny |
| Nieprawidłowy typ obiektu w polu „X” | Invalid object type for field "X" | krytyczna | np. `location` jako tekst albo VirtualLocation bez `url` |
| Należy podać „name” lub „item.name” | Either "name" or "item.name" should be specified | krytyczna | okruszek bez nazwy |
| Błąd analizy / nieprawidłowy JSON | Parsing error | krytyczna | JSON-LD nie parsuje się (np. niezamknięty cudzysłów) |

## Nazwy raportów (menu GSC)

| PL | EN | Eksport ZIP (część nazwy pliku) |
|---|---|---|
| Skuteczność → Wyniki wyszukiwania | Performance → Search results | `Performance-on-Search` |
| Indeksowanie → Strony | Indexing → Pages | `Coverage` / `Page-indexing` |
| Indeksowanie → Mapy witryn | Sitemaps | (tabela, bez ZIP) |
| Ulepszenia → Wydarzenia | Enhancements → Events | `Events` |
| Ulepszenia → Menu nawigacyjne | Breadcrumbs | `Breadcrumbs` |
| Podstawowe wskaźniki internetowe | Core Web Vitals | `Core-Web-Vitals…` |
| Ustawienia → Statystyki indeksowania | Crawl stats | (tabela) |
| Sprawdzanie adresu URL | URL Inspection | (bez eksportu; API: `gsc-api.mjs inspekcja`) |
