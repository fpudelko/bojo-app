# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk dziś najgęstszy w Poznaniu): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-05 · migracja `061` · 30 tabel · 121 testów

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
| **PRODUKCJA** — działa i jest widoczne | katalog boisk i mapa, mecze publiczne i prywatne, zapisy z listą rezerwową, „Obserwuję", drużyny, wyniki, obecność, rejestrowanie płatności, grupy, powiadomienia in-app, panel admina |
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

### 2026-08-06 — Mapa otwiera się na Polsce, nie na Poznaniu
PROBLEM: mapa Bojo brała już obiekty z całego kraju, ale startowała z widokiem
ustawionym na Poznań przy dużym przybliżeniu. Po imporcie 1638 boisk
z lubelskiego użytkownik widział ten sam pusty Poznań i miał prawo sądzić,
że import nic nie dodał. Osobno: boiska opisane w OpenStreetMap jako
wielofunkcyjne (`sport=multi`) nie były na liście dyscyplin, które mapa
przepuszcza — w samym lubelskiem odpadały tak 162 obiekty.
ROZWIĄZANIE BOJO: mapa otwiera się na całej Polsce. Kto chce swoją okolicę,
klika przycisk pinezki w prawym dolnym rogu mapy — Bojo pyta wtedy przeglądarkę
o lokalizację i przeskakuje na nią. Pytanie o zgodę pada dopiero po kliknięciu,
bo mapa kraju działa i bez niej. Boiska wielofunkcyjne są widoczne na mapie,
ale nie mają własnego filtra dyscypliny: tag `multi` z OpenStreetMap nie mówi,
w co konkretnie da się tam zagrać.
MECHANIKA: `POLSKA` / `POLSKA_ZOOM` w `components/map/mapIcons.ts`, przycisk
lokalizacji i `locateMe()` w `components/map/VenueExplorer.tsx`,
`wielofunkcyjne` dopisane do `EXPLORER_SPORTS` w `lib/api.ts` i do
`SPORT_CONFIG` w `lib/sports.ts`.

### 2026-08-05 — Mapa pokazuje boiska z całej Polski
PROBLEM: mapa Bojo miała zaszyty prostokąt wokół Poznania i pokazywała tylko to,
co się w nim mieściło. Obiekty zaimportowane z innych województw nie miały szans
się pojawić. Drugi filtr wymagał telefonu, strony albo opisu — świeży import
z OpenStreetMap nie ma żadnej z tych rzeczy, więc odsiewał je nawet w zasięgu.
ROZWIĄZANIE BOJO: mapa pokazuje obiekty z całego kraju. O tym, co jest widoczne,
decyduje wyłącznie `map_visibility = 'public'` — jedno kryterium zamiast dwóch
zachodzących na siebie. Import z OSM ustawia tę kolumnę świadomie, według bramki
jakości opartej na tagach, więc nie trzeba jej już podpierać filtrem zastępczym.
MECHANIKA: `getExplorerFields()` w `lib/api.ts` (usunięte `EXPLORER_BOUNDS`
i filtr „ma kontakt"), punkt zerowy przeplotu Mortona w
`components/map/VenueExplorer.tsx` przesunięty na 49° N / 14° E — przy starym
(52° N, 16,5° E) wszystko na południe od Poznania traciło porządek przestrzenny.

### 2026-08-05 — Domyślny skład zależny od sportu
PROBLEM: kreator meczu w Bojo proponował 12 miejsc niezależnie od dyscypliny.
Przy siatkówce plażowej, gdzie gra się 2 na 2, organizator musiał osiem razy
kliknąć minus. Na mapie karta obiektu chowała się pod dolną nawigacją, więc
adresu nie dało się doczytać.
ROZWIĄZANIE BOJO: liczba miejsc podpowiada się z dyscypliny — piłka nożna 14
(7v7), piłka ręczna 14, siatkówka 12 (6v6), futsal 10 (5v5), koszykówka 10
(5v5), siatkówka plażowa 4 (2v2). Podpowiedź ustępuje, gdy organizator sam
ruszy licznik. Karuzela obiektów na mapie ma dopełnienie na wysokość paska
nawigacji.
MECHANIKA: `SPORT_PLAYERS` w `app/wydarzenia/nowe/page.tsx`, dolne dopełnienie
karuzeli w `components/map/VenueExplorer.tsx`.

### 2026-08-05 — Uczestnik znów może zapraszać na mecz
PROBLEM: „Zaproś z ekipy" działało wyłącznie organizatorowi. Uczestnikowi Bojo
odpowiadało błędem o naruszeniu zabezpieczeń, mimo że sam zapis był dozwolony.
Do tego etykieta „już zaproszony" w oknie zapraszania kłamała uczestnikom, bo
nie widzieli cudzych zaproszeń — dało się wysłać drugie do tej samej osoby.
ROZWIĄZANIE BOJO: uczestnik meczu może zapraszać tak jak organizator, a lista
zaproszonych jest widoczna dla wszystkich, którzy na tym meczu grają.
MECHANIKA: migracja `061` rozszerza politykę SELECT na `event_player_invites`
o zapraszającego (`invited_by`) i uczestników meczu. Sedno: `invitePlayers()`
robi `INSERT … RETURNING id`, a Postgres stosuje do RETURNING politykę SELECT —
brak prawa odczytu przerywał całą operację błędem wyglądającym jak odrzucony
zapis. Sam warunek INSERT z migracji `060` był poprawny i został bez zmian.

### 2026-08-05 — Kreator meczu bez rozproszeń, zaproszenia w Moich grach
PROBLEM: kreator meczu rozpraszał organizatora — numerki kroków 1/2/3 nic nie robiły,
przycisk „Dalej" na pierwszym kroku był zasłonięty przez dolny panel nawigacji
(„Gry Mapa Nowy Moje Grupy"), a „Dalej"/„Wróć" zajmowały dwie osobne linie. Ten sam
panel zasłaniał przyciski „Dołącz"/„Obserwuj" na stronie meczu i modal wypisania się.
Zaproszenia na mecz żyły wyłącznie na stronie głównej — bez znaczka nigdzie indziej,
łatwo je przegapić.
ROZWIĄZANIE BOJO: numerki kroków są teraz klikalne i walidują tak samo jak „Dalej" —
skok na krok, którego wymagania nie są spełnione, zatrzymuje się na pierwszym
brakującym polu. „Wróć" i „Dalej" siedzą w jednym przyklejonym pasku, w jednej linii.
Dolny panel chowa się w kreatorze przez cały czas i na stronie meczu, dopóki
użytkownik nie ma potwierdzonego miejsca ani oczekującej prośby — wraca po dołączeniu.
Zdublowany przycisk „+" na `/wydarzenia` (chowany za panelem) usunięty. Modale nad
panelem zamiast pod nim. Zaproszenia dostały zakładkę „Zaproszenia" na `/moje-gry`
(`?tab=zaproszenia`, przeżywa odświeżenie) i plakietkę z licznikiem obok pola
wyszukiwania na `/wydarzenia` — widoczną tylko, gdy jest co najmniej jedno zaproszenie.
MECHANIKA: `lib/eventWizard.ts` (walidacja kroków, wydzielona pod testy),
`lib/bottomNavVisibility.tsx` (`HideBottomNav`, kontekst z licznikiem),
`app/wydarzenia/nowe/page.tsx`, `app/wydarzenia/[id]/EventDetailClient.tsx`
(`joinBarVisible`), `lib/useMyInvites.ts`, `components/events/InviteList.tsx`,
`app/moje-gry/page.tsx`, `app/wydarzenia/EventsListClient.tsx`,
`components/layout/BottomNav.tsx` („Gry" → „Znajdź grę").

### 2026-08-04 — Strona meczu: mniej ozdób, więcej odpowiedzi
PROBLEM: strona meczu w Bojo otwierała się zdjęciem satelitarnym na pół ekranu,
które nic nie mówiło. Nie było widać, czy się w tym meczu gra ani czy się je
organizuje — trzeba było rozwinąć skład. Kto kliknął „Obserwuj", tracił przycisk
„Dołącz". Boisko pojawiało się dwa razy, a jego nazwa (zwykle „Boisko — piłka
nożna") mówiła mniej niż adres. Powrót ze strony boiska wyrzucał na mapę zamiast
do meczu, a miejsce wpisane ręcznie w ogóle nie dawało się kliknąć.
ROZWIĄZANIE BOJO: zdjęcie usunięte, na górze pasek z opisanymi akcjami
„Udostępnij" i „Kopiuj". Wśród plakietek widać teraz „Organizujesz", „Grasz"
(z rolą bramkarza) albo „Rezerwa · N." z pozycją w kolejce i „Obserwujesz".
Organizator zmienia termin i widoczność klikając plakietkę; zmiana terminu przy
zapisanych graczach wymaga potwierdzenia. Plakietka boiska pokazuje adres i
prowadzi na stronę obiektu, skąd strzałka wraca do meczu; miejsce spoza katalogu
otwiera okno z adresem i nawigacją. Wypisanie się ma teraz drugą opcję —
„Wypisz mnie, ale obserwuj" — oraz krzyżyk do zamknięcia. Dopisując osobę bez
konta wybiera się rolę (zawodnik z pola albo bramkarz) zamiast samego pola
wyboru „dodaj jako bramkarza".
MECHANIKA: `app/wydarzenia/[id]/EventDetailClient.tsx`, `setEventWhen()`
w `lib/events.ts` (osobna funkcja, żeby nie nadpisywać reszty pola jak
`updateEvent`), parametr `?wroc=` na trasie `/boisko/[id]` (tylko ścieżki
względne).

### 2026-08-04 — Landing i dashboard: zwrot na organizatora, zasięg ogólnopolski
PROBLEM: Landing obiecywał „zbierz skład na mecz w dwie minuty" — nierealne dla
kilkunastoosobowej ekipy — i mówił wyłącznie o Poznaniu, mimo że tworzenie meczu
z pinezką na mapie działa już w całej Polsce. Górny pasek był zawsze biały i zjadał
pierwszy ekran telefonu, a „Zaloguj się" było dostępne wyłącznie w menu hamburgera
na mobile. Dashboard zalogowanego stawiał „Otwarte mecze" (dziś zwykle puste) nad
„Twoje grupy" (gdzie realnie dzieje się ruch) i nie miał sekcji „Jak to działa" ani FAQ.
ROZWIĄZANIE BOJO: H1 mówi o czynności, którą Bojo faktycznie dowozi w dwie minuty
(„Zorganizuj mecz"), a rotujący nagłówek nad H1 pokazuje trzy wartości organizatora
zamiast liczby boisk w jednym mieście. Górny pasek jest przezroczysty nad hero (z
widocznym od razu „Zaloguj się" na mobile) i staje się białym paskiem po zescrollowaniu
albo dla zalogowanych. Sticky CTA na mobile to teraz okrągły przycisk „+" zamiast paska
na całą szerokość. Pasek cookies pokazuje się dopiero po przewinięciu 300px albo po
6 sekundach, więc nie zjada pierwszego ekranu. Dolna nawigacja zalogowanego ma „Grupy"
zamiast „Profil" (profil jest już w menu hamburgera). Dashboard: „Twoje grupy" nad
„Otwarte mecze", a „Jak to działa" i FAQ pokazują się zawsze na dole, nie tylko przy
zerowej aktywności.
MECHANIKA: `components/home/landing/{content,LandingHero,LandingStats,LandingVenues,
StickyCta,RotatingBadge,PhoneMock}.tsx`, `components/layout/Header.tsx` (prop
`transparentOverHero`), `components/Logo.tsx` (wariant `onDark` dla `LogoPill`),
`lib/cookieConsent.ts` (hook `useCookieBannerVisible`, dzielony przez `CookieBanner.tsx`
i `StickyCta.tsx`), `components/layout/BottomNav.tsx`,
`components/home/{AppHome,dashboard/DashboardSections}.tsx`,
`components/layout/SiteFooter.tsx`.

### 2026-08-04 — Dashboard zalogowanego przebudowany + koniec mignięcia landingu
PROBLEM: strona główna zalogowanego wciąż otwierała się marketingowym hero
(„Znajdź mecz. Albo stwórz własny.") — copy sprzedające produkt komuś, kto już
go używa. Do tego serwer nie wiedział, kto jest zalogowany, więc zalogowany
widział na moment landing dla gości, zanim JavaScript zdążył odczytać sesję
z `localStorage`. Wreszcie: dashboard robił 7–8 zapytań do Supabase na każde
wejście, z czego trzy sekcje budowały własną, osobną kopię mapy uczestnictwa,
a mecz z imiennym zaproszeniem do grupy pokazywał się dwa razy (w „Zaproszenia"
i w „Mecze Twoich ekip").
ROZWIĄZANIE BOJO: dashboard zaczyna się kompaktowym powitaniem i kartą
najbliższego meczu (co i kiedy gram), nie hero. Serwer renderuje od razu
szkielet dashboardu dla zalogowanego dzięki ciasteczku-wskazówce (bez tokenu —
serwer wciąż nie ma prawdziwej sesji, tylko podpowiedź, którą skorupę
wyrenderować). Status uczestnictwa `invited` (zarezerwowany w kodzie, ale
wcześniej niczego nie produkujący) zaczął być realnie zwracany, co usunęło
duplikat zaproszenia. Na mobile aktywowana dolna nawigacja (wcześniej gotowa,
ale nieużywana) dla zalogowanych.
MECHANIKA: `lib/sessionHint.ts` (ciasteczko `bojo_sess`, bez tokenu),
synchronizacja w `lib/auth.tsx`, `AppHomeSkeleton.tsx`, `app/page.tsx` (odczyt
`cookies()`). `lib/useDashboardData.ts` — jedno wywołanie `Promise.allSettled`
zamiast pięciu niezależnych efektów. `lib/myEvents.ts` (`splitMyEvents`,
`nextMatch` — sortuje samodzielnie, bo `getMyParticipatedEvents()` zwraca dane
malejąco). `lib/eventDates.ts` (`matchWhenLabel` i przeniesione stąd
`isUpcoming`/`isEventJoinable`/`timeUntil`). `getMyParticipationMap()`
w `lib/events.ts` dociąga `event_player_invites` → status `invited`.
`components/home/dashboard/{GreetingBar,NextMatchCard,DashboardSections}.tsx`,
`components/layout/{BottomNav,BottomNavGate}.tsx`.

### 2026-08-04 — Krótszy kreator meczu
PROBLEM: kreator meczu w Bojo wymagał zbyt wielu decyzji: pusta data, ręczna godzina
zakończenia, sekcja „Ustawienia zaawansowane" z przełącznikami, których każdy i tak
chciał używać, a przycisk „Dalej" był poza pierwszym ekranem telefonu.
ROZWIĄZANIE BOJO: sport wybiera się z jednej przewijanej linii (plus mały dropdown),
data domyślnie jutro, zamiast godziny zakończenia jest „Czas gry" (domyślnie 90 min,
koniec liczy się sam), liczba miejsc domyślnie 12 dla piłki nożnej z informacją,
że kolejni trafią na rezerwę. Widoczność domyślnie publiczna. Sekcja zaawansowana
zniknęła: obecność jest zawsze włączona, a mecz z ustawioną kwotą sam włącza
śledzenie płatności i pokazuje graczom status wpłat. Organizator zapisujący się
na własny mecz wybiera przy tym rolę: bramkarz lub zawodnik z pola.
MECHANIKA: `app/wydarzenia/nowe/page.tsx`, parametr `organizerIsGoalkeeper`
w `createEvent()` (`lib/events.ts`); wiersz organizatora dostaje status
„potwierdzony" — zapis znaczy „będę", organizator oznacza potem nieobecnych.

