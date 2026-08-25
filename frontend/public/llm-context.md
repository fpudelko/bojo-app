# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-23 · migracja `125` · 45 tabel · 775 testów

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

### 2026-08-25 — Widget „najbliższe mecze" do osadzenia na stronie obiektu

PROBLEM: Bojo nie miało żadnego sposobu, żeby zarządca obiektu sportowego umieścił na
WŁASNEJ stronie coś więcej niż statyczny link do Bojo. Rozmowa z obiektem w
`/admin/outreach` kończyła się wyłącznie prośbą o wzmiankę — bez treści, która sama się
aktualizuje, trudno o coś do zaoferowania w zamian.

ROZWIĄZANIE BOJO: `/widget/boisko/[id]` — fragment strony do osadzenia w `<iframe>` na
stronie obiektu: nazwa, do pięciu najbliższych publicznych meczów (termin, sport, wolne
miejsca) i link powrotny do Bojo. Bez nawigacji, stopki ani żadnego globalnego elementu
interfejsu Bojo (baner cookies, zachęta do instalacji aplikacji, modal onboardingu) — to
nie jest ekran aplikacji, tylko fragment renderowany na cudzej witrynie. Kliknięcie meczu
albo linku „Bojo" otwiera pełną stronę w GŁÓWNYM oknie przeglądarki, nie w ramce. Kod do
wklejenia (`<iframe>`) kopiuje się jednym przyciskiem w `/admin/outreach`.

MECHANIKA: `app/widget/boisko/[id]/page.tsx` (`revalidate = 300`, `robots: {index:
false, follow: true}` — fragment ma nie trafiać do wyników wyszukiwania, ale link
wewnątrz ma dalej nieść sygnał). `lib/widget.ts#useJestWidget()` (sprawdzenie
`usePathname()`) wyłącza globalne komponenty z `app/layout.tsx` — `CookieBanner`,
`BottomNavGate`, `PostSignupRoleModal`, `RejestracjaSW` — na trasach `/widget/*`; Next.js
App Router nie pozwala żadnej trasie pominąć root layoutu inaczej. `kodOsadzeniaWidgetu()`
generuje gotowy `<iframe>` (stała wysokość 420px, przewijany w środku). Bez migracji.

### 2026-08-25 — Katalog boisk dostał warstwę miejską: `/boiska/[sport]/[miasto]`

PROBLEM: katalog Bojo miał wyłącznie hub krajowy per sport (`/boiska/pilka-nozna`) i hub
wojewódzki (`/boiska/woj/wielkopolskie`) — nic pomiędzy. Kto szukał boisk do konkretnego
sportu w konkretnym mieście, trafiał na listing całej Polski albo całego województwa,
bez punktu wejścia dopasowanego do pytania „gdzie zagrać w piłkę nożną w Radomiu".

ROZWIĄZANIE BOJO: nowa warstwa `/boiska/[sport]/[miasto]` dla miast z tabeli
`miasta_priorytetowe` (migracja 112, ~100 największych miast Polski), ale tylko tam,
gdzie warto — strona powstaje wyłącznie przy co najmniej trzech obiektach danego sportu
w danym mieście (próg ustalony przez właściciela 2026-08-25; celowo NIEZALEŻNY od
odrzuconej tego samego dnia propozycji zawężenia całego indeksu katalogu — to jest
osobna decyzja o tym, kiedy warto tworzyć nową stronę, nie o tym, co ma zniknąć
z istniejących). Poniżej progu i przy błędzie zapytania do bazy strona zwraca 404, nigdy
500. Linkuje w obie strony: hub sportu pokazuje miasta powyżej progu, nowa strona
linkuje z powrotem do huba sportu, huba województwa i — gdy oba istnieją dla tego miasta
— do `/[sport]/[miasto]` (lista otwartych meczów, inny cel niż katalog obiektów).

MECHANIKA: `app/boiska/[sport]/[miasto]/page.tsx` (`force-dynamic`, bez
`generateStaticParams`, jak siostrzane huby); `lib/hubMiasta.ts` — próg
(`PROG_OBIEKTOW_HUB_MIASTA = 3`), rozwiązanie miasta ze sluga, liczenie obiektów
(`seo_tier IN (1, 2)`, ta sama definicja co w `sitemap-boiska`), agregacja par
sport×miasto dla `sitemap.ts` (jedno zapytanie na sport, nie sto razy siedem). Sport →
wartość w bazie wydzielony do `lib/sports.ts#KATALOG_SPORT_MAP` — trzeci konsument tej
samej siódemki, wcześniej zaszytej lokalnie w `boiska/[sport]/page.tsx`. Bez migracji.

### 2026-08-25 — Rozegrany mecz znika z wyszukiwarki, ślad (z datą) zostaje na stronie obiektu

PROBLEM: strona minionego, publicznego meczu (termin, cena, liczba miejsc) zostawała
w indeksie wyszukiwarek bez końca, mimo że mecz już się odbył — pusta obietnica dla
kogoś, kto trafił na nią z wyszukiwarki, licząc, że da się dołączyć. Jednocześnie
strona obiektu, na którym mecze się odbywały, nie mówiła o tym ani słowa, choć to
jest dokładnie ten fakt, którego nie ma żaden katalog importujący dane wyłącznie
z OpenStreetMap. Sama liczba rozegranych meczów też nie wystarczała: obiekt z jednym
meczem sprzed roku wyglądał identycznie jak obiekt, na którym gra się co tydzień.

ROZWIĄZANIE BOJO: strona minionego meczu zostaje widoczna dla ludzi (podgląd linku,
treść, JSON-LD) i dalej otwiera się normalnie, ale wypada z indeksu wyszukiwarek.
Jej ślad przechodzi na stronę obiektu jako zdanie „Na tym obiekcie odbyło się już
N meczów zorganizowanych przez Bojo, ostatni [data]" — widoczne od pierwszego
rozegranego meczu, liczone wyłącznie z publicznych, nieodwołanych meczów, i wpięte
też w opis obiektu w danych strukturalnych, nie tylko w widoczną treść.

MECHANIKA: `app/wydarzenia/[id]/eventMeta.ts#metadataDlaMeczu()` — `robots: {index:
false, follow: true}` dla meczu, dla którego `isPast(data, godzina)` (`lib/eventWizard.ts`)
zwraca prawdę; próg jest ten sam, którym kreator meczu blokuje wpisanie terminu
w przeszłości. Licznik i data: `app/boisko/[id]/page.tsx#getOstatnieMecze()` — jedno
zapytanie (`count: 'exact'` liczy wszystkie pasujące wiersze niezależnie od `.limit(1)`,
który tnie tylko zwracane dane) daje naraz liczbę i najświeższy `event_date` (publiczne,
nieodwołane, wcześniejsze niż dziś). `content/opisObiektu.ts#zdanieORozegranychMeczach()`
(odmiana przez liczbę, `lib/plural.ts`; drugi argument z datą opcjonalny — bez daty
zdanie brzmi jak wcześniej) trafia zarówno do `VenueDetailClient.tsx` (renderowane
razem z resztą nagłówka obiektu, także w stanie ładowania, czyli w HTML, który dostaje
crawler), jak i do `description` w JSON-LD `SportsActivityLocation`. Bez migracji.

### 2026-08-23 — Rozmowa z listy rozmów zostaje rozmową, „wstecz" wraca tam, skąd przyszedłeś

PROBLEM: dotknięcie rozmowy ekipy na liście `/rozmowy` przenosiło na stronę ekipy
z paskiem zakładek, składem i zarządzaniem — z komunikatora wyrzucało na panel
administracyjny, a „wstecz" wracało stamtąd na listę ekip, nie do rozmów. Szerzej:
ekrany szczegółowe w Bojo miały „wstecz" zapisane na sztywno do jednego rodzica, mimo
że wchodzi się na nie z wielu miejsc (do strony ekipy prowadzi siedem dróg, do rozmowy
prywatnej także profil gracza), więc powrót lądował na ekranie, na którym człowiek nigdy
nie był. Profil gracza nie miał wyjścia w ogóle. Do tego wskaźnik nieprzeczytanych
wiadomości w dolnej nawigacji był chmurką bez liczby i nie liczył rozmów prywatnych.

ROZWIĄZANIE BOJO: rozmowa ekipy i rozmowa meczu mają własne pełnoekranowe trasy pod
`/rozmowy`, o układzie identycznym z rozmową prywatną; kontekst ekipy/meczu jest w nich
odnośnikiem w nagłówku („Otwórz ekipę", „Otwórz mecz · jutro · 18:00"), nie paskiem
zakładek. Rozmowy zostają dostępne także jako zakładka na stronie ekipy i meczu — kto
przyszedł zarządzać, ma je tam, gdzie były. „Wstecz" znaczy teraz wstecz: wraca do
poprzedniego ekranu, a sztywnego rodzica używa wyłącznie wtedy, gdy nie ma dokąd wracać
(wejście z powiadomienia push, z linku, z ikony aplikacji). Zakładka Rozmowy w dolnej
nawigacji pokazuje różową plakietkę z LICZBĄ nieprzeczytanych wiadomości ze wszystkich
trzech źródeł — meczów, ekip i rozmów prywatnych.

MECHANIKA: trasy `/rozmowy/grupa/[id]` i `/rozmowy/mecz/[id]` (`noindex`, treść przez
istniejące `RozmowaGrupy`/`RozmowaWydarzenia`), wspólny nagłówek
`components/rozmowy/NaglowekRozmowy.tsx`; `frontend/src/lib/historia.tsx`
(`SledzenieHistorii` w `app/layout.tsx`, hak `useWstecz(zapasowyCel)`);
`frontend/src/lib/rozmowy.ts` — jedno źródło listy rozmów i liczby nieprzeczytanych dla
ekranu `/rozmowy` i dla dolnej nawigacji. Bez migracji.

### 2026-08-23 — „Szukaj" otwiera listę otwartych meczów, nie mapę boisk

PROBLEM: zakładka „Szukaj" w dolnej nawigacji Bojo prowadziła na mapę KATALOGU BOISK.
Człowiek wchodzi tam z pytaniem „w co mogę dziś zagrać", a dostawał odpowiedź na inne —
„jakie są w okolicy boiska". Boisko bez meczu to informacja dopiero na drugim kroku,
a droga do meczów wiodła przez przełącznik, o którym trzeba było wiedzieć. Do tego mapa
przy oddaleniu pokazuje skupiska zamiast pojedynczych obiektów, więc pierwszy ekran
wymagał przybliżania, zanim cokolwiek powiedział.

ROZWIĄZANIE BOJO: „Szukaj" prowadzi na `/mapa?gry=1` — od razu na LISTĘ otwartych meczów,
z terminem i liczbą wolnych miejsc na każdej karcie. Domyślny widok idzie odtąd za
rodzajem danych: GRY otwierają się jako lista (mecz to przede wszystkim termin, a tego
pinezka nie mówi), OBIEKTY jako mapa (gdzie jest boisko to pytanie przestrzenne, a katalog
liczy dziesiątki tysięcy pozycji). Przełącznik Lista|Mapa działa jak dotąd w obie strony.
Pusta lista meczów nie jest ślepym końcem: rozróżnia „żaden mecz nie pasuje do filtrów"
od „nie ma teraz otwartych meczów" i w obu wypadkach proponuje zorganizowanie własnego
meczu albo przejście do boisk.

MECHANIKA: `LEFT_ITEMS` w `frontend/src/components/layout/BottomNav.tsx` (pole `hrefPelny`
niesie `?gry=1`, `href` zostaje czystą ścieżką, bo po nim idzie dopasowanie stanu
„wybrane", kropek i dymków); `widok` w `frontend/src/components/map/VenueExplorer.tsx`
startuje z `showGames ? 'lista' : 'mapa'`. Lista gier nie zależy od kadru mapy —
`getPublicEvents()` pobiera wszystkie otwarte mecze naraz, więc działa bez przybliżania
i bez zgody na lokalizację. Wejście na goły adres `/mapa` (powrót ze strony obiektu,
link `?boisko=`) zachowuje się bez zmian: obiekty na mapie.

### 2026-08-23 — Prywatny mecz przestaje zdradzać szczegóły w podglądzie linku

PROBLEM: strona prywatnego meczu podawała w metadanych nazwę meczu, sport, datę, godzinę
i nazwę obiektu, a pod adresem `/wydarzenia/<id>/opengraph-image` generowała publicznie
dostępną kartę z ceną i liczbą wolnych miejsc. Dane strukturalne (JSON-LD) były przed tym
chronione od początku, metadane nie — więc wystarczyło, żeby link do prywatnego meczu raz
trafił w publiczne miejsce, a jego szczegóły mogły wejść do wyszukiwarki. Kod dołączenia
jest jedyną kontrolą dostępu do prywatnego meczu i to właśnie on był obchodzony.

ROZWIĄZANIE BOJO: mecz niepubliczny zwraca w metadanych sam tytuł „Mecz" i `noindex`,
a jego obrazek podglądu to karta ogólna Bojo, bez żadnych danych meczu. Mecz, którego nie
ma, wygląda dokładnie tak samo — po metadanych nie da się odróżnić „nie ma takiego meczu"
od „jest, ale nie dla ciebie". Dla meczu publicznego nic się nie zmienia. Przy okazji
z tytułów zniknął podwojony sufiks „| Bojo", a opis stron obiektów przestał obiecywać
rezerwację terminu, której Bojo nie robi.

MECHANIKA: `metadataDlaMeczu()` w `app/wydarzenia/[id]/eventMeta.ts` — czysta funkcja
obok `getEventMeta()`, testowana bez bazy (`__tests__/eventMetadata.test.ts`), wzorem
`eventJsonLd()` w `lib/structuredData.ts`. Ten sam próg widoczności powtórzony
w `opengraph-image.tsx`. Trasy techniczne, kreatory i funkcje za wyłączonymi flagami
(`/auth/`, `/turniej`, `/cykliczne`, `/obiekt`, `/rezerwacje`, `/gracz/`) wypadły ze
skanowania w `app/robots.ts` — są komponentami klienckimi, więc nie mogą wyeksportować
`metadata`, i robots.txt jest tam jedyną dźwignią (`__tests__/robots.test.ts`).

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
