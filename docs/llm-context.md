# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-23 · migracja `125` · 45 tabel · 773 testy

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

**Mechanika.** Next.js 14 (App Router) + TypeScript + Tailwind, hosting Vercel. Dane
i autoryzacja: Supabase (PostgreSQL, Google OAuth, Row Level Security). Mapa: Leaflet
z OpenStreetMap. Dane o boiskach zbierają skrypty Pythona (`scraper/`) uruchamiane
ręcznie z GitHub Actions.

**Pytania, na które odpowiada ta sekcja:** Czym jest Bojo? Co robi bojo.pl? Jak znaleźć
mecz w swojej okolicy? Jak zorganizować mecz i zebrać skład? Na czym Bojo jest zbudowane?

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
| **PRODUKCJA** — działa i jest widoczne | katalog boisk i mapa, mecze publiczne i prywatne, zapisy z listą rezerwową, „Obserwuję", drużyny, wyniki, rejestrowanie płatności, grupy, powiadomienia in-app, panel admina |
| **UKRYTE ZA FLAGĄ** — kod jest, wejścia w nawigacji nie ma | turniej (BOJO Cup), alerty o grach w okolicy, potwierdzenia i przypomnienia SMS, gry cykliczne, rezerwacje obiektów, próg minimum graczy „gra się odbędzie" |
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

**„Nie gram".** Członek ekipy, który jeszcze nie dołączył do meczu przypiętego do jego
grupy, może kliknąć **„Nie gram"** — jawna odmowa, osobna od zgłoszenia nieobecności po
meczu i osobna od statystyki „Niezawodność".

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
jawnie odmówić udziału w meczu, zamiast milczeć?

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

**Bojo nie przelewa pieniędzy.** Aplikacja rejestruje, kto zapłacił — nie integruje się
z BLIK-iem ani Stripe'em. Realny przepływ gotówki odbywa się poza aplikacją.

**Pytania, na które odpowiada ta sekcja:** Czy przez Bojo można zapłacić za mecz?
Czy Bojo obsługuje BLIK? Jak Bojo dzieli koszt wynajmu boiska? Czy Bojo akceptuje kartę
Multisport? Co znaczy nieokreślona kwota zniżki?

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
alerty o grach w okolicy, potwierdzenia SMS, gry cykliczne, rezerwacje obiektów, próg
minimum graczy „gra się odbędzie". Kod istnieje, wejścia w nawigacji nie ma. Aktualny
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

### 2026-08-23 — Rozmowy wyglądają jak komunikator, nie jak strona z czatem

PROBLEM: `/rozmowy` i `/rozmowy/[id]` miały nad sobą generyczny pasek serwisu
(logo, „Znajdź grę", dzwonek) — na telefonie ekran wyglądał jak strona ze wstawionym
czatem pod nawigacją, nie jak własna aplikacja do pisania. Lista rozmów nie miała też
szukajki — jedynym sposobem znalezienia konkretnej rozmowy było przewijanie.

ROZWIĄZANIE BOJO: na mobile dla zalogowanego generyczny pasek Header znika CAŁKOWICIE
na obu ekranach (`hideMobileBarForUser`, ten sam wzorzec co `/mapa`) — jego miejsce
zajmuje WŁASNY nagłówek ekranu: tytuł + tożsamość + szukajka na liście, strzałka wstecz
+ imię + menu (blokuj/zgłoś) w rozmowie. Szukajka na `/rozmowy` filtruje w pamięci po
tytule ORAZ zajawce ostatniej wiadomości — cała lista jest już wczytana, więc nie ma po
co wracać do bazy drugi raz. Desktop bez zmian (Header tam nikt nie prosił chować).

MECHANIKA: `RozmowyClient.tsx` (stan `szukane`, filtr przez `foldText()` z
`lib/searchText.ts`, `MobileIdentityRow` zamiast paska Header na mobile);
`DmRozmowaClient.tsx` (`<Header hideMobileBarForUser />`). Bez migracji.

### 2026-08-23 — Scalona wyszukiwarka: „Szukaj" prowadzi na mapę, obiekty mają listę

PROBLEM: Bojo miało DWIE osobne wyszukiwarki meczów i obiektów — `/wydarzenia` (lista,
cel „Szukaj" na dolnej nawigacji) i `/mapa` (mapa, z własnym przełącznikiem Gry|Obiekty).
Dotknięcie „Obiekty" na `/wydarzenia` NAWIGOWAŁO na `/mapa`, gubiąc kontekst — przełączenie
kosztowało przeskok strony. Do tego `/mapa` na telefonie nie miało w ogóle widoku listy:
wyłącznie mapa plus jedna karta wybranej pinezki, bo przewijana lista istniała tylko na
desktopie, obok mapy.

ROZWIĄZANIE BOJO: „Szukaj" prowadzi dziś na `/mapa`, które ma WSPÓLNY, stały pasek dla
obu trybów: przełącznik `Gry | Obiekty` (co pokazać), osobny, WIDOCZNY przełącznik
`Lista | Mapa` (mniejszy wariant tego samego komponentu — nie mały guzik z ikoną), i ikonę
filtrów z plakietką liczby aktywnych. Sport, „Wolne miejsca", „Za darmo" i „Gry dziś"
przeniosły się z paska do arkusza filtrów — przełączenie trybu nie przestawia już
kontrolek miejscami. Telefon dostał pełnoekranowy widok listy w OBU trybach (dawniej
wyłącznie na desktopie); przełączenie na mapę nie odmontowuje jej — Leaflet trzyma
kadr/zoom we własnej instancji, więc powrót z listy wraca do dokładnie tego samego
miejsca na mapie, nie do widoku całej Polski.

MECHANIKA: `components/map/VenueExplorer.tsx` (`SearchToolbar`, `widok` state,
`SegmentedToggle` z nowym `size="sm"`); `BottomNav.tsx` (href „Szukaj" → `/mapa`);
`MapaClient.tsx` przejmuje po `EventsListClient.tsx` gaszenie pomarańczowej kropki
„nowe wydarzenia w pobliżu" (`KLUCZ_WYDARZENIA_WIDZIANO`) i plakietkę „Nowość" na
kartach meczów. `/wydarzenia` zostaje żywe (linki, tło ekranu logowania), ale nie jest
już celem „Szukaj". Bez migracji.

### 2026-08-23 — Kreator meczu: trzy przełączniki zamiast ściany ustawień

PROBLEM: pierwszy krok kreatora Bojo pytał o termin, a drugi zsypywał w jedno miejsce
liczbę miejsc, czas na decyzję z rezerwy, koszt, metody płatności, zniżkę karty sportowej
i tryb miejsc dla bramkarzy. Typowy mecz — darmowy, bez rezerwy, bez podziału na
bramkarzy — nie potrzebuje żadnego z tych ustawień, a i tak trzeba było przewinąć przez
wszystkie. Liczba miejsc, czyli trzecia rzecz po „co" i „kiedy", stała wśród nich.

ROZWIĄZANIE BOJO: krok „Kiedy" niesie termin, czas trwania i liczbę miejsc, a pod nimi
trzy przełączniki DOMYŚLNIE WYŁĄCZONE — „Lista rezerwowa", „Mecz płatny", „Bramkarze
osobno". Szczegóły każdego pojawiają się dopiero po włączeniu; wyłączenie „Mecz płatny"
czyści kwotę i metody, zamiast je chować. Krok drugi to wyłącznie „Gdzie" (mapa
i „Biorę udział"), krok trzeci „Dla kogo" (widoczność, akceptacja, ekipa, tytuł, opis).
Publikacja przechodzi przez okno „Tak zobaczą to gracze" z podsumowaniem meczu —
mecz jest widoczny natychmiast po utworzeniu, więc pomyłka w godzinie rozchodzi się
szybciej, niż da się ją poprawić.

SKUTEK DLA NOWYCH MECZÓW: przełącznik rezerwy wyłączony domyślnie znaczy, że nowy mecz
przy komplecie ZAMYKA zapisy zamiast ustawiać kolejkę. Kto chce kolejkę, włącza ją
w kreatorze albo później w edycji meczu.

MECHANIKA: `frontend/src/app/wydarzenia/nowe/page.tsx`;
`frontend/src/components/events/OpcjaMeczu.tsx` (przełącznik montujący szczegóły, nie
chowający ich CSS-em — ukryte pole nadal wysyła wartość);
`EventCapacityFields.tsx` rozbity na `MiejscaWSkladzie`/`UstawieniaRezerwy`/
`UstawieniaBramkarzy`; walidacja kosztu i bramkarzy przeniesiona na krok 1
w `lib/eventWizard.ts`. Bez migracji.

### 2026-08-23 — Rozmowy prywatne między graczami, razem z blokowaniem

PROBLEM: jedynym pisemnym kanałem w Bojo były rozmowy pod meczem i tablica ekipy — obie
grupowe i obie zawieszone na czymś większym. Prywatne „Kuba, grasz w czwartek?" szło na
Messengera, do ludzi, których gracz zna często TYLKO z boiska i nie ma do nich numeru.

ROZWIĄZANIE BOJO: rozmowa 1-na-1 pod `/rozmowy/[id]`, wejście przyciskiem „Napisz
wiadomość" na profilu gracza, lista wspólna z rozmowami meczów i ekip pod `/rozmowy`.
Blokowanie i zgłaszanie są w tym samym menu, na tym samym ekranie — człowiek, który
właśnie dostał nieprzyjemną wiadomość, nie ma szukać wyjścia w ustawieniach konta.
Blokada działa w obie strony przy pisaniu; historia sprzed niej zostaje widoczna.

MECHANIKA: migracja `125` (`dm_conversations` z parą kanoniczną `low < high`,
`dm_messages`, `user_blocks`, `user_reports`, funkcja `czy_zablokowani()`);
`frontend/src/lib/dm.ts`; wspólne reguły wyglądu czatu w `frontend/src/lib/czat.ts`.

### 2026-08-22 — Lista rezerwowa jest wyborem organizatora, nie stałą regułą

PROBLEM: kreator Bojo ogłaszał pod licznikiem miejsc „Kolejni chętni trafią na listę
rezerwową" i nie dało się tego zmienić; niżej stało jeszcze ustawienie czasu na decyzję
z rezerwy. Mecz na zamkniętą ekipę, halę opłaconą z góry albo ustaloną dwunastkę rezerwy
nie potrzebuje — organizator musiał ją mimo wszystko mieć i tłumaczyć ludziom, po co
„zapisali się na listę".

ROZWIĄZANIE BOJO: przełącznik „Lista rezerwowa" w kreatorze i edycji meczu. Wyłączona
znaczy: przy komplecie zapisy są zamknięte, a kto chce więcej ludzi, podnosi liczbę
miejsc. Wyłączenie NIE kasuje kolejki, która już powstała. Obserwowanie meczu działa
niezależnie od tego ustawienia.

MECHANIKA: `events.reserve_enabled` (migracja `124`, DEFAULT `true`); wyzwalacz
`trg_pilnuj_wylaczonej_rezerwy` na `event_participants` pilnuje reguły po stronie bazy,
z wyjątkiem na `rsvp = 'maybe'` (obserwujący); `EventCapacityFields.tsx` chowa za
przełącznikiem napis i „Czas na decyzję z rezerwy"; `EventDetailClient.tsx` pokazuje przy
komplecie „Komplet — zapisy zamknięte" zamiast wejścia na rezerwę.

### 2026-08-22 — Adres boiska niesie identyfikator, bo nazwy w katalogu się powtarzają

PROBLEM: kafelek na mapie pokazywał boisko na Piotrowie w Poznaniu, a „Zobacz boisko"
otwierało boisko na Mokotowie w Warszawie. Katalog Bojo pochodzi z OpenStreetMap,
a obiekt bez nazwy własnej dostaje przy imporcie nazwę rodzajową („Boisko piłkarskie").
Takich obiektów są tysiące i wszystkie dawały ten sam adres `/boisko/boisko-pilkarskie`,
który otwierał pierwszy obiekt z brzegu. Adres wskazywał kategorię, nie obiekt.

ROZWIĄZANIE BOJO: adres strony obiektu to nazwa plus dwunastoznakowa końcówka
identyfikatora (`/boisko/boisko-pilkarskie-a1b2c3d4e5f6`). Stare adresy z samą nazwą
nadal działają, ale przekierowują na adres kanoniczny — kto trafił ze starego linku,
widzi w pasku adres, który da się wysłać dalej.

MECHANIKA: `slugBoiska()` w `frontend/src/lib/utils.ts`; indeks slug→id w
`frontend/src/app/boisko/[id]/page.tsx` trzyma klucz kanoniczny i historyczny;
linki w `VenueExplorer.tsx` (mapa) i `LandingVenues.tsx`; `canonical` i JSON-LD
na stronie obiektu. Bez migracji — zmiana jest wyłącznie w adresach.
### 2026-08-22 — SEO/GEO Fazy 1-3: opis obiektu wprost, huby wojewódzkie, ankiety o boisku

PROBLEM: strona pojedynczego boiska pokazywała gołe dane (nazwa, adres, sporty) bez
jednego zdania podsumowującego, po które sięga model odpowiadający na pytanie o
konkretny obiekt. Katalog nie miał też punktu wejścia na poziomie województwa — tylko
per sport albo per miasto (Poznań/Warszawa/Kraków) — a stan infrastruktury (oświetlenie,
nawierzchnia) opierał się wyłącznie na danych z OpenStreetMap, czasem nieaktualnych.

ROZWIĄZANIE BOJO: każda strona boiska ma teraz jeden gęsty akapit na górze („[Nazwa] to
obiekt sportowy w [miejscowość] do gry w: [sporty]. [kryty/odkryty], nawierzchnia:
[…], oświetlenie.") — ten sam tekst trafia do danych strukturalnych dla wyszukiwarek.
Doszło 16 stron „Boiska sportowe — województwo [Nazwa]" z pełną listą obiektów.
Gracze mogą potwierdzić dwa fakty o obiekcie — czy jest oświetlony, jaka jest
nawierzchnia — i wynik pokazuje się jako „potwierdzone przez N graczy" dopiero po
dwóch niezależnych głosach; to NIE nadpisuje danych z OpenStreetMap, pokazuje się obok.

MECHANIKA: `content/opisObiektu.ts#opisObiektu()`, wpięty w `VenueDetailClient.tsx`
i w `description` JSON-LD (`SportsActivityLocation`). Huby wojewódzkie:
`/boiska/woj/[wojewodztwo]` (`force-dynamic`, bez prerenderu — katalog jest za duży),
nazwy w `lib/wojewodztwa.ts#WOJEWODZTWO_LABEL`. Ankiety: `AnkietyObiektu.tsx`, tabela
`potwierdzenia_obiektu` (migracja `123`, jeden głos na fakt na osobę, publiczny odczyt).
Kontynuacja Fazy 0 (migracja `112`, tiering indeksacji, `seo_tier`).

### 2026-08-22 — Liczba nieprzeczytanych na ikonie zainstalowanej aplikacji

PROBLEM: o nieprzeczytanej wiadomości w rozmowie meczu albo o prośbie o dołączenie
dowiadywał się dopiero ten, kto sam otworzył Bojo. Powiadomienie push jest sygnałem
jednorazowym — znika z ekranu blokady i po nim nie zostaje żaden ślad, więc telefon
leżący na stole przez godzinę nie mówił nic. Chmurka i dzwonek w nagłówku aplikacji
niosą tę informację dopiero po wejściu do środka, czyli po decyzji, którą właśnie mają
wywołać.

ROZWIĄZANIE BOJO: ikona Bojo na ekranie początkowym telefonu nosi liczbę nieprzeczytanych
— tak samo jak ikona poczty czy komunikatora. Liczba jest sumą wiadomości i pozostałych
powiadomień, pojawia się także wtedy, gdy aplikacja jest zamknięta, i gaśnie po
przeczytaniu. Działa wyłącznie w Bojo dodanym do ekranu początkowego (na iPhonie dodatkowo
po zgodzie na powiadomienia); w zwykłej karcie przeglądarki plakietki nie ma i to nie jest
błąd.

MECHANIKA: `lib/plakietkaAplikacji.ts` (Badging API, `navigator.setAppBadge`/
`clearAppBadge`, każde wywołanie wykrywane i łykane po cichu). Ustawiana z dwóch stron:
`NotificationBell.tsx` przy otwartej aplikacji (suma nieprzeczytanych z obu paneli),
`public/sw.js` przy zdarzeniu `push`, gdy aplikacja jest zamknięta. Service worker nie ma
dostępu do sesji Supabase, więc liczbę dokleja do payloadu funkcja brzegowa `send-push`
(`count` na `notifications` z `read_at IS NULL`); brak liczby oznacza `null` i wtedy worker
plakietki nie dotyka. Wymaga wdrożenia funkcji brzegowej.

### 2026-08-22 — Wiadomość w oknie ciszy odświeża powiadomienie zamiast go gubić

PROBLEM: powiadomienie o nowej wiadomości w rozmowie meczu/tablicy ekipy powstaje
najwyżej raz na godzinę na odbiorcę (celowa ochrona przed spamem — rozmowa przed meczem
potrafi mieć trzydzieści wiadomości w kwadrans). Efekt uboczny: druga i kolejna wiadomość
w tej samej godzinie nie zostawiała żadnego śladu — panel „Wiadomości" w dzwonku
pokazywał zamrożoną treść PIERWSZEJ wiadomości z godziny, podczas gdy osobny panel
„Nieprzeczytane rozmowy" (czyta bez throttlingu wprost z bazy) pokazywał już nowszą.

ROZWIĄZANIE BOJO: kolejna wiadomość w oknie godziny nie ginie — podmienia treść
istniejącego powiadomienia na najnowszą, przesuwa je na górę listy i cofa do stanu
nieprzeczytanego. Limit (najwyżej jedno powiadomienie push/dzwonek na godzinę na
rozmowę) zostaje bez zmian; zmienia się wyłącznie to, że to jedno powiadomienie zawsze
pokazuje ostatnią wiadomość, nie pierwszą.

MECHANIKA: migracja `122` zamienia pomijane wstawienie (`NOT EXISTS ... interval '60
minutes'`) na `UPDATE` istniejącego wiersza + `INSERT` dla reszty w
`powiadom_o_wiadomosci_w_meczu()`/`powiadom_o_wiadomosci_w_grupie()`. Push nie dubluje
się — `trg_wyslij_push` (102) łapie wyłącznie `INSERT`. `NotificationBell.tsx` dostaje
drugą subskrypcję real-time na `UPDATE`, rozróżnia odświeżenie treści od zwykłego
oznaczenia jako przeczytane po tym, czy `created_at` się zmienił.

### 2026-08-22 — Rozmowa meczu i numer BLIK przestają być czytelne dla całego internetu

PROBLEM: Bojo nie ma własnego backendu — przeglądarka rozmawia z bazą (Supabase)
bezpośrednio, a klucz dostępu do API siedzi jawnie w kodzie strony. Jedyną granicą są
reguły dostępu w bazie (RLS), a rozmowy meczów miały regułę bez żadnego warunku na osobę:
treść rozmowy DOWOLNEGO meczu, także prywatnego, dało się pobrać jednym zapytaniem, bez
zakładania konta. Interfejs pokazywał wejście do rozmowy wyłącznie uczestnikom, ale to
była bramka w aplikacji, nie w bazie. Osobno to samo dotyczyło numeru BLIK organizatora:
aplikacja chowała go do godziny przed meczem, a baza oddawała go w każdej odpowiedzi
o mecz, bo reguły dostępu w Postgresie działają na całe wiersze, nie na kolumny.

ROZWIĄZANIE BOJO: rozmowę meczu czyta i pisze wyłącznie ten, kto ma do niej prawo także
w interfejsie — uczestnik meczu, organizator oraz, gdy mecz jest przypięty do ekipy,
członek tej ekipy. Numer BLIK czyta organizator, jego delegat od płatności i uczestnik
meczu; osoba spoza składu widzi zamiast numeru zdanie „numer do BLIKA zobaczysz, jeśli
dołączysz do składu". Reguła „numer dopiero na godzinę przed meczem" zostaje wygodą
interfejsu, nie ochroną. Niezalogowany nie dostaje z bazy ani jednej wiadomości i ani
jednego numeru.

MECHANIKA: migracje `120` i `121`. `czy_widzi_rozmowe_meczu()` (SECURITY DEFINER) wchodzi
do polityk SELECT i INSERT na `event_comments`. Numer BLIK przenosi się z kolumny
`events.blik_phone` do osobnej tabeli `event_blik` z własną polityką, bo `events` czyta
każdy; klient dociąga go osadzeniem `select('*, event_blik(blik_phone)')`
(`lib/blik.ts`, `lib/events.ts`). Kolejność wdrożenia: `120` → deploy → `121`.

