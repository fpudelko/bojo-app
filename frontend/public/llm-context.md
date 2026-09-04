# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.
>
> Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
> dokument dotyczy aplikacji bojo.pl.

**Stan na:** 2026-09-04 · migracja `134` · 56 tabel

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

### 2026-09-04 — Bojo wita nowego użytkownika i mówi mu, od czego zacząć

PROBLEM: Bojo nie odzywało się do nowego użytkownika ani razu. Przy rejestracji adresem
e-mail przychodziła wyłącznie prośba o potwierdzenie adresu, a przy rejestracji przez
Google — nic. Człowiek zakładał konto, widział pustą listę swoich meczów i nie miał skąd
wiedzieć, że najkrótsza droga do gry prowadzi przez stworzenie własnego meczu i wysłanie
jednego linku znajomym, a nie przez czekanie, aż ktoś w okolicy otworzy grę.

ROZWIĄZANIE BOJO: po założeniu konta przychodzi jedna wiadomość powitalna. Mówi, co Bojo
robi za organizatora (liczy skład, pilnuje limitu miejsc, prowadzi listę rezerwową, dzieli
koszt wynajmu, przypomina wszystkim dzień przed meczem) i prowadzi do trzech dróg
w kolejności od najpewniejszej: stwórz mecz, załóż grupę dla stałej ekipy, przejrzyj
otwarte gry. Trzecia droga jest przy tym uczciwie opisana jako ta, na której przy obecnej
liczbie otwartych meczów nie ma co polegać. Wiadomość wychodzi dopiero po POTWIERDZENIU
adresu, żeby nie przyszła równolegle z prośbą o potwierdzenie i żeby nie witać kogoś, kto
konta nigdy nie potwierdził; przy rejestracji przez Google adres jest potwierdzony od razu,
więc mail idzie natychmiast. Każde konto dostaje ją raz w życiu.

MECHANIKA: migracja `134` — wyzwalacz `powitaj_nowe_konto()` na `auth.users` (reaguje na
przejście `email_confirmed_at` z pustego na wypełnione), `wyslij_mail_powitalny()`,
uogólniony dziennik `maile_wyslane` (dwa możliwe klucze: wpis w składzie albo konto;
powitanie ma idempotencję bez daty, bo idzie raz na konto). Treść w funkcji brzegowej
`powiadom-goscia`, przypadek `powitanie`. Testy w `supabase/test/poczta-goscia.sql`.

### 2026-09-03 — Bojo odzywa się do graczy bez konta; widać, gdzie odpada organizator

PROBLEM: (1) Gracz zapisany bez konta — a to ćwierć wszystkich wpisów w składach — nie
dostawał od Bojo NICZEGO. Nie dostawał przypomnienia dzień przed meczem, nie dowiadywał się
o zmianie terminu i, co najgorsze, nie dowiadywał się o ODWOŁANIU meczu: przyjeżdżał na
puste boisko. Adres e-mail podawał przy zapisie i nie szło na niego ani jedno powiadomienie.
Jedynym śladem jego zapisu była pamięć jednej przeglądarki — wyczyszczona znaczyła wpis nie
do odzyskania. Konsekwencje ponosił organizator, bo skład kłamał dokładnie w tej części,
którą sam przyprowadził. (2) Gość dopisany ręcznie przez organizatora albo kolegę z drużyny
nie miał gdzie podać adresu, więc był odcięty nawet po zbudowaniu kanału. (3) Bojo nie
mierzyło niczego między „organizator wysłał link” a „ktoś dołączył” — nie
wiadomo było, na którym kroku kreatora ludzie odpadają, ilu otwiera wysłany link ani ilu
gości zamienia zapis na konto.

ROZWIĄZANIE BOJO: gracz zapisany bez konta dostaje dziś maile — potwierdzenie zapisu
z linkiem do własnego wpisu, przypomnienie dzień przed meczem, wiadomość o odwołaniu meczu
i o zmianie terminu, miejsca albo kosztu, a dzień po meczu zachętę do założenia konta,
jeśli nadal go nie ma. Zachęta jest CZWARTA w kolejności celowo: pierwsza wiadomość od
nieznanego nadawcy, która czegoś chce, czyta się jak spam. Dopisując gościa ręcznie, można
teraz podać jego adres — pole jest opcjonalne, a podpis mówi wprost, czego gość NIE dostanie,
jeśli zostanie puste. Okno odwołania meczu i baner nad składem mówią organizatorowi, kto
z jego składu dowie się o zmianie, a kogo musi powiadomić sam.

MECHANIKA: migracja `133` (`konfiguracja_poczty`, `maile_goscia` z idempotencją na
uczestnik+powód+dobę, `wyslij_mail_do_goscia()`, `wyslij_maile_do_gosci()`, wyzwalacze
`trg_powiadom_goscia_o_zapisie` i `trg_powiadom_gosci_o_zmianie_meczu`, zadanie
`bojo-maile-gosci`), funkcja brzegowa `supabase/functions/powiadom-goscia` → Resend,
`addGuest()` z opcjonalnym adresem w `lib/events.ts`, pole i podpis
w `app/wydarzenia/[id]/EventDetailClient.tsx`. Siedem nowych zdarzeń w `lib/analytics.ts`
(kroki kreatora, podsumowanie, wysłanie i otwarcie linku, zapis gościa, przejęcie wpisu,
wysłanie rozliczenia) — otwarcie linku liczy się także dla niezalogowanych. Testy:
`supabase/test/poczta-goscia.sql`. Kanał milczy do czasu weryfikacji domeny `bojo.pl`
w Resend.

### 2026-09-03 — Awaria sieci przestaje wyglądać jak nieistniejący mecz; komplet okien potwierdzeń

PROBLEM: (1) Strona meczu na każdy błąd — brak zasięgu, awarię serwera, odmowę reguł
dostępu — pokazywała „Nie znaleziono wydarzenia”. Strona meczu to jedyny adres,
który organizator rozsyła kilkunastu osobom, więc gracz z chwilowo słabym zasięgiem czytał
komunikat znaczący „dostałeś link do czegoś, czego nie ma” — i wypadało to na
organizatora, nie na Bojo. Do tego pierwszą czynnością przy wczytywaniu było porządkowanie
kolejki rezerwowej, czyli zadanie POMOCNICZE, którego awaria gasiła całą stronę. (2) Rozmyty
podgląd kreatora na ekranie zachęcającym do założenia konta pokazywał układ pól sprzed
przebudowy kroków — brama obiecywała inny formularz, niż organizator dostawał po
zalogowaniu. (3) Sześć decyzji organizatora nadal potwierdzało systemowe okno przeglądarki:
otwarcie meczu dla okolicy oraz pięć w ekranach ekip, w tym USUNIĘCIE EKIPY — rzecz
nieodwracalna, opisana jednym zdaniem w okienku, które na telefonie czyta się jak błąd strony.

ROZWIĄZANIE BOJO: (1) Bojo odróżnia dziś „takiego meczu nie ma” od „nie udało się
go wczytać”. Przy awarii pokazuje ekran z przyciskiem „Spróbuj ponownie” i zdaniem
„link jest w porządku”; porządkowanie kolejki rezerwowej i wynik meczu zeszły poza
ścieżkę krytyczną, więc ich awaria nie gasi już strony. (2) Podgląd na bramie pokazuje ten
sam krok pierwszy, który organizator zobaczy po zalogowaniu — sport, termin, liczbę miejsc
i listę rezerwową — a nazwy trzech kroków biorą się z tego samego miejsca w kodzie co
w kreatorze, więc nie mogą się rozjechać. (3) Wszystkie decyzje organizatora, także
w ekipach, potwierdza własne okno Bojo z listą konsekwencji. Usunięcie ekipy mówi teraz
osobno, co znika (rozmowa, tablica, skład, statystyki), co zostaje (mecze, tylko bez
przypisania do ekipy) i że cofnąć się nie da; otwarcie meczu dla okolicy mówi wprost, że
decyzja JEST odwracalna.

MECHANIKA: `lib/events.ts` (`BladWczytania` z kodem PostgREST-a, `toBrakWiersza()` dla
`PGRST116`), `app/wydarzenia/[id]/EventDetailClient.tsx` (stan `bladWczytania`, ekran
ponowienia, `handleOtworzDlaOkolicy`), `app/wydarzenia/nowe/page.tsx` (makieta bramy),
`components/events/CzyGramyPanel.tsx`, `app/grupy/[id]/GroupDetailClient.tsx`,
`app/grupy/[id]/edytuj/page.tsx` (wszystkie na `lib/usePotwierdzenie.tsx`). Bez migracji.
Testy: `e2e/mecz-blad-wczytania.klikalnosc.spec.ts` (sprawdzone, że bez poprawki pada),
`__tests__/bramaKreatora.test.ts`, `__tests__/oknaZamiastConfirm.test.ts`.

### 2026-09-03 — Skład meczu jest prawdą: koniec z samodzielnym awansem i naprawiony przełącznik gości

PROBLEM: Bojo nie ma własnego backendu — przeglądarka rozmawia z bazą bezpośrednio, więc
reguły dostępu w bazie są jedyną granicą. Reguła pozwalająca uczestnikowi zmieniać własny
wpis w składzie nie mówiła, KTÓRE pola wolno mu ruszyć, a baza danych nie umie zawęzić
takiej reguły do wybranych kolumn. W efekcie zapisany mógł jednym żądaniem wyjść
z poczekalni na meczu z akceptacją zapisów, awansować się z listy rezerwowej ponad limit
miejsc i oznaczyć własną wpłatę jako wniesioną — czyli obejść trzy rzeczy, na których
opiera się zaufanie organizatora do składu. Druga połowa tego samego problemu nie wymagała
niczyjej złej woli: przejście „Obserwuję” → „Gram” pytało bazę o wolne
miejsce i dopiero osobnym żądaniem zapisywało wynik, więc dwie osoby klikające w tej samej
sekundzie lądowały obie w składzie, ponad limit. Osobno: przełącznik
„Uczestnicy mogą dodawać gości” nie działał NIGDY — organizator go włączał,
aplikacja potwierdzała, że działa, a uczestnik po wpisaniu imienia znajomego dostawał
komunikat o braku uprawnień.

ROZWIĄZANIE BOJO: skład meczu zmienia dziś tylko ten, kto ma do tego prawo. Organizator,
delegat i administrator mają dokładnie te same możliwości co wcześniej. Uczestnik zmienia
wyłącznie własną deklarację — czy gra, na jakiej pozycji, jak zapłaci — oraz może przyjąć
ofertę zwolnionego miejsca, gdy taka do niego wyszła; miejsca w składzie sam sobie nie
przydzieli, z poczekalni się nie wypisze i wpłaty sobie nie odhaczy. Potwierdzenie udziału
przez osobę obserwującą mecz liczy się teraz w całości po stronie bazy, w jednej operacji,
więc dwa jednoczesne kliknięcia nie zmieszczą się już w jednym wolnym miejscu.
Przełącznik „Uczestnicy mogą dodawać gości” robi to, co obiecuje: gdy organizator
go włączy, osoba z listy składu dopisze znajomego bez konta — i tylko wtedy.

MECHANIKA: migracja `132` — wyzwalacz `pilnuj_wlasnego_wpisu()` na `event_participants`
(`BEFORE INSERT OR UPDATE`; spreparowany zapis jest normalizowany, nie odbijany, żeby nie
psuć „Obserwuję”), funkcje `czy_zarzadza_wpisem()`, `czy_moze_dopisac_goscia()`
i `potwierdz_udzial()` (lustro `dolacz_do_meczu()` dla ścieżki „Obserwuję” →
„Gram”), przebudowana polityka zapisu do składu. Po stronie aplikacji
`confirmFromMaybe()` w `lib/events.ts` woła dziś funkcję bazy zamiast liczyć pojemność
w przeglądarce. Asercje w `supabase/test/rls.sql`.

### 2026-09-02 — Przypomnienia o meczu: pierwsze powiadomienia w Bojo, które wychodzą same

PROBLEM: w całym Bojo nie było ani jednego powiadomienia opartego o czas — wszystkie były
reakcją na czyjeś kliknięcie. Nikt nie dostawał „jutro grasz o 20:00", organizator nie
dostawał „jutro mecz, brakuje 2 osób" (czyli tracił ostatni moment, w którym da się jeszcze
kogoś dociągnąć albo odwołać), a po meczu nic nie prosiło o wynik ani o rozliczenie: na 122
rozegrane mecze przypadało 6 zapisanych wyników i 45 nierozliczonych płatnych meczów. Bojo
umie jedno i drugie — tylko nic o to nie prosiło we właściwej chwili. Przypominanie to jest
ta czynność, którą organizator wykonuje ręcznie co tydzień na WhatsAppie, więc dopóki Bojo
tego nie robiło, grupa na WhatsAppie zostawała. Osobno: „Powtórz mecz" żyło tylko na stronie
meczu, więc cotygodniowy organizator miał do niego cztery kroki; a baza liczyła czas w UTC,
choć mecze są zapisane czasem lokalnym, przez co mecz o 20:00 uchodził za rozpoczęty
dopiero o 22:00.

ROZWIĄZANIE BOJO: dzień przed meczem każdy, kto ma miejsce w składzie, dostaje
przypomnienie z godziną i miejscem; organizator dostaje to samo plus liczbę brakujących
osób. Dzień po meczu organizator dostaje prośbę o domknięcie — ale WYŁĄCZNIE wtedy, gdy
faktycznie zostało coś do zrobienia (brak wyniku albo ktoś nie oddał pieniędzy).
Powiadomienia idą tym samym kanałem co wszystkie inne, więc jadą też na telefon, i da się
je wyłączyć osobno w ustawieniach. Do tego „Powtórz ten mecz" pojawia się wprost pod
rozegranym meczem na liście „Moje gry → Historia", z datą wypełnioną z góry na najbliższy
ten sam dzień tygodnia.

MECHANIKA: migracje `129` (`wyslij_przypomnienia()`, typy `przypomnienie_o_meczu`
i `po_meczu_do_domkniecia`, zadanie `pg_cron` `bojo-przypomnienia` o 16:00 UTC, idempotencja
przez `NOT EXISTS`) i `130` (`teraz_pl()`/`dzis_pl()`, poprawka `sync_reserve_claim`
i wyzwalaczy `079`/`097`); `lib/ustawieniaPowiadomien.ts`,
`components/events/PowtorzZHistorii.tsx`, `app/moje-gry/page.tsx`. Testy:
`supabase/test/przypomnienia.sql`.

### 2026-09-02 — Gość bez konta zarządza swoim zapisem; koniec z e-mailem gościa w publicznym API

PROBLEM: (1) Zapis „bez konta" (imię + e-mail, bez rejestracji) był JEDYNYM zapisem
w Bojo, którego zapisany nie mógł cofnąć — usunąć go mógł wyłącznie organizator. Gość nie
dostawał też żadnego powiadomienia: wyzwalacze odwołania meczu, zmiany warunków i usunięcia
meczu pomijają wiersze bez konta, więc o odwołanym meczu nie dowiadywał się w ogóle
i przyjeżdżał na boisko. Po zamknięciu okna „Utwórz profil" tracił link do swojego wpisu
bezpowrotnie. Skutki brał na siebie organizator: skład kłamał dokładnie w tej części,
którą sam przyprowadził. (2) Skład meczu czyta w Bojo każdy (polityka `USING (true)`),
a zapytanie o uczestników prosiło o wszystkie kolumny — więc adresy e-mail gości, telefony
i tokeny przejęcia wpisu wychodziły publicznym API dla dowolnego meczu, także prywatnego.
(3) Najcięższe decyzje organizatora (odwołanie meczu, usunięcie ze składu) potwierdzało
systemowe okno przeglądarki, które mieści jedno zdanie — nie mówiło ani kto dostanie
powiadomienie, ani że goście bez konta go nie dostaną, ani że odwołanie da się cofnąć.

ROZWIĄZANIE BOJO: (1) link, który gość dostaje przy zapisie, jest teraz linkiem do JEGO
zapisu: widzi stan meczu (z odwołaniem na samej górze), swoją pozycję w składzie, koszt
i ma przycisk „Nie mogę grać — wypisz mnie", który zwalnia miejsce i przekazuje je pierwszej
osobie z rezerwy. Link zostaje zapamiętany na urządzeniu, więc wracając na stronę meczu gość
widzi „jesteś zapisany(a)" zamiast zaproszenia do zapisania się drugi raz, i może go sobie
wysłać („Zapisz sobie link do swojego zapisu"). (2) publiczne API oddaje ze składu wyłącznie
to, co widać na ekranie — imię, rola, rezerwa, płatność; e-maile, telefony i tokeny wychodzą
z zasięgu ról API, a token przejęcia wpisu wydaje funkcja bazy wyłącznie organizatorowi
i osobie, która gościa dopisała. (3) potwierdzenia decyzji to okna aplikacji z listą
konsekwencji; przy odwołaniu meczu Bojo mówi wprost, ilu uczestników nie ma konta i nie
dostanie powiadomienia, i daje drugą drogę: „Odwołaj i wyślij wiadomość" z gotowym tekstem
na czat.

MECHANIKA: migracje `127` (uprawnienia kolumnowe na `event_participants`,
`token_wpisu_goscia()`) i `128` (`wypisz_wpis_goscia()`, rozszerzone
`podejrzyj_wpis_goscia()`); `lib/mojWpisGoscia.ts` (pamięć linku na urządzeniu),
`lib/guestClaim.ts`, `lib/eventShare.ts` (`tekstOdwolania()`),
`components/ui/OknoPotwierdzenia.tsx` + `lib/usePotwierdzenie.tsx`,
`app/gracz/przejmij/[token]/PrzejmijClient.tsx`, `app/wydarzenia/[id]/EventDetailClient.tsx`.
Granicy pilnują asercje w `supabase/test/rls.sql` (sekcje „Prywatne kolumny składu"
i „Gość zarządza swoim zapisem").

### 2026-09-01 — Strona boiska pokazuje inne boiska w okolicy

PROBLEM: Katalog Bojo ma ponad 30 000 obiektów, ale na obiekcie, na którym nikt jeszcze
nie zorganizował meczu — a to niemal cały katalog — strona nie mówiła nic, czego nie ma
w OpenStreetMap: nazwa, adres, sport, nawierzchnia. Jedyne zdanie własne Bojo („Szukasz
graczy? Stwórz otwarty mecz…") było identyczne na wszystkich stronach obiektów. Człowiek,
który trafił na boisko bez zaplanowanych meczów, nie dostawał żadnego następnego kroku
poza powrotem na mapę; ze strony obiektu wychodziły trzy linki i wszystkie prowadziły do
list zbiorczych, żaden do innego konkretnego boiska.

ROZWIĄZANIE BOJO: Strona boiska pokazuje teraz listę innych boisk tego samego sportu
w okolicy — do sześciu, najbliższe pierwsze, każde z odległością w linii prostej
(np. „440 m", „2,3 km"). Lista pojawia się niezależnie od tego, czy na obiekcie
kiedykolwiek rozegrano mecz, bo liczy się wyłącznie z położenia obiektów w katalogu.
Gdy w okolicy nie ma nic, sekcji nie ma wcale — Bojo nie pokazuje pustego nagłówka.
Nagłówek mówi „w okolicy", nie „w promieniu 8 km", bo dobór idzie po prostokątnym
wycinku mapy, a nie po okręgu.

MECHANIKA: `frontend/src/lib/pobliskieObiekty.ts` — `pobliskieObiekty()` pyta tabelę
`fields` o obiekty tego samego sportu w wycinku z `kadrWokol()` (`lib/api.ts`), z filtrem
`map_visibility='public'` i `seo_tier IN (1,2)`, po czym czysta funkcja
`wybierzPobliskie()` odrzuca obiekt bieżący, wiersze bez współrzędnych i te spoza
realnego promienia (rogi prostokąta), sortuje po `distanceKm()` z `lib/geo.ts` i przycina
do sześciu. Dane pobiera serwer w `app/boisko/[id]/page.tsx` i podaje propsem do
`VenueDetailClient.tsx`, gdzie renderuje je `OpisIPowiazane` — w obu gałęziach, także
tej bez JavaScriptu. Test: `src/__tests__/pobliskieObiekty.test.ts`. Bez migracji.

### 2026-09-01 — Tytuł i opis Bojo w wynikach wyszukiwania mówią, czym Bojo jest

PROBLEM: Pierwszy pomiar w Google Search Console (2026-08-29) pokazał, że przez trzy
miesiące Bojo miało 56 wyświetleń i ZERO kliknięć przy średniej pozycji 9,4, a wszystkie
zapytania były markowe: „co to bojo", „bojo", „bojo co to". Przyczyna: „bojo" to
w polszczyźnie potocznej słowo oznaczające boisko, więc wynik Bojo stoi w wyszukiwarce
obok definicji słownikowej — a jego tytuł („Bojo — zbierz ekipę, zagraj dziś | Boiska
i mecze w Polsce") nie zawierał ani jednego słowa, które by tę definicję podważało.
Słowa „boiska", „zagraj", „zbierz ekipę" wszystkie ją potwierdzały. Człowiek pytający
„co to jest bojo" nie dostawał odpowiedzi na swoje pytanie, więc nie miał po co kliknąć.

ROZWIĄZANIE BOJO: Tytuł strony głównej Bojo brzmi dziś „Bojo (bojo.pl) — aplikacja do
organizowania amatorskich meczów", a opis zaczyna się od zdania mówiącego wprost, czym
Bojo jest i co robi organizator. Rzeczownik kategorii („aplikacja") stoi tuż przy nazwie,
bo jest jedyną rzeczą odróżniającą Bojo jako produkt od słowa pospolitego. Ta sama zmiana
objęła stronę „Dlaczego Bojo" — drugą i jedyną poza stroną główną, którą Google miał
wtedy w indeksie. Podgląd linku w czacie i nazwa pod ikoną aplikacji na telefonie
ZOSTAŁY przy dotychczasowym haśle: tam odbiorca już wie, czym Bojo jest, bo dostał link
od organizatora albo sam zainstalował aplikację.

MECHANIKA: Ciągi wyniesione do `frontend/src/content/metaWyszukiwarki.ts`
(`TYTUL_DOMYSLNY`, `OPIS_DOMYSLNY`, `TYTUL_DLACZEGO`, `HASLO_PODGLADU`), używane przez
`app/layout.tsx` i `app/dlaczego-bojo/page.tsx`. Test `src/__tests__/tytulMarkowy.test.ts`
pilnuje rzeczownika kategorii, obecności domeny, długości mieszczącej się w wyniku
wyszukiwania, braku fraz zakazanych oraz tego, że hasło podglądu NIE zlewa się z tytułem.
Bez migracji. Pomiar źródłowy: `docs/seo-geo-strategia.md`, sekcja 7a.2.
