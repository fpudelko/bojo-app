# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-09-16 · migracja `152` · 59 tabel

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
(grupy + puchar, sam puchar albo liga), liczbę drużyn, skład min/max i wpisowe. Kapitani
zgłaszają drużyny linkiem, sami uzupełniają skład albo przekazują kapitanat dalej.
Organizator losuje grupy, generuje terminarz jednym przyciskiem (rozkłada mecze na
dostępne areny/boiska bez kolizji drużyny w jednym slocie) i może go przesunąć w całości,
gdy dzień się opóźnia. Wyznaczony prowadzący obsługuje mecz z telefonu: „Rozpocznij",
gol/kartka/punkt jednym dotknięciem ze składu, „Cofnij ostatnie", „Zakończ" (karne przy
remisie w fazie pucharowej). Tabela grupy, drabinka i klasyfikacja strzelców/asyst/MVP
liczą się same z zapisanych wyników. Strona turnieju ma trzy zakładki — Mecze
(przełącznik Najbliższe/Rozegrane), Tabela i drabinka, Drużyny — a nad nimi nagłówek
z parametrami turnieju. W drabince
zwycięzca meczu jest pogrubiony, a pod wynikiem stoją rzuty karne, gdy to one
rozstrzygnęły; w tabeli grupy miejsca awansujące mają pasek przy pozycji, a podpis,
ile pierwszych miejsc wychodzi do fazy pucharowej, stoi raz pod kompletem tabel. Organizator może dopisać ogłoszenie widoczne dla
wszystkich drużyn i podać numer BLIK do wpisowego. Po turnieju kapitan jednym przyciskiem
zamienia drużynę w trwałą ekipę Bojo (grupę) z całym zapisanym składem.

**Ściana logowania.** Nazwa turnieju, format, terminarz, wynik i tabela są publiczne —
widzi je każdy, także niezalogowany. Skład drużyny (imiona, numery) i wszystko, co
wiąże się z konkretnym zawodnikiem (strzelcy, asysty, kartki, MVP), wymaga konta. To
jednocześnie główna droga zakładania kont w tym module.

**Mechanika.** Tabele `turnieje`, `turniej_druzyny`, `turniej_zawodnicy`, `turniej_grupy`,
`turniej_areny`, `turniej_mecze`, `turniej_zdarzenia`, `turniej_ogloszenia`,
`turniej_blik`, `turniej_osoby` (migracje `145`–`150`). RLS jest jedyną granicą dostępu —
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

### 2026-09-16 — Opis strony boiska w wynikach wyszukiwania mówi o nawierzchni, nie o meczach

PROBLEM: Po zaindeksowaniu katalogu (17 473 stron od 5 września) strony boisk Bojo zaczęły
pojawiać się w Google na zapytania o konkretne obiekty — i to wysoko: dziesiątki zapytań
w pierwszej piątce wyników, część w pierwszej trójce. Mimo to prawie nikt nie klikał:
58 zapytań stojących w TOP5 nie dostało ani jednego kliknięcia, co dało 20% wszystkich
wyświetleń zmarnowanych na pozycji, o którą inni walczą miesiącami. Przyczyną było to,
co widać w wyniku: opis powtarzał nazwę i adres stojące w tytule tuż nad nim, a potem
obiecywał „Zobacz nadchodzące mecze" — a mecz rozegrano na około 40 obiektach z ponad
36 tysięcy, więc dla niemal każdego boiska ta obietnica była pusta.

ROZWIĄZANIE BOJO: Opis strony boiska w wynikach wyszukiwania niesie dziś wyłącznie fakty,
których nie ma w tytule: nawierzchnię, oświetlenie oraz to, czy obiekt jest kryty czy
otwarty — czyli rzeczy, po których człowiek wybiera boisko. Gdy starcza miejsca, dochodzi
adres z ulicą, bo po niej rozstrzyga się między boiskami w tej samej miejscowości. Zdanie
o nadchodzących meczach zniknęło: Bojo nie obiecuje w wyszukiwarce czegoś, czego na danym
obiekcie może nie być. Sport i miejscowość też wypadły — niesie je tytuł wyniku, a forma
„w «miejscowość»" wymagałaby odmiany, której nie da się poprawnie wyprowadzić dla
dziesiątek tysięcy nazw z katalogu.

MECHANIKA: `metaOpisObiektu()` w `frontend/src/content/opisObiektu.ts`, używana przez
`generateMetadata()` w `app/boisko/[id]/page.tsx`. Fakty budowane z pól `surface`
(przez `surfaceLabel()`), `isIndoor` i `lit`; adres dokładany tylko wtedy, gdy całość
mieści się w 160 znakach, powyżej których wyszukiwarka ucina opis. Test:
`src/__tests__/opisObiektu.test.ts`. Bez migracji. Dane źródłowe: eksport Search Console
z 2026-09-16, opisany w `docs/seo-geo-strategia.md`, sekcja 7a.2.

### 2026-09-17 — Turniej schowany przed userami, a w środku posprzątany

PROBLEM: przegląd modułu na żywo (telefon, użytkownik bez konta) pokazał, że turniej działa,
ale pierwsze wrażenie jest złe. Pasek sześciu zakładek nie mieścił się w szerokości ekranu,
więc „Drabinka" była ucięta i istniała tylko dla kogoś, kto pomyślał, żeby przewinąć w bok.
Info było niemal puste: data, boisko, „8/16 drużyn · 50 zł wpisowe" — bez odpowiedzi, czy
50 zł to od drużyny czy od gracza, ile trwa mecz i kto to organizuje. Ten sam dzień
pokazywał się w trzech zapisach naraz, a godzina startu szła na ekran z sekundami
(„10:00:00"). Cztery turnieje miały identyczną plakietkę „Trwa" — w tym jeden sprzed
tygodnia i jeden, w którym został sam finał. Na liście nie było ani jednego przycisku,
bo kreator wisiał za logowaniem.

ROZWIĄZANIE BOJO: wejścia do turniejów zniknęły z `/moje-gry` i `/profil` — moduł jest
tymczasowo niewidoczny dla użytkownika, a `bojo.pl/turnieje` nadal odpowiada każdemu, kto
wejdzie świadomie albo z udostępnionego linku. Sama strona turnieju ma dziś trzy zakładki
(Mecze z przełącznikiem Najbliższe/Rozegrane, Tabela i drabinka, Drużyny), Info jako
nagłówek nad nimi ze stałym szablonem Kiedy · Gdzie · Format · Zasady · Koszt od drużyny ·
Organizator, oraz pasek „Twoja drużyna: … · następny mecz" dla tego, kto gra. Termin ma
jeden zapis w całej aplikacji („Dziś, 18:00", „niedz. 20 września, 10:00"), a stan turnieju
liczy się z terminarza: „Na żywo", „Ostatnie mecze", „Zakończony", z drugim wierszem
„Finał dziś, 19:00".

MECHANIKA: `SHOW_TURNIEJE = false` (`lib/features.ts`) chowa wejścia w nawigacji, nie trasy —
`/turnieje` wróciło przy tym do `DISALLOW` w `robots.ts` i zeszło z `llms.txt`, czego pilnuje
`npm run check:docs`. `etykietaTerminu()` i `stanTurnieju()` w `lib/turniejEtykiety.ts` to
czyste funkcje z wstrzykiwanym „dzisiaj". Stare adresy zakładek (`?tab=terminarz`,
`?tab=wyniki`, `?tab=drabinka`) prowadzą tam, gdzie ich treść dziś mieszka. Testy:
`turniejTermin.test.ts`.

### 2026-09-16 — Turniej: jedna zakładka na jedno pytanie, lista jako karty

PROBLEM: strona turnieju miała cztery zakładki, a odpowiadała na sześć pytań.
„Terminarz" i „Wyniki" pokazywały TEN SAM komplet meczów, więc żeby sprawdzić, co
jeszcze przed nami, trzeba było przewijać przez mecze już rozegrane. Tabela grup
i drabinka siedziały razem w „Wynikach", jedna pod drugą. Drużyny szły jedną listą
ośmiu kart, bez śladu podziału na grupy, a nazwisko w składzie nie prowadziło nigdzie,
mimo że Bojo ma profil gracza. Lista `/turnieje` układała sekcje jedna pod drugą, więc
turniej, w którym się gra, bywał na trzecim ekranie w dół.

ROZWIĄZANIE BOJO: sześć zakładek, każda na jedno pytanie — Info, Drużyny, Terminarz
(wyłącznie mecze nierozegrane, trwający na górze), Wyniki (wyłącznie rozegrane, od
najnowszego, plus klasyfikacje), Tabela, Drabinka. Zakładka bez treści nie pokazuje się
wcale. Drużyny stoją pod nagłówkami swoich grup. Pod każdą tabelą grupy da się rozwinąć
wyniki właśnie tej grupy, a podpis „Pierwsze 2 miejsca w grupie awansują do fazy
pucharowej" stoi RAZ pod kompletem tabel. Zawodnik z kontem w składzie prowadzi do
swojego profilu. Lista turniejów to karty: Biorę udział → Zapisy → Trwają → Zakończone,
otwiera się pierwsza niepusta.

MECHANIKA: `app/turnieje/[id]/TurniejClient.tsx` (podział meczów na rozegrane
i nierozegrane, sekcje drużyn po grupach, lista widocznych zakładek),
`app/turnieje/TurniejeClient.tsx` (karty; wybór w stanie komponentu, nie w adresie —
`useSearchParams()` wywróciłby build produkcyjny). `opisAwansu()` w
`lib/turniejTabela.ts` zwraca `null`, gdy podpis nic nie wnosi: w lidze i w grupie,
z której awansują wszyscy. `components/turnieje/KartaDruzyny.tsx`
i `SciankaLogowania.tsx` wyszły z klienta do wspólnych komponentów. Testy:
`kartaDruzyny.test.tsx`, `turniejTabela.test.ts`.

### 2026-09-16 — Turniej: widać, kto wygrał mecz i kto wychodzi z grupy

PROBLEM: zakładka „Wyniki" turnieju pokazywała komplet danych, a mimo to nie odpowiadała
na dwa pytania, z którymi się w nią wchodzi. W drabince karta meczu podawała sam wynik
(„1:1"), więc kto przeszedł dalej, trzeba było wywnioskować z następnej rundy — a przy
walkowerze (0:0) i przy karnych (1:1) porównanie liczb daje po prostu złą odpowiedź.
Rzuty karne nie były na karcie widoczne wcale, choć rozstrzygały mecz. W tabeli grupy
wiersze drużyn awansujących miały blade tło i nic nie mówiło, czym ten kolor jest —
czytający widział, że dwa wiersze są inne, bez informacji, dlaczego.

ROZWIĄZANIE BOJO: na karcie meczu zwycięzca jest pogrubiony, przegrany wyszarzony, a pod
wynikiem stoi druga linijka „k. 4:3", gdy mecz rozstrzygnęły karne. Tabela grupy dokłada
do podświetlenia pionowy pasek przy pozycji i podpis pod tabelą — „Pierwsze 2 miejsca
awansują do fazy pucharowej". Podpis pojawia się tylko wtedy, gdy ktoś realnie odpada:
w lidze (jedna tabela, nie ma dokąd awansować) i w grupie, z której wychodzą wszyscy,
znacznika nie ma, bo nie niósłby żadnej informacji.

MECHANIKA: `stronaZwyciezcy()` w `lib/turniejWynik.ts` czyta `turniej_mecze.zwyciezca_id`
— kolumnę ustawianą przez `zakoncz_mecz()` (migracja `147`) — a NIE porównuje wyniku;
to jedyna odpowiedź poprawna dla walkowera, karnych i siatkówki (gdzie `wynik_a` to
wygrane sety). Prezentacja w `components/turnieje/KartaMeczu.tsx` (drabinka i terminarz)
oraz `components/turnieje/TabelaGrupy.tsx`. Dane do oglądania tych stanów bez
kilkudziesięciu kliknięć: `supabase/seed_turnieje.sql` — sześć turniejów zatrzymanych na
różnych etapach. Testy: `turniejWynik.test.ts`.

### 2026-09-16 — Moduł turniejowy odmrożony: ogłoszenia, BLIK, „zamień drużynę w ekipę"

PROBLEM: moduł turniejowy powstawał etapami od migracji `145`, cały czas za flagą
`SHOW_TURNIEJE = false` — nikt poza deweloperem nie miał jak na te trasy wejść. Ostatniej
warstwy brakowało do kompletu: organizator nie miał jak napisać czegoś do wszystkich
drużyn naraz, wpisowe (`wpisowe_grosz` z migracji `145`) nie miało numeru, na jaki
kapitan miałby zapłacić, a turniej kończył się pustką — drużyna, która przez dzień grała
razem, nie miała jak umówić się na kolejny mecz bez zakładania grupy ręcznie.

ROZWIĄZANIE BOJO: `SHOW_TURNIEJE` jest dziś WŁĄCZONA — moduł jest realną, publiczną
funkcją, wejście przez `/moje-gry` i `/profil` oraz udostępniony link. Organizator
publikuje ogłoszenie widoczne dla każdego (jak terminarz), rejestrowani zawodnicy dostają
o nim powiadomienie. W panelu organizator wpisuje numer BLIK do wpisowego (widzi go on
sam i kapitanowie zgłoszonych drużyn) i odznacza wpisowe jako opłacone drużyna po
drużynie. Kapitan drużyny jednym przyciskiem „Zamień drużynę w ekipę" zakłada z niej
trwałą grupę Bojo — cały zapisany skład z kontem dołącza od razu. Stary moduł „BOJO Cup"
(`SHOW_CUP`, martwy od 2026-09-13) został fizycznie skasowany z bazy.

MECHANIKA: migracja `150` dokłada `turniej_ogloszenia` (SELECT publiczny, INSERT/DELETE
dla `czy_zarzadza_turniejem()`, trigger powiadamia każdego zawodnika z kontem
w przyjętej drużynie — typ `turniej_ogloszenie`, jedyny różowy w tym module, bo to
wiadomość), `turniej_blik` (jeden wiersz na turniej, ten sam powód co `event_blik`
z migracji `120`: RLS jest wierszowe, a `turnieje` czyta każdy) i RPC
`zamien_druzyne_w_ekipe()` — SECURITY DEFINER, sprawdza wprost, że wywołujący jest
kapitanem, zakłada `groups` (twórca wchodzi triggerem `add_group_creator_as_member`
z `044`) i dopisuje resztę składu z `user_id` do `group_members`. Migracja `151` kasuje
sześć tabel `tournament_*` i tabelę `tournaments` razem z ich funkcjami — nieodwracalnie,
uruchamiana świadomie. Nowy `lib/turniejShare.ts` (wzorem `groupShare.ts`) generuje tekst
udostępnienia z terminem, miejscem i wpisowym. Testy: `turniejShare.test.ts`, nowa sekcja
w `supabase/test/rls.sql`.

### 2026-09-15 — Alert na bojo.pl łapie kilka sportów naraz

PROBLEM: alert o nowym meczu („Powiadom mnie, gdy się pojawi") trzymał dokładnie
JEDEN sport albo żaden. Kto gra w piłkę i w siatkówkę, miał dwie drogi i obie złe:
wybrać „dowolny sport" i dostawać też koszykówkę oraz tenisa, których nie szuka, albo
założyć dwa osobne alerty i mieć listę, która rośnie z powodu niebędącego powodem.

ROZWIĄZANIE BOJO: w oknie alertu ikony sportów działają tak samo jak w filtrach listy
meczów — dotknięcie dokłada sport albo go zdejmuje, można wybrać kilka. Pusty wybór
dalej znaczy „dowolny sport". Sporty wybrane w filtrach przenoszą się do alertu
w komplecie, nie tylko wtedy, gdy jest jeden. Nazwa alertu na liście w profilu wymienia
dwa sporty po imieniu, a przy trzech i więcej urywa się liczbą, żeby wiersz mieścił się
na telefonie.

MECHANIKA: migracja `152` dokłada `game_alerts.sports text[]` (pusta tablica = dowolny
sport) i przepisuje do niej dawne `sport`; stara kolumna zostaje wypełniona przy
dokładnie jednym sporcie, bo funkcja brzegowa `notify-game-alert` wdraża się osobno od
migracji i przez chwilę może czytać starszą kolumnę. Dopasowanie czyta obie
reprezentacje — tak samo w funkcji brzegowej, jak w `count_alert_seekers`.
`nazwaSportow()` i `znajdzPodobnyAlert()` w `lib/alerts.ts` porównują sporty jako ZBIÓR,
więc „piłka, siatkówka" i „siatkówka, piłka" to ten sam alert. Przy okazji z okna alertu
zeszły dwa akapity tłumaczące mechanikę, wiersz „Dzwonek w aplikacji" dostał kształt
pozostałych kanałów, a pole daty przestało wystawać poza kartę na iOS
(`appearance-none` + `min-w-0` w `WyborKiedy`). Testy: `wieleAlertow.test.ts`,
`alertZFiltrow.test.ts`.

### 2026-09-15 — Alert na bojo.pl nie ma już żadnego ograniczenia czasowego

PROBLEM: zakładając alert o nowych meczach, trzeba było odpowiedzieć, jak długo ma
powiadamiać — Dzisiaj / 3 dni / Tydzień / własny termin z kalendarza. Ten sam rząd
przycisków stoi w filtrach listy meczów i znaczy tam co innego: „pokaż mecze w tym
oknie". Okno alertu otwiera się wprost z filtrów, więc oba pytania były w głowie naraz
i nie dało się ich rozróżnić bez pamiętania, na którym ekranie się stoi. Wcześniej
z tego samego okna zniknęły z tego samego powodu dni tygodnia i pora dnia meczu.

ROZWIĄZANIE BOJO: alert Bojo jest ZAWSZE bezterminowy. Okno pyta o trzy rzeczy — sport,
miejsce z promieniem i kanał — i o nic więcej. Alert gasi się wtedy, gdy przestaje być
potrzebny: linkiem „nie chcę więcej takich wiadomości" w każdej wiadomości (bez
logowania) albo przełącznikiem przy wierszu w profilu. Alert założony wcześniej
z datą końca dalej wygasa o czasie, a profil mówi, do kiedy działa.

MECHANIKA: sekcja „Jak długo powiadamiać" usunięta z `AlertSetupDialog`, okno zapisuje
`expires_at = NULL`. Kolumna i jej obsługa w funkcji brzegowej `notify-game-alert`
zostają nietknięte, tak samo jak `days_of_week` i `godzina_od`/`godzina_do`. Cztery
przeliczniki (`koniecDnia`, `najwczesniejszyKoniec`, `wygasaZKiedy`, `kiedyZWygasniecia`)
usunięte z `lib/alerts.ts`; `dataWygasniecia()` zostaje, bo `opisAlertu()` musi umieć
przeczytać stary wiersz. Edycja starego alertu zeruje jego datę świadomie — termin,
którego nie widać i nie da się zmienić, jest gorszy niż brak terminu.
`alertKoniec.test.ts` skanuje źródło okna i pilnuje, żeby wymiar czasu nie wrócił.

### 2026-09-15 — Filtry w adresie, a zamiar alertu przeżywa logowanie

PROBLEM: filtry listy meczów na bojo.pl/wydarzenia żyły wyłącznie w pamięci strony.
Wylogowany, który ustawił „piłka nożna, dzisiaj" i kliknął „Powiadom mnie o takich
meczach", trafiał na logowanie i wracał na gołą listę — bez filtrów i bez powodu, dla
którego tam kliknął; musiał ustawić wszystko od nowa i sam pamiętać, że chciał alert.
Tego samego braku dotyczyło drugie zgłoszenie: nie dało się wysłać komuś linku do
„piłka, dzisiaj, do 5 km", a każdy powrót albo odświeżenie to ustawianie od zera. Ekran
logowania witał przy tym ogólnym „wejdź na swoje konto, żeby grać i organizować mecze",
czyli odpowiedzią na pytanie, którego nikt nie zadał.

ROZWIĄZANIE BOJO: filtry siedzą w adresie strony, więc link da się wysłać, zapisać
w zakładkach i odświeżyć bez straty. Kliknięcie „Powiadom mnie" przez osobę bez konta
niesie te filtry na logowanie razem z samym zamiarem — po zalogowaniu Bojo wraca do tej
samej listy i od razu otwiera okno alertu. Ekran logowania mówi wtedy wprost, po co ktoś
tam trafił. Adres pokazuje tylko to, co odbiega od ustawień domyślnych, a wartość, której
Bojo nie rozumie, wraca do domyślnej, zamiast pokazywać pustą listę.

MECHANIKA: `lib/filtryListy.ts` (`filtryZAdresu()`/`filtryDoAdresu()`) — nazwy
parametrów wspólne z `/mapa` (`sport` powtarzalny, `km`) plus `kiedy`, `miejsca`, `sort`,
`q`. Odczyt przez `window.location.search` po zamontowaniu, NIE `useSearchParams()`:
`/wydarzenia` jest trasą prerenderowaną, a ten hook wywraca build produkcyjny (pułapka
w AGENTS.md). Zapis przez `history.replaceState`, żeby zmiana filtra nie zasypywała
historii przeglądarki. `logowanieDlaAlertu()`/`zamiarAlertuZAdresu()` w `lib/alerts.ts`
przenoszą zamiar przez `next` ze znacznikiem `alert=1`, który ekran po powrocie zdejmuje
z adresu. `?powod=alert` wybiera zdanie z `POWODY` w `AuthForm`. Dopełniacz „mecz"
ujednolicony na „meczów". Testy: `filtryListy.test.ts`, `wieleAlertow.test.ts`,
`filtry-w-adresie.klikalnosc.spec.ts`.

### 2026-09-15 — Alerty: wiele na konto i własne miejsce w ustawieniach

PROBLEM: konto Bojo mogło mieć tylko JEDEN alert o nowych meczach, ale nic tego nie
mówiło — każde wejście brzmiało „powiadom mnie o takich meczach". Kto miał alert na piłkę
we Wrocławiu i założył drugi na siatkówkę w Poznaniu, tracił pierwszy: po cichu, bez
ostrzeżenia i bez cofnięcia. Do tego alert nie istniał w żadnych ustawieniach — żeby go
zobaczyć albo wyłączyć, trzeba było wejść do wyszukiwarki meczów i natknąć się na jedno
z kilku wejść, rozsianych po dwóch ekranach w trzech różnych wyglądach. Odkąd alert jest
domyślnie bezterminowy, brak takiego miejsca prowadził wprost do oznaczania maili jako
spam.

ROZWIĄZANIE BOJO: alertów może być tyle, ile ktoś chce — osobny na piłkę we Wrocławiu
i osobny na siatkówkę w Poznaniu. Wszystkie stoją w profilu, w ustawieniach powiadomień,
jako lista z nazwą („Piłka nożna · Wrocław 25 km"), informacją jak długo działa i czym
daje znać, przełącznikiem oraz koszem. Wyłączenie zostawia alert na liście, więc wraca
się do niego jednym dotknięciem. Zakładanie alertu z wyszukiwarki bierze bieżące filtry
i mówi to wprost linijką nad polami: „Wypełnione Twoimi filtrami — możesz tu wszystko
zmienić, nie ruszy to listy meczów". Gdy nowy alert łapałby te same mecze co istniejący,
Bojo pyta o to przed zapisem, bo dwa takie same alerty znaczą dwa maile o jednym meczu.

MECHANIKA: bez migracji — `game_alerts` nigdy nie miało unikalności na `user_id`,
a `notifications.alert_id` (migracja `025`) od początku wskazuje konkretny alert. Limit
siedział w `saveAlert()`, które przed każdym zapisem gasiło poprzednie; dziś tego nie robi
(pilnuje `wieleAlertow.test.ts`). `lib/alerts.ts` dostało `getMojeAlerty()`,
`maAktywnyAlert()`, `zaktualizujAlert()` (ten sam wiersz, żeby `wylacz_token` z wysłanych
maili dalej działał), `ustawAktywnoscAlertu()`, `nazwaAlertu()`, `opisAlertu()`
i `znajdzPodobnyAlert()` (próg: połowa mniejszego z dwóch promieni). Nowa karta
`components/profil/MojeAlerty.tsx` pod `/profil#powiadomienia`, obok pusha i poczty.
`AlertSetupDialog` przyjmuje `alert` (edycja) i `default*` (wypełnienie). Wejść jest
dziś dwa na ekran zamiast trzech-czterech: pusty stan i jeden cichy wiersz w arkuszu
filtrów, plus pigułka nad listą na `/mapa`. Goły dzwonek z paska `/wydarzenia` odszedł
razem z zapytaniem o stan alertu, a martwy `components/home/NearbyGames.tsx` został
usunięty. Testy: `wieleAlertow.test.ts`, `mojeAlerty.test.tsx`.

