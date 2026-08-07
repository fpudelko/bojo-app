# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk dziś najgęstszy w Poznaniu): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-07 · migracja `069` · 31 tabel · 245 testów

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
### 2026-08-07 — Mapa szuka w całym katalogu, filtry dopasowane do nowych danych z importu OSM
PROBLEM: pole szukania na mapie Bojo (`/mapa`) filtrowało wyłącznie to, co było już
wczytane dla aktualnie widocznego fragmentu mapy — przy oddaleniu ta lista jest pusta,
więc szukanie nic nie znajdowało, a przy przybliżeniu wpisanie miasta spoza widoku też
nic nie dawało. Filtr „Typ obiektu" oferował dwanaście szczegółowych kategorii, mimo że
98,3% publicznych obiektów ma tę kolumnę pustą (import z OpenStreetMap jej nie
ustawia) — wybranie jakiegokolwiek typu wyglądało jak zepsuta wyszukiwarka. Filtr sportu
pomijał dwie duże kategorie (wielofunkcyjne, piłka ręczna), które mimo to miały już
kolorowe pinezki na mapie. Powrót ze strony boiska zawsze lądował na widoku całego
kraju, gubiąc oglądany wcześniej obiekt.
ROZWIĄZANIE BOJO: szukanie po tekście przeszukuje teraz cały katalog (nie tylko bieżący
kadr) i mapa dopasowuje widok do wyników. Filtry sportu i przełączniki „Gry dziś"/
„Otwarte gry" zostają zawsze widoczne, a Typ obiektu i nowa Nawierzchnia (dane w 37%
wierszy — trawa, nawierzchnia twarda, piasek, beton, sztuczna trawa, mączka) przenoszą
się do modala otwieranego przyciskiem „Filtry", w stylu Booking: wybory są szkicem,
stosują się dopiero po zatwierdzeniu. Sport dostał dwie nowe opcje. Karta „Zobacz
boisko" zapamiętuje, z którego obiektu wyszła, więc powrót wraca na tę samą pinezkę.
MECHANIKA: `searchExplorerFields()` z `lib/api.ts` wpięta w `VenueExplorer.tsx`
(debounce 300 ms, `fitBounds` do wyników); `EXPLORER_COLS` dokłada kolumnę `surface`;
`MAP_FILTER_SPORTS` w `lib/sports.ts`; `components/ui/FilterSheet.tsx` (modal, wspólny
z `/wydarzenia`); `VenueCard` prop `backTo` → `?wroc=/mapa?boisko=<id>` na stronie
boiska.

### 2026-08-07 — Pasek nawigacji znika na telefonie tam, gdzie dubluje treść strony
PROBLEM: na `/wydarzenia` i `/mapa` zalogowany na telefonie widział osobny górny pasek
z dzwonkiem i awatarem, mimo że strona głównego pulpitu Bojo od dawna pokazuje to samo
w swoim własnym wierszu powitania — dwa równoległe miejsca na to samo. Osobno:
obserwowane mecze pokazywały się wyłącznie jako sekcja pod zakładką „Nadchodzące" na
`/moje-gry`, bez własnego miejsca do przejrzenia wszystkich naraz.
ROZWIĄZANIE BOJO: na stronie głównej, `/wydarzenia` i `/mapa` górny pasek znika na
telefonie dla zalogowanych, a dzwonek i awatar wędrują do wiersza, który strona i tak
już pokazuje (powitanie / pole szukania / pasek nad mapą). `/moje-gry` i `/grupy`
zachowują pasek bez zmian. `/moje-gry` dostała czwartą zakładkę „Obserwowane" z pełną
listą — sekcja pod „Nadchodzące" zniknęła, żeby nie dublować tej samej informacji.
MECHANIKA: `Header.tsx` prop `hideMobileBarForUser`; nowy
`components/layout/MobileIdentityRow.tsx` (dzwonek + awatar, reużywany w
`GreetingBar.tsx`, `EventsListView.tsx`, `VenueExplorer.tsx`); zakładka `observing`
w `app/moje-gry/page.tsx`.

### 2026-08-07 — Lista meczów z filtrami i sortowaniem, strona grupy z zaproszeniem
PROBLEM: lista publicznych meczów w Bojo (`/wydarzenia`) filtrowała sporty samymi
emoji bez podpisów — na telefonie nie było nawet dymka, który by je wyjaśnił. Nie
dało się posortować listy w żaden sposób, a mecze tego samego dnia wracały
w przypadkowej kolejności, bo baza sortowała samą datą bez godziny. Błąd sieci
wyglądał identycznie jak brak meczów. Wyszukiwarka nie składała polskich znaków,
więc „pilka" nie znajdowało „piłka nożna". Osobno: na stronie grupy nadchodzące
mecze wyświetlały się w odwrotnej kolejności (najdalszy pierwszy), a osoba wchodząca
z linku zaproszenia `/g/[kod]` lądowała na zwykłej stronie i musiała sama szukać
przycisku dołączenia.
ROZWIĄZANIE BOJO: lista meczów ma filtry z nazwami sportów, wybór zakresu dat
(dzisiaj / jutro / ten tydzień / weekend), sortowanie (najbliższy termin, najbliżej
mnie, najwięcej wolnych miejsc), przełączniki „wolne miejsca" i „za darmo" oraz
podział na sekcje dzienne. Sortowanie po odległości pyta o zgodę na lokalizację
i przy odmowie wraca do sortowania po terminie. Wyszukiwarka ignoruje polskie znaki
i obejmuje też dzielnicę. Awaria pobierania danych ma własny ekran z ponowieniem.
Strona grupy pokazuje najbliższy mecz na górze, dzieli treść na zakładki Mecze
i Skład, a zaproszony z linku widzi baner „Masz zaproszenie" z przyciskiem
dołączenia. Ekran logowania pokazuje pod formularzem prawdziwą listę meczów.
MECHANIKA: `app/wydarzenia/EventsListView.tsx` (wydzielone z `EventsListClient.tsx`),
`lib/eventFilters.ts` (filtrowanie, grupowanie, sortowanie — pod testami),
`lib/searchText.ts` (`foldText`), `lib/plural.ts`, `lib/geo.ts#distanceKm`,
`components/ui/FilterPill.tsx` (wspólne z mapą boisk),
`app/grupy/[id]/page.tsx` + `GroupDetailClient.tsx` (metadane strony grupy,
odczyt `?join=1`, `isGroupMember` jako osobne zapytanie),
`lib/groups.ts#setGroupCover`, `components/auth/LoginBackdrop.tsx`.

### 2026-08-07 — Landing pokazuje trzy ekrany aplikacji, pasek dla niezalogowanych bez menu
PROBLEM: podgląd aplikacji na stronie głównej Bojo pokazywał jeden ekran, i to
niepełny — ramka telefonu brała wysokość ze swojej zawartości, a zawartości była
jedna karta, więc wyglądało to na ścinek zrzutu. Osobno: strona główna miała cztery
identyczne przyciski „Zorganizuj mecz", co rozmywało jedno wezwanie do działania
w cztery słabe.
ROZWIĄZANIE BOJO: podgląd to teraz karuzela trzech pełnych ekranów telefonu, którą
przewija się palcem: „Twoje mecze", tworzenie meczu i strona meczu. Przyciski
„Zorganizuj mecz" zostały dwa — w nagłówku strony i w sekcji „Co dostajesz";
w sekcji „Jak to działa" klikalny jest pierwszy krok, a pas pod pytaniami zniknął.
Pasek dla niezalogowanego na telefonie ma ikonę mapy, przycisk „Dołącz" (otwiera
zakładanie konta) i ikonę logowania — bez menu pod hamburgerem.
MECHANIKA: `components/home/landing/PhoneCarousel.tsx`, `PhoneShell.tsx`
(proporcja `aspect-[9/19]` wymusza pełny ekran), `mockScreens.tsx`;
`LANDING_STEPS[0].href` w `landing/content.ts`; usunięty `LandingFinalCta.tsx`;
`Header.tsx` (klaster mobilny, kasacja arkusza menu), `AuthForm` prop `initialMode`.

### 2026-08-07 — Mapa pobiera tylko to, co widać
PROBLEM: mapa Bojo pobierała wszystkie publiczne obiekty naraz, z pełnym
zestawem kolumn — łącznie z adresami zdjęć i danymi rezerwacji — po czym
renderowała z tego jedną kartę. Przy katalogu poznańsko-lubelskim (~2 tys.)
dało się z tym żyć. Przy ogólnopolskim bolałyby dwie rzeczy naraz: transfer
oraz to, że przeglądarka musi utworzyć kilkadziesiąt tysięcy obiektów mapy,
żeby zaraz zwinąć je w kilkanaście kółek.
ROZWIĄZANIE BOJO: mapa pobiera wyłącznie wycinek, który widać, i tylko tyle
danych, ile potrzebuje pinezka. Przy oddaleniu nie pobiera obiektów w ogóle —
baza zwraca liczby w komórkach siatki, a mapa rysuje z nich kółka. Po
przybliżeniu poniżej powiatu przychodzą konkretne obiekty. Szczegóły karty
(zdjęcie, nawierzchnia, strona) dociągane są dla kart faktycznie widocznych.
MECHANIKA: migracja `069` — funkcja `mapa_skupiska()` grupująca po siatce
szerokość/długość plus indeks częściowy na `(lat, lng)` dla obiektów
publicznych. `getExplorerFields(kadr)`, `getExplorerClusters()`
i `getFieldsByIds()` w `lib/api.ts`; `KadrObserwator` i `WarstwaSkupisk`
w `components/map/VenueExplorer.tsx`.

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

### 2026-08-06 — Telefon do organizatora chowa się do godziny przed meczem, kreator meczu domyślnie liczy koszt obiektu
PROBLEM: numer telefonu do BLIKA, który organizator podawał przy tworzeniu meczu,
widniał na publicznej, indeksowalnej stronie meczu dla każdego — także osoby
niezalogowanej, tygodnie przed grą. Pole nie miało też żadnego ograniczenia długości.
Osobno: kreator zakładał domyślnie wpisywanie kosztu „od osoby", choć organizator
zwykle zna najpierw cenę wynajmu całego obiektu i musiał dzielić ją w głowie; zmiana
liczby miejsc po wpisaniu kwoty nie przeliczała jej na nowo.
ROZWIĄZANIE BOJO: numer do BLIKA widzi organizator zawsze, a uczestnik ze składu
dopiero godzinę przed startem meczu — z jednym wyjątkiem: okno „Dołączam” z wyborem
BLIKA pokazuje numer od razu, bo bez niego nie da się zapłacić przy zapisie. Pole
przyjmuje wyłącznie 9 cyfr i formatuje je w trójkach podczas pisania; publikacja
meczu z wybranym BLIKA i niepełnym numerem jest zablokowana, tak samo jak zniżka
karty sportowej wyższa niż koszt od osoby. Kreator domyślnie wpisuje koszt za cały
obiekt i przelicza cenę od osoby na bieżąco, także po zmianie liczby miejsc.
MECHANIKA: `canSeeBlikPhone()`, `formatBlikPhone()`, `BLIK_PHONE_REVEAL_MINUTES = 60`
oraz `minutesUntilStart()` w `lib/payments.ts`/`lib/eventDates.ts`; `validatePayments()`
w `lib/eventWizard.ts`, wpięta w krok 2 kreatora i w `app/wydarzenia/[id]/edytuj/page.tsx`.
Bramka działa wyłącznie w interfejsie — kolumna `blik_phone` nadal przyjeżdża w całym
wierszu `events` (patrz BACKLOG.md).

### 2026-08-06 — Kreator meczu pamięta szkic przez 12 godzin, telefon dla zalogowanych bez zdublowanej nawigacji
PROBLEM: opuszczenie kreatora meczu w trakcie (np. żeby sprawdzić godzinę wynajmu)
zerowało cały formularz — organizator wracał do pustych pól. Osobno: na telefonie
zalogowany użytkownik widział jednocześnie górny pasek z logo i hamburgerem oraz
dolną nawigację z tymi samymi skrótami, a każda strona miała pod treścią pas pustego
tła (dolna nawigacja jest elementem `fixed` montowanym poza kontenerem strony, więc
dystans, który miał ją kompensować, nie działał). `/moje-gry` powielała przy tym
własną, osobno utrzymywaną wersję sekcji, które pulpit strony głównej już miał.
ROZWIĄZANIE BOJO: kreator zapisuje wypełniany formularz w przeglądarce na 12 godzin
i przywraca go po powrocie, z paskiem „Wróciliśmy do Twojego szkicu” i opcją „Zacznij
od nowa”. Górny pasek dla zalogowanego na telefonie to dziś dzwonek powiadomień
i awatar prowadzący do `/profil` — tam trafiły motyw, panel admina i „Moje obiekty”,
które wcześniej siedziały w hamburgerze. `/moje-gry` renderuje te same sekcje co
pulpit (Zaproszenia, Najbliższy mecz, Twoje najbliższe mecze, Obserwowane) zamiast
własnej kopii.
MECHANIKA: `lib/eventDraft.ts` (TTL `localStorage`), zmienna `--bottom-nav-h`
w `app/globals.css` sterowana atrybutem z `BottomNavGate.tsx`, `lib/adminLinks.ts`
i `lib/api.ts#hasManagedVenue` współdzielone przez `Header.tsx` i `app/profil/page.tsx`,
`components/home/dashboard/DashboardSections.tsx` reużyte w `app/moje-gry/page.tsx`.
