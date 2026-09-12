# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-09-12 · migracja `144` · 56 tabel

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
| **UKRYTE ZA FLAGĄ** — kod jest, wejścia w nawigacji nie ma | turniej (BOJO Cup), potwierdzenia i przypomnienia SMS, gry cykliczne, rezerwacje obiektów, próg minimum graczy „gra się odbędzie" |
| **NIE ISTNIEJE** — patrz „Czego Bojo NIE robi" | rankingi, ocena poziomu, realne płatności |

Aktualny stan flag i miejsca ich użycia → [docs/funkcje.md](./funkcje.md#flagi-funkcji).
Flagi ukrywają **wejścia w nawigacji, nie trasy**: adres wpisany ręcznie nadal odpowiada.

Odpowiadając na pytanie „czy Bojo ma X", cytuj wyłącznie funkcje ze statusem
**PRODUKCJA**. Funkcja ukryta za flagą nie jest funkcją, którą użytkownik dostanie.

**Pytania, na które odpowiada ta sekcja:** Czy Bojo obsługuje turnieje? Czemu nie widzę
funkcji X w Bojo? Które funkcje Bojo są dostępne dla użytkowników? Czy Bojo wysyła SMS-y?

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

Osobna kategoria: funkcje **zbudowane, ale ukryte za flagami** — turniej (BOJO Cup),
potwierdzenia SMS, gry cykliczne, rezerwacje obiektów, próg minimum graczy „gra się
odbędzie". Kod istnieje, wejścia w nawigacji nie ma. Aktualny
stan flag → [docs/funkcje.md](./funkcje.md#flagi-funkcji).

**Pytania, na które odpowiada ta sekcja:** Czy Bojo ma ranking graczy? Czy Bojo obsługuje
turnieje? Czy przez Bojo zapłacę za boisko? Czy Bojo poleci mi mecz na moim poziomie?

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

### 2026-09-12 — Kolejka rezerwowa i przypomnienia przestają czekać na kliknięcie

PROBLEM: (1) Gdy zwolniło się miejsce, Bojo proponowało je pierwszej osobie z listy
rezerwowej — ale odświeżenie tej oferty zależało WYŁĄCZNIE od tego, czy ktokolwiek
akurat otworzył stronę meczu. Jeśli oferta wygasła (domyślnie po 3 h) i nikt nie wszedł
na stronę, wygasła oferta stała dalej w nieskończoność: następna osoba z kolejki nie
dostawała niczego, a organizator grał w niepełnym składzie mając chętnego na ławce. Po
starcie meczu taka oferta nie wygasała już nigdy. (2) Przypomnienie dzień przed meczem
nie wiedziało nic o zamkniętych zapisach: organizator, który wieczorem zamknął zapisy
przy 10 z 14 osób mówiąc „gramy w tym składzie", dostawał następnego dnia „brakuje 4" —
aplikacja kłóciła się z jego własną decyzją. Dwie osoby czekające na liście rezerwowej
były przy tym całkowicie niewidoczne w treści przypomnienia.

ROZWIĄZANIE BOJO: Kolejka rezerwowa ma teraz własny zegar — co 15 minut Bojo sprawdza
samo, czy jakaś oferta wygasła, i jeśli tak, przekazuje miejsce dalej i powiadamia obie
strony, bez czyjegokolwiek kliknięcia. Przypomnienie dzień przed meczem rozróżnia dziś
trzy stany organizatora: zapisy zamknięte (bez wzmianki o brakujących), brakuje ludzi
i ktoś czeka na rezerwie (z liczbą czekających), albo brakuje ludzi i rezerwa jest pusta
(bez zmian względem wcześniejszego zachowania).

MECHANIKA: migracja `143` — funkcja `porzadkuj_kolejki_rezerwy()` (woła istniejącą
`sync_reserve_claim()` dla aktywnych, przyszłych meczów z niepustą rezerwą, nie powtarza
jej reguł) plus zadanie `pg_cron` `bojo-kolejka-rezerwy` co 15 minut. Migracja `144` —
`wyslij_przypomnienia()` (`129`/`131`) dostaje kolumnę `events.zapisy_zamkniete` (`141`)
i liczbę czekających w kolejce do treści dla organizatora, nowy pomocnik odmiany
`odmien_czeka_na_rezerwie()` wzorem `odmien_nie_oddalo()` z `131`. Testy:
`supabase/test/kolejka-zegar.sql` (nowy), rozszerzony `supabase/test/przypomnienia.sql`.

### 2026-09-12 — Pusta lista meczów przestaje być ślepym zaułkiem: „Powiadom mnie, gdy się pojawi"

PROBLEM: gracz wchodził na listę meczów Bojo, zawężał ją filtrami do tego, czego naprawdę
szuka — sport, okolica, termin — i dostawał „Brak meczów". W tym miejscu Bojo nie oferowało
nic poza wyczyszczeniem filtrów albo wystawieniem własnego meczu; obie odpowiedzi każą
zrobić coś innego, niż się przyszło zrobić. Człowiek wychodził i nie wracał, mimo że mecz
w jego okolicy mógł pojawić się nazajutrz. Alert o nowej grze był w Bojo ZBUDOWANY od
migracji `025` — tabela `game_alerts`, dopasowywanie po sporcie i promieniu, wysyłka mailem
przy każdym nowym meczu — ale schowany za flagą `SHOW_GAME_ALERTS`, wyłączoną w czasach,
gdy Bojo nie miało czym dostarczyć powiadomienia. Kanał (poczta, web-push) działa od
2026-09-08, flaga została wyłączona siłą rozpędu.

ROZWIĄZANIE BOJO: pusta lista meczów pokazuje teraz przycisk „Powiadom mnie, gdy się
pojawi". Alert otwiera się WYPEŁNIONY tym, co gracz przed chwilą ustawił filtrami — sport
i promień — a lokalizację podstawia sam, jeśli przeglądarka ma już zgodę na nią (samo
otwarcie okna nigdy nie prosi o zgodę). Gracz zatwierdza jednym przyciskiem, zamiast
opisywać po raz drugi to samo. Gdy alert już istnieje, pusta lista mówi „Damy znać, gdy
pojawi się pasujący mecz" i pozwala zmienić ustawienia. Osoba niezalogowana trafia stąd na
logowanie. Wybór sportu — w filtrach i w oknie alertu — pokazuje same ikony dyscyplin,
a podpis dopiero przy wybranej; cztery pełne nazwy zajmowały na telefonie dwa wiersze.
Odległość w oknie alertu jest w jednym miejscu, bezpośrednio pod wybranym miejscem, bo to
dopowiedzenie do niego („ile kilometrów OD CZEGO"), a nie osobne pytanie.

MECHANIKA: flaga `SHOW_GAME_ALERTS` (`frontend/src/lib/features.ts`) włączona. Wejście
w `app/wydarzenia/EventsListView.tsx` (pusty stan listy; stan alertu pobierany dopiero,
gdy ten stan realnie widać). `lib/alerts.ts` — `domyslneZFiltrow()` przenosi filtry do
okna alertu (jeden sport przechodzi wprost, dwa i więcej dają „dowolny", promień jest
przycinany do skali suwaka) plus stałe `PROMIEN_MIN/MAX/DOMYSLNY`. `components/home/
AlertSetupDialog.tsx` — lokalizacja z `pozycjaBezPytania()` (`lib/geo.ts`), promień na
wspólnym `components/ui/RangeSlider`, sporty z `lib/sports.ts` zamiast własnej listy.
Nowy `components/ui/SportChip.tsx` używany przez arkusz filtrów i okno alertu. Wysyłką
zajmuje się niezmieniona funkcja brzegowa `notify-game-alert`, wołana z `lib/events.ts`
przy tworzeniu meczu. Bez migracji. Testy: `__tests__/alertZFiltrow.test.tsx`.

### 2026-09-12 — Notatka organizatora przy odwołaniu meczu

PROBLEM: Okno „Odwołać mecz?" mówi wprost, KTO dostanie powiadomienie, ale nie dawało
organizatorowi miejsca, żeby powiedzieć DLACZEGO albo co dalej — „boisko zalane, szukam
zastępczego terminu", „gramy w przyszłą sobotę o tej samej porze". Jedyną drogą było
„Odwołaj i wyślij wiadomość" — osobna wiadomość na czacie meczu, którą widzi tylko ten,
kto tam zajrzy. Kto dostał wyłącznie dzwonek, push albo maila, widział gołe „Organizator
odwołał ten mecz" bez powodu.

ROZWIĄZANIE BOJO: okno odwołania ma dziś pole „Notatka dla uczestników (opcjonalnie)".
Wpisany tekst trafia do WSZYSTKICH kanałów, które i tak już wychodzą przy odwołaniu —
dzwonek w aplikacji, push (ten sam ładunek co dzwonek), mail do uczestnika z kontem, mail
do gościa bez konta — a przy wyborze „Odwołaj i wyślij wiadomość" także na czat. Notatka
pokazuje się też w czerwonym banerze „Mecz odwołany" na stronie meczu, więc widzi ją
każdy, kto trafi tam z linku, nie tylko ten, kto dostał powiadomienie. Notatka jest
nadpisywana przy każdym odwołaniu i czyszczona przy przywróceniu meczu — nie jest to
trwały opis meczu, tylko treść jednego konkretnego zdarzenia.

MECHANIKA: migracja `142` — kolumna `events.notatka_odwolania`; `powiadom_o_odwolaniu()`
(`070`) dopisuje ją do treści dzwonka; `wyslij_mail_do_konta()` (`140`) i
`wyslij_mail_do_goscia()` (`133`/`137`) dokładają pole `notatka` w ładunku do funkcji
brzegowej `powiadom-goscia`, wyłącznie dla powodu odwołania. `cancelEvent()`
i `restoreEvent()` w `lib/events.ts` zarządzają kolumną z aplikacji, wyzwalacz
`wyczysc_notatke_po_przywroceniu()` jest siecią bezpieczeństwa w bazie. Pole notatki
w oknie potwierdzenia — `OpcjeNotatki` w `components/ui/OknoPotwierdzenia.tsx`,
`pobierzNotatke()` w `lib/usePotwierdzenie.tsx`. Ta sama notatka jedzie na czat przez
`tekstOdwolania()` w `lib/eventShare.ts`. Asercje w `supabase/test/notatka-odwolania.sql`
i `frontend/src/__tests__/mailePowiadomien.test.ts`.

### 2026-09-11 — Maile Bojo wyglądają jak narzędzie, a nie jak notatka

PROBLEM: Bojo wysyłało maile wyłącznie jako goły tekst. Odbiorca dostawał ścianę zdań
z wklejonymi adresami URL, bez nagłówka i bez wyróżnionej akcji, a Gmail podkreślał
na niebiesko przypadkowe fragmenty — w tym nazwę ulicy z pola „miejsce" — bo sam zgadywał,
co jest odnośnikiem. Te maile są pierwszym kontaktem z Bojo dla gościa bez konta
i pierwszą wiadomością po założeniu konta, więc działały przeciwko organizatorowi, który
przyprowadził ludzi. Osobno: obrazek podglądu linku (Open Graph) podpisywał się
technicznym adresem Vercela zamiast domeną `bojo.pl` — a to jest dokładnie to, co widzi
kilkanaście osób, gdy organizator wkleja link do meczu na czacie.

ROZWIĄZANIE BOJO: każdy mail wychodzi w dwóch wersjach naraz — graficznej i tekstowej.
Wersja graficzna ma nagłówek z marką, kartę meczu (tytuł, data, miejsce, koszt) wyróżnioną
zieloną krawędzią, jeden przycisk akcji na pełną szerokość ekranu telefonu oraz stopkę
z domeną `bojo.pl` i zaproszeniem do odpowiedzi. Wersja tekstowa niesie tę samą treść dla
czytników ekranu, klientów z wyłączonymi obrazkami i filtrów antyspamowych. Podpis
na obrazku podglądu linku pokazuje domenę kanoniczną.

MECHANIKA: `supabase/functions/powiadom-goscia/tresc.ts` — jedno źródło treści jako lista
bloków (`akapit`, `mecz`, `lista`, `przycisk`, `link`, `drobne`), z którego `doTekstu()`
i `doHtml()` składają obie wersje; dwa równoległe szablony rozjechałyby się przy pierwszej
poprawce. Plik jest czysty (bez `Deno`), więc testuje go Vitest —
`frontend/src/__tests__/mailePowiadomien.test.ts` sprawdza, że każdy z trzynastu powodów
ma obie wersje, że HTML niesie każde zdanie z tekstu, że tytuł meczu od użytkownika wychodzi
zescapowany i że w stopce nie ma adresu `vercel.app`. `powiadom-goscia/index.ts` zostaje
samą wysyłką (Resend, `html` + `text`). `frontend/src/app/opengraph-image.tsx` liczy domenę
z `NEXT_PUBLIC_SITE_URL` z tym samym fallbackiem co `layout.tsx`, `robots.ts` i `sitemap.ts`.
Osobno, poza repo: maile logowania (reset hasła, magic link) idą od 2026-09-11 przez Resend
jako custom SMTP w Supabase.
### 2026-09-11 — Organizator zamyka zapisy, nie odwołując meczu

PROBLEM: Organizator, który na kilka godzin przed meczem ma 10 osób na 14 miejsc i mówi
„gramy w tym składzie", nie miał w Bojo czym tego powiedzieć. Zostawały dwie drogi i obie
kłamały: zmniejszyć liczbę miejsc — czyli zapisać w meczu nieprawdę o boisku, nie do
cofnięcia bez pamiętania, ile miejsc było, a przy osobnej puli dla bramkarzy rozjeżdżające
pułapy ról; albo odwołać mecz — co wysyła całemu składowi wiadomość „mecz odwołany",
dokładnie odwrotną do prawdy. Bez trzeciej możliwości ludzie dopisywali się do składu,
który organizator uważał już za zamknięty, a on dowiadywał się o tym na boisku.

ROZWIĄZANIE BOJO: Na stronie meczu organizator ma „Zamknij zapisy (gramy w tym składzie)".
Od tej chwili nikt nowy nie wejdzie — ani do składu, ani na listę rezerwową — a mecz odbywa
się normalnie: skład zostaje nietknięty, nikt nie dostaje żadnej wiadomości, strona meczu
pokazuje szary pasek „Zapisy zamknięte" zamiast przycisku „Dołącz". Decyzja jest odwracalna
jednym kliknięciem („Otwórz zapisy"). Zamknięcie NIE przeszkadza organizatorowi dopisać
kogoś ręcznie i NIE odbiera miejsca osobom z kolejki rezerwowej: gdy ktoś ze składu się
wypisze, zwolnione miejsce dalej idzie do pierwszej osoby z rezerwy, bo ona jest już
w meczu. Gość zapisany przed zamknięciem dalej odzyskuje link do swojego wpisu.
Zamknięcie zapisów jest stanem rozłącznym z odwołaniem meczu — odwołanie nadal znaczy
„nie gramy" i nadal wysyła powiadomienia. Stan widać też BEZ wchodzenia w mecz: karty na
listach i w wynikach wyszukiwania mają szarą plakietkę „Zapisy zamknięte" zamiast licznika
wolnych miejsc, przycisk „Dołącz" na karcie jest wtedy nieaktywny, a pinezka na mapie niesie
ten sam stan kolorem pigułki składu. Gdy mecz jest jednocześnie pełny i zamknięty, karta
pokazuje „Zapisy zamknięte" — przy zamkniętych zapisach komplet nie wnosi już nic.

MECHANIKA: migracja `141` (kolumna `events.zapisy_zamkniete`, strażniki w funkcjach
`dolacz_do_meczu()` i `dolacz_do_meczu_jako_goscie()` — granica jest w bazie, nie
w interfejsie); `setZapisyZamkniete()` w `lib/events.ts` przez `zaktualizujJedenWiersz()`;
przełącznik i pasek stanu w `app/wydarzenia/[id]/EventDetailClient.tsx`; wygląd stanu na
kartach i pinezce w `lib/stanZapisow.ts` (jedno miejsce dla trzech kart i mapy, wzorem
`lib/komplet.ts`); asercje w `supabase/test/zapisy-zamkniete.sql`,
`src/__tests__/zapisyZamkniete.test.ts` i `src/__tests__/stanZapisow.test.ts`.

### 2026-09-09 — Edycja meczu mówi, co się stanie; poczta dociera też do uczestników z kontem

PROBLEM: Odwołanie meczu miało w Bojo okno, które mówi wprost, kto dostanie powiadomienie
i kto go NIE dostanie. Edycja meczu — czynność wykonywana znacznie częściej i wysyłająca
dwa rodzaje powiadomień oraz maile do gości — kończyła się przyciskiem „Zapisz zmiany"
i przekierowaniem. Organizator nie wiedział ani co realnie zmienił, ani że ekipa właśnie
dostała wiadomość, więc raz pisał to samo drugi raz na czacie, a kiedy indziej nie pisał
wcale. Do tego formularz edycji gubił przy zapisie nazwę i adres miejsca spoza katalogu:
mecz przeniesiony z jednej pinezki na drugą zostawał ze starym adresem pod nową nazwą,
a przeniesiony z katalogu na pinezkę tracił adres całkowicie — również w danych
strukturalnych i w podglądzie linku na czacie. Osobno: uczestnik Z KONTEM bywał gorzej
poinformowany niż gość BEZ konta, bo gość z adresem dostaje maile, a posiadacz konta
tylko dzwonek i push — ten drugi wyłącznie wtedy, gdy sam go włączył. Kto nie włączył
i nie wszedł do aplikacji, o odwołaniu meczu nie dowiadywał się wcale.

ROZWIĄZANIE BOJO: Przed zapisem zmian Bojo pokazuje listę „było → jest" i mówi, ile osób
z kontem dostanie powiadomienie, ilu gości dostanie e-mail, a ilu trzeba powiadomić
samemu; przy zmianie, która nikogo nie powiadamia, mówi to wprost. Druga droga — „Zapisz
i wyślij wiadomość" — otwiera arkusz udostępniania z gotowym tekstem zmiany. Zapis bez
żadnej zmiany nie idzie już do bazy. Pole daty pokazuje dzień tygodnia i odległość
w czasie („sobota, 30 sierpnia · za 3 dni") w kreatorze i w edycji, a zejście z liczbą
miejsc poniżej obsadzonego składu ostrzega, nie blokując. Cztery powiadomienia, przy
których niedoręczenie kosztuje wyjazd na boisko — odwołanie meczu, zmiana terminu, zmiana
miejsca lub kosztu oraz cofnięcie odwołania — idą teraz także e-mailem do osób z kontem,
z możliwością wyłączenia w ustawieniach. Cofnięcie odwołania w ogóle przestało być ciche:
kto dostał wiadomość o odwołaniu, dostaje też sprostowanie.

MECHANIKA: migracje `139` (strażniki `status`/`data` w `powiadom_o_zmianie_terminu()`,
nowy wyzwalacz `powiadom_o_przywroceniu()`, przywrócenie jako powód poczty do gości)
i `140` (`profiles.mail_wylaczone`, `wyslij_mail_do_konta()`, wyzwalacz
`wyslij_mail_po_powiadomieniu()` obok pushowego, indeksy idempotencji z `event_id`);
`lib/zmianyMeczu.ts` (`policzZmiany()`, `komuDojdzie()`, `konsekwencjeZapisu()`),
`lib/events.ts` (`przygotujPolaMeczu()` — wspólna sanityzacja dla tworzenia i edycji,
`custom_location_name`/`custom_address` w `updateEvent()`), `lib/eventDates.ts`
(`opisDaty()`), `lib/eventShare.ts` (`tekstZmiany()`, `tekstPrzywrocenia()`),
`lib/ustawieniaPowiadomien.ts` (`RODZAJE_MAILOWE`), `components/UstawieniaMaili.tsx`,
`app/wydarzenia/[id]/edytuj/page.tsx`, `supabase/functions/powiadom-goscia`.
Testy: `supabase/test/powiadomienia-o-zmianie.sql`, `supabase/test/poczta-do-kont.sql`,
`src/__tests__/zmianyMeczu.test.ts`.

### 2026-09-08 — Lista rezerwowa dotrzymuje tego, co obiecuje

PROBLEM: Bojo mówiło rezerwowemu, że po odpuszczeniu miejsca dostanie kolejną ofertę, gdy
zwolni się następne — i tego nie robiło. To samo dotyczyło osoby, która po prostu nie
zdążyła odpowiedzieć w wyznaczonym czasie: znikała z kolejki na zawsze, bez żadnej
wiadomości. Organizator tracił przez to rezerwowego po jednym nieodebranym powiadomieniu
i nie miał jak się o tym dowiedzieć. Gość bez konta stojący na rezerwie nie dostawał oferty
NIGDY, choć wiadomość po zapisie obiecywała mu ją wprost. Gracz, który sam wycofał prośbę
o dołączenie, dostawał komunikat „Organizator nie przyjął Twojej prośby".

ROZWIĄZANIE BOJO: odpuszczenie i brak odpowiedzi to teraz dwie różne rzeczy. Kto klika
„Odpuszczam", wypada z kolejki i wie o tym z góry. Kto nie zdążył, wraca na koniec kolejki
i dostaje o tym wiadomość — czyli zostaje w grze. Gość bez konta, który podał adres,
dostaje ofertę mailem i może ją przyjąć albo odpuścić na stronie swojego zapisu. Gość bez
adresu jest oznaczony w składzie, żeby organizator wiedział, kogo kolejka pominie. Liczba
„N. w kolejce" liczy się jedną regułą, tą samą co w bazie, i uwzględnia osobne kolejki dla
bramkarzy i dla gry w polu.

MECHANIKA: migracja `135` (kolumna `oferta_wygasla_at`, kolejność kolejki
`ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at`, powiadomienie
`oferta_wygasla`, warunek `auth.uid()` w `powiadom_o_odrzuceniu_prosby()`), migracja `137`
(`sync_reserve_claim()` przyjmuje gościa z adresem, powód poczty `oferta`,
`przyjmij_oferte_goscia()` / `odpusc_oferte_goscia()`, kolumna pochodna `ma_guest_email`),
`lib/kolejkaRezerwy.ts` jako lustro reguły w przeglądarce. Asercje w `supabase/test/rls.sql`
i `supabase/test/poczta-goscia.sql`.

### 2026-09-08 — Kreator nie odsyła już do złego kroku, a wyłączona płatność zostaje wyłączona

PROBLEM: w oknie „Tak zobaczą to gracze" — ostatnim sprawdzeniu przed opublikowaniem meczu
— przycisk „Zmień" przy dacie przenosił organizatora na wybór miejsca, a „Zmień" przy
miejscu na wybór terminu. Osobno: po wyłączeniu przełącznika „Mecz płatny" cena wracała
przy najbliższej zmianie liczby miejsc, więc mecz publikował się jako płatny, bez żadnego
sposobu zapłaty, przy przełączniku pokazującym „wyłączony". Gracz widział kwotę i nie miał
jak jej uregulować.

ROZWIĄZANIE BOJO: układ kroków kreatora ma jedno źródło prawdy, więc podsumowanie nie może
się już z nim rozjechać. Wyłączenie płatności czyści też koszt wynajmu obiektu, z którego
liczona jest cena od osoby, a o tym, czy mecz jest płatny, decyduje przełącznik, nie
resztka w polu. „Zacznij od nowa" wraca do wszystkich ustawień domyślnych.

MECHANIKA: stała `KROK_KREATORA` i funkcja `czyMeczPlatny()` w `lib/eventWizard.ts`,
czytane przez `lib/eventSummary.ts` i `app/wydarzenia/nowe/page.tsx`. Testy
w `eventSummary.test.ts` i `eventWizard.test.ts`.

### 2026-09-08 — Zapisy zamknięte widać przed wypełnieniem formularza, nie po

PROBLEM: osoba bez konta, która weszła z linku od organizatora na mecz z kompletem i bez
listy rezerwowej, widziała zwykły przycisk „Dołącz bez konta". Wypełniała imię, adres
e-mail i sposób płatności, klikała „Zapisz się" i dopiero wtedy dostawała komunikat
o błędzie. Ten sam mecz pokazywał zalogowanym poprawne „Komplet — zapisy zamknięte".

ROZWIĄZANIE BOJO: stan kompletu rozstrzyga się przed pytaniem o konto, więc obowiązuje
wszystkich tak samo. Przy komplecie z listą rezerwową przycisk mówi wprost, że zapis idzie
na rezerwę. Domknięty też przypadek meczu z bramkarzami, w którym pełna jest tylko jedna
rola. Osobno: powiadomienie „Potwierdź, że to Ty" otwierane z telefonu prowadzi teraz na
stronę potwierdzenia, a nie na stronę meczu, gdzie nie ma czego potwierdzić.

MECHANIKA: kolejność gałęzi paska zapisu w `EventDetailClient.tsx`, migracja `136`
(`claim_token` w ładunku powiadomienia push) i `adresPowiadomienia()` w funkcji brzegowej
`send-push`. Asercje w `listaRezerwowa.test.ts`.

### 2026-09-04 — Bojo wita nowego użytkownika i mówi mu, od czego zacząć

PROBLEM: Bojo nie odzywało się do nowego użytkownika ani razu. Przy rejestracji adresem
e-mail przychodziła wyłącznie prośba o potwierdzenie adresu, a przy rejestracji przez
Google — nic. Człowiek zakładał konto, widział pustą listę swoich meczów i nie miał skąd
wiedzieć, że najkrótsza droga do gry prowadzi przez stworzenie własnego meczu i wysłanie
jednego linku znajomym, a nie przez czekanie, aż ktoś w okolicy otworzy grę.

ROZWIĄZANIE BOJO: po założeniu konta przychodzi jedna wiadomość powitalna. Mówi, co Bojo
robi za organizatora (liczy skład, pilnuje limitu miejsc, prowadzi listę rezerwową, dzieli
koszt wynajmu, przypomina wszystkim dzień przed meczem) i prowadzi do trzech dróg
w kolejności od najpewniejszej: stwórz mecz, załóż grupę dla stałej ekipy, przejrzyj
otwarte gry. Trzecia droga jest przy tym uczciwie opisana jako ta, na której przy obecnej
liczbie otwartych meczów nie ma co polegać. Wiadomość wychodzi dopiero po POTWIERDZENIU
adresu, żeby nie przyszła równolegle z prośbą o potwierdzenie i żeby nie witać kogoś, kto
konta nigdy nie potwierdził; przy rejestracji przez Google adres jest potwierdzony od razu,
więc mail idzie natychmiast. Każde konto dostaje ją raz w życiu.

MECHANIKA: migracja `134` — wyzwalacz `powitaj_nowe_konto()` na `auth.users` (reaguje na
przejście `email_confirmed_at` z pustego na wypełnione), `wyslij_mail_powitalny()`,
uogólniony dziennik `maile_wyslane` (dwa możliwe klucze: wpis w składzie albo konto;
powitanie ma idempotencję bez daty, bo idzie raz na konto). Treść w funkcji brzegowej
