# Faza 1, runda 9: życie meczu po publikacji — plan

> **Status (2026-09-26): plan do decyzji właściciela (§7). Nic z tego nie jest
> jeszcze wdrożone.** Dziewiąta runda przejścia ścieżki organizatora i gracza,
> pierwsza na `scripts/stos-bez-dockera.sh` (PR-G). Poprzednia:
> [faza1-przejscie-e2e-plan.md](./faza1-przejscie-e2e-plan.md) (`W-1…W-9`).
> Ustalenia tej rundy mają numery `X-n`.
>
> Kryterium doboru to samo co w rundach `F` i `W` (skill fazy 1,
> [strategia.md §0](./strategia.md)): organizator **wie, co się stanie**, Bojo jest
> **niezawodne** i **nie obiecuje tego, czego nie ma**. Każda pozycja poniżej
> została **zobaczona w przeglądarce albo w bazie**, nie tylko wyczytana z kodu.

---

## 0. Co ta runda zrobiła

Runda `W` przeszła drogę do pierwszego zapisu: kreator, link, zapis gościa,
rozliczenie, „Powtórz mecz”. Ta runda poszła dalej, w **życie meczu po publikacji**,
czyli tam, gdzie organizator spędza tydzień między „Wyślij link” a gwizdkiem:

| Co | Jak |
|---|---|
| Stos | `./scripts/stos-bez-dockera.sh` (dane jak w CI) + katalog obiektów (`seed-orliki`, `seed-beach-volleyball`, `seed-rental-venues`), build produkcyjny na ten stos |
| Przeglądarka | Chromium, profil iPhone 13, `pl-PL`, `Europe/Warsaw`, świeży kontekst dla każdej osoby |
| Organizatorka | nowe konto e-mailem → kreator → mecz A (4 miejsca + rezerwa) i mecz B (z akceptacją) |
| Gracze | gość z e-mailem, `test2`, `test3` do kompletu; `test4` i gość na rezerwę; `test5` w trakcie oferty; `test6` i gość na mecz z akceptacją |
| Życie meczu | wypisanie → oferta z rezerwy → „Wchodzę”; wypisanie całkiem → oferta dla gościa; zmiana godziny; akceptacja i odrzucenie próśb; odwołanie z notatką; ekipa od zera |
| Szerokości | skład organizatora na 390, 360 i 320 px |
| Produkcja | **wyłącznie zapytania agregujące i metadane schematu** (liczby, nazwy funkcji i kolumn, stan zadań `pg_cron`); zero danych osobowych |

**Co przeszło czysto i zostaje bez zmian:** okno zapisu gościa przy komplecie
(e-mail wymagany i wytłumaczony), okna meczu z akceptacją (gracz i gość wiedzą, że
czekają na decyzję), trzymanie miejsca dla oferty z rezerwy po stronie bazy (obcy
nie „podbiera” miejsca), strona wpisu gościa z ofertą („Zwolniło się miejsce, jest
Twoje · Masz czas do 19:16”), powiadomienia o zmianie terminu, akceptacji i
odwołaniu (z notatką organizatora), okno odwołania z dokładną liczbą adresatów.

---

## 1. Streszczenie

Wspólny mianownik: **organizator i gracz dostają zdanie, które przestało być
prawdą**. Najpoważniej na produkcji: aplikacja w trzech miejscach obiecuje
przypomnienie dzień przed meczem i przypomnienie o rozliczeniu, a zadanie, które
je wysyła, **od 12 września codziennie pada**.

| # | Ustalenie | Wartość dla organizatora | Koszt | Migracja | PR |
|---|---|---|---|---|---|
| **X-0** | **Produkcja rozjechała się z repo.** Brakuje `odmien_nie_oddalo()` (`131`), więc `bojo-przypomnienia` pada codziennie od 2026-09-12 (14 z 14 przebiegów) — **nie wychodzą przypomnienia „jutro grasz” ani „domknij mecz”**. Brakuje też `fields.szukaj_norm` (`126`): w kreatorze „lodz” znajduje **0 z 194** obiektów, „poznan” 6 ze 179. Brakuje `dopnij_subskrypcje_push()` (`117`) | Działa to, co Bojo obiecuje: przypomnienia, szukanie boiska bez polskich znaków, powiadomienia na właściwy telefon | mały + strażnik | **tak** (`164`, tylko dokłada) | **H (pilne)** |
| **X-3** | Rezerwowy z **aktywną ofertą** widzi na dole pasek „Rezerwa: 1. w kolejce · Wejdziesz, gdy ktoś się wypisze · **Wypisz się**”, który **zasłania kartę „Wchodzę”** | Oferta z rezerwy (godzina na decyzję) nie przepada przez pasek, który mówi coś odwrotnego | mały | nie | I |
| **X-4** | W trakcie oferty obcy widzi „3/4 · Zostało 1 wolne miejsce · Dołącz”, okno „Zapisać się **na mecz**?”, a ląduje na rezerwie | Organizator nie tłumaczy „dlaczego mnie wpisało na rezerwę” | mały | nie | I |
| **X-9** | Gość, którego wpisu już nie ma (prośba odrzucona, organizator usunął), dalej widzi „Jesteś zapisany(a) · Mój zapis →” i **nie ma jak się zapisać ponownie**; link prowadzi na „Link nieaktualny” | Gość wie, na czym stoi; organizator nie dostaje „przecież byłem zapisany” | mały | nie | I |
| **X-1** | Po zapisie gościa i „Nie teraz” strona znów pokazuje „Dołącz bez konta →” — aż do odświeżenia | Gość nie zastanawia się, czy zapis poszedł | bardzo mały | nie | I |
| **X-5** | Gracz, który **sam** się wypisał, dostaje toast „Uczestnik usunięty” | Zdanie opisuje to, co zrobił gracz, nie organizator | bardzo mały | nie | I |
| **X-2** | W składzie organizatora imiona są ucięte: przy 390 px „Mateu…”, przy 360 px imię gościa ma **0 px** — dwa przyciski („Usuń”, „Na rezerwę”) zabierają cały wiersz | Organizator widzi, kogo ma w składzie, na każdym telefonie | mały | nie | J (decyzja D-6) |
| **X-6** | „Zmień termin” mówi „**6 osób** jest zapisanych” — licząc organizatorkę i obserwującego; okno odwołania liczy to samo poprawnie („1 osoba z kontem dostanie powiadomienie”) | Organizator wie, do ilu osób naprawdę pójdzie powiadomienie i komu napisać sam | bardzo mały | nie | J |
| **X-10** | Toast siedzi na dole ekranu (`z-[9999]`, 4,5 s) i **przechwytuje kliknięcia**: zasłania „Udostępnij link” w arkuszu po założeniu ekipy i dół arkusza „Miej Bojo na ekranie głównym” po zapisie | Pierwsza czynność po sukcesie jest klikalna od razu | mały | nie | J (decyzja D-8) |
| X-11 | Drobne zdania: „2 goście bez konta **w składzie**” (jeden jest na rezerwie); pusty stan ekipy mówi to samo dwa razy; dymek „Przytrzymaj „**Grupy**”” przy zakładce „**Ekipy**”; odwołany mecz pokazuje „Zostało 2 wolne miejsca” i „Wypisz się z meczu” | Zero domysłów w drobiazgach | bardzo mały | nie | J |
| X-7 | Treść powiadomień i maili składana w bazie i w funkcjach brzegowych ma **długi myślnik** (25 funkcji SQL, szablony maili i push), którego AGENTS.md zakazuje w treści dla użytkownika; `check:docs` sprawdza tylko `frontend/src` | Spójny, „ludzki” tekst tam, gdzie gracz czyta Bojo najczęściej (telefon, skrzynka) | średni | tak (osobny PR) | K (decyzja D-7) |

**Kolejność = kolejność PR-ów.** `PR-H` pierwszy i osobno, bo naprawia produkcję,
która dziś nie robi tego, co obiecuje, a migracja tylko dokłada, więc wchodzi na
produkcję sama przy merge'u. `PR-I` (stan zapisu mówi prawdę) przed `PR-J`
(czytelność widoku organizatora), bo X-3 potrafi odebrać graczowi miejsce. `PR-K`
tylko po decyzji D-7.

**Zgodność z moratorium** z [analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md) (A.1):
żadna pozycja nie dokłada flagi, typu powiadomienia ani nowej encji. `164` odtwarza
wyłącznie obiekty, które repo już ma.

---

## 2. PR-H — produkcja robi to, co obiecuje (X-0)

### Co zobaczone

Na bazie postawionej z repo `SELECT wyslij_przypomnienia()` przechodzi, więc sprawdziłem produkcję (same liczby):

- `notifications` z ostatnich 30 dni: `przypomnienie_o_meczu` ostatni raz
  **2026-09-11**, `po_meczu_do_domkniecia` ostatni raz **2026-09-10**. Mecze z
  graczami z kontem odbyły się 16.09 i 23.09 — przypomnień dzień wcześniej nie było.
- `cron.job_run_details` dla `bojo-przypomnienia` (codziennie 16:00 UTC): do
  11.09 `succeeded`, **od 12.09 codziennie `failed`**:
  `ERROR: function odmien_nie_oddalo(integer) does not exist`.
- Porównanie schematu bazy postawionej z repo (`stos-bez-dockera.sh`) z produkcją:
  treść **wszystkich 136 istniejących funkcji jest identyczna** (md5 po zdjęciu
  komentarzy i białych znaków), polityki zgadzają się co do liczby na tabelę.
  Różnice to wyłącznie **braki**:

| Brak na produkcji | Migracja | Skutek |
|---|---|---|
| `odmien_nie_oddalo(integer)` | `131` | `wyslij_przypomnienia()` (wersja z `144`/`160`) pada w całości: ani „jutro grasz”, ani „domknij mecz” |
| `fields.szukaj_norm` + `fields_szukaj_norm_trgm` | `126` | `searchExplorerFields()` spada na zapasowe `ilike` z ogonkami: „lodz” → 0/194, „poznan” → 6/179, „krakow” → 66/292 (publiczne obiekty) |
| `dopnij_subskrypcje_push(...)` | `117` | Poprawka „push o cudzej wiadomości na współdzielonym telefonie” nigdy nie weszła; RPC pada po cichu (`catch {}` w `lib/push.ts`) |
| `utworz_termin_serii`, `utworz_nalezne_terminy_serii`, `powiadom_o_nowym_terminie_serii`, wyzwalacz `trg_powiadom_o_nowym_terminie_serii` | `073`, `092` | Brak skutku dziś (`SHOW_RECURRING` wyłączone), ale strażnik z punktu 3 będzie o nich krzyczał |

**Dlaczego.** Dziennik `schema_migracje` na produkcji zapisano 2026-09-22 hurtem
(`--oznacz-do`, backfill). Sonda backfillu widzi **tylko tabele**
(`supabase/migrations/README.md`, „to jest dolna granica”), więc migracje, które
dokładają wyłącznie funkcję albo kolumnę — `117`, `126`, `131` — były dla niej
niewidoczne. Wcześniej ktoś wkleił do SQL Editora nowsze ciało
`wyslij_przypomnienia()` bez pomocnika z `131` (to jest dokładnie pułapka
„migracja puszczona w połowie” z AGENTS.md), a backfill oznaczył `131` jako
zrobioną. Workflow już nigdy tego nie naprawi, bo dla niego wszystko poszło.

### Rozwiązanie

1. **`supabase/migrations/164_naprawa_rozjazdu_produkcji.sql`** — powtarza
   **dosłownie** idempotentne fragmenty, bez żadnej nowej logiki:
   - z `126`: `CREATE EXTENSION IF NOT EXISTS pg_trgm`, `ADD COLUMN IF NOT EXISTS
     szukaj_norm … GENERATED ALWAYS AS (…) STORED`, `CREATE INDEX IF NOT EXISTS
     fields_szukaj_norm_trgm`,
   - z `131`: `CREATE OR REPLACE FUNCTION odmien_nie_oddalo(integer)`,
   - z `117`: `CREATE OR REPLACE FUNCTION dopnij_subskrypcje_push(...)` z
     `REVOKE`/`GRANT` jak w oryginale,
   - (decyzja D-4) z `073`/`092`: trzy funkcje serii i wyzwalacz — dla pełnej
     zgodności, żeby strażnik startował od zera różnic.

   Skaner `ryzyko-migracji.mjs` zakwalifikuje ją jako **bezpieczną** (kolumna,
   indeks, funkcja), więc przy merge'u trafia na produkcję sama. Na świeżej bazie
   (`baza-testowa.sh`, CI „Migracje od zera”) wszystkie polecenia są no-op.
   Nagłówek pliku mówi **dlaczego** i wymienia każdy powtórzony fragment z numerem
   źródła; komentarz w `126`/`131`/`117` zostaje nietknięty (migracji po fakcie
   się nie poprawia).

   Rozmiar: generowana kolumna na ~38 tys. wierszy `fields` + indeks GIN — sekundy,
   bez długiej blokady (tabela jest czytana, rzadko pisana). Gdyby skaner lub
   autor uznał inaczej, `-- RECZNA:` nie jest potrzebne.

2. **Strażnik rozjazdu** (decyzja D-5) — `scripts/odcisk-schematu.sh`:
   - stawia bazę tak jak `baza-testowa.sh` (migracje od zera, bez seedów),
   - zbiera **odcisk**: nazwy funkcji z md5 ciała po zdjęciu komentarzy i białych
     znaków, kolumny tabel, indeksy, wyzwalacze, liczbę polityk na tabelę,
   - zbiera ten sam odcisk z `DB_URL` i wypisuje **braki i różnice**,
   - `.github/workflows/migracje.yml`: po zadaniu „produkcja (bezpieczne)” (i po
     dev) krok „Zgodność schematu z repo”. **Braki = czerwono** z listą w
     podsumowaniu. To jest jedyny sposób, żeby „dziennik mówi zastosowana, a baza
     tego nie ma” wyszło przy najbliższym merge'u, a nie po dwóch tygodniach
     ciszy.

3. **Strażnik zadań `pg_cron`** (decyzja D-5) —
   `.github/workflows/zdrowie-produkcji.yml`, codziennie o 17:00 UTC (godzinę po
   `bojo-przypomnienia`): zapytanie do `cron.job_run_details` o przebiegi
   `status <> 'succeeded'` z ostatnich 26 godzin. Jest błąd → czerwone zadanie z
   komunikatem błędu w podsumowaniu. Bez sekretu `SUPABASE_DB_URL_PROD` —
   zielono z adnotacją, tak jak dziś robi migracja produkcyjna.

4. **Dokumentacja:**
   - `supabase/migrations/README.md`, sekcja „Backfill”: wprost, że sonda nie
     widzi migracji bez tabel i że **po backfillu trzeba puścić strażnika
     odcisku**; ten przypadek jako przykład,
   - `AGENTS.md`, „Pułapki”: jeden akapit „dziennik mówi zastosowana ≠ obiekt
     istnieje” z odesłaniem do strażnika,
   - `docs/baza-danych.md`: `164` w mapie migracji,
   - `docs/llm-context.md` „Ostatnie zmiany”: przypomnienia dzień przed meczem i
     po meczu znowu wychodzą; szukanie obiektu bez polskich znaków działa
     (+ `npm run sync:llm-context`).

### Testy

- `./scripts/baza-testowa.sh` — `164` przechodzi od zera, `przypomnienia.sql`
  (istniejące testy `129/131/144`) zielone.
- Test naprawy stanu połowicznego (nowy blok w `supabase/test/przypomnienia.sql`):
  `DROP FUNCTION odmien_nie_oddalo; ALTER TABLE fields DROP COLUMN szukaj_norm;`
  → `\i 164` → `SELECT wyslij_przypomnienia()` nie rzuca, kolumna istnieje.
  To odtwarza dokładnie stan produkcji.
- `scripts/odcisk-schematu.sh` puszczony przeciw bazie ze stanem połowicznym
  wypisuje oba braki i kończy się kodem ≠ 0; przeciw bazie po `164` — zero różnic.
- Po merge'u: produkcja — `cron.job_run_details` najbliższego przebiegu
  `succeeded`, `notifications` dostaje `przypomnienie_o_meczu` (liczba, nie treść).

---

## 3. PR-I — stan zapisu na stronie meczu mówi prawdę (X-3, X-4, X-9, X-1, X-5)

Wszystko w `app/wydarzenia/[id]/EventDetailClient.tsx` i czystych funkcjach w
`lib/`, żeby dało się je testować bez renderowania.

### X-3. Oferta z rezerwy zasłonięta przez pasek „Wypisz się”

**Zobaczone.** `test4` (rezerwa 1.) po wypisaniu `test2`: na dole przyklejony
pasek `Rezerwa: 1. w kolejce · Wejdziesz, gdy ktoś się wypisze · Wypisz się`
(czerwony), a karta „Zwolniło się miejsce, jesteś następny! · Wchodzę ·
Odpuszczam” leży **pod paskiem i dolną nawigacją**. Na decyzję jest godzina. Ten
sam układ u gościa (pasek „Jesteś zapisany(a) · Mój zapis →” nad kartą oferty).

**Rozwiązanie.** Pasek statusu (`statusBarVisible`, ~l. 4244) dostaje trzeci stan,
**pierwszy w kolejności**:

```tsx
myClaimOffer
  ? <>Zwolniło się miejsce, jest Twoje · <span>do {godzina(claimDeadline)}</span></>
  : myPendingRequest ? … : amIReserve ? … : 'Jesteś w składzie'
```

a zamiast „Wypisz się” — przycisk **„Wchodzę”** (zielony, `bg-primary-700`,
`h-11`), który woła ten sam `handleAcceptClaim()` co karta. „Odpuszczam” zostaje w
karcie (decyzja odmowna nie musi być pod kciukiem). Dla gościa pasek
`mojTokenGoscia` przy aktywnej ofercie mówi „Zwolniło się miejsce, jest Twoje ·
do HH:MM” i prowadzi „Przyjmij →” na `/gracz/przejmij/[token]` (tam są oba
przyciski). Stan oferty gościa bierze się z tego samego wywołania co X-9 niżej.

Kolor: zielony = „w składzie / wejdź”, nie niebieski. Niebieski jest zajęty przez
„wymaga akceptacji” i komplet (AGENTS.md, kolorystyka) — oferta nie jest prośbą o
akceptację organizatora, tylko miejscem do wzięcia.

### X-4. „Zostało 1 wolne miejsce”, a zapis ląduje na rezerwie

**Zobaczone.** W trakcie oferty `test5` widzi „3/4 · Zostało 1 wolne miejsce”,
„Dołącz →”, okno „Zapisać się **na mecz**?” i dopiero toast „Komplet w polu,
jesteś na liście rezerwowej”. Baza postępuje dobrze (miejsce trzyma dla oferty),
kłamie tylko licznik.

**Rozwiązanie.** Miejsce trzymane dla oferty liczy się jako zajęte **dla swojej
roli**:

```ts
// lib/events.ts
export function ofertyWToku(rezerwa: EventParticipant[], teraz = Date.now()) {
  return rezerwa.filter((p) => p.claimOfferedAt && !p.claimPassed
    && (!p.ofertaWygaslaAt || Date.parse(p.ofertaWygaslaAt) > teraz));
}
```

`wolne = wolneMiejscaWgRol([...regulars, ...ofertyWToku(reserves)], event)` i
`isFull` z tego samego — wtedy `joinAsReserve`, tytuł okna („Zapisać się na listę
rezerwową?”), licznik i pasek zgadzają się z bazą. Licznik przy trzymanym miejscu
mówi wprost: „**1 miejsce czeka na osobę z rezerwy** (do 19:16)” zamiast
pomarańczowego „Zostało 1 wolne miejsce”. Kolory licznika bez zmian (komplet
dalej niebieski).

Poza zakresem: karty na listach (`EventBrowseCard`, `/moje-gry`) liczą z
`liczZajeteMiejsca()` bez `claim_offered_at` — przy ofercie pokażą „1 wolne
miejsce” przez maksymalnie `reserve_claim_minutes`. Wejście z karty kończy się na
stronie meczu, która po tej zmianie mówi prawdę.

### X-9. Gość bez wpisu dalej „jest zapisany”

**Zobaczone.** Organizatorka odrzuca prośbę Eli. Ela na stronie meczu: pasek
„Jesteś zapisany(a) · Mój zapis →”, **brak** „Dołącz”; „Mój zapis” → „Link
nieaktualny”. To samo po „Usuń” u organizatora.

**Rozwiązanie.** Gdy `mojTokenGoscia` jest ustawiony, strona raz woła
`podejrzyjWpisGoscia(token)` (`lib/guestClaim.ts`, RPC `podejrzyj_wpis_goscia`,
już istnieje i jest tanie):

- brak wiersza → `zapomnijWpisGoscia(id)`, `setMojTokenGoscia(null)` i jednorazowy
  komunikat w pasku: „Twojego zapisu już nie ma na liście (organizator mógł go
  usunąć albo odrzucić prośbę). Możesz zapisać się ponownie.” — pasek „Dołącz”
  wraca sam, bo `joinBarVisible` zależy od `!mojTokenGoscia`,
- wiersz z `oferta_do` → stan oferty dla paska z X-3.

Strona „Link nieaktualny” bez zmian (nie zna meczu, bo token nie istnieje).

### X-1. Po zapisie gościa znów „Dołącz bez konta”

`EventDetailClient.tsx:1351`: po `zapamietajWpisGoscia(event.id, result.claimToken)`
dodać `setMojTokenGoscia(result.claimToken)`. Jedna linia; stan pojawia się od
razu, nie po odświeżeniu.

### X-5. „Uczestnik usunięty” po własnym wypisaniu

`handleRemove` (l. 1557) służy trzem drogom: organizator usuwa, gracz rezygnuje z
rezerwy, gracz wypisuje się z paska. Parametr z komunikatem:
`handleRemove(id, 'Wypisano Cię z meczu')` z okna wypisania (l. 5006),
`'Zrezygnowano z rezerwy'` z kosza na liście rezerwy (l. 3901), domyślnie
„Uczestnik usunięty” dla organizatora.

### Testy PR-I

- `__tests__/ofertyWToku.test.ts`: oferta w toku, wygasła, odpuszczona; licznik
  `wolneMiejscaWgRol` z trzymanym miejscem bramkarza vs pola.
- `__tests__/paskiStatusu.test.tsx` (render z mockiem, wzorem
  `twojaPlatnosc.test.tsx`): przy ofercie pasek ma „Wchodzę”, nie „Wypisz się”;
  gość z nieistniejącym tokenem widzi „Dołącz”, nie „Mój zapis”.
- Scenariusz e2e **nie**: oferta wymaga dwóch kont i wypisania, a oba projekty
  scenariuszy chodzą po jednej bazie (pułapka `zeSprzataniem()`); pokrywa to
  test komponentu + przejście na `stos-bez-dockera.sh` w PR-ze.

---

## 4. PR-J — widok organizatora czytelny na telefonie (X-2, X-6, X-10, X-11)

### X-2. Imiona w składzie ucięte do zera

**Zobaczone.** Wiersz: awatar, imię (`flex-1 min-w-0`, `max-w-[140px]`), potem
`ml-auto flex shrink-0` z dwoma przyciskami tekstowymi (~210 px). Zmierzone:
390 px → imię 63 px („Mateu…”), gość 13 px („K.”); 360 px → gość **0 px**.

**Rozwiązanie (wariant A, rekomendowany — decyzja D-6).** Mobile-first: na
bazie przyciski **pod imieniem**, w jednym rzędzie, pełnej wysokości dotyku;
obok imienia od `sm:`:

```tsx
<li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
  {/* awatar + imię: basis-full minus awatar na bazie, flex-1 od sm: */}
  <div className="flex min-w-0 flex-1 basis-[calc(100%-3rem)] items-center gap-3 sm:basis-auto">…</div>
  {akcje && (
    <div className="flex w-full gap-2 pl-12 sm:ml-auto sm:w-auto sm:pl-0">
      <button className="h-9 …">Usuń</button>
      <button className="h-9 …">Na rezerwę</button>
    </div>
  )}
</li>
```

`max-w-[140px]` na imieniu znika (ograniczenie robi `truncate` w `min-w-0`).
Koszt: +~40 px na gracza tylko u organizatora; w zamian każde imię jest całe.
Wariant B: jeden przycisk „⋯” z arkuszem akcji (krótsza lista, ale akcje
schowane — wbrew decyzji z 2026-09-13, żeby „Usuń” i „Na rezerwę” stały przy
graczu).

### X-6. „Zmień termin”: 6 osób zamiast 2 + 2

Okno „Zmień termin” (l. ~4850) liczy `confirmed.length`, czyli z organizatorem,
obserwującymi i gośćmi bez adresu. Podmiana na te same funkcje, których używa
edycja i odwołanie: `konsekwencjeZapisu(komuDojdzie(participants, organizerId))`
z `lib/zmianyMeczu.ts`. Checkbox brzmi wtedy np. „Wiem, że termin się zmienia.
2 osoby z kontem dostaną powiadomienie. 2 gości bez konta dostanie e-mail.”
Test: `__tests__/zmianyMeczu.test.ts` już ma `komuDojdzie` — dopisać przypadek z
obserwującym i organizatorem w składzie.

### X-10. Toast zasłania dolny arkusz

`lib/toast.tsx`: kontener `fixed bottom-5 … z-[9999]`, `pointer-events-auto`,
4,5 s. Zobaczone dwa razy: „Ekipa utworzona! 🎉” na „Udostępnij link / Kopiuj
link”; „Dołączyłeś do meczu!” na dole arkusza PWA.

**Rozwiązanie (decyzja D-8, rekomendacja: góra na telefonie).** Mobile-first:
baza `top-[calc(env(safe-area-inset-top)+0.75rem)]`, od `md:` powrót na
`md:top-auto md:bottom-5`. Na telefonie góra ekranu jest wolna (nagłówek to
logo i dzwonek, nie akcje), dół jest zajęty przez paski akcji i arkusze. Animacja
`slide-down` na bazie, `md:` bez zmian. Zmiana globalna — dotknie wzorców zrzutów
tylko tam, gdzie toast jest na zrzucie (dziś: żaden wzorzec z `scenariusze`
celowo go nie łapie; sprawdzić raportem).

### X-11. Drobne zdania

| Gdzie | Dziś | Po |
|---|---|---|
| `EventDetailClient.tsx:3654` | „2 goście bez konta **w składzie**” (liczy też rezerwę) | „… bez konta w składzie **i na rezerwie**”, gdy któryś jest na rezerwie; inaczej bez zmian |
| `GroupDetailClient.tsx:601` | pusty stan + „Brak meczów. Stwórz pierwszy!” pod nim | drugie zdanie znika, gdy stoi karta „Ekipa nie ma jeszcze żadnego meczu” |
| `BottomNav.tsx:343` | „Przytrzymaj „Grupy” → najbliższa ekipa” | „Przytrzymaj „Ekipy” → najbliższa ekipa” |
| strona odwołanego meczu | „Zostało 2 wolne miejsca” + „Wypisz się z meczu” pod banerem „Mecz odwołany” | licznik bez zdania o wolnych miejscach, bez „Wypisz się” (nie ma z czego) |
| okno gościa `alreadyJoined` | „Wcześniej dołączyłeś do tej gry.” | „Ten zapis już jest na liście.” (bez rodzaju, jak reszta okna gościa) |

Bez długiego myślnika, bez nowych kolorów.

---

## 5. PR-K — długi myślnik w powiadomieniach i mailach (X-7, decyzja D-7)

**Zobaczone.** `notifications.body` na stosie: „Czwartkowa gierka **—** 26.09,
godz. 18:00. Skład jest pełny: 4 z 4.” Na produkcji to samo w każdym typie.
Zliczone w ciałach funkcji (bez komentarzy): 25 funkcji ma literał z „—”; szablony
`powiadom-goscia/tresc.ts`, `send-push`, `send-invites`, `notify-game-alert` też.
AGENTS.md wymienia powiadomienia wprost jako treść objętą zakazem, ale sekcja 11
`check:docs` skanuje wyłącznie `frontend/src`.

**Uwaga, której nie wolno przeoczyć:** część myślników pochodzi z **tytułów
meczów wpisanych przez ludzi** („Poniedziałek — wymaga akceptacji”). Tych się
nie rusza — dlatego odpada „trigger, który podmienia „—” na przecinek” przy
`INSERT` do `notifications`.

**Wariant A (rekomendowany):**
1. Zapadka w `check:docs` (nowa sekcja 12): literały SQL w migracjach
   **od `165`** i literały w `supabase/functions/**` nie mogą mieć „—”.
   Stare migracje są historią, nie treścią — zapadka nie pozwala tylko przybywać.
2. Jedna migracja `165_powiadomienia_bez_dlugiego_myslnika.sql`, która przepisuje
   25 funkcji z doborem znaku do zdania (wzorzec: „Tytuł, 26.09, godz. 18:00.”),
   plus szablony w funkcjach brzegowych. Duża, ale mechanicznie sprawdzalna:
   test w `supabase/test/` przeszukuje `pg_proc.prosrc` po zdjęciu komentarzy.

Wariant B: tylko zapadka (nic nie przybywa, stare zostają). Wariant C: nic.

---

## 6. Zasady wspólne dla PR-H…K

- **Mobile-first**: style bazowe dla 320–375 px, rozszerzenia wyłącznie
  `sm:`/`md:`; zero `max-*:` i `@media (max-width…)` (`check:docs` sekcja 10).
- **Kolory**: nic nowego. Oferta z rezerwy = zielony „wejdź”, nie niebieski.
- **Bez długiego myślnika** w treści dla użytkownika (sekcja 11).
- **Nowe typy powiadomień**: żaden.
- Przed każdym commitem: `npx tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build` (atrapy), `npm run check:docs`; przy PR-H i PR-K dodatkowo
  `./scripts/baza-testowa.sh` i `node scripts/build-db-bundles.mjs`.
- Każdy PR przechodzi ścieżkę na `./scripts/stos-bez-dockera.sh` przed otwarciem.
- Zmiany widoczne dla użytkownika → `docs/llm-context.md` + `npm run sync:llm-context`.
- Zmiany wyglądu (X-2, X-3, X-10) → wzorce przez `zrzuty:zaakceptuj` po obejrzeniu
  raportu.

---

## 7. Decyzje dla właściciela

- **D-4 (X-0, zakres `164`).** (A) odtworzyć **wszystkie** brakujące obiekty,
  także trzy funkcje serii i wyzwalacz (flaga i tak wyłączona, strażnik startuje od
  zera różnic) czy (B) tylko `126`, `131`, `117`. **Rekomendacja: A.**
- **D-5 (X-0, strażniki).** Czy dokładamy (1) porównanie odcisku schematu w
  workflow „Migracje” (czerwone przy braku) i (2) codzienne zadanie „Zdrowie
  produkcji” sprawdzające `pg_cron` (czerwone przy błędzie)? **Rekomendacja: oba.**
  Bez nich ta klasa awarii znowu będzie cicha: przypomnienia nie wychodziły dwa
  tygodnie i nikt tego nie zauważył.
- **D-6 (X-2).** (A) przyciski pod imieniem na telefonie czy (B) menu „⋯”.
  **Rekomendacja: A.**
- **D-7 (X-7).** (A) zapadka + migracja przepisująca szablony, (B) tylko zapadka,
  (C) nic. **Rekomendacja: A, jako osobny PR-K po H/I/J.**
- **D-8 (X-10).** Toast na telefonie (A) u góry ekranu czy (B) na dole, ale nad
  arkuszem (wymaga wiedzy o otwartym arkuszu w każdym miejscu). **Rekomendacja: A.**

---

## 8. Szkice opisów PR-ów (po polsku)

### PR-H: Przypomnienia i szukanie obiektów znowu działają na produkcji

**Po co.** Od 12 września zadanie wysyłające przypomnienia („jutro grasz”, „domknij
mecz”) codziennie pada na produkcji, bo brakuje funkcji z migracji `131`. Brakuje
też kolumny do szukania bez polskich znaków (`126`: „lodz” znajduje 0 z 194
obiektów) i poprawki pushy na współdzielonym telefonie (`117`). Dziennik migracji
uważa je za zastosowane — backfill z 22.09 nie widział migracji bez tabel.

**Co się zmienia.** Migracja `164` powtarza dosłownie idempotentne fragmenty
`126`, `131`, `117` (i serii, D-4). Nowy `scripts/odcisk-schematu.sh` porównuje
schemat bazy ze schematem z repo; workflow „Migracje” kończy się czerwono, gdy
czegoś brakuje. Codzienne „Zdrowie produkcji” sprawdza zadania `pg_cron`.

**Migracja.** `164` — tylko dokłada, na produkcję wchodzi sama przy merge'u.

### PR-I: Strona meczu mówi prawdę o Twoim zapisie

Oferta z rezerwy ma „Wchodzę” pod kciukiem, zamiast paska „Wypisz się” na niej;
licznik nie obiecuje miejsca trzymanego dla rezerwy; gość, którego wpis zniknął,
może zapisać się ponownie; po zapisie gościa nie wraca „Dołącz bez konta”;
wypisanie nie mówi „Uczestnik usunięty”. Bez migracji.

### PR-J: Skład organizatora czytelny na każdym telefonie

Imiona w składzie całe na 320–390 px (akcje pod imieniem), „Zmień termin” liczy
adresatów tak jak odwołanie, toast u góry na telefonie, pięć drobnych zdań.
Bez migracji.

### PR-K: Powiadomienia i maile bez długiego myślnika

Zapadka w `check:docs` dla migracji od `165` i funkcji brzegowych oraz migracja
przepisująca szablony 25 funkcji. Tytuły meczów wpisane przez ludzi — bez zmian.
