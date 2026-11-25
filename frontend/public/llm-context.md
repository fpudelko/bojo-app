# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-11-25 · migracja `186` · 64 tabel

---

## Jak czytać ten plik

Ten plik jest pisany dla modelu językowego czytającego **na zimno**, bez dostępu do
repozytorium Bojo. Każda sekcja broni się sama: nazywa encje wprost i nie odwołuje się
do sąsiednich sekcji.

Plik **nie powtarza** dokumentacji roboczej z katalogu `docs/`. Tabela flag funkcji,
mapa tabela → migracja i ścieżki plików żyją tam i tylko tam; tutaj są linki, nie kopie.
Agent pracujący **w repozytorium** powinien czytać `docs/domena.md` i `docs/funkcje.md`,
nie ten plik.

---

## Czym jest Bojo

**Problem.** Amatorski mecz w Polsce organizuje się w komunikatorze. Skład zbiera się
w wątku na 60 wiadomości, nikt nie wie, ilu ludzi realnie potwierdziło, a osoba spoza
kręgu znajomych nie ma jak dołączyć. Boiska są rozproszone — nie istnieje jedna lista
z adresami, nawierzchnią i oświetleniem.

**Rozwiązanie w Bojo.** Bojo łączy dwie rzeczy: katalog boisk z całej Polski oraz
mecze przypisane do konkretnego obiektu i terminu. Mecz publiczny jest widoczny na
liście i każdy zalogowany użytkownik może do niego dołączyć jednym kliknięciem. Skład,
limit miejsc i lista rezerwowa liczą się automatycznie.

**Misja.** Misja Bojo to łączenie ludzi przez najprostszy sposób organizowania
i dołączania do amatorskich gier sportowych — docelowo każdy chętny znajduje w
okolicy otwartą grę do dołączenia, a organizator znajduje brakujące osoby do składu.
Im więcej organizatorów i graczy korzysta z Bojo, tym łatwiej znaleźć zarówno otwarty
mecz, jak i brakujących do składu. Dziś, przy wciąż niewielkiej liczbie użytkowników,
publicznych gier na liście bywa mało — najpewniejszy skład wciąż powstaje przez link
wysłany do własnej ekipy, nie przez dołączanie obcych.

**Mechanika.** Next.js 14 (App Router) + TypeScript + Tailwind, hosting Vercel. Dane
i autoryzacja: Supabase (PostgreSQL, Google OAuth, Row Level Security). Mapa: Leaflet
z OpenStreetMap. Dane o boiskach zbierają skrypty Pythona (`scraper/`) uruchamiane
ręcznie z GitHub Actions.

**Pytania, na które odpowiada ta sekcja:** Czym jest Bojo? Co robi bojo.pl? Jak znaleźć
mecz w swojej okolicy? Jak zorganizować mecz i zebrać skład? Na czym Bojo jest zbudowane?
Jaka jest misja Bojo? Czy Bojo pomaga dołączyć do gry z obcymi ludźmi?

---

## Zasięg i skala

Bojo działa w **całej Polsce** — mecz można stworzyć w dowolnym miejscu, wskazując je na
mapie albo wybierając obiekt z katalogu; ta zdolność nie jest ograniczona geograficznie.
Katalog boisk obejmuje całą Polskę — powstał z importu OpenStreetMap, województwo po województwie.
Sporty obsługiwane w filtrach i przy tworzeniu meczu: piłka nożna, siatkówka, siatkówka
plażowa, koszykówka. Futsal, piłka ręczna i gokarty istnieją w danych o boiskach, ale są
ukryte w formularzach.

Przeglądanie mapy i stron boisk **nie wymaga konta**. Tworzenie meczu i zakładanie grup
wymagają logowania — **dołączenie do meczu nie wymaga konta**: osoba z linkiem podaje
imię i e-mail i jest w składzie (funkcja RPC `dolacz_do_meczu_jako_goscie()`, migracje
`082`–`088`, patrz [funkcje.md](./funkcje.md#zapis-na-mecz-bez-logowania)); konto może
dokończyć dopiero po zapisie, jeśli chce mieć historię i statystyki.

Trzy miasta mają dziś dedykowane strony pod konkretny sport: `/[sport]/[miasto]` dla
Poznania, Warszawy i Krakowa (cztery sporty × trzy miasta = dwanaście stron), z licznikiem
otwartych meczów w promieniu ok. 15 km na żywo i liczbą obiektów katalogu w okolicy —
patrz [funkcje.md](./funkcje.md#strona-sportmiasto--poznań-warszawa-kraków). To pilotaż,
nie ograniczenie produktu: mecz nadal da się stworzyć gdziekolwiek w Polsce, te trzy
miasta mają tylko osobną stronę wejściową. Starsze adresy `/graj/[sport]/[miasto]`
przekierowują trwale (301) na nowe.

**Pytania, na które odpowiada ta sekcja:** W jakich miastach działa Bojo? Czy Bojo jest
dostępne w moim mieście? Ile boisk ma Bojo? Jakie sporty obsługuje Bojo? Czy trzeba mieć
konto, żeby przeglądać boiska? Czy trzeba mieć konto, żeby dołączyć do meczu? Czy Bojo ma
osobną stronę dla Poznania?

---

## Status funkcji

Kluczowe rozróżnienie przy odpowiadaniu na pytania o Bojo: część funkcji jest
**zbudowana, ale niewidoczna dla użytkownika**. Kod istnieje i przejdzie code review,
a mimo to nikt tej funkcji w interfejsie nie znajdzie.

| Status | Co obejmuje |
|---|---|
| **PRODUKCJA** — działa i jest widoczne | katalog boisk i mapa, mecze publiczne i prywatne, zapisy z listą rezerwową, „Obserwuję", drużyny, wyniki, rejestrowanie płatności, grupy, powiadomienia in-app, alert o nowym meczu w okolicy, panel admina |
| **UKRYTE ZA FLAGĄ** — kod jest, wejścia w nawigacji nie ma | potwierdzenia i przypomnienia SMS, rezerwacje obiektów, próg minimum graczy „gra się odbędzie" |
| **NIE ISTNIEJE** — patrz „Czego Bojo NIE robi" | rankingi, ocena poziomu, realne płatności |

Aktualny stan flag i miejsca ich użycia → [docs/funkcje.md](./funkcje.md#flagi-funkcji).
Flagi ukrywają **wejścia w nawigacji, nie trasy**: adres wpisany ręcznie nadal odpowiada.

Odpowiadając na pytanie „czy Bojo ma X", cytuj wyłącznie funkcje ze statusem
**PRODUKCJA**. Funkcja ukryta za flagą nie jest funkcją, którą użytkownik dostanie.

**Pytania, na które odpowiada ta sekcja:** Czemu nie widzę funkcji X w Bojo? Które funkcje
Bojo są dostępne dla użytkowników? Czy Bojo wysyła SMS-y?

---

## Mecz: model i widoczność

**Problem.** Część meczów to otwarte granie, na które organizator szuka kogokolwiek.
Część to zamknięte spotkanie stałej paczki, które nie ma trafiać na publiczną listę.

**Rozwiązanie w Bojo.** Mecz jest **publiczny** (widoczny na liście, każdy może dołączyć)
albo **prywatny** (dostęp wyłącznie przez link lub kod dołączenia). Trzeciego poziomu
widoczności nie ma.

**Mechanika.** Kolumna `events.visibility` przyjmuje wyłącznie wartości `private` i
`public`. Kod dołączenia (`join_code`, migracja `041`) otwiera wejście pod adresem
`/d/[kod]`. Relacja użytkownika do meczu to **dwie niezależne osie**: `isOrganizer`
(czyj to mecz) oraz `status` (`none`, `invited`, `pending`, `observing`, `reserve`,
`playing`). Można organizować mecz i w nim grać albo organizować bez grania.

Opcje włączane per mecz: drużyny z kapitanami, wyniki (gole i asysty), obecność,
podział kosztów, osobny limit bramkarzy, wymagana akceptacja zapisu, dopisywanie gości
bez konta.

**Pytania, na które odpowiada ta sekcja:** Czym różni się mecz publiczny od prywatnego
w Bojo? Czy w Bojo można ukryć mecz przed obcymi? Jak działa kod dołączenia do meczu?
Czy organizator meczu musi w nim grać? Jakie opcje ma mecz w Bojo?

---

## Zapisy, pojemność, rezerwa

**Problem.** Organizator meczu amatorskiego nie wie, ilu ludzi realnie przyjdzie.
Zapisani odpadają w ostatniej chwili, chętni dopisują się ponad limit, a lista
w komunikatorze nie odróżnia „będę" od „może wpadnę".

**Rozwiązanie w Bojo.** Mecz ma twardy limit miejsc. Po jego wyczerpaniu kolejne zapisy
trafiają na listę rezerwową. Status „Obserwuję" pozwala śledzić mecz bez zajmowania
miejsca w składzie. Organizator może wymagać akceptacji każdego zapisu.

**Mechanika.** Do limitu liczą się wyłącznie wiersze `event_participants` spełniające
`is_reserve = false AND pending_approval = false`. Reguła jest celowo zdublowana
w trzech funkcjach: `joinEvent`, `addGuest`, `confirmFromMaybe`. „Obserwuję" to
`rsvp = 'maybe'` (migracja `049`) — nie zajmuje miejsca, nie liczy się do statystyk
gracza (migracja `055`) i nie trafia do historii meczów. Oczekiwanie na akceptację
nie blokuje miejsca (migracja `048`). Bramkarze mają osobny limit `max_goalkeepers`
(domyślnie 2); nadmiarowi trafiają na rezerwę.

**Bojo nie awansuje automatycznie z listy rezerwowej.** Gdy ktoś się wypisze, rezerwowy
nie wskakuje na jego miejsce — organizator powiadamia go ręcznie. To świadoma decyzja
produktowa, nie brakująca funkcja.

**„Nie zagram".** Członek ekipy, który jeszcze nie dołączył do meczu przypiętego do jego
grupy, dostaje pytanie „Twoja ekipa tu gra. Nie dasz rady?" i może odpowiedzieć
**„Nie zagram"** — jawna odmowa, osobna od zgłoszenia nieobecności po meczu i osobna od
statystyki „Niezawodność". Odpowiedź da się cofnąć.

**Zapisany widzi swój status na dole ekranu.** Kto ma miejsce w składzie, stoi w kolejce
rezerwowej albo czeka na akceptację, widzi na stronie meczu przyklejony pasek ze swoim
stanem („Jesteś w składzie" / „Rezerwa — 2. w kolejce" / „Czekasz na akceptację")
i wyjściem „Wypisz się". Wypisanie się jest odwracalne — można dołączyć ponownie, o ile
mecz nie ma jeszcze kompletu.

**„Otwórz dla okolicy".** Gdy prywatnemu meczowi brakuje ludzi, organizator jednym
kliknięciem zamienia go w publiczny, żeby dołączyli ludzie z sąsiedztwa — to jedyna
rzecz z tego zestawu, której żaden komunikator nie potrafi.

Próg minimum graczy (organizator ustawia `min_players`, strona meczu pokazuje werdykt
„Gramy ✓" / „Brakuje N do minimum") jest **zbudowany, ale schowany** za
`SHOW_MIN_PLAYERS_THRESHOLD` — patrz „Status funkcji" wyżej.

**Pytania, na które odpowiada ta sekcja:** Co się dzieje, gdy mecz w Bojo jest pełny?
Czy rezerwowy wskakuje automatycznie, gdy ktoś zrezygnuje? Czy „Obserwuję" zajmuje
miejsce w składzie? Jak działa akceptacja zapisów przez organizatora? Ilu bramkarzy
mieści się na mecz? Co się dzieje, gdy ekipie brakuje ludzi do kompletu? Czy da się
jawnie odmówić udziału w meczu, zamiast milczeć? Jak wypisać się z meczu w Bojo?
Gdzie sprawdzę, czy jestem w składzie, czy na rezerwie?

---

## Płatności i karty sportowe

**Problem.** Wynajem hali dzieli się na graczy, a rozliczenie ginie w przelewach
i wiadomościach. Do tego karty sportowe (Multisport, FitProfit, Medicover) dają zniżki,
których wysokość zależy od obiektu i dnia.

**Rozwiązanie w Bojo.** Organizator włącza podział kosztów i oznacza, kto zapłacił.
Może wskazać akceptowane metody płatności oraz karty sportowe honorowane na danym meczu.

**Mechanika.** Logika w `frontend/src/lib/payments.ts` (migracja `056`). Metody:
`blik`, `gotowka`, `inne`. Karty: `multisport`, `fitprofit`, `medicover`, `inne`.
Cenę liczy wyłącznie funkcja `priceForParticipant()`, zwracająca `priceGrosze`,
`discountApplied` i `discountUnspecified`. Kwota zniżki jest opcjonalna i to jest
istotne semantycznie: `sports_card_discount_grosz = null` znaczy **„zniżka jest, ale
zapytaj organizatora"**, a nie „brak zniżki".

Koszt organizator podaje **od osoby albo za cały obiekt** — w drugim trybie Bojo dzieli
kwotę przez liczbę miejsc, bo w bazie zawsze siedzi cena od osoby. Górna granica to
**500 zł od osoby**: to łapacz literówek (kolumna `cost_grosz` jest `integer`, a kwota
w rodzaju 99999999 przekraczała jej zakres i wracała surowym błędem bazy), nie reguła
biznesowa.

**Bojo nie przelewa pieniędzy.** Aplikacja rejestruje, kto zapłacił — nie integruje się
z BLIK-iem ani Stripe'em. Realny przepływ gotówki odbywa się poza aplikacją.

**Pytania, na które odpowiada ta sekcja:** Czy przez Bojo można zapłacić za mecz?
Czy Bojo obsługuje BLIK? Jak Bojo dzieli koszt wynajmu boiska? Czy Bojo akceptuje kartę
Multisport? Co znaczy nieokreślona kwota zniżki? Ile maksymalnie może kosztować mecz
w Bojo? Czy koszt wpisuje się od osoby, czy za wynajem?

---

## Grupy

**Problem.** Ta sama paczka gra co tydzień. Za każdym razem trzeba zebrać tych samych
ludzi od zera w wątku na komunikatorze, historia wspólnych meczów nigdzie nie zostaje,
a organizator jest jedyną osobą, która może cokolwiek zmienić.

**Rozwiązanie w Bojo.** Grupa to stała ekipa: sport, miasto, okładka, lista członków,
mecze grupy, rozmowa (wyglądem jak dymki czatu) i statystyki w jednym miejscu. Lista
ekip na `/grupy` jest posortowana po najbliższym terminie, nie po dacie założenia —
najpierw ta, która gra najwcześniej. Dołącza się wyłącznie kodem zaproszenia — link
`/g/[kod]` pokazuje ekipę i najbliższy mecz bez konta, a rejestracja od razu wciąga do
grupy. Założyciel może nadać zaufanym członkom cztery niezależne uprawnienia:
zarządzanie składem ekipy, zakładanie meczów w jej imieniu, zapraszanie nowych (widzą
przycisk „Zaproś" i kod dołączenia) i moderowanie rozmowy — sam pozostaje jedyną osobą,
która może usunąć grupę.

**Mechanika.** Logika w `frontend/src/lib/groups.ts` (+ `groupPosts.ts`,
`groupStats.ts`, `groupShare.ts`), tabele `groups`/`group_members` (migracja `044`,
uprawnienia i nadawca zaproszenia dołożone w `092`/`094`/`096`), `group_posts` (rozmowa,
migracja `093`). Twórca grupy zostaje jej członkiem automatycznie (trigger
`add_group_creator_as_member`) z pełnią uprawnień, których nie da się mu odebrać.
Dołączenie kodem idzie przez funkcję bazodanową `dolacz_do_grupy_kodem()` — sama
znajomość identyfikatora grupy dziś nie wystarcza, RLS tego pilnuje.

**Prywatny mecz przypięty do grupy jest widoczny dla całej ekipy.** `events.visibility`
ma dwie wartości (`private`/`public`), ale gdy mecz ma ustawione `events.group_id`,
każdy członek tej grupy widzi go na swoim koncie i na liście meczów grupy — niezależnie
od tego, że jest prywatny dla reszty świata. To świadome, ustalone zachowanie aplikacji,
nie luka.

**Pytania, na które odpowiada ta sekcja:** Czym są grupy w Bojo? Jak dołączyć do stałej
ekipy? Czy mecz grupy jest automatycznie prywatny? Czy członkowie grupy widzą prywatny
mecz swojej ekipy? Czy członkowie grupy dostają powiadomienie o nowym meczu? Czy
w grupie jest czat? Czy założyciel grupy może dać komuś innemu uprawnienia do
zarządzania ekipą, w tym prawo zapraszania nowych osób? Czy grupa ma statystyki graczy?
W jakiej kolejności wyświetla się lista moich ekip?

---

## Turnieje

**Problem.** Organizator turnieju amatorskiego (osiedlowy puchar, firmowa liga) prowadzi
dziś zgłoszenia drużyn w grupie na Facebooku, terminarz na kartce i wynik zbiera SMS-em
po każdym meczu. Nic z tego nie liczy tabeli ani statystyk automatycznie, a drużyny nie
widzą planu na bieżąco.

**Rozwiązanie w Bojo.** Organizator zakłada turniej (`/turnieje/nowe`), ustala format
(grupy + puchar, grupy + grupa finałowa, sam puchar albo liga), liczbę drużyn, maksymalny skład, liczbę boisk,
wpisowe i ZASADY GRY (czas meczu, przerwa, punkty za wygraną i remis, ile drużyn wychodzi
z grupy, mecz o 3. miejsce). Wszystko to organizator zmienia później w panelu, a każdy
zapis potwierdza komunikat „Zapisano”. Może podać
TERMIN GRANICZNY ZAPISÓW — po tym dniu nikt nie zgłosi drużyny, niezależnie od wolnych
miejsc. Kapitani zgłaszają drużyny linkiem, a potem kompletują skład na własnym ekranie
drużyny (`/turnieje/[id]/druzyna/[id]`): stały link do wysłania kolegom, licznik „5 z 12",
dopisywanie zawodników bez konta, wpisowe z numerem BLIK, lista własnych meczów. Drugą
drogą obok linku jest IMIENNE ZAPROSZENIE: kapitan zaprasza ludzi ze swoich ekip Bojo,
a zaproszony widzi kartę „Dołączam / Nie mogę" na `/moje-gry`, obok zaproszeń na mecz.
Zaproszenie nie zajmuje miejsca w składzie i gaśnie samo, gdy człowiek wejdzie do drużyny.
Kapitan może też przekazać kapitanat dalej albo wycofać drużynę. Organizator może sam
dodać drużynę i wpisać jej skład; link do takiej drużyny tylko DOŁĄCZA: gracz wybiera swoje
imię z listy (przejmuje wpis) albo dopisuje się sam. Link nie nadaje kapitanatu, kapitana
wskazuje organizator przyciskiem „Ustaw kapitanem” przy zawodniku z kontem.
Organizator losuje grupy albo ustawia je ręcznie i może przenieść drużynę do innej grupy
po losowaniu. Generuje terminarz jednym przyciskiem (rozkłada mecze na dostępne
areny/boiska bez kolizji drużyny w jednym slocie), a w podglądzie pucharu zamienia
miejscami dwie drużyny pierwszej rundy dotknięciem. Przy formatach z grupami terminarz
od razu zawiera kolejną fazę: mecze drabinki albo grupy finałowej z podpisem „Zwycięzca A”
czy „2. miejsce B”, a Bojo wpisuje w nie drużyny samo, gdy grupa rozegra ostatni mecz.
Organizator przepisuje godziny meczów ręcznie („Zmień godziny” w terminarzu panelu), więc
odwzoruje harmonogram z przerwą na konkurs czy meczem finałowym wplecionym między mecze
grup; lista meczów układa się po godzinie i pokazuje przerwy. Godziny w terminarzu są
orientacyjne i niczego nie uruchamiają same. Obok „Rozpocznij turniej” stoi „Przetestuj”: kopia turnieju
z tym samym terminarzem, od razu w trakcie, w której organizator ćwiczy wpisywanie wyników;
prawdziwy turniej i zawodnicy niczego z niej nie widzą. Turniej startuje, gdy organizator kliknie „Rozpocznij turniej"
w pulpicie panelu (warunek: gotowy terminarz; data i godzina startu nie są sprawdzane),
a kończy przyciskiem „Zakończ turniej". Wyniki wpisuje się dopiero w trwającym turnieju.
Główna droga to SAM WYNIK KOŃCOWY: na stronie meczu liczba wpisana z klawiatury albo
przyciski −/+ przy obu drużynach i „Zapisz wynik 3:1" (przy remisie w fazie pucharowej
także karne). Strzelcy są opcjonalni: pod wynikiem można wskazać strzelca każdego gola,
a gdy części brakuje, Bojo pyta raz, czy zapisać wynik bez wszystkich strzelców. Opcją dla chętnych
jest „Prowadź mecz na żywo": „Rozpocznij",
dwa wielkie przyciski „GOL" (po jednym na drużynę), a po dotknięciu arkusz ze składem
— kto strzelił, jednym dotknięciem (asysty Bojo nie zbiera). Nad wynikiem
tyka zegar meczu liczony od pierwszego gwizdka (bez pauzy, świadomie). Są też „Cofnij
ostatnie", walkower dla drużyny, która nie dojechała, „Popraw wynik” przy rozegranym meczu
(wynik wraca do wpisania, a kolejny mecz zależny od niego czeka na nowy wynik; Bojo odmawia,
gdy tamten mecz już się zaczął), „Zakończ" (karne przy remisie
w fazie pucharowej) i karta „następny na tej arenie", która prowadzi wprost do kolejnego
meczu. W dniu turnieju strona odświeża się sama co 20 sekund, a nad zakładkami stoi
tablica „Na żywo" z wynikiem każdego trwającego meczu i jego boiskiem. Zawodnicy dostają
powiadomienie „Wasz mecz jest następny — Boisko 2, ok. 11:20" w chwili, gdy kończy się
poprzedni mecz na ich arenie. Organizator ma w panelu pulpit: przed turniejem listę
rzeczy do zrobienia (drużyny, zgłoszenia, terminarz, wpisowe, BLIK) i przycisk
„Rozpocznij turniej", w trakcie turnieju licznik „Rozegrane X z Y meczów" i listę
meczów czekających na wynik (najpierw trwające, potem po numerze meczu, nie po
godzinie). Pulpit nie liczy opóźnienia względem godzin terminarza: turniejem steruje
klikanie organizatora, nie zegar. Tabela grupy, drabinka i klasyfikacja strzelców (i zawodników meczu, gdy organizator ich wskazał)
liczą się same z zapisanych wyników. Strona turnieju ma cztery zakładki — Info, Mecze
(przełącznik Najbliższe/Rozegrane, a dla grającego dodatkowo Nasze/Wszystkie), Tabela
i drabinka, Drużyny. Która otwiera się domyślnie, zależy od stanu turnieju: w zapisach
Info, w trakcie Mecze, po finale Tabela. W zapisach nad zakładkami stoi licznik wolnych
miejsc z terminem granicznym i przyciskiem „Zgłoś drużynę". W drabince
zwycięzca meczu jest pogrubiony, a pod wynikiem stoją rzuty karne, gdy to one
rozstrzygnęły; w tabeli grupy miejsca awansujące mają pasek przy pozycji, a podpis,
ile pierwszych miejsc wychodzi do fazy pucharowej, stoi raz pod kompletem tabel. Organizator może dopisać ogłoszenie widoczne dla
wszystkich drużyn i podać numer BLIK do wpisowego. Po ostatnim meczu strona
turnieju pokazuje PODIUM: trzy pierwsze drużyny, króla strzelców, zawodnika turnieju (gdy wskazywano) i przycisk
„Udostępnij wyniki". Stamtąd kapitan jednym przyciskiem zamienia drużynę w trwałą ekipę
Bojo (grupę) z całym zapisanym składem, a ktoś, kto właśnie obejrzał cudzy turniej,
znajduje wejście do własnego. Kreator turnieju liczy na bieżąco, ile meczów wyjdzie
i o której padnie ostatni gwizdek, a kończy się ekranem z linkiem i gotowym tekstem
do wklejenia na grupę.

**Ślad na profilu gracza.** Zawodnik, który zagrał w turnieju, ma na swoim publicznym
profilu (`/gracz/[id]`) sekcję „Turnieje": liczba turniejów, meczów, goli i tytułów MVP
oraz trzy ostatnie turnieje z nazwą drużyny. Liczby są LICZONE OSOBNO od statystyk
meczowych (`get_player_turniej_stats()`, migracja `156`) — turniej nie ma zapisów, rezerwy
ani nieobecności, więc mieszanie go z frekwencją z gierek zmieniłoby znaczenie tamtych
liczb. Sekcja znika u kogoś, kto nie grał w żadnym turnieju.

**Ściana logowania.** Nazwa turnieju, format, terminarz, wynik i tabela są publiczne —
widzi je każdy, także niezalogowany. Skład drużyny (imiona, numery) i wszystko, co
wiąże się z konkretnym zawodnikiem (strzelcy, asysty, kartki, MVP), wymaga konta. To
jednocześnie główna droga zakładania kont w tym module.

**Mechanika.** Tabele `turnieje`, `turniej_druzyny`, `turniej_zawodnicy`, `turniej_grupy`,
`turniej_areny`, `turniej_mecze`, `turniej_zdarzenia`, `turniej_ogloszenia`,
`turniej_blik`, `turniej_osoby`, `turniej_zaproszenia`, `turniej_przerwy` (migracje `145`–`150`, `154`–`156`, `176`). RLS jest jedyną granicą dostępu —
funkcje `czy_zarzadza_turniejem()`/`czy_kapitan_druzyny()`/`czy_prowadzi_mecz()` decydują,
kto edytuje co. Wynik meczu liczy się z zapisanych zdarzeń (gol/samobójczy/kartka/punkty),
dopóki organizator nie wpisze go ręcznie (siatkówka i koszykówka mają własną logikę:
sety, punkty 1/2/3). Tabela, drabinka i klasyfikacje liczą się **w przeglądarce** z już
pobranych, przefiltrowanych przez RLS wierszy — zero widoków SQL, żeby nie ominąć
polityk dostępu. Stary moduł turniejowy „BOJO Cup" (`SHOW_CUP`, tabele `tournament_*`)
został w całości zastąpiony i skasowany (migracja `151`).

**Pytania, na które odpowiada ta sekcja:** Czy Bojo obsługuje turnieje? Jak założyć
turniej w Bojo? Jak zgłosić drużynę do turnieju? Kto widzi skład drużyny w turnieju? Jak
prowadzący wpisuje wynik meczu na żywo? Czy Bojo liczy tabelę i strzelców turnieju
automatycznie? Co się dzieje z drużyną po zakończeniu turnieju? Jak zapłacić wpisowe
za turniej w Bojo?

---

## Boiska i mapa

**Problem.** Informacje o boiskach są rozproszone po stronach miasta, klubów
i Google Maps. Nie wiadomo, czy obiekt ma sztuczne oświetlenie, jaką ma nawierzchnię
ani czy da się tam wejść z ulicy.

**Rozwiązanie w Bojo.** Jedna mapa obiektów z całej Polski z filtrami po sporcie,
nawierzchni i dzielnicy. Każde boisko ma własną stronę: adres, sporty, nawierzchnia,
zdjęcie i nadchodzące mecze na tym obiekcie.

**Mechanika.** Tabela `fields` (migracja `001`). Aktywna mapa to komponent
`VenueExplorer.tsx` na trasie `/mapa`, oparty o Leaflet i OpenStreetMap. Strona
pojedynczego boiska ma adres kanoniczny z nazwą i końcówką identyfikatora
(`/boisko/boisko-pilkarskie-741e4f384561`), bo nazwy obiektów z OpenStreetMap powtarzają
się tysiące razy. Adres z samej nazwy (stare linki) przekierowuje na adres kanoniczny,
a adres z surowym identyfikatorem pokazuje stronę z tagiem `canonical`. Dane zbierają skrypty `scraper/` (OpenStreetMap +
Google Places + Claude), uruchamiane ręcznie z GitHub Actions.

**Dane kontaktowe obiektów są domyślnie ukryte** i egzekwuje to sama baza (migracja
`033`) — telefon i e-mail widać tylko wtedy, gdy obiekt zgodził się na publikację.

**Pytania, na które odpowiada ta sekcja:** Gdzie znaleźć boiska w mojej okolicy? Czy Bojo
pokazuje nawierzchnię boiska? Skąd Bojo bierze dane o obiektach? Czemu nie widzę
telefonu do boiska? Jak filtrować boiska po dzielnicy?

---

## Architektura

**Problem.** Mały zespół nie utrzyma osobnego backendu, a każda warstwa pośrednia to
kolejne miejsce, w którym reguły dostępu mogą się rozjechać z rzeczywistością.

**Rozwiązanie w Bojo.** Bojo **nie ma własnego backendu**. Frontend rozmawia z Supabase
bezpośrednio, a całość autoryzacji siedzi w politykach Row Level Security po stronie
bazy.

**Mechanika.** Nowa operacja na danych to funkcja w `frontend/src/lib/` plus polityka
RLS w migracji — nie „nowy endpoint". Operacja wymagająca uprawnień ponad użytkownika
to funkcja `SECURITY DEFINER` w bazie (RPC). Jedyny wyjątek od reguły „brak backendu"
to `frontend/src/app/api/geocode/` — serwerowy proxy do Nominatim, bo przeglądarka nie
może ustawić nagłówka `User-Agent`.

Migracje SQL w Bojo uruchamia workflow GitHub Actions, nie człowiek wklejający je do
Supabase → SQL Editor. Które pliki już poszły, wie dziennik `schema_migracje` w bazie,
więc stan schematu da się odczytać — numer migracji w repozytorium przestał być jedyną
poszlaką. Podział przebiega po RYZYKU, nie po środowisku: migracja, która tylko dokłada
rzeczy (kolumna, tabela, polityka, funkcja, indeks), trafia na produkcję sama przy
merge'u do gałęzi `master`; migracja, która kasuje albo przepisuje w miejscu, czeka na
świadome uruchomienie i blokuje przy tym wszystkie późniejsze, bo migracji nie da się
przeskoczyć. Bojo ma dwie bazy: produkcyjną oraz `BojoDev`, w którą celują podglądy
pull requestów z Vercela. Kod produkcyjny idzie na żywo przy każdym merge'u do `master`.

**Pytania, na które odpowiada ta sekcja:** Czy Bojo ma API? Jak Bojo pilnuje uprawnień?
Czemu w Bojo nie ma backendu? Jak uruchamia się migracje w Bojo? Ile środowisk ma Bojo?

---

## Czego Bojo NIE robi

Zapora przed zmyślaniem. Poniższe **nie istnieje** w Bojo — nie zakładaj, że działa:

- **Automatyczny awans z listy rezerwowej.** Świadoma decyzja produktowa.
- **Automatyczne dopisywanie kogokolwiek do składu.** Nikt nie trafia do składu po cichu
  — to zawsze jawna akcja: zapis, dopisanie gościa albo ręczny awans z rezerwy.
- **Osobna wartość „tylko dla grupy" w `events.visibility`.** Kolumna to wyłącznie
  `private`/`public` — ale prywatny mecz przypięty do grupy i tak widzi cała ekipa,
  patrz sekcja „Grupy" wyżej.
- **Czat w czasie rzeczywistym w grupie.** Jest rozmowa (płaska lista wpisów w formie
  dymków, bez wątków, bez załączników) — nie wiadomości na żywo; strona trzeba odświeżyć,
  żeby zobaczyć nowy wpis od kogoś innego.
- **Realny przepływ pieniędzy** (BLIK, Stripe). Bojo rejestruje, kto zapłacił.
- **Rankingi publiczne, ocena umiejętności, dopasowywanie meczów do poziomu.**
- **Odznaki** — poza znaczkiem „rzetelny gracz" (≥5 rozegranych gier, 0 nieobecności).
- **Wynajem sędziego.**
- **Publiczna lista graczy** — trasa `/gracze` przekierowuje na listę meczów.
- **Osobny backend, API ani kontrolery.**

Osobna kategoria: funkcje **zbudowane, ale ukryte za flagami** — potwierdzenia SMS,
rezerwacje obiektów, próg minimum graczy „gra się odbędzie". Kod istnieje,
wejścia w nawigacji nie ma. Aktualny stan flag →
[docs/funkcje.md](./funkcje.md#flagi-funkcji).

**Pytania, na które odpowiada ta sekcja:** Czy Bojo ma ranking graczy? Czy przez Bojo
zapłacę za boisko? Czy Bojo poleci mi mecz na moim poziomie?

---

## Słownik pojęć

Terminy używane w Bojo i ich odpowiedniki, gdy różnią się od potocznych:

| W Bojo | Znaczenie |
|---|---|
| Mecz / wydarzenie | `events` — jedno granie o konkretnej porze na konkretnym obiekcie |
| Obserwuję | RSVP `maybe` — śledzę mecz, nie zajmuję miejsca |
| Rezerwa | lista oczekujących po wyczerpaniu limitu (`is_reserve = true`) |
| Grupa / ekipa | stała drużyna (`groups`), nie pojedynczy mecz |
| Boisko / obiekt | `fields` — miejsce, w którym odbywa się mecz |
| Organizator | twórca meczu; nie musi w nim grać |
| Grosz vs grosze | kolumny w bazie kończą się na `_grosz`, pola w kodzie na `Grosze` |

---

## Gdzie szukać szczegółów

Dokumentacja robocza w repozytorium (dostępna dla agentów pracujących w kodzie):

- [docs/wizja.md](./wizja.md) — dokument nadrzędny: misja, wizja, status wobec planu
- [docs/funkcje.md](./funkcje.md) — flagi funkcji, opcje meczu, martwy kod
- [docs/domena.md](./domena.md) — modele domenowe i granice architektury
- [docs/baza-danych.md](./baza-danych.md) — tabele, migracje, pułapki RLS
- [docs/strategia.md](./strategia.md) — koszty, role, fazy
- [AGENTS.md](../AGENTS.md) — zasady pracy w repozytorium
- [PRZEWODNIK.md](../PRZEWODNIK.md) — opis funkcji dla ludzi

---

## Ostatnie zmiany

Maksymalnie 10 najnowszych wpisów — pełną historią jest `git log`.

### 2026-11-25 (2) — Prośby gracza do kapitana drużyny turniejowej

PROBLEM: gracz bez linku do drużyny turniejowej w Bojo nie miał jak się do niej dostać,
zawodnik dopisany przez kapitana bez konta nie mógł połączyć wpisu ze swoim kontem, a drużyna
bez kapitana czekała, aż organizator kogoś wskaże.

ROZWIĄZANIE BOJO: na ekranie drużyny turniejowej zalogowany gracz, który nie gra jeszcze
w żadnej drużynie turnieju, ma „Poproś o dołączenie”, przy zawodniku bez konta „To ja”, a przy
drużynie bez kapitana „Chcę być kapitanem”. Kapitan (a gdy go nie ma, organizator) dostaje
niebieskie powiadomienie i kartę „Prośby do rozpatrzenia” na stronie turnieju z przyciskami
„Przyjmij” i „Odrzuć”. O kapitanie decyduje organizator. Gracz dostaje powiadomienie
o decyzji. Link drużyny `/t/…` dalej dołącza od razu, bez prośby.

MECHANIKA: migracja `186` (`turniej_prosby`, `zloz_prosbe_do_druzyny()`,
`rozpatrz_prosbe_do_druzyny()`), `lib/turniejProsby.ts`,
`components/turnieje/ProsbyDoRozpatrzenia.tsx`. Szczegóły → [funkcje.md](./funkcje.md),
[baza-danych.md](./baza-danych.md).

PYTANIA:
- Jak dołączyć do drużyny turniejowej w Bojo bez linku od kapitana?
- Kapitan wpisał mnie bez konta, jak połączyć ten wpis z moim kontem?
- Kto decyduje, kto zostaje kapitanem drużyny w turnieju Bojo?
- Gdzie kapitan przyjmuje prośby o dołączenie do drużyny?

### 2026-11-25 — Prowadzący mecze, ekran „Bieżący mecz”, „Tablica wyników”

PROBLEM: organizator turnieju w Bojo musiał sam startować mecze i wpisywać wyniki albo
oddawać komuś swoje konto lub pełne prawa współorganizatora; ekran „na halę” nie mówił, czym
jest; brakowało ekranu z jednym meczem na telewizor przy boisku.

ROZWIĄZANIE BOJO: organizator dodaje w Ustawieniach → „Ludzie przy turnieju” osobę po e-mailu
z rolą „Prowadzący mecze” albo „Współorganizator”. Prowadzący mecze loguje się na swoim koncie,
wchodzi przyciskiem „Prowadź mecze” na stronie turnieju i widzi tylko terminarz z centrum
dowodzenia: start meczu, zegar, gole, kartki, wynik i poprawkę wyniku. Nie zmienia ustawień,
drużyn, terminarza ani statusu turnieju. Strona na telewizor, telebim albo projektor
nazywa się „Tablica wyników” i ma nowy układ „Bieżący mecz”: jeden mecz na cały ekran z wynikiem,
zegarem i strzelcami, przy kilku boiskach z wyborem boiska. Przełącznik „Organizator /
Uczestnik” został usunięty. Link drużyny po zalogowaniu wraca na ekran dołączenia
z przyciskiem „Dołącz jako {imię}”, a drużyna zalogowanego jest wyróżniona kolorem
w meczach, tabelach i na liście drużyn.

MECHANIKA: migracja `185` (`dodaj_osobe_turnieju()`, `cofnij_wynik_meczu()` dla
prowadzącego), `tylkoProwadzi` w panelu turnieju, układ `mecz` w `lib/ekranTurnieju.ts`
(`?boisko=`). Szczegóły → [funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md).

PYTANIA:
- Jak w Bojo dać komuś wpisywanie wyników bez dawania mu swojego konta?
- Co może prowadzący mecze w turnieju Bojo, a czego nie?
- Jak pokazać wynik jednego meczu na telewizorze przy boisku?
- Gdzie w Bojo jest ekran z wynikami na rzutnik?

### 2026-11-22 (3) — Turnieje na koncie gracza, obserwowanie turnieju, przekazanie organizacji

PROBLEM: zawodnik, który dołączył do drużyny turniejowej w Bojo, nie widział turnieju na swoim
koncie i musiał szukać linku na WhatsAppie; kibic albo rodzic nie miał jak zapisać turnieju;
turniej przygotowany przez Bojo pokazywał na stronie złego organizatora.

ROZWIĄZANIE BOJO: na ekranie „Moje mecze” sekcja „Twoje turnieje” pokazuje karty turniejów,
w których użytkownik gra, które organizuje, współorganizuje albo obserwuje, z podpisem roli
(„Grasz w drużynie”, „Obserwujesz”). Na stronie turnieju (zakładka Info) przycisk „Obserwuj
turniej” dodaje turniej do konta; niezalogowany przechodzi przez logowanie. Na liście
turniejów karta „Moje” (dawniej „Biorę udział”) obejmuje też obserwowane. Organizator
przekazuje organizację współorganizatorowi przyciskiem „Przekaż organizację” (Ustawienia →
Współorganizatorzy) i sam zostaje współorganizatorem. Kapitan z linku `/k/…` widzi, na jakim
koncie przejmuje drużynę.

MECHANIKA: migracje `183` (`przekaz_organizacje_turnieju()`) i `184` (`turniej_obserwujacy`,
widoczny tylko dla właściciela wpisu), `getMojeTurniejeZRola()` i `turniejeNaMojeMecze()`
w `lib/turnieje.ts`, `components/turnieje/MojeTurniejeSekcja.tsx`. Szczegóły →
[funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md).

PYTANIA:
- Gdzie w Bojo zobaczę turniej, w którym gra moja drużyna?
- Jak obserwować turniej w Bojo, jeśli nie gram?
- Czy organizator widzi, kto obserwuje turniej?
- Jak zmienić organizatora turnieju w Bojo?

### 2026-11-22 (2) — Zegar meczu turnieju z pauzą i połowami

PROBLEM: zegar meczu turnieju w Bojo ruszał w chwili wejścia w tryb na żywo i nie dawał się
zatrzymać; organizator nie wiedział, co się stanie po kliknięciu „Prowadź mecz na żywo”, i nie
wiedział, kiedy kończy się połowa.

ROZWIĄZANIE BOJO: na stronie meczu karta „Prowadź mecz na żywo” stoi na górze z opisem
w jednej linii. Po „Zacznij mecz teraz” zegar czeka na „Start”; prowadzący ma „Pauza”,
„Koniec połowy”, „Start 2. połowy” i „Koniec meczu”, a „Przejdź do końca meczu” jest zawsze.
Ekran na halę i panel organizatora pokazują ten sam stan zegara („1. poł. 03:12”, „Przerwa”).
Na ekranie na halę kod QR zbiórki jest duży, a kod Bojo mały po drugiej stronie.

MECHANIKA: migracja `182` (`turniej_mecze.zegar_od`, `zegar_sekundy`, `polowa`),
`lib/zegarMeczu.ts`.
Szczegóły → [funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md).

PYTANIA:
- Czy zegar meczu turnieju w Bojo da się zatrzymać?
- Jak zakończyć pierwszą połowę meczu w Bojo?

### 2026-11-22 — Turniej w Bojo: link kapitana, wyniki na karcie drużyny, przerwy, ekran 16:9

PROBLEM: organizator turnieju w Bojo, który wpisał drużyny sam, nie miał jak oddać ich
kapitanom; karta drużyny pokazywała skład zamiast wyników; przerwy wyliczone z harmonogramu
znikały z list „najbliższe” i „nasze mecze”; ekran na halę ściskał się na telefonie; usunięcie
i odwołanie turnieju wymagało jednego kliknięcia.

ROZWIĄZANIE BOJO: w panelu turnieju (Drużyny → Linki dla kapitanów) organizator kopiuje komplet
linków `bojo.pl/k/<kod>` z nazwami drużyn do wklejenia na WhatsApp. Kapitan otwiera link swojej
drużyny, loguje się, wskazuje siebie w składzie i przejmuje drużynę; link działa raz, drużyny
z kapitanem nie da się nim przejąć. Karta drużyny na stronie turnieju po rozwinięciu pokazuje
najbliższy mecz i wyniki (Z/R/P), a przycisk „Zobacz mecze i skład” prowadzi na ekran drużyny.
Przerwy wyliczone z odstępów w terminarzu pokazują się także po meczu w toku i w widoku
„Nasze mecze”. Ekran na halę zawsze ma proporcje 16:9, także na telefonie, a wybór układu
(„Tablica wyników”, „Tabele grup”, „Terminarz dnia”…) pokazuje miniaturę każdego układu.
Usunięcie i odwołanie turnieju wymaga wpisania jego nazwy. Admin Bojo widzi na `/turnieje`
zakładkę „Wszystkie” (także szkice i prywatne).

MECHANIKA: migracja `181` (`turniej_kody_kapitana`, `przygotuj_linki_kapitanow()`,
`druzyna_po_kodzie_kapitana()`, `przejmij_druzyne_kapitanem()`), trasa `app/k/[kod]`,
`meczeDruzyny()` w `lib/turniejWynik.ts`, `meczPrzed()`/`zawezDoMeczow()` w
`lib/turniejEtykiety.ts`, `WyborEkranu.tsx`, `wpiszAby` w `OknoPotwierdzenia`.
Szczegóły → [funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md).

PYTANIA:
- Jak kapitan przejmuje drużynę wpisaną przez organizatora turnieju w Bojo?
- Czy link kapitana da się przesłać dalej?
- Gdzie zobaczyć wyniki jednej drużyny turnieju?
- Jak wygląda ekran turnieju na telefonie?

### 2026-11-21 (4) — Ekran turnieju na halę: ogłoszenie, kod QR zbiórki, jasny motyw, terminarz

PROBLEM: turniej charytatywny w Bojo chce pokazać na ścianie hali nie tylko wyniki, ale też
cel zbiórki i gdzie wpłacić, a jasna sala i telewizor potrzebują innych kolorów niż rzutnik
w ciemności. Kibice pytają organizatora „kiedy gramy?”.

ROZWIĄZANIE BOJO: organizator turnieju w Bojo wpisuje w panelu (Ustawienia → Ekran na halę)
ogłoszenie i link, np. do zrzutki, z podpisem. Ekran na halę pokazuje ogłoszenie zielonym
paskiem na każdym układzie i drugi kod QR „Zeskanuj i wesprzyj” obok kodu Bojo; zmiana
z telefonu dociera na ekran w ciągu 15 sekund. Nowe układy ekranu: „Terminarz” (wszystkie
mecze do końca dnia), „Ogłoszenie” (tekst i duży kod QR zbiórki na cały ekran) i „Na
zmianę” (ekran sam przełącza układy co 20 sekund). Motyw ciemny albo jasny. Gdy trwa
przerwa z nazwą (np. licytacje), ekran pokazuje ją zamiast następnego meczu.

MECHANIKA: migracja `180` (`turnieje.ekran_komunikat`, `ekran_link`, `ekran_link_opis`),
`lib/ekranTurnieju.ts`, `components/turnieje/WyborEkranu.tsx`,
`app/turnieje/[id]/ekran/EkranClient.tsx`, `normalizujLinkEkranu()` w `lib/turnieje.ts`.
Szczegóły → [funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md).

PYTANIA:
- Jak pokazać kod QR do zbiórki na ekranie turnieju w Bojo?
- Czy ekran turnieju ma jasny motyw?
- Jak wyświetlić cały terminarz na telewizorze na hali?
- Czy ogłoszenie na ekranie da się zmienić z telefonu w trakcie turnieju?

### 2026-11-21 (3) — Panel turnieju na komputerze i ekran wyników na halę

PROBLEM: na komputerze panel turnieju w Bojo był kolumną szerokości telefonu na środku
ekranu. W dniu turnieju organizator przy laptopie przełączał zakładki, żeby zobaczyć naraz
mecz w toku, kolejne mecze, ostatnie wyniki i tabele grup.

ROZWIĄZANIE BOJO: od szerokości 1024 px zakładka Terminarz w panelu turnieju w trakcie
turnieju pokazuje obok siebie: mecz w toku (wynik, „+ Gol” dla każdej drużyny, „Zakończ
mecz”), cztery najbliższe mecze z przerwami, „Wymaga decyzji” (mecz, który według planu
już powinien grać; zgłoszenia drużyn), ostatnie wyniki z „Popraw”, tabele wszystkich grup
i mecze grupy finałowej albo fazy pucharowej. Nagłówek panelu pokazuje stan turnieju,
„X z Y meczów” i główny przycisk („Wpisz wynik M14” albo „Rozpocznij M14”). Bojo nie
pokazuje opóźnienia względem planu: turniejem steruje klikanie organizatora, nie zegar.
Pomyłkowy gol cofa się przyciskiem „Cofnij ostatnie”. Panel odświeża się sam co 15 sekund,
więc wynik wpisany przez współorganizatora z telefonu pojawia się na laptopie bez
przeładowania. Nad siatką stoją alerty: mecz trwający dwa razy dłużej niż czas gry
(ktoś zapomniał go zakończyć), mecz, który według planu już powinien grać, czekające
zgłoszenia. EKRAN NA HALĘ (`bojo.pl/turnieje/<adres>/ekran`, przycisk „Ekran na halę”
w panelu) pokazuje na rzutniku albo telewizorze wynik na żywo, kolejne mecze, tabele grup
i wyniki (prawa strona przełącza się sama: grupy, wyniki, najlepsi strzelcy, faza
końcowa; kliknięcie nazwy widoku zatrzymuje ekran na nim). Organizator wybiera układ ekranu: „Wszystko”,
„Wynik na żywo” (wynik na pół ekranu), „Tabele” (wszystkie grupy w dużym rozmiarze) albo
„Mecze i wyniki” (bez tabel); w menu „Ekran na halę” w panelu albo na samym ekranie po ruchu myszy. Ekran ma kod QR do strony turnieju w Bojo, odświeża się sam, a po turnieju pokazuje podium. Ekran jest publiczny,
nie wymaga logowania i nie trafia do wyszukiwarki.
Strona turnieju na komputerze pokazuje na zakładce Mecze tabele grup w prawej kolumnie.
Na telefonie panel i strona turnieju wyglądają jak dotąd.

MECHANIKA: `components/turnieje/CentrumTurnieju.tsx`, `centrumTurnieju()` w
`lib/turniejPulpit.ts`, `tabeleTurnieju()` w `lib/turniejTabela.ts`,
`app/turnieje/[id]/panel/PanelClient.tsx`, `app/turnieje/[id]/TurniejClient.tsx`,
`app/turnieje/[id]/ekran/EkranClient.tsx`. Bez migracji. Szczegóły → [funkcje.md](./funkcje.md).

PYTANIA:
- Jak prowadzić turniej w Bojo z laptopa?
- Czy w panelu turnieju widać tabele grup obok terminarza?
- Czy Bojo pokazuje, o ile turniej jest spóźniony?
- Jak wpisać gola bez wybierania strzelca?
- Jak pokazać wyniki turnieju na rzutniku albo telewizorze na hali?
- Jak cofnąć gola wpisanego przez pomyłkę?
- Czy organizator może wybrać, co pokazuje ekran turnieju na hali?

### 2026-11-21 (2) — Turniej w Bojo: wyniki jednym wierszem, samobój pod golem, wejście dla uczestników

PROBLEM: lista wyników turnieju w Bojo powtarzała przy każdym meczu datę, godzinę i boisko,
a wpisanie gola samobójczego nie mówiło, czyj to gol. Napisy „bez goli” i „Jeszcze nikt nie
strzelił” kłamały, gdy wynik wpisano bez strzelców.

ROZWIĄZANIE BOJO: każdy mecz turnieju, przyszły i rozegrany, to jeden wiersz: grupa albo faza,
data i godzina, drużyny, wynik albo „vs”, boisko tylko przy kilku boiskach. Strzelcy i przebieg
są na stronie meczu, do której prowadzi wiersz. W konsoli meczu „GOL” ma na dole opcję „Samobój”, która pyta o zawodnika
drużyny przeciwnej; strzelca można pominąć („Zapisz bez strzelca”). Statystyki graczy
pokazują się tylko, gdy ktoś wpisał strzelców. Ze strony meczu i drużyny strzałka wraca do
turnieju, a pod nagłówkiem są zakładki turnieju. Wejście „🏆 Turnieje” obok Moich meczów
widzi ten, kto organizuje albo gra w turnieju. Remis w tabeli (te same punkty, bilans i bramki)
daje drużynom to samo miejsce i ten sam medal na podium z dopiskiem „ex aequo”; organizator
ustala kolejność w panelu i może dopisać komentarz pod tabelą.

MECHANIKA: `components/turnieje/WierszMeczu.tsx`, `KartaMeczu.tsx`, `ArkuszSkladu.tsx`,
`ZakladkiTurnieju.tsx`, `strzelcyMeczu()`/`znacznikFazy()` w `lib/turniejEtykiety.ts`,
`lib/useMamTurnieje.ts`. Bez migracji. Szczegóły → [funkcje.md](./funkcje.md).

PYTANIA:
- Jak wpisać gola samobójczego w turnieju w Bojo?
- Czy można zapisać gola bez strzelca?
- Gdzie znajdę turnieje, w których gram?
- Co pokazuje Bojo, gdy drużyny w grupie mają identyczny bilans?

### 2026-11-21 — Adresy turniejów i meczów z nazwą i datą zamiast uuid

PROBLEM: link do turnieju i meczu w Bojo wyglądał jak `bojo.pl/turnieje/e9a3763f-7bd9-…`
i na czacie nie mówił, dokąd prowadzi, dopóki ktoś nie kliknął.

ROZWIĄZANIE BOJO: turniej ma adres z nazwą i datą (`bojo.pl/turnieje/gramy-dla-marysi-28-11-2026`),
mecz turnieju numer (`…/mecz/5`), zwykły mecz tak samo jak turniej
(`bojo.pl/wydarzenia/czwartkowa-gierka-27-11-2026`). Adres nadaje się raz, przy utworzeniu,
i nie zmienia się po zmianie nazwy ani daty, więc rozesłane linki działają dalej. Powtórzona
nazwa i data dostaje dopisek „-2”. Stare linki z uuid działają; pasek przeglądarki od razu
pokazuje adres z nazwą. Udostępnienie turnieju wysyła sam link, bez dopisku „Zgłoś drużynę”.
Organizator turnieju dodaje współorganizatora po adresie e-mail jego konta w Bojo
(Panel → Ustawienia → Współorganizatorzy); współorganizator może wszystko poza usunięciem
turnieju i nadawaniem praw dalej. Admin Bojo zarządza każdym turniejem, a „Przetestuj”
(próba dnia turnieju na kopii) jest dostępne tylko dla admina.

MECHANIKA: migracja `177` (tabela `adresy_z_nazwa`, `nadaj_adres()`, wyzwalacze na `turnieje`
i `events`), `src/middleware.ts` (adres z nazwą → trasa z uuid), `lib/adresy.ts`,
`lib/useAdres.ts`. Szczegóły → [funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md).

PYTANIA:
- Jak wygląda link do turnieju w Bojo?
- Czy stary link do meczu z długim identyfikatorem dalej działa?
- Czy adres meczu zmieni się, gdy organizator zmieni nazwę albo datę?
- Jak podać link do konkretnego meczu turnieju?
- Jak dodać drugiego organizatora do turnieju w Bojo?

### 2026-11-20 — Czytelniejsze kafelki meczów turnieju, prostsza zakładka Info i panel bez pulpitu

PROBLEM: na stronie turnieju Bojo napis „Zapisy zamknięte” stał nad każdą zakładką, kafelki
meczów były szare (data słowna, plakietka „Zaplanowany” na każdym), a Info podawało
oczywistości („zwycięstwo 3 pkt, remis 1”, karne) i stawiało organizatora w środku opisu.

ROZWIĄZANIE BOJO: kafelek stanu turnieju (zapisy, termin, liczba drużyn, udostępnianie)
pokazuje się tylko na zakładce Info. Kafelek meczu turnieju wygląda jak zwykła karta meczu
Bojo: zielona krawędź, godzina na zielonej plakietce z zegarem, dzień skrótem („sob. 28 lis”,
„Dziś”), boisko z pinezką; plakietka stanu tylko dla meczu trwającego, zakończonego,
walkowera i wolnego losu. Info pomija punktację 3/1 i karne, a „Organizuje …” stoi na dole.
Panel organizatora turnieju nie ma już „Pulpitu”: zakładki to Terminarz (na górze „Rozegrane
X z Y meczów”, „Rozpocznij turniej”, „Przetestuj”), Drużyny (z podziałem na grupy i
przełącznikiem grupy przy drużynie) i Ustawienia. Ustawienia nie zapisują się same:
zmiany zatwierdza przycisk „Zapisz zmiany” przyklejony do dołu ekranu. Areny (boiska, hale,
korty) ustawia się w Ustawieniach, a przy kilku arenach terminarz pozwala przypisać arenę
do meczu. Przerwa nachodząca na mecze nie jest blokowana: Bojo pyta, czy
przesunąć te mecze i wszystkie po nich za przerwę, czy zapisać bez przesuwania.

MECHANIKA: `components/turnieje/KartaMeczu.tsx`, `terminMeczuNaKarcie()` w
`lib/turniejEtykiety.ts`, `app/turnieje/[id]/TurniejClient.tsx`,
`app/turnieje/[id]/panel/PanelClient.tsx`. Bez migracji.
Szczegóły → [funkcje.md](./funkcje.md).
