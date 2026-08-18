# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-18 · migracja `101` · 34 tabele · 591 testów

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

**Pytania, na które odpowiada ta sekcja:** W jakich miastach działa Bojo? Czy Bojo jest
dostępne w moim mieście? Ile boisk ma Bojo? Jakie sporty obsługuje Bojo? Czy trzeba mieć
konto, żeby przeglądać boiska? Czy trzeba mieć konto, żeby dołączyć do meczu?

---

## Status funkcji

Kluczowe rozróżnienie przy odpowiadaniu na pytania o Bojo: część funkcji jest
**zbudowana, ale niewidoczna dla użytkownika**. Kod istnieje i przejdzie code review,
a mimo to nikt tej funkcji w interfejsie nie znajdzie.

| Status | Co obejmuje |
|---|---|
| **PRODUKCJA** — działa i jest widoczne | katalog boisk i mapa, mecze publiczne i prywatne, zapisy z listą rezerwową, „Obserwuję", drużyny, wyniki, rejestrowanie płatności, grupy, powiadomienia in-app, panel admina |
| **UKRYTE ZA FLAGĄ** — kod jest, wejścia w nawigacji nie ma | turniej (BOJO Cup), alerty o grach w okolicy, potwierdzenia i przypomnienia SMS, gry cykliczne, rezerwacje obiektów |
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

**„Czy gramy?"** Organizator może ustawić `min_players` — ile osób musi być w składzie,
żeby mecz się odbył. Strona meczu pokazuje wprost werdykt („Gramy ✓" albo „Brakuje 2 do
minimum"), zamiast zostawiać to liczeniu w głowie. Członek ekipy, który jeszcze nie
dołączył do meczu przypiętego do jego grupy, może kliknąć **„Nie gram"** — jawna odmowa,
osobna od zgłoszenia nieobecności po meczu i osobna od statystyki „Niezawodność".

**„Otwórz dla okolicy".** Gdy prywatnemu meczowi brakuje ludzi, organizator jednym
kliknięciem zamienia go w publiczny, żeby dołączyli ludzie z sąsiedztwa — to jedyna
rzecz z tego zestawu, której żaden komunikator nie potrafi.

**Pytania, na które odpowiada ta sekcja:** Co się dzieje, gdy mecz w Bojo jest pełny?
Czy rezerwowy wskakuje automatycznie, gdy ktoś zrezygnuje? Czy „Obserwuję" zajmuje
miejsce w składzie? Jak działa akceptacja zapisów przez organizatora? Ilu bramkarzy
mieści się na mecz? Czy Bojo pilnuje minimalnej liczby graczy? Co się dzieje, gdy ekipie
brakuje ludzi do kompletu? Czy da się jawnie odmówić udziału w meczu, zamiast milczeć?

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
alerty o grach w okolicy, potwierdzenia SMS, gry cykliczne, rezerwacje obiektów.
Kod istnieje, wejścia w nawigacji nie ma. Aktualny stan flag →
[docs/funkcje.md](./funkcje.md#flagi-funkcji).

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

### 2026-08-18 — Kiedy kto się zapisał i kto odpadł ze składu

PROBLEM: lista składu w Bojo pokazywała same nazwiska. Nie było widać, kto zapisał się
pierwszy — a to jedyna rzecz, która tłumaczy kolejność na liście rezerwowej („dlaczego
jestem na rezerwie"). Osobno: wypisanie się nie zostawiało ŻADNEGO śladu, bo kasuje wiersz
z listy uczestników. Patrząc na wolne miejsce nie dało się odróżnić „ktoś odpadł" od
„nikt się nie zapisał".

ROZWIĄZANIE BOJO: przy każdym nazwisku w składzie i na liście rezerwowej stoi czas
zapisu — „dziś 18:42", „wczoraj 21:05", „sob 14:32", a przy starszych sama data. Pod
listą jest sekcja „Wypisali się": kto odpadł, kiedy, i czy zrobił to sam, czy usunął go
organizator. Widzi ją każdy, kto widzi mecz.

MECHANIKA: czas zapisu to `event_participants.created_at` (kolumna istniała od migracji
`002`, nie była pokazywana), formatowany przez `etykietaZapisu()` w `lib/time.ts`.
Wypisania: `removeParticipant()` w `lib/events.ts` dopisuje do dziennika meczu wpis
`participant_left` albo `participant_removed` (rozróżnienie z sesji: czy usuwający to ta
sama osoba), a `getWypisania()` je czyta. Migracja `101` dokłada drugą politykę SELECT
na `event_activity_log` obejmującą wyłącznie te dwa rodzaje wpisów — reszta dziennika
(płatności, zmiany ustawień) zostaje przy organizatorze.

### 2026-08-17 — Liczba nadchodzących meczów na „Moje", czytelniejsza chmurka

PROBLEM: kropka przy ikonie w dolnej nawigacji mówi wyłącznie „coś tu jest" — nie wiadomo
co ani ile, dopóki się nie kliknie. Osobno: chmurka wiadomości narysowana ikoną
`MessageCircle` z biblioteki lucide w rozmiarze 12 px zlewała się w nieczytelną plamę.

ROZWIĄZANIE BOJO: na ikonie „Moje" stoi zielona plakietka z LICZBĄ nadchodzących meczów,
w których grasz, czekasz na rezerwie albo je organizujesz — od dzisiaj w przód, bez
odwołanych. Zero nie pokazuje nic, powyżej dziewięciu „9+". Kolor zielony, poza trójką
znaczeniowych kolorów Bojo (różowy = wiadomość, niebieski = wymaga akceptacji,
pomarańczowy = nowość), bo liczba meczów to stan, a nie zdarzenie. Niebieska kropka
„prośba o dołączenie" schodzi do dolnego rogu ikony, żeby nie znikać pod plakietką.
Wskaźnik wiadomości to teraz kształt rysowany pod rozmiar 12 px.

MECHANIKA: `policzNadchodzaceMoje()` w `lib/events.ts` (liczy ten sam zbiór co
`getMyActiveEventIds()`, `head: true` — samo zliczenie, bez wierszy, bo zapytanie leci
przy każdej zmianie trasy), `components/layout/IkonaWiadomosci.tsx` (kształt chmurki
z białą obwódką wpisaną w ścieżkę przez `paint-order: stroke`),
`components/layout/BottomNav.tsx`.

### 2026-08-17 — Chmurka zamiast różowej kropki, dymek o nowej wiadomości w ekipie

PROBLEM: nieprzeczytaną wiadomość Bojo sygnalizowało różową kropką na dolnej nawigacji
i na karcie ekipy. Kropka mówi wyłącznie „coś tu jest" — jej znaczenia trzeba się
nauczyć i zapamiętać, którego koloru dotyczy. Zgłoszone wprost pytaniem użytkownika:
„różowa kropka oznacza, że wiadomość jest nowa?".

ROZWIĄZANIE BOJO: wskaźnik wiadomości ma teraz kształt chmurki (dymka wiadomości),
nie kropki — czyta się bez tłumaczenia. Kolor różowy zostaje, więc związek z plakietkami
nieprzeczytanych na kartach meczów i ekip jest zachowany. Doszedł krótki dymek „Nowa
wiadomość w grupie {nazwa}", pokazywany przy zapaleniu wskaźnika — taki sam jak
istniejący „Nowa gra w grupie {nazwa}". Pomarańczowy wskaźnik („nowa gra") gaśnie razem
ze swoim dymkiem, bo dymek dostarczył właśnie tę wiadomość; różowa chmurka gaśnie
dopiero po przeczytaniu wiadomości.

MECHANIKA: `components/layout/BottomNav.tsx` (kształt wskaźnika, kolejka dymków,
`wygasWskaznik()`), `app/grupy/GroupsClient.tsx` (karta ekipy). Nazwa ekipy do treści
dymka: `getUnreadGroupName()` w `lib/groupPosts.ts` i `getNewGroupEventGroup()`
w `lib/groups.ts` — obie wybierają ekipę z najświeższym wpisem, bo jeden dymek nie
wymieni wszystkich. Wygaszenie zapisuje „widziano" pod tym samym kluczem `localStorage`,
co odwiedzenie strony ekipy, więc kropka znika też z karty na `/grupy`.

### 2026-08-17 — Kasowanie wiadomości w rozmowie znów działa

PROBLEM: usunięcie własnej wiadomości w rozmowie meczu kończyło się w Bojo czerwonym
komunikatem `new row violates row-level security policy for table "event_comments"`,
a wiadomość zostawała. Ta sama usterka dotyczyła tablicy ekipy i komentarzy pod
obiektem — czyli wszystkich trzech miejsc, w których w Bojo się pisze.

ROZWIĄZANIE BOJO: autor kasuje swoją wiadomość, moderator ekipy cudzą na tablicy,
administrator komentarz pod obiektem. Skasowana wiadomość znika z listy i nie wraca
po odświeżeniu. Bojo nie kasuje wiersza z bazy, tylko oznacza go jako usunięty.

MECHANIKA: migracja `100`. Kasowanie jest miękkie (UPDATE ustawiający `deleted_at`),
a polityka `SELECT USING (deleted_at IS NULL)` z migracji `026` wypychała zmieniony
wiersz poza własną widoczność — Postgres sprawdza nowy wiersz TAKŻE politykami SELECT,
więc UPDATE kończył się wyjątkiem, mimo poprawnej polityki UPDATE. Skasowany wiersz
widzi teraz ten, kto miał prawo go skasować (warunek jest lustrem polityki UPDATE danej
tabeli). Odtworzone na gołym Postgresie przez `scripts/baza-testowa.sh`. Osobno
`lib/comments.ts` i `lib/groupPosts.ts` przeszły na `zaktualizujJedenWiersz()`
i `zPonowieniemPoOdswiezeniu()` — zapis, który nie zmienił żadnego wiersza, jest teraz
błędem, a wygasła sesja jest odświeżana i zapis ponawiany.

### 2026-08-17 — Strona meczu: mniej pigułek, czytelniejsze wypisanie się

PROBLEM: nad licznikiem miejsc — najważniejszą informacją na stronie meczu — stało pół
ekranu rzeczy drugorzędnych. Para przycisków „Udostępnij / Kopiuj" powtarzała to, co
niżej robi karta „Wyślij link znajomym", a data, czas trwania i miejsce były osobnymi
pigułkami i razem ze statusem oraz ceną zajmowały cztery wiersze. Osobno: przycisk
„Wypisz się z meczu" był szary i czerwieniał dopiero pod kursorem, czyli na telefonie
nigdy.

ROZWIĄZANIE BOJO: górna para „Udostępnij / Kopiuj" zniknęła — ta sama akcja została
niżej, w karcie z nagłówkiem i zdaniem tłumaczącym, po co to klikać. Meta mieści się
teraz w DWÓCH wierszach: pigułki zostały wyłącznie dla krótkich etykiet (status w meczu,
cena, widoczność, wymaga akceptacji), a data, czas trwania i miejsce są jedną linią
tekstu z ikonami. Nazwa boiska ma dzięki temu dość szerokości, żeby nie urywać się po
trzech słowach. Przycisk wypisania się ma czerwoną ramkę i czerwony tekst od razu.

MECHANIKA: `EventDetailClient.tsx`, sekcja HEADER. Zasada: pigułka jest elementem dla
ETYKIETY — krótkiej i powtarzalnej („Za darmo"); treść o zmiennej długości (data, nazwa
obiektu) traci na niej kilkadziesiąt pikseli na samą oprawę. Wypisanie się zostaje
w wariancie „ramka + tekst", nie pełna czerwień — ta jest zarezerwowana dla akcji
nieodwracalnych, takich jak „Usuń na stałe".

### 2026-08-17 — Zgłaszanie błędów: formularz dla ludzi i automatyczny log awarii

PROBLEM: awaria u użytkownika nie zostawiała ŻADNEGO śladu. `app/error.tsx` wypisywał
błąd do konsoli przeglądarki, której nikt nie ogląda, a zgłoszenie „coś mi wywaliło"
przychodziło zrzutem ekranu bez adresu strony, wersji aplikacji i treści błędu — czyli
w formie droższej do odtworzenia niż sama naprawa.

ROZWIĄZANIE BOJO: Bojo ma stronę `/zglos-blad` (jedno pole na opis, dostępna też bez
logowania; wejście w profilu oraz w stopce) i automatyczne zapisywanie awarii. Osobno,
na stronie obiektu, jest „Zgłoś błąd w danych" z listą powodów — to inna sprawa, bo
katalog pochodzi z OpenStreetMap i takie zgłoszenie NICZEGO nie zmienia automatycznie.
Adres strony, przeglądarkę, wersję aplikacji i identyfikator użytkownika Bojo dokłada
samo — zgłaszający nie musi ich szukać. Administrator ma panel `/admin/bledy` z listą,
licznikiem wystąpień, stosem wywołań i trzema stanami: nowe / w toku / zamknięte.

MECHANIKA: migracja `099` — tabela `zgloszenia_bledow` i RPC `zapisz_zgloszenie_bledu()`
(`SECURITY DEFINER`, jedyne wejście do zapisu; tabela nie ma polityki INSERT, więc klient
nie decyduje o statusie, liczniku ani `user_id`). Czytać może wyłącznie administrator
(`czy_admin()` z `098`) — w adresie strony bywa link do prywatnego meczu. Awarie są
GRUPOWANE po odcisku (komunikat + pierwsza ramka stosu, z wyciętym hashem builda), więc
jeden zepsuty widok daje jeden wiersz z licznikiem zamiast setek kopii, a błąd nie zakłada
nowego wiersza po każdym wdrożeniu. Po stronie klienta: `lib/bledy.ts` (odcisk, jeden
błąd na sesję, twardy limit 10, zapis nigdy nie rzuca wyjątku),
`components/PrzechwytywanieBledow.tsx` (`window.onerror`, `unhandledrejection`),
`lib/zgloszeniaBledow.ts` (odczyt i zmiana statusu dla panelu),
`components/venues/ZglosBladObiektu.tsx` (zgłoszenie przypięte do `field_id`).
Naprawa danych U ŹRÓDŁA idzie osobnym, istniejącym wcześniej odnośnikiem „Zgłoś
poprawkę" — notatka w OSM.

### 2026-08-16 — Zachęta do dodania Bojo na ekran główny

PROBLEM: Bojo dawało się zainstalować (manifest, ikony, service worker — wpis wyżej),
ale nic o tym nie mówiło. Czekało, aż użytkownik sam wpadnie na pomysł — prawie nikt
nie wpada. Na iPhonie to blokuje cały przyszły kanał powiadomień, bo Safari wysyła
push WYŁĄCZNIE do aplikacji dodanej do ekranu głównego.

ROZWIĄZANIE BOJO: po zapisaniu się na mecz na dole ekranu pojawia się pasek „Miej Bojo
pod ręką". Nie na wejściu na stronę — dopiero po tym, jak coś się udało, żeby obietnica
„przypomnimy Ci o meczu" znaczyła coś konkretnego. Na Androidzie pasek ma przycisk
„Dodaj do ekranu", który otwiera systemowe okno instalacji. Na iPhonie przycisku nie ma
i być nie może (Safari nie udostępnia takiego zdarzenia) — jest instrukcja z ikonami
„Udostępnij → Do ekranu początkowego" oraz zdanie mówiące wprost, że bez tego
powiadomienia na iPhonie nie zadziałają. Pasek pokazuje się RAZ: kto go zamknie, ma
spokój. Nie pojawia się osobom, które już zainstalowały, na komputerze ani
w przeglądarce wbudowanej w Facebooka czy Instagrama, gdzie instalacja i tak nie działa.

MECHANIKA: `lib/instalacja.ts` (cała decyzja, kogo i kiedy pytać — osobno od widoku,
więc sprawdzalna testem), `components/ZachetaInstalacji.tsx` (pasek; przechwytuje
`beforeinstallprompt`, żeby pokazać własny przycisk w wybranym momencie zamiast
systemowego paska Chrome). Wywołanie z `EventDetailClient.tsx` po udanym zapisie przez
`zaproponujInstalacje()`. Nowa warstwa `zachetaInstalacji` w `lib/warstwy.ts` —
nad dolną nawigacją, pod modalem. Znacznik odrzucenia: `bojo:instalacja-odrzucona`.

### 2026-08-17 — Składy w osobnej zakładce, Wynik dopiero po meczu, naprawa cichych odmów bazy

PROBLEM: trzy usterki zgłoszone z telefonu. (1) Przypisywanie graczy do drużyn „nic nie
robiło" — ani przesunięcie gracza w lewo/prawo, ani przyciski N i C. (2) Podział na
drużyny mieszkał w zakładce „Wynik", więc żeby poukładać składy PRZED meczem trzeba było
wejść w wynik, którego jeszcze nie ma; sama zakładka „Wynik" istniała od utworzenia meczu
i mówiła wyłącznie, że wyniku jeszcze nie ma. (3) Przełącznik admin/użytkownik na
`/admin/uzytkownicy` przełączał się na ekranie, a po odświeżeniu wracał.

ROZWIĄZANIE BOJO: podział na drużyny jest widoczny WPROST w zakładce „Skład" — nie
w zwijanej sekcji i nie w osobnej zakładce. Zakładka „Wynik" pojawia się dopiero po
rozpoczęciu meczu i zawiera sam formularz, bez drużyn. Zakładka „Rozliczenia" znika przy
meczu za darmo, bo bez kosztu otwierała się pusta. Przypisywanie do drużyn i przełącznik
admina zgłaszają teraz błąd zamiast milczeć, a sama odmowa bazy przy nadawaniu admina
jest usunięta.

MECHANIKA: filtr zakładek w `EventDetailClient.tsx` zależny od `resultsAvailable`
(Wynik) i `event.costGrosze > 0` (Rozliczenia); `skladWynikSection` rozbite na
`druzynySection` (renderowany w zakładce Skład) i `wynikFormSection` (zakładka Wynik).
`updateParticipantTeam` i `updateParticipantPayment` (`lib/eventFeatures.ts`) oraz
przełącznik admina idą przez `zaktualizujJedenWiersz()` (`lib/zapytania.ts`) — gołe
`.update()` przy niepasującej polityce RLS zmienia zero wierszy i zwraca sukces.
Migracja `098`: funkcja `czy_admin()` (`SECURITY DEFINER`) i przepięcie na nią polityk
z `022` i `005`, które sprawdzały uprawnienie podzapytaniem o tę samą tabelę,
na której siedzą.

### 2026-08-16 — Kropka na "Moje" gaśnie po błędzie zapytania zamiast zostać zapaloną na stałe; dymek na skrajnej ikonie nie wystaje poza ekran

PROBLEM: różowa kropka „nowe wiadomości" na „Moje" wracała nawet po naprawie wyścigu
między zapytaniami (poprzedni wpis w tym logu) — zgłoszone wprost, ponownie ze zrzutem,
mimo `/moje-gry` nie znajdującego ani jednej nieprzeczytanej wiadomości. Każdy z czterech
efektów w `BottomNav.tsx` kończył nieudane zapytanie gołym `.catch(() => {})`: błąd (chwilowy
problem sieci, odświeżenie tokenu Supabase w trakcie) zostawiał stan takim, jaki był PRZED
próbą — jeśli ostatnia udana odpowiedź brzmiała „są nieprzeczytane", kropka świeciła dalej
bez związku z rzeczywistością, aż trafiłoby się kolejne udane zapytanie. Osobno: dymek nad
pierwszą („Znajdź grę") i ostatnią („Grupy") z pięciu ikon wyśrodkowywał się nad wąską
kolumną blisko krawędzi ekranu i wystawał poza nią, nieczytelny — też zgłoszone ze zrzutem.

ROZWIĄZANIE BOJO: `catch` w każdym z czterech efektów ustawia teraz jawnie `false`
(`null` dla nazwy grupy) zamiast nic nie robić — brak pewności o stanie wygrywa z fałszywie
zapaloną kropką. Dymek dostał `dymekAlign` (`'left' | 'center' | 'right'`): skrajne kolumny
przypinają go do swojej wewnętrznej krawędzi zamiast centrować nad ikoną, środkowe trzy
zostają wyśrodkowane jak dotąd.

MECHANIKA: `BottomNav.tsx` — każdy `.then(...).catch(...)` w efektach `pendingApproval`/
`unreadEvents`/grupowym (`unreadGroups`, `newGroupEvents`, `newGroupName`, plus zewnętrzny
`getMyGroups().catch()`) resetuje stan na `catch`. `NavLink` dostaje prop `dymekAlign`;
`LEFT_ITEMS`/`RIGHT_ITEMS.map` liczy go z indeksu (`i === 0` / `i === length - 1`) i
przekazuje klasy `left-0`/`right-0` zamiast `left-1/2 -translate-x-1/2` na dymku i jego
trójkącie wskaźnika.

### 2026-08-16 — Naprawiony wyścig zostawiający fałszywą różową kropkę na "Moje"; dymki jeden na raz, 4 sekundy

PROBLEM: różowa kropka „nowe wiadomości" na „Moje" świeciła się nawet wtedy, gdy sama
strona `/moje-gry` (ten sam zestaw danych, ta sama para funkcji) nie znajdowała ŻADNEJ
nieprzeczytanej wiadomości — potwierdzone zrzutem ekranu. Cztery efekty w `BottomNav.tsx`
odpalają zapytanie przy KAŻDEJ zmianie trasy, ale trzy z czterech (prośby, wiadomości
„Moje", wiadomości+nowość „Grupy") nie miały strażnika przed odpowiedzią, która wraca PO
tym, jak trasa zmieniła się ponownie — wolniejsza odpowiedź z poprzedniej trasy mogła
nadpisać świeży, poprawny stan starym `true`, zostawiając kropkę zapaloną bez żadnego
realnego powodu (czwarty efekt, `nearbyNew`, taki strażnik już miał — niespójność w tym
samym pliku była śladem brakującego wzorca). Osobno: dymki wyjaśniające kropki (poprzednia
zmiana) mogły pokazać się dwa naraz i zasłonić się nawzajem, znikały po 1,5 s — za szybko.

ROZWIĄZANIE BOJO: wszystkie cztery efekty mają teraz lokalną flagę `aktualne`, zerowaną
w funkcji sprzątającej — spóźniona odpowiedź z nieaktualnej trasy jest po prostu
ignorowana. Dymki pokazują się teraz TYLKO jeden na raz na całym pasku: nowa kolejka
(`kolejkaDymkow`) zbiera wszystkie typy, które akurat się zapaliły, i pokazuje je po
kolei, każdy na 4 sekundy zamiast 1,5. Wspólny typ „wiadomości" (dawniej jeden dla „Moje"
i „Grupy") rozdzielony na `wiadomosci-moje`/`wiadomosci-grupy` z osobnymi licznikami —
każdy dymek jest teraz jednoznacznie przypięty do jednej ikony przez `href`, więc kolejka
wie, przy której konkretnie ikonie stanąć.

MECHANIKA: `BottomNav.tsx` — `aktualne` w efektach `pendingApproval`/`unreadEvents`/
grupowym (ten sam wzorzec co istniejący `nearbyNew`). Stan `dymekWidoczny` (typ + tekst +
href) zamiast rekordu `dymki` per typ; `kolejkaDymkow` (ref) + `pokazNastepnyDymek()`
serializują wyświetlanie; `timerDymka` (ref) pilnuje pojedynczego aktywnego `setTimeout`
i jest jawnie zerowany, gdy kolejka się opróżni (inaczej kolejny cykl w ogóle by nie
wystartował). `CZAS_DYMKA_MS` z 1500 na 4000.
