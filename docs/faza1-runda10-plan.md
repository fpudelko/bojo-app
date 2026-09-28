# Faza 1, runda 10: czy wiadomość od Bojo w ogóle dochodzi — plan

> **Status (2026-09-28): decyzje podjęte (§9) — D-9 zrobione ręcznie (SQL Editor,
> nie workflow — patrz uwaga w Z-0), D-10 A, D-11 zostajemy na darmowym planie Resend
> + dokładamy strażnik limitu (Z-1a, nowa pozycja), D-12 tylko raz, D-13 tak, na obrazku.
> Implementacja PR-M/N/O/K jeszcze nie ruszona.**
> Dziesiąta runda przejścia ścieżki organizatora i gracza. Poprzednie:
> [faza1-runda9-plan.md](./faza1-runda9-plan.md) (`X-n`),
> [faza1-przejscie-e2e-plan.md](./faza1-przejscie-e2e-plan.md) (`W-n`).
> Ustalenia tej rundy mają numery `Z-n` (litera `Y` była już używana doraźnie w kodzie).
>
> Kryterium doboru to samo co w rundach `F`, `W`, `X` (skill fazy 1,
> [strategia.md §0](./strategia.md)): organizator **wie, co się stanie**, Bojo jest
> **niezawodne**, **nie obiecuje tego, czego nie ma**, a organizator dostaje argumenty,
> którymi przebija ścianę kont u graczy.

---

## 0. Jak ta runda sprawdzała

Rundy `W` i `X` przeszły ścieżkę w przeglądarce na `stos-bez-dockera.sh` i naprawiły to,
co widać na ekranie. Ta runda zadała pytanie, na które przeglądarka nie odpowie: **czy to,
co Bojo obiecuje wysłać, dochodzi do człowieka**, i co widzi człowiek, do którego
organizator wysłał link.

| Co | Jak |
|---|---|
| Kod | ścieżki wiadomości: `notifications` → push (`109`) / poczta do konta (`140`, `142`) / poczta do gościa (`133`, `137`, `142`), `lib/harmonogramMeczu.ts`, panel „Mecz gotowy”, podgląd linku (`opengraph-image.tsx`, `eventMeta.ts`), zaproszenie gościa (`lib/guestClaim.ts`, `GuestInviteNudge.tsx`), strona wpisu gościa, karta „Twoja płatność” |
| Produkcja | **wyłącznie zapytania agregujące** (liczby), bez danych osobowych; wykluczone konta `@example.com` i mecze z markerami seedów |
| Przeglądarka | **nie tym razem** — w tej sesji powłoka była niedostępna (błąd klasyfikatora uprawnień), więc stos nie wstał. Każde ustalenie niżej stoi na kodzie **i** na liczbach z produkcji; przejście w przeglądarce jest częścią testów każdego PR-a (§8) |

### Liczby z produkcji, na których stoi ten plan

Okno: ostatnie 60 dni, prawdziwe mecze i konta.

| Pomiar | Wynik | Co z tego wynika |
|---|---|---|
| Gracze z kontem, którzy mają push | **3 z 33** (9%) | 9 na 10 graczy z kontem dostaje powiadomienia wyłącznie pod dzwonkiem, czyli dopiero, gdy sami otworzą Bojo |
| Organizatorzy z pushem | **2 z 9** | to samo po stronie organizatora |
| `przypomnienie_o_meczu` | 12 wysłanych, **5 przeczytanych**, mediana odczytu **19,5 h** | przypomnienie z 18:00 dzień przed jest czytane zwykle już po meczu albo wcale |
| `zaproszenie_na_mecz` (m.in. „Powtórz mecz” zaprasza skład, F-5) | 13 wysłanych, **7 nieprzeczytanych** | pętla „co tydzień ta sama ekipa” nie domyka się bez WhatsAppa |
| `po_meczu_do_domkniecia` (organizator) | 4 wysłane, **1 przeczytane**, po 2,6 doby | przypomnienie o rozliczeniu nie dochodzi |
| `prosba_o_dolaczenie` (organizator) | 10 wysłanych, 9 przeczytanych, mediana **2 min** | organizatorzy aktywnie zaglądają przy prośbach — tu kanał działa i nie ruszamy go |
| Płatne mecze rozegrane / z odhaczoną choć jedną wpłatą | 30 / **6** | rozliczenie jest mało używane (kontekst dla Z-1 i Z-6) |
| Goście bez konta w składzie: dopisani **ręcznie przez organizatora** | **29, z e-mailem 0** | to dziś główna droga gościa do składu, a ci ludzie nie dostają od Bojo niczego |
| Goście zapisani sami z linku | 32, z e-mailem 8 (najnowszy wpis bez adresu: 09.09, potem pole jest wymagane) | stan historyczny, dziś w porządku |
| Maile dziennie (`maile_wyslane`, 30 dni) | średnio 10, maks. 60 | zapas względem darmowego planu Resend (100/dzień) jest, ale nie nieskończony — patrz Z-1, bezpiecznik |
| Zadania `pg_cron` | wszystkie trzy `succeeded` | PR-H (X-0) zadziałał: przypomnienia znowu wychodzą |
| Dziennik migracji na produkcji | ostatnia: **`166`**; **`167` (RĘCZNA) nie kliknięta** | patrz Z-0 — blokuje każdą kolejną migrację |

---

## 1. Streszczenie

Wspólny mianownik: **Bojo mówi organizatorowi „zrobimy to za Ciebie”, a wiadomość
w 9 przypadkach na 10 ląduje tam, gdzie nikt nie patrzy.** Gość bez konta, który podał
e-mail, jest dziś lepiej poinformowany niż gracz z kontem — dokładnie odwrotnie, niż
obiecuje okno „konto daje: … dostaniesz powiadomienie”. Druga połowa: osoby, które
organizator dopisuje ręką (najczęstsza droga gościa), nie mają żadnego kanału, a link,
który organizator może im wysłać, obiecuje rzeczy nieprawdziwe.

| # | Ustalenie | Wartość dla organizatora | Koszt | Migracja | PR |
|---|---|---|---|---|---|
| **Z-0** | Migracja `167` (ręczna, kasuje tabele gier cyklicznych) **czeka na kliknięcie** od 27.09. Zadanie produkcyjne zatrzymuje się przed nią razem z **każdą** kolejną migracją, więc Z-1 i Z-5 nie dojechałyby na produkcję | Nowe poprawki w ogóle trafiają do bazy | kliknięcie | — | **zrobione 2026-09-28** (SQL Editor; dziennik dogoni się sam przy PR-N, patrz §2) |
| **Z-1** | 9/10 graczy i 7/9 organizatorów nie ma pusha, a przypomnienie dzień przed, oferta z rezerwy, zaproszenie na mecz i „domknij mecz” chodzą wyłącznie dzwonkiem + pushem. Gość z e-mailem dostaje te same rzeczy mailem | Przypomnienie, zaproszenie „Powtórz mecz” i oferta z rezerwy **dochodzą**; organizator nie musi dublować ich na WhatsAppie | średni | **tak** (tylko podmiana funkcji) | O |
| **Z-1a** | Bezpiecznik 80 maili/dobę (Z-1) chroni limit Resend, ale cicho — nikt nie widzi, że limit został dobity, dopóki mail nie przestanie przychodzić | Widoczne ostrzeżenie, zanim organizatorzy zaczną tracić maile, nie po fakcie | mały | nie | O |
| **Z-2** | Organizator nigdy nie dostaje propozycji włączenia powiadomień (zachęta startuje wyłącznie po zapisie gracza) | Prośba o dołączenie i komplet przychodzą na telefon | mały | nie | O |
| **Z-3** | Podgląd linku na WhatsAppie: „**1 wolnych miejsc**”, „**2 wolnych miejsc**”; odwołany, rozegrany i zamknięty mecz dalej pokazuje „N wolnych miejsc”; nigdzie nie pada „zapis bez konta”; mecz prywatny ma tytuł „Mecz” | Pierwsze, co gracz widzi po wklejeniu linku, jest prawdziwe i niesie argument „bez konta” | mały | nie | M |
| **Z-4** | Link, który organizator wysyła dopisanemu gościowi, obiecuje „dołączanie do ekipy”, „przeglądanie otwartych gier w okolicy”, „zakładanie własnych gier” (F-6 usunęło to wszędzie indziej), mówi „Masz miejsce w składzie” gościowi z rezerwy i przedstawia link jako **ścianę konta**, a nie jako stronę jego zapisu (skład, koszt, BLIK, „Nie mogę grać”). To samo w modalu po dopisaniu i w pasku nad składem | Organizator wysyła wiadomość, która jest prawdą i zdejmuje z niego obsługę „nie dam rady” | mały | nie | M |
| **Z-5** | Gość dopisany przez organizatora nie ma jak sam podać e-maila — pole istnieje wyłącznie w oknie organizatora | Każda osoba w składzie może dostać przypomnienie i wiadomość o odwołaniu, bez zakładania konta | średni | **tak** (nowa funkcja RPC + podmiana podglądu) | N |
| **Z-6** | Gracz bez wybranego sposobu płatności (dopisany ręcznie: 29 osób) **nigdy nie widzi numeru BLIK** ani akceptowanych sposobów — karta „Twoja płatność” pokazuje BLIK tylko przy `metoda === 'blik'`, choć baza numer oddaje | Rozliczenie działa także dla tych, których organizator dopisał ręcznie | bardzo mały | nie | M |
| Z-7 | (przeniesione) PR-K z rundy 9 — długi myślnik w powiadomieniach i mailach, decyzja D-7 A, **niewdrożone**. Numer `165` jest już nieużywalny (niższy niż zastosowane `166`), bierze kolejny wolny | Spójny tekst w mailach, które Z-1 zacznie wysyłać częściej | średni | tak | K |

**Kolejność = kolejność PR-ów:** `Z-0` (kliknięcie) → `PR-M` (Z-3, Z-4, Z-6: pierwszy
kontakt i tekst, zero migracji, najszybszy zysk) → `PR-N` (Z-5: gość zostawia e-mail) →
`PR-O` (Z-1, Z-2: kanał poza aplikacją dla kont) → `PR-K` (Z-7).

Uzasadnienie: PR-M poprawia to, co widzi **każdy** człowiek z linku, i nie ma ryzyka
bazy. PR-N przed PR-O, bo jest węższy (jedna funkcja, jedna strona) i od razu zmniejsza
liczbę „N osób nie dostanie wiadomości” w harmonogramie. PR-O zmienia decyzję z migracji
`140` (lista maili), więc wymaga decyzji D-10 i wdrożenia funkcji brzegowej.

**Zgodność z moratorium** ([analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md), A.1): żadna
pozycja nie dokłada flagi, typu powiadomienia ani nowej encji. Z-1 dokłada **kanał**
istniejącym typom, Z-5 dokłada funkcję RPC na istniejącej kolumnie.

---

## 2. Z-0 — kolejka migracji stoi na `167`

**Zobaczone.** `schema_migracje` na produkcji kończy się na `166_gry_cykliczne_odpiecie.sql`
(27.09, 09:24). `167_gry_cykliczne_usuniecie.sql` jest ręczna (`DROP TABLE`,
`DROP COLUMN`) i czeka. Zgodnie z AGENTS.md zadanie produkcyjne zatrzymuje się przed
pierwszą ręczną migracją **razem z całą resztą za nią**.

**Zrobione (2026-09-28), ale inną drogą niż plan zakładał.** Właściciel wkleił treść
`167` wprost w Supabase SQL Editor zamiast puścić ją przez Actions → Migracje. Skutek
sprawdzony zapytaniami: `recurring_events`, `recurring_event_invites` i `player_stats`
nie istnieją, `events.recurring_event_id` nie istnieje — migracja **poszła w całości**.

**Jedna rzecz, o którą trzeba zadbać przy najbliższym uruchomieniu workflow „Migracje”.**
`schema_migracje` **nie ma wiersza dla `167`** — dziennik nie wie, że ktoś to zrobił poza
nim. To jest dokładnie sytuacja odwrotna do pułapki z AGENTS.md („dziennik mówi
zastosowana, a obiektu nie ma”): tu obiekt zniknął, a dziennik milczy. Konsekwencja jest
łagodna, bo `167` jest w całości `IF EXISTS`/`DROP COLUMN IF EXISTS` — **idempotentna**:
przy najbliższym uruchomieniu `migruj.sh` zobaczy `167` jako niezastosowaną, puści ją
jeszcze raz (no-op, bo obiektów już nie ma) i **sam** dopisze brakujący wiersz z
poprawną sumą kontrolną. Nie trzeba nic klikać ręcznie — wystarczy, że PR-N (pierwszy,
który znowu dotyka `supabase/migrations/**`) przejdzie normalną ścieżką.

**Bez tego kroku PR-N i PR-O nie mogłyby dojechać na produkcję automatem:** kolejka
migracji nadal by się zatrzymywała przed `167`, teraz już tylko formalnie (obiektów do
skasowania nie ma), ale zgodnie z regułą „ręczna blokuje całą resztę za nią”.

---

## 3. PR-M — pierwszy kontakt i tekst mówią prawdę (Z-3, Z-4, Z-6)

Bez migracji. Bez nowych kolorów. Bez długiego myślnika.

### Z-3. Podgląd linku (WhatsApp, Messenger)

**Zobaczone (kod).** `app/wydarzenia/[id]/opengraph-image.tsx:58`:

```ts
const skladTekst = ev.max_players ? (wolne > 0 ? `${wolne} wolnych miejsc` : 'Komplet') : '';
```

- odmiana na sztywno: „1 wolnych miejsc”, „2 wolnych miejsc”, „3 wolnych miejsc” — przy
  14-osobowym składzie z 12 zapisanymi (najczęstszy stan, gdy organizator dopycha skład)
  obrazek mówi „2 wolnych miejsc”,
- `status`, `zapisy_zamkniete` i to, czy mecz już był, **nie są brane pod uwagę**: odwołany
  mecz na podglądzie wygląda jak mecz z wolnymi miejscami (bursztynowa pigułka),
- `metadataDlaMeczu()` (`eventMeta.ts`): `og:description` to sam „📍 miejsce”, a
  `description` kończy się zdaniem dla organizatora („Dołącz i zbierz skład na Bojo”),
  nie dla gracza, który dostał link. Argument „zapisujesz się bez konta” jest w tekście
  do udostępnienia (S-5), ale znika, gdy ktoś wklei **sam link** (a tak robi część ludzi),
- mecz prywatny i nieistniejący: tytuł „Mecz” i pusty podgląd — celowo bez szczegółów
  (prywatność), ale „Mecz | Bojo” niczego nie mówi.

**Rozwiązanie.**

1. `app/wydarzenia/[id]/eventMeta.ts` — do `select` dołożyć `reserve_enabled`
   (tabela `events` jest czytelna dla `anon` w całości), do `EventMeta` pole
   `reserve_enabled?: boolean`. Nowa **czysta** funkcja w tym samym pliku:

   ```ts
   import { withCount } from '@/lib/plural';
   import { czyPrzedStartemWPolsce } from '@/lib/czasPolski';

   export interface StanPodgladu {
     /** Tekst pigułki na obrazku; pusty = pigułki nie rysujemy. */
     pigulka: string;
     /** Bursztynowe wyróżnienie — wyłącznie „są wolne miejsca”. */
     wyroznij: boolean;
     /** Czy wolno powiedzieć „zapis bez zakładania konta” (ta sama bramka co
      *  `zdanieBezKonta()` w lib/eventShare.ts). */
     bezKonta: boolean;
   }

   export function stanPodgladu(ev: EventMeta, zajete: number, teraz = new Date()): StanPodgladu {
     if (ev.status === 'cancelled') return { pigulka: 'Mecz odwołany', wyroznij: false, bezKonta: false };
     // Serwer stoi na UTC — „czy już był” liczymy w Polsce (W-3, lib/czasPolski.ts).
     if (!czyPrzedStartemWPolsce(ev.date, ev.time, terazWPolsce(teraz))) {
       return { pigulka: 'Mecz rozegrany', wyroznij: false, bezKonta: false };
     }
     if (ev.zapisy_zamkniete) return { pigulka: 'Zapisy zamknięte', wyroznij: false, bezKonta: false };
     if (!ev.max_players) return { pigulka: '', wyroznij: false, bezKonta: true };
     const wolne = Math.max(0, ev.max_players - zajete);
     if (wolne > 0) {
       return { pigulka: withCount(wolne, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc'), wyroznij: true, bezKonta: true };
     }
     const rezerwa = ev.reserve_enabled ?? true;
     return { pigulka: rezerwa ? 'Komplet, jest rezerwa' : 'Komplet', wyroznij: false, bezKonta: rezerwa };
   }
   ```

   (`terazWPolsce` importowane obok `czyPrzedStartemWPolsce`.)

2. `opengraph-image.tsx` — `skladTekst`/kolor pigułki z `stanPodgladu(ev, zajete)`;
   pigułka ceny bez zmian. Gdy `bezKonta`, pod pigułkami trzecia linia tekstu
   (26 px, `rgba(255,255,255,0.8)`): „Zapis bez zakładania konta”. `KartaOgolna`
   (prywatny / brak meczu) dostaje pod „bojo” zdanie „Otwórz link, żeby zobaczyć
   szczegóły meczu” (32 px) — **żadnych danych meczu**.

3. `metadataDlaMeczu()`:
   - publiczny: `description` = `${sport} • ${kiedy} • ${miejsce}.` + (`bezKonta` ?
     ` Zapisujesz się bez zakładania konta.` : '') — zdanie o „zbieraniu składu” znika;
     `openGraph.description` = `📍 ${miejsce}` + (`bezKonta` ? ` · zapis bez konta` : ''),
   - prywatny i brak meczu (ta sama, bezcechowa odpowiedź): `title: 'Mecz w Bojo'`,
     `description: 'Otwórz link, żeby zobaczyć szczegóły meczu.'`, `robots` bez zmian.
   - `metadataDlaMeczu` dostaje trzeci parametr `zajete?: number` (page.tsx liczy go już
     dla JSON-LD przy meczu publicznym — `generateMetadata` woła `policzZajeteMiejsca`
     tak samo). Bez `zajete` → `bezKonta` liczone jak przy wolnych miejscach
     (bezpiecznik: stary kształt wywołania nie psuje metadanych).

**Świadomie poza zakresem:** podgląd jest buforowany przez WhatsApp/Facebook per adres
(nie da się go odświeżyć z naszej strony), więc liczba miejsc na podglądzie bywa
nieaktualna. Nie dokładamy parametru w adresie „na świeżość” — rozbiłby kanoniczny
link (`eventUrl()`), a strona meczu i tak pokazuje stan bieżący.

**Testy.**
- `__tests__/eventMetadata.test.ts` — nowe przypadki `stanPodgladu`: 1/2/5/12/14 wolnych
  (odmiana), odwołany, rozegrany (godzina w Polsce vs UTC: `2026-07-01T16:30:00Z` przy
  meczu 18:00 tego dnia → rozegrany; `…15:30Z` → nie), zamknięte zapisy przy wolnych
  miejscach, komplet z rezerwą i bez; `metadataDlaMeczu` — publiczny z wolnymi ma
  „bez zakładania konta”, odwołany nie ma, prywatny nie zawiera tytułu/miejsca/daty.
- Istniejący test „prywatny nie ujawnia szczegółów” zostaje i musi przejść.

### Z-4. Zaproszenie dla dopisanego gościa

**Zobaczone (kod).** `lib/guestClaim.ts`, `tekstZaproszeniaGoscia()`:

```
Masz miejsce w składzie, potwierdź, że to Ty, żeby mecz trafił na Twoją listę gier.
Przy okazji odblokujesz:
• dołączanie do ekipy i powiadomienia o kolejnych meczach,
• zakładanie własnych gier,
• przeglądanie otwartych gier w okolicy (tych wciąż przybywa).
Konto zakładasz Google'em albo e-mailem, zajmuje 30 sekund:
```

- dwie z trzech obietnic F-6 uznało za **nieprawdziwe** i usunęło z ekranów
  (`content/kontoGoscia.ts`: „konto nie dołącza do żadnej ekipy samo z siebie”,
  „otwartych gier jest dziś za mało”); tu zostały, bo `kontoGoscia.test.ts` pilnuje
  tylko maila `zaloz_konto`,
- „Masz miejsce w składzie” idzie także do gościa dopisanego **na rezerwę**,
- ten sam tekst leci po meczu z karty „Po meczu” („Zaproś do Bojo”) — wtedy „masz
  miejsce w składzie” jest już nieprawdą w drugą stronę,
- całość mówi „potwierdź, że to Ty” i „załóż konto”, czyli stawia ścianę, zamiast
  powiedzieć, co ten link daje **bez konta** (od W-4/X: skład, koszt, numer BLIK
  godzinę przed meczem, „Nie mogę grać, wypisz mnie”, przyjęcie oferty z rezerwy).
  To jest dokładnie argument dla organizatora: „kliknij, tam sprawdzisz i sam się
  wypiszesz, jak coś wypadnie” — zdejmuje z niego obsługę rezygnacji.

Te same nieprawdy w dwóch innych miejscach:
- `GuestInviteNudge.tsx`: nagłówek „Dodano „X” do składu ✓” także przy rezerwie; „Zaproś
  go do Bojo i zautomatyzuj zarządzanie” (język marketingu); punkt „Powiadomienia
  o zmianach terminu i odwołaniu” (prawdziwy dopiero po założeniu konta albo podaniu
  adresu),
- `EventDetailClient.tsx:3687` (pasek nad składem u organizatora): „Po założeniu konta
  **dołączą do ekipy** i dostaną powiadomienie o kolejnym meczu”.

**Rozwiązanie.**

1. `lib/guestClaim.ts` — nowa sygnatura (stara usunięta, wywołania poprawione):

   ```ts
   export interface KontekstZaproszenia {
     naRezerwie: boolean;
     /** Mecz już się odbył — zaproszenie to prośba o konto, nie o sprawdzenie zapisu. */
     poMeczu: boolean;
     /** Mecz płatny i przyjmuje BLIK — wtedy link odsłoni numer godzinę przed meczem. */
     blik: boolean;
   }

   export function tekstZaproszeniaGoscia(
     imieGoscia: string, e: DaneDoUdostepnienia, k: KontekstZaproszenia, ktoZaprasza?: string,
   ): string
   ```

   Treść (bez długiego myślnika; `kto` = „{Imię} zapisał(a) Cię” albo „Ktoś zapisał Cię”):

   - **przed meczem, skład:**
     ```
     Cześć {imię}! {kto} na mecz „{tytuł}” ({kiedy}, {HH:MM}).
     Pod tym linkiem masz swój zapis, bez zakładania konta:
     • skład, miejsce i koszt{ oraz numer do BLIKA godzinę przed meczem},
     • „Nie mogę grać”, gdyby coś wypadło: miejsce przejdzie na kolejną osobę.
     ```
   - **przed meczem, rezerwa:** pierwsza linia „{kto} na listę rezerwową meczu …”, druga
     „Gdy zwolni się miejsce, zobaczysz to pod tym linkiem, bez zakładania konta:”,
     punkty: „skład i Twoje miejsce w kolejce”, „„Nie mogę grać”, jeśli już nie chcesz
     czekać”,
   - **po meczu:**
     ```
     Cześć {imię}! Dzięki za mecz „{tytuł}” ({kiedy}).
     Jeśli chcesz grać dalej, załóż konto (30 sekund, Google albo e-mail):
     • {KORZYSCI_KONTA[0]},
     • {KORZYSCI_KONTA[1]},
     • {KORZYSCI_KONTA[2]}.
     ```
     Lista importowana z `content/kontoGoscia.ts` — jedno źródło z oknem po zapisie,
     stroną wpisu i mailem `zaloz_konto`.
   - `navigator.share({ title })`: „Twój zapis na mecz” przed meczem, „Zaproszenie do
     Bojo” po meczu.

   `udostepnijZaproszenieGoscia(imie, token, event, k, ktoZaprasza)` — przekazuje `k`.
   Wywołania (5): dwa w `ParticipantsList` (`EventDetailClient.tsx` ~278, ~322), dwa
   w składzie organizatora (~3798, ~3947), `handleZaprosGosciaPoMeczu` (~1979) oraz
   `GuestInviteNudge`. `naRezerwie` z `p.isReserve`, `poMeczu` z `resultsAvailable`
   (ten sam próg co karta „Po meczu”), `blik` z `event.costGrosze > 0 &&
   event.acceptedPaymentMethods.includes('blik')`.

2. Etykieta przycisku przy gościu **przed meczem**: „Zaproś do Bojo” → „Wyślij link do
   zapisu” (`skopiowanyToken` → „Skopiowano link” bez zmian). Po meczu (karta „Po
   meczu” i wiersze składu przy `resultsAvailable`) zostaje „Zaproś do Bojo”.

3. `GuestInviteNudge.tsx`:
   - nagłówek: `naRezerwie ? 'Dodano „X” na listę rezerwową' : 'Dodano „X” do składu ✓'`
     (znika dopisek „Komplet, na rezerwę” — mówi to nagłówek),
   - zamiast „Zaproś go do Bojo i zautomatyzuj zarządzanie” + trzy punkty:
     „Wyślij mu link do jego zapisu. Bez zakładania konta sprawdzi tam skład i koszt,
     a jeśli coś wypadnie, sam się wypisze i miejsce przejdzie na kolejną osobę.”,
   - przycisk: „Wyślij link do zapisu”; podpis pod nim bez zmian; „Dodaj kolejnego” bez zmian.

4. `EventDetailClient.tsx:3687` — zdanie w pasku: „…kliknij „Wyślij link do zapisu”
   przy imieniu: zobaczą tam skład i koszt, a jeśli coś wypadnie, sami się wypiszą.”
   (po meczu: „kliknij „Zaproś do Bojo” przy imieniu: z kontem zapiszą się na kolejny
   mecz jednym kliknięciem.”). Zdanie o e-mailach (pogrubione) bez zmian.

5. `DopiszGoscia.tsx`, podpis: „Z adresem e-mail dostanie potwierdzenie
   i przypomnienia; bez adresu powiadom go sam.” → „Z adresem e-mail dostanie
   potwierdzenie i przypomnienie. Bez adresu wyślij mu link do zapisu.” (PR-N dopisze
   „…: poda tam adres sam”.)

**Testy.**
- nowy `__tests__/zaproszenieGoscia.test.ts`: (a) żaden wariant nie zawiera „ekip”,
  „otwart”, „własnych gier”; (b) rezerwa nie zawiera „Masz miejsce w składzie”;
  (c) po meczu zawiera dosłownie każdą pozycję `KORZYSCI_KONTA`; (d) `blik: false` nie
  wspomina BLIK-a; (e) brak „—” (U+2014) w każdym wariancie.
- `kontoGoscia.test.ts` bez zmian (dalej pilnuje maila).
- zrzuty: modal po dopisaniu i pasek nad składem → `zrzuty:zaakceptuj` po obejrzeniu.

### Z-6. Numer BLIK dla gracza bez wybranego sposobu płatności

**Zobaczone (kod).** `components/events/TwojaPlatnosc.tsx:38`:

```ts
const pokazBlik = metoda === 'blik' && (!!blikTelefon || blikPozniej);
```

Gość dopisany przez organizatora ma `payment_method = NULL` (okno „Dopisz osobę bez
konta” nie pyta o sposób). Baza (`podejrzyj_wpis_goscia`, `163`) oddaje mu numer BLIK
godzinę przed meczem — warunek `blik_dotyczy` nie patrzy na `payment_method` — ale karta
go **nie pokazuje**, a wiersza „Sposób” też nie ma. Gość widzi „Do zapłaty 20,00 zł”
i nic więcej. Ten sam przypadek dla gracza z kontem bez wybranej metody.
Dodatkowo `PrzejmijClient.tsx:330`: „Wróć tu przed meczem po numer BLIK: link do tej
strony masz też w mailu.” — pokazuje się tylko przy `metoda === 'blik'` i obiecuje mail
osobom, które adresu nie podały.

**Rozwiązanie.**
1. `TwojaPlatnosc` — nowy prop `metodyMeczu: PaymentMethod[]` (akceptowane przez mecz):
   ```ts
   const blikWGrze = metoda === 'blik' || (!metoda && metodyMeczu.includes('blik'));
   const pokazBlik = blikWGrze && (!!blikTelefon || blikPozniej);
   ```
   Gdy `!metoda && metodyMeczu.length > 0`: wiersz „Sposób” pokazuje akceptowane
   sposoby złączone „ albo ” (np. „Gotówka albo BLIK”).
2. Wywołania: strona meczu (`event.acceptedPaymentMethods`, dwa miejsca ~2726 i ~2748)
   i `PrzejmijClient` (`podglad.metodyPlatnosci`).
3. `PrzejmijClient` — zdanie nad kartą: warunek `blikPozniej && (metoda === 'blik' ||
   (!metoda && metody.includes('blik')))`; treść „Wróć tu przed meczem po numer BLIK.”
   W PR-N, gdy `maEmail`, dopisek „Link do tej strony masz też w mailu.”

**Testy.** `__tests__/twojaPlatnosc.test.tsx`: metoda `null` + mecz z BLIK-iem → wiersz
BLIK („zobaczysz na godzinę przed meczem” / numer); metoda `null` + mecz tylko gotówka →
brak BLIK, „Sposób: Gotówka”; metoda `gotowka` + mecz z BLIK-iem → brak BLIK (bez zmian).

---

## 4. PR-N — gość sam zostawia e-mail pod swoim linkiem (Z-5)

**Zobaczone.** Wszystkie 29 wpisów dopisanych przez organizatora w 60 dni jest bez adresu.
Pole „E-mail znajomego (opcjonalnie)” jest w oknie organizatora — organizator zwykle
nie zna adresu kolegi z WhatsAppa i nie będzie o niego pytał. Strona wpisu
(`/gracz/przejmij/[token]`) nie ma pola na adres. Skutek: harmonogram mówi „N osób
w składzie nie dostanie żadnej wiadomości od Bojo”, a organizator nie ma czym tego
zmienić poza „powiadom sam”.

**Decyzja projektowa: token jest uprawnieniem (jak przy wypisaniu, `128`, i ofercie,
`137`), ale adres można ustawić tylko RAZ.** Kto ma link, może podać adres, jeśli go nie
ma. Nadpisać istniejącego nie może — link, który wyciekł, nie przekieruje cudzego kanału.
Pomyłkę w adresie poprawia organizator (usuń i dopisz ponownie) — rzadkie, świadomie
odpuszczone.

### Migracja `168_gosc_zostawia_email.sql` (numer: kolejny wolny w chwili merge'a)

```sql
-- 168: gość dopisany przez organizatora sam podaje e-mail pod linkiem swojego
-- zapisu (Z-5, docs/faza1-runda10-plan.md).
--
-- DLACZEGO. Organizator dopisuje ludzi ręką („Dopisz osobę bez konta”) i zwykle
-- nie zna ich adresów: na produkcji 29 z 29 takich wpisów z 60 dni nie ma
-- e-maila, więc nie dostają ani potwierdzenia, ani „jutro grasz”, ani
-- wiadomości o odwołaniu. Organizator może im wysłać link do zapisu — od tej
-- migracji zostawią tam adres sami, bez zakładania konta.
--
-- Token jest uprawnieniem (wzorzec 128/137). Adres ustawia się TYLKO, gdy go nie
-- ma: link, który wyciekł, nie może przekierować istniejącego kanału.
--
-- Podgląd wpisu dostaje `ma_email` (sam FAKT, nie treść — adres od 127 nie wychodzi
-- przez API), żeby strona wiedziała, czy pokazać pole.

DROP FUNCTION IF EXISTS podejrzyj_wpis_goscia(uuid);
CREATE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  -- 23 kolumny z 163 — bez zmian, w tej samej kolejności
  ...,
  -- Nowe od 168.
  ma_email boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- ciało z 163 1:1 (CTE `w` wybiera już p.*), w SELECT na końcu:
  --   ..., (w.blik_dotyczy AND NOT w.blik_juz), (w.guest_email IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION ustaw_email_goscia(p_token uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id    uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  -- Ten sam wzorzec co EMAIL_RE w frontend/src/lib/validation.ts.
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'Podaj poprawny adres e-mail.' USING ERRCODE = '22023';
  END IF;

  UPDATE event_participants p
     SET guest_email = v_email
    FROM events e
   WHERE p.claim_token = p_token
     AND e.id = p.event_id
     AND p.is_guest AND p.user_id IS NULL AND p.claimed_at IS NULL
     AND p.guest_email IS NULL
     AND e.status <> 'cancelled'
     AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw')
  RETURNING p.id INTO v_id;

  IF v_id IS NULL THEN RETURN false; END IF;

  -- Potwierdzenie od razu: sprawdza adres i mówi gościowi, co go czeka
  -- (trzy warianty treści: skład / rezerwa / poczekalnia, `tresc.ts`, powód `zapis`).
  -- Wyzwalacz 133 reaguje wyłącznie na INSERT, więc wołamy wprost.
  PERFORM wyslij_mail_do_goscia(v_id, 'zapis');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION ustaw_email_goscia(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION ustaw_email_goscia(uuid, text) TO anon, authenticated;
```

Skaner ryzyka: `DROP FUNCTION` + `CREATE` + `UPDATE` w **ciele** funkcji (pomijane) →
**bezpieczna**, jedzie sama przy merge'u (po Z-0). Po dodaniu: `node
scripts/build-db-bundles.mjs` i commit wyniku.

**Do sprawdzenia przy implementacji (nie decyzja, tylko weryfikacja):** wyzwalacze
`UPDATE` na `event_participants` (`\d+ event_participants` na `baza-testowa.sh
--zostaw`) — zmiana samej `guest_email` nie może odpalić powiadomień o składzie.
Oczekiwanie: wyzwalacze składu są na `UPDATE OF is_reserve, …`; jeśli któryś jest na
całe `UPDATE`, test w `poczta-goscia.sql` (niżej) to złapie liczbą wierszy w
`notifications`.

### Front

1. `lib/guestClaim.ts`:
   - `PodgladWpisuGoscia.maEmail: boolean` z `row.ma_email ?? true` — **zapas `true`**:
     bez migracji pole się nie pokaże (inaczej formularz wołałby funkcję, której nie ma),
   - `export async function ustawEmailGoscia(token: string, email: string): Promise<boolean>`
     — `validateEmail()` z `lib/validation.ts` przed RPC; błąd RPC → `throw new
     Error(error.message)`.
2. `app/gracz/przejmij/[token]/PrzejmijClient.tsx` — nowy blok **pod kartą meczu, nad
   „Twoja płatność”**, gdy `!podglad.maEmail && podglad.moznaZmieniac &&
   podglad.statusMeczu !== 'cancelled' && !podglad.juzPrzejety`:
   - nagłówek (`text-sm font-semibold`): „Przypomnienie na e-mail”,
   - opis (`text-xs text-slate-600`): „Zostaw adres, a dzień przed meczem przypomnimy Ci
     o nim. Napiszemy też, gdyby mecz się zmienił albo odwołał. Konto nie jest potrzebne.”,
   - `input type="email" inputMode="email" autoComplete="email"` pełnej szerokości,
     `h-11`, pod nim `Button` pełnej szerokości „Zapisz adres”; od `sm:` w jednym rzędzie
     (`sm:flex sm:gap-2`, input `sm:flex-1`, przycisk `sm:w-auto`),
   - sukces → blok zamienia się na zielony wiersz „Gotowe. Potwierdzenie wysłaliśmy na
     podany adres.”, `maEmail` w stanie lokalnym → `true`,
   - `false` z RPC (ktoś w międzyczasie podał adres albo mecz się zaczął) → „Nie udało
     się zapisać adresu. Odśwież stronę.” i przeładowanie podglądu.
   Gdy `podglad.maEmail`: jedna linia `text-xs text-slate-500` pod kartą meczu:
   „Przypomnienie i wiadomości o zmianach przyjdą na e-mail podany przy zapisie.”
   Mobile-first, zero `max-*:`.
3. Zdania, które PR-N domyka:
   - `tekstZaproszeniaGoscia` (Z-4), przed meczem: trzeci punkt „• przypomnienie dzień
     przed na e-mail, jeśli zostawisz adres.”,
   - `DopiszGoscia.tsx`: „…Bez adresu wyślij mu link do zapisu: poda tam adres sam.”,
   - `HarmonogramMeczu.tsx`, `bez_wiadomosci`: „N osób w składzie nie dostanie żadnej
     wiadomości od Bojo. Wyślij im link do zapisu: zostawią tam e-mail.” (przycisk
     „Pokaż kogo” bez zmian),
   - `PrzejmijClient` (Z-6): dopisek „Link do tej strony masz też w mailu.” tylko przy
     `maEmail`.

### Testy PR-N

- `supabase/test/poczta-goscia.sql` (leci w `baza-testowa.sh`): gość bez adresu, mecz
  jutro → `ustaw_email_goscia` = `true`, `guest_email` ustawione (małymi literami),
  wiersz `maile_wyslane` z powodem `zapis`; drugie wywołanie z innym adresem → `false`,
  adres bez zmian; mecz rozegrany → `false`; mecz odwołany → `false`; wpis z kontem →
  `false`; `'x@y'` → wyjątek; liczba wierszy w `notifications` przed i po — bez zmian.
- `supabase/test/rls.sql`, sekcja tokenu gościa: `SET ROLE anon`, zmyślony token →
  `false`; `podejrzyj_wpis_goscia` dla zmyślonego tokenu → zero wierszy (już jest).
- `__tests__/platnoscGoscia.test.ts`: mapowanie starego kształtu (brak `ma_email`) →
  `maEmail === true`.
- nowy `__tests__/emailGoscia.test.tsx` (render `PrzejmijClient` z mockiem
  `podejrzyjWpisGoscia`, wzorem `zaproszenieDoEkipy.test.tsx`): pole jest przy
  `maEmail: false`, nie ma przy `true`, nie ma przy odwołanym i po starcie; zły adres →
  komunikat bez wywołania RPC.

---

## 5. PR-O — wiadomość dochodzi także bez pusha (Z-1, Z-2)

### Z-1. Poczta do kont jako zapas, gdy nie ma pusha

**Zobaczone.** Migracja `140` wysyła mail do konta wyłącznie przy odwołaniu, zmianie
terminu, zmianie warunków i przywróceniu meczu — świadomie, bo „poczta przy byle czym
przestaje być czytana”. To była dobra decyzja przy założeniu, że reszta dochodzi pushem.
Liczby mówią, że nie dochodzi: 3/33 graczy i 2/9 organizatorów ma push. Konsekwencje,
każda wprost sprzeczna z tym, co mówi aplikacja:

| Co Bojo mówi | Gdzie | Co się dzieje u 9/10 kont |
|---|---|---|
| „Przypomnienie pójdzie do składu automatycznie, ok. 18:00. Ty wyślij tylko link.” | panel „Mecz gotowy” | wiersz pod dzwonkiem; 5/12 przeczytanych, mediana 19,5 h |
| „Dzień po meczu przypomnimy Ci o wyniku i rozliczeniu.” | „Co Bojo zrobi za Ciebie” | 1/4 przeczytane, po 2,6 doby |
| „Organizator zaprosi Cię na następny termin, a Ty dostaniesz powiadomienie” | okno po zapisie, strona wpisu, mail `zaloz_konto` | 7/13 zaproszeń nieprzeczytanych |
| „Zwolni się miejsce? Pierwsza osoba z rezerwy ma 3 godz. na decyzję.” | harmonogram | gość z adresem dostaje mail „Zwolniło się miejsce”, gracz z kontem — nic poza dzwonkiem, więc okno mija i miejsce idzie dalej |

Gość bez konta z adresem dostaje „jutro grasz” i ofertę mailem (`133`/`137`). **Założenie
konta pogarsza więc dostarczalność** — odwrotność argumentu, którym organizator ma
przekonywać ekipę do kont.

**Rozwiązanie (wariant A, rekomendowany — decyzja D-10).** Cztery istniejące typy
dostają pocztę **wyłącznie wtedy, gdy konto nie ma żadnej subskrypcji push**. Push
zostaje kanałem podstawowym; mail jest zapasem, nie drugą kopią.

| Typ | Do kogo | Dlaczego mail |
|---|---|---|
| `przypomnienie_o_meczu` | skład i organizator | obietnica z panelu „Mecz gotowy”; gość dostaje to samo mailem |
| `reserve_claim_offered` | jedna osoba z rezerwy | ma termin (domyślnie 3 h); gość dostaje to samo mailem |
| `zaproszenie_na_mecz` | imiennie zaproszeni (m.in. F-5) | domyka pętlę „co tydzień ta sama ekipa” bez WhatsAppa |
| `po_meczu_do_domkniecia` | organizator, raz | przypomnienie o rozliczeniu (6/30 płatnych meczów rozliczonych) |

Świadomie **bez**: `prosba_o_dolaczenie` (organizatorzy czytają w 2 min), `komplet_skladu`,
`wiadomosc_w_*`, `nowy_mecz_w_grupie` (wariant B w D-10), `sklady_opublikowane`.

**Bezpiecznik dzienny.** Resend w darmowym planie przepuszcza 100 maili dziennie
**łącznie z mailami logowania** (SMTP Supabase idzie przez ten sam klucz — README
`powiadom-goscia`, „SMTP dla Supabase”). Mail zapasowy nie może zjeść linku do logowania.
Dla czterech nowych powodów funkcja wychodzi cicho, gdy `maile_wyslane` z bieżącej doby
ma już `limit_dzienny` wierszy (domyślnie **80**, zmienialne wpisem w
`konfiguracja_poczty`). Cztery powody krytyczne (`140`) limitu nie mają.

#### Migracja `169_poczta_do_kont_bez_pusha.sql` (numer: kolejny wolny)

```sql
-- 169: poczta do konta jako ZAPAS, gdy konto nie ma pusha (Z-1,
-- docs/faza1-runda10-plan.md).
--
-- DLACZEGO. 140 wysyła mail do konta tylko przy odwołaniu/zmianach, zakładając,
-- że resztę doniesie push. Na produkcji push ma 3 z 33 graczy i 2 z 9
-- organizatorów (60 dni). Przypomnienie dzień przed czytało 5 z 12 osób,
-- mediana po 19,5 h; 7 z 13 zaproszeń nie przeczytano wcale. Gość bez konta
-- z adresem dostaje te same rzeczy mailem (133/137) — konto pogarszało
-- dostarczalność.
--
-- CO. Cztery istniejące typy dostają mail WYŁĄCZNIE bez subskrypcji push.
-- Żadnego nowego typu. Cztery powody z 140 bez zmian (zawsze mail).
-- Bezpiecznik dzienny dla nowych powodów: limit Resend jest wspólny z mailami
-- logowania.

CREATE OR REPLACE FUNCTION wyslij_mail_do_konta(p_user UUID, p_powod TEXT, p_event UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_url TEXT; v_sekret TEXT; v_email TEXT; v_imie TEXT; v_w RECORD;
  v_limit INT; v_tresc TEXT; v_oferta_do TEXT;
  v_krytyczny BOOLEAN := p_powod IN ('mecz_odwolany','zmiana_terminu','zmiana_warunkow_meczu','mecz_przywrocony');
BEGIN
  -- [1:1 z 142: konfiguracja, mail_wylaczone, e-mail i imię z auth.users]

  IF NOT v_krytyczny THEN
    SELECT CASE WHEN wartosc ~ '^[0-9]+$' THEN wartosc::int END INTO v_limit
      FROM konfiguracja_poczty WHERE klucz = 'limit_dzienny';
    IF (SELECT count(*) FROM maile_wyslane
         WHERE created_at >= date_trunc('day', now())) >= coalesce(v_limit, 80) THEN
      RETURN;
    END IF;
  END IF;

  SELECT e.id, e.title, e.sport, e.event_date, e.event_time, e.organizer_id,
         coalesce(e.field_name, e.custom_location_name) AS miejsce, e.cost_grosz,
         e.notatka_odwolania
    INTO v_w FROM events e WHERE e.id = p_event;
  IF v_w.id IS NULL THEN RETURN; END IF;

  IF NOT v_krytyczny THEN
    -- Treść z dzwonka — jedno źródło zdania (np. „brakuje 2 (12/14)” u organizatora).
    -- Wyzwalacz jest AFTER INSERT, więc wiersz już jest widoczny.
    SELECT n.body INTO v_tresc FROM notifications n
     WHERE n.user_id = p_user AND n.event_id = p_event AND n.type = p_powod
     ORDER BY n.created_at DESC LIMIT 1;
  END IF;

  IF p_powod = 'reserve_claim_offered' THEN
    SELECT to_char((p.claim_offered_at
             + (coalesce((SELECT reserve_claim_minutes FROM events WHERE id = p_event), 180)
                || ' minutes')::interval) AT TIME ZONE 'Europe/Warsaw', 'DD.MM, godz. HH24:MI')
      INTO v_oferta_do
      FROM event_participants p
     WHERE p.event_id = p_event AND p.user_id = p_user AND p.claim_offered_at IS NOT NULL
     LIMIT 1;
  END IF;

  -- [INSERT do maile_wyslane z unique_violation → RETURN, 1:1 z 142]

  PERFORM net.http_post(url := v_url, headers := …, body := jsonb_build_object(
    -- pola z 142 bez zmian, plus:
    'organizator', (v_w.organizer_id = p_user),
    'tresc',       v_tresc,
    'oferta_do',   v_oferta_do
  ));
EXCEPTION WHEN OTHERS THEN RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION wyslij_mail_po_powiadomieniu()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.type IN ('mecz_odwolany', 'zmiana_terminu', 'zmiana_warunkow_meczu', 'mecz_przywrocony') THEN
    PERFORM wyslij_mail_do_konta(NEW.user_id, NEW.type, NEW.event_id);
  ELSIF NEW.type IN ('przypomnienie_o_meczu', 'reserve_claim_offered', 'zaproszenie_na_mecz', 'po_meczu_do_domkniecia')
    AND NOT EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = NEW.user_id) THEN
    PERFORM wyslij_mail_do_konta(NEW.user_id, NEW.type, NEW.event_id);
  END IF;

  RETURN NEW;
END;
$$;
```

`REVOKE EXECUTE … FROM anon, authenticated` jak w `140`. Skaner: podmiana funkcji →
bezpieczna. Martwa subskrypcja push (`send-push` kasuje ją po 404/410) — pierwsze
powiadomienie po jej śmierci nie dojdzie żadnym kanałem, kolejne pójdzie mailem;
akceptowalne, zapisane w komentarzu migracji.

#### Funkcja brzegowa `powiadom-goscia/tresc.ts`

`Powod` += `'przypomnienie_o_meczu' | 'reserve_claim_offered' | 'zaproszenie_na_mecz' |
'po_meczu_do_domkniecia'`; `Dane` += `organizator?: boolean`, `tresc?: string | null`.
Wszystkie cztery kończą się `zamkniecie(d, cfg)` (odbiorca ma konto → „Zobacz mecz”
+ link do wyłączenia maili w `/profil`).

| Powód | Temat | Bloki |
|---|---|---|
| `przypomnienie_o_meczu`, gracz | `Jutro grasz: {tytuł}` | „Jutro masz mecz:”, karta, „Nie dasz rady? Wypisz się w Bojo jak najszybciej, żeby ktoś zdążył wejść na Twoje miejsce.” |
| `przypomnienie_o_meczu`, `organizator` | `Jutro Twój mecz: {tytuł}` | „Jutro organizujesz mecz:”, karta, akapit `tresc` (stan składu z dzwonka), gdy jest |
| `reserve_claim_offered` | `Zwolniło się miejsce: {tytuł}` | jak `oferta`, ale przycisk „Wchodzę? Potwierdź w Bojo” → `/wydarzenia/{id}` |
| `zaproszenie_na_mecz` | `Zaproszenie na mecz: {tytuł}` | akapit `tresc` (kto zaprasza), karta |
| `po_meczu_do_domkniecia` | `Po meczu: {tytuł}` | akapit `tresc` („Mecz rozegrany. …”), karta, przycisk „Otwórz mecz” |

**Kolejność wdrożenia ma znaczenie:** funkcja brzegowa **przed** migracją. Odwrotnie
funkcja dostanie nieznany powód, `tresc()` zwróci `null`, a `maile_wyslane` i tak zapisze
„wysłane” — mail przepadnie po cichu (ta sama pułapka co w README funkcji, krok 4).
Droga: commit zmian w `supabase/functions/powiadom-goscia/**` na gałąź
`claude/funkcje/runda10` (wyzwalacz „Wdróż funkcje brzegowe”), dopiero potem merge PR-O.

#### Front

1. `lib/ustawieniaPowiadomien.ts`: `RODZAJE_MAILOWE` → dwie listy
   `RODZAJE_MAILOWE_ZAWSZE` (4 z `140`) i `RODZAJE_MAILOWE_BEZ_PUSHA` (4 nowe);
   `RODZAJE_MAILOWE` = suma (dla zgodności wywołań). `rodzajeMailowe()` bez zmian
   semantycznie (zwraca 8).
2. `UstawieniaMaili.tsx`: podpis „Wysyłamy je tylko wtedy, gdy niedojście wiadomości
   kosztowałoby Cię wyjazd na boisko” → „Odwołanie i zmiany zawsze. Przypomnienie,
   zaproszenie i zwolnione miejsce tylko wtedy, gdy nie masz powiadomień na telefonie.”
   Lista w dwóch grupach z nagłówkami `text-xs font-semibold text-slate-500`:
   „Zawsze” / „Gdy nie masz powiadomień na telefonie”.
3. Zdania, które przestają być nieprawdą, **zostają bez zmian** („Przypomnienie pójdzie
   do składu automatycznie”, „Dzień po meczu przypomnimy Ci…”). Jedna korekta:
   `konsekwencjeOdwolania()` mówi dziś „dostanie powiadomienie w Bojo (i na telefon,
   jeśli je włączyła)”, a od `140` idzie też mail → „…dostanie powiadomienie w Bojo
   i e-mail.” (dokładność, nie nowa obietnica).

#### Testy Z-1

- `supabase/test/poczta-do-kont.sql`: (a) konto bez pusha, `przypomnienie_o_meczu` →
  wiersz `maile_wyslane`; (b) konto z wierszem w `push_subscriptions` → brak wiersza;
  (c) `mecz_odwolany` z pushem → wiersz jest (bez zmian); (d) `mail_wylaczone` zawiera
  typ → brak; (e) 80 wierszy dziś w `maile_wyslane` → nowy powód pominięty,
  `mecz_odwolany` przechodzi; (f) `limit_dzienny = '5'` działa; (g) `reserve_claim_offered`
  niesie `oferta_do` (sprawdzone przez podmienione `net.http_post` — wzorzec z pliku).
- `__tests__/ustawieniaPowiadomien.test.ts`: czyta **ostatnią** definicję
  `wyslij_mail_po_powiadomieniu` ze wszystkich `supabase/migrations/*.sql` (wzorzec
  `harmonogramMeczu.test.ts`), porównuje oba `IN (…)` z dwiema listami; test „wszystkie
  mailowe są ważne” zawężony do `RODZAJE_MAILOWE_ZAWSZE`.
- `__tests__/mailePowiadomien.test.ts`: dla czterech nowych powodów `doTekstu()`
  i `doHtml()` niepuste, zawierają link do `/wydarzenia/{id}` i do `/profil`; wariant
  organizatora przypomnienia zawiera `tresc`; brak „—” w nowych szablonach.

### Z-2. Propozycja pusha dla organizatora

**Zobaczone.** `zaproponujPowiadomienia()` woła wyłącznie `handleJoin` (zapis gracza).
Organizator, który założył mecz, nigdy nie widzi zachęty, chyba że znajdzie przełącznik
w profilu.

**Rozwiązanie.**
1. `ZachetaPush.tsx` — prop `organizator?: boolean`. Treść dla organizatora:
   nagłówek „Damy znać, gdy ktoś poprosi o miejsce”, opis „Prośba o dołączenie,
   komplet w składzie i przypomnienie o rozliczeniu po meczu.” Reszta (odłożenie na
   30 dni, iOS → pasek instalacji, warstwa) bez zmian.
2. `EventDetailClient.tsx`:
   - `widoczna={!!user && (!!myParticipation || isOwner) && !eventStarted && !isCancelled}`,
     `organizator={isOwner}`,
   - `handleShare` — po wyniku `'shared' | 'copied'`, gdy `swiezoUtworzony && isOwner`:
     `zaproponujPowiadomienia()`. **Po** wysłaniu linku, nie od razu: główna akcja panelu
     „Mecz gotowy” nie konkuruje z paskiem.

**Testy.** `__tests__/zachetaPush.test.tsx` (nowy): zdarzenie + `organizator` → treść
organizatora; bez zdarzenia → nic. Klikalność: `e2e/*.klikalnosc.spec.ts` — pasek
nie zasłania „Wyślij link znajomym” (test przez `click({ trial: true })` po wywołaniu
zdarzenia).

### Z-1a. Strażnik dziennego limitu Resend (decyzja D-11)

**Po co.** Właściciel zostaje na darmowym planie Resend (100 maili/dzień, wspólne
z mailami logowania — patrz README `powiadom-goscia`), a Z-1 dokłada cztery nowe powody
wysyłki. Bezpiecznik `limit_dzienny` (domyślnie 80) w `wyslij_mail_do_konta()` chroni przed
przekroczeniem, ale **cicho** — organizator/właściciel nie dowiaduje się, że limit został
dobity, dopóki ktoś nie zapyta „czemu nie przyszedł mail”. To jest dokładnie ten sam wzorzec
ryzyka, co brak strażnika `pg_cron` przed PR-H: cisza jako jedyny sygnał awarii.

**Rozwiązanie.** Nowy krok w `.github/workflows/zdrowie-produkcji.yml` (ten sam job,
ta sama zasada „zielono z adnotacją, gdy brak sekretu”), uruchamiany razem z pg_cron
(17:00 UTC — po godzinie szczytu wysyłek, bliżej końca doby):

```yaml
      - name: Sprawdź dzienny limit poczty
        if: always()
        env:
          DB_URL_PROD: ${{ secrets.SUPABASE_DB_URL_PROD }}
        run: |
          set -euo pipefail
          if [ -z "${DB_URL_PROD:-}" ]; then
            echo "SUPABASE_DB_URL_PROD nie jest ustawiony — pomijam." | tee /tmp/poczta.txt
            exit 0
          fi
          ADRES="$(DB_URL="$DB_URL_PROD" ./scripts/sprawdz-adres-bazy.sh SUPABASE_DB_URL_PROD)"
          WYNIK="$(psql "$ADRES" -v ON_ERROR_STOP=1 --single-transaction --pset=pager=off \
            -c 'SET TRANSACTION READ ONLY' -tA -c "
              SELECT count(*) FROM maile_wyslane WHERE created_at >= date_trunc('day', now());
            ")"
          echo "Dziś wysłano (zapisano w maile_wyslane): $WYNIK / 100 (plan darmowy Resend)." | tee /tmp/poczta.txt
          # 70 = próg ostrzegawczy: 70% dziennego limitu Resend, nie samego `limit_dzienny`
          # aplikacji (80) — chcemy sygnał, ZANIM organizator poczuje bezpiecznik na sobie.
          if [ "$WYNIK" -ge 70 ]; then
            echo "✗ Blisko dziennego limitu Resend — czas rozważyć płatny plan albo podnieść limit_dzienny." | tee -a /tmp/poczta.txt
            exit 1
          fi
```

Krok drugi dopisuje się do tego samego „Podsumowanie” (`GITHUB_STEP_SUMMARY`) obok
wyniku pg_cron — jedna czerwona plakietka na workflow, nie dwie osobne rzeczy do
sprawdzania. Próg `70` jest liczbą w kodzie workflowu, nie w bazie — zmiana progu to
edycja pliku, nie migracja.

**Gdy się zaświeci:** dwie opcje bez zmiany kodu — (1) podnieść `limit_dzienny` w
`konfiguracja_poczty` (jeśli Resend już jest na płatnym planie), (2) przejść na płatny
plan Resend i dopiero wtedy podnieść `limit_dzienny`. Kolejność ma znaczenie: podniesienie
`limit_dzienny` bez zmiany planu Resend przywróci realne ryzyko ucięcia maili logowania.

**Testy.** Bez testu jednostkowego (czysty workflow, jak reszta `zdrowie-produkcji.yml`).
Sprawdzone ręcznie po wdrożeniu: `workflow_dispatch` na produkcji, odczyt kroku w Actions.

---

## 6. PR-K (Z-7) — przeniesione z rundy 9

Zakres i rozwiązanie bez zmian względem [faza1-runda9-plan.md §5](./faza1-runda9-plan.md)
(decyzja D-7 A). Dwie korekty wynikające z czasu:

- numer migracji: **kolejny wolny po PR-O** (w tym planie `170`), bo `165` jest niższy
  niż zastosowane `166` i `migruj.sh` zgłosi rozjazd kolejności,
- zapadka w `check:docs` obejmuje migracje **od numeru PR-K** oraz
  `supabase/functions/**` — w tym szablony dodane w PR-O (już bez „—”, więc zapadka
  przejdzie od pierwszego dnia).

---

## 7. Świadomie poza zakresem

| Pomysł | Dlaczego nie teraz |
|---|---|
| Mail o każdej prośbie o dołączenie do organizatora | 9/10 przeczytanych, mediana 2 min — kanał działa |
| SMS jako zapas | `SHOW_SMS_FEATURES` wyłączone, koszt i decyzja produktowa |
| Odświeżanie podglądu linku w komunikatorach | bufor po stronie WhatsAppa/Facebooka, poza naszą kontrolą |
| Poprawa adresu e-mail przez gościa | świadomie „tylko raz” (bezpieczeństwo linku); organizator usuwa i dopisuje |
| Wymuszenie sposobu płatności przy „Dopisz osobę bez konta” | dokłada pole do okna, które ma być szybkie; Z-6 rozwiązuje skutek |
| Monit organizatora o rozliczenie inną drogą niż mail | najpierw zmierzyć efekt Z-1 na 6/30 |
| `nowy_mecz_w_grupie` mailem | wariant B decyzji D-10 |

---

## 8. Zasady wspólne dla PR-M/N/O/K

- **Mobile-first**: style bazowe 320–375 px, rozszerzenia wyłącznie `sm:`/`md:`; zero
  `max-*:` i `@media (max-width…)` (`check:docs`, sekcja 10).
- **Kolory**: nic nowego; żaden element nie sięga po `pink-*`/`blue-*`/`orange-*`.
- **Bez długiego myślnika** w treści dla użytkownika (sekcja 11); nowe szablony maili też.
- **Nowe typy powiadomień**: żaden. **Nowe flagi**: żadna.
- Przed każdym commitem (`frontend/`): `npx tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build` (atrapy kluczy), z katalogu głównego `npm run check:docs`; przy PR-N
  i PR-O dodatkowo `./scripts/baza-testowa.sh` i `node scripts/build-db-bundles.mjs`.
- **Przejście w przeglądarce przed otwarciem PR-a** na `./scripts/stos-bez-dockera.sh`
  (telefon 390 px i 320 px, `Europe/Warsaw`): PR-M — obrazek `/wydarzenia/{id}/opengraph-image`
  dla 1/2/5 wolnych, odwołanego, zamkniętego; modal po dopisaniu gościa na rezerwę;
  PR-N — strona wpisu gościa: podanie adresu, drugi raz, po starcie; PR-O — w bazie
  stosu `maile_wyslane` po `SELECT wyslij_przypomnienia()` dla konta bez pusha.
- Zmiany widoczne dla użytkownika → `docs/llm-context.md` („Ostatnie zmiany”, limit 10,
  najstarszy wpis usunąć; znacznik „Stan na” przy PR-N/O) + `npm run sync:llm-context`.
- Dokumentacja per PR: PR-M — `docs/funkcje.md` („Zapis na mecz bez logowania”,
  „Udostępnianie meczu”); PR-N — `docs/baza-danych.md` (wiersz migracji), `docs/domena.md`
  (reguła „token ustawia adres raz”), `docs/funkcje.md` („Poczta do gościa”); PR-O —
  `docs/baza-danych.md`, `docs/funkcje.md` („Powiadomienia”, tabela kanałów),
  `supabase/functions/powiadom-goscia/README.md` (tabela „Co dokładnie wychodzi”).
- Zmiany wyglądu → wzorce przez `zrzuty:zaakceptuj` po obejrzeniu raportu.
- Migracja w PR → wprost w opisie PR-a i w odpowiedzi: bezpieczna, jedzie sama przy
  merge'u **pod warunkiem Z-0**.

---

## 9. Decyzje dla właściciela

**Rozstrzygnięte 2026-09-28.** Poniżej pytania w brzmieniu, w jakim były zadane,
z odpowiedzią.

- **D-9 (Z-0).** Kliknąć teraz `167` na produkcji (Actions → Migracje → Run workflow →
  produkcja)? **Rekomendacja: tak**, przed PR-N. → **Zrobione, ale inną drogą**:
  właściciel wkleił treść migracji wprost w Supabase SQL Editorze zamiast puścić ją przez
  workflow. Skutek sprawdzony zapytaniami (§2): tabele i kolumna zniknęły, migracja
  faktycznie poszła. Jedyny ślad tego wyboru: `schema_migracje` nie ma wiersza dla `167` —
  nieszkodliwe, bo `167` jest w całości idempotentna (`IF EXISTS`), więc dziennik dogoni
  się sam przy najbliższym uruchomieniu workflow „Migracje” (pierwszy kandydat: PR-N).
- **D-10 (Z-1).** Poczta do konta jako zapas: **(A)** cztery typy (przypomnienie, oferta
  z rezerwy, zaproszenie, „po meczu”), tylko bez pusha, z bezpiecznikiem 80/dobę;
  **(B)** jak A + `nowy_mecz_w_grupie`; **(C)** jak A, ale mail zawsze, także przy pushu;
  **(D)** nic, zostaje decyzja z `140`. **Rekomendacja: A.** → **Decyzja: A.**
- **D-11 (Z-1).** Plan Resend: czy konto jest na planie darmowym (100/dzień, 3000/mies.)?
  Jeśli tak, bezpiecznik 80 zostaje; jeśli płatny, podnosimy `limit_dzienny` wpisem
  w bazie (bez migracji). → **Decyzja: zostajemy na darmowym planie na razie**, ale
  dokładamy **widoczny strażnik** (nowa pozycja **Z-1a**, §5): codzienne ostrzeżenie
  w workflow „Zdrowie produkcji”, gdy dzienna wysyłka zbliża się do limitu Resend —
  wtedy przełączamy plan i/albo podnosimy `limit_dzienny`.
- **D-12 (Z-5).** Gość może podać adres pod linkiem **tylko, gdy go nie ma** (rekomendacja)
  czy także go **zmienić**? → **Decyzja: tylko raz** (rekomendacja), bez zmian.
- **D-13 (Z-3).** Linia „Zapis bez zakładania konta” **na obrazku** podglądu (rekomendacja:
  tak) czy wyłącznie w opisie tekstowym? → **Decyzja: tak, na obrazku** (rekomendacja),
  bez zmian.

---

## 10. Szkice opisów PR-ów (po polsku)

### PR-M: Podgląd linku, zaproszenie gościa i płatność mówią prawdę

**Po co.** Trzy miejsca, w których człowiek z linku organizatora dostaje zdanie, które nie
jest prawdą: podgląd na WhatsAppie („2 wolnych miejsc”, wolne miejsca przy odwołanym
meczu, brak „bez konta”), wiadomość do gościa dopisanego ręcznie (obietnice ekipy
i otwartych gier, „masz miejsce w składzie” przy rezerwie, link przedstawiony jako
zakładanie konta) i karta płatności, która dopisanemu gościowi nie pokazuje numeru BLIK.

**Co się zmienia.**
- Podgląd linku: poprawna odmiana, stan meczu (odwołany, rozegrany, zapisy zamknięte,
  komplet z rezerwą), „Zapis bez zakładania konta”, neutralny tytuł dla meczu prywatnego.
- Zaproszenie gościa: trzy warianty (skład, rezerwa, po meczu), mówi, co link daje bez
  konta; przycisk „Wyślij link do zapisu”; poprawiony modal po dopisaniu i pasek nad
  składem.
- „Twoja płatność”: numer BLIK i akceptowane sposoby także bez wybranej metody.

**Migracja.** Brak.

### PR-N: Gość sam zostawia e-mail pod linkiem do swojego zapisu

**Po co.** Osoby dopisane ręcznie przez organizatora (29 z 29 w ostatnich 60 dniach bez
adresu) nie dostawały od Bojo nic: ani przypomnienia, ani wiadomości o odwołaniu.

**Co się zmienia.** Strona wpisu gościa ma pole „Przypomnienie na e-mail”; adres ustawia
się raz, potwierdzenie przychodzi od razu. Harmonogram i okno dopisywania podpowiadają
organizatorowi, żeby wysłał link.

**Migracja.** `168_gosc_zostawia_email.sql` — nowa funkcja `ustaw_email_goscia`,
podgląd wpisu dostaje `ma_email`. Bezpieczna, **jedzie na produkcję sama przy merge'u**,
o ile `167` jest już kliknięta.

### PR-O: Przypomnienie, zaproszenie i zwolnione miejsce dochodzą także bez powiadomień na telefonie

**Po co.** Push ma 3 z 33 graczy z kontem. Przypomnienie dzień przed czytało 5 z 12 osób,
7 z 13 zaproszeń nie przeczytano. Gość z e-mailem był lepiej poinformowany niż gracz
z kontem.

**Co się zmienia.** Cztery istniejące powiadomienia idą mailem wyłącznie do kont bez
pusha, z bezpiecznikiem dziennym (limit Resend jest wspólny z mailami logowania).
Ustawienia maili w profilu w dwóch grupach. Organizator dostaje propozycję włączenia
powiadomień po wysłaniu linku do nowego meczu. Workflow „Zdrowie produkcji” ostrzega,
gdy dzienna wysyłka zbliża się do limitu darmowego planu Resend.

**Migracja.** `169_poczta_do_kont_bez_pusha.sql` — podmiana dwóch funkcji, bezpieczna.
**Funkcję brzegową `powiadom-goscia` trzeba wdrożyć PRZED merge'em** (gałąź
`claude/funkcje/runda10`).
