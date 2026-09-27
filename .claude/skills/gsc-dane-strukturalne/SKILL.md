---
name: gsc-dane-strukturalne
description: Naprawa i kontrola danych strukturalnych (JSON-LD, schema.org) bojo.pl pod Google Search Console. Używaj przy raportach „Ulepszenia” (Wydarzenia, Menu nawigacyjne, Logo), mailach „Nowe problemy (… uporządkowane dane)”, komunikatach „Brakujące pole”, „Nieprawidłowa wartość”, „Nieprawidłowy typ obiektu”, przy zmianach w frontend/src/lib/structuredData.ts albo w JSON-LD strony obiektu, oraz gdy ktoś pyta, czy Bojo dostanie wynik rozszerzony (wydarzenia, okruszki, FAQ, logo). Odtwarza JSON-LD z prawdziwego buildera na danych z bazy, sprawdza go lokalnym walidatorem wymagań Google, prowadzi poprawkę z testem i mówi, kiedy kliknąć „Sprawdź poprawkę”.
---

# Dane strukturalne Bojo pod Google

Cel: raport „Ulepszenia” w GSC bez problemów krytycznych, z możliwie małą liczbą
niekrytycznych. Nigdy za cenę nieprawdy w danych. Wzorcowy przebieg:
2026-09-23 mail o 5 brakujących polach w „Wydarzeniach” → PR #424 → weryfikacja
ruszyła 2026-09-24. Ten skill jest tamtym przebiegiem zapisanym jako procedura.

## Mapa: raport → kod

| Raport GSC | Typ | Kod | Test |
|---|---|---|---|
| Wydarzenia | `SportsEvent` | `eventJsonLd()` w `frontend/src/lib/structuredData.ts`, dane z `getEventMeta()` + `policzZajeteMiejsca()` w `frontend/src/app/wydarzenia/[id]/eventMeta.ts` | `frontend/src/__tests__/structuredData.test.ts` |
| Menu nawigacyjne | `BreadcrumbList` | `breadcrumbsJsonLd()`; wołają go `boisko/[id]/page.tsx`, `[sport]/[miasto]/page.tsx`, `components/tresc/StronaTresci.tsx` | jw. |
| (brak raportu) | `Organization`, `WebSite`, `SoftwareApplication` | `siteJsonLd()` (layout, każda strona) | jw. |
| (brak raportu) | `SportsActivityLocation` | inline w `frontend/src/app/boisko/[id]/page.tsx` | brak: sprawdzaj na wyrenderowanej stronie |
| (brak raportu) | `ItemList` | `venueListJsonLd()` na hubach `/boiska/…` | jw. |
| (wycofane przez Google) | `FAQPage`, `HowTo` | `faqJsonLd()`, `howToJsonLd()` | jw. |

Zasady z kodu, których nie łamiemy:

- **Mecz niepubliczny nie ma JSON-LD** (`eventJsonLd()` zwraca `null`), a jego
  metadane są bezcechowe (`metadataDlaMeczu()`). Kod dołączenia jest jedyną ochroną
  prywatnego meczu. Żadna „poprawka pod Google” tego nie zmienia.
- **Schema tylko z tym, co widać na stronie** (komentarze przy `faqJsonLd()`,
  `venueAmenityFeatures()`): dane bez pokrycia w treści to sygnał spamu.
- **Bez zmyślania pól.** Brak godziny końca meczu to nie powód, żeby wpisać „+90 minut”.
  `performer` meczu to `PerformingGroup` „Skład meczu: …”, **bez nazwisk graczy**
  (świadoma decyzja z PR #424).

## Procedura dla problemu z raportu

1. **Rozpoznaj problem.** Eksport ZIP raportu → `node .claude/skills/gsc/scripts/gsc-eksport.mjs <zip>`:
   ścieżka pola, waga (wymagane/zalecane) i budowniczy. Mail albo zrzut → nazwę pola
   odczytaj z tekstu („Brakujące pole „X” (w „Y”)” = `Y.X`).
2. **Weź przykładowe adresy** (raport → problem → „Przykłady”). Dla meczu dane z bazy
   produkcyjnej (tylko SELECT, konektor Supabase):
   `select id, visibility, status, event_date, event_time, end_time, cost_grosz, max_players, created_at, zapisy_zamkniete, field_name, custom_address, lat, lng, description from events where id in (…)`.
3. **Odtwórz JSON-LD z prawdziwego buildera** na tych danych i sprawdź:
   ```bash
   D=.claude/skills/gsc-dane-strukturalne/scripts
   node $D/jsonld-z-buildera.mjs --funkcja eventJsonLd \
     --argumenty '["<id>", {"sport":"piłka nożna","date":"2027-01-07","time":"18:00:00","visibility":"public","max_players":14,"cost_grosz":0,"created_at":"2026-09-04T08:18:47+00:00","zajete":3}]' \
     | node $D/sprawdz-jsonld.mjs
   ```
   Klucze argumentu to pola typu `EventForJsonLd` (`date`, `time`, `end_time`,
   `cost_grosz`, `zajete`…), nie kolumny z bazy (`event_date`, `event_time`): tłumaczy je
   `getEventMeta()`. Jeśli walidator NIE pokazuje problemu,
   który zgłosił GSC: produkcja serwuje inny HTML niż obecny kod (deploy, cache ISR),
   albo dane przykładu różnią się od założonych. Wyjaśnij to, zanim cokolwiek zmienisz.
4. **Popraw budowniczego** i dopisz test w `structuredData.test.ts` (po jednym na pole,
   wzorem testów z PR #424). Zmiana danych (np. nowe kolumny w `getEventMeta()`) →
   sprawdź, że kolumna jest na produkcji (`information_schema.columns`), bo inaczej
   `select` padnie i strona straci JSON-LD **razem z metadanymi**.
5. **Weryfikacja repo:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`
   (z atrapami kluczy), `npm run check:docs`; wpis w `docs/seo-geo-strategia.md` (tabela 5d)
   i w `docs/gsc-dziennik.md`.
6. **Po merge'u i deployu** (nie wcześniej!) „Sprawdź poprawkę” przy każdym problemie:
   `../gsc/references/weryfikacja-poprawek.md`.

## Sprawdzenie strony bez zgłoszenia z GSC

- Lokalny build na atrapach kluczy renderuje strony treści (JSON-LD layoutu, FAQ,
  okruszki), ale nie strony z danymi:
  `cd frontend && npm run build && npm start`, potem `node $D/sprawdz-jsonld.mjs --url http://localhost:3000/faq`.
- Żywa strona: z własnej maszyny `--url https://www.bojo.pl/…`; z kontenera agenta
  tylko po dopuszczeniu domeny w ustawieniach sieci, albo z HTML zapisanego
  w przeglądarce (`--plik`).
- Wersja zaindeksowana przez Google (wykryte wyniki rozszerzone, problemy):
  `node .claude/skills/gsc/scripts/gsc-api.mjs inspekcja <url>` (wymaga klucza API).

## Co walidator już dziś mówi o Bojo (2026-09-26)

Nie są to błędy, tylko kandydaci na następne PR-y (uzasadnienia: `../gsc/references/mapa-seo-bojo.md`, sekcja 6):
`endDate` meczu bez godziny końca, data bez strefy czasowej, `Organization` bez `logo`,
`WebSite` bez `alternateName`.

## Materiały

- `references/wymagania-google.md`: wymagane i zalecane pola każdego typu, formaty, kwalifikacja, źródła
- `scripts/reguly-google.mjs`: te same wymagania jako dane (walidator i `gsc-eksport.mjs` czytają stąd; zmieniasz jedno, zmień drugie)
- `scripts/sprawdz-jsonld.mjs`, `scripts/jsonld-z-buildera.mjs`: narzędzia z procedury wyżej
