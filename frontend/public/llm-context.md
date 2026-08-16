# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-16 · migracja `097` · 34 tabele · 543 testy

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

**„Czy gramy?"** Organizator może ustawić `min_players` — ile osób musi być w składzie,
żeby mecz się odbył. Strona meczu pokazuje wprost werdykt („Gramy ✓" albo „Brakuje 2 do
minimum"), zamiast zostawiać to liczeniu w głowie. Członek ekipy, który jeszcze nie
dołączył do meczu przypiętego do jego grupy, może kliknąć **„Nie gram"** — jawna odmowa,
osobna od zgłoszenia nieobecności po meczu i osobna od statystyki „Niezawodność".

**„Otwórz dla okolicy".** Gdy prywatnemu meczowi brakuje ludzi, organizator jednym
kliknięciem zamienia go w publiczny, żeby dołączyli ludzie z sąsiedztwa — to jedyna
rzecz z tego zestawu, której żaden komunikator nie potrafi.

**Pytania, na które odpowiada ta sekcja:** Co się dzieje, gdy mecz w Bojo jest pełny?
Czy rezerwowy wskakuje automatycznie, gdy ktoś zrezygnuje? Czy „Obserwuję" zajmuje
miejsce w składzie? Jak działa akceptacja zapisów przez organizatora? Ilu bramkarzy
mieści się na mecz? Czy Bojo pilnuje minimalnej liczby graczy? Co się dzieje, gdy ekipie
brakuje ludzi do kompletu? Czy da się jawnie odmówić udziału w meczu, zamiast milczeć?

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

### 2026-08-16 — Zachęta do dodania Bojo na ekran główny

PROBLEM: Bojo dawało się zainstalować (manifest, ikony, service worker — wpis wyżej),
ale nic o tym nie mówiło. Czekało, aż użytkownik sam wpadnie na pomysł — prawie nikt
nie wpada. Na iPhonie to blokuje cały przyszły kanał powiadomień, bo Safari wysyła
push WYŁĄCZNIE do aplikacji dodanej do ekranu głównego.

ROZWIĄZANIE BOJO: po zapisaniu się na mecz na dole ekranu pojawia się pasek „Miej Bojo
pod ręką". Nie na wejściu na stronę — dopiero po tym, jak coś się udało, żeby obietnica
„przypomnimy Ci o meczu" znaczyła coś konkretnego. Na Androidzie pasek ma przycisk
„Dodaj do ekranu", który otwiera systemowe okno instalacji. Na iPhonie przycisku nie ma
i być nie może (Safari nie udostępnia takiego zdarzenia) — jest instrukcja z ikonami
„Udostępnij → Do ekranu początkowego" oraz zdanie mówiące wprost, że bez tego
powiadomienia na iPhonie nie zadziałają. Pasek pokazuje się RAZ: kto go zamknie, ma
spokój. Nie pojawia się osobom, które już zainstalowały, na komputerze ani
w przeglądarce wbudowanej w Facebooka czy Instagrama, gdzie instalacja i tak nie działa.

MECHANIKA: `lib/instalacja.ts` (cała decyzja, kogo i kiedy pytać — osobno od widoku,
więc sprawdzalna testem), `components/ZachetaInstalacji.tsx` (pasek; przechwytuje
`beforeinstallprompt`, żeby pokazać własny przycisk w wybranym momencie zamiast
systemowego paska Chrome). Wywołanie z `EventDetailClient.tsx` po udanym zapisie przez
`zaproponujInstalacje()`. Nowa warstwa `zachetaInstalacji` w `lib/warstwy.ts` —
nad dolną nawigacją, pod modalem. Znacznik odrzucenia: `bojo:instalacja-odrzucona`.

### 2026-08-16 — Zakładka Ustawienia meczu bez martwego przycisku; kropki "Grupy" przełożone; filtr nieprzeczytanych na wysokości "Brakuje graczy"; zaktualizowany zrzut kreatora

PROBLEM: zakładka „Ustawienia" na stronie meczu (`/wydarzenia/[id]`) była widoczna
w pasku dla KAŻDEGO, nie tylko dla organizatora/delegata — gated była wyłącznie treść
panelu (`tab === 'ustawienia' && canManageEvent`), sam przycisk renderował się zawsze
(`EVENT_TAB_LABELS.map(...)` bez filtra). Ktoś bez żadnej roli w meczu, nawet
niezalogowany na to wydarzenie, widział klikalną zakładkę, która po otwarciu okazywała
się pusta — zgłoszone ze zrzutem ekranu. Pomarańczowa kropka „nowy mecz w ekipie"
i różowa „nieprzeczytana wiadomość" wylądowały w poprzednim wdrożeniu na kartach ekip
na `/grupy`, ale nie na samej ikonie „Grupy" na dolnej nawigacji — tam wciąż była tylko
jedna, różowa kropka po prawej. Filtr „tylko z nieprzeczytanymi" na `/moje-gry` stanął
w pasku zakładek zamiast niżej, na wysokości „Brakuje graczy", jak zgłoszono. Zrzut
kreatora meczu w karuzeli na landingu wciąż pokazywał usunięty już toggle „Wydarzenie
cykliczne" — nieaktualny od poprzedniej zmiany, która ukryła tę opcję w prawdziwym
kreatorze.

ROZWIĄZANIE BOJO: przycisk zakładki „Ustawienia" na stronie meczu znika teraz razem
z treścią — ten sam warunek (`canManageEvent`) filtruje etykiety PRZED renderowaniem,
nie tylko treść pod spodem. Ikona „Grupy" na dolnej nawigacji nosi dziś dwie kropki:
różową (nieprzeczytana wiadomość w którejkolwiek ekipie) po LEWEJ, pomarańczową (nowy
mecz w którejkolwiek ekipie od ostatniej wizyty na jej stronie) po PRAWEJ — osobna,
zbiorcza kontrola obok tej już istniejącej na kartach `/grupy`. Filtr nieprzeczytanych
na `/moje-gry` przeniósł się do nagłówka „Brakuje graczy" (ta sama kontrolka, którą
kiedyś dostawał link „Wszystkie") — gdy akurat nie ma czego tam pokazać, sekcja
i tak renderuje samą kropkę filtra zamiast znikać całkowicie, żeby dało się wyłączyć
filtr z powrotem. Zrzut kreatora w karuzeli landingu podmieniony na aktualny stan UI.

MECHANIKA: `EventDetailClient.tsx` — `EVENT_TAB_LABELS.filter(([t]) => t !== 'ustawienia'
|| canManageEvent)` przed `.map()`. `lib/groups.ts` — nowa `hasNewGroupEvents(groupIds)`,
ten sam wzorzec co `hasUnreadGroupMessages()`. `BottomNav.tsx` — `unreadGroups` i
`newGroupEvents` liczone jednym efektem (wspólne `getMyGroupIds()`), dot na „Grupy"
`top-left`/`top-right`. `components/home/dashboard/DashboardSections.tsx` —
`SectionHeader` dostał `extra?: React.ReactNode` (kontrolka obok linku „Wszystkie");
`NeedsPlayersSection` dostał `extra` i `pokazPustyNaglowek` (gdy `true` i sekcja byłaby
pusta, renderuje samą `extra` zamiast `null` — domyślnie `false`, pulpit `AppHome` nie
przekazuje żadnego z nich, więc zachowuje się jak dawniej). `app/moje-gry/page.tsx` —
przycisk filtra wyjęty z paska zakładek, przekazywany jako `extra` do
`NeedsPlayersSection`. `frontend/public/landing/kreator.jpg` — podmieniony zrzut.

### 2026-08-16 — Bojo jako apka na ekranie głównym (PWA, etap 1)

PROBLEM: Bojo dawało się „dodać do ekranu głównego", ale bez manifestu telefon robił
z tego zwykły skrót w przeglądarce — zostawał pasek adresu, nie było własnej ikony ani
ekranu startowego. Osobno: web-push na iOS działa WYŁĄCZNIE dla aplikacji dodanej do
ekranu głównego, więc brak instalowalności blokował też przyszły kanał powiadomień.

ROZWIĄZANIE BOJO: Bojo jest teraz instalowalną aplikacją. Po dodaniu do ekranu głównego
otwiera się bez paska adresu, z własną ikoną i zieloną (#15663E) barwą paska stanu.
Powiadomień push jeszcze NIE wysyła — to osobny, kolejny etap; ten krok przygotowuje
warunek, bez którego push na iPhonie nie zadziała.

MECHANIKA: `app/manifest.ts` (Next generuje `/manifest.webmanifest`, `display:
standalone`), ikony w `public/ikony/` generowane z logo skryptem
`scripts/generuj-ikony.mjs` — w wariancie zwykłym oraz `maskable` dla Androida, który
przycina ikonę do kształtu producenta. `apple-touch-icon` i `appleWebApp` w metadanych
`layout.tsx`, bo iOS ignoruje ikony z manifestu. Service worker `public/sw.js` celowo
minimalny: obsługuje `push` i `notificationclick`, NIE cache'uje niczego — worker
cache'ujący HTML serwowałby stary build po deployu, a aplikacja żyjąca z bazy
pokazywałaby nieaktualne składy. Rejestracja przez `components/RejestracjaSW.tsx`.

### 2026-08-16 — Pomarańczowa kropka "nowość"; kropki na kartach ekip; filtr nieprzeczytanych na /moje-gry; zakładka Ustawienia bez wycieku uprawnień; usunięty próg minimum z kreatora

PROBLEM: zakładka „Ustawienia" ekipy migała (czasem zostawała) widoczna osobie bez
żadnych uprawnień — `/grupy/[id]` jest trasą dynamiczną, więc przejście z ekipy, gdzie
ktoś jest założycielem, do ekipy, gdzie nie ma żadnej roli, nie odmontowywało
komponentu; stan uprawnień z poprzedniej ekipy zostawał, dopóki nowe zapytanie nie
wróciło. Karty ekip na `/grupy` i dolna nawigacja nie miały żadnego sygnału „pojawiło
się coś nowego" — tylko „masz nieprzeczytaną wiadomość". Różowa kropka „nowe
wiadomości" na „Moje" potrafiła się świecić bez żadnego widocznego śladu: liczy się też
z meczów w Historii, a `/moje-gry` (zakładka Historia) i mecze ekipy w Historii nie
przekazywały licznika nieprzeczytanych do karty meczu, więc nie było gdzie tej
wiadomości znaleźć. Na `/moje-gry` nie dało się przefiltrować listy do samych meczów
z nieprzeczytaną wiadomością. Kreator meczu miał krok z toggle'em „Ustaw minimum, żeby
gra się odbyła" — zbędny przy zakładaniu nowego meczu, skoro organizator jeszcze nie
zna faktycznej frekwencji.

ROZWIĄZANIE BOJO: `/grupy/[id]` zeruje stan uprawnień na START każdego przeładowania
(nie tylko po odpowiedzi z bazy), więc zakładka Ustawienia nigdy nie pokazuje
uprawnień z poprzednio oglądanej ekipy. Trzeci, zarezerwowany kolor w apce —
pomarańczowy — „nowość, o której jeszcze nie wiesz": kropka na ikonie ekipy (obok
istniejącej różowej za wiadomości) gdy pojawił się nowy mecz od ostatniej wizyty na
stronie ekipy, i kropka przy „Znajdź grę" na dolnej nawigacji, gdy w promieniu 5 km od
użytkownika pojawiło się nowe wydarzenie — wyłącznie gdy zgoda na lokalizację jest już
udzielona, sprawdzana po cichu, bez pytania o nią. Historia meczów (na `/moje-gry`
i na stronie ekipy) pokazuje teraz plakietkę nieprzeczytanych tak samo jak Nadchodzące.
Nowy przycisk-filtr w pasku zakładek `/moje-gry` (poza przewijanym paskiem tabów, więc
nie dokłada wysokości i jest zawsze widoczny) zawęża widok do meczów z nieprzeczytaną
wiadomością. Toggle progu minimum zniknął z kreatora meczu — zostaje w edycji istniejącego
wydarzenia, gdzie organizator już zna realną frekwencję.

MECHANIKA: `GroupDetailClient.tsx` — `load()` woła `setMember(false)`/`setPermissions(null)`
przed pobraniem danych nowej ekipy. `lib/groups.ts` — `kluczGrupyWidziano()`,
`getGroupEventsForNew()`, `maNoweMecze()`, `policzNoweMeczePerGrupa()`; ustawiane przy
KAŻDYM wejściu na stronę ekipy (nie tylko na Tablicę). `lib/events.ts` —
`KLUCZ_WYDARZENIA_WIDZIANO`, `maNoweWydarzeniaWPobolizu()`; znacznik ustawia
`EventsListClient.tsx` (nie `EventsListView.tsx` — ten renderuje się też jako tło
ekranu logowania). `lib/geo.ts` — `hasGeolocationPermission()` (Permissions API, cichy
odczyt bez okna systemowego). `BottomNav.tsx` — nowy efekt liczący `nearbyNew`,
dot na „Znajdź grę". `GroupsClient.tsx` — `KartaEkipy` dostała kropki na rogach ikony
zamiast osobnej plakietki z liczbą z boku. `app/moje-gry/page.tsx` — stan `onlyUnread`,
filtruje `upcoming`/`playing`/`next` przed przekazaniem do sekcji; `unreadByEvent`
przekazywany też do kart w zakładce Historia. `GroupDetailClient.tsx` — to samo dla
`past.map(...)`. `EventCapacityFields.tsx` bez zmian — `onMinPlayersChange` jest
opcjonalny, `app/wydarzenia/nowe/page.tsx` po prostu przestał go przekazywać.
`AGENTS.md` → Konwencje: trzeci kolor spisany obok różowego i niebieskiego.

### 2026-08-16 — Nieprzeczytane wiadomości liczą tylko cudze wpisy; plakietki na kartach i w dolnej nawigacji; poprawka pustego "Wyniku"; gry cykliczne ukryte

PROBLEM: plakietka „nowe wiadomości" na Rozmowie ekipy świeciła się nawet po wysłaniu
własnej wiadomości — nadawca widział ją jako nieprzeczytaną, mimo że widział ją
w momencie wysyłania. Mecze (w odróżnieniu od ekip) w ogóle nie miały żadnego
oznaczenia nieprzeczytanych wiadomości w rozmowie, ani na zakładce, ani na kartach
meczów. Zakładka „Wynik" na stronie meczu była pustym ekranem dla każdego, kto nie
jest organizatorem, dopóki mecz się nie zaczął — trzy warunkowe bloki treści
wymagały tej roli albo `resultsAvailable`, uczestnik nie spełniał żadnego. „Najbliższy
mecz" na stronie ekipy powtarzał się też w liście „Nadchodzące" pod spodem. Zakładka
„Zaproszenia" w ustawieniach ekipy była widoczna nawet dla kogoś bez prawa zapraszania.
Kolor nie miał w apce spisanego, spójnego znaczenia. Produktowa decyzja: rezygnacja
z gier cyklicznych/stałych gierek.

ROZWIĄZANIE BOJO: liczniki nieprzeczytanych (ekipy i mecze) wykluczają teraz własne
wpisy autora. Mecze dostały ten sam mechanizm co ekipy: różowa plakietka z liczbą na
zakładce Rozmowa, ikona z liczbą obok chipu wolnych miejsc na kartach meczów (na
których gram/organizuję/jestem na rezerwie) na `/moje-gry` i w widoku ekipy, oraz
różowa kropka na „Moje" i „Grupy" w dolnej nawigacji — nie nakłada się z istniejącą
niebieską kropką „czeka na akceptację" (osobne rogi ikony). Karty ekip na `/grupy`
dostały analogiczną plakietkę z liczbą nieprzeczytanych wpisów tablicy. Zakładka
Wynik pokazuje teraz uczestnikowi komunikat „pojawi się po zakończeniu meczu" zamiast
pustego ekranu. „Najbliższy mecz" znika z listy „Nadchodzące" pod spodem, żeby nie
dublować tego samego meczu na jednym ekranie. Zakładka „Zaproszenia" w ustawieniach
ekipy jest widoczna tylko dla founder/`can_invite`. Kolorystyka ma teraz spisaną,
wyłączną konwencję (`AGENTS.md` → Konwencje): różowy zawsze i wyłącznie wiadomości,
niebieski zawsze i wyłącznie wymagana akceptacja uczestnictwa — nowy wskaźnik ma się
do niej dostosować zamiast wymyślać kolor na nowo. Gry cykliczne/stałe gierki
zniknęły z nawigacji i z kreatora meczu — kod i istniejące serie zostają w repo
nietknięte, dostępne pod bezpośrednim adresem.

MECHANIKA: `lib/groupPosts.ts` — `nieprzeczytane()` przyjmuje opcjonalny `myUserId`
i filtruje własne wpisy; nowe `getGroupPostsForUnread()`, `policzNieprzeczytanePerGrupa()`,
`hasUnreadGroupMessages()`, `kluczTablicaWidziano()` (wydzielony z dawnej lokalnej
stałej w `GroupDetailClient.tsx`). `lib/comments.ts` — analogiczny komplet dla meczów:
`nieprzeczytaneKomentarze()`, `getCommentsForUnread()`, `policzNieprzeczytanePerWydarzenie()`,
`hasUnreadEventMessages()`, `kluczRozmowyWidziano()`. `lib/events.ts` —
`getMyActiveEventIds()` (gram/rezerwa/organizuję, bez „czeka na akceptację"/
„obserwuję"). `lib/groups.ts` — `getMyGroupIds()`. `EventBrowseCard.tsx` — nowy prop
`unreadMessages`, widoczny tylko gdy `relation` kwalifikuje (organizator/gram/
rezerwa) — przekazywany przez `NextMatchCard`, `MyMatchesSection`,
`PendingRequestsSection`, `NeedsPlayersSection`, `NajblizszyMeczGrupy`.
`BottomNav.tsx` — `dot` zamienione na `dots` (tablica z pozycją `top-right`/
`top-left`, żeby dwie kropki na „Moje" się nie nakładały). `EventDetailClient.tsx` —
`wynikFormSection` dostał blok dla `!(isOwner || canManageSquad)`; nowy stan
`nieprzeczytaneRozmowa` liczony efektem obok `tab`. `GroupDetailClient.tsx` —
`upcomingBezNajblizszego` filtruje `nextMatch.id` z listy. `app/grupy/[id]/edytuj/page.tsx`
— zakładka „Zaproszenia" warunkowana `isOwner || perms.canInvite`. `lib/features.ts`
— `SHOW_RECURRING = false`; `app/wydarzenia/nowe/page.tsx` — przełącznik „Wydarzenie
cykliczne" (`extraSlot` w `EventDateTimeField`) warunkowany tą flagą (wcześniej
renderował się zawsze, niezależnie od niej — flaga gasiła tylko wejścia w nawigacji).

### 2026-08-15 — Info o rozmiarze ekipy dla założyciela; panel "Kto milczy" usunięty

PROBLEM: duża prywatna ekipa (ponad 30 osób) zwykle znaczy, że organizator dodaje coraz
więcej ludzi do grupy, żeby zapełnić skład na mecz — mimo że „Otwórz dla okolicy" (patrz
niżej) rozwiązuje dokładnie ten problem bez rozrastania ekipy: publiczny mecz widzą też
gracze spoza niej. Osobno: panel „Czy gramy?" na stronie meczu ekipy miał blok „Nie
odpowiedziało: N" z przyciskami „Zapytaj w Bojo"/„Tekst na WhatsAppa" do ścigania
milczących członków — usunięty na wyraźną prośbę, jako zbędny obok prostszego „Otwórz
dla okolicy".

ROZWIĄZANIE BOJO: zakładka Skład na stronie ekipy pokazuje teraz założycielowi, gdy
ekipa ma ponad 30 członków, krótką informację: nie trzeba dodawać jak najwięcej osób,
bo publiczny mecz i tak widzą gracze z okolicy. Panel „Czy gramy?" na stronie meczu stracił
blok „Nie odpowiedziało" — zostają tylko werdykt progu minimum i „Otwórz dla okolicy".
RPC `zapytaj_milczacych()` i typ powiadomienia `pytanie_o_udzial` (migracja `097`)
zostają w bazie nietknięte — po prostu nic już ich nie wywołuje.

MECHANIKA: `app/grupy/[id]/GroupDetailClient.tsx` — banner warunkowany
`perms.isFounder && memberCount > 30` nad `<SkladGrupy>`. `components/events/CzyGramyPanel.tsx`
— blok „Nie odpowiedziało" usunięty razem z jego stanem/handlerami. Skasowane jako
martwy kod: `lib/eventResponses.ts` (`ktoMilczy()`, `zapytajMilczacych()` — cały plik,
zero pozostałych wywołań) i `tekstZaczepki()` z `lib/eventShare.ts`, wraz z testami.

### 2026-08-15 — Rozmowa meczu też dla organizatora i ekipy, zakładki sticky, klawiatura ekranowa nie zostawia pustki, drobne poprawki UI

PROBLEM: rozmowa meczu widziała wyłącznie zapisanych uczestników — organizator, który
sam nie gra, i reszta ekipy meczu przypiętego do grupy nie mieli jak w niej pisać, mimo
że to ich rozmowa. „Najbliższy mecz" na stronie ekipy pokazywał się na każdej zakładce
oprócz Rozmowy, zajmując miejsce też pod Statystykami i Składem, gdzie nie miał związku
z treścią. Pasek zakładek (ekipa i mecz) przewijał się razem z treścią zamiast zostać
na miejscu, a poziome przewijanie krótkiego paska zakładek pokazywało pasek przewijania.
Po otwarciu klawiatury ekranowej w Rozmowie robiła się pusta, marnowana przestrzeń nad
klawiaturą — `100dvh` nie kurczył się razem z nią. Kod dołączenia do ekipy i możliwość
zaproszenia zniknęły z zakładki Skład razem z odchudzeniem górnej belki w poprzedniej
rundzie, a stat kafelek „nadchodzące" (dłuższy niż sąsiednie etykiety) łamał się do
dwóch linii i wyglądał na rozjechany względem reszty rzędu. Przyciski „Zapytaj w Bojo"/
„Tekst na WhatsAppa" stały jeden pod drugim, marnując miejsce.

ROZWIĄZANIE BOJO: rozmowę meczu widzi teraz też organizator (bez względu na to, czy
sam gra) i cała ekipa, do której mecz jest przypięty (bez względu na to, czy dany
członek gra akurat w tym terminie). „Najbliższy mecz" na stronie ekipy pokazuje się
wyłącznie w zakładce Mecze — to jej treść, nie uniwersalny nagłówek. Pasek nazwy/belki
i zakładek (ekipa i mecz) trzyma się teraz góry ekranu podczas przewijania, a poziome
przewijanie zakładek nie pokazuje już paska przewijania. Klawiatura ekranowa realnie
kurczy layout, więc composer w Rozmowie zostaje tuż nad nią, bez pustki pod spodem.
Zakładka Skład dostała z powrotem szybki dostęp do zaproszenia: mała belka „Zaproś do
ekipy" + kod dołączenia + ikona udostępnienia nad listą graczy. Kafelki statystyk mają
teraz wspólną minimalną wysokość i wyśrodkowaną treść, więc dłuższa etykieta już nie
rozjeżdża rzędu. „Zapytaj w Bojo"/„Tekst na WhatsAppa" stoją teraz obok siebie.

MECHANIKA: `app/wydarzenia/[id]/EventDetailClient.tsx` — nowy stan `czlonekGrupyMeczu`
(z `isGroupMember()`, doładowany razem z `groupInfo`), gate Rozmowy rozszerzony na
`myParticipation || isOwner || czlonekGrupyMeczu`. `app/layout.tsx`:
`viewport.interactiveWidget: 'resizes-content'`. `app/grupy/[id]/GroupDetailClient.tsx`:
belka i pasek zakładek w jednym `sticky top-0` kontenerze (dwa osobne nakładałyby się
na tej samej wysokości); `NajblizszyMeczGrupy` pod warunkiem `tab === 'mecze'` zamiast
`tab !== 'tablica'`; nowa belka zaproszenia nad `<SkladGrupy>` (`linkDoGrupy()`/
`udostepnijGrupe()` z `lib/groupShare.ts`, ponownie użyty `handleCopyCode`). Analogiczny
sticky kontener w `EventDetailClient.tsx` dla paska nazwy + zakładek. Nowa klasa
`.scrollbar-hide` w `globals.css`. `StatystykiGrupy.tsx`: `Kafelek` dostał `min-h-[4rem]`
i wyśrodkowanie flex. `CzyGramyPanel.tsx`: `flex-1` na obu przyciskach zamiast
`flex-wrap`.

### 2026-08-15 — Strona meczu dostaje pięć zakładek (Skład/Rozmowa/Wynik/Rozliczenia/Ustawienia); belka ekipy odchudzona, ustawienia jako zakładka

PROBLEM: strona meczu była jedną długą kolumną — dane, prośby o dołączenie, skład,
drużyny, wynik, rozliczenie, ustawienia organizatora i komentarze stały jedna pod drugą
bez podziału, więc np. rozliczenie kosztów ginęło daleko na dole. Komentarze wyglądały
i działały inaczej niż „Rozmowa" w ekipie, mimo tej samej potrzeby. Na stronie ekipy
zakładki stały POD kartą „Najbliższy mecz", nie nad nią. Belka ekipy miała za dużo
elementów naraz (powrót, logo, nazwa, zaproszenie, kod dołączenia, zębatka ustawień,
dzwonek, awatar). Po ukryciu dolnej nawigacji na zakładce Rozmowa (w ekipie i na meczu)
kontener czatu zostawiał pod sobą pas pustego tła, a na zakładce Rozmowa w ekipie sama
belka lądowała niżej niż na pozostałych zakładkach (efekt uboczny `position: sticky`
wewnątrz nieprzewijalnego, `overflow-hidden` kontenera).

ROZWIĄZANIE BOJO: strona meczu ma teraz pięć zakładek: **Skład** (domyślna — uczestnicy,
zapisy, prośby o dołączenie, panel „Czy gramy?", zwinięty domyślnie podział na drużyny,
karta „Po meczu"), **Rozmowa** (ten sam mechanizm czatu co w ekipie, i **wyłącznie** okno
czatu — żadnych innych elementów strony), **Wynik** (drużyny i formularz rezultatu —
ten sam podział na drużyny co w zakładce Skład, zawsze rozwinięty), **Rozliczenia**
(podział kosztów) i **Ustawienia** (panel organizatora, domyślnie rozwinięty — to teraz
cała treść zakładki, nie jedna z wielu kart). Nazwa meczu przeniosła się nad zakładki
(tam gdzie wcześniej stały „Udostępnij"/„Kopiuj"), a te dwa przyciski zeszły pod
zakładki, w miejsce dawnego tytułu — zamiana miejscami, nic nie zniknęło. Reszta statusu
meczu (baner odwołania, „Mecz gotowy", chipy daty/miejsca/ceny, sticky pasek „Dołącz")
zostaje uniwersalna na każdej zakładce oprócz Rozmowy. Na stronie ekipy zakładki
przeniosły się nad „Najbliższy mecz", a belka schudła do logo, nazwy, „Zaproś" i
dzwonka — kod dołączenia żyje już tylko w arkuszu „Zaproś", a ustawienia dostały swój
wpis w pasku zakładek zamiast osobnej zębatki. Rozmowa ekipy i rozmowa meczu obie
rozciągają się do samego dołu ekranu na telefonie, a belka ekipy na zakładce Rozmowa
stoi teraz na tej samej wysokości co na pozostałych zakładkach.

MECHANIKA: nowy `components/events/RozmowaWydarzenia.tsx`; zastępuje usunięty
`components/events/EventComments.tsx`. `app/wydarzenia/[id]/EventDetailClient.tsx`: stan
zakładki w `?tab=`; `skladWynikSection` rozbita na `druzynySection` (renderowany w Skład
i Wynik — ten sam JSX na tym samym stanie z rodzica, więc zmiana w jednym miejscu jest
od razu widoczna w drugim, bez synchronizacji) i `wynikFormSection`; `PoMeczuCard` dostał
`onWpiszWynik` i warunek `tab === 'sklad'` (przestał być uniwersalny); uniwersalne sekcje
(baner odwołania, „Mecz gotowy", blok akcji, sticky pasek) dostały `tab !== 'rozmowa'`.
`app/grupy/[id]/GroupDetailClient.tsx`: belka bez kodu dołączenia i zębatki (Link
„Ustawienia" w pasku zakładek zamiast), `NotificationBell` zamiast `MobileIdentityRow`
(bez awatara); `position: sticky` na belce warunkowo wyłączone na zakładce Rozmowy.
`RozmowaGrupy.tsx`: `h-full` zamiast sztywnego `h-[68dvh]`, wysokość narzuca rodzic.

### 2026-08-15 — Czy gramy: próg minimum, kto milczy, otwarcie dla okolicy; rozmowa jak WhatsApp; ekipa z jedną osobą już nie jest martwa

PROBLEM: realna ekipa grająca co tydzień odtworzyła ręcznie w wątku na WhatsAppie
dokładnie ten model, który Bojo już ma (bramka/gram/pass + rezerwa) — a cała reszta
wątku była pracą biurową organizatora: „Brakuje nam 1go? Dobrze liczę?", „10 to minimum
żeby zagrać", „Może jeszcze ktoś się decyduje?", „Szukamy chętnych… potrzebne 3 osoby"
rozsyłane po innych grupach. Rozmowa grupy (dawna „Tablica") była listą wpisów odgórnie
na najnowszy, nie czatem — mało czytelna, z przyciskiem wysyłki zajmującym cały wiersz
i bez sposobu wrócić na dół po przewinięciu w górę. Nowo utworzona ekipa miała jednego
członka i żadnej podpowiedzi, żeby kogoś zaprosić — organizator kończył formularz i nie
wiedział, co dalej. „Usuń ekipę" i „Opuść ekipę" stały razem na dole strony grupy, pod
każdą zakładką z osobna, zdублowane z tym samym przyciskiem w Ustawieniach.

ROZWIĄZANIE BOJO: organizator ustawia próg `min_players`, a strona meczu pokazuje
werdykt wprost („Gramy ✓" / „Brakuje 2 do minimum") zamiast zostawiać liczenie w głowie.
Przy meczu ekipy widzi też, kto z grupy jeszcze nie odpowiedział — ani nie dołączył, ani
nie odmówił — i może zaczepić milczących powiadomieniem w Bojo albo skopiować gotowy
tekst na WhatsAppa (Bojo nie ma dziś pusha ani SMS-a, więc karmi kanał, w którym ekipa
już rozmawia, zamiast z nim konkurować). Członek ekipy dostaje jawne „Nie gram" — cisza
przestaje znaczyć naraz „nie widziałem" i „odpadam". Gdy prywatnemu meczowi brakuje
ludzi, jedno kliknięcie „Otwórz dla okolicy" zamienia go w publiczny — jedyna rzecz
z tego zestawu, której żaden komunikator nie potrafi. Rozmowa grupy wygląda i przewija
się teraz jak WhatsApp: chronologia rosnąco, composer pod listą, auto-scroll na dół,
przycisk powrotu, dymki grupujące wiadomości tej samej osoby. Formularz nowej ekipy
dostał okładkę i po utworzeniu prosto prowadzi do zaproszenia znajomych. „Usuń ekipę"
zostaje wyłącznie w Ustawieniach; „Opuść ekipę" przeniosło się do Składu.

MECHANIKA: migracja `097` (`events.min_players`, tabela `event_declines` — osobna od
`rsvp`, bo odmowa to nie nieobecność — RPC `zapytaj_milczacych()`, wyzwalacz
`powiadom_o_progu_gry()` wzorem `079`); `lib/events.ts` (`werdyktGry()`);
`lib/eventDeclines.ts`, `lib/eventResponses.ts` (`ktoMilczy()`) — nowe; `lib/eventShare.ts`
(`tekstZaczepki()`); `components/events/{CzyGramyPanel,NieGramButton}.tsx` — nowe;
`components/groups/RozmowaGrupy.tsx` — przebudowany; `app/grupy/nowe/page.tsx`
(okładka, `?zapros=1`); `components/groups/SkladGrupy.tsx` (Opuść ekipę).

PROBLEM: nagłówek `/grupy/[id]` zajmował za dużo miejsca (osobny wiersz „← Ekipy" nad
kartą z okładką) zamiast pokazać od razu, kiedy gramy; kod dołączenia był schowany
w osobnym ekranie ustawień zamiast obok przycisku „Zaproś"; lista ekip na `/grupy`
sortowała się po dacie założenia, nie po tym, która gra najbliżej; zmiana uprawnień
innego członka żyła wyłącznie w Ustawieniach, mimo że najczęściej potrzebna jest
dokładnie tam, gdzie widać skład; „Zaproś" i kod dołączenia widział każdy członek bez
żadnej bramki, bo `can_manage_members` mieszało dwa różne poziomy zaufania (dodawanie
ludzi wprost i samo zapraszanie kodem) w jednym przełączniku; „Najbliższy mecz" miał
własną, niestandardową kartę zamiast tej samej, którą gracz zna z `/wydarzenia`.

ROZWIĄZANIE BOJO: jedna niska belka łączy powrót, tożsamość ekipy, „Zaproś", kod
dołączenia (klikalny, kopiuje do schowka) i ustawienia. Lista `/grupy` sortuje się po
najbliższym terminie. „Tablica" zmieniła się w „Rozmowę" — wizualnie dymki czatu, własne
wiadomości po prawej. W Składzie każdy członek ma teraz przycisk ustawień rozwijający
panel uprawnień inline (dla założyciela), a Ustawienia dostały zakładki (Ogólne /
Zaproszenia / Uprawnienia) z tym samym panelem jako akordeon rozwijany po imieniu.
Nowy, czwarty przełącznik `can_invite` steruje wyłącznie widocznością „Zaproś" i kodu —
niezależnie od `can_manage_members`. „Najbliższy mecz" renderuje się teraz tą samą kartą
co lista meczów (`EventBrowseCard`), z „Udostępnij" jako osobnym przyciskiem pod spodem.

MECHANIKA: migracja `096` (`group_members.can_invite`, domyślnie `true` — dziś każdy to
widzi bez bramki, ten sam powód co `can_create_events` w `092`; trigger
`ustaw_role_czlonka()` przedefiniowany, żeby wymusić `true` na założycielu). Nowy
`components/groups/UprawnieniaCzlonkaPanel.tsx` (cztery `ToggleRow`, współdzielony przez
`SkladGrupy.tsx` i `/grupy/[id]/edytuj`); `TablicaGrupy.tsx` przemianowany na
`RozmowaGrupy.tsx` (mechanika bez zmian — `group_posts`, `093` — zmienił się wyłącznie
wygląd i etykieta); `getMyGroupsZTerminem()` w `lib/groups.ts` sortuje wynik po dacie
najbliższego meczu, grupy bez terminu na końcu.

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
