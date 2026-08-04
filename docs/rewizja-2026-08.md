# Rewizja przed startem — 2026-08

> Wynik przebiegu promptu z [prompt-rewizja.md](./prompt-rewizja.md) (model: Fable).
> Cztery kroki: ludzie → zarzut → pre-mortem → decyzje. Wnioski są sądem modelu,
> nie ustaleniem zespołu — służą do konfrontacji, nie do automatycznego wykonania.

---

## KROK 1: Ośmiu ludzi

**Marcin, 34, kierownik zmiany w Volkswagenie.** Środy 19:00, hala w Luboniu opłacona
na cały sezon, czat na Messengerze od sześciu lat, 14 osób w obiegu. Organizacja to
jeden post „kto gra?" i do czwartku jest komplet. Nic go nie wkurza — system działa.
Dostaje link do Bojo od kolegi. Otwiera stronę meczu, widzi listę z limitem — „ładne".
Widzi, że musi założyć konto, żeby cokolwiek kliknąć, i że musiałby przenieść 14 osób,
z których połowa ledwo ogarnia Messengera. **Odpada w minucie 2** — nie na czymś, co
Bojo robi źle, tylko na rachunku: koszt przeniesienia działającej ekipy jest większy
niż zero, a jego problem ma wartość zero.

**Tomek, 26, programista, trzy miesiące w Poznaniu.** Przeniósł się za pracą, w Wielkopolsce
nie zna nikogo. Grał w Krakowie co tydzień. To jest podręcznikowy idealny użytkownik:
paląca potrzeba, zero alternatyw. Wchodzi z Google na `/wydarzenia`, bo szuka „gdzie grać
w piłkę Poznań". Lista otwartych meczów jest **pusta albo prawie pusta** — bo użytkowników
jeszcze nie ma, a sekcja `LandingOpenGames` filtruje `taken < maxPlayers` i przy braku
gier zwraca `null`. **Odpada w minucie 1** z wnioskiem „martwa aplikacja". Nie zostawia
po sobie śladu — nie ma nawet jak powiedzieć „daj znać, jak coś będzie", bo alerty są
za flagą `SHOW_GAME_ALERTS = false`.

**Aga, 31, księgowa.** Gra w siatkówkę, kiedy koleżanka ją wyciągnie — raz w miesiącu,
może rzadziej. Dostaje link `/d/[kod]` na Messengerze. Otwiera, widzi mecz, klika
„Dołącz" — trzeba się zalogować. Zamyka i odpisuje koleżance „będę" na czacie.
Koleżanka dopisuje ją jako gościa (`allow_guest_adds`). **Aga nigdy nie odpada,
bo nigdy nie wchodzi** — jest obsługiwana przez cudze konto. Z punktu widzenia
organizatorki wszystko działa. Z punktu widzenia Bojo Aga nie istnieje: jest wierszem
`is_guest = true` bez `user_id`. Funkcja gości — słusznie wygodna — **kanibalizuje
rejestrację** dokładnie tej grupy, która miała być siecią.

**Pan Krzysztof, 55, kierownik prywatnej hali przy Głogowskiej.** Ktoś mu wysyła link
do strony jego obiektu w Bojo. Otwiera: nawierzchnia z analizy satelitarnej się nie
zgadza, w sportach jest tenis, którego nie ma, a jako kontakt widnieje — albo nic
(kontakty domyślnie ukryte, migracja `033`), albo dane innego ośrodka (audyt 5.0:
`osrodekrataje@posir.poznan.pl` na obiekcie w Dopiewie). **Odpada w minucie 1** i to
odpadnięcie jest najdroższe ze wszystkich, bo wizja zakłada rozmowę z obiektami
„z pozycji siły" — a pierwsze wrażenie pana Krzysztofa to „amatorzy, mają złe dane
o moim własnym obiekcie". Rezerwacje, które mogłyby go zainteresować, są za flagą.

**Paweł, 29, handlowiec.** Ma ekipę na orlika, 8–10 osób, ale co tydzień brakuje dwóch
i co trzeci tydzień mecz wisi na włosku. To jest drugi podręcznikowy użytkownik — jego
ból jest dokładnie w pierwszym zdaniu wizji. Pierwsze pięć minut przechodzi wzorowo:
zakłada konto, tworzy mecz, upublicznia. **Odpada w tygodniu drugim**, gdy dwa publiczne
mecze z rzędu nie przyciągnęły ani jednej osoby z zewnątrz — bo nie ma skąd. Wraca do
grupy „Poznań — gramy w piłkę" na Facebooku, gdzie post daje trzech chętnych w godzinę,
bo tam SĄ ludzie.

**Kuba, 20, student AWF.** Koszykówka na Chrobrego: przychodzi się na boisko i gra z tymi,
którzy są. Nie ma organizatora, terminu ani limitu miejsc. Model danych Bojo — mecz
o konkretnej godzinie z twardym limitem (`events`, `max_players`) — **nie opisuje jego
rzeczywistości w ogóle**. Jedyna wartość dla niego to mapa: gdzie są kosze z oświetleniem.
Otwiera `/mapa`, filtruje „koszykówka", dostaje wyniki, wśród których są korty tenisowe
(audyt 5.0, pkt 1: sport skażony sąsiedztwem). **Odpada w minucie 3** — narzędzie, które
myli kosz z kortem, nie jest lepsze od Google Maps.

**Monika, 27, projektantka.** Latem organizuje siatkówkę plażową na Rusałce przez grupę
na Facebooku: 30–40 osób w obiegu, zapisy w komentarzach „1. Monika, 2. …", które są
koszmarem do ogarnięcia. Jej ból jest realny i Bojo rozwiązuje go wprost. Pierwsze pięć
minut: zachwyt, tworzy mecz, wrzuca link na grupę. I tu pętla się zacina: **jej ludzie
to trzydzieści Ag** — połowa nie zakłada konta i zapisuje się po staremu w komentarzach.
Monika przez dwa tygodnie prowadzi dwie listy równolegle, po czym wraca do jednej —
tej na Facebooku. **Odpada nie na swoim koszcie, tylko na koszcie swoich zaproszonych.**

**Robert, 43, inżynier.** Niedzielne granie „open" na orliku, zimą hala, którą opłaca
z góry i potem zbiera po 20 zł, co jest jego jedynym realnym bólem. „Rozliczysz ekipę
w minutę" z wizji to zdanie napisane dla niego. Zakłada konto, tworzy mecz z podziałem
kosztów. Po meczu wchodzi rozliczyć — **panel „Podział kosztów" zniknął**, bo renderuje
się pod warunkiem `isOwner && !eventStarted` (luka 1.4), a uczestnicy i tak nigdy nie
widzieli, ile mają zapłacić. **Odpada w dniu pierwszego rozliczenia** — funkcja, dla
której przyszedł, nie działa w jedynym momencie, w którym jest potrzebna.

### Powtarzające się odpadnięcia

1. **Pusta półka publiczna** — Tomek i Paweł, czyli **obaj** użytkownicy z najsilniejszą
   potrzebą. Jeden nie widzi meczów, drugi nie widzi graczy. To jest to samo odpadnięcie
   z dwóch stron tego samego pustego pokoju.
2. **Koszt konta leży po stronie zapraszanych, nie organizatora** — Aga i ludzie Moniki.
   Produkt wymaga rejestracji od osób z najmniejszą motywacją, a jednocześnie daje
   organizatorowi obejście (goście), które sprawia, że ta rejestracja nigdy nie następuje.
3. **Złe dane katalogu niszczą zaufanie w pierwszej minucie** — Krzysztof i Kuba.
   Katalog boisk to jedyna wartość Bojo dostępna bez sieci użytkowników, i właśnie ona
   jest dziś niewiarygodna.

---

## KROK 2: Najmocniejszy zarzut

Centralne założenie wizji brzmi: *„najpierw skojarzenie z organizacją gry, dopiero potem,
z pozycji siły i z realną liczbą zaangażowanych userów za sobą, rozmowa z obiektami"* —
czyli: narzędzie organizacyjne skumuluje użytkowników, a ich masa stanie się dźwignią.

**Teza: narzędzie organizacyjne nie kumuluje użytkowników, bo mecz amatorski jest
strukturalnie prywatny — i Bojo samo to potwierdza każdą swoją funkcją.**

Rozwinięcie w trzech ruchach:

**Po pierwsze, adopcję kontroluje organizator, a organizatorzy dzielą się na tych bez
problemu i tych z problemem nierozwiązywalnym.** Marcin (ekipa działa) nie ma po co
przychodzić — jego koszt zmiany jest dodatni, zysk zerowy. Paweł i Monika (dziurawe
składy) mają dokładnie ten problem, który obiecuje rozwiązać wizja — ale jego rozwiązaniem
jest **sieć graczy, nie funkcja**. Bojo może im dać najlepszą listę zapisów świata,
a oni i tak odejdą, gdy publiczny mecz nie przyciągnie nikogo, bo przyciągać nie ma kogo.

**Po drugie, pętla wzrostu, która miałaby tę sieć zbudować, jest przerwana przez własny
produkt.** Jedyny naturalny strumień nowych ludzi to zaproszeni na mecze znajomych —
trzydzieści Ag Moniki co tydzień. I dokładnie ten strumień Bojo wypuszcza bokiem:
`allow_guest_adds` pozwala obsłużyć zaproszonego bez konta, więc zaproszony kontem
nie kończy. To nie jest bug, to dobrze zaprojektowana wygoda — która sprawia, że
**każda ekipa w Bojo jest wyspą**. Wyspy nie tworzą sieci. Landing dokłada swoje:
sekcja otwartych gier pokazuje wyłącznie mecze z wolnymi miejscami, czyli świeci
pustką tym mocniej, im lepiej produkt działa.

**Po trzecie, analogia ze Stravą — jawnie przywołana w wizji — jest odwrócona.**
Strava działa, bo bieganie jest aktywnością **pojedynczą**: każdy trening każdego
biegacza z osobna staje się publicznym wpisem i buduje graf, nawet gdy biegacz nie zna
nikogo. Mecz drużynowy jest odwrotnością: wymaga dziesięciu skoordynowanych osób,
z których dziewięć przyszło, bo zna dziesiątą. Publiczny mecz z obcymi — fundament
„znajdź grę w 2 minuty" — to w polskim sporcie amatorskim wyjątek, nie norma. Wizja
buduje platformę wokół wyjątku i traktuje normę (zamknięta paczka) jako źródło ruchu,
którym ta norma nie chce być.

Wniosek z tezy: „pozycja siły wobec obiektów" nigdy nie nadejdzie z tej pętli, bo pętla
produkuje wyspy, a nie masę. Jeśli teza jest prawdziwa, to nie znaczy, że Bojo nie ma
sensu — znaczy, że jego jedyną realną walutą na start są **konwersja gościa w gracza**
(bo tylko tam jest naturalny ruch) i **wiarygodny katalog boisk** (bo tylko on ma wartość
przy zerowej sieci). Obie rzeczy są dziś odpowiednio: niezbudowana i zepsuta.

Po napisaniu nie uważam tej tezy za słabą. Jej najsłabszym punktem jest założenie, że
publicznych graczy „nie ma" — grupy FB typu „Poznań — gramy w piłkę" dowodzą, że jacyś
są. Ale to nie ratuje wizji: ci ludzie już mają swoje miejsce i Bojo musi ich stamtąd
**wyjąć**, a nie „skumulować" z powietrza.

---

## KROK 3: Pre-mortem — jak zgasło Bojo

**Q3 2026.** Start publiczny. Pierwsza fala: znajomi i znajomi znajomych, ~40 kont.
Dwie Moniki próbują przenieść swoje ekipy; ich zaproszeni w większości lądują jako
goście bez kont (odpadnięcie 2 z kroku 1). Tygodniowa aktywność stabilizuje się na
kilkunastu osobach — czyli na tych, którzy przyszliby i bez aplikacji. Paweł wystawia
dwa publiczne mecze, zero dołączeń z zewnątrz (odpadnięcie 1), wraca na Facebooka.
Założyciele — obaj po godzinach — interpretują płaską krzywą jako brak funkcji, nie
brak pętli: odmrażają gry cykliczne, budują powiadomienia grup. Metryki nikt nie
wybiera; `analytics_events` zbiera zdarzenia, na które nikt nie patrzy.

**Q4 2026.** Zima zamyka orliki i plażówkę — a plażówka była głównym żywym przypadkiem
(backlog §6 mówi to wprost). Aktywność spada o połowę z przyczyn czysto sezonowych,
ale na wykresie wygląda to jak śmierć produktu, co podcina morale mocniej niż
jakakolwiek awaria. W listopadzie ręcznie wklejana migracja (jedno środowisko, brak
możliwości sprawdzenia stanu bazy z repo — backlog 5.0) rozjeżdża produkcję na pół
dnia. **Nikt tego nie zgłasza** — i to jest gorsza wiadomość niż sama awaria, bo mówi,
ilu ludzi realnie patrzy.

**Q1 2027.** Motywacja szuka ujścia w robocie, która daje postęp bez konfrontacji
z płaską krzywą: czyszczenie katalogu boisk pod „całą Polskę" (backlog 5.0), refaktory,
dokumentacja. Wizja sama daje na to przyzwolenie — „czysta zajawka" jest w niej celem
równoległym do finansowego. Budowanie zastępuje sprzedawanie, bo budowanie jest
przyjemne, a rozmowa z dwudziestą ekipą, która nie chce się przenieść z Messengera —
nie. Ekspansja katalogu na kraj, w którym nie ma ani jednego aktywnego miasta, pochłania
kwartał.

**Q2 2027.** Jan dostaje projekt, który zjada mu wieczory. Franek zostaje sam z aplikacją,
którą realnie żywi jedna ekipa — jego własna. W maju ktoś z tej ekipy nie może się
zapisać, bo nie chce zakładać konta; organizator (Franek) dopisuje go ręcznie jako
gościa i w tym momencie ostatnia różnica między Bojo a arkuszem w Messengerze znika
z pola widzenia jego własnych znajomych.

**Sierpień 2027.** Przy odnowieniu domeny pada pytanie „po co" i nie pada odpowiedź.

**Mechanizm w jednym zdaniu:** pętla wzrostu wymagała konwersji zaproszony → użytkownik,
produkt tę konwersję celowo omijał (goście), więc każda ekipa pozostała wyspą; wyspy
nie zasiliły publicznej półki, pusta półka odrzuciła jedyny segment z palącą potrzebą
(nowi w mieście), a brak jakiegokolwiek ruchu odesłał założycieli w komfort budowania
rzeczy, których nikt nie zobaczył.

**Jeden moment, w którym inna decyzja odwraca bieg:** wrzesień 2026, pierwsza Monika.
Zamiast odmrażać funkcje — zbudować **przejmowanie profilu gościa**: każdy gość dopisany
do meczu dostaje po meczu link „Twoje mecze i statystyki czekają — przejmij profil".
Infrastruktura już istnieje (`added_by`, `player_stats`, historia meczów, znaczek
rzetelnego gracza). Trzydzieści Ag Moniki co tydzień przestaje być stratą, a staje się
lejkiem — jedynym, jaki ten produkt naturalnie ma.

---

## KROK 4: Co budować, czego nie

### (a) Pięć rzeczy do zbudowania

1. **Przejmowanie profilu gościa (claim).** Gość z `added_by` dostaje po meczu link,
   zakłada konto, dziedziczy historię i statystyki. Rozbraja główny mechanizm pre-mortem
   (przerwana konwersja zaproszony → użytkownik); usuwa odpadnięcie Agi i ludzi Moniki.
   Wykorzystuje zbudowane: `event_participants.added_by`, `get_player_stats`, profil
   `/gracz/[id]`.

2. **Powiadomienie członków grupy o nowym meczu (backlog §1.2).** Jedyna rzecz, której
   brakuje, żeby grupa faktycznie zastępowała czat — kanał (`notifications`, Resend)
   istnieje, brakuje wyzwalacza przy `createEvent` z `group_id`. Rozbraja Q3 pre-mortem
   (ekipy nie widzą wartości ponad Messengera); domyka to, po co przyszłaby ekipa Marcina.

3. **Rozliczenie po meczu + widok „ile płacę" dla uczestnika (backlog §1.4).** Zdjęcie
   warunku `!eventStarted` z panelu kosztów i sekcja dla uczestnika licząca przez
   `priceForParticipant()`. Usuwa odpadnięcie Roberta; zamienia fałszywą dziś obietnicę
   „Rozliczysz ekipę w minutę" w prawdziwą.

4. **Naprawa danych boisk w Poznaniu — bez „całej Polski"** (backlog 5.0, punkty 1–5:
   sporty skażone sąsiedztwem, fałszywe kontakty, zepsute adresy, ukrycie nie-boisk,
   bramka publikacji). Usuwa odpadnięcia Krzysztofa i Kuby. Katalog to jedyna wartość
   dostępna przy zerowej sieci — musi być wiarygodny, zanim będzie duży.

5. **Półka publiczna, która nie umie być pusta.** Lista i landing pokazują także mecze
   pełne (oznaczone „komplet") i rozegrane z wynikami — dowód życia zamiast pustki —
   a przy braku meczów w okolicy jedyną akcją jest odmrożony alert `SHOW_GAME_ALERTS`
   („daj znać, jak coś będzie"). Usuwa odpadnięcie Tomka w minucie 1; rozbraja
   „pustą półkę" z Q3.

### (b) Do skasowania z BACKLOG.md

Pozycje cytowane dosłownie; jedno zdanie przy każdej.

1. **„1.1 Trzeci poziom widoczności meczu — «widoczne dla grupy»"** — sekcja „Mecze
   Twoich ekip" (2026-08-03) już pokazuje członkom prywatne mecze grupy, co konsumuje
   90% tej potrzeby bez migracji i nowej polityki RLS.
2. **„1.3 Gry cykliczne ukryte flagą"** — „Powtórz mecz (skopiuj)" pokrywa realny
   przypadek użycia, a ekipy grające co tydzień to segment Marcina, który nie przyjdzie.
3. **„SHOW_CUP | Turniej BOJO Cup"** (§2) — turniej dla społeczności, której nie ma,
   to wystawa pustej sali; wraca, gdy będzie kogo turniejować.
4. **„SHOW_SMS_FEATURES | Potwierdzenie SMS + przypomnienia"** (§2) — SMS kosztuje,
   nikt o niego nie prosił, a przypomnienia załatwi kiedyś web-push.
5. **„FEATURE_RESERVATIONS | Rezerwacje obiektów, panel menedżera"** (§2) — audyt
   wykazał 56 maili na 1484 obiekty, częściowo fałszywych; nie ma drugiej strony tego
   marketplace'u i długo nie będzie.
6. **„`components/home/NearbyGames.tsx`"** (§4) — nierenderowany komponent; jeśli
   punkt (a)5 go potrzebuje, taniej napisać od nowa niż utrzymywać.
7. **„`components/map/{MapView,LeafletMapImpl,EventsMapView,EventsMapImpl}.tsx`"**
   (§4) — cztery pliki martwego kodu z przestarzałą logiką flag.
8. **„Tabela `games`"** (§4) — martwa od migracji `002`; DROP w najbliższej migracji.
9. **„`/gracze` — trasa istnieje, ale to redirect"** (§4) — usunąć trasę; lista graczy
   przy 40 kontach to lista wstydu.
10. **„Zod — walidacja danych z bazy"** (§5) — polerowanie warstwy typów przed
    pierwszym prawdziwym użytkownikiem nie rozbraja żadnej przyczyny z pre-mortem.
11. **„Sesja w cookie zamiast localStorage"** (§5) — mignięcie landingu to defekt
    kosmetyczny; wraca, gdy będzie komu mignąć.
12. **„Katalog boisk — … potem cała Polska"** (5.0, część „cała Polska") — ekspansja
    katalogu na kraj bez jednego aktywnego miasta to Q1 2027 z pre-mortem; naprawa
    danych Poznania zostaje (to punkt (a)4).
13. **„Wizualizacja drabinki na mobile"** (§6) — turniej idzie do kasacji w całości.
14. **„Powiadomienia: wylosowano drabinkę / kiedy następny mecz"** (§6) — jak wyżej.
15. **„Płatność za drużynę (re-użyć trackPayments)"** (§6) — jak wyżej.
16. **„Lista wielu turniejów"** (§6) — jak wyżej.
17. **„Obecność zewnętrzna / backlinki"** (§7) — to nie jest zadanie w backlogu, tylko
    styl życia; jako pozycja do odhaczenia jest fikcją.
18. **„Core Web Vitals"** (§7) — sami piszecie „zmierzyć po wdrożeniu"; pomiar bez
    użytkowników niczego nie zmieni.
19. **„Zamykanie zapisów po komplecie"** (§8) — migracja `058` (oferta miejsca dla
    rezerwy z oknem czasowym) skonsumowała problem, który ta pozycja miała rozwiązać:
    zwolnione miejsce jest już trzymane dla rezerwowego, nikt go nie podbierze.
20. **„Propozycje składów przez graczy"** (§8) — **już zbudowane** (migracja `059`,
    `TeamProposals`); pozycja jest martwym wpisem, backlog nie nadążył za kodem.
21. **„Web-push (PWA)"** (§8) — kanał powrotu dla użytkowników, których nie ma;
    wraca razem z pierwszą kohortą, którą będzie po co przypominać.
22. **„Onboarding / pierwsza gra"** (§8) — skonsumowane przez punkt (a)5; jako osobna
    pozycja to duplikat.
23. **„Rankingi publiczne i odznaki"** (§8) — ranking trzech osób ośmiesza produkt;
    wizja sama mówi „później".
24. **„Ocena umiejętności i dopasowywanie gier do poziomu"** (§8) — wymaga gęstości
    meczów, od której dzielą Was dwa lata.
25. **„MVP meczu"** (§8) — kosmetyka statystyk przy braku grających.
26. **„Realny przepływ pieniędzy (BLIK/Stripe)"** (§8) — regulacyjnie i integracyjnie
    najdroższa pozycja listy, rozwiązująca problem, którego rejestrowanie „kto zapłacił"
    jeszcze nie wyczerpało.
27. **„Wynajem sędziego"** (§8) — marketplace w marketplace, zanim zadziałał pierwszy.
28. **„Wyszukiwarka boisk po nazwie/dzielnicy"** (§8) — drobiazg, który nie rozbraja
    żadnej przyczyny; filtry na `/mapa` wystarczą do czasu realnego ruchu.
29. **„Statystyki sezonowe dla stałych ekip"** (§8) — nadbudówka nad statystykami,
    których nikt jeszcze nie ogląda.
30. **„Agent kontaktowy — automat wysyłający maile do obiektów"** (§8) — automatyzacja
    kontaktu z obiektami przy 56 mailach w bazie, w większości niepewnych, to skalowanie
    błędu; najpierw dane ((a)4), potem ręczny kontakt, automat na końcu.

Zostają poza piątką: weryfikacja stanu migracji na produkcji, adresy `bojo.app`,
domknięcie RLS, build w CI, `/o-nas` — tanie, higieniczne, bez ambicji.

### (c) Ukryte za flagą — do usunięcia z kodu całkiem

- **Turniej** — `lib/tournaments.ts` (455 linii), 6 tabel `tournament_*`, trasy
  `/turniej/*`, flaga `SHOW_CUP`. Największy pojedynczy kawał utrzymywanego kodu
  bez ani jednego użycia; git pamięta, gdyby wrócił.
- **Rezerwacje obiektów** — `lib/bookings.ts`, trasy `/obiekt/*` i `/rezerwacje`,
  tabele `venue_schedules` / `venue_pricing` / `bookings`, flaga `FEATURE_RESERVATIONS`
  z furtką `booking_enabled`. Zbudowane na relację z obiektami, której nie ma; audyt
  danych kontaktowych pokazał, że długo nie będzie.
- **SMS** — edge function `send-event-sms`, kolumny `require_sms_confirmation` /
  `confirmation_deadline_h` w formularzu, flaga `SHOW_SMS_FEATURES`. Płatny kanał
  o zerowym popycie.
- **Gry cykliczne** — `lib/recurring.ts`, trasy `/cykliczne/*`, tabele z migracji `007`,
  flaga `SHOW_RECURRING`. „Powtórz mecz" pokrywa przypadek użycia bez utrzymywania
  drugiego modelu wydarzeń.
- **Martwe mapy i `NearbyGames`** — pięć plików z §4 backlogu plus DROP tabeli `games`.

**Zostaje jako flaga: `SHOW_GAME_ALERTS`** — jedyna, której powód ukrycia backlog sam
oznacza jako nieaktualny, i jedyna potrzebna w piątce (a).

---

## Czego nie wiem

1. **Jaki procent uczestników meczów to dziś goście bez kont?** Jedno zapytanie:
   `SELECT count(*) FILTER (WHERE is_guest), count(*) FROM event_participants`.
   Jeśli goście to ponad ~30%, teza z kroku 2 jest potwierdzona twardo i claim ((a)1)
   jest bezdyskusyjnie pierwszy. Jeśli goście to margines — mechanizm pre-mortem
   wymaga rewizji.

2. **Czy w Poznaniu istnieje żywy popyt na granie z obcymi?** Sprawdzalne w tydzień,
   bez kodu: liczba i świeżość postów „ktoś chętny? / szukamy 2" w poznańskich grupach
   FB o graniu. Jeśli takich postów są dziesiątki tygodniowo — „pusta półka" jest
   problemem podaży w Bojo, nie braku popytu, i punkt (a)5 ma sens. Jeśli ich prawie
   nie ma — publiczne mecze trzeba zdegradować z fundamentu do dodatku, a to zmienia
   wizję głębiej niż cokolwiek w tym dokumencie.

3. **Jaki jest realny tygodniowy ruch dziś, przed startem?** `analytics_events`
   (migracja `047`) już to zbiera — ilu unikalnych użytkowników tygodniowo robi
   cokolwiek poza założycielami. Od tej liczby zależy, czy „start publiczny" to
   launch, czy kolejna prywatna iteracja — i czy Q3 z pre-mortem już trwa.
