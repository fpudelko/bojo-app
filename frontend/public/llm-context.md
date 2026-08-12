# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-12 · migracja `079` · 31 tabel · 420 testów

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

Przeglądanie mapy i stron boisk **nie wymaga konta**. Tworzenie meczu, dołączanie do
składu i zakładanie grup wymagają logowania.

**Pytania, na które odpowiada ta sekcja:** W jakich miastach działa Bojo? Czy Bojo jest
dostępne w moim mieście? Ile boisk ma Bojo? Jakie sporty obsługuje Bojo? Czy trzeba mieć
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

### 2026-08-11 — Organizator przesuwa graczy między składem a rezerwą

PROBLEM: kolejka rezerwowa w Bojo rozdaje zwolnione miejsca sama, ale tylko wtedy, gdy
miejsce faktycznie się zwolniło, i tylko pierwszej osobie w kolejce. Organizator nie miał
żadnego sposobu, żeby wziąć kogoś z rezerwy poza kolejnością — a powody bywają poza
zasięgiem bazy: ktoś przepuścił swoją kolej i wrócił, ktoś dogadał się poza aplikacją,
brakuje bramkarza, a w kolejce stoi jedyny chętny. Jedynym wyjściem było usunięcie wpisu
i dopisanie tej samej osoby od nowa, co gubi powiązanie z jej kontem, historię gier
i zadeklarowany sposób płatności. W drugą stronę było tak samo: żeby zwolnić miejsce
w składzie, trzeba było gracza usunąć z meczu.

ROZWIĄZANIE BOJO: przy każdej osobie na liście rezerwowej organizator ma przycisk
„Do składu", a przy graczu w składzie — „Na rezerwę". Awans poza kolejnością do roli,
w której nie ma już miejsca, prosi o potwierdzenie i pozwala świadomie przekroczyć limit
(licznik pokaże wtedy np. 15/14). Oba ruchy zachowują wpis gracza wraz z kontem,
historią i deklaracją płatności; po każdym kolejka rezerwowa przelicza się od razu.

MECHANIKA: `lib/events.ts` (`awansujZRezerwy()`, `cofnijNaRezerwe()` — obie czyszczą
`claim_offered_at` i `claim_passed`, po czym wołają `sync_reserve_claim`);
`EventDetailClient.tsx` (przyciski w liście rezerwowej i w sekcji „Zarządzanie
graczami"). Bez migracji — polityka „Organizer updates participants" z migracji `004`
dawała to uprawnienie od zawsze, brakowało wyłącznie wywołania.

### 2026-08-10 — Rezerwa mówi wprost, że jest rezerwą; role bramkarzy jako świadomy wybór

PROBLEM: gracz zapisujący się na mecz w Bojo z rozróżnieniem bramkarzy widział „zostały
2 wolne miejsca", wybierał zawodnika z pola, dostawał zielony komunikat „Dołączyłeś do
meczu!" — i był na liście rezerwowej, bo wolne były wyłącznie miejsca dla bramkarzy.
Dowiadywał się o tym dopiero po zjechaniu na dół strony. Rozróżnianie bramkarzy było
domyślnie WŁĄCZONE, więc organizator grający bez stałego bramkarza rozbijał pulę miejsc
na role, nie wiedząc o tym. Obserwujący („może") jest zapisywany z `is_reserve = true`,
żeby nie zajmować miejsca w składzie, i przez to trafiał do kolejki rezerwowej — kto
kliknął „Obserwuj", widział siebie jako rezerwowego. Płatny mecz pozwalał dołączyć bez
wskazania sposobu płatności. Organizator meczu wymagającego akceptacji wisiał we własnej
kolejce próśb.

ROZWIĄZANIE BOJO: licznik miejsc podaje rozbicie na role („8 w polu · 1 dla bramkarza"),
okno zapisu ostrzega przed kliknięciem, że w wybranej roli jest komplet i który będzie
to numer w kolejce, a komunikat po zapisie mówi „jesteś na liście rezerwowej" zamiast
„dołączyłeś do meczu". Rezerwa ma jeden kolor w całej aplikacji — szary; bursztyn został
przy obserwowaniu, niebieski przy oczekiwaniu na akceptację. Kreator nie zakłada
odpowiedzi na pytanie o bramkarzy: dla sportów, które mają bramkarza, wybór Tak/Nie jest
obowiązkowy i bez niego krok 2 nie przepuszcza dalej. Obserwujący nie pojawia się już na
liście rezerwowej. Płatny mecz z listą akceptowanych metod wymaga wskazania sposobu
płatności. Organizator dołącza do własnego meczu bez akceptacji.

MECHANIKA: `lib/events.ts` (`joinEvent`/`confirmFromMaybe` zwracają `WynikZapisu`
z `isReserve` i `pending`; `joinEvent` przyjmuje `jestemOrganizatorem`; nowa czysta
funkcja `wolneMiejscaWgRol()`); `lib/eventWizard.ts` (`validateGoalkeepers()` wpięte
w `validateStep(2, …)`); `EventCapacityFields.tsx` (Tak/Nie zamiast przełącznika,
dopóki wartość to `null`); `wydarzenia/nowe/page.tsx` (`goalkeepersEnabled` startuje
jako `null`); `lib/eventDraft.ts` (szkic potrafi zapamiętać brak decyzji);
`EventDetailClient.tsx` (filtr `rsvp !== 'maybe'` na liście rezerwowej, rozbicie
licznika, ostrzeżenie w oknie zapisu, wymuszony wybór płatności, szara kolorystyka).

### 2026-08-10 — Argument w zaproszeniu do przejęcia wpisu gościa, sprzątanie martwego kodu na stronie meczu

PROBLEM: przycisk „Zaproś do Bojo" przy wierszu gościa kopiował do schowka sam adres
linku, bez słowa wyjaśnienia, po co go kliknąć — ten sam błąd co przy głównym
udostępnianiu meczu, tu nienaprawiony. Przycisk działał też wyłącznie w edytowalnym
składzie przed startem meczu; po starcie meczu organizator przechodzi na uproszczony
widok listy i przycisk znikał całkowicie — dokładnie w momencie, gdy organizator
naturalnie wraca na stronę wpisać wynik i najłatwiej namówić kolegów bez konta do
założenia go. Na stronie meczu żył też w pełni zbudowany, ale nieosiągalny z UI modal
„Zgłoś uczestnika" — nic nigdy go nie otwierało.

ROZWIĄZANIE BOJO: „Zaproś do Bojo" otwiera teraz systemowy arkusz udostępniania (albo
kopiuje do schowka, gdy przeglądarka go nie ma) z gotowym tekstem tłumaczącym, po co
założyć konto — zobaczenie swojego udziału, statystyk i historii gier. Przycisk działa
też w widoku po starcie meczu. Nad składem pojawia się dla organizatora jedna linia —
„N gości bez konta w składzie" — gdy jest kogo zaprosić. Usunięto martwy modal zgłoszeń
uczestnika oraz nieużywany kod SMS-owy i plik obsługujący zaproszenia e-mailem, których
nic w aplikacji nie wołało.

MECHANIKA: `tekstZaproszeniaGoscia()` w `lib/guestClaim.ts` (wzorem `eventShareText`);
`kopiujLinkPrzejecia()` w `EventDetailClient.tsx` woła `navigator.share` z fallbackiem
do schowka; `ParticipantsList` (ten sam plik) dostał propsy
`isOrganizer`/`skopiowanyToken`/`onZaprosDoBojo`, żeby przycisk i licznik gości działały
też po starcie meczu; usunięte: `submitReport`/`getEventReports`
(`lib/eventFeatures.ts`), typy `ReportType`/`PlayerReport` (`types/index.ts`), plik
`lib/invites.ts`.

### 2026-08-10 — Powiadomienia gasną po załatwieniu sprawy, zapowiedź kolejnej stałej gierki, krok 2 kreatora na telefonie

PROBLEM: powiadomienie o prośbie o dołączenie zostawało w Bojo oznaczone jako wymagające
działania także po tym, jak organizator prośbę przyjął — dzwonek zna tylko fakt
przeczytania, a stan sprawy siedzi przy meczu. Kolejny termin stałej gierki powstaje sam
dopiero `notify_days_before` dni przed datą meczu i do tego momentu organizator nie
widział po nim żadnego śladu: nie dało się odróżnić „jeszcze za wcześnie" od „mechanizm
nie zadziałał". Krok 2 kreatora meczu na telefonie ściskał kafelek „Wydarzenie cykliczne"
do połowy szerokości ekranu (opis łamał się na pięć linijek), a teksty pomocnicze przy
liczbie miejsc i czasie na decyzję z rezerwy stały w wąskiej kolumnie obok kontrolek.

ROZWIĄZANIE BOJO: dzwonek sprawdza rzeczywisty stan sprawy — czy mecz ma jeszcze wpis
czekający na akceptację i czy oferta zwolnionego miejsca jest nadal aktywna. Załatwione
powiadomienie gaśnie jak każdy przeczytany wpis; nierozstrzygnięte zostaje czytelne ze
znacznikiem „Sprawdź". Gdy zapytanie o stan się nie powiedzie, wygląd zostaje bez zmian.
`/moje-gry` pokazuje sekcję „Kolejne stałe gierki": kreskowana karta z datą i godziną
terminu, który dopiero powstanie, oraz informacją, za ile dni to nastąpi. Karta jest
liczona z szablonu serii — żaden mecz nie powstaje w bazie wcześniej. Krok 2 kreatora
układa kafelek cykliczności w osobnym wierszu pod datą i godziną, a teksty pomocnicze
schodzą pod kontrolki poniżej progu `sm`.

MECHANIKA: `lib/notifications.ts` (`otwarteSprawy()` i `WYMAGA_AKCJI` przeniesione tu
z komponentu; dwa zapytania do `event_participants` — `pending_approval` oraz własne
`claim_offered_at`); `NotificationBell.tsx` (stan spraw dociągany przy każdym otwarciu
panelu); `lib/recurring.ts` (`nastepnyTermin()` powtarza regułę SQL z migracji `073`
łącznie z warunkiem „dziś, ale godzina minęła", plus `dniDo()`);
`DashboardSections.tsx` (`NastepneEdycjeSection`); `moje-gry/page.tsx` (dociąga szablony
serii i już utworzone terminy); `EventDateTimeField.tsx` (`extraSlot` na pełną
szerokość pod wierszami); `EventCapacityFields.tsx` (`flex-col` do `sm:`).

### 2026-08-10 — Prośby o dołączenie na /moje-gry, poprawna kolejność meczów, modale nad nawigacją

PROBLEM: organizator w Bojo nie miał gdzie zobaczyć, KTÓRY mecz czeka na jego decyzję —
prośby o dołączenie sygnalizowała tylko kropka przy „Moje" w dolnej nawigacji i wpis
w dzwonku, więc trzeba było otwierać mecze po kolei. Listy na `/moje-gry` szły od meczu
najdalszego w przyszłości: dane z bazy przychodzą malejąco, a `splitMyEvents()` tylko
filtrowało. Dolna nawigacja, podniesiona wcześniej nad karty mapy, zasłaniała okna
potwierdzeń (np. „Wypisać się z meczu?"). Kreator meczu pokazywał na kroku 3 pasek
„Mecz w grupie X" tuż nad pełnym wyborem grupy — ta sama informacja dwa razy. W liście
składu bramkarz miał plakietkę „🧤 BR", a zawodnik z pola nie miał nic, więc jego rola
czytała się jak brak danych. Filtr „ten tydzień" liczył tydzień względem prawdziwej
daty bieżącej zamiast względem daty podanej w argumencie.

ROZWIĄZANIE BOJO: `/moje-gry` w zakładce „Nadchodzące" ma nad sekcją „Brakuje graczy"
nową sekcję „Czekają na Twoją decyzję" — kafelek meczu z liczbą osób czekających na
akceptację, prowadzący na stronę meczu (bez przycisków akceptuj/odrzuć w kafelku).
Mecze nadchodzące sortują się od najbliższego, historia od ostatnio rozegranego.
Modale są nad dolną nawigacją; kolejność warstw opisuje jeden plik `lib/warstwy.ts`
zamiast liczb wpisywanych w kilkunastu komponentach. Pasek z grupą w kreatorze znika
na kroku 3. Zawodnik z pola ma plakietkę „⚽ POLE" symetryczną do „🧤 BR" — w składzie
i na liście rezerwowej, pokazywaną tylko w meczach rozróżniających bramkarzy.

MECHANIKA: `components/home/dashboard/DashboardSections.tsx` (`PendingRequestsSection`,
czyta `pendingApprovalCount` z `EventItem`); `lib/myEvents.ts` (sortowanie w
`splitMyEvents`, `nextMatch` to dziś pierwszy wiersz); nowy `lib/warstwy.ts`
(`WARSTWA.nakladkaMapy` < `nawigacjaDolna` < `modal` < `toast`) użyty w `BottomNav`,
`FilterSheet`, `toast.tsx`, `EventDetailClient` i czterech dialogach;
`EventDetailClient.tsx` (`RolaGracza`); `wydarzenia/nowe/page.tsx` (pasek grupy tylko
na krokach 1–2); `lib/eventFilters.ts` (`isSameWeek(dt, now, …)` zamiast
`isThisWeek(dt, …)` — poprzednia wersja ignorowała podane `now`).

### 2026-08-09 — Rezerwa widoczna w składzie, powiadomienia bez fałszywej fajki, poprawna odmiana liczebników

PROBLEM: strona meczu w Bojo pokazywała „Nikt jeszcze nie dołączył" nawet wtedy, gdy
ktoś stał w kolejce rezerwowej — lista rezerwowa mieszkała w osobnej karcie niżej,
widocznej tylko dla organizatora, więc przy pustym składzie ekran zaprzeczał sam sobie.
Przy zerowym składzie i niepustej rezerwie (np. mecz 1v1, na który organizator zapisał
się jako rezerwowy) rezerwowych nie było widać w ogóle. Panel powiadomień oznaczał
przeczytane wpisy zieloną fajką i wyszarzeniem, przez co nierozpatrzona prośba
o dołączenie wyglądała na załatwioną — a otwarcie dzwonka oznacza jako przeczytane
wszystko naraz. Liczebniki odmieniały się regułą `n < 5`, poprawną tylko dla 1–9:
stąd „0 gracze", „13 minuty temu", „22 minut temu".

ROZWIĄZANIE BOJO: kolejka rezerwowa jest częścią listy składu na stronie meczu —
z numerem pozycji w kolejce, znacznikiem „czeka na decyzję" / „przepuścił(a)"
i przyciskiem usunięcia. Osobna karta „Lista rezerwowa" zniknęła. Nagłówek listy podaje
liczbę graczy i liczbę osób na rezerwie; „Nikt jeszcze nie dołączył" pokazuje się
wyłącznie wtedy, gdy nie ma nikogo ani w składzie, ani w rezerwie. Powiadomienia nie
dostają już fajki po przeczytaniu; te wymagające działania (prośba o dołączenie,
zaproponowane zwolnione miejsce) nie blakną i mają znacznik „Sprawdź" — dzwonek nie
twierdzi, czy sprawa jest załatwiona, bo tego stanu nie zna. Liczebniki w całej
aplikacji odmieniają się według reguły polskiej (1 / 2–4 / 5+ z wyjątkiem 12–14).

MECHANIKA: `wydarzenia/[id]/EventDetailClient.tsx` (rezerwa w liście składu, usunięta
osobna karta, warunki pustych stanów uwzględniają `reserves`);
`components/layout/NotificationBell.tsx` (wspólny `TrescPowiadomienia`, brak ikony
`Check`, znacznik „Sprawdź" dla typów z `WYMAGA_AKCJI`); `lib/plural.ts` (`plural`,
`withCount`) użyte w 13 plikach zamiast ręcznego `n < 5` — m.in. `EventBrowseCard.tsx`,
`InviteFromGroupDialog.tsx`, `DashboardSections.tsx`, `GroupsClient.tsx`,
`gracz/[id]/page.tsx`, `lib/eventDraft.ts`.

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

MECHANIKA: migracja `075` (`sync_reserve_claim()` liczy i oferuje miejsca osobno
per rola); migracja `076` (daty/godziny w `powiadom_o_akceptacji` i
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
