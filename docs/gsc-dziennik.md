# Dziennik Search Console bojo.pl

Pamięć między sesjami: co zmierzono, co zmieniono pod Google i kiedy sprawdzić efekt.
Bez linii bazowej sprzed zmiany za miesiąc nie da się odróżnić efektu od szumu. Wpisy
dopisują skille `gsc*` (`.claude/skills/gsc/SKILL.md`) i ludzie.

Pomiary sprzed 2026-09-23 (pierwsze zgłoszenie sitemapy, skok indeksu 2026-09-05,
pierwszy tydzień kliknięć) są w [seo-geo-strategia.md](./seo-geo-strategia.md#7a2-search-console--pomiar-bazowy-z-2026-08-29)
i tam zostają.

## Czeka na odczyt

| Termin | Co sprawdzić | Gdzie | Skąd się wzięło |
|---|---|---|---|
| 2026-09-29 | Strony: czy 17 473 zaindeksowanych rośnie dalej; udział R1 | eksport Indeksowanie → Strony | termin z 7a.2 |
| 2026-10-08 | Wydarzenia: wynik 5 weryfikacji (rozpoczęte 2026-09-24) | Ulepszenia → Wydarzenia | 2026-09-24 |
| 2026-10-10 | Mapy witryn i Strony po poprawce adresów obiektów: „Strona zawiera przekierowanie”, zaindeksowane, Statystyki indeksowania (udział 307, wykrywanie) | eksport Strony + Statystyki indeksowania | 2026-09-26 |
| 2026-10-24 | jw., drugi odczyt; Skuteczność: kliknięcia i wyświetlenia stron obiektów (28 dni przed i po) | eksport Skuteczność (z porównaniem) albo API | 2026-09-26 |

## Wpisy

### 2026-09-26 — Sitemapa i huby katalogu na adresach kanonicznych obiektów

Źródło: analiza kodu i produkcyjnej bazy przy budowie skilli GSC (nie mail z GSC).

Sitemapa boisk i huby `/boiska/…` budowały adres obiektu z samej nazwy (klucz
historyczny, 307 na adres kanoniczny). Stan produkcji: 32 096 wpisów w sitemapach boisk,
10 608 różnych adresów, 21 488 obiektów Tier 1+2 (67%) bez własnego adresu w sitemapie,
„boisko-pilkarskie” 10 048 razy. Kliknięcie obiektu na liście miasta mogło otworzyć boisko
z innej miejscowości.

Zmiana: PR #435, merge 2026-09-26 (`slugBoiska(name, id)` w sitemapie, linkach
i `ItemList` hubów; strażnik `linkiObiektuKanoniczne.test.ts`).

Adnotacja do wykresu GSC (do dodania przez właściciela):
„Sitemapa i huby: adresy kanoniczne obiektów (PR #435)”.

Oczekiwane: zaindeksowane rosną w miarę odkrywania ~21 tys. obiektów; „przekierowanie”
chwilowo w górę, potem w dół. Ponowny odczyt: 2026-10-10 i 2026-10-24.

### 2026-09-24 — Wydarzenia: 5 pól zalecanych, weryfikacja rozpoczęta

Źródło: mail GSC z 2026-09-23 i eksport „Events” z 2026-09-24 (2 mecze, 0 nieprawidłowych,
5 problemów niekrytycznych: `description`, `image`, `performer`, `offers.validFrom`,
`offers.availability`).

Zmiana: PR #424 (merge 2026-09-24), `eventJsonLd()` emituje wszystkie pięć pól.

Weryfikacja: pierwsze kliknięcia „Sprawdź poprawkę” (4 z 5) odpadły na prekontroli,
bo trafiły w HTML sprzed deployu. Po ponownym kliknięciu wszystkie 5 „Rozpoczęto”
2026-09-24. Wynik do odczytu: ~2026-10-08.

Walidator (`sprawdz-jsonld.mjs`) na kodzie po poprawce: następni kandydaci na
„Brakujące pole” to `endDate` (mecze bez godziny końca). Ponadto data bez strefy
czasowej (informacja, nie błąd).
