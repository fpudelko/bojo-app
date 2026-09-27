---
name: gsc-skutecznosc
description: Analiza i optymalizacja raportu Skuteczność w Google Search Console dla bojo.pl, czyli kliknięcia, wyświetlenia, CTR, pozycje, zapytania, strony, urządzenia, marka „bojo”, widoczność w AI Overviews i AI Mode. Używaj, gdy użytkownik wrzuca eksport Skuteczności (Zapytania.csv, Strony.csv, Daty.csv…) albo pyta, czemu ruch spadł lub wzrósł, co poprawić w tytułach i opisach wyników, które strony tracą kliknięcia, jak zmierzyć efekt zmiany snippetów, czy Bojo jest cytowane przez AI, jak zaplanować test A/B na stronach obiektów. Liczy okazje statystycznie (luka CTR względem krzywej samego Bojo, blisko TOP 3, zero kliknięć), wskazuje plik, który pisze dany snippet, i zapisuje linię bazową do dziennika przed zmianą.
---

# Skuteczność bojo.pl w wyszukiwarce

Ruch organiczny Bojo to przede wszystkim **długi ogon nazw obiektów**: 980 z 1000
stron z wyświetleniami to `/boisko/*`, a większość kliknięć przychodzi z zapytań zbyt
rzadkich, żeby Google je pokazał. Zmiana jednego szablonu (tytuł, opis strony obiektu)
działa więc na dziesiątki tysięcy stron naraz. Stąd dwie zasady tego skilla:
**decyzje na poziomie szablonu, nie pojedynczej strony**, i **pomiar przed zmianą**.

## Procedura

1. **Dane.** Najlepiej API (bez limitu 1000 wierszy, z wymiarem strona × zapytanie):
   `node .claude/skills/gsc/scripts/gsc-api.mjs skutecznosc --wyjscie /tmp/gsc.json`.
   Bez klucza: eksport z UI (Skuteczność → zakres „3 miesiące” albo „28 dni” + „Porównaj”
   z poprzednim okresem → Eksportuj → CSV).
2. **Okazje:**
   `node .claude/skills/gsc-skutecznosc/scripts/gsc-okazje.mjs <zip>` (albo `--dane /tmp/gsc.json`).
   Sekcje: stan i pokrycie, typy stron, krzywa CTR Bojo, luka CTR, blisko TOP 3,
   zero kliknięć w TOP 10, marka, urządzenia, trend, porównanie okresów,
   kanibalizacja (tylko z API), linia bazowa.
3. **Czytanie wyników:**
   - **Luka CTR na wielu stronach jednego typu** → problem szablonu snippetu (tabela
     niżej: kto go pisze). Pojedyncza strona → zwykle intencja zapytania (np. ktoś szuka
     innego obiektu o tej samej nazwie) albo nazwa obiektu w katalogu.
   - **Blisko TOP 3** → treść i linki wewnętrzne (huby → obiekt, „pobliskie”), nie snippet.
   - **Zero kliknięć przy dobrej pozycji na zapytaniach z „bojo”** → kolizja nazwy
     (docs/seo-geo-strategia.md, 2c), nie problem strony. Porównaj z natywnym filtrem
     „Zapytania markowe” w GSC.
   - **Skok w trendzie** → zestaw z datami deployów (`git log --since`) i dziennikiem.
4. **Zmiana:** jedna zmiana szablonu na raz, z testem (copy żyje w
   `frontend/src/content/*.ts`, np. `metaOpisObiektu()`), zgodnie z zasadami snippetów
   niżej. Przed merge'em wpisz linię bazową z `gsc-okazje.mjs` do `docs/gsc-dziennik.md`,
   po deployu podaj właścicielowi tekst adnotacji do wykresu GSC.
5. **Pomiar efektu:** po 28 dniach te same sekcje, ten sam zakres długości, te same dni
   tygodnia. Porównuj CTR **przy podobnej pozycji** (krzywa CTR przed i po), bo wzrost
   CTR przy wzroście pozycji niczego nie dowodzi o snippecie. Dla stron obiektów
   najmocniejszy dowód daje eksperyment (niżej).

## Kto pisze snippet

| Typ strony | Tytuł | Opis |
|---|---|---|
| Obiekt | `generateMetadata()` w `frontend/src/app/boisko/[id]/page.tsx` („Nazwa: sporty, miejscowość”) | `metaOpisObiektu()` w `frontend/src/content/opisObiektu.ts` (fakty: nawierzchnia, kryty, oświetlenie, adres; ≤ 160 znaków) |
| Mecz | `metadataDlaMeczu()` w `frontend/src/app/wydarzenia/[id]/eventMeta.ts` | jw. |
| Huby, sport+miasto, treść | `page.tsx` danej trasy, copy w `frontend/src/content/` | jw. |
| Wszystkie | sufiks „ \| Bojo” dokłada `title.template` w `frontend/src/app/layout.tsx`: nie dopisuj go ręcznie (kiedyś było „\| Bojo \| Bojo”, strategia P3) | |

## Zasady snippetów w Bojo

- **Prawda przed klikalnością.** Nie obiecuj meczów, których na obiekcie nie ma, ani
  funkcji za wyłączoną flagą (rezerwacje). Obietnica bez pokrycia daje kliknięcie
  i natychmiastowy powrót, a to gorszy sygnał niż brak kliknięcia.
- **Fakty, które rozstrzygają wybór boiska:** nawierzchnia, kryty/otwarty, oświetlenie,
  ulica (przy wielu obiektach o tej samej nazwie w mieście), potwierdzenia graczy (F1).
  Hipoteza do sprawdzenia z docs/analiza-gtm-2026-09.md: „czy czynne, ile kosztuje,
  czy oświetlone”. Najpierw pomiar, potem wdrożenie.
- **Zakazy z repo:** bez długiego myślnika „—” (check:docs, sekcja 11), bez fraz
  z `frontend/src/content/zakazaneFrazy.ts`, bez ręcznego „| Bojo”, tylko po polsku.
- **Długość:** tytuł ~50–60 znaków widocznych; opis ≤ 160 (`LIMIT_OPISU`), a najważniejszy
  fakt na początku, bo reszta może zniknąć za wielokropkiem.
- Google i tak często przepisuje tytuł i opis. Mierz, co Google POKAZAŁ (wyszukaj
  obiekt), nie tylko to, co wysłaliśmy.

## Eksperyment na stronach obiektów (test A/B szablonu)

Tysiące jednorodnych stron to rzadki luksus: można zmienić snippet dla połowy
i porównać z drugą połową w tym samym czasie, co usuwa sezonowość i aktualizacje Google.

- **Podział:** parzystość ostatniej cyfry szesnastkowej końcówki id w adresie
  kanonicznym (`/boisko/<nazwa>-<12 hex>`). Liczy się z samego adresu, więc kod strony
  i analiza nie potrzebują wspólnej tabeli. Grupa A (parzyste) zostaje bez zmian,
  grupa B dostaje nowy szablon.
- **Analiza:** `gsc-okazje.mjs --dane <api.json> --eksperyment parzystosc` daje CTR grup,
  test dwóch proporcji i wymaganą liczbę wyświetleń. Pozycje grup muszą być podobne.
- **Moc:** przy CTR ~1,3% wykrycie zmiany o 20% wymaga ~34 tys. wyświetleń na grupę
  (tydzień 8–14.09.2026 miał 8,7 tys. wyświetleń łącznie, czyli kilka tygodni). Nie
  kończ wcześniej, bo „różnica” z pierwszych dni to szum.
- Pełna metodyka, pułapki i szablon wpisu do dziennika: `references/metodyka.md`.

## Widoczność w AI (AI Overviews, AI Mode)

Od 31.08.2026 GSC ma raport skuteczności w funkcjach generatywnej AI: same wyświetlenia
wg strony, kraju, urządzenia i daty, bez kliknięć i bez API. Eksport CSV →
`gsc-eksport.mjs` (rozpozna typ `ai`). Pytania do niego: które typy stron AI cytuje,
czy strony treści (`/jak-dziala-bojo`, `/faq`) i `docs/llm-context.md` przekładają się na
obecność, jak to się ma do 40 promptów z Załącznika A w docs/seo-geo-strategia.md.

## Od kliknięcia do meczu

CTR to nie cel. Cel to ktoś, kto z Google trafia na obiekt i organizuje mecz. Zapytanie
o lejek (`boisko_otwarte` → `boisko_zorganizuj` wg `zrodlo = 'wyszukiwarka'`) jest
w `../gsc/references/dane-i-dostep.md`, sekcja 4. Zmiana snippetu, która podnosi CTR,
a obniża odsetek „Zorganizuj tutaj”, przyciąga niewłaściwe osoby.

## Materiały

- `references/metodyka.md`: definicje metryk, pułapki danych GSC, istotność, eksperymenty, sezonowość
- `scripts/gsc-okazje.mjs`: analiza okazji (funkcje `krzywaCtr`, `lukiCtr` są testowane w `scripts/test/`)
