# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-14 · migracja `095` · 33 tabele · 520 testów

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
ludzi od zera w wątku na komunikatorze, historia wspólnych meczów nigdzie nie zostaje,
a organizator jest jedyną osobą, która może cokolwiek zmienić.

**Rozwiązanie w Bojo.** Grupa to stała ekipa: sport, miasto, okładka, lista członków,
mecze grupy, tablica ogłoszeń i statystyki w jednym miejscu. Dołącza się wyłącznie
kodem zaproszenia — link `/g/[kod]` pokazuje ekipę i najbliższy mecz bez konta, a
rejestracja od razu wciąga do grupy. Założyciel może nadać zaufanym członkom trzy
niezależne uprawnienia: zarządzanie składem ekipy, zakładanie meczów w jej imieniu
i moderowanie tablicy — sam pozostaje jedyną osobą, która może usunąć grupę.

**Mechanika.** Logika w `frontend/src/lib/groups.ts` (+ `groupPosts.ts`,
`groupStats.ts`, `groupShare.ts`), tabele `groups`/`group_members` (migracja `044`,
uprawnienia i nadawca zaproszenia dołożone w `092`/`094`), `group_posts` (tablica,
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
w grupie jest czat albo tablica ogłoszeń? Czy założyciel grupy może dać komuś innemu
uprawnienia do zarządzania ekipą? Czy grupa ma statystyki graczy?

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
- **Osobna wartość „tylko dla grupy" w `events.visibility`.** Kolumna to wyłącznie
  `private`/`public` — ale prywatny mecz przypięty do grupy i tak widzi cała ekipa,
  patrz sekcja „Grupy" wyżej.
- **Czat w czasie rzeczywistym w grupie.** Jest tablica ogłoszeń (płaska lista wpisów,
  bez wątków) — nie wiadomości na żywo.
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

### 2026-08-14 — Grupy jako magnes na organizatora: uprawnienia, tablica, zaproszenia z nadawcą, statystyki

PROBLEM: strategia (`docs/strategia.md §0`) przesuwa priorytet na pozyskiwanie
organizatorów — a grupa jest jedynym miejscem w Bojo, gdzie pętla „co tydzień zbieram
tę samą ekipę" może domykać się jednym kliknięciem zamiast wątku na komunikatorze. Kod
sprzed tej zmiany na to nie pozwalał: `repeatEvent()` gubił przypięcie do grupy przy
powtórce meczu; każdy, kto poznał UUID grupy (publicznie czytelne), mógł się do niej
dopisać, bo `join_code` sprawdzał wyłącznie interfejs; roli członka nie dało się w ogóle
zmienić — brakowało polityki UPDATE na `group_members` — więc jedynym „współorganizatorem"
był zawsze i wyłącznie założyciel; nie było tablicy ani statystyk drużyny; zaproszenie
`/g/[kod]` prowadziło od razu na ekran proszący o logowanie, zanim ktokolwiek zobaczył,
do czego właściwie dołącza.

ROZWIĄZANIE BOJO: założyciel może teraz nadać zaufanym członkom trzy niezależne
uprawnienia (zarządzanie składem ekipy, zakładanie meczów w jej imieniu, moderowanie
tablicy) — sam zawsze zachowuje komplet i jako jedyny może usunąć grupę. Dołączenie do
grupy wymaga kodu zawsze — dziura z samym UUID jest zamknięta. Nowa tablica ogłoszeń:
płaska lista wpisów, jeden może być przypięty i to jedyny, który powiadamia całą ekipę
(dzwonek ma zostać miejscem na rzeczy wymagające działania, nie kanałem czatu). Ekran
grupy zaczyna się od najbliższego meczu — gdy go nie ma, jeden przycisk „Powtórz na
{data}" zakłada kolejny termin z tymi samymi ustawieniami co poprzedni. Zaproszenie
`/g/[kod]` jest teraz czytelne bez konta (nazwa ekipy, kto zaprasza, najbliższy mecz,
historia) z formularzem rejestracji od razu pod spodem — ten sam „pokaż wartość przed
kontem", co przy zapisie na mecz bez logowania. Statystyki grupy (mecze, gole,
niezawodność) są uczciwe co do tego, czego nie da się policzyć: zwycięstwa liczą się
tylko tam, gdzie mecz miał podział na drużyny i wpisany wynik, a „niezawodność" nie
udaje frekwencji, której Bojo nie śledzi.

MECHANIKA: migracje `092` (`group_members.can_manage_members/can_create_events/
can_moderate_wall`, trigger `ustaw_role_czlonka()` wyliczający etykietę `role` z tych
przełączników, pięć funkcji `SECURITY DEFINER` do polityk RLS), `093` (tabela
`group_posts`, `notifications.group_id`, wyzwalacz powiadamiający o przypiętym
ogłoszeniu), `094` (RPC `dolacz_do_grupy_kodem()`/`dodaj_czlonka_do_grupy()`/
`odswiez_kod_grupy()`, `group_members.invited_by`, zdjęta polityka INSERT na
`group_members`), `095` (RPC `get_group_stats()`/`get_group_leaderboard()`). Frontend:
`lib/{groupPosts,groupStats,groupShare}.ts`, przebudowane `/grupy`, `/grupy/[id]`
(cztery zakładki: Mecze/Tablica/Skład/Statystyki, komponenty w `components/groups/`),
`/grupy/[id]/edytuj`, `/g/[code]` (nowy `ZaproszenieClient.tsx`, reużywa `AuthForm`).
Pełny model uprawnień → [docs/domena.md § Uprawnienia w
grupie](./domena.md#uprawnienia-w-grupie).

### 2026-08-14 — Delegowanie uprawnień organizatora, oznaczanie nieobecności, naprawa powtórki meczu i powiadomienia o profilu

PROBLEM: cztery niezależne usterki w przepływie organizatora. (1) Powiadomienie
„uzupełnij profil" po rejestracji fizycznie zapisywało się w bazie, ale nigdy nie
pojawiało się w dzwonku — wyścig między insertem a subskrypcją Realtime dzwonka, która
nie zdążyła się zasubskrybować, zanim insert się wykonał. (2) Przycisk „Zaproś do Bojo"
w karcie „Po meczu" skakał na skład, który dla zakończonego meczu jest domyślnie
zwinięty do awatarów — scroll trafiał w puste miejsce. (3) Modal „Powtórz mecz" kopiował
zegarową godzinę końca ze źródłowego meczu bez przeliczenia względem nowego startu —
zmiana samej godziny startu potrafiła dać kopię „trwającą" 690 minut. (4) Organizator
nie miał jak oznaczyć nieobecność gracza (infrastruktura istniała od migracji `011`, ale
nic do niej nie zapisywało) ani przekazać części swoich praw komuś, kto pomaga prowadzić
mecz pod jego nieobecność.

ROZWIĄZANIE BOJO: (1) `lib/auth.tsx` po udanym RPC jawnie każe dzwonkowi odświeżyć listę
(custom event), zamiast liczyć na Realtime dla tego jednego, znanego z wyścigu
przypadku. (2) Kliknięcie „Zaproś do Bojo" rozwija skład i dopiero potem scrolluje.
(3) Modal „Powtórz mecz" ma teraz pole „Koniec" obok „Godziny" — zmiana startu przesuwa
koniec o tę samą deltę (zachowuje długość), zmiana końca nigdy nie rusza startu.
(4) Nowy modal „Kto nie przyszedł" w karcie „Po meczu" (organizator/delegat od składu) —
wpływa na plakietkę „Niezawodny" i pasek frekwencji na `/gracz/[id]`, bez zmiany widoku
składu dla reszty. Nowy panel „Uprawnienia" (wyłącznie prawdziwy organizator): deleguje
uczestnikowi meczu albo członkowi przypiętej grupy trzy niezależne prawa — pełną edycję
(włącznie z odwołaniem meczu), zarządzanie składem i wynikiem, zarządzanie rozliczeniami
i BLIK-iem. Egzekwowane w RLS, nie tylko w UI.

MECHANIKA: `lib/eventDelegates.ts`, `lib/attendance.ts`, `lib/time.ts` (nowe);
`event_delegates` (migracja `089`, + funkcje `can_edit_event()`/`can_manage_squad()`/
`can_manage_payments()`), rozszerzenie RLS na `events`/`event_participants`/
`team_proposals`/`match_results`/`player_goals`/`event_player_invites` + RPC
`event_set_payment_settings()` (`090`), unikalny indeks i zaostrzone RLS na
`player_reports` (`091`). Pełny model uprawnień →
[docs/domena.md § Delegowanie](./domena.md#delegowanie-uprawnień-organizatora).

### 2026-08-13 — Strony treści dla organizatorów, FAQ naprawia kłamstwo o koncie, domknięcie meczu po gwizdku

PROBLEM: FAQ na stronie głównej, `llms.txt` i sekcja „Zasięg i skala" tego pliku
twierdziły, że dołączenie do meczu wymaga logowania — nieprawda od migracji `082`
(self-service zapis gościa, patrz [funkcje.md](./funkcje.md#zapis-na-mecz-bez-logowania)).
To dokładnie ten argument, którym organizator przebija opór graczy przed zakładaniem
konta w obcej aplikacji, i aplikacja sama sobie go zabierała. Osobno: dane produkcyjne
pokazały, że rzeczy, które Bojo umie **po meczu**, prawie nigdy się nie dzieją —
122 rozegrane mecze, 6 zapisanych wyników, 45 nierozliczonych, zero przejętych wpisów
gości — bo nic o nie nie prosi we właściwym momencie. Strategia (`docs/strategia.md §0`)
przesuwa priorytet na pozyskiwanie organizatorów, a produkt nie miał stron tłumaczących
mechanikę i przewagę nad wątkiem na Messengerze pod SEO/GEO/AEO.

ROZWIĄZANIE BOJO: trzy nowe strony treści — `/jak-dziala-bojo` (cała ścieżka od
kreatora po rozliczenie, z jawną sekcją o tym, że dołączenie nie wymaga konta,
i sekcją „co Bojo powiadamia i gdzie", która wprost mówi, że SMS-ów i maili o meczu nie
wysyła), `/dlaczego-bojo` (tabela porównawcza z grupą FB/WhatsApp, argument na „moi
gracze nie założą konta"), `/faq` (36 pytań w sześciu kategoriach, wspólne źródło ze
stroną główną). Poprawione FAQ na landingu, `llms.txt` (zapis bez konta,
liczba obiektów ~30 000 zamiast nieaktualnego ~1400). Karta „Po meczu" na stronie meczu
zbiera zadania organizatora (rozlicz ekipę, wpisz wynik, zaproś gości bez konta, powtórz
mecz) w jednym miejscu zamiast jednej bursztynowej linijki; okno „Powtórz mecz" otwiera
się z wypełnioną datą najbliższego takiego samego dnia tygodnia zamiast pustego pola;
zakładka Historia na `/moje-gry` dostała sekcję „Do rozliczenia".

MECHANIKA: `src/content/{faq,jakDziala,dlaczego,zakazaneFrazy}.ts` — copy jako
dane, testowalne bez renderowania (wzorem `components/home/landing/content.ts`, który
teraz re-eksportuje `FAQ_LANDING` z `content/faq.ts`); `components/tresc/*` — powłoka
stron treści; `lib/recurring.ts`
(`domyslnyTerminPowtorki()`); `lib/myEvents.ts` (`doRozliczenia()`);
`components/events/PoMeczuCard.tsx`; `components/home/dashboard/DashboardSections.tsx`
(`DoRozliczeniaSection`). Zero migracji SQL — cała część „po meczu" składa stan, który
`EventDetailClient.tsx` i `getMyParticipatedEvents()` już liczyły.

### 2026-08-13 — Powtórny zapis tym samym e-mailem: osobny ekran dla osoby z kontem i bez konta

PROBLEM: druga próba zapisu bez logowania tym samym adresem kończyła się czerwonym
komunikatem „Jesteś już zapisany na ten mecz.", który znikał po chwili — bez ekranu,
bez wyjaśnienia, co dalej. Osoba, która MA konto w Bojo, była dodatkowo namawiana na
założenie drugiego; dowiadywała się o istniejącym koncie dopiero po wpisaniu hasła
i nieudanej rejestracji. Baza nie miała czym odpowiedzieć na pytanie „czy ten e-mail
ma konto", a wybór ekranu przy wpisach zduplikowanych przed migracją `085` był
losowy — zapytanie brało `LIMIT 1` bez `ORDER BY`.

ROZWIĄZANIE BOJO: powtórny zapis tym samym e-mailem nigdy nie tworzy drugiego wiersza
w składzie i nie kończy się błędem, tylko ekranem dopasowanym do sytuacji. Bez konta:
ten sam ekran co po zapisie, z nagłówkiem „Wcześniej dołączyłeś do tej gry." i zachętą
do założenia profilu. Z kontem: ten sam nagłówek, ale ekran skrócony — „Zaloguj się,
żeby zobaczyć więcej szczegółów", pole hasła od razu w trybie logowania (nie
rejestracji), przycisk „Zaloguj przez Google" i małe „Pomiń i zobacz skład bez
logowania"; bez listy korzyści, bo właściciela konta nie ma po co przekonywać do
czegoś, co już ma. Gdy wpis ma już właściciela, zostaje samo logowanie — nie ma czego
przejmować. Osoba z kontem zapisująca się po raz PIERWSZY też dostaje wariant
logowania, a jej miejsce (albo pozycja w kolejce rezerwowej) jest zaklepane od razu.

MECHANIKA: migracja `088_konto_i_zamek_na_duplikaty.sql`. RPC
`dolacz_do_meczu_jako_goscie()` zwraca czwartą kolumnę `has_account` (`EXISTS` na
`auth.users` po `lower(email)`, pytanie globalne — nie „czy jest w tym meczu"), a
zamiast `RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.'` oddaje zwykły wiersz
z `claim_token = NULL`; frontend wybiera ekran po kształcie wyniku, nie po treści
komunikatu. Wyszukanie istniejącego wpisu dostało `ORDER BY (claim_token IS NULL) DESC,
created_at`. Unikalny indeks `idx_participants_unique_guest_email` na
`(event_id, lower(guest_email))` zamyka wyścig równoległych zapisów — migracja najpierw
kasuje duplikaty sprzed `085`, bo inaczej indeks się nie zakłada. Frontend:
`joinEventAsGuest()` w `lib/events.ts` (`claimToken: string | null`, `hasAccount`,
`has_account ?? false` dla starego kształtu RPC sprzed ręcznego wgrania migracji),
`handleJoinAsGuest()` i stan `newUserHasAccount` / `showAlreadyJoinedPrompt`
w `EventDetailClient.tsx`. Testy: `frontend/src/__tests__/events.test.ts`,
`describe('joinEventAsGuest — kontrakt z bazą')`.

### 2026-08-12 — Powiadomienie o niepełnej nazwie naprawione, proaktywne zaproszenie gościa, wybór roli po rejestracji

PROBLEM: powiadomienie w dzwonku „Uzupełnij swoje imię" (migracja `070`/`071`) nigdy
nie zadziałało w produkcji — potwierdzone zapytaniem po danych: zero wierszy typu
`uzupelnij_profil` mimo dziesiątek kont z niepełną nazwą założonych już po naprawie w
`071`, przyczyna nieznana. Osobno: organizator dopisujący gościa bez konta miał tylko
mały, łatwy do przeoczenia link „Zaproś do Bojo" przy jego imieniu w składzie — żadnej
proaktywnej zachęty ani argumentacji, dlaczego to się organizatorowi opłaca. I: świeżo
zarejestrowany użytkownik nie miał żadnej podpowiedzi, czy jest organizatorem (założyć
grupę) czy graczem (dołączyć do swojej albo przeglądać otwarte mecze).

ROZWIĄZANIE BOJO: nowe RPC `zglos_brak_pelnej_nazwy()` wołane z przeglądarki zaraz po
zalogowaniu, dla świeżych kont (< 10 minut) bez pełnego imienia i nazwiska — tym samym
warunkiem, którego już używa baner na pulpicie, więc oba mechanizmy mierzą jednym
miernikiem. Zaraz po dodaniu gościa bez konta (przez organizatora albo, gdy włączone,
przez uczestnika) otwiera się modal z trzema konkretnymi argumentami („dostanie
powiadomienie o odwołaniu meczu", „zostanie w Twojej bazie graczy", „sam potwierdzi
udział") i gotowym przyciskiem wysyłki zaproszenia — raz na wydarzenie, żeby dopisanie
kilkunastu osób pod rząd nie zasypało modalami. Świeżo zarejestrowany, o ile rejestracja
nie miała już konkretnego celu (dołączenie do meczu, przejęcie wpisu gościa), widzi
modal z dwoma ścieżkami: „Jestem organizatorem" (prosto do założenia grupy) albo „Jestem
graczem" (grupa albo przeglądanie meczów).

MECHANIKA: migracja `086` — RPC `zglos_brak_pelnej_nazwy()` (`SECURITY DEFINER`,
`NOT EXISTS` chroni przed duplikatem, gdyby wyzwalacz z `070`/`071` jednak zadziałał);
wołane z `lib/auth.tsx` w `onAuthStateChange` przy `SIGNED_IN`. `lib/events.ts` —
`addGuest()` zwraca teraz też `id`/`claimToken` (insert z `.select().single()`), nie
tylko `isReserve`. `lib/guestClaim.ts` — nowa `udostepnijZaproszenieGoscia()` (Web Share
z fallbackiem do schowka), współdzielona przez istniejący przycisk „Zaproś do Bojo" i
nowy modal `components/events/GuestInviteNudge.tsx`. `lib/powrotPoLogowaniu.ts` — nowa
`ostatniZamierzonyCel()` (jak `odbierzPowrot()`, ale nie kasuje wpisu). Nowy
`components/onboarding/PostSignupRoleModal.tsx`, montowany globalnie w `layout.tsx`.

### 2026-08-12 — Zapis na mecz bez logowania (self-service dla gościa)

PROBLEM: bariera założenia konta zniechęca nowych graczy. Organizator chce dać im
możliwość szybkiego dołączenia do meczu (wystarczy imię i e-mail), bez wymuszania
logowania ani dopisywania ich ręcznie z panelu. Pierwsza wersja miała błąd SQL
blokujący zapis (`claim_token` niejednoznaczne w `RETURNING`), nie pokazywała info
o rezerwie przed zapisem, nie odświeżała listy uczestników po zapisie (gość „znikał"
po zamknięciu ekranu zachęty, mimo że wpis w bazie istniał) i wymagała dwóch
dodatkowych kliknięć (logowanie/rejestracja + „To ja — potwierdzam") zanim gość
faktycznie zobaczył siebie w składzie.

ROZWIĄZANIE BOJO: niezalogowany gracz dołącza do meczu w sticky pasku („Dołącz bez
konta"), wpisując imię i e-mail — widzi z góry, czy trafi do składu czy na rezerwę
(ta sama predykcja co w dialogu dla zalogowanych). Po zapisie ekran zachęty pokazuje
faktyczny status („Jesteś w składzie" / „Jesteś na liście rezerwowej") nad już
zaktualizowaną listą uczestników. Profil można dokończyć bez ponownego wpisywania
imienia/maila — hasłem (dane już zna z formularza zapisu) albo przez Google — oba
automatycznie przejmują wpis gościa i lądują wprost na stronie meczu, bez dodatkowego
ekranu potwierdzenia. Gdy podany e-mail ma już konto, to samo pole hasła przełącza
się z rejestracji na logowanie zamiast tylko pokazać błąd. Nawet gdy gość zamknie
ekran bez logowania — albo wpis dodał organizator ręcznie, bez udziału gościa —
właściciel pasującego konta i tak dostanie powiadomienie z gotowym linkiem
przejęcia, przy najbliższej okazji (nowe konto z tym e-mailem albo kolejne logowanie).

MECHANIKA: migracja `082` z funkcją `dolacz_do_meczu_jako_goscie()` (SECURITY DEFINER,
zwraca `claim_token`+`is_reserve`), poprawiona migracją `083` (INSERT…RETURNING
z jawnym prefiksem tabeli — naprawia „ambiguous column reference"). Kolumny
`guest_email`, `guest_phone` w `event_participants`. Frontend: `EventDetailClient.tsx`
— dialog gościa pokazuje predykcję rezerwy z `wolneMiejscaWgRol()` (bez dodatkowego
zapytania); `handleJoinAsGuest` woła `load()` po zapisie i używa `result.isReserve`
w komunikacie; `handleCreateAccountFromGuest` woła `signUpWithEmail()` +
`przejmijWpisGoscia()` wprost, bez przejścia przez `/logowanie`; gdy `signUpWithEmail`
rzuci błąd „już istnieje", `handleSignInFromGuest` woła `signInWithEmail()` na tym
samym polu hasła. `PrzejmijClient.tsx` (`/gracz/przejmij/[token]`) auto-przejmuje
wpis, gdy link niesie `?auto=1` i user jest już zalogowany — bez klikania „To ja —
potwierdzam". Wrapper `joinEventAsGuest()` w `lib/events.ts`. Walidacja e-maila
w `lib/validation.ts`. Migracja `084`: dwa wyzwalacze SQL kojarzą wpis gościa
z kontem po e-mailu (`event_participants`→`auth.users` i odwrotnie) i wstawiają
powiadomienie typu `niepotwierdzony_wpis_goscia` (kolumna `notifications.claim_token`,
`NotificationBell.tsx` kieruje je na `/gracz/przejmij/[token]`) — bez samodzielnego
przejęcia, tylko z linkiem; przejęcie nadal wymaga kliknięcia i `auth.uid()`. Migracja
`085` naprawia znaleziony na produkcji duplikat: ten sam e-mail mógł zapisać się jako
gość kilka razy na jeden mecz, bo `dolacz_do_meczu_jako_goscie()` tego nie sprawdzała
— teraz na starcie odrzuca powtórkę (albo zwraca istniejący `claim_token`
idempotentnie). `signUpWithEmail()` dostała też drugą detekcję „e-mail już ma konto"
(`identities.length === 0`) — dla trybu ochrony przed enumeracją e-maili w Supabase,
gdzie `signUp()` dla istniejącego adresu nie rzuca błędu tylko udaje sukces. Migracja
`087` dodaje do `dolacz_do_meczu_jako_goscie()` kolumnę `already_joined` (true przy
idempotentnym zwrocie tokenu z `085`), żeby frontend odróżnił świeży zapis od powtórki —
ekran po powtórnym zapisie tym samym mailem pokazuje „Wcześniej dołączyłeś do tej gry."
zamiast „Zapisano!". Migracja `088` dokłada kolumnę `has_account` i zamienia wyjątek na
zwykły wynik — pełny opis czterech wariantów ekranu w sekcji „Powtórny zapis tym samym
e-mailem" niżej.

### 2026-08-12 — Zaproszenie gościa na rezerwie, dopisywanie gości przez uczestnika, rozliczenie i skład po meczu, jedna nazwa drużyny wszędzie

PROBLEM: przycisk „Zaproś do Bojo" (przejęcie wpisu gościa) działał tylko dla gości
w głównym składzie — gość na rezerwie nie miał jak przejąć swojego wpisu, mimo że
backend to wspierał. Formularz „Dopisz osobę bez konta" mimo włączonej opcji
„Uczestnicy mogą dodawać gości" renderował się wyłącznie organizatorowi — zwykły
uczestnik miał inny, ukryty formularz z dodatkowymi ograniczeniami bez pokrycia
w regułach dostępu. Po zakończonym meczu dało się dalej kliknąć „Wypisz się z meczu",
sekcja płatności chowała się pod składem zamiast być na wierzchu, a wynik meczu i skład
używały dwóch różnych nazw drużyn („Drużyna A/B" w wyniku, „Niebiescy/Czerwoni"
w składzie). Formularz wyniku pozwalał wpisać strzelcom więcej goli niż wynik końcowy.
Karty meczów w zakładce „Historia" pokazywały cenę i „Wymaga akceptacji" — bezużyteczne
po fakcie. Na `/profil` brakowało linku „bojo" w górnym pasku na telefonie.

ROZWIĄZANIE BOJO: przycisk zaproszenia i informacja „dodał(a)" są teraz identyczne
w składzie i na rezerwie. Formularz dopisywania gościa jest jeden wzorzec dla
organizatora i uczestnika, widoczny każdemu potwierdzonemu uczestnikowi (także
rezerwowemu) do startu meczu. Po starcie meczu znika „Wypisz się z meczu", a sekcje
„Podział kosztów"/„Twoja płatność" przenoszą się nad „Składy"/„Wynik meczu" — treść
się nie zmienia, tylko kolejność. Cena i „Wymaga akceptacji" w nagłówku meczu i na
kartach w Historii ustępują po starcie meczu miejsca statusowi rozliczenia
(„Rozliczono"/„X nie zapłaciło" dla organizatora, „Zapłacono"/„Zapłać" dla gracza).
Nazwy drużyn („Niebiescy"/„Czerwoni" + litery N/C) są teraz jednym słownikiem
używanym identycznie w składzie i w wyniku. Formularz wyniku blokuje zapis, gdy suma
goli albo asyst u strzelców przekracza wynik końcowy. Gol przy nazwisku pojawia się
w składzie, jeśli gracz strzelił więcej niż 0. Baner „Wróciliśmy do Twojego szkicu"
w kreatorze wydarzenia miał przycisk „Zacznij od nowa" ucinany przez `truncate` na
wąskich ekranach — teraz jest osobnym, zawsze widocznym przyciskiem.

MECHANIKA: `EventDetailClient.tsx` — pętla `reserves.map` w torze organizatora
dostała ten sam blok `mozeZaprosic()`/`kopiujLinkPrzejecia()` co `regulars.map`
i `ParticipantsList`; formularz gościa dla uczestnika stracił warunek
`!myParticipation.isReserve`; blok „WYPISZ SIĘ" gated dodatkowo `!eventStarted`;
`skladWynikSection`/`platnosciSection` — dwie zmienne JSX renderowane w kolejności
zależnej od `eventStarted`; `golyMap` (z `matchResult.resultData.scorers`) przekazywany
do `ParticipantsList`/`PublishedTeamsCard`. Nowy plik `lib/teamLabels.ts`
(`TEAM_LABELS`, `TEAM_LETTERS`, `TEAM_COLOR_CLASSES`) używany w `TeamsPanel.tsx`,
`MatchResultForm.tsx` i `EventDetailClient.tsx`. `MatchResultForm.tsx` — walidacja
`enteredGoals`/`enteredAssists` vs `scoreA + scoreB` w `family === 'goals'`.
`lib/events.ts` — `has_paid` dołączony do zapytań `getMyParticipatedEvents()`,
nowe pola `EventItem.unpaidCount` i `MyEventRelation.hasPaid`. `EventBrowseCard.tsx`
— `paymentBadge` zastępuje cenę/„Wymaga akceptacji" dla `past` kart. `profil/page.tsx`
— `<Header showMobileWordmark />` na głównym renderze zalogowanego użytkownika.
`wydarzenia/nowe/page.tsx` — baner szkicu bez `truncate`, „Zacznij od nowa" jako
osobny przycisk.

### 2026-08-12 — Komplet i zwolnione miejsce pod dzwonkiem, rozliczenie do wysłania, powrót z logowania kończy zapis, zaproszenie gościa też dla tego, kto go dopisał

PROBLEM: organizator nie dowiadywał się, gdy skład meczu przechodził w komplet albo
gdy ktoś się wypisał i komplet się rozpadł — cisza aż do wejścia na stronę meczu,
podczas gdy na czacie WhatsApp „sorry, wypadam" jest widoczną wiadomością. Panel
„Podział kosztów" liczył wszystko poprawnie, ale kończył się na ekranie: żeby
powiedzieć ekipie, kto jeszcze nie oddał, organizator przepisywał to ręcznie na czat
— goście bez konta w ogóle nie mają jak zobaczyć swojej kwoty w Bojo. Wylogowany,
który kliknął „Zaloguj się, aby dołączyć", po zalogowaniu wracał na widok identyczny
z tym sprzed logowania i musiał od nowa znaleźć przycisk „Dołącz". Przycisk „Zaproś do
Bojo" (zaproszenie do przejęcia wpisu gościa) mógł kliknąć tylko organizator, mimo że
gościa dopisuje często uczestnik (`allowGuestAdds`) — czyli osoba, która go zna
i ma z nim kontakt, nie organizator.

ROZWIĄZANIE BOJO: nowy wyzwalacz w bazie powiadamia organizatora o zmianie stanu
kompletu w obie strony (nie o każdym zapisie z osobna, żeby nie zagłuszyć tych dwóch
istotnych momentów kilkunastoma wpisami). Przycisk „Wyślij rozliczenie ekipie" otwiera
systemowy arkusz udostępniania z gotową wiadomością: kwota, zebrane z oczekiwanych,
lista zaległości z kwotami i numer BLIK. Kliknięcie „Zaloguj się, aby dołączyć" niesie
przez logowanie intencję zapisu — po powrocie okno zapisu otwiera się samo. Zaproszenie
do przejęcia wpisu gościa może wysłać też ten, kto konkretnego gościa dopisał, nie
tylko organizator.

MECHANIKA: migracja `079` — wyzwalacz `powiadom_o_zmianie_kompletu` na
`event_participants` (INSERT/UPDATE/DELETE), typy `komplet_skladu` i
`zwolnilo_sie_miejsce`; `lib/settlementShare.ts` (`tekstRozliczenia()`, wzorem
`eventShareText`) i przycisk w panelu kosztów `EventDetailClient.tsx`; `?dolacz=1`
w adresie powrotu z `/logowanie` (ten sam wzorzec co `?utworzono=1`) i efekt otwierający
`joinDialogOpen`; `mozeZaprosic()` w `EventDetailClient.tsx` zastępuje warunek
`isOrganizer` przy przycisku „Zaproś do Bojo" (`isOrganizer || p.addedBy === user.id`).

### 2026-08-11 — Refaktor: bramki w CI, koniec cichych porażek, reguła składu tylko w bazie

PROBLEM: Bojo miało trzy klasy błędów, których żadne narzędzie w repo nie widziało.
Build produkcyjny nie był uruchamiany w CI (rzekomo wymagał kluczy Supabase), więc błędy
prerenderu wychodziły dopiero na Vercelu. ESLint nie działał (rzekomo wymagał
interaktywnej konfiguracji), więc martwy kod i braki w zależnościach hooków przechodziły
bez echa. Nic nie sprawdzało, czy przycisk da się KLIKNĄĆ — modal przykryty paskiem
nawigacji przechodził typecheck i wszystkie testy. Do tego dwie pułapki, które nie dają
błędu, tylko fałszywy sukces: RLS aktualizujące zero wierszy i PostgREST obcinający
odpowiedź. Reguła „skład czy rezerwa" istniała w dwóch równoległych implementacjach —
w TypeScripcie i w SQL — a ich rozjazd oznaczał, że gracz wchodzi do składu, podczas gdy
kolejka rezerwowa nadal go w niej trzyma.

ROZWIĄZANIE BOJO: CI uruchamia teraz lint, build produkcyjny (na atrapach kluczy) oraz
testy klikalności w Playwrighcie, obok typechecku i testów jednostkowych. Dwa helpery
w `lib/zapytania.ts` zamieniają ciszę w wyjątek: `zaktualizujJedenWiersz()` sprawdza, czy
UPDATE trafił w wiersz, a `pobierzWszystkie()` stronicuje odczyty dużych tabel.
Dołączanie do meczu jest jedną operacją bazodanową — funkcja `dolacz_do_meczu()` decyduje
i wstawia wpis w jednej transakcji, więc dwóch graczy nie dostanie już tego samego
ostatniego miejsca. Regułę pojemności zna wyłącznie funkcja `czy_na_rezerwe()`.

MECHANIKA: migracja `078` (`czy_na_rezerwe()` jako jedyne miejsce z regułą,
`dolacz_do_meczu()` rozpoznające organizatora po `auth.uid()`, `sync_reserve_claim()`
pytające tej samej funkcji); `lib/events.ts` (usunięte `decydujCzyRezerwa()`
i `confirmedCounts()`; `joinEvent()` woła RPC, `approveParticipant()`, `addGuest()`
i `confirmFromMaybe()` pytają `czy_na_rezerwe()`); nowy `lib/zapytania.ts`;
`frontend/.eslintrc.js`, `playwright.config.ts` i `e2e/klikalnosc.spec.ts`;
`.github/workflows/ci.yml` (kroki lint i build, osobne zadanie `e2e`).

### 2026-08-11 — Miejsca dla bramkarzy: rezerwacja albo wspólna pula, do wyboru

PROBLEM: mecz w Bojo z rozróżnieniem bramkarzy dzielił pulę na sztywno — przy 14 miejscach
i 2 bramkarzach zawodnicy z pola konkurowali o 12, więc trzynasty chętny lądował na
rezerwie, podczas gdy dwa miejsca dla bramkarzy stały puste i nikt ich nie zajmował.
Liczba wpisana przez organizatora jako „liczba miejsc" nie była liczbą osób, które mogą
dołączyć, a nic o tym nie mówiło. Rezerwacja bywa jednak dokładnie tym, czego organizator
chce — bez niej można skończyć z kompletem zawodników z pola i zerem bramkarzy.

ROZWIĄZANIE BOJO: podział miejsc jest wyborem organizatora, z opisem skutków liczonym
z realnej liczby miejsc. Trzy tryby: bez podziału na role (wszystkie miejsca wspólne),
rozróżnianie bez rezerwacji (wspólna pula, bramkarzy nie wejdzie więcej niż limit, może
zdarzyć się komplet bez bramkarza) oraz rezerwacja (14 miejsc = 12 w polu + 2 dla
bramkarzy, miejsca bramkarzy czekają do końca). Licznik na stronie meczu mówi to samo
językiem gracza: przy rezerwacji rozbija miejsca na role, przy wspólnej puli podaje
liczbę wspólną z dopiskiem, ilu bramkarzy jeszcze wejdzie.

MECHANIKA: migracja `077` (kolumna `events.goalkeeper_slots_reserved`, domyślnie `true`,
oraz `sync_reserve_claim()` respektujące tryb — bez tego kolejka rezerwowa liczyłaby
pojemność inaczej niż aplikacja przy zapisie); `lib/events.ts` (`decydujCzyRezerwa()`
i `wolneMiejscaWgRol()` z tym samym podziałem); `EventCapacityFields.tsx` (trzy opcje
z opisem zamiast przełącznika); `wydarzenia/nowe` i `wydarzenia/[id]/edytuj` (stan trybu);
`lib/eventDraft.ts` (szkic pamięta tryb).


