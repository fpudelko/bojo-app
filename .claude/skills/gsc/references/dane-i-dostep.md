# Dane i dostęp: skąd brać liczby o bojo.pl

## Spis

1. Eksporty z interfejsu GSC
2. Dostęp przez API (konfiguracja jednorazowa)
3. Core Web Vitals (PageSpeed / CrUX)
4. Baza produkcyjna (Supabase) i analityka wejść
5. Vercel (deploy, logi)
6. Czego nie widać z kontenera agenta i jak to obejść

## 1. Eksporty z interfejsu GSC

Przycisk **Eksportuj → Pobierz CSV** w prawym górnym rogu raportu. Zawsze wybieraj CSV
(ZIP z plikami CSV); skrypty czytają też luźne pliki i katalog.

| Raport | Pliki w ZIP (PL; w UI angielskim nazwy angielskie) |
|---|---|
| Skuteczność | `Zapytania.csv`, `Strony.csv`, `Kraje.csv`, `Urządzenia.csv`, `Wygląd w wynikach wyszukiwania.csv`, `Daty.csv`, `Filtry.csv` |
| Strony (indeksowanie) | `Wykres.csv` (dziennie: nie zindeksowano / zindeksowano / wyświetlenia), `Problemy krytyczne.csv`, `Problemy niekrytyczne.csv` (przyczyna, źródło, weryfikacja, strony) |
| Ulepszenia (np. Wydarzenia) | `Wykres.csv` (nieprawidłowe / prawidłowe), `Problemy krytyczne.csv`, `Problemy niekrytyczne.csv` (problem, weryfikacja, elementy) |
| Szczegóły jednej przyczyny/problemu | tabela przykładowych adresów (URL + data ostatniego skanowania) |

Ograniczenia, o których trzeba pamiętać przy wnioskach:

- **Maks. 1000 wierszy na tabelę.** `Daty.csv` jest pełny, `Zapytania`/`Strony` ucięte.
- **Zapytania anonimizowane.** Rzadkie zapytania Google pomija w tabeli Zapytania
  (zostają w sumach). W Bojo to większość kliknięć (7a.2: 5 z 116).
- **Opóźnienie ~2–3 dni.** Ostatnie dni są niepełne.
- **Pozycja jest średnią ważoną wyświetleniami**; od czerwca 2025 ruch z AI Mode wlicza
  się do „Wyników wyszukiwania”.
- **Tryb porównania** („Porównaj” w filtrze dat) daje w CSV kolumny obu okresów;
  `gsc-eksport.mjs` mapuje je na `clicks` i `clicks_prev`.

## 2. Dostęp przez API (konfiguracja jednorazowa)

API usuwa limit 1000 wierszy (25 tys. na zapytanie, 50 tys. dziennie na typ wyszukiwania),
daje wymiar strona × zapytanie (kanibalizacja) i inspekcję pojedynczych adresów
(indeks, canonical wybrany przez Google, wykryte wyniki rozszerzone). Serwery
`googleapis.com` są osiągalne z kontenera agenta (sprawdzone 2026-09-26).

Kroki dla właściciela (Google Cloud + GSC, ~10 minut):

1. console.cloud.google.com → nowy projekt (np. `bojo-gsc`) → „APIs & Services” →
   włącz **Google Search Console API** (i **PageSpeed Insights API**, jeśli ma działać `psi`).
2. „IAM & Admin → Service accounts” → utwórz konto serwisowe (bez ról w projekcie) →
   „Keys → Add key → JSON”. Plik trafia na dysk; nie do repo, nie do czatu.
3. Search Console → usługa `https://www.bojo.pl/` → Ustawienia → Użytkownicy
   i uprawnienia → Dodaj użytkownika: adres e-mail konta serwisowego (`…@…iam.gserviceaccount.com`),
   uprawnienie **Ograniczone** (odczyt wystarcza).
4. Claude Code w chmurze: menu środowiska w pasku tytułu sesji → Edytuj → zmienna
   środowiskowa **`GSC_KLUCZ_JSON`** z całą zawartością pliku JSON (opcjonalnie
   `PAGESPEED_KLUCZ` z kluczem API). Nowa sesja ją widzi. Lokalnie: `GSC_KLUCZ_PLIK=/ścieżka/do/klucza.json`.
5. Sprawdzenie: `node .claude/skills/gsc/scripts/gsc-api.mjs witryny` ma wypisać
   `https://www.bojo.pl/`.

Zakres tokena to `webmasters.readonly`: skrypt nie może niczego zmienić w GSC.

Typowe użycia:

```bash
S=.claude/skills/gsc/scripts
node $S/gsc-api.mjs skutecznosc --wyjscie /tmp/gsc.json          # 28 pełnych dni
node $S/gsc-api.mjs skutecznosc --od 2026-09-01 --do 2026-09-28 --wyjscie /tmp/gsc.json
node .claude/skills/gsc-skutecznosc/scripts/gsc-okazje.mjs --dane /tmp/gsc.json
node $S/gsc-api.mjs inspekcja https://www.bojo.pl/wydarzenia/<id> https://www.bojo.pl/boisko/<slug>
node $S/gsc-api.mjs mapy
```

Limity inspekcji: 2000 adresów dziennie, 600 na minutę na usługę. Inspekcja pokazuje
wersję ZAINDEKSOWANĄ, nie żywą (testu na żywo API nie ma).

**Raport AI (AI Overviews, AI Mode) nie ma API** (stan 2026): tylko eksport CSV z
interfejsu, same wyświetlenia. `gsc-eksport.mjs` rozpoznaje go jako typ `ai`.

## 3. Core Web Vitals

- Progi (75. percentyl realnych użytkowników): **LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1**.
- Raport GSC opiera się na danych CrUX, a przy małym ruchu pokazuje „Za mało danych”.
  Wtedy dane bierze się z poziomu całej domeny albo z laboratorium.
- `gsc-api.mjs psi <url> [--strategia desktop]` zwraca dane terenowe strony
  i domeny, wynik laboratoryjny, element LCP i największe okazje. Bez `PAGESPEED_KLUCZ`
  publiczny limit bywa wyczerpany (429).
- Linia bazowa i podjęte decyzje (czego NIE robić, np. podnosić `browserslist` dla
  polyfilli): docs/seo-geo-strategia.md, 7a.1.

## 4. Baza produkcyjna (Supabase) i analityka wejść

Konektor Supabase (`execute_sql`, projekt `bojo-app`) czyta produkcję. Każde
zapytanie zatwierdza człowiek. **Tylko SELECT**: to jest produkcja.

Przydatne zapytania:

```sql
-- Rozkład tierów (ile obiektów w ogóle może być w indeksie)
select seo_tier, count(*) from fields where map_visibility = 'public' group by 1 order by 1;

-- Kandydaci na „Duplikat bez canonical”: ta sama nazwa i adres
select name, address, count(*) from fields where map_visibility = 'public'
group by 1, 2 having count(*) > 1 order by 3 desc limit 20;

-- Obiekt z adresu kanonicznego: końcówka to pierwsze 12 znaków hex id
select id, name, seo_tier from fields where replace(id::text, '-', '') like '741e4f384561%';

-- Ruch z wyszukiwarki na stronach obiektów i czy ktoś potem organizuje mecz
-- (zdarzenia od 2026-09-16, docs/funkcje.md „Ruch z katalogu”)
select metadata->>'zrodlo' as zrodlo, event_type, count(*)
from analytics_events
where event_type in ('boisko_otwarte', 'boisko_zorganizuj') and created_at > now() - interval '28 days'
group by 1, 2 order by 1, 2;
```

To ostatnie łączy GSC z produktem: kliknięcia z Google (GSC) → `boisko_otwarte`
z `zrodlo = 'wyszukiwarka'` → `boisko_zorganizuj`. Sam CTR nie mówi, czy ruch coś daje.
Tabela z migracji `047` (`event_type`, `metadata`, `path`, `created_at`); `zrodlo` liczy `zrodloWejscia()` w `frontend/src/lib/analytics.ts`.

## 5. Vercel (deploy, logi)

Konektor Vercel (jeśli autoryzowany): lista wdrożeń (czy commit z mastera jest już
READY na produkcji, zanim ktoś kliknie „Sprawdź poprawkę”), logi runtime (5xx na
`/boisko/*` przy „Wykryto, obecnie bez indeksu” albo „Błąd serwera”), Web Analytics.
Wymaga zalogowania w ustawieniach konektorów claude.ai; bez tego zostaje panel Vercela
u właściciela.

## 6. Czego nie widać z kontenera agenta i jak to obejść

| Zablokowane | Obejście |
|---|---|
| `bojo.pl`, `www.bojo.pl` (żywe strony, sitemapy, robots.txt) | właściciel dopisuje te domeny w ustawieniach sieci środowiska; albo HTML zapisany z przeglądarki → `sprawdz-jsonld.mjs --plik`; albo lokalny build (`npm run build && npm start`) i `--url http://localhost:3000/...`; albo `gsc-api.mjs inspekcja` |
| `developers.google.com` przez pobieranie stron | WebSearch działa (streszczenia wyników); stan wiedzy w `references/nowosci-google.md` |
| `search.google.com` (UI GSC, Test wyników rozszerzonych) | tylko człowiek; agent prosi o eksport albo zrzut |

Właściciel zmienia listę dozwolonych domen w ustawieniach środowiska (menu środowiska
w pasku tytułu sesji → Edytuj → dostęp do sieci).
