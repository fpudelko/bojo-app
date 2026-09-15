# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-09-14 · migracja `149` · 64 tabele

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
| **UKRYTE ZA FLAGĄ** — kod jest, wejścia w nawigacji nie ma | moduł turniejowy (w budowie etapami), potwierdzenia i przypomnienia SMS, gry cykliczne, rezerwacje obiektów, próg minimum graczy „gra się odbędzie" |
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

Osobna kategoria: funkcje **zbudowane, ale ukryte za flagami** — moduł turniejowy (w
budowie etapami), potwierdzenia SMS, gry cykliczne, rezerwacje obiektów, próg minimum
graczy „gra się odbędzie". Kod istnieje, wejścia w nawigacji nie ma. Aktualny
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
`AlertSetupDialog` przyjmuje `alert` (edycja) i `zFiltrow` (skąd wypełnienie). Wejść jest
dziś dwa na ekran zamiast trzech-czterech: pusty stan i jeden cichy wiersz w arkuszu
filtrów, plus pigułka nad listą na `/mapa`. Goły dzwonek z paska `/wydarzenia` odszedł
razem z zapytaniem o stan alertu, a martwy `components/home/NearbyGames.tsx` został
usunięty. Testy: `wieleAlertow.test.ts`, `mojeAlerty.test.tsx`.

### 2026-09-14 — Wyszukiwarka meczów: mniej kontrolek, prostszy alert

PROBLEM: pasek wyszukiwarki meczów łamał się na telefonie na dwa wiersze, bo mieścił
przełącznik trybu, podpisany przełącznik „Lista | Mapa", dzwonek alertu i ikonę filtrów.
Dzwonek nie mówił, co się stanie po dotknięciu, a stał obok DRUGIEGO dzwonka
(powiadomienia), który znaczy coś innego. W arkuszu filtrów suwak „Cena" pytał o górny
limit w złotych, choć mecze w Bojo są albo za darmo, albo za kilkanaście złotych od
osoby, a suwak „Wolne miejsca" kazał trafiać palcem w konkretną liczbę na osi przez cały
ekran. Filtr „Kiedy" był pięciopozycyjnym suwakiem, w którym „Jutro" wykluczało
DZISIAJ, czyli mecz za dwie godziny, a „Ten miesiąc" pod koniec miesiąca znaczyło co
innego niż na jego początku. Okno alertu pytało o sport, miejsce, promień, dni tygodnia
i porę dnia — pięć pytań, z których dwa (dni tygodnia, pora dnia) dublowały „Kiedy"
z filtrów; a przycisk zapisu był wyszarzony bez podania powodu, gdy nikt nie wskazał
miejsca.

ROZWIĄZANIE BOJO: przełącznik „Lista | Mapa" niesie dziś ikony zamiast napisów, a wejście
do alertu jest podpisanym przyciskiem nakładającym się na listę meczów („Powiadom
o takich meczach", a gdy alert już działa — „Damy znać o nowym meczu"). Filtr ceny
zniknął. „Wolne miejsca" ustawia się przyciskami − i +, domyślnie na 1 i w górę do 99,
czyli wyszukiwarka domyślnie pokazuje mecze, do których da się wejść; komplety wracają
jednym dotknięciem „−", a pusta lista mówi o tym wprost odsyłaczem „Zobacz też mecze
z kompletem". „Kiedy" to cztery przyciski w jednej linii — Dzisiaj, 3 dni, Tydzień
i Termin, który odsłania kalendarz „do kiedy"; brak wyboru znaczy wszystkie terminy,
a dotknięcie wybranego odznacza go. Okno alertu pyta już tylko o dwie rzeczy: jak długo
powiadamiać (te same cztery przyciski, brak wyboru = bezterminowo) i czym dać znać
(dzwonek, mail, powiadomienie na telefon, SMS). Dni tygodnia i pora dnia zniknęły
z okna — dublowały „Kiedy" z filtrów. Sport, miejscowość i promień zostają, wypełnione
wartościami z filtrów, jeśli te były ustawione: alert da się otworzyć, zanim ktokolwiek
ruszył filtry, a wtedy miejsce trzeba gdzieś wpisać. Pole przyjmuje nazwę miejscowości
albo kod pocztowy; pinezka obok jest skrótem, nie jedyną drogą — w przeglądarce
wbudowanej w inną aplikację geolokalizacja bywa zablokowana. Gdy miejsca nie ma, Bojo
pisze wprost, dlaczego nie da się zapisać.

MECHANIKA: `SegmentedToggle` przyjmuje `icon` w obu opcjach (nazwa dostępna zostaje
z `label`). Przycisk alertu na `/mapa` to nakładka `absolute bottom-0` nad listą,
z odstępem `calc(var(--bottom-nav-h) + 0.75rem)`. Nowy `components/ui/Stepper.tsx`
zastępuje suwak wolnych miejsc w obu arkuszach (`VenueExplorer.tsx`,
`wydarzenia/EventsListView.tsx`); `MIN_SPOTS_DOMYSLNIE = 1`, a licznik aktywnych filtrów
liczy tę pozycję dopiero przy odchyleniu od jedynki. `filterByMaxPrice()` usunięte
z `lib/eventFilters.ts` razem z filtrem ceny, tak samo martwe `onlyFreeSpots`/
`onlyNoCost`. Koniec alertu trzymają `koniecDnia()` / `dataWygasniecia()` /
`najwczesniejszyKoniec()` w `lib/alerts.ts` — wybrany dzień liczy się cały (23:59:59),
`min` pola daty stoi na jutrze. Okno alertu używa `WyborMiejscowosci` i `SportChip`,
czyli tych samych kontrolek co arkusz filtrów; `alertZFiltrow.test.tsx` pilnuje, że pole
miejscowości w nim jest, a nie sam przycisk lokalizacji. `DateFilter` jest jednym
stringiem także dla własnego
terminu (`do:2026-09-30`), więc wchodzi do adresu bez drugiego pola; zepsuta data
zachowuje się jak brak filtra, a nie jak „nic nie pasuje". `components/ui/WyborKiedy.tsx`
stoi w obu arkuszach i w oknie alertu, a `wygasaZKiedy()`/`kiedyZWygasniecia()` mapują
wybór na `expires_at` i z powrotem. Kolumny `days_of_week`, `godzina_od`/`godzina_do`
z migracji `149` zostają w bazie nietknięte — okno przestało o nie pytać. Testy:
`alertKoniec.test.ts`, `eventFilters.test.ts`, `szukaj-domyslnie-mecze.klikalnosc.spec.ts`.

### 2026-09-14 — Alert o meczach: pora dnia, czas życia i wyłącznik z maila

PROBLEM: alert o nowych meczach w okolicy miał jeden wymiar czasu — dni tygodnia. Nie
miał pory dnia, więc ktoś pracujący do 17 dostawał powiadomienia o meczach o 10 rano.
Nie miał też własnego czasu życia: raz założony działał w nieskończoność, a jedyną drogą
wyłączenia było zalogowanie się i znalezienie okna alertu. Osobno: typ powiadomienia
`game_alert` nie figurował na żadnej z trzech list w aplikacji, bo wstawia go funkcja
brzegowa, a strażnik sprawdzał tylko migracje — alert lądował więc pod szarym dzwonkiem
bez ikony i nie dało się go wyłączyć na telefonie. Okno alertu miało do tego własny
przycisk lokalizacji, własne pole miasta i własny suwak promienia, choć pyta dokładnie
o to samo co arkusz filtrów, tyle że w węższym zakresie kilometrów.

ROZWIĄZANIE BOJO: alert pyta osobno o dwie różne rzeczy i nazywa je osobno — „Powiadamiaj
o meczach" (kiedy ma być mecz: dni tygodnia i pora dnia) oraz „Jak długo powiadamiać"
(jak długo ma żyć alert). Domyślnie alert jest bezterminowy, a każda wiadomość niesie
link „nie chcę więcej takich wiadomości", który gasi go jednym kliknięciem, bez
logowania — bo mail czyta się w skrzynce, często na innym urządzeniu i długo po
założeniu alertu. Okno pokazuje trzy kanały: dzwonek w aplikacji (zawsze), mail
(do wyboru) i powiadomienie na telefon, przy którym Bojo sprawdza, czy ta przeglądarka
w ogóle je obsługuje, i mówi wprost, co trzeba zrobić, gdy nie — na iPhonie dodać Bojo
do ekranu głównego. Alert o nowym meczu da się teraz wyciszyć w ustawieniach powiadomień
jak każde inne. Miejsce i promień wybiera się tymi samymi kontrolkami co w filtrach.

MECHANIKA: migracja `149` dokłada do `game_alerts` kolumny `expires_at` (NULL =
bezterminowo), `godzina_od`/`godzina_do` (parami albo wcale, pilnuje `CHECK`),
`kanal_email` i `wylacz_token`, oraz poszerza promień do 1–100 km. Wyłączanie linkiem
robi `wylacz_alert_tokenem()` (`SECURITY DEFINER`, dostępna dla `anon`) — nie polityka
RLS, bo polityka otworzyłaby całą tabelę na `UPDATE`, a potrzebna jest jedna operacja;
asercje w `supabase/test/rls.sql`. Trasa `/alert/wylacz/[token]` jest `noindex`
i wyłącza alert od razu po wejściu. `notify-game-alert` respektuje wygaśnięcie, okno
godzin i kanał mailowy, a treść maila składa się per adresat, bo link wyłączający niesie
token jego alertu. Push nie dostał drugiego przełącznika: jedzie z wiersza
w `notifications` (wyzwalacz z `102`) i wyłącza się w ustawieniach powiadomień — typ
`game_alert` dopisany do `ikonyPowiadomien.ts` i `ustawieniaPowiadomien.ts`, a
`typyPowiadomien.test.ts` skanuje teraz także `supabase/functions/**`. Okno alertu
(`AlertSetupDialog.tsx`) używa `WyborMiejscowosci` i `SportChip`. Testy: `alertGry.test.ts`,
`alertZFiltrow.test.ts`, `typyPowiadomien.test.ts`.

### 2026-09-14 — Suwak odległości z narastającą podziałką, jeden zamiast dwóch

PROBLEM: promień wyszukiwania wokół miejscowości wybierało się z czterech wartości
(5, 10, 25, 50 km), więc między 10 a 25 km nie istniał żaden wybór. Tam, gdzie promień
był suwakiem (lista meczów), chodził liniowo od 1 do 20 km — a „dalej niż 20" znaczyło
od razu „bez limitu", czyli między sąsiednim osiedlem a całą Polską nie było nic.
Osobno: arkusz filtrów na mapie pokazywał suwak „Odległość" RAZEM z promieniem pod
wybraną miejscowością, choć przy wybranej miejscowości ten pierwszy nie robił już nic —
stał na ekranie, dawał się przesuwać i nie zmieniał wyników.

ROZWIĄZANIE BOJO: promień to jeden suwak od 1 do 100 km, z podziałką gęstą na dole
i rzadką u góry. Kilometry nie są równo ważne: różnica między 2 a 3 km decyduje, czy
idzie się pieszo, a między 80 a 90 km nie znaczy nic. Dlatego 50 km wypada wyraźnie
po prawej stronie suwaka, a nie w połowie, i cały realny zakres decyzji (1–10 km)
dostaje trzecią część długości zamiast jednej dziesiątej. Kontrolka odległości jest
dokładnie jedna i zawsze ta, która działa: przy wybranej miejscowości promień siedzi
pod nią, bez miejscowości — liczy się od pozycji gracza i pyta o to suwak „Odległość
od Ciebie". „Bez limitu" zostaje jako ostatni przystanek za setką.

MECHANIKA: `PROMIENIE_SUWAK_KM` w `lib/miejscowosci.ts` (1, 2, 3, 5, 7, 10, 15, 20, 25,
30, 40, 50, 65, 80, 100) plus `indeksPromienia()` i `promienZIndeksu()`; suwak
`RangeSlider` chodzi po indeksie tablicy, nie po kilometrach. Wartość spoza skali
(stary link, zapisany filtr) trafia na najbliższy przystanek, a przy remisie na
NIŻSZY — filtr nie ma poszerzać się sam. Wszystkie cztery dawne wartości pigułek mają
swój przystanek, więc stare adresy nie przestawiają promienia. Miejsca użycia:
`components/map/WyborMiejscowosci.tsx` (promień pod miejscowością),
`components/map/VenueExplorer.tsx` (suwak tylko przy braku miejscowości) oraz
`app/wydarzenia/EventsListView.tsx`. Lokalne stałe `RADIUS_MIN`/`RADIUS_MAX` (1–20,
liniowo) usunięte z obu widoków. Testy: `promienSuwaka.test.ts`.
### 2026-09-14 — Mecz z czekającą prośbą znowu da się usunąć

PROBLEM: organizator, który włączył „Wymagaj akceptacji" i miał choćby jedną
nierozpatrzoną prośbę o dołączenie, NIE MÓGŁ usunąć swojego meczu. Kliknięcie „Usuń"
nie robiło nic — mecz zostawał na liście, a jedyna informacja o przyczynie szła do
konsoli przeglądarki jako błąd klucza obcego. Nie było obejścia w interfejsie:
odrzucenie wszystkich czekających próśb najpierw działało, ale nikt nie miał powodu
zgadywać takiego związku.

ROZWIĄZANIE BOJO: usunięcie meczu działa niezależnie od tego, kto na nim czeka. Osoba
z nierozpatrzoną prośbą nie dostaje przy tym „Organizator nie przyjął Twojej prośby",
bo nikt jej nie odrzucił — o zniknięciu meczu mówi osobne powiadomienie `mecz_usuniety`.
Odrzucenie POJEDYNCZEJ prośby powiadamia dalej, bez zmian.

MECHANIKA: migracja `148` — `powiadom_o_odrzuceniu_prosby()` (wyzwalacz `BEFORE DELETE`
na `event_participants`) wychodzi bez zapisu, gdy wiersza meczu już nie ma, czyli gdy
DELETE przyszedł kaskadą z `events`. Osłonę wprowadziła `116`, a `135` zdjęła ją po cichu,
biorąc ciało funkcji z `076`. Regresję pilnuje teraz `supabase/test/kasowanie-meczu.sql`
uruchamiany przez `scripts/baza-testowa.sh`, czyli w CI.


### 2026-09-14 — Arkusz filtrów: mniej napisów, sport czytany pod ikonami

PROBLEM: arkusz filtrów na mapie i liście meczów otwierał się trzema rzędami
poświęconymi wyłącznie temu, gdzie szukać: nagłówek „Gdzie szukam", akapit tłumaczący
słowami to, co robi kontrolka pod nim, i osobny przycisk na całą szerokość „Ustaw
pinezkę na mojej lokalizacji" nad polem miejscowości. Pierwsza rzecz do dotknięcia
wypadała nisko. Osobno: ikony sportów pokazywały nazwę dopiero po wybraniu, więc
wybrana ikona rosła w poziomie i przestawiała cały rząd — ikony skakały pod palcem, a
przy dwóch wybranych rząd łamał się na dwa wiersze. W rzędzie stała też piąta ikona
„Wszystkie sporty", czyli dodatkowy cel dotyku na powrót do stanu domyślnego i jedyna
pozycja, która nie jest sportem.

ROZWIĄZANIE BOJO: nagłówek „Gdzie szukam" i akapit pod nim zniknęły — pole mówi
„Miejscowość albo kod pocztowy" swoim placeholderem. Pinezka stoi jako ikona po prawej
stronie tego pola, w jednym wierszu z nim, zamiast osobnego przycisku nad nim. Rząd
sportów to cztery ikony o stałej szerokości, bez piątej „Wszystkie sporty": nic
niewybrane znaczy wszystkie. Co jest wybrane, mówi jedna linijka pod rzędem — wymienia
nazwy po przecinku, nie liczbę. Okno alertu o nowym meczu dostało przy okazji
przełączanie wyboru: ma wybór pojedynczy, więc dotknięcie już wybranego sportu go
odznacza i wraca do „Dowolnego sportu".

MECHANIKA: `components/ui/SportChip.tsx` renderuje sam emoji w kwadracie 44×44 px
(WCAG 2.5.5), nazwa zostaje w `aria-label`/`title`. Podpis pod rzędem składa
`multiLabel()` z `lib/eventFilters.ts`, przepisane tak, żeby wymieniało nazwy zamiast
zwracać „N wybrane" — funkcja nie miała dotąd ani jednego wywołania w interfejsie,
więc nic się na tej zmianie nie opierało. `PrzyciskMojaLokalizacja.tsx` dostał
`wariant` (`pelny` | `ikona`); wariant ikony przyjmuje pole adresu jako `children`
i sam składa wiersz, bo to on trzyma komunikat o odmowie zgody na lokalizację, a ten
musi wypaść pod wierszem, nie obok pola. Miejsca użycia: `WyborMiejscowosci.tsx`,
`VenueExplorer.tsx` (oba arkusze), `app/wydarzenia/EventsListView.tsx`,
`components/home/AlertSetupDialog.tsx`. Testy: `alertZFiltrow.test.tsx`,
`eventFilters.test.ts`.

### 2026-09-13 — Kolejka rezerwowa mówi resztce graczy to, co dotąd mówiła tylko jednej osobie

PROBLEM: dzień wcześniej kolejka rezerwowa dostała własny zegar (patrz niżej) — ale
widoczność stanu kolejki dla kogoś INNEGO niż osoba z akurat aktywną ofertą wciąż
kulała. W liście „Rezerwa — kolejka do zwolnionego miejsca" (widocznej dla każdego na
stronie meczu) badge „czeka na decyzję" nie mówił, DO KIEDY — organizator i reszta
rezerwy nie mieli jak sprawdzić, ile czasu koledze zostało, mimo że własny baner
rezerwowego liczy to od dawna. Gorzej: numer „N." przy każdym wierszu tej listy liczył
się gołym indeksem, nie regułą bazy — przy włączonym rozróżnieniu bramkarzy jedyny
bramkarz na rezerwie znów czytał „4." zamiast „1." (ten sam bug, którego pierwszą wersję
naprawiono wcześniej tylko dla banera „mój", nie dla tej wspólnej listy). Do tego ktoś,
komu oferta WYGASŁA (wrócił na koniec kolejki, ale wciąż gra), nie miał w tej liście
żadnego odznaczenia — tylko treść powiadomienia, którego reszta rezerwy nie widzi.

ROZWIĄZANIE BOJO: lista rezerwy pokazuje dziś dokładnie to, co widzi baza. Numer przy
każdym wierszu liczy się tą samą regułą kolejki (rola + kolejność po wygasłych
ofertach), więc bramkarz w swojej osobnej kolejce ma poprawny numer, a ktoś, kto
odpuścił na stałe, dostaje kreskę zamiast zgadywanej liczby. Badge „czeka na decyzję"
niesie teraz termin („do 18:30" / „do jutra, 18:30"), widoczny dla każdego, nie tylko
dla zainteresowanego. Nowy badge „nie zdążył(a)" oznacza kogoś, kogo oferta właśnie
wygasła — bez sugerowania, że wypadł z gry na stałe.

MECHANIKA: `pozycjaWKolejce()` (`lib/kolejkaRezerwy.ts`) liczy numer w liście zamiast
gołego indeksu z `.map()`; nowy `terminOferty()` w tym samym pliku liczy deadline
z `claim_offered_at` + `events.reserve_claim_minutes`; nowy `krotkiTermin()`
(`lib/eventDates.ts`) formatuje go kompaktowo, świadomie bez nazwy dnia tygodnia (żeby
nie odmieniać przez przypadki jak `dzienTygodniaWBierniku()`). `EventDetailClient.tsx`
— sekcja „Rezerwa — kolejka do zwolnionego miejsca". Testy:
`__tests__/kolejkaRezerwy.test.ts`, `__tests__/eventDates.test.ts`.

### 2026-09-13 — Akcje przy swoim wierszu; zarządzanie graczami w liście składu

PROBLEM: karta z terminem i miejscem meczu miała pod spodem rząd trzech przycisków
z podpisami — „Nawiguj", „O boisku" i „Do kalendarza". Na telefonie nie mieściły się
w jednej linii, więc łamały się na dwa rzędy, a układ 2+1 sugerował hierarchię, której
nie ma. Wszystkie trzy stały pod obydwoma wierszami karty, choć każdy dotyczy tylko
jednego z nich. Do tego nazwa boiska — rzecz, w którą człowiek i tak chce kliknąć —
nie była klikalna, a jej rolę pełnił osobny przycisk „O boisku" obok. Osobno:
organizator dostawał na dole strony meczu kartę „Zarządzanie graczami", która
wypisywała skład drugi raz, tylko po to, żeby doczepić do nazwisk „Usuń" i „Na
rezerwę" — więc widział każdego gracza dwukrotnie i musiał przewijać między dwiema
listami tych samych osób.

ROZWIĄZANIE BOJO: każda akcja stoi przy wierszu, którego dotyczy. Przy dacie ikona
kalendarza (pobiera termin jako plik `.ics`), przy miejscu ikona nawigacji (Mapy
Google). Nazwa obiektu z katalogu jest teraz odnośnikiem — podkreślonym, w kolorze
linku, ze strzałką — i prowadzi na stronę boiska, więc osobny przycisk „O boisku"
zniknął. Miejsce spoza katalogu nie ma strony, więc zostaje zwykłym tekstem, ale
ikona dojazdu stoi przy nim tak samo. Przyciski „Usuń" i „Na rezerwę" organizator ma
przy graczu w liście składu, a osobna karta „Zarządzanie graczami" zniknęła.

MECHANIKA: karta „Kiedy i gdzie" w `app/wydarzenia/[id]/EventDetailClient.tsx` —
dwa wiersze `flex items-start`, każdy z ikoną akcji o polu dotyku 44 px (WCAG 2.5.5)
i własnym `aria-label`/`title` przy 20-pikselowej ikonie. Odnośnik do boiska prowadzi
na `/boisko/[id]` i zapisuje powrót przez `zapiszPowrot()`. Zniknął warunek na
`joinBarVisible`, który ściemniał „Nawiguj”, gdy na ekranie stał zielony „Dołącz do
meczu" — ikona nie konkuruje wagą z niczym, więc nie ma czym sterować. Akcje
zarządzania (`handleRemovePlayer`, `handleCofnijNaRezerwe`) renderują się w gałęzi
listy składu dla `isOwner || canManageSquad` przed startem meczu, z pominięciem
samego organizatora (`p.userId !== event.organizerId`); wiersz ma `flex-wrap`
i `sm:flex-nowrap`, żeby na wąskim telefonie przyciski schodziły do drugiej linii.

### 2026-09-13 — Strona meczu i kreator przestają powtarzać oraz pytać w próżnię

PROBLEM: dolny pasek gracza w składzie mówił „Jesteś w składzie", a zaraz pod spodem
„Masz miejsce w składzie" — ten sam komunikat dwa razy, przy czym słowo „miejsce" znaczy
w Bojo także boisko („Miejsce: Szkoła Podstawowa nr 61"). Pigułki z cechami meczu
(„7 zł / os.", „Prywatne", nazwa ekipy) wchodziły na ekran PRZED datą i adresem, czyli
przed odpowiedzią na dwa pierwsze pytania, jakie zadaje się przy meczu. Karta „Twoja ekipa
tu gra. Nie dasz rady? / Nie zagram" prosiła członka ekipy o deklarację, której NIE
OGLĄDAŁ NIKT: odmowa szła do tabeli, nad którą nie było już żadnego widoku organizatora.
Strona ekipy miała trzy wejścia do zapraszania na jednym ekranie. W kreatorze opis siedział
za przełącznikiem „Dodaj opis", choć tytuł tuż nad nim jest tak samo opcjonalny i stoi
gołe pole; sposoby zapłaty pojawiały się dopiero po wpisaniu kwoty, więc blok wskakiwał
w trakcie pisania i przesuwał układ pod kciukiem. „Gram" w panelu powiadomień zapisywało
na mecz natychmiast, choć panel pokazuje jedno zdanie — bez ceny, godziny i tego, czy
wchodzi się do składu, czy na rezerwę.

ROZWIĄZANIE BOJO: podpis w dolnym pasku został tylko tam, gdzie dokłada fakt — przy
rezerwie („Wejdziesz, gdy ktoś się wypisze") i przy prośbie („Organizator jeszcze nie
potwierdził"). Kolejność na stronie meczu to opis, karta „Kiedy i gdzie", pigułki, licznik
miejsc, skład; cena zostaje nad licznikiem. Karta „Nie zagram" zniknęła, a razem z nią
pytanie o odpowiedź, której nikt nie czytał. Panel zapraszania na stronie meczu nazywa się
„Zaproś" (nie „Zaproś znajomych"), a ze strony ekipy zniknęła trzecia kopia zapraszania —
link do meczu bierze się z samego meczu. W kreatorze opis to zwykłe pole „Opis
(opcjonalnie)", sposoby zapłaty pokazują się razem z przełącznikiem „Mecz płatny",
„Biorę udział" dostało tę samą ramkę co reszta opcji, a karty widoczności mówią krócej:
„Widoczne dla wszystkich — dołączy każdy chętny" i „Nie pojawia się na liście — wejdzie
tylko ktoś z zaproszeniem lub linkiem" (wzmianka o LINKU jest konieczna: prywatny mecz
nie jest szczelny, link wpuszcza każdego). Nowy mecz zakłada się z oknem 60 minut na
odebranie miejsca z rezerwy zamiast 180. „Gram" przy powiadomieniu otwiera stronę meczu
z gotowym oknem zapisu, zamiast zapisywać od razu; „nie gram" zostaje natychmiastowe.

MECHANIKA: `EventDetailClient.tsx` — rząd pigułek przeniesiony pod kartę „Kiedy i gdzie",
podpis paska pod warunkiem `myPendingRequest || amIReserve`, `NieGramButton.tsx` usunięty
(tabela `event_declines`, RLS i `lib/eventDeclines.ts` zostają nietknięte).
`OdpowiedzJednymKlikiem.tsx` dostał `gramOtwieraMecz` i `naPrzejscie` — w `NotificationBell.tsx`
kieruje na `/wydarzenia/<id>?dolacz=1` (ta sama ścieżka co powrót z logowania, sama nie
zapisuje), w `InviteList.tsx` bez zmian. `EventTitleDescriptionField.tsx` bez `ToggleRow`,
stan `descriptionEnabled` usunięty z kreatora, edycji i `lib/eventDraft.ts` (starsze szkice
wczytują się bez zmian). `EventPaymentFields.tsx` przyjmuje `zawszeWidoczne` — kreator
podaje, edycja nie (tam „0" znaczy mecz darmowy). `DOMYSLNE_MINUTY_REZERWY = 60`
w `lib/events.ts` steruje zapisem w `createEvent`/`updateEvent` i `lib/series.ts`; odczyt
starych wierszy i `DEFAULT` kolumny w bazie zostają na 180. `ZaprosZnajomychPanel`
wypięty z `NajblizszyMeczGrupy.tsx`. Asercja paska w `e2e/scenariusze.spec.ts` łapie go
po `data-pasek-dolny`.

### 2026-09-13 — Termin meczu trafia do kalendarza; opis schodzi pod skład

PROBLEM: Bojo przypominało o meczu własnym kanałem (powiadomienie push, e-mail), ale
terminu nie dało się przenieść do kalendarza telefonu — czyli do miejsca, w które
człowiek patrzy, planując tydzień. Kolizja z czymkolwiek innym wychodziła dopiero
w dniu meczu. Dla ekipy grającej co tydzień była to ta sama strata powtarzana
kilkadziesiąt razy w roku. Osobno: opis meczu renderował się jako pierwsza rzecz na
stronie meczu — nad terminem, adresem i licznikiem wolnych miejsc. Opis ma do 1000
znaków, więc organizator, który opisał zasady akapitem, spychał te trzy fakty pod
zgięcie ekranu. I trzecia rzecz: przycisk „Nawiguj" był tak samo zielony i wypełniony
jak „Dołącz do meczu", więc ktoś, kto jeszcze nie zdecydował, czy zagra, widział dwa
równorzędne przyciski, z których jeden prowadził w Mapy Google.

ROZWIĄZANIE BOJO: przy terminie na stronie meczu stoi przycisk „Do kalendarza" —
pobiera plik `.ics`, który iOS i Android otwierają natywnym kalendarzem. Widzi go
każdy, także osoba jeszcze niezapisana, bo kalendarz bywa tym, co rozstrzyga, czy da
się dołączyć; przycisk znika po starcie meczu i przy meczu odwołanym. Pobranie pliku
po zmianie terminu przez organizatora AKTUALIZUJE istniejący wpis w kalendarzu zamiast
dokładać drugi. Opis meczu przeniósł się pod skład, jako karta „O meczu" — nad nim
zostały tylko termin, miejsce i licznik miejsc. „Nawiguj" jest zielony wyłącznie wtedy,
gdy na ekranie nie ma „Dołącz do meczu".

MECHANIKA: nowy `lib/kalendarz.ts` (`zbudujIcs()`, `pobierzIcs()`, `nazwaPliku()`) składa
plik w przeglądarce, bez backendu i bez dodatkowych paczek. `UID` to `bojo-<events.id>`,
stąd aktualizacja zamiast duplikatu. Termin idzie jako czas ścienny
z `DTSTART;TZID=Europe/Warsaw` i pełnym blokiem `VTIMEZONE` — przeliczenie na UTC
wymagałoby przesunięcia strefy w dniu meczu, a to zmienia się dwa razy w roku. Tekst
escapowany wg RFC 5545 §3.3.11, linie zawijane po 75 oktetach (nie znakach — polskie
diakrytyki zajmują w UTF-8 po dwa bajty). Mecz bez `endTime` dostaje 90 minut, mecz
przez północ kończy się następnego dnia. `VALARM` celowo brak: przypomnienie wysyła
Bojo (`lib/reminders.ts`), a alarmu w telefonie nie dałoby się wyłączyć w ustawieniach
powiadomień. Przycisk i handler `handleDoKalendarza` w `EventDetailClient.tsx`, w karcie
„Kiedy i gdzie"; waga „Nawiguj" sterowana `joinBarVisible`, czyli tą samą zmienną co
dolny pasek. Zdarzenie `event_do_kalendarza` w `lib/analytics.ts` (kolumna `event_type`
to zwykły TEXT, migracja `047` — nowa wartość nie wymaga migracji). Testy:
`__tests__/kalendarz.test.ts`.

