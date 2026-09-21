# Analiza GTM — wrzesień 2026

> Przegląd wielopoziomowy z perspektywy CEO/CTO/GTM, robiony **na kodzie**, nie na
> deklaracjach. Stan repo: `4dfd729` (2026-09-20), 156 migracji, 83 547 linii
> w `frontend/src`, 119 plików testowych, 407 PR-ów.
>
> Status tego dokumentu jest taki sam jak [rewizji 2026-08](./rewizja-2026-08.md):
> **sąd zewnętrzny do konfrontacji, nie ustalenie zespołu.** Tam, gdzie rozjeżdża się
> z [PRZESŁANKĄ STRATEGICZNĄ w BACKLOG.md](../BACKLOG.md#przesłanka-strategiczna-2026-08-15--czytaj-przed-planowaniem),
> obowiązuje przesłanka — ale rozjazd jest wtedy sam w sobie informacją i jest tu
> nazwany wprost.

---

## Streszczenie w pięciu zdaniach

1. Inżynieria jest na poziomie, którego nie spotyka się w projektach dwuosobowych przed
   startem; to jest atut i **jednocześnie źródło głównego ryzyka**.
2. Jedyny kanał, który w tej chwili produkuje mierzalny ruch (17 473 stron w indeksie,
   116 kliknięć/tydzień), **nie jest kanałem, wokół którego zbudowana jest strategia** —
   i do 2026-09-16 nie był w ogóle mierzony.
3. Mechanizm z pre-mortemu opisany jako „Q1 2027: budowanie zastępuje sprzedawanie"
   **już nastąpił, cztery miesiące przed terminem** — 11,4% całego kodu to moduł
   turniejowy zbudowany i wyłączony w cztery dni.
4. Nie istnieje ani jedna metryka odpowiadająca na pytanie, od którego zależy cała teza
   biznesowa: **ilu organizatorów robi drugi mecz**.
5. Blokady startu nie są dziś techniczne, tylko **prawno-organizacyjne** (brak podmiotu,
   brak ustaleń właścicielskich) — i są jedynymi pozycjami na tej liście, których nie da
   się rozwiązać kodem.

---

## POZIOM 0. Co ten kod mówi o zespole

### Co jest zrobione lepiej niż u większości firm po rundzie A

To nie jest kurtuazja przed krytyką, tylko inwentarz aktywów, których nie wolno
zmarnować przy zmianie priorytetów.

| Rzecz | Dlaczego to jest rzadkie |
|---|---|
| `supabase/test/rls.sql` — testy polityk przez `SET ROLE` i `request.jwt.claim.sub` | RLS jest w Bojo **jedyną** realną granicą (klucz `anon` jest jawny w paczce JS). Testowanie jej od strony bazy, a nie przez UI, robi ułamek zespołów. Sekcja „ZNANE, ŚWIADOMIE OTWARTE" pilnuje stanu faktycznego zamiast pamięci. |
| Bramka zrzutów dzieląca padnięcia na „wygląd" i „zachowanie" (`.github/bramka-scenariuszy.mjs`) | Powstała po realnym PR #306, gdzie zmiana wyglądu została zaklasyfikowana jako zepsute zachowanie. Naprawa jest **strukturalna** (`zeSprzataniem()`), nie punktowa. |
| Wzorzec migracji odpornej na drugie uruchomienie (`118`) | Odpowiedź na „migracja puszczona w połowie" — klasa błędów, którą większość zespołów odkrywa dopiero po awarii produkcji. |
| `npm run check:docs` w CI + hook doc-guard | Dokumentacja, która nie może po cichu odjechać od kodu. Dziewięć deterministycznych sprawdzeń, każde powstałe po realnym rozjeździe. |
| `content/zakazaneFrazy.ts`, plakietka `wczesnyEtap: true`, `CZYM_BOJO_NIE_JEST` | **Zinstytucjonalizowana uczciwość w copy.** Karta obiecująca społeczność renderuje się wyciszona, bo społeczności jeszcze nie ma. To jest realny atut sprzedażowy wobec pierwszych 50 organizatorów, nie ozdoba. |
| Rewizja 2026-08 i pre-mortem | Bardzo niewiele zespołów dobrowolnie zamawia zarzut przeciw własnej wizji i **zapisuje odpowiedź, której nie chce usłyszeć**. |
| Semantyka kolorów (różowy/niebieski/pomarańczowy, rezerwacja znaczeń) | Dojrzałość systemu projektowego na poziomie produktu z działem designu. |

Faza 0 ze [strategia.md §6](./strategia.md#6-roadmapa-fazowa) jest **domknięta**, wbrew
temu, co tam jeszcze stoi: środowisko dev istnieje (gałąź `dev`, migracje workflowem,
produkcja po kliknięciu, PR #385), domena zweryfikowana w Resend, kanał pocztowy żyje od
2026-09-10, `pg_cron` potwierdzony zapytaniem, push zweryfikowany 2026-09-02. Ten
rozdział `strategia.md` jest przeterminowany i wprowadza w błąd przy planowaniu.

### Diagnoza centralna

**Zdolność wytwarzania wyprzedziła zdolność uczenia się od rynku o rząd wielkości.**

Dowody, wszystkie z repo:

- 235 commitów i ~50 PR-ów w samym wrześniu.
- **9 503 linie (11,4% całego `frontend/src`) to moduł turniejowy**: migracje `145`–`156`,
  cztery etapy plus A/B/C, cztery dokumenty projektowe, osobny seed z pulą 60 kont.
  Zbudowany 13–16 września, **wyłączony 17 września** — `SHOW_TURNIEJE = false`, powód
  w komentarzu: „pierwsze wrażenie jeszcze nie jest gotowe dla kogoś z ulicy".
- [Rewizja 2026-08](./rewizja-2026-08.md) §4(b) pkt 3 i §4(c) mówiła wprost: turniej do
  skasowania z kodu w całości, „turniej dla społeczności, której nie ma, to wystawa
  pustej sali". Stary turniej został skasowany (migracja `151`) i **w tym samym miesiącu
  odbudowany w wersji cztery razy większej**.

To nie jest zarzut o złą jakość tamtego kodu — jest dobry. To jest obserwacja, że
mechanizm opisany w pre-mortemie jako Q1 2027:

> „Motywacja szuka ujścia w robocie, która daje postęp bez konfrontacji z płaską krzywą.
> Budowanie zastępuje sprzedawanie, bo budowanie jest przyjemne, a rozmowa z dwudziestą
> ekipą, która nie chce się przenieść z Messengera — nie."

**zadziałał w Q3 2026 i został udokumentowany przez ten sam zespół, który go przewidział.**
Wyłączenie flagi trzy dni po zbudowaniu jest tego najczystszym dowodem: moduł został
doprowadzony do końca, obejrzany na żywo i uznany za niegotowy dla obcego — czyli
konfrontacja z rynkiem nastąpiła **po** czterech dniach budowania, a nie przed.

Nie ma tu winy. Jest wzorzec, który przy tej prędkości wytwarzania powtórzy się w
październiku, jeśli nie postawi się przed nim bramki.

---

## POZIOM 1. GTM — kanał, który działa, nie jest kanałem ze strategii

### Twarde liczby

Z [seo-geo-strategia.md §7a.2](./seo-geo-strategia.md), pomiary właściciela w Search Console:

| Data | Zaindeksowane | Kliknięcia | Wyświetlenia | CTR | Poz. |
|---|---|---|---|---|---|
| 2026-08-29 | 2 | 0 (3 mies.) | 56 | 0% | 9,4 |
| 2026-09-05 | 59 | — | — | — | — |
| 2026-09-14 (7 dni) | — | **116** | **8 733** | 1,3% | 7,5 |
| 2026-09-15 | **17 473** | — | — | — | — |

Oraz, z komentarza w `lib/analytics.ts`: **980 z 1000 stron zbierających wyświetlenia to
`/boisko/*`**.

### Co z tego wynika, a nie jest zapisane w żadnym dokumencie strategicznym

[strategia.md §0](./strategia.md) mówi: priorytet to **pozyskiwanie organizatorów**,
kanał — ręczny outreach na Facebooku (Jan). [outreach-organizatorzy.md](./outreach-organizatorzy.md)
opisuje ten kanał w szczegółach: kwalifikacja, cztery warianty wiadomości, obsługa
obiekcji. Jest to dobry playbook.

Tymczasem **jedyny kanał produkujący dziś mierzalny wolumen powstał jako efekt uboczny
importu OSM** i w żadnym dokumencie nie jest traktowany jako kanał pozyskania. Katalog
boisk figuruje w wizji jako propozycja wartości („wszystkie obiekty w jednym miejscu"),
a w strategii jako pozycja SEO. Faktycznie jest to **działający biznes programmatic SEO
z 17 tysiącami stron**, do którego przychodzi 116 obcych ludzi tygodniowo i krzywa rośnie.

Do 2026-09-16 nie było na tym ruchu **ani jednego pomiaru**. Komentarz w `analytics.ts`
nazywa to uczciwie: „o 116 osobach tygodniowo wiedzieliśmy tyle, że kliknęły w Google,
i ani słowa o tym, co zrobiły dalej".

### Niuanse branżowe, których nie widzę w dokumentach

**1. CTR 1,3% przy pozycji 7,5 to wynik około dwukrotnie poniżej benchmarku.**
Dla long-taila nawigacyjnego (nazwa własna obiektu) pozycja 7–8 powinna dawać 2,5–4%.
Przy 8 733 wyświetleniach różnica między 1,3% a 3% to ~150 dodatkowych wejść tygodniowo
— czyli **podwojenie ruchu bez ani jednego nowego linku i bez jednej nowej strony**.
Dźwignia siedzi w tytule i snippecie, czyli w `metaWyszukiwarki.ts` / `opisObiektu.ts`,
i jest najtańszą rzeczą do poprawy w całym repo. Hipoteza do sprawdzenia: tytuł jest
generyczny („Nazwa | Bojo"), a człowiek szukający „orlik rataje" chce wiedzieć **czy
jest czynne, ile kosztuje, czy jest oświetlone** — snippet, który odpowiada na to
w pierwszych 120 znakach, wygrywa klik z mapą Google.

**2. 0,5 wyświetlenia na stronę na tydzień oznacza, że indeks jest szeroki i płytki.**
17,5 tys. stron zbiera 8,7 tys. wyświetleń. Większość stron jest zaindeksowana, ale nie
rankuje. To jest normalne dla świeżego programmatic i nie jest problemem samo w sobie —
ale znaczy, że **wzrost przyjdzie z pogłębienia pojedynczych stron, nie z dokładania
kolejnych**. Decyzja „nie zmniejszamy indeksu" (§4c, odrzucone 2026-08-25) jest do
utrzymania; decyzja o dokładaniu kolejnych regionów — nie.

**3. Dane OSM to nie jest fosa. UGC nad nimi — tak.**
Każdy konkurent może zaimportować ten sam plik PBF w weekend. Jedyną obroną jest warstwa,
której nie da się skopiować: potwierdzenia obiektu z kworum (`lib/potwierdzeniaObiektu.ts`),
komentarze, rozegrane mecze z datą. Repo już to ma i §4c sam nazywa tę pętlę
(„indeks zaczyna rosnąć wtedy, gdy rośnie aktywność" — linie 1048–1050). **To jest
najlepszy pomysł strategiczny w całej dokumentacji i jest zakopany w odrzuconym
podrozdziale audytu SEO.** Powinien być osią strategii katalogu, nie przypisem.

**4. Nazwa kolidująca z rzeczownikiem pospolitym to problem marki, nie SEO.**
„bojo" = potocznie „boisko". Dokument SEO traktuje to jako problem pozycjonowania
(§2c) i ma rację co do diagnozy, ale nie co do kategorii. Konsekwencje są szersze:
marka nie do wygooglowania, poczta pantoflowa dwuznaczna („wejdź na bojo" ≠ adres),
zero kliknięć na zapytanie markowe potwierdzone pomiarem. **Koszt ewentualnej zmiany
nazwy jest dziś w historycznym minimum** (zerowy kapitał marki, 17 tys. stron do
przekierowania 301, brak użytkowników do przeszkolenia) i rośnie z każdym tygodniem.
Nie rekomenduję zmiany — rekomenduję **świadome zamknięcie tej decyzji z datą**, bo
niepodjęta zamyka się sama i na niekorzyść.

### Działanie o najwyższej dźwigni w całym repo

`SHOW_GAME_ALERTS = true` od 2026-09-12. Alert („powiadom mnie, gdy ktoś tu zagra") to
przechwycenie popytu bez zobowiązania: e-mail, zero rejestracji, buduje listę strony
popytowej i karmi dokładnie ten problem „pustej półki", na którym odpadają Tomek i Paweł
z rewizji.

Jego **jedyne wejście** to dziś pusta lista na `/wydarzenia` (potwierdzone w `features.ts`
i `AGENTS.md`).

Czyli: 116 obcych ludzi tygodniowo ląduje na `/boisko/*`, mechanizm przechwycenia ich
popytu jest zbudowany, włączony i postawiony na stronie, na którą oni nie wchodzą.

To jest jedna zmiana, jeden komponent, zero migracji.

### Druga rzecz: `/boisko/[id]` jest ułożone jak wizytówka katalogu, nie jak strona lądowania

Kolejność sekcji w `VenueDetailClient.tsx` (987 linii):

```
h1 → zdjęcie → pobliskie obiekty → linki → karta obiektu → REZERWACJA (3 warianty)
→ podsumowanie AI → nadchodzące mecze → [880] „Zorganizuj tutaj" → opis → OSM
```

Jedyna realna konwersja stoi w linii 880 z 987, **pod trzema sekcjami rezerwacji
funkcji wyłączonej flagą**.

Ale naiwna naprawa („CTA na górę") byłaby błędem i warto to powiedzieć wprost.
Człowiek wchodzący z zapytania „orlik rataje" ma intencję **informacyjną** (gdzie, jaka
nawierzchnia, czy oświetlone, czy otwarte), a nie „chcę zorganizować mecz". Wepchnięcie
mu najtrudniejszej roboty w produkcie w pierwszym ekranie obniży i konwersję, i czas na
stronie, i pozycję.

Właściwa konstrukcja to **drabina intencji**:

1. Zaspokój intencję informacyjną w pierwszym ekranie (to już jest, `opisObiektu()` jest
   dobry — problem to kolejność pod nim).
2. Zaproponuj akcję **zgodną z intencją stania na stronie boiska**, czyli alert
   („daj znać, gdy ktoś tu zagra") — zobowiązanie zerowe, konwersja na adres e-mail.
3. Dopiero pod tym „Zorganizuj tutaj" — dla mniejszości, która przyszła z intencją
   organizatorską.
4. Sekcje rezerwacji wyłączonej funkcji zejść pod CTA albo ukryć, gdy nie ma
   `bookingEnabled`. Dziś obiecują wyszukiwarce i człowiekowi coś, czego nie ma —
   ta sama klasa błędu co naprawiony P2.

---

## POZIOM 2. Pętla wzrostu

### Co jest dobrze

Klucz do pętli — **przejęcie profilu gościa** — jest zbudowany (PR #104, migracja `066`),
a kanał doręczenia żyje od 2026-09-10. To była rekomendacja #1 rewizji i została wykonana.
Asymetria kosztu konta (konto zakłada wyłącznie organizator, gracz podaje imię i e-mail)
jest poprawnym klinem i jest poprawnie sprzedawana w `outreach-organizatorzy.md §2`.

### Czego brakuje

**Nikt nie zna konwersji `guest_joined` → `guest_claimed`.**

Oba zdarzenia istnieją w `AnalyticsEvent`. Żadne nie jest liczone w `/admin/analityka`
(panel pokazuje: aktywni dziś/7/30, logowania, mecze utworzone, dołączenia, grupy,
źródła ruchu z katalogu — 383 linie, zero kohort).

To jest liczba, od której zależy odpowiedź na pytanie, czy Bojo jest **narzędziem**
(wzrost liniowy, organizator po organizatorze, sufit = ile osób Jan zaczepi na FB)
czy **siecią** (wzrost składany, każdy gość staje się kolejnym potencjalnym organizatorem).
Rewizja nazwała to wprost w „Czego nie wiem" pkt 1. **Od sierpnia nikt tego nie policzył**,
mimo że zapytanie jest jednolinijkowe i mimo że przez ten czas powstało 12 migracji
turniejowych.

### Metryka, której nie ma, a jest ważniejsza od wszystkich, które są

**Odsetek organizatorów, którzy robią DRUGI mecz.**

Cała teza biznesowa brzmi: „organizator przyprowadza 10–14 osób". Organizator, który
zrobił jeden mecz i nie wrócił, nie przyprowadził nikogo — przyprowadził jednorazową
grupę, która nie ma powodu wracać. Ta metryka jest **definicją aktywacji** dla tego
produktu i nie jest liczona nigdzie.

Panel pokazuje „Mecze utworzone / 7 dni" — czyli licznik, który rośnie tak samo, gdy
dziesięciu organizatorów zrobi po jednym meczu (biznes martwy) i gdy jeden zrobi
dziesięć (biznes żywy). Te dwa stany są nierozróżnialne w obecnej analityce.

---

## POZIOM 3. Monetyzacja

### Co jest zrobione dobrze i warto to nazwać

BLIK jako **numer telefonu przekazywany między ludźmi** (`event_blik`, migracja `120`),
a nie przepływ pieniędzy przez Bojo, to trafna decyzja i trzeba ją utrzymać tak długo,
jak się da. Konsekwencje, których nie widzę zapisanych, a które są tu istotne:

- Bojo **nie jest** w tej konstrukcji dostawcą usług płatniczych, nie potrzebuje wpisu
  do rejestru KNF (MIP/KIP), nie ma obowiązków AML ani obsługi chargebacków.
- Moment, w którym pieniądz przepłynie przez konto Bojo (prowizja od rezerwacji, zbiórka
  za halę), jest momentem, w którym pojawia się albo licencjonowany PSP jako merchant of
  record (Przelewy24 / Tpay / Stripe), albo status agenta rozliczeniowego. To nie jest
  integracja na sprint — to jest kwartał z prawnikiem.
- Wniosek: peer-to-peer BLIK to **cecha, nie ograniczenie**. `FEATURE_RESERVATIONS`
  z prowizją jest najdroższą regulacyjnie ścieżką monetyzacji i jednocześnie tą, która
  wymaga drugiej strony rynku (obiekty), której audyt nie znalazł (56 maili na 1484
  obiekty, część fałszywa).

### Zarzut wobec sekwencji monetyzacji

[strategia.md §6](./strategia.md#6-roadmapa-fazowa) stawia monetyzację w Fazie 3, „gdy
jest trakcja". To jest standardowa rada i dla większości produktów słuszna. Dla tego —
z zastrzeżeniem, bo wizja mówi wprost, że **głównym miernikiem sukcesu jest cel
finansowy**, a nie liczba użytkowników.

Jeśli miernikiem jest gotowość do zapłaty, to odkładanie pierwszego pytania o pieniądze
do Fazy 3 odkłada też **jedyny twardy test wartości**, jaki istnieje. Przy tym tempie
budowania grozi to rokiem pracy pod założeniem, którego nikt nie sprawdził.

Kogo warto zapytać o pieniądze, a kogo nie:

- **NIE gracza.** Gracz dostaje darmowy zamiennik Messengera. Zero gotowości.
- **NIE obiektu.** Wymaga drugiej strony rynku i sprzedaży B2B, której nie ma kto robić
  w tym kwartale.
- **TAK organizatora.** On już płaci — za halę, z własnej kieszeni, z góry, i potem
  ściga czternaście osób po 20 zł. Jego ból jest finansowy i powtarzalny. Jest ich mało,
  więc da się z każdym porozmawiać osobiście. To dokładnie ten profil, dla którego
  powstały `priceForParticipant()`, `event_blik`, panel rozliczeń i „Wyślij rozliczenie
  ekipie".

Konkretnie: nie cennik na stronie, tylko **płatny pilot „organizator założyciel"** — 5–10
osób, kwota rzędu 15–25 zł/mies., sprzedany w rozmowie, z obietnicą dożywotniej ceny.
Cel nie jest przychodowy. Celem jest odpowiedź na pytanie, czy ktokolwiek wyjmie
portfel — a tej odpowiedzi nie zastąpi żadna liczba rejestracji.

---

## POZIOM 4. Prawne i organizacyjne — jedyne prawdziwe blokady startu

### Podmiot i administrator danych

`frontend/src/lib/legal.ts`:

```ts
operator: 'zespół Bojo',
contactEmail: 'bojopolska@gmail.com',
lastUpdated: 'sierpień 2026',
```

Brak nazwy podmiotu, adresu i NIP-u. Przy wpuszczaniu ludzi na produkt, który przetwarza
imiona, adresy e-mail, geolokalizację, zdjęcia, numery telefonu (BLIK) i dane o
aktywności fizycznej, to jest:

- **RODO art. 13** — administrator musi być zidentyfikowany z nazwy i adresu. „Zespół
  Bojo" nie jest administratorem w rozumieniu przepisu. Obowiązek informacyjny jest
  niespełniony niezależnie od tego, jak dobra jest reszta polityki.
- **UŚUDE art. 5** — usługodawca podaje dane identyfikujące w regulaminie.
- **Adres na Gmailu** jako jedyny kontakt usługodawcy: problem zaufania (organizator
  oddaje dane swojej ekipy), a dodatkowo niepotrzebny — `bojo.pl` jest zweryfikowane
  w Resend od 2026-09-10, `kontakt@bojo.pl` jest dostępny dziś.

Polityka prywatności jest przy tym **lepsza, niż się spodziewałem**: Supabase nazwany
jako podmiot przetwarzający, region `eu-central-1` Frankfurt, deklaracja o nieopuszczaniu
EOG, tabela ciasteczek. Braki w tej samej polityce:

- **Nie wymieniono pozostałych podprocesorów**: Vercel (hosting i logi), Resend (poczta),
  SMSAPI/Twilio (SMS), Google (OAuth). Każdy z nich przetwarza dane osobowe. Lista
  podprocesorów jest obowiązkowa, a umowy powierzenia (DPA) wszyscy trzej udostępniają
  standardowo.
- **Zero przepisów o małoletnich.** Sport amatorski to szesnastolatkowie na orliku. RODO
  art. 8 w polskiej implementacji stawia granicę na 16 lat. Potrzebne jest albo stanowisko
  w regulaminie, albo bramka wieku. Dziś nie ma ani jednego, ani drugiego.
- **Reputacja gracza to profilowanie i powierzchnia zniesławienia.** `reliabilityPct()`,
  znaczek „rzetelny gracz", `player_reports` — publiczny profil pokazujący odsetek
  nieobecności imiennej osoby jest twierdzeniem o niej. Potrzebne: stanowisko w
  regulaminie, ścieżka sprostowania, i `noindex` (ten ostatni **jest już zrobiony** —
  `/gracz/` w `DISALLOW`, decyzja opisana jako prywatnościowa, nie SEO; to był dobry ruch).
- **ODbL** — BACKLOG ma pozycję „dopiąć". Przy produkcie komercyjnym zbudowanym na 30
  tysiącach rekordów OSM pytanie o share-alike dla bazy pochodnej jest realne, nie
  teoretyczne. Atrybucja na stronie obiektu jest, to dobry start. Godzina u prawnika
  zamyka temat.

### Ustalenia założycielskie — najwyższe nieobsłużone ryzyko w całym projekcie

[strategia.md §7](./strategia.md#7-podział-ról) zawiera sekcję „⚠️ Do ustalenia (ważne
wcześnie, nie później)": własność i equity, zaangażowanie czasowe, definicja sukcesu na
3 i 6 miesięcy, budżet.

Sekcja nosi datę 2026-06-05. Jest **2026-09-21**. 407 PR-ów, 156 migracji, 83 tysiące
linii kodu i 17 tysięcy stron w indeksie Google później — **żadna z tych czterech rzeczy
nie jest ustalona.**

To jest większe ryzyko niż cokolwiek technicznego na tej liście, z trzech powodów:

1. Wartość już powstała i rośnie. Im dłużej trwa brak ustalenia, tym trudniejsza
   rozmowa — bo wkłady przestają być symetryczne i każdy pamięta je inaczej.
2. Nierównowaga wkładu jest widoczna w repo: 235 commitów miesięcznie po jednej stronie,
   rola „biznes/growth" po drugiej, której produktów (rozmowy z organizatorami, pozyskane
   ekipy) w repo nie widać — co nie znaczy, że ich nie ma, ale znaczy, że nie ma ich
   czym zmierzyć przy tej samej rozdzielczości.
3. Pre-mortem przewiduje dokładnie ten rozpad: „Q2 2027. Jan dostaje projekt, który zjada
   mu wieczory. Franek zostaje sam z aplikacją." Nieustalone equity zamienia takie
   rozejście się w spór zamiast w ustalony scenariusz.

Brak podmiotu prawnego i brak ustaleń właścicielskich to ta sama rozmowa. Warto ją odbyć
raz, z jednym prawnikiem, i zamknąć oba naraz.

---

## POZIOM 5. Konkurencja i pozycjonowanie

Wizja nazywa BallSquad. To jest właściwy konkurent dla fazy „rezerwacje", ale **nie jest
tym, z kim Bojo przegrywa dzisiaj.**

Realny zestaw konkurencyjny, uporządkowany według tego, ile odbiera:

| Kto | O co walczy | Dlaczego wygrywa dziś |
|---|---|---|
| **Grupy FB + Messenger / WhatsApp** | Cała organizacja meczu | Koszt zmiany zero, ludzie już tam są, działa. To jest **ten** konkurent — Marcin i Monika z rewizji odpadają na nim, nie na BallSquadzie. |
| **Google Maps** | Znalezienie boiska | Pełniejsze dane, zaufanie marki. Kuba odpada tutaj. Bojo wygrywa wyłącznie tym, czego Mapy nie mają: **kto tam gra i kiedy**. |
| BallSquad, ZagrajTeraz, Sportowa Polska | Rezerwacja obiektu | Zakontraktowane obiekty. Bojo świadomie nie gra w tę grę — i słusznie. |
| Playarena / ligi amatorskie | Rozgrywka zorganizowana | Inna robota do wykonania (liga, nie gierka). |
| Strava | Tożsamość sportowa | Rewizja poprawnie pokazuje, że analogia jest **odwrócona** (bieganie jest pojedyncze, mecz wymaga dziesięciu skoordynowanych osób). Warto to przenieść do `wizja.md` przy najbliższej świadomej aktualizacji, bo dziś wizja opiera się na analogii, którą własny zespół obalił. |

Konsekwencja dla copy i dla outreachu: jedynym miejscem, gdzie Bojo bije Messengera
bezdyskusyjnie, jest **skutek, nie kanał** — lista, która liczy się sama, rezerwa
z kolejnością i rozliczenie. `outreach-organizatorzy.md §2` trafia w to dokładnie
(„widzisz gotową listę zamiast liczyć w komentarzach"), a `R-11` na landingu wyciąga ten
sam wniosek przy okazji `zakazaneFrazy.ts`. To jest spójne i dobre — trzeba to utrzymać
wobec pokusy sprzedawania „platformy".

---

## POZIOM 6. Sezonowość — czynnik najbardziej niedoszacowany

Dziś jest **21 września**. Sezon zewnętrzny kończy się za 4–6 tygodni.

Pre-mortem boi się Q4 słusznie („zima zamyka orliki i plażówkę, aktywność spada o połowę
z przyczyn czysto sezonowych, ale na wykresie wygląda to jak śmierć produktu"). Ale
wyciąga z tego wniosek obronny, a wniosek jest ofensywny:

**Zima jest sezonem płatnych obiektów — czyli dokładnie tym, w którym Bojo ma najsilniejszą
przewagę.**

- Latem gra się na orliku za darmo. Nie ma czego rozliczać. „Rozliczysz ekipę w minutę"
  nie ma zastosowania.
- Zimą gra się w hali. Hala kosztuje 200–400 zł, rezerwuje się z góry na cały sezon,
  organizator płaci z własnej kieszeni i potem ściga czternaście osób po 20–30 zł.
  **To jest jedyny moment w roku, kiedy główny ból, który Bojo rozwiązuje, faktycznie
  boli.**
- Skład zimowy jest stały (opłacona hala = stała ekipa), czyli to jest kohorta, do której
  push i przypomnienia mają sens — dokładnie ta, którą [PRZESŁANKA STRATEGICZNA](../BACKLOG.md#przesłanka-strategiczna-2026-08-15--czytaj-przed-planowaniem)
  wybrała jako „mięso na start".

Dwie konsekwencje operacyjne:

1. **Outreach do organizatorów ma ruszyć teraz, w ostatnich tygodniach sezonu
   zewnętrznego**, a nie w listopadzie. Organizator hali podejmuje decyzję o sezonie
   we wrześniu/październiku.
2. **Nie wolno mierzyć eksperymentu wzrostowego na oknie październik–grudzień** bez
   korekty sezonowej. Każdy taki pomiar da fałszywy wynik negatywny i — zgodnie z
   pre-mortemem — podetnie morale mocniej niż jakakolwiek awaria.

Warto też z góry przyjąć, że **plażówka wraca w maju** i nie interpretować jej zniknięcia
jako utraty użytkowników.

---

## DZIAŁANIA

Uporządkowane wedle tego, co odblokowuje najwięcej przy najmniejszym koszcie.
Role za [strategia.md §7](./strategia.md#7-podział-ról).

### A. Zatrzymać (dziś, koszt zero, wartość najwyższa)

1. **Moratorium na nowe moduły do czasu, aż istnieje pomiar aktywacji.** Konkretnie:
   żadnej nowej flagi funkcji i żadnej migracji wprowadzającej nową encję domenową,
   dopóki nie ma odpowiedzi na pytanie „ilu organizatorów robi drugi mecz". Turniej
   (9 503 linie, wyłączony) jest dowodem, że bez takiej bramki zdolność wytwarzania
   sama znajdzie sobie ujście.
2. **Nie dokładać regionów do katalogu.** Indeks jest szeroki i płytki; wzrost przyjdzie
   z pogłębienia stron, nie z ich liczby.
3. **Nie odmrażać `FEATURE_RESERVATIONS`.** Brak drugiej strony rynku, najwyższy koszt
   regulacyjny, najdłuższa droga do przychodu.

### B. Zmierzyć (7 dni, Franek, prawie zero kodu)

Pięć zapytań. Wszystkie dane już są w bazie — żadne nie wymaga migracji.

1. **Konwersja gość → konto.** `guest_joined` vs `guest_claimed` w `analytics_events`,
   plus `SELECT count(*) FILTER (WHERE is_guest), count(*) FROM event_participants`.
   Rozstrzyga tezę rewizji (narzędzie vs sieć). Próg z rewizji: >30% gości = teza
   potwierdzona twardo.
2. **Powtarzalność organizatora.** Z użytkowników, którzy utworzyli pierwszy mecz —
   jaki odsetek utworzył drugi w ciągu 14 dni. **To jest definicja aktywacji dla tego
   biznesu.**
3. **Lejek katalogu.** `boisko_otwarte` → `boisko_zorganizuj`, wyłącznie ruch
   `zrodlo != 'wewnetrzne'` (funkcja `konwersjaZKatalogu()` już to liczy — brakuje
   tylko, żeby ktoś na to spojrzał). Dane są od 2026-09-16, czyli jest już tydzień.
4. **Retencja kohortowa W1/W4** po tygodniu rejestracji. Dziś panel pokazuje „aktywni /
   7 dni" — liczbę, która nie odróżnia dziesięciu nowych od dziesięciu wracających.
5. **CTR i pozycja per klaster** w Search Console (Jan) — potwierdzić hipotezę o
   snippetach przed jakąkolwiek zmianą treści.

Wynik tych pięciu liczb wpisać do `BACKLOG.md` jako sekcję pomiarową z datą, tym samym
wzorcem co §7a.2 w dokumencie SEO. **Dopóki ich nie ma, każda decyzja o priorytecie jest
sądem, nie pomiarem** — to zdanie jest cytatem z ich własnego kodu i jest tam od
2026-09-03.

### C. Zbudować (mało, konkretnie — dwa tygodnie)

W kolejności dźwigni:

1. **Alert na stronie boiska.** Wejście do `SHOW_GAME_ALERTS` na `/boisko/[id]`, ze sportem
   i lokalizacją wypełnionymi z obiektu. 116 obcych osób tygodniowo dostaje akcję
   o zerowym zobowiązaniu, zamiast nie dostawać żadnej. Jeden komponent, zero migracji.
2. **Przebudowa kolejności na `/boisko/[id]`** według drabiny intencji z POZIOMU 1: info
   → alert → „Zorganizuj tutaj" → reszta. Sekcje rezerwacji pod CTA albo ukryte bez
   `bookingEnabled`.
3. **Tytuły i snippety obiektów** pod hipotezę „czy czynne, ile kosztuje, czy oświetlone".
   Potencjalnie podwaja ruch bez nowych stron. Mierzyć w GSC 3–4 tygodnie po wdrożeniu.
4. **Kohorty w `/admin/analityka`** — punkty B.1–B.4 na stałe w panelu, żeby liczby
   patrzyły na zespół, a nie zespół na nie raz na kwartał.
5. **Pętla UGC → indeks** (§4c, linie 1048–1050) wyjęta z odrzuconego podrozdziału
   i postawiona jako oś katalogu: potwierdzenia, komentarze i rozegrane mecze podnoszą
   stronę obiektu. To jedyna fosa, jaką ten katalog może mieć.

### D. Poza kodem (Jan i obaj — to jest ścieżka krytyczna)

1. **Podmiot prawny + ustalenia założycielskie, jedną rozmową u jednego prawnika.**
   Spółka albo umowa partnerska, equity, vesting, co się dzieje, gdy jeden odpada.
   Przy okazji: administrator danych z nazwy i adresu do `lib/legal.ts`, ODbL, stanowisko
   wobec małoletnich, lista podprocesorów (Vercel, Resend, SMSAPI, Google), DPA.
   **Jedna rzecz na tej liście, której nie da się zrobić kodem, i jedyna, której koszt
   rośnie z każdym tygodniem zwłoki.**
2. **`kontakt@bojo.pl` zamiast Gmaila** — domena zweryfikowana od 2026-09-10, blokady nie ma.
3. **Outreach do organizatorów hal — teraz, nie w listopadzie.** Playbook jest gotowy
   i dobry. Cel na 6 tygodni: nie „100 użytkowników", tylko **10 organizatorów, którzy
   rozegrali drugi mecz**. Jeden wymierny cel, zgodny z metryką aktywacji z B.2.
4. **Płatny pilot „organizator założyciel"** — 5–10 osób, 15–25 zł/mies., sprzedane
   w rozmowie. Instrument walidacji, nie źródło przychodu.
5. **Decyzja o nazwie, z datą.** Nie rekomenduję zmiany. Rekomenduję świadome zamknięcie
   tematu, bo koszt ewentualnej zmiany jest dziś najniższy w historii projektu i rośnie.
6. **Cotygodniowy sync z jedną liczbą na wierzchu** (B.2), zamiast przeglądu backlogu.
   Backlog ma 87 kilobajtów; liczba ma jedną cyfrę.

---

## Jedno zdanie na koniec

Bojo nie ma problemu z budowaniem i nie miało go nigdy — ma problem z tym, że budowanie
jest jedyną czynnością w tym projekcie, która ma pomiar, historię, testy i bramki CI,
a sprzedawanie nie ma żadnego z tych czterech.
