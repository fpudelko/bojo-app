# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk dziś najgęstszy w Poznaniu): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-09 · migracja `076` · 31 tabel · 344 testy

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

### 2026-08-09 — Rezerwa i bramkarze osobnymi kolejkami, treść powiadomień z datami, wizualne ulepszenia interfejsu

PROBLEM: limit miejsc dla zawodników z pola w Bojo nigdy nie zadziałał — zawodnik
dołączał do składu, gdy `taken < maxPlayers`, bez względu na to, czy miejsca dla
bramkarzy wyczerpały już całą pulę (`maxPlayers=2, maxGoalkeepers=2` oznaczał 0
miejsc w polu, a każdy zawodnik i tak wchodził do drużyny). Powiadomienia o nowych
prośbach o dołączenie nie miały daty i godziny meczu — tylko nazwę i sport.
Przycisk „Dodaj do grupy" na stronie meczu był schowany, szukanie go wśród opcji
zajmowało czas. Panel dolnej nawigacji na mapie (`/mapa`) był czasem nieobserwowalny
— karty gier mogły go przysłonić. Na `/profil` mobile nie widać było wordmarku
„bojo" jak na reszcie stron, czego też szukano. Baner z prośbą o imię na `/wydarzenia`
schował się za logowaniem, nowy użytkownik Google nie wiedział, co uzupełnić. Kreator
meczu jednorazowego nie miał opcji na utworzenie cyklicznego powtarzania w tym samym
przepływie.

ROZWIĄZANIE BOJO: rezerwa teraz pojawia się **osobno dla każdej roli** — zawodnicy
z pola konkurrują o `maxPlayers - maxGoalkeepers` miejsc, bramkarze o `maxGoalkeepers`.
Gdy bramkarze są wyłączeni (`goalkeepers_enabled = false`), cała pula `maxPlayers` idzie
na pole, zachowując stare zachowanie. Powiadomienia o nowych prośbach, zaakceptowanych
zapisach i nowych terminach serii zawierają datę i godzinę meczu (format: `DD.MM, godz.
HH:MM`). Nowe powiadomienie o odrzuceniu prośby o dołączenie informuje, że organizator
nie przyjął wpisu. Badge „Dodaj do grupy" stoi na górze strony meczu jako klikalny
element (dla organizatora edytowalny). Dolna nawigacja podniosła się w widoku (`z-[1200]`)
— karty nigdy jej nie przysłonią. `/profil` renderuje wordmark „bojo" po lewej w górnym
pasku na mobile. Panel powiadomień na telefonie renderuje się w viewporcie zamiast
względem przycisku dzwonka — zawsze w pełni widoczny. Przycisk „Wiesz, że możesz
zrobić to cyklicznie?" w kroku 2 kreatora otwiera modal i tworzy szablon w tle,
organizator widzi link do serii po publikacji. Krok 3 kreatora ma teraz grupę na
górze, gdzie należy — przed innymi ustawieniami.

MECHANIKA: migracja `074` (`sync_reserve_claim()` liczy i oferuje miejsca osobno
per rola); migracja `075` (daty/godziny w `powiadom_o_akceptacji` i
`powiadom_o_prosbie_o_dolaczenie`, nowy trigger `powiadom_o_odrzuceniu_prosby`);
`lib/events.ts` (nowe helpery `confirmedCounts()` i `decydujCzyRezerwa()` zastępujące
cztery kopie logiki, `createEvent()` używa decyduj… przy auto-dołączeniu organizatora);
`lib/recurring.ts` (`nextOccurrence()` scalone z lokalnej kopii, wzorowana na SQL
cronie); `EventBrowseCard.tsx` (badge „Wymaga akceptacji" w niebieskim `blue-50`);
`NotificationBell.tsx` (checkmark dla przeczytanych, `WYMAGA_AKCJI` Set dla dwóch
typów — `prosba_o_dolaczenie`, `reserve_claim_offered`, niebieskie vs. primary
zależnie od akcji); `BottomNav.tsx` (z-index z `z-[1000]` na `z-[1200]`, usunięta
pomarańczowa kropka „wczesny etap" dla `/wydarzenia`); `profil/page.tsx` (
`showMobileWordmark` na wszystkich renderach `<Header />`); `EventDateTimeField.tsx`
(opcjonalny prop `extraSlot` dla kafelka cyklicznego); `wydarzenia/nowe/page.tsx`
(grupa na górę kroku 3, cykliczny kafelek obok daty w kroku 2); `api.ts` w
`notify-game-alert/` (formatowanie dat w treści powiadomienia).

### 2026-08-09 — wydarzenia cykliczne jako prawdziwa seria: auto-tworzenie terminów, zbiorcza edycja, dziedziczenie ustawień
PROBLEM: cykliczny mecz w Bojo był tylko szablonem, który nikogo do niczego nie
zobowiązywał. `events.recurring_event_id` nie istniało w schemacie, mimo że kod je
odpytywał — zapytanie cicho zwracało pustkę, więc panel serii zawsze pokazywał „Brak
terminu". Kolejny termin trzeba było klikać ręcznie co tydzień — dokładnie tę pracę,
którą Bojo miało zdjąć z głowy. Gdy ktoś jednak kliknął, ustawienia i tak się gubiły:
szablon niósł tylko sport, miejsce, dzień i godzinę — płatna gierka odradzała się jako
darmowa, bez metod płatności i bez akceptacji zapisów. Edycja szablonu
(`/cykliczne/[id]/edytuj`) była czystą zaślepką „w przygotowaniu" — dnia tygodnia
i wyprzedzenia nie dało się zmienić po utworzeniu serii. Moduł był z tego powodu
świadomie schowany za `SHOW_RECURRING`.
ROZWIĄZANIE BOJO: cykliczny mecz jest teraz serią. Kolejny termin tworzy się sam — co
godzinę, z wyprzedzeniem ustawionym w szablonie — i dziedziczy PEŁNE ustawienia
z ostatniego rozegranego terminu (cenę, płatności, bramkarzy, akceptację zapisów,
grupę), nie z ubogiego szablonu. Gracze z poprzedniego meczu dostają powiadomienie, że
nowy termin czeka. Edycja meczu należącego do serii pyta, czy zmiana ma objąć tylko ten
termin, ten i przyszłe, czy całą serię — data zawsze zostaje przy jednym terminie,
niezależnie od wyboru. Szablon ma wreszcie prawdziwy ekran edycji (dzień tygodnia,
godzina, wyprzedzenie). Moduł „Stałe gierki" jest teraz widoczny w nawigacji.
MECHANIKA: migracja `073` — kolumna `events.recurring_event_id`, funkcje SQL
`utworz_termin_serii()` (RPC, wołane i przez `pg_cron`, i przez przycisk w aplikacji —
jedna ścieżka dla obu) i `utworz_nalezne_terminy_serii()` (pętla crona), wyzwalacz
`powiadom_o_nowym_terminie_serii`; `lib/series.ts` (`terminyWZakresie`,
`patchDlaPozostalych`, `updateSeriesEvents`, `updateSeriesTemplate`) pod testami
w `__tests__/series.test.ts`; `components/events/ZakresEdycjiSerii.tsx` wpięty w
`wydarzenia/[id]/edytuj/page.tsx` i modal „Zmień termin" w `EventDetailClient.tsx`;
`app/cykliczne/[id]/edytuj/page.tsx` (realny ekran zamiast zaślepki); `SHOW_RECURRING =
true` w `lib/features.ts`.

### 2026-08-09 — Kolor i powiadomienia „Wymagaj akceptacji", grupa zamiast „ekipy", naprawiony panel powiadomień i baner profilu
PROBLEM: kilka niezależnych usterek zebranych z żywej instancji. Panel powiadomień
(dzwonek) ucinał się przy lewej krawędzi ekranu na telefonie — nie dało się przewinąć
do treści wychodzącej poza viewport. Organizator nie dostawał żadnego powiadomienia,
gdy ktoś złożył prośbę o dołączenie do meczu z włączonym „Wymagaj akceptacji" —
jedynym sposobem, by się dowiedzieć, było wejście na stronę meczu. To samo dotyczyło
członków grupy przy nowym meczu w grupie. „Wymagaj akceptacji" dzieliło kolor
(bursztyn) z zupełnie innymi stanami (rezerwa, obserwowanie), więc nic nie mówiło
jednoznacznie „to wymaga Twojej akcji". Przypisanie meczu do grupy było schowane
w panelu „Zarządzaj wydarzeniem", a UI naprzemiennie nazywało tę samą funkcję
„ekipą" i „grupą" — sprawiało to wrażenie dwóch różnych, niedokończonych funkcji.
Baner „Uzupełnij profil" chował się za kluczem localStorage wspólnym dla całej
przeglądarki, nie per konto — odrzucenie go na jednym koncie wyciszało go na zawsze
na każdym koncie w tej samej przeglądarce. Komunikat o widoczności numeru BLIK był
identyczny niezależnie od tego, czy ktoś w ogóle był zapisany na mecz.
ROZWIĄZANIE BOJO: panel powiadomień na telefonie renderuje się teraz jako
zakotwiczony w viewporcie, nie względem przycisku dzwonka. Organizator dostaje
powiadomienie przy każdej nowej prośbie o dołączenie, a członkowie grupy — przy
każdym nowym meczu w grupie. „Wymaga akceptacji" ma teraz własny, wyłączny kolor
(niebieski) na badge'u meczu, karcie na liście, panelu próśb i w dialogu dołączania —
bursztyn został przy rezerwie i obserwowaniu. Przypisanie do grupy to teraz klikalny
badge na górze strony meczu (widoczny i edytowalny dla organizatora, informacyjny dla
reszty), otwierający ten sam dialog wyboru/zakładania grupy co kreator. Cały interfejs
mówi teraz „grupa", nie „ekipa". Baner profilu pamięta odrzucenie osobno dla każdego
konta. Komunikat o BLIK-u rozróżnia „nie jesteś zapisany" od „jesteś zapisany, jeszcze
za wcześnie". Zakładka „Moje" w dolnej nawigacji dostała niebieską kropkę, gdy
organizator ma choć jedną nierozpatrzoną prośbę o dołączenie w dowolnym swoim meczu.
MECHANIKA: `components/layout/NotificationBell.tsx` (`fixed` na mobile, `absolute`
od `sm:`); migracja `072` (triggery `powiadom_o_prosbie_o_dolaczenie`,
`powiadom_o_nowym_meczu_w_grupie`); `EventDetailClient.tsx` (`blue-*` w panelu
„Prośby o dołączenie" i „Oczekujesz na akceptację", nowy badge „Wymaga akceptacji",
badge grupy zamiast selecta w panelu zarządzania, `WybierzGrupeDialog` reużyty na
stronie meczu); `EventBrowseCard.tsx` (`STATUS_CHIP.pending` niebieski);
`components/events/WybierzGrupeDialog.tsx` i `InviteFromGroupDialog.tsx`
(nazewnictwo „grupa"); `UzupelnijProfilBanner.tsx` (klucz localStorage z `user.id`);
`lib/events.ts#hasPendingApprovalRequests`; `components/layout/BottomNav.tsx`
(druga, niezależna kropka).

### 2026-08-09 — Szlif przepływu organizatora: kafelek cykliczny w kreatorze, panel zarządzania tylko dla organizatora, edycja ujednolicona z kreatorem, naprawa banera o brakującym imieniu
PROBLEM: kilka drobnych, ale realnych usterek w przepływie organizacji meczu. Panel
„Zarządzaj wydarzeniem" (edycja, powtórz mecz, usuń) był widoczny nie tylko dla
organizatora, ale i dla adminów przeglądających cudzy mecz. Modale „Zmień termin"
i „Kto widzi ten mecz" miały przycisk potwierdzający częściowo zasłonięty przez dolną
nawigację na telefonie, a zmiana godziny rozpoczęcia nie przesuwała automatycznie
godziny zakończenia (dało się ustawić koniec przed początkiem). Strona edycji wydarzenia
miała stary układ pól, niezależny od kreatora — brakowało tam m.in. informacji, że numer
BLIK gracze zobaczą dopiero godzinę przed meczem. „Powtórz mecz" nie pytało o rolę
(bramkarz/zawodnik) mimo że kopiowany mecz rozróżniał bramkarzy. Po zalogowaniu Google
bez pełnego imienia i nazwiska w profilu (Google zawsze wypełnia jakieś pole nazwy) baner
i powiadomienie „Uzupełnij imię" nigdy się nie pojawiały — sprawdzały tylko, czy
JAKAKOLWIEK nazwa istnieje, nie czy jest pełna. Kreator meczu jednorazowego nie miał
opcji ustawienia cyklicznego powtarzania, mimo że silnik cyklicznych wydarzeń (dziś
schowany za flagą) już istnieje.
ROZWIĄZANIE BOJO: krok 2 kreatora ma kafelek „Wydarzenie cykliczne" — otwiera modal
z dniem tygodnia wyliczonym z wybranej daty i suwakiem przypomnień, po zapisaniu tworzy
niezależny szablon w tle i po publikacji meczu pokazuje link do panelu serii. Panel
zarządzania wydarzeniem widzi wyłącznie faktyczny organizator. Oba modale (termin,
widoczność) są w pełni klikalne nad dolną nawigacją, a przesunięcie godziny rozpoczęcia
automatycznie przesuwa koniec o tę samą deltę (zmiana końca nie rusza początku). Strona
edycji wygląda i działa jak kreator — te same komponenty pól (sport, lokalizacja, data
i czas trwania, liczba miejsc, płatności, widoczność, tytuł/opis), więc notatka o BLIK-u
i inne poprawki w kreatorze automatycznie trafiają też do edycji. „Powtórz mecz" pyta
o rolę, gdy kopiowany mecz rozróżnia bramkarzy, i informuje, że resztę ustawień zmienisz
na nowo utworzonym meczu. Baner i powiadomienie o brakującym imieniu sprawdzają teraz
pełną nazwę (imię i nazwisko, nie dowolny fragment) — działają też dla kont z Google.
Landing i przyciski „Znajdź grę" mają plakietkę/wskaźnik „wczesny etap".
MECHANIKA: `components/events/RecurringSettingsDialog.tsx`, `lib/recurring.ts`
(`dayOfWeekFromDate`, `dayOfWeekLabelFromDate`), zapis w `handleSubmit`
w `wydarzenia/nowe/page.tsx` (`createRecurringEvent`, cichy fallback przy błędzie),
odczyt `?cykliczne=<id>` w `EventDetailClient.tsx`; `isOwner` zamiast `isOrganizer`
przy renderze sekcji „Zarządzaj wydarzeniem"; `z-[1100]` zamiast `z-50` na modalach
terminu i widoczności; nowe komponenty w `components/events/`
(`EventSportField`-owy inline w edycji, `EventLocationField`-owy inline,
`EventDateTimeField`, `EventCapacityFields`, `EventTitleDescriptionField`,
`EventVisibilityFields`, `EventPaymentFields`) i `components/ui/ToggleRow.tsx`,
współdzielone przez `wydarzenia/nowe/page.tsx` i `wydarzenia/[id]/edytuj/page.tsx`;
`GK_SPORTS` przeniesione do `lib/sports.ts`; `repeatEvent()` w `lib/events.ts`
(parametr `organizerIsGoalkeeper`, już istniał, dopiero teraz podłączony w UI);
`isPelneImie()` zamiast usuniętego `brakNazwy()` w `lib/profileName.ts`,
`UzupelnijProfilBanner.tsx` i `wydarzenia/nowe/page.tsx`; migracja `071` (ten sam
warunek „pełna nazwa" w wyzwalaczu `powiadom_o_braku_nazwy()`); `WczesnyEtapBadge`
w `Header.tsx`, `BottomNav.tsx` (kropka zamiast pełnego badge'a), `LandingHero.tsx`,
`NextMatchCard.tsx`.

### 2026-08-08 — Naprawa dołączania do składu, ekipa i ostatnie boisko w kreatorze, uczciwe komunikaty o wczesnym etapie
PROBLEM: dołączanie do składu w Bojo było zepsute. Organizator zaznaczający „Biorę
udział" nie trafiał do własnego składu, przycisk „Dołącz" na cudzym meczu nie zapisywał,
„Dopisz osobę bez konta" nie działało — wszystko bez jednego komunikatu o błędzie.
Działało wyłącznie obejście: „Obserwuj", a potem „Dołącz" — ale ta ścieżka nie pytała
ani o pozycję (pole/bramka), ani o sposób płatności. W kreatorze meczu „Czas na decyzję
z rezerwy" był schowany pod „Więcej opcji", przycisk „zlokalizuj mnie" był przycięty poza
widok, nie dało się przypisać meczu do ekipy inaczej niż wchodząc ze strony grupy, a każde
kolejne wydarzenie wymagało szukania tego samego boiska od zera. Po utworzeniu meczu
„Wróć" cofało do wypełnionego kreatora. Logowanie Google kierowało na pulpit zamiast na
listę meczów, przez co konto bez imienia nie widziało prośby o uzupełnienie profilu.
Landing obiecywał społeczność dobierającą skład i komplet opisów boisk — obie rzeczy
wyprzedzały stan Bojo.
ROZWIĄZANIE BOJO: zapisy do składu działają wszystkimi ścieżkami, a przejście
z obserwowania w granie pyta o pozycję i płatność tak samo jak zwykłe dołączanie.
Kreator pokazuje czas na decyzję z rezerwy bez rozwijania, ma widoczny przycisk lokalizacji,
pozwala wybrać ekipę w kroku 3 (z możliwością założenia nowej na miejscu) i proponuje
ostatnio używane boisko jednym dotknięciem. Po publikacji „Wróć" prowadzi na „Moje gry".
Zalogowany ląduje na liście meczów, a baner z prośbą o imię stoi właśnie tam. Mapa ma
przełącznik „Gry | Obiekty" zamiast pojedynczego pilla. Karty opisujące otwieranie meczu
dla nieznajomych i katalog boisk są oznaczone jako wczesny etap i mówią, co faktycznie
działa dzisiaj.
MECHANIKA: usunięta kolumna `status` z trzech insertów do `event_participants`
w `lib/events.ts` (skasowana migracją `064`, PostgREST odrzucał każdy taki insert)
+ sprawdzanie błędu w `createEvent` + test-strażnik `__tests__/eventsSchema.test.ts`;
`confirmFromMaybe()` przyjmuje rolę i płatność, wywoływane z `JoinDialog`
w `EventDetailClient.tsx`; `lib/lastVenue.ts` (localStorage, TTL 60 dni),
`components/events/WybierzGrupeDialog.tsx`, pole `grupaId` w `lib/eventDraft.ts`;
`components/ui/SegmentedToggle.tsx` w `components/map/VenueExplorer.tsx`; domyślny cel
w `app/auth/callback/page.tsx` i `UzupelnijProfilBanner` w `app/wydarzenia/EventsListView.tsx`;
pole `wczesnyEtap` w `components/home/landing/content.ts`.

### 2026-08-08 — Widoczność płatności i zaproszeń dla uczestnika, „Brakuje graczy" na /moje-gry
PROBLEM: uczestnik płatnego meczu nigdy nie widział, ile ma zapłacić — kwotę
po zniżce z karty sportowej i status opłacone/nieopłacone widział wyłącznie
organizator. Organizator nie miał gdzie sprawdzić, na który z jego meczów
nie zbiera się skład — `/moje-gry` świadomie miesza organizowanie i granie
w jednej liście. Nie było też widać, kogo organizator zaprosił imiennie i kto
odpowiedział — `dismissed_at` istniał w bazie od dawna, ale nigdzie się go nie
pokazywało. Osobno: przycisk „Zaproś z ekipy" dublował się na stronie meczu,
z dwiema różnymi ikonami i różnymi warunkami widoczności.
ROZWIĄZANIE BOJO: nowa karta „Twoja płatność" na stronie meczu pokazuje
uczestnikowi dokładną kwotę, sposób płatności i status. Nowa sekcja „Brakuje
graczy" na `/moje-gry` (zakładka „Nadchodzące") wypisuje organizowane mecze
bez kompletu, od najbliższego terminu — obok, nie zamiast, dotychczasowej
wspólnej listy. Nowa karta „Zaproszeni" na stronie meczu (tylko organizator)
pokazuje imię, awatar i status każdej zaproszonej osoby: Czeka / Dołączył(a)
/ Nie tym razem. Przycisk „Zaproś z ekipy" został jeden, przy liczniku
wolnych miejsc.
MECHANIKA: `priceForParticipant()` (`lib/payments.ts`) użyty też po stronie
uczestnika w `EventDetailClient.tsx`, gated przez `event.showPaymentStatus`;
`NeedsPlayersSection` w `components/home/dashboard/DashboardSections.tsx`
filtruje dane już pobrane przez `getMyParticipatedEvents()` — zero nowego
zapytania; `components/events/EventInvitesStatus.tsx` +
`getEventInvitesWithNames()` (`lib/playerInvites.ts`, drugie zapytanie do
`profiles` — brak klucza obcego z `event_player_invites` do tej tabeli) +
`lib/inviteStatus.ts` (reguła „uczestnictwo bije wcześniejszą odmowę", pod
testem po tym, jak przegląd kodu złapał tu odwróconą kolejność).

### 2026-08-08 — Przepływ organizatora: podsumowanie przed publikacją, wysyłka linku, powiadomienie o odwołaniu meczu
PROBLEM: organizator Bojo publikował mecz na ślepo — przycisk „Opublikuj mecz" stoi na
trzecim kroku kreatora, a data, miejsce, skład i cena były ustawiane na krokach 1–2
i w chwili publikacji nie były widoczne. Po publikacji nic go nie prowadziło: kreator
kończył się przekierowaniem na zwykłą stronę meczu, a strona miała DWA różne linki pod
przyciskami o tej samej nazwie „Udostępnij" i wysyłała goły adres bez daty, miejsca
i ceny — czyli mniej niż post na czacie. Odwołanie meczu było ciche: uczestnik dowiadywał
się o nim wyłącznie wchodząc na stronę meczu, więc kto nie wszedł, przyjeżdżał na boisko.
Konto założone e-mailem bez podania imienia publikowało mecz pod pełnym adresem e-mail
organizatora, na publicznej i indeksowanej stronie. Wejście „Zorganizuj tu mecz" ze strony
boiska i „Stwórz mecz w grupie" gubiły po zalogowaniu wybrane boisko oraz grupę.
ROZWIĄZANIE BOJO: ostatni krok kreatora pokazuje kartę „Tak zobaczą to gracze" — data,
miejsce, skład, koszt i widoczność, każde z przyciskiem cofającym na właściwy krok, plus
nazwa, pod którą organizator się pojawi, z edycją na miejscu. Po publikacji strona meczu
wita organizatora panelem „Mecz gotowy" z jedną główną akcją: wysłaniem linku. Link jest
jeden dla całej aplikacji, a wraz z nim idzie gotowy czterowierszowy tekst (sport, termin,
miejsce, liczba miejsc i cena) do wklejenia na czat. Odwołanie meczu trafia do skrzynki
powiadomień wszystkich zapisanych. Rejestracja e-mailem wymaga imienia i nazwiska, a konto
bez nazwy dostaje powiadomienie i baner kierujące do profilu. Mapa wyboru miejsca ma
przycisk „pokaż moją okolicę" i dojeżdża do wyników wyszukiwania.
MECHANIKA: `lib/eventSummary.ts` + `app/wydarzenia/nowe/PodsumowanieMeczu.tsx`;
`lib/eventShare.ts` (`eventUrl`, `eventShareText`, `shareEvent`) używane przez pasek górny
i panel „Zaproś znajomych" w `EventDetailClient.tsx`; `lib/profileName.ts` (przeniesione
tam `displayName`/`firstName`/`avatarUrl` + `isPelneImie`, `brakNazwy`); migracja `070`
(wyzwalacze `powiadom_o_odwolaniu` na `events` i `powiadom_o_braku_nazwy` na `auth.users`);
`components/home/dashboard/UzupelnijProfilBanner.tsx`; `LocateMeButton` i `fitBounds`
w `components/map/UnifiedLocationPickerImpl.tsx`.

### 2026-08-07 — Rozwijane pigułki filtrów w pełni widoczne, godzina na pinezce meczu, naprawiony licznik "0 obiektów"
PROBLEM: rozwijane pigułki filtrów (Sortuj, Sport) na `/wydarzenia` i `/mapa`
wyrównywały panel do lewej krawędzi przycisku — dla przycisku blisko prawej krawędzi
telefonu panel wyjeżdżał poza ekran i obcinał kolumnę z ptaszkami przy wybranych
opcjach, więc nie było widać, co jest zaznaczone. Etykieta „kiedy" na pinezkach meczów
(dodana w poprzedniej rundzie) pokazywała tylko dzień („jutro", „w piątek"), bez
godziny, więc trzeba było dotknąć pinezki, żeby w ogóle zorientować się, o której mecz
się zaczyna. Modal filtrów na `/mapa` (Typ obiektu, Nawierzchnia) przy domyślnym,
oddalonym widoku całej Polski zawsze pokazywał „Pokaż 0 obiektów" — licznik liczył się
z listy, która w tym trybie mapy jest zawsze pusta, niezależnie od tego, ile obiektów
realnie było w kadrze.
ROZWIĄZANIE BOJO: panel rozwijanej pigułki dosuwa się teraz do prawej krawędzi ekranu
zamiast wyjeżdżać poza nią, gdy przycisk stoi blisko brzegu — cała lista z ptaszkami
jest zawsze w pełni widoczna. Etykieta na pinezce meczu pokazuje teraz dzień i godzinę
razem (np. „jutro · 18:00", „w piątek · 20:30"). Licznik w modalu filtrów na `/mapa`
w oddalonym widoku pokazuje realną liczbę obiektów w kadrze zamiast zawsze zera.
MECHANIKA: `components/ui/FilterPill.tsx#PillDropdown` (stała szerokość panelu +
przeliczenie pozycji względem prawej krawędzi ekranu); `components/map/GamesMarkersLayer.tsx`
(`matchWhenLabel(date, time)` zamiast `matchWhenLabel(date)`); `VenueExplorer.tsx#previewFieldsCount`
(w trybie skupisk liczy z `wKadrze` zamiast z pustego `allFields`).

### 2026-08-07 — Mapa meczów: emoji sportu i „kiedy" na pinezce, swipe w panelu, zamykanie dotknięciem mapy
PROBLEM: pinezki meczów na mapie (widok mapy w `/wydarzenia` i tryb „Pokaż gry" na
`/mapa`) nie różniły się niczym poza kolorem — nie było widać, jaki to sport ani kiedy
jest mecz, bez dotknięcia każdej z osobna. Pigułka „Sortuj" pokazywała się też na
samej mapie, mimo że tam nie ma listy do sortowania. Panel szczegółów po dotknięciu
pinezki nie miał sposobu na przejście do sąsiedniego meczu bez zamykania go i szukania
kolejnej pinezki, a dotknięcie mapy w pustym miejscu nie zamykało otwartego panelu.
Widok mapy w `/wydarzenia` nie miał przycisku „zlokalizuj mnie", a na `/mapa` ten
przycisk miał ikonę pinezki zamiast celownika.
ROZWIĄZANIE BOJO: pinezka pojedynczego meczu to teraz kółko w kolorze sportu z emoji
sportu w środku i etykietą „dziś"/„jutro"/„w piątek"/„12 wrz" pod spodem — cena i reszta
zostają w panelu, żeby nie przeładować samej pinezki. Klaster kilku meczów blisko
siebie ma ten sam, stylowany wygląd co klastry boisk (kolorowe kółko z liczbą). Panel
szczegółów: swipe w lewo/prawo przełącza na kolejny/poprzedni mecz w tej samej
kolejności co pinezki, a dotknięcie mapy poza pinezką zamyka otwarty panel. Pigułka
„Sortuj" zniknęła z obu widoków mapy (na `/wydarzenia` chowa się tylko w widoku mapy,
zostaje na liście; na `/mapa` w trybie gier zniknęła całkowicie, bo tam nie ma innego
trybu). Widok mapy w `/wydarzenia` dostał przycisk „zlokalizuj mnie" (wcześniej go nie
miał), a ikona na obu mapach to teraz celownik zamiast pinezki.
MECHANIKA: `components/map/GamesMarkersLayer.tsx` (emoji przez `sportEmoji()`, etykieta
przez `matchWhenLabel()` z `lib/eventDates.ts`, `map.on('click', …)` zamykający panel);
`lib/eventFilters.ts#swipeEventId` + `lib/useSwipe.ts` (wykrywanie gestu); nowy wspólny
`components/map/LocateMeButton.tsx` (ikona `LocateFixed`), używany w `VenueExplorer.tsx`
i nowo w `components/map/GamesMapCanvas.tsx`.

### 2026-08-07 — Suwaki filtrów i mapa meczów w /wydarzenia, tryb „Pokaż gry" na /mapa
PROBLEM: lista meczów Bojo (`/wydarzenia`) na telefonie miała dwa osobne paski kafelków
(sporty, potem filtry), filtr „Kiedy" był listą opcji, a „Odległość" dyskretnymi
chipsami — żaden nie dawał precyzyjnej kontroli, i nie było w ogóle filtra ceny ani
minimalnej liczby wolnych miejsc. Sprawdzenie meczów na mapie wymagało przejścia na
osobną stronę `/mapa`, która pokazuje wyłącznie boiska, nie mecze, i gubi filtry
ustawione na liście. Cztery strony (`/moje-gry`, `/grupy`, `/grupy/[id]`, widok
wydarzenia) zostawiają na telefonie pasek nawigacji z pustym lewym rogiem. Kafelek
„Najbliższy mecz" na `/moje-gry` miał inny, większy styl niż reszta kart tej strony.
Baner „Wróciliśmy do Twojego szkicu" w kreatorze meczu pokazywał się nawet po samym
wejściu na stronę, bez żadnej edycji formularza.
ROZWIĄZANIE BOJO: jeden pasek kafelków (Sortuj / Filtry / Sport / Wolne miejsca / Za
darmo) zamiast dwóch — „Sortuj" ma stały napis, nie nazwę aktualnie wybranej opcji, tak
jak „Filtry" — a w modalu filtrów cztery suwaki (Kiedy, Odległość, Cena, minimalna
liczba wolnych miejsc). Nowy przycisk obok dzwonka przełącza `/wydarzenia` na
wewnętrzny widok mapy z pinezkami wszystkich meczów spełniających ustawione filtry —
bez opuszczania strony. `/mapa` dostała przełącznik „Pokaż gry": zamienia cały pasek
i pinezki na identyczny tryb (mecze zamiast boisk), bez resetowania pozycji mapy;
zbędny przełącznik „Otwarte gry" (dublował się z „Gry dziś" i z samym trybem gier)
zniknął z paska obiektów. Pinezki meczów na obu mapach mają teraz ostylowaną ikonę
klastra (kolorowe kółko z liczbą, jak przy boiskach) zamiast gołego, nieczytelnego
numeru, i większe, wyraźniejsze kropki dla pojedynczych meczów.
`/moje-gry`, `/grupy`, `/grupy/[id]` i widok wydarzenia pokazują na telefonie kompaktowy
napis „bojo" prowadzący na stronę główną. Kafelek „Najbliższy mecz" ma dziś ten sam styl
co reszta kart na `/moje-gry`. Baner szkicu kreatora pokazuje się już tylko po realnej
edycji formularza, mieści się w jednej linii i ma krzyżyk do zamknięcia.
MECHANIKA: `components/ui/RangeSlider.tsx` (generyczny suwak); `lib/eventFilters.ts`
(`filterByMaxPrice`, `filterByMinFreeSpots`, `multiLabel`, `toggleInArray`; `DateFilter`
ma dziś `'miesiac'` zamiast `'weekend'`); `components/map/GamesMarkersLayer.tsx` +
`GamesMapCanvas.tsx` (klastrowane pinezki meczów, współdzielone przez widok mapy
w `/wydarzenia` i tryb gier na `/mapa`); `VenueExplorer.tsx` stan `showGames`
(URL `?gry=1`); `Header.tsx` prop `showMobileWordmark`; `NextMatchCard.tsx` renderuje
`EventBrowseCard`; `app/wydarzenia/nowe/page.tsx` guard `isFirstSave` przed pierwszym
zapisem szkicu.
