# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-09-24 · migracja `162` · 62 tabel

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
| **UKRYTE ZA FLAGĄ** — kod jest, wejścia w nawigacji nie ma | potwierdzenia i przypomnienia SMS, gry cykliczne, rezerwacje obiektów, próg minimum graczy „gra się odbędzie" |
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
(grupy + puchar, sam puchar albo liga), liczbę drużyn, skład min/max i wpisowe. Może podać
TERMIN GRANICZNY ZAPISÓW — po tym dniu nikt nie zgłosi drużyny, niezależnie od wolnych
miejsc. Kapitani zgłaszają drużyny linkiem, a potem kompletują skład na własnym ekranie
drużyny (`/turnieje/[id]/druzyna/[id]`): stały link do wysłania kolegom, licznik „5 z 8",
dopisywanie zawodników bez konta, wpisowe z numerem BLIK, lista własnych meczów. Drugą
drogą obok linku jest IMIENNE ZAPROSZENIE: kapitan zaprasza ludzi ze swoich ekip Bojo,
a zaproszony widzi kartę „Dołączam / Nie mogę" na `/moje-gry`, obok zaproszeń na mecz.
Zaproszenie nie zajmuje miejsca w składzie i gaśnie samo, gdy człowiek wejdzie do drużyny.
Kapitan może też przekazać kapitanat dalej albo wycofać drużynę.
Organizator losuje grupy, generuje terminarz jednym przyciskiem (rozkłada mecze na
dostępne areny/boiska bez kolizji drużyny w jednym slocie) i może go przesunąć w całości,
gdy dzień się opóźnia. Wyznaczony prowadzący obsługuje mecz z telefonu: „Rozpocznij",
dwa wielkie przyciski „GOL" (po jednym na drużynę), a po dotknięciu arkusz ze składem
— kto strzelił, potem opcjonalnie kto asystował, po jednym dotknięciu. Nad wynikiem
tyka zegar meczu liczony od pierwszego gwizdka (bez pauzy, świadomie). Są też „Cofnij
ostatnie", walkower dla drużyny, która nie dojechała, „Zakończ" (karne przy remisie
w fazie pucharowej) i karta „następny na tej arenie", która prowadzi wprost do kolejnego
meczu. W dniu turnieju strona odświeża się sama co 20 sekund, a nad zakładkami stoi
tablica „Na żywo" z wynikiem każdego trwającego meczu i jego boiskiem. Zawodnicy dostają
powiadomienie „Wasz mecz jest następny — Boisko 2, ok. 11:20" w chwili, gdy kończy się
poprzedni mecz na ich arenie. Organizator ma w panelu pulpit: przed turniejem listę
rzeczy do zrobienia (drużyny, zgłoszenia, terminarz, wpisowe, BLIK), w dniu turnieju
— co trwa i co następne na każdym boisku, obsuwę względem planu i przycisk „Przesuń
resztę o N minut". Tabela grupy, drabinka i klasyfikacja strzelców/asyst/MVP
liczą się same z zapisanych wyników. Strona turnieju ma cztery zakładki — Info, Mecze
(przełącznik Najbliższe/Rozegrane, a dla grającego dodatkowo Nasze/Wszystkie), Tabela
i drabinka, Drużyny. Która otwiera się domyślnie, zależy od stanu turnieju: w zapisach
Info, w trakcie Mecze, po finale Tabela. W zapisach nad zakładkami stoi licznik wolnych
miejsc z terminem granicznym i przyciskiem „Zgłoś drużynę". W drabince
zwycięzca meczu jest pogrubiony, a pod wynikiem stoją rzuty karne, gdy to one
rozstrzygnęły; w tabeli grupy miejsca awansujące mają pasek przy pozycji, a podpis,
ile pierwszych miejsc wychodzi do fazy pucharowej, stoi raz pod kompletem tabel. Organizator może dopisać ogłoszenie widoczne dla
wszystkich drużyn i podać numer BLIK do wpisowego. Po ostatnim meczu strona
turnieju pokazuje PODIUM: trzy pierwsze drużyny, króla strzelców, MVP i przycisk
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
`turniej_blik`, `turniej_osoby`, `turniej_zaproszenia` (migracje `145`–`150`, `154`–`156`). RLS jest jedyną granicą dostępu —
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
pojedynczego boiska odpowiada zarówno pod adresem slugowym (`/boisko/nazwa-boiska`),
jak i po surowym identyfikatorze. Dane zbierają skrypty `scraper/` (OpenStreetMap +
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

Osobna kategoria: funkcje **zbudowane, ale ukryte za flagami** — potwierdzenia SMS, gry
cykliczne, rezerwacje obiektów, próg minimum graczy „gra się odbędzie". Kod istnieje,
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

### 2026-09-24 (2) — Prośba o inny wygląd strony turnieju idzie wprost z panelu

PROBLEM: organizator, który chciał inny wygląd strony turnieju (kolory, układ,
dodatkowy element), nie miał gdzie tego napisać poza mailem czy Discordem — bez
kontekstu, KTÓREGO turnieju dotyczy i bez adresu do jego panelu. Osobno: kliknięcie
„+ Dodaj zdjęcia" na zakładce Info otwierało całą zakładkę Ustawienia (nazwa, opis,
regulamin, BLIK, zapisy), nie samą galerię — etykieta zapowiadała węższy ekran, niż
faktycznie się otwierał.

ROZWIĄZANIE BOJO: nowa karta w panelu, pod Galerią i Sponsorami — organizator opisuje,
czego brakuje, a zespół Bojo wprowadza zmianę ręcznie (świadomie nieautomatyczne).
Prośba trafia do tego samego miejsca co zgłoszenia błędów, z linkiem prosto do panelu
tego turnieju. Etykieta linku z zakładki Info zmieniła się na „+ Ustaw wygląd strony",
a zakładka Ustawienia dostała jedno zdanie na górze, które mówi, co się na niej edytuje.

MECHANIKA: `components/turnieje/PanelProsbaOWyglad.tsx`, `zglosZyczenieWygladu()`
w `lib/bledy.ts`. Czwarty rodzaj `turniej_wyglad` w `zgloszenia_bledow` (migracja `099`)
i nowa kolumna `turniej_id`, migracja `162`. Admin czyta w `/admin/bledy`.

### 2026-09-24 — Turniej po grupach nie ogłasza już własnego końca

PROBLEM: audyt przeszedł pełny łuk turnieju i trafił na moment, w którym publiczna
strona pokazywała „Zakończony" tuż po fazie grupowej. Przyczyna: stan turnieju uznawał
za koniec sytuację, w której rozegrano wszystkie ISTNIEJĄCE mecze, a przy formacie
„grupy → puchar" to jest chwila przed powstaniem drabinki. Kapitanowie czytali koniec
turnieju przed ćwierćfinałem. Osobno: karta na liście turniejów liczyła drużyny
czwartą już regułą (wliczała zgłoszenia czekające), panel odmieniał liczebniki
dwoma formami zamiast trzech („2 zgłoszeń czeka"), przebieg meczu nie pokazywał minuty,
a zakończenie meczu wymagało trzech stuknięć.

ROZWIĄZANIE BOJO: stan „Grupy rozegrane, czeka na drabinkę" jest osobnym stanem, nie
udawanym końcem ani udawanym „trwa". Liczenie drużyn zeszło do mapowania wiersza z bazy,
więc żadna powierzchnia nie musi już o tej regule pamiętać. Minuta zdarzenia liczy się
z zegara meczu, bo prowadzący nie ma jak jej wpisywać. Zakończenie meczu ma jedno
potwierdzenie, a zdanie o kolejnej rundzie pokazuje się wyłącznie w meczu pucharowym.
Po rozegranym meczu układanie terminarza od nowa jest wyłączone, a nie tylko ostrzegane.

MECHANIKA: `stanTurnieju()` i `maDrabinke()` w `lib/turniejEtykiety.ts`, `toTurniej()`
w `lib/turnieje.ts` (osadzone zapytania wciągają `status`), `lib/turniejPulpit.ts`,
konsola w `app/turnieje/[id]/mecz/[meczId]/MeczClient.tsx`. Kolumna
`turniej_zdarzenia.minuta` istniała od migracji `147` i była dotąd zawsze pusta.

### 2026-09-23 (2) — Organizator może wreszcie ułożyć terminarz turnieju

PROBLEM: przycisk „Wygeneruj terminarz" w panelu organizatora nie robił NIC i nie mówił
dlaczego. Godzina startu wraca z Postgresa jako `10:00:00`, bo kolumna ma typ `time`,
a panel sklejał `${dataStartu}T${godzinaStartu}:00`, czyli `2026-10-24T10:00:00:00`.
To nieprawidłowa data: `toISOString()` rzucał wyjątek wewnątrz obsługi kliknięcia,
a organizator widział ciszę. Turnieje seedowe mają mecze, bo wstawia je SQL, więc nic
tego nie zgłaszało. Układanie terminarza to główna funkcja modułu turniejowego.

ROZWIĄZANIE BOJO: godzina normalizuje się do `HH:MM` na granicy z bazą, generator
odrzuca nieprawidłową datę czytelnym komunikatem, a panel pokazuje ten komunikat
zamiast milczeć. Przy okazji jedna reguła liczenia drużyn objęła ostatnie trzy miejsca,
które jej nie używały (wiersz w Info, etykieta zakładki, karta na liście), licznik
w nagłówku przestał ginąć za wielokropkiem przy 360 px, opis linku zaczyna się wielką
literą i mówi „do 16 drużyn" zamiast „16 drużyn", skład drużyny pokazuje „7 osób
(od 5 do 12)" zamiast „7 z 5", a cały wiersz przełącznika reaguje na dotknięcie
i ma nazwę dla czytnika ekranu.

MECHANIKA: `toTurniej()` w `lib/turnieje.ts` (normalizacja godziny), `ulozHarmonogram()`
w `lib/turniejFormat.ts` (osłona), `generujPodglad()` w panelu turnieju,
`components/ui/ToggleRow.tsx`. Testy: `turniejTerminarzGodzina.test.ts`.

### 2026-09-23 — Okno gościa tłumaczy, po co e-mail, a Bojo nie obiecuje podaży, której nie ma

PROBLEM: formularz „Dołącz do meczu bez logowania" wymagał e-maila bez wyjaśnienia —
pole wyglądało jak rejestracja i newsletter, dokładnie ten mur, który organizator
próbuje ominąć linkiem „bez konta". Osobno: trzy miejsca w aplikacji (potwierdzenie
otwarcia meczu dla okolicy, ekran po zapisie gościa, zaproszenie do konta dzień po
meczu) obiecywały graczowi, że publiczny mecz „zobaczą gracze z okolicy" — nieprawda
w mieście, gdzie w danym momencie nikt akurat nie szuka gry: obietnica bez pokrycia,
którą Bojo składało samo sobie. Do tego pole daty w kreatorze i edycji liczyło „dziś"
w UTC, więc między północą a 1–2 w nocy czasu polskiego cofało się o dzień i odmawiało
wybrania dzisiejszej daty.

ROZWIĄZANIE BOJO: pole e-mail w formularzu gościa ma dziś jedno zdanie pod spodem —
do czego adres służy i czego nie wymaga (bez hasła, bez konta). Trzy miejsca z obietnicą
„gracze z okolicy" stracił tę frazę na rzecz faktu bez daty: mecz trafia na publiczną
listę otwartych gier, a graczy szukających meczu dopiero przybywa. Lista korzyści
z konta (ekran po zapisie gościa i zaproszenie dzień po meczu) to dziś jedno źródło
zamiast dwóch rozjeżdżających się kopii. Pola dat liczą „dziś"/„jutro" po czasie
lokalnym, nie przez `toISOString()`.

MECHANIKA: helper pod polem e-mail w formularzu gościa (`EventDetailClient.tsx`).
`content/kontoGoscia.ts` (`KORZYSCI_KONTA`) renderowane przez `.map()` w oknie po
zapisie gościa i w `/gracz/przejmij/[token]`; mail `zaloz_konto`
(`supabase/functions/powiadom-goscia/tresc.ts`) trzyma tę samą listę ręcznie, pilnowane
testem czytającym plik. `dzisLokalnie()`/`jutroLokalnie()` w `lib/eventDates.ts` (budowane
z lokalnych metod `Date`, nie przez UTC), użyte w polu daty kreatora i edycji, oknach
„Zmień termin"/„Powtórz mecz" i w `lib/groups.ts`. Testy: `kontoGoscia.test.ts`,
`zakazaneFrazyWTsx.test.ts`, `eventDates.test.ts`. Bez migracji.

### 2026-09-23 — Organizator wie, co Bojo zrobi za niego, i wysyła skład jednym kliknięciem

PROBLEM: organizator nie widział żadnego z trzech zegarów Bojo (przypomnienie dzień
przed meczem, kolejka rezerwowa, domknięcie po meczu), a panel „Mecz gotowy" obiecywał
zawsze „Przypomnienie wyśle się samo" — nieprawda dla meczu założonego po 18:00 dzień
przed terminem albo w dniu meczu, bo automat łapie wyłącznie mecze na jutro. Brakowało
też dwóch rzeczy, które organizator robi co tydzień na WhatsAppie: wysłania listy
składu i zaproszenia tych samych ludzi na kolejny termin.

ROZWIĄZANIE BOJO: karta „Co Bojo zrobi za Ciebie" na stronie meczu pokazuje dokładny
czas przypomnienia (albo że jest już za późno, z przyciskiem „Wyślij link teraz"), ile
czasu ma rezerwowy na decyzję, kto nie dostanie żadnej wiadomości, i kiedy przypomnimy
o rozliczeniu. Przycisk „Wyślij skład" wysyła ponumerowaną listę składu z wolnymi
miejscami i rezerwą — zamiennik posta, który organizator dziś przepisuje ręcznie.
„Powtórz mecz" domyślnie zaprasza poprzedni skład (osoby z kontem), więc kopia meczu
nie startuje już pusta.

MECHANIKA: `lib/harmonogramMeczu.ts` (czysta funkcja, `PRZYPOMNIENIA_UTC` jest lustrem
`cron.schedule('bojo-przypomnienia', …)` z migracji `129`, pilnowane testem czytającym
pliki migracji), `components/events/HarmonogramMeczu.tsx`. `tekstSkladu()`
w `lib/eventShare.ts`, wspólne z `eventShareText()` przez `liniaMiejscICeny()`
i `zdanieBezKonta()`. `odbiorcyPowtorki()` w `lib/playerInvites.ts` filtruje skład do
osób z kontem, bez organizatora i bez rezerwy; mecz przypięty do grupy pomija
zaproszenia (wyzwalacz `072` już powiadamia całą grupę). Bez migracji.

### 2026-09-23 — Organizator nie jest dłużnikiem samego siebie w rozliczeniu

PROBLEM: organizator grający we własnym meczu miał w bazie taki sam wiersz jak każdy
inny uczestnik (`has_paid = false`, dopóki nikt go nie odhaczył). Panel „Podział
kosztów", wiadomość „Wyślij rozliczenie ekipie" i przypomnienie dzień po meczu liczyły
go razem z resztą: organizator widział własne imię w „Zaległościach" na czacie całej
ekipy i dostawał przypomnienie „odhacz wpłaty" o samym sobie.

ROZWIĄZANIE BOJO: organizator płaci za obiekt i zbiera od reszty, więc jego wiersz
w składzie nigdy nie jest zaległością. Panel kosztów pokazuje go osobno, bez
przełącznika wpłaty („Ty · płacisz za obiekt"), a rozliczenie na czacie i przypomnienie
po meczu pomijają go w liczeniu.

MECHANIKA: `winienWplate()` w `lib/payments.ts`, jedna reguła używana przez panel
kosztów i kartę „Po meczu" w `EventDetailClient.tsx`, przez `tekstRozliczenia()`
w `lib/settlementShare.ts` (parametr `organizerId`, wymagany) i przez `toEvent()`
w `lib/events.ts` (`unpaidCount` na `/moje-gry`). Migracja `160` jest lustrem tej
reguły w `wyslij_przypomnienia()` (blok C). Rozważane i odrzucone przy tej okazji:
przeliczanie kosztu obiektu na faktyczny skład — `event_participants` to lista ludzi
zapisanych przez Bojo, nie lista ludzi na boisku, więc liczba wierszy w bazie nie mówi,
ile osób realnie grało. Testy: `payments.test.ts`, `settlementShare.test.ts`,
`events.test.ts`, `supabase/test/przypomnienia.sql`.

### 2026-09-23 — Podgląd linku turnieju pokazuje turniej, nie notatkę z zaplecza

PROBLEM: organizator nie pokazuje ludziom aplikacji, tylko wysyła LINK, a podgląd tego
linku w komunikatorze był w trzech miejscach nieprawdziwy. Opis brał pole `turnieje.opis`
wprost, więc dla turniejów seedowych na WhatsAppie wyświetlała się wewnętrzna notatka
„[TUR] SPRAWDŹ: plakietka Na żywo na karcie meczu…". Licznik drużyn na obrazku pokazywał
zero przy turnieju, w którym były cztery drużyny. Znaczników Twittera nie było wcale, więc
część komunikatorów pokazywała globalny opis marki zamiast turnieju. Osobno: nagłówek
strony turnieju liczył wszystkie zgłoszenia, a pulpit organizatora tylko przyjęte, czyli
kapitan i organizator widzieli dwie różne liczby o tym samym.

ROZWIĄZANIE BOJO: opis linku powstaje z DANYCH turnieju (sport, liczba drużyn, wpisowe,
start, miejsce), a pole „Opis" dochodzi jako drugie zdanie i tylko wtedy, gdy nie jest
notatką techniczną. Licznik na obrazku liczy to samo co strona i jest zielony, bo
policzalny stan ma w Bojo zarezerwowaną zieleń. Znaczniki Twittera powielają
OpenGraph. Turniej bez podanego miejsca mówi o tym wprost szarym wierszem zamiast
pomijać temat. Zegar meczu, którego nikt nie zakończył, przestaje pokazywać liczbę po
przekroczeniu dwukrotności regulaminowego czasu. Nazwa drużyny na liście jest
odnośnikiem do ekranu drużyny, a skład rozwija osobny przycisk.

MECHANIKA: `lib/turniejOpis.ts` (`opisTurnieju()`, `opisNadajeSie()`), metadane
w `app/turnieje/[id]/turniejMeta.ts`, obrazek w `app/turnieje/[id]/opengraph-image.tsx`.
Przyczyną zera na obrazku był `select('*')` na `turniej_druzyny`: tabela ma grant
KOLUMNOWY (migracja `145` nie wypuszcza anonowi telefonu i maila kapitana), więc gwiazdka
kończyła się odmową dostępu, a `count ?? 0` zamieniało błąd w ciche zero. Zegar:
`czasGry()` w `lib/turniejWynik.ts`.

### 2026-09-22 — Boisko potwierdzone przez graczy trafia do wyszukiwarki

PROBLEM: katalog Bojo ma ponad 30 000 boisk, ale część z nich ma w bazie tylko tyle,
ile było w OpenStreetMap, i te strony są celowo poza indeksem Google (`noindex`) — nie
mają nic do powiedzenia ponad źródło. Bojo umie jednak dołożyć do obiektu fakt, którego
nie ma nigdzie indziej: potwierdzenie od graczy, którzy tam byli („jest oświetlenie",
„nawierzchnia to trawa"). Do tej pory takie potwierdzenie nie zmieniało nic dla
widoczności: obiekt z dwoma potwierdzonymi faktami zostawał poza wyszukiwarką, bo
mechanizm awansu znał tylko rozegrany mecz i komentarz.

ROZWIĄZANIE BOJO: gdy dowolny fakt o boisku zbierze zgodne potwierdzenia od dwóch osób,
strona tego boiska wchodzi do wyszukiwarki. Boisko, o którym gracze coś wiedzą, staje
się znajdowalne; boisko, o którym Bojo nie ma nic własnego do powiedzenia, zostaje
pinezką na mapie w aplikacji. Awans jest w jedną stronę: wycofanie głosu nie usuwa
strony z wyszukiwarki.

MECHANIKA: migracja `158` dokłada trzeci wyzwalacz promocji `seo_tier` obok tych
z migracji `112` (mecz, komentarz). Warunek liczy się per para (fakt, wartość), więc
„tak" od jednej osoby i „nie" od drugiej to spór, a nie potwierdzenie, i nie awansuje
niczego. Próg to `QUORUM_POTWIERDZEN` z `lib/potwierdzeniaObiektu.ts`, ten sam, przy
którym fakt pokazuje się człowiekowi na stronie i wchodzi do JSON-LD, żeby robot nigdy
nie wyprzedzał tego, co widać. Wyzwalacz łapie `INSERT OR UPDATE`, bo zapis głosu to
upsert. Migracja niesie backfill dla głosów zebranych od `123`. Progu indeksacji ani
`oblicz_seo_tier()` nie rusza: indeks przez to wyłącznie rośnie. Test:
`kworumPotwierdzen.test.ts`.

### 2026-09-22 — Licznik drużyn w turnieju mówi, ile jest PRZYJĘTYCH

PROBLEM: publiczny licznik na stronie turnieju wliczał zgłoszenia czekające na decyzję
organizatora, więc kapitan czytał „6 z 8 drużyn" i nie miał jak odróżnić turnieju prawie
pełnego od takiego, w którym przyjęta jest jedna drużyna, a pięć czeka. W skrajnym
przypadku turniej wyglądał na zamknięty, choć organizator nie przyjął jeszcze nikogo,
i kapitan rezygnował ze zgłoszenia. Osobno: organizator nie miał gdzie podać, od ilu
drużyn w ogóle warto grać.

ROZWIĄZANIE BOJO: licznik i pasek zapełnienia liczą wyłącznie drużyny przyjęte, a
zgłoszenia czekające dostały własny wiersz pod paskiem („Dodatkowo 3 zgłoszenia czekają
na decyzję organizatora"). `max_druzyn` znaczy teraz jednoznacznie limit PRZYJĘTYCH,
więc bramka zgłoszeń liczy tak samo: licznik nigdy nie obieca miejsca, którego formularz
odmówi. Kreator turnieju dostał opcjonalne pole „Minimum", pokazywane kapitanom jako
informacja („Organizator planuje turniej od 4 drużyn"), bez werdyktu, czy turniej się
odbędzie: tę decyzję podejmuje organizator, nie Bojo.

MECHANIKA: `zajmujeMiejsce()` i `liczCzekajaceZgloszenia()` w `lib/turniejEtykiety.ts`,
wspólne dla strony turnieju, kafelka listy i pulpitu organizatora (`lib/turniejPulpit.ts`).
Kolumna `turnieje.min_druzyn` (migracja `157`) jest NULLowalna: NULL znaczy „organizator
nie podał" i jest innym stanem niż zero.

### 2026-09-21 — Strona boiska na bojo.pl nie kończy się ślepym zaułkiem

PROBLEM: strona obiektu w katalogu Bojo (ponad 30 000 boisk) jest adresem, pod który
trafia praktycznie cały ruch z wyszukiwarki. Kto wszedł z zapytania o nazwę boiska
i nie zastał tam żadnego meczu, czytał zdanie „Brak nadchodzących meczów na tym
boisku." i nie dostawał żadnego wyjścia. Jedyny przycisk na stronie, „Zorganizuj
tutaj", prosi o najtrudniejszą rzecz w aplikacji i nie mówi, co robi: czyta się jak
zobowiązanie do wynajęcia obiektu, a stoi przed kimś, kto nie wie jeszcze, czym Bojo
jest. Alert o nowych meczach w okolicy istniał i miał trzy wejścia, wszystkie
w miejscach, do których ten człowiek nie dociera.

ROZWIĄZANIE BOJO: przy braku meczów strona obiektu proponuje „Powiadom mnie, gdy ktoś
tu zagra" — alert wypełniony sportami i położeniem TEGO boiska, z promieniem 5 km.
Pod przyciskiem „Zorganizuj tutaj" stoi zdanie mówiące, co się stanie: zakładasz mecz
na tym boisku, wysyłasz ekipie jeden link, a gracze zapisują się bez zakładania konta.
Alert wymaga konta, bo wisi na koncie; zamiar przeżywa logowanie i po powrocie okno
otwiera się samo.

MECHANIKA: `domyslneZObiektu()` w `lib/alerts.ts` składa ustawienia okna z wiersza
obiektu i przepuszcza sporty przez `FOCUS_SPORTS` — `field.sport` pochodzi z importu
OSM i niesie też wartości bez chipa w oknie (`wielofunkcyjne`, `inne`, `piłka ręczna`),
które dałyby zaznaczenie niewidoczne i niemożliwe do odznaczenia; pusta tablica znaczy
„dowolny sport". Okno (`AlertSetupDialog`) ładuje się dopiero na kliknięcie
(`next/dynamic`, `ssr: false`), bo to najczęściej otwierany adres w serwisie.
Ścieżka logowania ta sama co z listy meczów: `logowanieDlaAlertu()` i
`zamiarAlertuZAdresu()`. Testy: `alertZObiektu.test.ts`.

