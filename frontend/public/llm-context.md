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
okolicy otwartą grę do dołączenia, nie tylko organizuje własną. Dziś, przy wciąż
niewielkiej liczbie użytkowników, publicznych gier na liście bywa mało — najpewniejszy
skład wciąż powstaje przez link wysłany do własnej ekipy, nie przez dołączanie obcych.

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

### 2026-08-27 — Lista obiektów na `/mapa` dobiera się sama, po współrzędnych

PROBLEM: Katalog boisk Bojo ma 38 314 obiektów, ale przy oddalonej mapie lista obok niej
była PUSTA z założenia — w trybie skupisk z bazy lecą same liczby w siatce, nie obiekty.
Zamiast czegokolwiek do przeczytania stał tam jeden przycisk „Przybliż tam, gdzie jest
ich najwięcej", czyli odpowiedź na pytanie, którego nikt nie zadaje. Próba naprawy przez
kafelki miast z liczbami rozbiła się o dane: kolumna `fields.city` jest wypełniona
w jakichś dwóch procentach (wszystkie największe miasta razem ~900 obiektów, w tym Poznań
54), więc kafelek kłamał liczbą I dowoził do garstki zamiast do wszystkiego, co w mieście
jest. Osobno: szukanie po tekście na mapie gubiło polskie ogonki („poznan" nie znajdowało
„Orlik Poznań"), a kółka skupisk sprzed szukania zostawały na wynikach i przy kliknięciu
oddalały mapę zamiast rozbić grupę pinezek.

ROZWIĄZANIE BOJO: Lista wypełnia się SAMA obiektami wokół punktu — okolicy gracza, gdy
zgoda na lokalizację jest już udzielona, a bez niej Poznania (miasto, w którym Bojo
startuje). Promień 15 km, sortowanie po odległości. O zgodę Bojo NIE pyta przy wejściu:
pytanie z zaskoczenia przy starcie strony ludzie odruchowo odrzucają, a odrzuconej zgody
nie da się cofnąć bez wchodzenia w ustawienia przeglądarki — pyta dopiero przycisk „Pokaż
boiska blisko mnie". Dobór idzie po `lat`/`lng`, które ma KAŻDY obiekt w katalogu, więc
nie zależy od backfillu lokalizacji. Wszystko oparte na `fields.city` (kafelki miast,
podpowiedzi miast w szukajce) zostało usunięte. Szukanie na mapie ignoruje ogonki, a kółka
skupisk znikają na czas szukania.

MECHANIKA: `lib/startowyPunkt.ts` (`POZNAN`, `PROMIEN_LISTY_KM`), `pozycjaBezPytania()`
w `lib/geo.ts` (czyta zgodę, nie wyprasza jej), `kadrWokol()` w `lib/api.ts`,
`components/map/VenueExplorer.tsx` (`pokazWokol()`, efekt dobierający start: najpierw
Poznań, potem podmiana na okolicę gracza), `components/map/PustaListaObiektow.tsx`.
Szukanie: `foldText()`/`foldedIncludes()` z `lib/searchText.ts` w filtrze lokalnym,
`WarstwaSkupisk` renderowana wyłącznie w trybie skupisk. Usunięte: `lib/miasta.ts`,
`policzBoiskaWMiastach()`, `getFieldsWMiescie()`. Strona serwera: migracja `126` dokłada
kolumnę generowaną `fields.szukaj_norm` (nazwa + adres, bez ogonków, indeks GIN po
trigramach), a `searchExplorerFields()` pyta po niej — z wyjściem awaryjnym na stare
`or(...)`, dopóki migracja nie zostanie puszczona ręcznie.

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
