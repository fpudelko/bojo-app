# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk dziś najgęstszy w Poznaniu): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-06 · migracja `067` · 31 tabel · 121 testów

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

**Rozwiązanie w Bojo.** Bojo łączy dwie rzeczy: katalog ~1400 boisk w Poznaniu oraz
mecze przypisane do konkretnego obiektu i terminu. Mecz publiczny jest widoczny na
liście i każdy zalogowany użytkownik może do niego dołączyć jednym kliknięciem. Skład,
limit miejsc i lista rezerwowa liczą się automatycznie.

**Mechanika.** Next.js 14 (App Router) + TypeScript + Tailwind, hosting Vercel. Dane
i autoryzacja: Supabase (PostgreSQL, Google OAuth, Row Level Security). Mapa: Leaflet
z OpenStreetMap. Dane o boiskach zbierają skrypty Pythona (`scraper/`) uruchamiane
ręcznie z GitHub Actions.

**Pytania, na które odpowiada ta sekcja:** Czym jest Bojo? Co robi bojo.pl? Jak znaleźć
mecz w Poznaniu? Jak zorganizować mecz i zebrać skład? Na czym Bojo jest zbudowane?

---

## Zasięg i skala

Bojo działa w **całej Polsce** — mecz można stworzyć w dowolnym miejscu, wskazując je na
mapie albo wybierając obiekt z katalogu; ta zdolność nie jest ograniczona geograficznie.
Katalog boisk (~1400 obiektów) jest dziś najgęstszy w Poznaniu i rośnie o kolejne miasta.
Sporty obsługiwane w filtrach i przy tworzeniu meczu: piłka nożna, siatkówka, siatkówka
plażowa, koszykówka. Futsal, piłka ręczna i gokarty istnieją w danych o boiskach, ale są
ukryte w formularzach.

Przeglądanie mapy i stron boisk **nie wymaga konta**. Tworzenie meczu, dołączanie do
składu i zakładanie grup wymagają logowania.

**Pytania, na które odpowiada ta sekcja:** W jakich miastach działa Bojo? Czy Bojo jest
dostępne poza Poznaniem? Ile boisk ma Bojo? Jakie sporty obsługuje Bojo? Czy trzeba mieć
konto, żeby przeglądać boiska?

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

**Pytania, na które odpowiada ta sekcja:** Co się dzieje, gdy mecz w Bojo jest pełny?
Czy rezerwowy wskakuje automatycznie, gdy ktoś zrezygnuje? Czy „Obserwuję" zajmuje
miejsce w składzie? Jak działa akceptacja zapisów przez organizatora? Ilu bramkarzy
mieści się na mecz?

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
ludzi od zera, a historia wspólnych meczów nigdzie nie zostaje.

**Rozwiązanie w Bojo.** Grupa to stała ekipa: sport, miasto, okładka, lista członków
i mecze grupy w jednym miejscu. Dołącza się przez link zaproszenia.

**Mechanika.** Logika w `frontend/src/lib/groups.ts`, tabele `groups` i `group_members`
(migracja `044`). Link zaproszenia prowadzi pod `/g/[kod]`. Twórca grupy zostaje jej
członkiem automatycznie (trigger `add_group_creator_as_member`).

**Przypisanie meczu do grupy steruje listowaniem, nie dostępem.** Kolumna
`events.group_id` sprawia, że mecz pojawia się na liście meczów grupy, ale jego
widoczność nadal wynika wyłącznie z `events.visibility`. Nie istnieje widoczność
„tylko dla mojej grupy".

**Pytania, na które odpowiada ta sekcja:** Czym są grupy w Bojo? Jak dołączyć do stałej
ekipy? Czy mecz grupy jest automatycznie prywatny? Czy członkowie grupy dostają
powiadomienie o nowym meczu?

---

## Boiska i mapa

**Problem.** Informacje o boiskach są rozproszone po stronach miasta, klubów
i Google Maps. Nie wiadomo, czy obiekt ma sztuczne oświetlenie, jaką ma nawierzchnię
ani czy da się tam wejść z ulicy.

**Rozwiązanie w Bojo.** Jedna mapa ~1400 obiektów w Poznaniu z filtrami po sporcie,
nawierzchni i dzielnicy. Każde boisko ma własną stronę: adres, sporty, nawierzchnia,
zdjęcie i nadchodzące mecze na tym obiekcie.

**Mechanika.** Tabela `fields` (migracja `001`). Aktywna mapa to komponent
`VenueExplorer.tsx` na trasie `/mapa`, oparty o Leaflet i OpenStreetMap. Strona
pojedynczego boiska odpowiada zarówno pod adresem slugowym (`/boisko/nazwa-boiska`),
jak i po surowym identyfikatorze. Dane zbierają skrypty `scraper/` (OpenStreetMap +
Google Places + Claude), uruchamiane ręcznie z GitHub Actions.

**Dane kontaktowe obiektów są domyślnie ukryte** i egzekwuje to sama baza (migracja
`033`) — telefon i e-mail widać tylko wtedy, gdy obiekt zgodził się na publikację.

**Pytania, na które odpowiada ta sekcja:** Gdzie znaleźć boiska w Poznaniu? Czy Bojo
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
- **Widoczność „tylko dla grupy".** `events.visibility` to wyłącznie `private`/`public`.
- **Powiadomienie dla członków grupy o nowym meczu grupy.**
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

### 2026-08-06 — Zaproszenie na mecz trafia do powiadomień
PROBLEM: imienne zaproszenie na mecz nie tworzyło w Bojo żadnego powiadomienia.
Dzwonek pokazywał zero, mimo trzech czekających zaproszeń — zaproszony widział
je wyłącznie po wejściu na stronę główną, czyli dokładnie wtedy, gdy i tak by
je zauważył. Powiadomienia powstały w Bojo wcześniej niż imienne zaproszenia
i nikt tych dwóch rzeczy wtedy nie połączył.
ROZWIĄZANIE BOJO: zaproszenie ląduje w skrzynce razem z nazwą zapraszającego,
terminem i tytułem meczu. Zaproszenia, które czekały w bazie przed tą zmianą,
dostały powiadomienia wstecz — ale tylko te nieodrzucone i dotyczące meczu,
który się jeszcze nie odbył.
MECHANIKA: migracja `067` — wyzwalacz `powiadom_o_zaproszeniu()`
na `event_player_invites` oraz jednorazowe uzupełnienie zaległych wpisów.

### 2026-08-06 — Gość dopisany ręcznie przejmuje swój wpis po założeniu konta
PROBLEM: organizator dopisywał do składu osobę bez konta, wpisując samo imię —
taki wpis nie należał do nikogo. Gdy ta osoba później zakładała konto w Bojo
i dołączała do tego samego meczu, w składzie stały dwie pozycje o tym samym
imieniu, organizator musiał jedną usunąć ręcznie, a historia gier nowego
użytkownika zaczynała się od zera.
ROZWIĄZANIE BOJO: przy każdym wpisie gościa organizator ma przycisk „Zaproś do
Bojo", który kopiuje jednorazowy link. Kto go otworzy, widzi — jeszcze przed
logowaniem — pod jakim imieniem został dopisany i o który mecz chodzi, a po
zalogowaniu wiąże ten wpis ze swoim kontem jednym kliknięciem. Miejsce
w składzie zostaje to samo, mecz trafia do historii gracza.
Dopasowania po imieniu Bojo NIE robi: imię nie jest tożsamością, a przejęcie
cudzego wpisu oznaczałoby przejęcie cudzego miejsca w składzie. Link jest
jednorazowy i wygasa po użyciu; nie da się nim przejąć wpisu w meczu, w którym
jest się już zapisanym na własnym koncie.
MECHANIKA: migracja `066` — kolumny `claim_token` i `claimed_at`
w `event_participants`, wyzwalacz nadający token przy dopisaniu gościa oraz
funkcje `podejrzyj_wpis_goscia()` i `przejmij_wpis_goscia()` z SECURITY DEFINER
(wpis gościa nie ma właściciela, więc polityka RLS oparta na tożsamości nie
mogłaby go przepuścić). Trasa `/gracz/przejmij/[token]`, `lib/guestClaim.ts`.

### 2026-08-06 — Rezerwa mówi, co się musi stać, i daje znać po fakcie
PROBLEM: gracz na liście rezerwowej Bojo widział tylko etykietę „Rezerwa · 3."
Nie wiedział, co musi się stać, żeby zagrał, ile ma czasu na przyjęcie
zwolnionego miejsca ani czy ktokolwiek go o tym powiadomi. Podobnie
„Oczekujesz na akceptację" nie mówiło, skąd gracz dowie się o decyzji
organizatora. Zmiana terminu meczu nie docierała do nikogo — zapisani
dowiadywali się o niej, wchodząc na stronę meczu.
ROZWIĄZANIE BOJO: rezerwowy widzi panel z regułami: nie ma miejsca w składzie,
wejdzie gdy ktoś się wypisze, miejsce dostaje pierwsza osoba w kolejce, a na
jego przyjęcie ma tyle godzin, ile ustawił organizator. Panel mówi wprost, że
powiadomienia są na razie wyłącznie w aplikacji, pod dzwonkiem — Bojo nie
wysyła e-maili ani SMS-ów. Do skrzynki trafiają teraz także dwa nowe zdarzenia:
organizator przyjął zapis oraz mecz zmienił termin.
MECHANIKA: migracja `065` dodaje wyzwalacze `powiadom_o_akceptacji()`
(na `event_participants`) i `powiadom_o_zmianie_terminu()` (na `events`).
Wyzwalacz z SECURITY DEFINER, bo powiadomienie pisze się zawsze komuś innemu
niż autor akcji, a polityka INSERT na `notifications` dopuszcza wyłącznie
własne wiersze. Panel rezerwy w `app/wydarzenia/[id]/EventDetailClient.tsx`.

### 2026-08-06 — Jedna lista składu, koniec ze statusami uczestnika
PROBLEM: strona meczu w Bojo pokazywała skład w dwóch miejscach — licznik
zajętych miejsc z awatarami u góry i osobna karta ze składem niżej — więc
organizator musiał się domyślać, w której z nich właściwie jest. Osobno: każdy
uczestnik miał status (zaproszony / potwierdzony / odrzucony / brak odpowiedzi)
opowiadający tę samą historię co oczekiwanie na akceptację i deklaracja gry,
tylko własnym słownikiem i bez pilnowania zgodności — gracz mógł być
„potwierdzony" i jednocześnie czekać na akceptację organizatora.
ROZWIĄZANIE BOJO: skład jest w jednym miejscu, pod licznikiem miejsc.
Organizator ma go rozwiniętego od razu, razem z dopisywaniem osób bez konta.
Statusy uczestnika zniknęły wraz ze śledzeniem obecności, które było ich
jedynym interfejsem. Relację gracza do meczu opisują wyłącznie dwie rzeczy:
czy czeka na akceptację i czy gra, czy tylko obserwuje.
MECHANIKA: migracja `064` kasuje `event_participants.status`,
`event_participants.confirmed_at` oraz `events.track_attendance`; usunięte
`updateParticipantStatus()` z `lib/eventFeatures.ts` i obie sekcje
w `app/wydarzenia/[id]/EventDetailClient.tsx`.

### 2026-08-06 — Komentarze pod boiskiem i powrót na mapę
PROBLEM: strona obiektu w katalogu Bojo opisywała fakty z OpenStreetMap —
sport, nawierzchnię, wymiary — i nic poza tym. Rzeczy, które decydują o tym,
czy warto tam jechać (bramki bez siatek, brama zamykana po 20, parking),
wiedzą tylko ci, którzy już tam grali, i nie mieli gdzie tego zapisać. Osobno:
z opisu boiska nie dało się wrócić na mapę wycelowaną w ten obiekt — mapa
otwiera się na widoku całego kraju, więc trzeba było szukać go od nowa.
ROZWIĄZANIE BOJO: pod opisem obiektu są komentarze — czyta każdy, także bez
konta, pisze zalogowany. Autor może skasować własny wpis, administrator
dowolny. Przycisk „Zobacz na mapie" otwiera mapę przybliżoną na tym obiekcie
z jego kartą.
MECHANIKA: tabela `field_comments` (migracja `063`, osobna od `event_comments`,
bo komentarz o miejscu przeżywa pojedynczy mecz), `lib/fieldComments.ts`,
`components/venue/VenueComments.tsx`, parametr `/mapa?boisko=<id>` obsługiwany
w `components/map/VenueExplorer.tsx`.

### 2026-08-06 — Mapa pokazuje jedną kartę zamiast przewijanej listy
PROBLEM: pod mapą Bojo stała przewijana w bok lista wszystkich wyników.
Na telefonie zacinała się: każde przesunięcie palcem liczyło odległość każdej
karty od środka ekranu, żeby zgadnąć, którą użytkownik ogląda, a taki wybór
przewijał listę z powrotem — ruch palcem walczył z automatycznym przewijaniem.
Lista rosła razem z katalogiem, więc problem miał się tylko pogłębiać.
ROZWIĄZANIE BOJO: na telefonie mapa pokazuje jedną kartę — obiektu, którego
pinezkę dotknięto. Dopóki nic nie wybrano, widać podpowiedź „Dotknij pinezki".
Nic nie zaznacza się samo: przy katalogu ogólnopolskim „pierwszy z listy" to
obiekt oddalony o pół kraju od tego, na co użytkownik patrzy. Na komputerze
lista w pasku bocznym zostaje bez zmian.
MECHANIKA: `components/map/VenueExplorer.tsx` — usunięta karuzela wraz
z obsługą przewijania i źródłem wyboru `scroll`.

### 2026-08-06 — Zaproszenia wyróżnione, widoczność meczu za oknem wyboru
PROBLEM: zaproszenie na mecz wyglądało w Bojo tak samo jak mecz, w którym
użytkownik już gra — ta sama karta, ten sam styl. Czytało się jak zobowiązanie,
którego nie ma. Odrzucenie istniało, ale jako szary napis „Nie tym razem"
wielkości podpisu, więc wyglądało na brak funkcji. Osobno: organizator zmieniał
widoczność meczu jednym tknięciem etykiety „Publiczne"/„Prywatne", więc
przypadkowe dotknięcie zdejmowało mecz z publicznej listy bez pytania.
ROZWIĄZANIE BOJO: zaproszenie ma obwódkę, tło i nagłówek „ZAPROSZENIE",
a odrzucenie to przycisk „Odrzuć zaproszenie" na całą szerokość karty.
Odrzucone zaproszenie znika i nie wraca. Widoczność meczu zmienia się przez
okno z dwiema opcjami i opisem, co każda znaczy; przy meczu publicznym
z zapisanymi graczami okno mówi wprost, że zmiana na prywatny nikogo nie
wypisuje — nowi po prostu nie znajdą meczu na liście.
MECHANIKA: `components/events/InviteList.tsx`, `dismissInvite()`
w `lib/playerInvites.ts` (kolumna `dismissed_at`, migracja `060`), okno
widoczności i `handleSetVisibility()` w `app/wydarzenia/[id]/EventDetailClient.tsx`.

### 2026-08-06 — Enter w kreatorze meczu nie publikuje przypadkiem
PROBLEM: na ostatnim kroku kreatora meczu w Bojo naciśnięcie Enter w polu
„Tytuł" publikowało mecz natychmiast. Przeglądarka wysyła formularz na Enter,
gdy ten ma przycisk zatwierdzający — a ostatni krok ma i pola tekstowe,
i „Opublikuj mecz". Dla organizatora wyglądało to tak, jakby kreator sam
przeskoczył dalej i utworzył mecz bez pytania.
ROZWIĄZANIE BOJO: Enter w polu jednoliniowym nie wysyła już formularza. Mecz
powstaje wyłącznie po kliknięciu „Opublikuj mecz". W polu opisu Enter dalej
robi nową linię.
MECHANIKA: `blokujEnter()` oraz warunek na numer kroku w `handleSubmit()`
w `app/wydarzenia/nowe/page.tsx`.

### 2026-08-06 — Rozliczenie po meczu i powiadomienie o zwolnionym miejscu z rezerwy
PROBLEM: panel „Podział kosztów" (kto zapłacił, ile zebrano) znikał ze strony meczu,
gdy tylko mecz się zaczynał — dokładnie wtedy, gdy organizator faktycznie rozlicza
się z ekipą po grze. Osobno: gdy zwalniało się miejsce, oferta trafiała do pierwszego
rezerwowego po cichu — `sync_reserve_claim` odpalał się tylko przy wejściu na stronę
meczu, więc rezerwowy dowiadywał się o ofercie jedynie, jeśli sam odświeżył stronę
w oknie na decyzję. Do tego link z dzwonka powiadomień prowadził na nieistniejącą
trasę `/wydarzenie/[id]` (liczba pojedyncza) zamiast `/wydarzenia/[id]`.
ROZWIĄZANIE BOJO: „Podział kosztów" i przełącznik płatności per uczestnik są teraz
widoczne dla organizatora niezależnie od tego, czy mecz się już zaczął. Oferta
zwolnionego miejsca z rezerwy generuje wpis w istniejącej skrzynce powiadomień
w aplikacji (bez auto-awansu — rezerwowy nadal musi sam kliknąć „Wchodzę"). Link
w dzwonku powiadomień prowadzi już na właściwą stronę meczu.
MECHANIKA: `app/wydarzenia/[id]/EventDetailClient.tsx` (warunek widoczności panelu
kosztów odczepiony od `eventStarted`), `sync_reserve_claim` w migracji `062` (insert
do `notifications`), `components/layout/NotificationBell.tsx` (poprawiony href).

### 2026-08-06 — Strony boisk generowane na żądanie zamiast przy buildzie
PROBLEM: każda strona boiska w Bojo była generowana z góry, przy budowaniu
aplikacji — tyle stron, ile obiektów w katalogu. Dopóki katalog obejmował
Poznań, mieściło się to w kilku minutach. Po imporcie z OpenStreetMap urósł
do ~4600 obiektów i budowanie przestało się kończyć: ponad 40 minut bez
skutku, więc żadna zmiana nie docierała na produkcję.
ROZWIĄZANIE BOJO: strona boiska powstaje przy pierwszym wejściu i zostaje
w pamięci podręcznej na dobę. Czas budowania Bojo nie zależy już od wielkości
katalogu, co jest warunkiem dojścia do dziesiątek tysięcy obiektów z całej
Polski. Adresy stron i mapa witryny się nie zmieniły.
MECHANIKA: `generateStaticParams()` w `app/boisko/[id]/page.tsx` zwraca pustą
listę, `revalidate = 86400`; `resolveField()` rozwiązuje slug przez wspólny
indeks slug→id z TTL zamiast pobierać całą tabelę `fields` raz na render.
