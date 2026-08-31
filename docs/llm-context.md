# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-08-28 · migracja `126` · 53 tabele

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

**Misja.** Misja Bojo to łączenie ludzi przez najprostszy sposób organizowania
i dołączania do amatorskich gier sportowych — docelowo każdy chętny znajduje w
okolicy otwartą grę do dołączenia, a organizator znajduje brakujące osoby do składu.
Im więcej organizatorów i graczy korzysta z Bojo, tym łatwiej znaleźć zarówno otwarty
mecz, jak i brakujących do składu. Dziś, przy wciąż niewielkiej liczbie użytkowników,
publicznych gier na liście bywa mało — najpewniejszy skład wciąż powstaje przez link
wysłany do własnej ekipy, nie przez dołączanie obcych.

**Mechanika.** Next.js 14 (App Router) + TypeScript + Tailwind, hosting Vercel. Dane
i autoryzacja: Supabase (PostgreSQL, Google OAuth, Row Level Security). Mapa: Leaflet
z OpenStreetMap. Dane o boiskach zbierają skrypty Pythona (`scraper/`) uruchamiane
ręcznie z GitHub Actions.

**Pytania, na które odpowiada ta sekcja:** Czym jest Bojo? Co robi bojo.pl? Jak znaleźć
mecz w swojej okolicy? Jak zorganizować mecz i zebrać skład? Na czym Bojo jest zbudowane?
Jaka jest misja Bojo? Czy Bojo pomaga dołączyć do gry z obcymi ludźmi?

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

### 2026-08-31 — Powtórzona nazwa obiektu w adresie, stara plakietka miejsc na stronie obiektu

PROBLEM: (1) karta „Kiedy i gdzie" na stronie meczu (i tekst zaproszenia do udostępnienia)
pokazywały nazwę obiektu pogrubioną, a zaraz pod nią — szarym — pełny adres, który
Nominatim/OSM zaczyna od TEJ SAMEJ nazwy („Park Nad Wartą" pogrubione, niżej „Park Nad
Wartą, Rataje, Poznań…"). Ten sam fakt dwa razy, bez nowej informacji. Zgłoszone wprost.
(2) czas trwania meczu („· 90 min") na tej samej karcie łamał się w połowie słowa na dwa
wiersze, gdy linia nie mieściła się w jednym — brzydko. (3) plakietka „+N miejsc" przy
meczu w sekcji „Nadchodzące mecze" na stronie obiektu bywała nieaktualna: strona ma
`revalidate = 86400` (patrz `app/boisko/[id]/page.tsx`), więc liczba miejsc mogła być
do doby stara, a odwołany mecz i tak się tam pokazywał (zapytanie nie filtrowało
`status = 'cancelled'`).

ROZWIĄZANIE BOJO: (1) `eventLocation()` ucina z adresu dosłowny, powtórzony prefiks
nazwy obiektu — zostaje wyłącznie to, czego pogrubiona nazwa jeszcze nie powiedziała
(„Rataje, Poznań, województwo wielkopolskie, Polska"). Naprawia to zarówno kartę „Kiedy
i gdzie", jak i tekst zaproszenia (`lib/eventShare.ts`, ten sam fallback). (2) „· 90 min"
dostało `whitespace-nowrap` — cały fragment przenosi się na kolejny wiersz razem, zamiast
łamać się między liczbą a jednostką. (3) sekcja „Nadchodzące mecze" dociąga świeże dane
klient-side po zamontowaniu (ten sam kształt zapytania co server-side, plus filtr
`status != 'cancelled'`) — strona sama zostaje statyczna (SEO/koszt buildu bez zmian),
ożywa tylko ten jeden panel. „Brak nadchodzących meczy" → „meczów" (literówka przy okazji).

MECHANIKA: `lib/utils.ts` (`eventLocation()`), `app/wydarzenia/[id]/EventDetailClient.tsx`
(dwie gałęzie karty „Kiedy i gdzie" — organizator/widz), `app/boisko/[id]/page.tsx`
(`getUpcomingEvents()` — filtr `cancelled`), `app/boisko/[id]/VenueDetailClient.tsx`
(`liveUpcoming`, odświeżenie po mount). Bez migracji. Pilnuje tego
`src/__tests__/utils.test.ts` (`eventLocation`).

### 2026-08-31 — Audyt UX: wyjście z okna powitalnego, przedwczesne „nie znaleziono", powód wyszarzonego zapisu

PROBLEM: (1) Okno powitalne z pytaniem o rolę („Zanim zaczniesz — kim jesteś?") potrafiło
wypaść nad stroną meczu, do której ktoś właśnie szedł. Wyjście z niego BYŁO (X w rogu,
dotknięcie tła), ale Escape nie działał, a szary X nie czytał się jako oferta pominięcia —
audyt UX opisał to jako „uwięziony w onboardingu, którego nie rozumie". (2) W kreatorze
meczu, w polu szukania miejsca, komunikat „Nie znaleziono takiego miejsca" wyskakiwał już
po DRUGIM wciśniętym klawiszu, zanim ktokolwiek skończył wpisywać nazwę — czytało się to
jak werdykt o bazie („tego boiska tu nie ma"), a było stanem przejściowym. (3) W oknie
„Dołącz bez konta" przycisk „Zapisz się" był wyszarzony do czasu wypełnienia wszystkich
pól, bez słowa o tym, czego brakuje — wygląda jak zawieszona aplikacja. (4) Adres
`/rejestracja` zwracał 404: zakładanie konta mieszka pod `/logowanie?mode=rejestracja`,
ale to jest nazwa, którą człowiek wpisuje z głowy. (5) Literówka w pustym stanie historii
meczów.

ROZWIĄZANIE BOJO: (1) Escape zamyka okno powitalne, a pod ofertami ról stanął jawny
przycisk „Pomiń — zdecyduję później"; kto nic nie wybierze, zostaje tam, gdzie był.
(2) werdykt o braku wyników czeka, aż pisanie ustanie (nic w locie) i zapytanie ma co
najmniej 3 znaki — same wyniki pojawiają się jak dotąd od 2 znaków, bo to pomaga; milknie
wyłącznie komunikat o ICH BRAKU. (3) nad przyciskiem „Zapisz się" pojawia się zdanie
„Uzupełnij imię, e-mail i sposób płatności, żeby się zapisać" — wymienia dokładnie to,
czego brakuje, i znika, gdy wszystko jest wypełnione. (4) `/rejestracja` przekierowuje na
formularz zakładania konta zamiast na 404. (5) „Brak historii meczów".

MECHANIKA: `components/onboarding/PostSignupRoleModal.tsx` (obsługa `Escape`, przycisk
„Pomiń"), `components/map/UnifiedLocationPickerImpl.tsx` (`szukanieWToku`, `brakWynikow` —
bramka na komunikat, nie na samo szukanie), `app/wydarzenia/[id]/EventDetailClient.tsx`
(lista braków nad przyciskiem zapisu gościa), `next.config.mjs` (przekierowanie
`/rejestracja` → `/logowanie?mode=rejestracja`, `permanent: false`), `app/moje-gry/page.tsx`.
Bez migracji.

### 2026-08-31 — Zdublowany termin/miejsce na stronie meczu i martwy przycisk „Otwórz w Safari"

PROBLEM: (1) po dodaniu karty „Kiedy i gdzie" (partia z 2026-08-30) pasek nagłówka strony
meczu dalej pokazywał osobną linijkę z datą, czasem trwania i adresem — ten sam fakt
w dwóch miejscach jednego ekranu, czytany jak literówka, nie jak dwa źródła prawdy.
Zgłoszone wprost przez właściciela. (2) przycisk „Otwórz w Safari"/„Otwórz w Chrome" —
pokazywany, gdy logowanie Google jest zablokowane w przeglądarce wbudowanej w inną
aplikację — nic nie robił w przeglądarce Instagrama/Facebooka. Próbował wymusić skok
przez `window.location.href = 'x-safari-https://…'` (iOS) albo intent URI (Android), ale
te aplikacje celowo blokują nawigację do niestandardowych schematów URL z własnej
wbudowanej przeglądarki — nie ma niezawodnego sposobu w JS, żeby to obejść.

ROZWIĄZANIE BOJO: (1) zdublowana linijka zniknęła z nagłówka; termin i miejsce mieszkają
wyłącznie w karcie „Kiedy i gdzie". Edycja terminu przez organizatora (dawniej: dotknięcie
daty w nagłówku) przeniosła się razem z resztą — cała karta jest dziś przyciskiem dla
organizatora/delegata przed startem meczu. (2) przycisk obiecujący coś, czego nie da się
dotrzymać, zniknął. Zamiast niego — instrukcja wprost: dotknij „⋯" (więcej opcji) w danej
aplikacji i wybierz jej WŁASNĄ opcję „Otwórz w przeglądarce" (Instagram/Facebook/TikTok/
Twitter mają ją wbudowaną — to jedyna droga, która faktycznie działa), albo skopiuj link
i wklej go ręcznie. „Skopiuj link" zostaje jedynym przyciskiem w tej karcie — to jedyna
akcja, która realnie działa wszędzie.

MECHANIKA: `app/wydarzenia/[id]/EventDetailClient.tsx` (usunięty blok „KIEDY I GDZIE —
jedna linia" z nagłówka, `openEditWhen()` przeniesione na kartę „Kiedy i gdzie"),
`components/auth/AuthForm.tsx` (`GoogleBlockedSection` — usunięty `openInBrowser()`
i rozróżnianie iOS/Android po `Platform`, zostaje tylko wykrycie `isInAppBrowser()`
i `copyLink()`). Bez migracji.

### 2026-08-30 — Piąta partia z sesji QA: znikające pinezki przy dużym przybliżeniu, hierarchia strony meczu, podwójne powiadomienie przy gościu

PROBLEM: (1) Na mapie, przy przybliżeniu z16 i większym, pinezki potrafiły zniknąć
całkowicie mimo że obiekt był widoczny na satelitarnej podkładce w tym samym kadrze —
`fields.lat/lng` to środek obiektu z importu OSM, a ciasny kadr bywał węższy niż
realna niepewność jego położenia. (2) Strona meczu pokazywała MNIEJ informacji niż
karty na liście: bez odliczenia do startu, przycisk „Wypisz się" wyglądał jak
równorzędna akcja obok „Dołącz", a pasek zapełnienia i tekst „Zostało N miejsc" przy
komplecie świeciły bursztynem zamiast ustalonego niebieskiego. Lista obiektów obcinała
adres w połowie ulicy (`truncate` zamiast łamania do dwóch linii). (3) Dymki z opisem
w dolnej nawigacji, dla pozycji sąsiadujących ze środkowym przyciskiem (FAB), nachodziły
na niego. (4) Odwołany mecz na liście dalej pokazywał bursztynowe odliczenie do startu,
a plakietka „Anulowany" była szara — nie czytała się jak błąd/problem, czyli
niespójnie z resztą aplikacji. (5) Dwa przyciski logowania bez hasła nazywały się
identycznie („Zaloguj się linkiem"), więc drugi wyglądał jak duplikat pierwszego.
Nagłówek nad ekranem logowania zostawał w pełni klikalny mimo przyciemnienia tła —
dało się nim wyjść z pełnoekranowego formularza jednym dotknięciem w „Dołącz".
(6) Zakładki „Obserwuję" i „Historia" na `/moje-gry` pokazywały pusty stan gołym
zdaniem, bez wyjaśnienia. (7) Po dopisaniu gościa do składu wyskakiwały naraz toast
i modal zachęty do zaproszenia — ten sam komunikat dwa razy, jeden z nich (toast)
niosący jedyną informację o tym, że gość poszedł na rezerwę.

ROZWIĄZANIE BOJO: (1) zapytanie o obiekty na mapie pyta o kadr powiększony 1,6× wokół
środka widoku (`poszerzKadr()`) — markercluster i tak nie renderuje nic poza własnymi,
wyliczonymi granicami widoczności, więc szersze zapytanie tylko łapie więcej
kandydatów, nie wystawia pinezek poza ekran. (2) strona meczu dostała plakietkę
odliczenia przy dacie (ten sam `timeUntil()` co karty listy), „Wypisz się" zmieniło się
w zwykły tekstowy link zamiast przycisku z obwódką, pasek i tekst kompletu przeszły na
`PASEK_KOMPLET`/niebieski z `lib/komplet.ts`, adres na liście łamie się do dwóch linii
(`line-clamp-2`) zamiast urywać w połowie słowa. (3) wyrównanie dymka zależy dziś od
pozycji w grupie — skrajne pozycje trzymają się swojej krawędzi, tylko środkowe
zostają wyśrodkowane, więc żaden dymek nie nachodzi na FAB. (4) odliczenie i tekst
„wkrótce" znikają dla odwołanego meczu, a plakietka „Anulowany" jest dziś czerwona.
(5) drugi przycisk zmienił etykietę na „Wyślij link logowania — bez hasła" (ta sama
fraza, którą i tak pokazuje przycisk wysyłki po przełączeniu trybu). Nagłówek nad
ekranem logowania jest dziś w pełni bierny (`inert`) — ten sam wzorzec, którym
`LoginBackdrop.tsx` unieruchamia tło z listą meczów. (6) oba puste stany dostały
ikonę, tytuł i wyjaśniające zdanie zamiast gołego tekstu. (7) toast przy dodaniu
gościa pokazuje się TYLKO wtedy, gdy modal zachęty nie wyskakuje (już widziana dla
tego meczu) — modal przejął informację o rezerwie („Komplet — na rezerwę" pod
nagłówkiem) i dostał przycisk „Dodaj kolejnego" do szybkiego powrotu przy dopisywaniu
kilku osób pod rząd.

MECHANIKA: `lib/api.ts` (`poszerzKadr()`, obok istniejącego `kadrWokol()`), wołane
z `components/map/VenueExplorer.tsx`. `app/wydarzenia/[id]/EventDetailClient.tsx`
(odliczenie przy dacie, styl „Wypisz się", `PASEK_KOMPLET`, `handleAddGuest()` —
toast tylko w gałęzi bez modala), `components/EventBrowseCard.tsx` (`line-clamp-2`,
odliczenie i plakietka gated na `!cancelled`), `components/layout/BottomNav.tsx`
(`dymekAlign` per pozycja), `components/auth/AuthForm.tsx` (etykieta przycisku),
`app/logowanie/page.tsx` (`HeaderBierny`), `app/moje-gry/page.tsx` (puste stany),
`components/events/GuestInviteNudge.tsx` (`naRezerwie`, przycisk „Dodaj kolejnego").
Bez migracji. Pilnuje tego `src/__tests__/poszerzKadr.test.ts`.

### 2026-08-30 — Czwarta partia z sesji QA: pusty kadr mapy, podpisane liczniki, karta „Kiedy i gdzie"

PROBLEM: (1) Przy dużym przybliżeniu mapy (z≥17) Bojo milkło całkowicie — znikały
pinezki, znikał pasek z licznikiem i nie pojawiał się żaden komunikat, bo pusty kadr po
stronie serwera nie miał w kodzie ani jednej gałęzi (jedyny istniejący komunikat
dotyczył sytuacji „serwer coś dał, filtry to wycięły"). Biała mapa bez słowa wyjaśnienia
i bez wyjścia. (2) Na `/mapa` widać naraz trzy liczby boisk — nad listą, nad mapą
i na kółku skupiska — wszystkie poprawne, ale liczące co innego i podpisane tak samo,
więc czytało się je jak trzy sprzeczne liczniki. (3) Etykiety dat pokazywały „Niedz. 30
Sie" i „Niedziela, 30 Sierpnia": tailwindowe `capitalize` podnosi pierwszą literę
KAŻDEGO słowa, a polska data ma wielką tylko pierwszą. (4) Strona meczu nie miała karty
„Kiedy i gdzie": termin i miejsce mieściły się w linijce chipów, gdzie adres urywał się
w połowie ulicy, a linku do nawigacji nie było wcale dla meczu na boisku z katalogu.
(5) Plakietka nieprzeczytanych w dolnej nawigacji mówiła „9+", podczas gdy ekran
`/rozmowy` zaraz po jej dotknięciu pokazywał „32 nieprzeczytane wiadomości".

ROZWIĄZANIE BOJO: (1) pusty kadr mówi wprost, że jest pusty, i daje przycisk „Oddal
mapę" wracający do widoku, z którego zawsze coś widać; trzy powody pustki (filtry /
szukanie / kadr) to dziś trzy różne rady zamiast jednego milczenia. (2) licznik nad
listą dostał dopisek, na jakie pytanie odpowiada — „w tym kadrze mapy", „w Twojej
okolicy", „w promieniu N km od: <miejscowość>", „dla «fraza»"; same liczby bez zmian.
(3) wielka litera tylko pierwsza, w sześciu miejscach naraz. (4) nowa karta „Kiedy
i gdzie" na górze zakładki Skład: pełna data, godzina z czasem trwania, nazwa obiektu
i CAŁY adres bez ucinania, a pod tym „Nawiguj" (Mapy Google) i „O boisku".
(5) limit plakietki podniesiony z 9 do 99 — „32" zajmuje tyle samo pikseli co dawne
„9+", więc rozjazd znika bez kosztu w układzie; pasek przelicza się też po powrocie na
kartę, tak jak `/rozmowy`.

MECHANIKA: `components/map/VenueExplorer.tsx` (`powodPustki`, `ladujeKadr`,
`zakresListy`, `oddalDoSkupisk`), `lib/utils.ts` (`zWielkiejLitery()`, `linkDojazdu()`),
`app/wydarzenia/[id]/EventDetailClient.tsx` (karta „Kiedy i gdzie"),
`components/layout/BottomNav.tsx` (`LIMIT_LICZNIKA`, odświeżanie na `visibilitychange`),
plus pięć innych miejsc z etykietą daty. Czerwona plakietka dzwonka liczy CO INNEGO
(rzeczy wymagające działania, `WYMAGA_AKCJI` w `lib/notifications.ts`) i to zostaje bez
zmian — to nie jest ten sam licznik. Bez migracji. Pilnują tego
`e2e/mapa-pusty-kadr.klikalnosc.spec.ts` i `src/__tests__/etykietyDat.test.ts` —
sprawdzone, że bez poprawki testy padają.

### 2026-08-30 — Trzecia partia błędów z sesji QA: przybliżenie mapy, Enter w polu miejscowości, odmiana dni tygodnia

PROBLEM: kolejna partia usterek z tej samej manualnej sesji QA na produkcji, tym razem
skupiona na `/mapa`. (1) Na `/mapa` nie było ŻADNEGO sposobu przybliżenia poza kółkiem
myszy/gestem szczypania — kontrolka Leaflet była wyłączona (kolidowała z nakładką
szukania na mobile), a nic jej nie zastępowało. (2) Jeden ruch kółka/trackpada potrafił
przeskoczyć 3-4 poziomy przybliżenia naraz. (3) Enter w polu „miejscowość" filtra „ile km"
nic nie robił — trzeba było kliknąć podpowiedź myszą/palcem. (4) Nominatim potrafił zwrócić
tę samą miejscowość dwa razy, więc podpowiedzi pokazywały duplikaty. (5) Dzień tygodnia
w zapowiedziach terminu („w niedziela" zamiast „w niedzielę") i liczba graczy na karcie
rozegranego meczu („1 graczy" zamiast „1 gracz") łamały polską odmianę.

ROZWIĄZANIE BOJO: (1) własne przyciski +/- (`ZoomButtons.tsx`), tym samym wzorem co
istniejący `LocateMeButton` — stoją w rogu, którego nic innego nie zajmuje na stałe.
(2) `wheelPxPerZoomLevel={240}` zamiast domyślnych 60 — trzeba więcej przewinąć na jeden
poziom. (3) pole „miejscowość" wybiera dziś pierwszą podpowiedź na Enter, tak jak
wyszukiwarka zwykle wybiera pierwszy wynik. (4) serwerowe proxy `/api/geocode` odsiewa
podpowiedzi o tej samej nazwie i kontekście przed odesłaniem do przeglądarki. (5) trzy dni
tygodnia (niedziela/środa/sobota) mają dziś osobną formę biernika zamiast mianownika
z `format()`; liczba graczy idzie przez ten sam helper odmiany, którego reszta karty już
używała.

MECHANIKA: `components/map/ZoomButtons.tsx` (nowy plik, użyty w `VenueExplorer.tsx`
i `GamesMapCanvas.tsx`), `components/map/WyborMiejscowosci.tsx` (`onKeyDown`),
`lib/miejscowosci.ts` (`odsiejDuplikatyMiejscowosci()`, wołane z `app/api/geocode/route.ts`
— handler trasy Next.js nie może eksportować nic poza uznanymi nazwami HTTP, stąd funkcja
w osobnym module), `lib/eventDates.ts` (`dzienTygodniaWBierniku()`),
`components/groups/NajblizszyMeczGrupy.tsx`, `components/EventBrowseCard.tsx`
(`withCount()` zamiast literału „graczy"). Bez migracji. Pilnuje tego
`e2e/mapa-miejscowosc-enter.klikalnosc.spec.ts` — sprawdzone, że bez poprawki test pada.

### 2026-08-30 — Druga partia błędów z sesji QA: mecz płatny bez ceny, nazwa miejsca, dymek nawigacji, dostępność filtrów

PROBLEM: kolejna partia usterek z tej samej manualnej sesji QA na produkcji. (1) Włączenie
przełącznika „Mecz płatny" w kreatorze i zostawienie pustej ceny puszczało krok dalej bez
ostrzeżenia — mecz zapisywał się jako darmowy mimo zaznaczonego przełącznika. (2) Pinezka
wskazana ręcznie na mapie (poza katalogiem) potrafiła dostać nazwę miejsca w rodzaju
„GDZIE: 19C" — sam numer domu z adresu Nominatim. (3) Etykieta pola ceny różniła się między
kreatorem a stroną edycji tego samego meczu. (4) Dymek podpowiedzi „Przytrzymaj «Grupy»"
pod dolną nawigacją wyglądał, jakby wisiał na każdym ekranie. (5) Szukanie w pikerze
lokalizacji kreatora, które trafiło w zero wyników, czyściło z mapy WSZYSTKIE pinezki
z bieżącego kadru, nie tylko brak nowych. (6) Przycisk „Filtry" na `/mapa` miał 36×36 px
(poniżej progu dotykowego WCAG), a chipy filtrów nie niosły stanu dla czytników ekranu.
(7) Gołe `/boiska` (bez sportu) dawało 404.

ROZWIĄZANIE BOJO: (1) `validatePayments()` przyjmuje dziś flagę „mecz płatny" niezależną od
samej kwoty i blokuje krok, gdy przełącznik jest włączony, a cena pusta — komunikat wychodzi
też do nagłówka zwiniętej sekcji. (2) Nowa funkcja bierze pierwszy segment adresu, który nie
jest samym numerem domu. (3) Strona edycji przyjęła etykietę i podpowiedź „ile wychodzi za
cały obiekt" po kreatorze. (4) Dolna nawigacja chowa się dziś przez CSS zamiast się
odmontowywać, więc licznik pokazań dymka (limit 5 w życiu użytkownika) nie zeruje się przy
każdym wejściu na ekran, który ją chowa (kreator, zakładka Rozmowa). (5) Zero wyników
wraca do pinezek z kadru zamiast do pustej tablicy. (6) Przycisk urósł do 44×44 px, sześć
grup przełączalnych przycisków dostało `aria-pressed`. (7) `/boiska` to dziś redirect na
`/mapa?gry=0`, tym samym wzorcem co `/gracze` → `/wydarzenia`.

MECHANIKA: `lib/eventWizard.ts` (`validatePayments(..., platny)`), `lib/utils.ts`
(`nazwaZAdresu()`, reużywa `isBareNumber()` z `eventLocation()`), `app/wydarzenia/nowe/
page.tsx` i `app/wydarzenia/[id]/edytuj/page.tsx`, `components/layout/BottomNav.tsx` +
`BottomNavGate.tsx` (prop `hidden`, klasa CSS zamiast `return null`),
`components/map/UnifiedLocationPickerImpl.tsx`, `components/map/VenueExplorer.tsx`,
`app/boiska/page.tsx` (nowy plik). Bez migracji. Pilnują tego
`e2e/kreator-mecz-platny-bez-ceny.klikalnosc.spec.ts` i
`e2e/dolna-nawigacja-dymek-nie-wraca.klikalnosc.spec.ts` — sprawdzone w obie strony,
bez odpowiedniej poprawki oba testy padają.

### 2026-08-28 — Trzy błędy z sesji QA: licznik obiektów, pusta lista po filtrze miejscowości, wstecz z rozmowy

PROBLEM: Manualna sesja QA na produkcji (mobile 360px + desktop, jasny/ciemny) znalazła
trzy usterki po wcześniejszych zmianach mapy z 27 sierpnia. Wszystkie trzy dotyczyły
widoku „Lista" po `/mapa` → „Obiekty" → „Lista" — ścieżki, w której mapa Leaflet NIGDY
nie dostaje realnego rozmiaru (montuje się z `display:none`, bo widok startuje jako
„Lista" w domyślnym trybie Gry, a przełącznik „Obiekty" tego nie zmienia). Osobno:
systemowe „wstecz" z zakładki „Rozmowa" na stronie meczu wyrzucało z aplikacji zamiast
wracać do zakładki „Mecz".

ROZWIĄZANIE BOJO: (1) Licznik nad listą obiektów i podgląd „Pokaż N boisk" w arkuszu
filtrów liczą dziś z `fields.length` — z tego samego źródła, co karty listy pod spodem —
zamiast z sumy skupisk policzonej z kadru mapy, który przy nigdy niepokazanej mapie
zawsze wynosi zero. (2) Po wybraniu miejscowości w filtrze lista poprawnie dociąga dane
WŁASNYM zapytaniem (niezależnym od mapy), ale w trakcie tego zapytania renderował się
mylący pusty stan z przyciskami „Pokaż blisko mnie"/„Przybliż" — nie na temat tuż po
wybraniu konkretnego miejsca. Ten ułamek sekundy ma dziś własny stan „Szukam w okolicy:
«nazwa»…”. (3) Przełączanie zakładek na stronie meczu i ekipy zapisywało stan w adresie
przez `history.replaceState`, który NIGDY nie dokłada wpisu do historii przeglądarki —
pierwsze zejście z zakładki domyślnej dokłada dziś JEDEN wpis (`pushState`), więc
systemowe „wstecz" wraca do zakładki, z której użytkownik wyszedł, zamiast opuszczać
aplikację.

MECHANIKA: `components/map/VenueExplorer.tsx` (licznik z `fields.length`, stan
ładowania obok `PustaListaObiektow`), `components/map/KadrObserwator.tsx` (osłona na
kontener mniejszy niż 80×80, ten sam wzorzec co `GamesMarkersLayer.dopasujKadr` —
defensywna, nie naprawia punktu 2 wprost: zweryfikowane, że mapa ukryta nie zgłasza
kadru wcale), `app/wydarzenia/[id]/EventDetailClient.tsx` i `app/grupy/[id]/
GroupDetailClient.tsx` (`goToTab()` z jednorazowym `pushState` + słuchacz `popstate`).
Bez migracji.
### 2026-08-28 — Jeden pulpit zalogowanego, a w nim podział wg relacji do meczu

PROBLEM: Bojo miało DWA ekrany na to samo pytanie „co i kiedy gram". Strona główna po
zalogowaniu renderowała własny pulpit z sekcjami „Zaproszenia", „Najbliższy mecz"
i „Twoje mecze" — tymi samymi, które ma zakładka „Mecze" (`/moje-gry`). Pulpit na „/"
był przy tym POZA dolną nawigacją (pasek prowadzi na `/moje-gry`, `/mapa`, `/rozmowy`,
`/grupy` i do kreatora), więc wchodziło się na niego wyłącznie przez logo. Ponad połowę
jego długości zajmowały „Jak to działa", FAQ i stopka sprzedażowa — treść dla osoby BEZ
konta, pokazywana komuś, kto ma już mecze i ekipy. Sama zakładka „Mecze" miała z kolei
siedem sekcji, z czego trzy kroiły tę samą listę: mecz organizowany, bez kompletu
i z prośbą o dołączenie pokazywał się na jednym ekranie TRZY RAZY. Dokładała się do tego
zakładka „Brakuje graczy" filtrująca tę samą, i tak krótką, listę.

ROZWIĄZANIE BOJO: pulpit jest jeden i jest nim zakładka „Mecze" — ta z dolnej nawigacji.
Zalogowany, który wejdzie na „/", trafia na „Mecze"; landing na „/" nie zmienia się dla
wylogowanych ani dla wyszukiwarek (nie mają ciasteczka sesji). Treść marketingowa ma
własne strony: `/jak-dziala-bojo`, `/dlaczego-bojo`, `/faq`.

Sama zakładka dzieli mecze WG RELACJI, bez wyróżnionej karty „najbliższy mecz" — przy
takim podziale pierwszy element pierwszej sekcji i tak jest meczem najbliższym w czasie:

- „Grasz" — jestem w składzie (także wtedy, gdy sam ten mecz organizuję),
- „Organizujesz" — mój mecz, w którym sam nie gram,
- „Rezerwa i oczekujące" — rezerwa i czekanie na akceptację na cudzym meczu; pokazuje
  się tylko wtedy, gdy jest co pokazać,
- „Możesz dołączyć" — mecze mojej ekipy, w których jeszcze mnie nie ma.

Kubełki są rozłączne i razem pokrywają całość, więc żaden mecz nie wypada z listy przy
zmianie statusu. Mecz, w którym naprawdę gram, ma CAŁĄ KARTĘ zieloną — nie tylko
plakietkę w rogu. Filtrów nie ma żadnych (ani „Nieprzeczytane", ani „Brakuje graczy" —
przy niewielkiej liczbie meczów na tej zakładce filtr sam był problemem, którego
praktycznie nie ma, a plakietka „N wolnych miejsc" na karcie odpowiada na to samo
pytanie bez kontrolki do nauczenia). „Grasz" jest jedyną z trzech sekcji, która NIE
znika przy pustej liście — nagłówek zostaje na stałe, a zamiast kart pokazuje się pusty
stan z zachętą do stworzenia albo znalezienia meczu; to jedyne miejsce, gdzie gracz
w ogóle dowiaduje się, że nic nie ma zaplanowane.

MECHANIKA: `frontend/src/components/home/HomeSwitch.tsx` przekierowuje (`router.replace`,
klienckie — serwerowej sesji nie ma, Supabase trzyma ją w `localStorage`, a
ciasteczko-podpowiedź `lib/sessionHint.ts` służy tylko do wyboru kształtu pierwszej
odpowiedzi). Skasowane: `AppHome.tsx`, `lib/useDashboardData.ts`, `NextMatchCard.tsx`
(został z niego `PustyStanMeczow.tsx`), sekcje `OpenGamesSection`, `OnboardingSection`,
`MyGroupsSection`, `ObservingSection`, `NextGroupMatchTeaser`, `PendingRequestsSection`,
`NeedsPlayersSection` oraz `needsPlayers()`. Kubełki liczy `app/moje-gry/page.tsx`
z `playing` (czyli `upcoming` bez obserwowanych); zieleń karty i plakietkę „N próśb"
rysuje `EventBrowseCard`. Pusty stan „Grasz" idzie przez nowy prop `emptyState` na
`MyMatchesSection` (`components/home/dashboard/DashboardSections.tsx`) — gdy podany,
nagłówek renderuje się mimo pustej listy zamiast całej sekcji znikającej (`return null`).

### 2026-08-27 — Filtr „miejscowość + ile km" i koniec znikających pinezek

PROBLEM: Mapa Bojo gubiła pinezki. Lista startowa (okolica gracza, a bez zgody Poznania)
dobierana przy wejściu do katalogu wpisywała się w to samo pole stanu, z którego żyły
pinezki, więc mapa pokazywała Poznań niezależnie od tego, dokąd użytkownik przewinął —
nad Krakowem nie było widać nic. Osobno: zatwierdzenie filtrów w arkuszu kasowało
większość z nich, bo cztery kolejne zapisy do adresu czytały ten sam, nieodświeżony stan
i nadpisywały się nawzajem. Do tego nie było jak powiedzieć „szukam wokół Wrocławia":
promień dało się liczyć wyłącznie od własnej lokalizacji, a filtr po nazwie miasta
opierałby się na kolumnie `fields.city` wypełnionej w dwóch procentach.

ROZWIĄZANIE BOJO: Pinezki pokazują to, co leży w bieżącym kadrze mapy (albo wyniki
szukania po tekście); lista startowa jest odtąd podpowiedzią wyłącznie dla LISTY i tylko
przy oddalonej mapie. Filtry katalogu zapisują się do adresu jednym wywołaniem, więc
żaden nie ginie. Arkusz filtrów — w obu trybach, gier i katalogu — otwiera sekcja „Gdzie
szukam": wpisujesz nazwę miejscowości ALBO KOD POCZTOWY, wybierasz promień (5/10/25/50
km) i Bojo pokazuje to, co jest w okolicy tego punktu. W trybie meczów wybrana
miejscowość zastępuje położenie gracza — kto wpisał „Wrocław", pyta o Wrocław, choćby
stał w Poznaniu — i Bojo nie prosi wtedy o zgodę na lokalizację.

Filtr działa po ODLEGŁOŚCI od punktu, nie po nazwie miasta w bazie: miejscowość wyznacza
tylko współrzędne, a te ma każdy obiekt w katalogu i każdy mecz.

MECHANIKA: `frontend/src/lib/miejscowosci.ts` (`szukajMiejscowosci()`, `PROMIENIE_KM`,
rozpoznanie kodu pocztowego), `components/map/WyborMiejscowosci.tsx`, tryb `?miejscowosc=`
w `app/api/geocode/route.ts` (Nominatim, `featuretype=settlement`, pomijane dla kodu
pocztowego), stan w adresie `m`/`mlat`/`mlng`/`mopis`/`km`. W `VenueExplorer.tsx`:
rozdzielone `fieldsNaMapie` i `fields` przy wspólnym `zastosujFiltry()`, osobny stan
`listaStartowa`, zatwierdzenie arkusza jednym `updateParams`. Bez migracji.
