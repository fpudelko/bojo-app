# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-19 · migracja `110` · 38 tabel · 673 testy

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

### 2026-08-19 — Kolejka rezerwowa liczyła czas od obserwowania, nie od zapisu

PROBLEM: gracz, który najpierw kliknął „Obserwuj", a dopiero później „Dołącz", widział
pod swoim nazwiskiem na liście rezerwowej moment rozpoczęcia obserwowania, nie moment
realnego zapisu — bo „Obserwuję" i zwykły zapis to w bazie ten sam wiersz, a przejście
między nimi jest aktualizacją, nie nowym wpisem. Poważniejsze niż zła etykieta: dokładnie
ten sam znacznik ustawia kolejność w kolejce rezerwowej, więc taka osoba wskakiwała
przed każdego, kto zapisał się w międzyczasie, i to ona dostawała każde zwolnione miejsce.

ROZWIĄZANIE BOJO: osobna kolumna `zapisano_at` — wyłącznie moment, od którego liczy się
miejsce w kolejce. Trigger ustawia ją na `now()` (zegar serwera) dokładnie w chwili
przejścia z „obserwuję" na „dołączam", nigdy przy samym obserwowaniu. `created_at` zostaje
nietknięte i nadal znaczy „kiedy powstał wiersz". Rozliczenia w zakładce „Rozliczenia"
dostały przycisk „Wszyscy oddali" (i „Cofnij", gdy już wszyscy oddali) — masowe oznaczenie
całego składu zamiast klikania po jednej osobie, z kwotą liczoną per osoba (zniżka z karty
sportowej). Różowa plakietka z liczbą nieprzeczytanych na karcie meczu prowadzi teraz
prosto do zakładki „Rozmowa"; przytrzymanie „Moje" na dolnej nawigacji otwiera panel
z listą wszystkich rozmów z nieprzeczytanymi (mecze i ekipy razem, od najnowszej). Swipe
w bok przełącza zakładki na `/moje-gry`, `/grupy/[id]` i `/wydarzenia/[id]`.

MECHANIKA: migracja `110` — `event_participants.zapisano_at`, trigger `trg_moment_zapisu`,
`sync_reserve_claim()` sortuje kolejkę po `zapisano_at`. Klient: `momentZapisu()`
w `lib/events.ts` (fallback na `created_at` dla bazy bez migracji). Rozliczenia:
`ustawPlatnoscWszystkim()` w `lib/eventFeatures.ts`, helper `zaktualizujWiersze()`
w `lib/zapytania.ts`. Skrót do rozmowy: plakietka w `EventBrowseCard.tsx` nawiguje na
`?tab=rozmowa`. Panel rozmów: `useDlugieWcisniecie()`, `components/layout/PanelRozmow.tsx`,
`rozmowyZNieprzeczytanymi()`/`rozmowyGrupZNieprzeczytanymi()`. Swipe: `useSwipeZakladek()`
w `lib/useSwipeZakladek.ts`, bez zawijania na krańcach, wyłączony na pasku zakładek
i w miejscach z własnym gestem (podział na drużyny, pole tekstowe rozmowy).

### 2026-08-19 — Ustawienia powiadomień i powiadomienia o wiadomościach

PROBLEM: powiadomienia na telefon działały „wszystko albo nic" — jedyną reakcją na zbyt
wiele było wyłączenie ich w całości, razem z tymi, które naprawdę mają znaczenie
(zwolnione miejsce, odwołany mecz). Osobno: wiadomości w rozmowie meczu i na tablicy
ekipy NIE miały żadnego powiadomienia — nieprzeczytane liczyła sama przeglądarka, więc
o nowej wiadomości dowiadywał się tylko ten, kto i tak otworzył aplikację.

ROZWIĄZANIE BOJO: w profilu, pod przełącznikiem powiadomień, jest rozwijana lista „O czym
powiadamiać" z osobnym przełącznikiem dla każdego rodzaju: zwolnione miejsce, odwołany
mecz, pytanie o udział, zaproszenie, prośba o dołączenie, składy, nowy mecz w ekipie,
wiadomości w meczu, wiadomości w ekipie, ogłoszenia. Rzeczy wymagające reakcji stoją na
górze i mają znacznik „ważne" — Bojo ostrzega, ale nie zabrania ich wyłączyć. Ustawienia
dotyczą WYŁĄCZNIE telefonu: dzwonek w aplikacji pokazuje wszystko.

Doszły powiadomienia o wiadomościach (w meczu i w ekipie) oraz o opublikowaniu składów.
Wiadomości mają zaporę: najwyżej jedno powiadomienie na godzinę z danej rozmowy, bo
rozmowa przed meczem potrafi mieć trzydzieści wpisów w kwadrans, a trzydzieści
powiadomień kończy się wyłączeniem wszystkich.

MECHANIKA: migracja `109` — `profiles.push_wylaczone` (lista WYŁĄCZONYCH, żeby nowy rodzaj
był domyślnie aktywny), filtr w wyzwalaczu wysyłki, wyzwalacze na `event_comments`,
`group_posts` i `events.teams_published`. Klient: `lib/ustawieniaPowiadomien.ts`
i `components/PowiadomieniaPush.tsx`. Przy logowaniu przez Google Bojo prosi teraz zawsze
o wybór konta (`prompt=select_account`) — bez tego przy kilku kontach Google logowało od
razu na pierwsze z brzegu.

### 2026-08-18 — Propozycja włączenia powiadomień na stronie meczu

PROBLEM: powiadomienia na telefon dało się włączyć wyłącznie przełącznikiem w profilu,
a do profilu nikt nie zagląda. Funkcja, o której trzeba dowiedzieć się samemu, dla
większości ludzi nie istnieje — a akurat ta decyduje, czy Bojo dowozi informację o meczu,
czy przegrywa z komunikatorem.

ROZWIĄZANIE BOJO: na stronie meczu, w którym gram, pojawia się karta „Damy znać, gdy coś
się zmieni" z konkretem, co przyjdzie: ktoś napisze do ekipy, zwolni się miejsce, mecz
zostanie odwołany. Systemowe okno zgody otwiera się DOPIERO po kliknięciu „Włącz" —
Bojo nigdy nie prosi o zgodę samo z siebie, bo prośba na wejściu kończy się trwałym
„Zablokuj", którego nie da się cofnąć ze strony. „Nie teraz" odkłada pytanie o 30 dni,
nie chowa go na zawsze. Na iPhonie bez zainstalowanej aplikacji karta pokazuje instrukcję
dodania do ekranu głównego zamiast przycisku, który nie mógłby zadziałać.

MECHANIKA: `components/events/ZachetaPush.tsx` renderowany w zakładce „Mecz" wyłącznie
dla uczestnika przed rozpoczęciem meczu; `odlozZachetePush()` i `czyZachetaOdlozona()`
w `lib/push.ts` (klucz `bojo:push-odlozone`). Przełącznik w profilu zostaje jako miejsce,
w którym powiadomienia da się wyłączyć.

### 2026-08-18 — Administrator przestaje być organizatorem cudzego meczu

PROBLEM: administrator platformy widział na stronie każdego meczu pełny panel organizatora
— losowanie składu, przypisywanie drużyn, gwiazdkę kapitana, ustawienia. Reguły dostępu
w bazie znały wyłącznie organizatora i jego delegatów, więc kontrolki się pokazywały,
klikały i kończyły czerwonym komunikatem o uprawnieniach. Łatane trzy razy z rzędu i za
każdym razem wychodziło kolejne miejsce: przełącznik ról, zapis taktyki, przypisanie
drużyny, poparcie propozycji składu. Osobno: przycisk „Popieram" przy propozycji składu
widział każdy, a poprzeć może wyłącznie gracz tego meczu.

ROZWIĄZANIE BOJO: administrator ogląda mecz jak każdy inny użytkownik. Meczem zarządza
organizator i osoby, którym on nadał uprawnienia; administrator ma własne ekrany
(`/admin/*`). Licznik poparcia przy propozycji składu widzą wszyscy, ale klikalny jest
tylko dla grających — przycisk, który u kogoś z zewnątrz zawsze kończy się błędem, jest
gorszy niż jego brak.

MECHANIKA: `isOwner` w `EventDetailClient.tsx` to teraz `user.id === event.organizerId`
(bez `|| isAdmin`), migracja `108` cofa dodane godzinę wcześniej `czy_admin()` z polityk
`event_participants` (uprawnienie bez zastosowania to wyłącznie ryzyko). `TeamProposals`
dostał prop `mozeGlosowac`, spójny z polityką `Participant votes` z migracji `059`.
Moderacja samego wydarzenia przez administratora (`005`) zostaje bez zmian.

### 2026-08-18 — Taktyka: publikacja, pozycje z nazwami, zakładka „Mecz"

PROBLEM: kapitan układał ustawienie na oczach drużyny — każda pośrednia wersja była
widoczna i nie dało się odróżnić „tak gramy" od „tak akurat wyszło". Pozycje na boisku
miały skróty „OB" i „PM", czyli mówiły to samo, co widać po wysokości na boisku. Gracza
dało się przypisać wyłącznie w kolejności pozycja → nazwisko. Zakładka „Skład" trzymała
opis meczu, termin, miejsce, licznik, listę graczy i zapisy — czyli cały mecz. Osobno:
administrator widział panel organizatora, ale przypisanie gracza do drużyny kończyło się
komunikatem o braku uprawnień.

ROZWIĄZANIE BOJO: kapitan ma przełącznik „Opublikuj taktykę" — do tego czasu widzi ją sam,
a drużyna czyta „Taktyka jeszcze nieustalona" i normalnie rozmawia na czacie. Pozycje
nazywają się jak w piłce: LO, ŚO, PO, ŚPD, LP, ŚPO, LN, N. Gracza przypisuje się w obie
strony — stukasz pozycję i nazwisko albo nazwisko i pozycję. Zakładka „Skład" nazywa się
teraz „Mecz". Kapitan jest JEDEN na drużynę: nadanie gwiazdki komuś nowemu zdejmuje ją
poprzedniemu.

MECHANIKA: migracja `107` (`event_team_setup.opublikowana`, `czy_taktyka_opublikowana()`,
zawężone polityki SELECT) i `106` (`czy_admin()` w politykach `event_participants` —
interfejs traktował admina jak organizatora, baza nie). `lib/taktyka.ts`: `opisPozycji()`
wylicza skrót z linii i strony boiska. `setCaptain()` w `lib/eventFeatures.ts` zdejmuje
poprzedniego kapitana tej samej drużyny.

### 2026-08-18 — Taktyka: ustawia kapitan, widzi drużyna

PROBLEM: pierwsza wersja zakładki „Taktyka" pokazywała OBIE drużyny i była dostępna
wyłącznie dla administratora platformy — czyli gracz nie widział własnej taktyki, a osoba
z zewnątrz widziała cudzy czat drużyny. Osobno: wśród gotowych odpowiedzi „Od połowy"
i „Na swojej połowie" opisywały to samo cofnięcie się, a lista zamknięta nie miała miejsca
na „my gramy inaczej". Zakładka pokazywała też opis meczu, datę i miejsce — czyli rzeczy
z zakładki „Skład", przez które trzeba było przewijać.

ROZWIĄZANIE BOJO: zakładkę widzi ten, kto GRA w meczu, i wyłącznie SWOJĄ drużynę.
Ustawienie, pozycje i taktykę zmienia KAPITAN (wskazuje go organizator w „Składzie"
gwiazdką przy nazwisku); reszta drużyny widzi gotowy opis bez ani jednego przycisku.
Przy każdym pytaniu jest „Inne" z polem tekstowym. Pytanie o pressing brzmi teraz „Gdzie
odbieramy piłkę" i ma dwie wykluczające się odpowiedzi: „Pod ich bramką" albo „U siebie".
Boisko jest mniejsze i pozycje odsunięte od linii bocznych, żeby imiona się mieściły.
Szczegóły meczu (opis, termin, miejsce, licznik miejsc) zostają wyłącznie w „Składzie".

MECHANIKA: migracja `105` — `czy_kapitan_druzyny()` w politykach zapisu na
`event_team_setup` i `event_team_slots`, czat przez `czy_w_druzynie()` bez administratora
(cofnięcie `104`). `lib/taktyka.ts`: `WARTOSC_INNE`, `odpowiedzTaktyki()`, margines pozycji
20% zamiast 12%. `components/events/TaktykaDruzyny.tsx` renderuje tryb do czytania, gdy
patrzący nie jest kapitanem. Nagłówek meczu w `EventDetailClient.tsx` gatowany na
`tab === 'sklad'`.

### 2026-08-18 — Naprawa: administrator nie mógł zapisać taktyki

PROBLEM: zakładka „Taktyka" otwierała się, ale każde kliknięcie kończyło się czerwonym
komunikatem `new row violates row-level security policy`. Zakładka jest dziś widoczna
wyłącznie dla administratora platformy, a reguły dostępu w bazie znały tylko organizatora
meczu, jego delegata i członka drużyny — czyli jedyna osoba, która mogła ten widok
otworzyć, nie mogła w nim nic zapisać.

ROZWIĄZANIE BOJO: administrator zapisuje ustawienie, pozycje i pisze w czacie drużyny.
Kasowanie cudzych wiadomości zostaje przy autorze — tak samo jak w rozmowie meczu.

MECHANIKA: migracja `104` dokłada `czy_admin()` (z `098`) do polityk zapisu na
`event_team_setup` i `event_team_slots` oraz do odczytu i wstawiania w
`event_team_messages`. Odtworzone na gołym Postgresie: na politykach z `103` zapis
kończy się wyjątkiem, po `104` przechodzi, a osoba spoza meczu nadal nie zapisze niczego.
Zasada na przyszłość: jeśli widok jest za bramką `isAdmin`, `czy_admin()` musi być
w polityce od pierwszego dnia — to ta sama klasa błędu co w `098`.

### 2026-08-18 — Taktyka drużyny: ustawienie, pozycje i osobny czat (na razie tylko admin)

PROBLEM: po opublikowaniu składów każda drużyna była wyłącznie listą nazwisk. Kto gra
w obronie, kto na skrzydle i co robimy z piłką — ustalało się ustnie przed meczem, więc
połowa składu tego nie słyszała. Osobno: rozmowa meczu jest wspólna dla obu drużyn, więc
nie dało się w niej uzgodnić niczego, czego nie ma przeczytać rywal.

ROZWIĄZANIE BOJO: zakładka „Taktyka", widoczna po opublikowaniu składów. Dla każdej
drużyny osobno: wybór ustawienia z listy dobranej do liczby graczy (od 1-2-2 na orliku po
1-4-2-3-1 na pełnym boisku, z opisem co dane ustawienie robi), boisko z pozycjami —
gracza stawia się dwoma stuknięciami, bez przeciągania — cztery decyzje taktyczne
(jak bronimy, wyjście od bramkarza, kiedy atakujemy rywala, tempo gry), notatka na stałe
fragmenty oraz czat wyłącznie dla tej drużyny. Druga drużyna czatu nie widzi.

MECHANIKA: migracja `103` (`event_team_setup`, `event_team_slots`, `event_team_messages`,
funkcja `czy_w_druzynie()`), `lib/taktyka.ts` (katalog ustawień; pozycje na boisku
wyliczane ze schematu tekstowego, więc nowe ustawienie to jedna linia w katalogu, bez
migracji), `lib/taktykaApi.ts`, `components/events/TaktykaDruzyny.tsx`. Zakładka jest na
razie za bramką administratora — polityki w bazie są już docelowe (dla uczestników meczu),
więc udostępnienie jej wszystkim to zdjęcie jednego warunku w interfejsie.

### 2026-08-18 — Spójny pasek szukania i filtrów między „Znajdź grę" a „Mapa"

PROBLEM: dwie zakładki tego samego dolnego paska wyglądały jak dwa różne ekrany. Pole
szukania na mapie stało 8 px wyżej i miało inne zaokrąglenie, więc przy przełączaniu
przeskakiwało. Podpowiedź w polu ucinała się w połowie słowa („Szukaj boiska po nazwie
lub a…"). Pigułki filtrów zmieniały kolejność: sport stał raz przed „Filtry", raz po —
przy przełączaniu Gry↔Obiekty palec trafiał w inny filtr niż sekundę wcześniej.

ROZWIĄZANIE BOJO: pole szukania ma tę samą geometrię i ten sam odstęp od góry na obu
zakładkach (na mapie zostaje białe tło z cieniem, bo leży na mapie). Podpowiedź jest
krótka i mieści się w całości: „Nazwa boiska albo adres" dla obiektów, „Nazwa albo
boisko" dla gier. Kolejność pigułek jest wspólna: najpierw zakres (sortowanie albo tryb
mapy), potem sport, potem „Filtry", na końcu przełączniki.

MECHANIKA: `components/map/VenueExplorer.tsx` (jeden dropdown sportów zamiast dwóch
renderowanych w różnych miejscach zależnie od trybu; `px-4 pt-5` i `rounded-2xl` jak
w `EventsListView`), `app/wydarzenia/EventsListView.tsx` (przycisk „Filtry" przeniesiony
za dropdown sportów).

### 2026-08-18 — Powiadomienia push na telefon

PROBLEM: każde powiadomienie Bojo czekało, aż użytkownik SAM otworzy aplikację.
Przy stałej ekipie wyglądało to tak: organizator zakłada mecz w czwartek, a ludzie
dowiadują się o tym na komunikatorze — czyli Bojo przegrywało w jedynej rzeczy, która
decyduje o zebraniu składu.

ROZWIĄZANIE BOJO: Bojo wysyła powiadomienia na telefon, także gdy aplikacja jest
zamknięta. Włącza się je jednym przełącznikiem w profilu („Powiadomienia na telefon");
dotyczą tego samego, co dzwonek w aplikacji: nowy mecz ekipy, wiadomość w rozmowie,
zwolnione miejsce z rezerwy, prośba o dołączenie. Na iPhonie push działa WYŁĄCZNIE po
dodaniu Bojo do ekranu głównego — to ograniczenie systemu, więc Bojo rozpoznaje ten
przypadek i pokazuje instrukcję zamiast martwego przycisku. Kliknięcie powiadomienia
otwiera dokładnie ten mecz albo tę ekipę, której dotyczy.

MECHANIKA: migracja `102` — `push_subscriptions` (jeden wiersz na przeglądarkę) i wyzwalacz
`trg_wyslij_push` na `notifications`, który przez `pg_net` woła funkcję brzegową
`send-push`. Wysyłka po stronie bazy, nie aplikacji, bo powiadomienia powstają
w wyzwalaczach i aplikacja często nie wie, że powstały (mecz zakłada jedna osoba,
powiadomienia dostaje dziesięć). Klient: `lib/push.ts` i `components/PowiadomieniaPush.tsx`,
service worker `public/sw.js` (od etapu PWA). Uruchomienie wymaga ręcznych kroków
(klucze VAPID, sekrety, wdrożenie funkcji) → `supabase/functions/send-push/README.md`.

