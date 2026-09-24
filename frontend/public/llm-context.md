# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-09-24 · migracja `161` · 62 tabel

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

Migracje SQL uruchamia się **ręcznie**, wklejając je do Supabase → SQL Editor. Nic nie
robi tego automatycznie, więc numer migracji w repozytorium mówi tylko, co zostało
napisane — nie co zostało zastosowane w bazie produkcyjnej. Bojo ma jedno środowisko:
każdy merge do gałęzi `master` trafia na produkcję.

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
- **Automatyczne uruchamianie migracji.**

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

### 2026-09-21 — Panel Bojo mierzy aktywację, nie tylko wolumen

PROBLEM: panel analityki Bojo liczył, ILE rzeczy powstało („Mecze utworzone / 7 dni").
Ten licznik pokazuje identyczną wartość w dwóch stanach, które są przeciwieństwami:
dziesięciu organizatorów po jednym meczu i jeden organizator z dziesięcioma. Cała
strategia Bojo stoi na zdaniu „organizator przyprowadza 10–14 osób", a organizator,
który zrobił jeden mecz i nie wrócił, nie przyprowadził nikogo. Drugiej liczby,
konwersji zapisu bez konta w konto, nie liczył nikt od sierpnia, mimo że oba zdarzenia
leżą w bazie.

ROZWIĄZANIE BOJO: `/admin/analityka` pokazuje nad retencją dwie liczby z okna 30 dni:
odsetek organizatorów, którzy wrócili po drugi mecz (z medianą odstępu), oraz stosunek
przejęć wpisu gościa do zapisów bez konta.

MECHANIKA: czyste funkcje `powtarzalnoscOrganizatora()` i `konwersjaGoscia()`
w `lib/analytics.ts`, bez nowych zdarzeń i bez migracji. Oba zastrzeżenia stoją przy
liczbach w panelu, nie w stopce: powtarzalność jest DOLNYM oszacowaniem, bo pierwszy
mecz sprzed ponad 30 dni wypada z okna, a konwersja gościa liczy ZDARZENIA, nie ludzi,
bo `guest_joined` powstaje bez zalogowania i wiersz nie niesie identyfikatora.
Test `aktywacja.test.ts` porównuje dwa zestawy o tym samym wolumenie i przeciwnym
wyniku.

### 2026-09-20 — Kapitan turnieju ma wreszcie gdzie skompletować skład

PROBLEM: Link do drużyny turniejowej — w tym module CAŁA droga, którą powstają konta
zawodników — kapitan widział DOKŁADNIE RAZ, na ekranie potwierdzenia zgłoszenia. Kto
zamknął kartę, nie odzyskiwał go nigdzie: pasek „Twoja drużyna" pokazywał nazwę i nie
prowadził donikąd, a jedyne inne miejsce z tym linkiem był panel organizatora, do którego
kapitan nie ma wstępu. Operacje kapitańskie (dopisz zawodnika, zmień nazwę, wycofaj
drużynę) istniały w kodzie od migracji `145` i nie miały ani jednego przycisku poza tym
panelem. Do tego strona turnieju twardo otwierała zakładkę „Mecze", więc każdy link
udostępniony w okresie zapisów lądował na napisie „Terminarz jeszcze nie jest gotowy",
a kolumna `zapisy_do` istniała w bazie i była ignorowana — organizator wypełniał termin,
który nic nie robił.

ROZWIĄZANIE BOJO: powstał ekran drużyny (`/turnieje/[id]/druzyna/[id]`) ze stałym linkiem,
licznikiem składu „5 z 8", dopisywaniem zawodników bez konta, wpisowym z numerem BLIK
i listą własnych meczów. Kapitan może zaprosić IMIENNIE ludzi ze swoich ekip — zaproszony
dostaje kartę „Dołączam / Nie mogę" na `/moje-gry`, tam gdzie widzi zaproszenia na mecz.
Domyślna zakładka strony turnieju zależy teraz od jego stanu (zapisy → Info, trakt →
Mecze, koniec → Tabela), w zapisach stoi nad nią licznik wolnych miejsc z terminem
granicznym, `/t/[kod]` mówi najpierw, do czego człowiek dołącza (turniej, data, miejsce,
kto już jest w składzie), a grający filtruje terminarz na „Nasze".

MECHANIKA (początek i koniec łuku, migracja `156`): wyliczenie czasu w kreatorze
(`lib/turniejKreator.ts`) odpala prawdziwe generatory terminarza na atrapach drużyn, więc
nie może rozjechać się z panelem. Kreator kończy się ekranem-plakatem z linkiem i gotowym
tekstem. Podium liczy `lib/turniejPodium.ts` — miejsce jest LICZONE, nie zapisywane
w kolumnie, żeby nie powstała druga prawda o tym, kto wygrał; drabinka bije tabelę,
a trzeciego miejsca bez meczu o 3. miejsce nie wymyślamy. Profil gracza:
`get_player_turniej_stats()`/`get_player_turnieje()`, `SECURITY INVOKER`, więc ściana
logowania egzekwuje się sama.

MECHANIKA (dzień turnieju, migracja `155`): konsola prowadzącego dostała arkusz ze
składem zamiast dwóch natywnych list rozwijanych (`ArkuszSkladu.tsx`), zegar meczu
liczony z `rozpoczety_at` (`czasGry()`/`poCzasie()`), walkower (`walkower_meczu()`)
i kartę „następny na tej arenie". Poprawiony błąd: koszykarskie `+1/+2/+3` zapisywały
po jednym punkcie, bo wywołanie nie przekazywało `wartosc`. Powiadomienie
`turniej_nastepny_mecz` idzie wyzwalaczem przy zakończeniu meczu — tylko gdy turniej
trwa i tylko gdy następny mecz jest tego samego dnia. Strona turnieju odświeża mecze
i zdarzenia co 20 s. Pulpit organizatora: `lib/turniejPulpit.ts`
(`pulpitPrzedTurniejem()`, `opoznienieWMinutach()`, `arenyTeraz()`).

MECHANIKA: migracja `154` (`turniej_zaproszenia`, funkcja `czy_sam_kapitan_druzyny()`
— świadomie węższa niż `czy_kapitan_druzyny()`, bo organizator turnieju NIE widzi
zaproszeń w cudzych drużynach; wyzwalacze: dopełnienie `turniej_id`, powiadomienie
`turniej_zaproszenie_do_druzyny`, gaszenie zaproszenia po wejściu do drużyny).
Nowa trasa `app/turnieje/[id]/druzyna/[druzynaId]`, `lib/turniejZaproszenia.ts`,
`components/turnieje/ZaprosZEkipyDialog.tsx` i `ZaproszeniaTurniejowe.tsx`,
`domyslnaZakladka()` i `przyjmujeZgloszenia()` (termin graniczny) w `lib/turnieje.ts`,
`stanZapisowTurnieju()` w `lib/turniejEtykiety.ts`.

### 2026-09-18 — Strona mówi tym samym językiem, co pierwsza wiadomość do organizatora

PROBLEM: Pierwszy kontakt z organizatorem (docs/outreach-organizatorzy.md) zaczyna się od
misji („zbieramy społeczność, żeby łatwiej było ogarnąć skład") i od tego, że Bojo buduje
konkretny, mały zespół. Kto klikał link po takiej wiadomości, lądował na stronie, gdzie
słowo „misja" nie padało ani razu, za produktem nie stał żaden człowiek, a zamknięcie
brzmiało „Zorganizuj mecz" zamiast powtórzyć małą prośbę z rozmowy („zorganizuj
NASTĘPNĄ gierkę"). Najmocniejszy argument rozmowy znikał dokładnie w chwili największej
uwagi. Do tego `/faq` odsyłało do `/cykliczne`, funkcji schowanej za wyłączoną flagą
`SHOW_RECURRING` od 2026-08-16 — stopka i nagłówek były opakowane flagą, odpowiedź w FAQ
nie była, i żaden istniejący test fraz tego nie widział. Modal po świeżej rejestracji
kierował „Jestem organizatorem" do kreatora GRUPY, choć aktywacją produktu jest pierwszy
wystawiony MECZ, nie grupa.

ROZWIĄZANIE BOJO: landing dostał sekcję misji (po „Jak to działa") i zamknięcie
zapraszające do wystawienia jednej gierki (po FAQ, przed stopką) — obie ŚWIADOMIE bez
liczby osób w zespole i bez imion (decyzja właściciela). Powstała strona `/o-bojo`: kto
robi Bojo, dlaczego zaczyna od organizatorów, oraz dwie listy wprost — co działa dziś
i czego jeszcze nie ma (efekt pratfall: przyznanie się do braku PRZED obietnicą).
`/dlaczego-bojo` dostało sekcję „Co napisać ekipie" — trzy gotowe teksty do skopiowania
na czat (wrzucanie linku, „po co kolejna apka", „nie chcę podawać maila"), plus lead,
który przestał brzmieć obronnie. `/faq` przestało odsyłać do `/cykliczne`, opisując
zamiast tego „Powtórz mecz" (realnie działa). Modal po rejestracji kieruje organizatora
do `/wydarzenia/nowe`; „Załóż grupę" zostaje jako drugorzędne wyjście dla kogoś ze stałą
ekipą.

MECHANIKA: `content/oBojo.ts`, `app/o-bojo/page.tsx` (na `StronaTresci`/`SekcjaTresci`/
`MiniFaq`, jak `/dlaczego-bojo`), `components/home/landing/LandingMisja.tsx`,
`components/home/landing/LandingZaproszenie.tsx`, `LANDING_MISJA` i `LANDING_ZAPROSZENIE`
w `landing/content.ts`, `CO_NAPISAC_EKIPIE` w `content/dlaczego.ts`,
`components/tresc/PrzyciskKopiuj.tsx`, `content/kontakt.ts` (`KONTAKT_HREF`, dziś
`mailto:bojopolska@gmail.com`, docelowo `kontakt@bojo.pl` po weryfikacji domeny
w Resend). Zdarzenie `argument_skopiowany` w `lib/analytics.ts` — bez migracji, kolumna
`event_type` to TEXT bez ograniczenia (migracja `047`). Nowy test w `tresciStron.test.ts`
pilnuje, żeby żadna jednostka treści nie odsyłała do trasy za wyłączoną flagą — ten sam
błąd klasy, który przeżył miesiąc w `/faq`. Testy: `landingContent.test.ts`
(misja/zaproszenie: kierunek korzyści, brak liczby osób), `tresciStron.test.ts`.

### 2026-09-18 — Filtry mapy: koniec dublowania kategorii i liczników, które nie zgadzają się ze sobą

PROBLEM: arkusz filtrów mapy na bojo.pl pytał o sport DWA RAZY, w dwóch sekcjach stojących
jedna pod drugą. Sekcja „Sport" miała siatkówkę, siatkówkę plażową i koszykówkę; sekcja
„Typ obiektu" — te same nazwy jeszcze raz, licząc przy tym coś zupełnie innego: sport
`siatkówka` to 2566 publicznych boisk, `venue_type = 'volleyball_outdoor'` — cztery.
Pozycja „Tenis" obiecywała sport, którego mapa nie pokazuje wcale, więc dawała zawsze zero
wyników, a cała kolumna `venue_type` jest wypełniona w 539 z 35 952 obiektów (1,5%), więc
każdy wybór typu wycinał niemal cały katalog. Do tego liczby kłamały w trzech miejscach
naraz: przycisk „Pokaż 884 boiska" przy katalogu na 36 tysięcy nie mówił, że liczy okolicę
w promieniu 15 km, a nie Polskę; nakładka nad oddaloną mapą pokazywała 38 314, bo liczyła
PARY obiekt-sport zamiast obiektów; zapytanie o widoczny kadr przychodziło po cichu ucięte
do tysiąca wierszy, więc w gęstym mieście część boisk nie miała pinezki, a filtr sportu
przeszukiwał tylko ten ogryzek.

ROZWIĄZANIE BOJO: filtr „Typ obiektu" zniknął z mapy — zostają sport, nawierzchnia,
miejscowość z promieniem i „Gry dziś", każdy pytający o co innego. Pod przyciskiem
„Pokaż N boisk" stoi teraz zakres tej liczby, więc liczba nie udaje już rozmiaru
katalogu. Liczba w kółku przy oddalonej mapie liczy obiekty, nie ich sporty, i zgadza się
z liczbą pinezek po przybliżeniu. Filtr nawierzchni działa też przy oddalonej mapie,
„Gry dziś" przestawia mapę na obiekty z grą z całego kraju zamiast zostawiać niezmienione
kółka, a filtr „Piłka nożna" pokazuje wreszcie 95 boisk opisanych w katalogu wyłącznie
jako futsal.

DRUGIE ZGŁOSZENIE tego samego dnia, po pierwszej poprawce: liczby wciąż wyglądały za małe
(884/380/71 dla „Wszystkie sporty"/„Piłka nożna"/„Siatkówka plażowa" przy katalogu na
36 tysięcy). Pierwsza poprawka NAZWAŁA liczbę („w Twojej okolicy (15 km), nie w całym
katalogu"), nie zmieniła jej źródła — a źródłem była 15-kilometrowa okolica startowa,
dokładnie w chwili, gdy użytkownik patrzył na mapę całej Polski. Przy oddalonej mapie i BEZ
wybranej miejscowości przycisk liczy dziś sumę skupisk KADRU MAPY z filtrami szkicu — tę
samą liczbę, co nakładka „N boisk w tym widoku" — i zakres mówi wtedy „w tym widoku mapy".
Lista kart pod mapą zostaje świadomie przy 15 km (dociągnięcie kart dla całego kraju
zniweczyłoby sens skupisk) i ma własny, uczciwy dopisek — dwa liczniki, dwa różne pytania,
tak jak licznik nad listą i nakładka nad mapą już wcześniej.

MECHANIKA: `VenueExplorer.tsx` (sekcja „Typ obiektu" usunięta, `?type=` czyszczony
z adresu, `graDzisWszedzie`, `previewSkupiskCount`, `zakresPodgladu`), `applyHint` w
`components/ui/FilterSheet.tsx`, `FiltryObiektow` w `lib/api.ts` (filtry zawężają
zapytanie po stronie bazy; stronicowanie `order('id')` + `range()` zamiast cichego limitu
PostgREST), `rozwinSporty()`/`pasujeSport()`/`SPORTY_NA_MAPIE` w `lib/sports.ts` (jedna
lista sportów mapy zamiast trzech kopii), migracja `153_skupiska_licza_obiekty`
(`count(DISTINCT f.id)`, `p_typy` → `p_nawierzchnie`). `venue_type` zostaje w bazie i na
karcie obiektu jako informacja. Testy: `filtryMapy.test.ts`.

