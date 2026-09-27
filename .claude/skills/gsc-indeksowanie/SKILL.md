---
name: gsc-indeksowanie
description: Diagnoza indeksowania bojo.pl w Google Search Console, czyli raport Indeksowanie → Strony („Strona zeskanowana, ale jeszcze nie zindeksowana”, „Wykryta – obecnie niezindeksowana”, „noindex”, „Duplikat…”, „Strona zawiera przekierowanie”, 404, 5xx, robots.txt), Mapy witryn, Sprawdzanie adresu URL i Statystyki indeksowania. Używaj, gdy liczba zaindeksowanych stron spada albo stoi, przychodzi mail „Nowy powód uniemożliwiający zindeksowanie”, ktoś pyta, czemu strona obiektu lub meczu nie jest w Google, albo przy zmianach w sitemapach, robots.ts, canonical, noindex i przekierowaniach. Rozdziela zamierzone wykluczenia (Tier 3, minione mecze, kody dołączenia) od błędów i śledzi sygnał R1 (katalog oceniony jako treść masowa).
---

# Indeksowanie bojo.pl

Pytanie, na które odpowiada ten skill: **czy Google ma w indeksie to, co powinien,
i nie ma tego, czego mieć nie powinien**. W Bojo „powinien” jest zdefiniowane w kodzie
(`.claude/skills/gsc/scripts/lib/mapa-bojo.mjs`, uzasadnienia w
`../gsc/references/mapa-seo-bojo.md`), więc diagnoza polega na porównaniu stanu
w GSC z zamierzonym, adres po adresie.

## Procedura dla raportu „Strony”

1. **Eksport raportu** (Indeksowanie → Strony → Eksportuj → CSV) →
   `node .claude/skills/gsc/scripts/gsc-eksport.mjs <zip>`. Wynik: wykres
   (zindeksowane / niezindeksowane, skoki), tabela przyczyn z werdyktem dla Bojo,
   udział R1.
2. **Porównaj z poprzednim odczytem** w `docs/gsc-dziennik.md`. Liczy się kierunek:
   która przyczyna rośnie, czy zaindeksowane rosną razem z wykrytymi, czy zamiast nich.
3. **Każda przyczyna z werdyktem „zależy”, „do zbadania” albo „błąd”:** kliknij ją
   w GSC → eksport przykładowych adresów →
   `gsc-eksport.mjs <plik> --adresy`. Rozkład na typy stron i warianty adresu obiektu
   (kanoniczny / UUID / historyczny) zwykle od razu daje odpowiedź. Drzewa decyzji
   dla każdej przyczyny: `references/diagnoza.md`.
4. **Pojedyncze adresy** sprawdź inspekcją: w UI albo
   `node .claude/skills/gsc/scripts/gsc-api.mjs inspekcja <url…>` (canonical wybrany przez
   Google vs nasz, ostatnie skanowanie, skąd Google zna adres, robots, pobranie).
5. **Dane z bazy** (tier, duplikaty, liczba obiektów w sitemapach): zapytania
   w `references/diagnoza.md` (konektor Supabase, tylko SELECT).
6. **Werdykt i akcja:** zamierzone → wpis do dziennika i koniec; błąd → PR
   z testem (wzór: `frontend/src/__tests__/linkiObiektuKanoniczne.test.ts`), po
   deployu „Sprawdź poprawkę” tylko dla przyczyn, które da się zweryfikować (404, 5xx,
   soft 404, duplikaty; „noindex” i „robots” zamierzonych stron nie weryfikujemy).

## Sygnał R1: najważniejsza liczba w tym raporcie

Ryzyko R1 (docs/seo-geo-strategia.md, rozdz. 8–9): Google uznaje katalog obiektów za
treść masową i przestaje go indeksować. Objaw: „Zeskanowana, ale jeszcze nie
zindeksowana” i „Wykryta, obecnie niezindeksowana” rosną do dziesiątek tysięcy przy
stojącej liczbie zaindeksowanych. `gsc-eksport.mjs` liczy udział tych dwóch przyczyn
w znanych adresach: < 10% spokój, 10–30% obserwować, > 30% alarm. Te progi to
propozycja, a trend między odczytami waży więcej niż jedna liczba.
Stan 2026-09-14: 85 z ~18 tys. (0,5%), spokój.

Przy wzroście najpierw wyklucz przyczyny techniczne (pojemność serwera: Statystyki
indeksowania, 5xx, czas odpowiedzi; przekierowania z sitemapy), dopiero potem wnioskuj
o jakości treści.

## Mapy witryn

- Indeks `/sitemap-index.xml` → `/sitemap.xml` + 16 map boisk po województwach.
- „Wykryte strony” liczy wpisy. Porównaj z liczbą obiektów Tier 1+2 w bazie
  (zapytanie w `references/diagnoza.md`). Od 2026-09-26 (PR #435) wpis = osobny obiekt,
  wcześniej 32 tys. wpisów dawało ~10,6 tys. różnych adresów.
- Stan „Nie można pobrać” albo błędy w mapie: sprawdź cache (`lib/naglowkiSitemap.ts`)
  i czy baza odpowiadała. Sitemapa degraduje się do pustej listy zamiast 500.

## Czego nie robić

- **Nie blokuj w robots.txt strony, która ma wypaść z indeksu.** Google nie zobaczy
  wtedy `noindex`. Kolejność: najpierw `noindex`, a blokada dopiero po wypadnięciu
  z indeksu (docs/seo-geo-strategia.md, P4).
- **Nie używaj narzędzia „Usunięcia”** do porządków z canonical i duplikatami. Ono
  tylko ukrywa adres na ~6 miesięcy, niczego nie naprawia.
- **Nie zdejmuj `noindex` z Tier 3 dla liczby zaindeksowanych.** To decyzja jakościowa
  (migracja `112`, odrzucone 4c w strategii). Zmienia ją właściciel, nie raport.
- **Nie klikaj „Poproś o zindeksowanie” masowo** (limit dzienny, zero wpływu na decyzje
  jakościowe). Ma sens dla pojedynczej, właśnie poprawionej strony.

## Materiały

- `references/diagnoza.md`: drzewa decyzji dla każdej przyczyny, zapytania SQL, Statystyki indeksowania, oczekiwane skutki napraw
- `../gsc/scripts/lib/przyczyny.mjs`: werdykty (źródło prawdy dla `gsc-eksport.mjs`)
- `../gsc/references/mapa-seo-bojo.md`: typy stron, host, sitemapy, historia, otwarte tematy
