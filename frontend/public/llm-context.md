# Bojo — kontekst dla modeli językowych

> Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów w całej Polsce
> (katalog boisk obejmuje całą Polskę): mecze publiczne otwarte na dołączenie,
> stałe ekipy (grupy), mapa obiektów sportowych. Interfejs po polsku. Logowanie przez
> Google lub e-mail.

**Stan na:** 2026-08-22 · migracja `116` · 39 tabel · 698 testów

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

### 2026-08-22 — SEO/GEO: odpowiedzi wprost, strony sport+miasto na Warszawę i Kraków

PROBLEM: strony `/jak-dziala-bojo` i `/dlaczego-bojo` odpowiadały na pytanie użytkownika
dopiero po przewinięciu — modele generatywne cytują krótkie, faktograficzne akapity, a
takich nie było. Odpowiedź o podziale kosztów nie podawała żadnej liczby, więc nie dawała
się zacytować jako konkret. Landingi lokalne obsługiwały jedno miasto i siedziały pod
prefiksem `/graj/`, a nic na stronie nie mówiło wprost, że Bojo nie jest systemem
rezerwacji obiektów — przez co trafiało do odpowiedzi na zapytania o wynajem boiska,
gdzie nic nie wnosi.

ROZWIĄZANIE BOJO: Direct Answer (40–50 słów) nad treścią `/dlaczego-bojo`,
`/jak-dziala-bojo` i każdej strony sport+miasto. Odpowiedź o kosztach niesie rachunek
(150 zł ÷ 12 miejsc = 12,50 zł od osoby — dzielnikiem jest liczba MIEJSC, nie liczba
zapisanych). Trzy nowe pytania FAQ: o sprawiedliwe rozliczenie wynajmu, o brakującą osobę
na mecz i o szukanie ludzi do gry. Landingi lokalne przeniesione z `/graj/[sport]/[miasto]`
na `/[sport]/[miasto]` (301 ze starych adresów) i rozszerzone o Warszawę i Kraków —
dwanaście stron. Każda dostała blok „Czym Bojo nie jest", liczbę obiektów katalogu
w okolicy, `MiniFaq` z czterema pytaniami i link do mapy.

MECHANIKA: `content/miasta.ts` (nowy — slug, mianownik, miejscownik z przyimkiem,
współrzędne, szablony Direct Answer i `CZYM_BOJO_NIE_JEST`), `app/[sport]/[miasto]/page.tsx`
(przeniesiony, `dynamicParams = false` — trasa siedzi na pierwszym segmencie ścieżki),
`next.config.mjs#redirects()`, `lib/api.ts#policzBoiskaWOkolicy()` (kadr prostokątny, nie
haversine — stąd „w okolicy" w treści), `content/dlaczego.ts#DLACZEGO_ODPOWIEDZ`,
`content/jakDziala.ts#JAK_DZIALA_ODPOWIEDZ`, `lib/structuredData.ts` (`FAQPage` na
stronach miejskich, karty sportowe w `featureList`), `sitemap.ts#grajPages`,
`scripts/check-docs.mjs` (walidacja nowego kształtu URL), `__tests__/miasta.test.ts`.

### 2026-08-20 — Link do meczu pokazuje jego szczegóły na WhatsAppie i Messengerze

PROBLEM: każdy udostępniony link do meczu pokazywał ten sam, generyczny baner Bojo — bez
sportu, terminu, miejsca ani liczby wolnych miejsc. Podgląd linku robi połowę roboty przy
przekonywaniu kogoś do kliknięcia, a Bojo tę połowę oddawało za darmo. Osobno: przycisk
„Kopiuj link" (w odróżnieniu od „Udostępnij") kopiował sam goły adres, bez daty, miejsca
i ceny.

ROZWIĄZANIE BOJO: link do meczu ma teraz własną kartę podglądu — sport, nazwa, dzień
i godzina, miejsce, liczba wolnych miejsc (albo „Komplet"), cena. „Kopiuj link" kopiuje
to samo, co „Udostępnij": tekst z detalami meczu plus adres.

MECHANIKA: `app/wydarzenia/[id]/opengraph-image.tsx` (konwencja Next.js, `runtime =
'edge'`, generuje obrazek 1200×630 przez `next/og`), dane przez wspólny `getEventMeta()`
wydzielony do `eventMeta.ts`. `textDoKopiowania()` w `lib/eventShare.ts` — jeden helper
dla trzech miejsc kopiujących link (pasek meczu, panel „Zaproś znajomych", fallback
`navigator.share`).

### 2026-08-20 — Zapis gościa bez konta respektuje akceptację zapisów

PROBLEM: mecz z włączoną „akceptacją zapisów" miał furtkę — gość zapisujący się linkiem,
bez zakładania konta, wchodził prosto do składu, podczas gdy zalogowany gracz na tym
samym meczu czekał na zgodę organizatora. Kontrola składu, którą organizator świadomie
włączył, nie obejmowała najprostszej ścieżki dołączenia.

ROZWIĄZANIE BOJO: zapis gościa respektuje akceptację zapisów dokładnie tak samo jak zapis
zalogowany — wpis czeka na zgodę i nie zajmuje miejsca, dopóki organizator go nie
zaakceptuje. Formularz zapisu bez konta pokazuje to wprost, zanim gość kliknie „Zapisz
się".

MECHANIKA: RPC `dolacz_do_meczu_jako_goscie()` (migracja `115`) ustawia `pending_approval
= events.require_approval`, tak jak `dolacz_do_meczu()` (migracja `078`) dla zapisu
zalogowanego. Organizator dostaje powiadomienie o prośbie tym samym mechanizmem co dla
zalogowanych graczy.

### 2026-08-20 — Powiadomienia o usunięciu ze składu, zmianie meczu i usunięciu meczu

PROBLEM: trzy sytuacje w Bojo były całkowicie ciche. Organizator usuwający gracza z już
zajętego miejsca w składzie (nie z listy oczekujących — to miało powiadomienie od dawna)
nie zostawiał żadnego śladu — gracz dowiadywał się na boisku. Zmiana miejsca meczu albo
ceny po publikacji nie generowała nic — na czacie grupowym taka informacja by padła.
Twarde usunięcie całego meczu (nie odwołanie — realne skasowanie) nie mówiło nic
nikomu, mimo że modal potwierdzenia ostrzega wprost „wszyscy uczestnicy stracą dostęp".

ROZWIĄZANIE BOJO: wszystkie trzy sytuacje generują teraz powiadomienie pod dzwonkiem:
„Usunięto Cię ze składu", „Zmiana w meczu" (miejsce lub koszt), „Mecz usunięty".

MECHANIKA: trzy triggery SQL — `powiadom_o_usunieciu_uczestnika` (migracja `113`,
`BEFORE DELETE` na `event_participants`, pomija samowypisanie i wiersze już objęte
powiadomieniem o odrzuconej prośbie), `powiadom_o_zmianie_warunkow` (migracja `114`,
`AFTER UPDATE` na `events`, jeden trigger dla miejsca i kosztu — `updateEvent()` zapisuje
cały wiersz jedną instrukcją), `powiadom_o_usunieciu_meczu` (migracja `116`, `BEFORE
DELETE` na `events`, wstawia `event_id = NULL` — `notifications.event_id` ma `ON DELETE
CASCADE`, więc wiersz z prawdziwym id zostałby skasowany kaskadą momenty po wstawieniu).
Migracja `116` naprawia też odkryty przy tej okazji błąd: usunięcie meczu z choćby jedną
oczekującą prośbą o dołączenie wcześniej zawsze kończyło się błędem klucza obcego.

### 2026-08-19 — SEO/GEO: strona /graj/[sport]/[miasto] dla Poznania

PROBLEM: zapytania typu „gdzie szukać ludzi do gry w piłkę w Poznaniu" nie miały strony
docelowej — `/boiska/[sport]` odpowiada „gdzie jest boisko" (katalog nationwide), a
`/wydarzenia` to płaska lista bez adresu URL na sport ani miasto. Wartość #2 misji Bojo
(„koniec z odwoływaniem meczu z braku 1-2 osób") nie miała własnego wejścia z wyszukiwarki.
Osobno: `get_nearby_events()` (migracja `025`) istniała od dawna, ale poza wyłączoną flagą
`SHOW_GAME_ALERTS` nic jej nie wołało — martwy kod.

ROZWIĄZANIE BOJO: cztery nowe strony, `/graj/[sport]/poznan` (piłka nożna, siatkówka,
siatkówka plażowa, koszykówka) — jedyne miasto z realnym pokryciem katalogu i ruchem.
Każda pokazuje na żywo otwarte publiczne mecze danego sportu w promieniu 15 km od centrum
(licznik + do 5 najbliższych, link do strony meczu), 3 kroki zakładania meczu, uczciwe
zastrzeżenie gdy lista jest pusta, i CTA „Stwórz mecz publiczny" z prefillem sportu.
`/boiska/[sport]` i `/wydarzenia/nowe` dostały linki do/z nowych stron.

MECHANIKA: `app/graj/[sport]/[miasto]/page.tsx` (`generateStaticParams` — zbiór bounded,
4 strony, `revalidate=3600`), `lib/events.ts#getNearbyEvents()` (odkurzone, RPC
`get_nearby_events`), `lib/sports.ts#FOCUS_SPORT_BY_SLUG` (slug↔wartość w bazie, używane
też przez `?sport=` w `wydarzenia/nowe` — kreator wcześniej ignorował ten parametr),
`content/graj.ts` (nowa treść + import kroków z `content/jakDziala.ts`, pokryte tym samym
testem `tresciStron.test.ts` co pozostałe strony treści, mimo że AGENTS.md nie wymusza
tego automatycznie dla nowych tras), `sitemap.ts#grajPages`.

### 2026-08-19 — SEO/GEO: współrzędne meczu w danych strukturalnych, linki między boiskami a treścią

PROBLEM: dane strukturalne meczu (`SportsEvent`) nie niosły współrzędnych, mimo że `events.lat`
i `events.lng` są zapisywane przy każdym utworzeniu meczu — wyszukiwarki i asystenci AI nie
mieli sygnału geograficznego do lokalnych zapytań („mecze w mojej okolicy”). Osobno: katalog
boisk (`/boiska/[sport]`) i strony treści (`/jak-dziala-bojo`, `/dlaczego-bojo`) nie linkowały
do siebie nawzajem — ktoś szukający boiska nie trafiał na wyjaśnienie, jak zorganizować na nim
mecz, i odwrotnie.

ROZWIĄZANIE BOJO: `location.geo` (`GeoCoordinates`) w danych strukturalnych meczu, gdy
współrzędne są znane — dotyczy zarówno boiska z katalogu, jak i przypiętej pinezki, bo obie
ścieżki zapisują `events.lat`/`events.lng`. `/boiska/[sport]` dostało link „Jak działa Bojo —
zbierz skład na to boisko”, a `/jak-dziala-bojo` i `/dlaczego-bojo` dostały link „Mapa boisk”
w swoich CTA-boxach.

MECHANIKA: `lib/structuredData.ts` (`EventForJsonLd.lat/lng`, `eventJsonLd()` dokłada `geo`
jako rodzeństwo `address` wewnątrz `location`), `app/wydarzenia/[id]/page.tsx` (`getEventMeta()`
selektuje teraz `lat, lng`), `app/boiska/[sport]/page.tsx`, `app/jak-dziala-bojo/page.tsx`,
`app/dlaczego-bojo/page.tsx` (nowe `<Link>`, bez zmian treści).

### 2026-08-19 — SEO/GEO: kalkulator kosztów w nagłówku, sekcja o brakujących graczach, mini-FAQ

PROBLEM: `/jak-dziala-bojo` i `/dlaczego-bojo` odpowiadały na realne pytania organizatorów
(„jak rozliczyć mecz ze znajomymi”, „gdzie szukać brakujących graczy”, „czym Bojo różni się
od grupy na WhatsAppie”), ale nagłówki i meta-opisy nie używały tych fraz wprost — wyszukiwarki
i asystenci AI składają odpowiedź z fragmentu najbliższego pytaniu, więc sekcja bez pytania
w nagłówku ginęła, mimo że odpowiedź w treści już tam była. Osobno: strony treści nie miały
żadnej danej strukturalnej poza `BreadcrumbList` — `siteJsonLd()` opisywał Bojo tylko jako
`Organization`/`WebSite`, bez listy funkcji czytelnej dla modeli.

ROZWIĄZANIE BOJO: nagłówek sekcji „Kto ile płaci” brzmi teraz „Jak rozliczyć mecz ze
znajomymi — kalkulator kosztów boiska” (treść bez zmian — pierwsze zdanie już było gotową
odpowiedzią). Nowa sekcja „Co zrobić, gdy brakuje 1-2 graczy do składu” tłumaczy przełącznik
„mecz publiczny” z kroku 3 kreatora i uczciwie zastrzega, że publicznych gier bywa dziś
niewiele. `/jak-dziala-bojo` i `/dlaczego-bojo` dostały każda mały, tematyczny blok FAQ
(accordion) pod koniec strony — inny podzbiór pytań na każdej, żeby się nie dublowały.
`siteJsonLd()` niesie teraz też węzeł `SoftwareApplication` z listą funkcji, a
`/jak-dziala-bojo` emituje `HowTo` nad trzema krokami zakładania meczu.

MECHANIKA: `content/jakDziala.ts` (sekcja `pieniadze` przemianowana, nowa sekcja
`brakuje-graczy`), `lib/structuredData.ts` (`howToJsonLd()`, węzeł `SoftwareApplication`
w `siteJsonLd()`), nowy `components/tresc/MiniFaq.tsx` (accordion wyciągnięty z `/faq`,
używany też tam zamiast zduplikowanego JSX). Reguła bez zmian: schema `faqJsonLd()` zawsze
nad dokładnie tym podzbiorem `content/faq.ts`, który jest faktycznie widoczny jako tekst na
stronie — inaczej to sygnał spamu dla wyszukiwarek, nie boost.

### 2026-08-19 — Treść powiadomienia mówi, co się stało

PROBLEM: powiadomienie na telefonie widać przez sekundę, na zablokowanym ekranie, w dwóch
linijkach — i musi w tym czasie odpowiedzieć na pytanie „czy mnie to teraz obchodzi".
Powiadomienia o wiadomościach nie odpowiadały wcale: tytuł brzmiał „Nowa wiadomość" (czyli
to, co widać po ikonie), a treść mówiła „X napisał w rozmowie", czyli powtarzała tytuł
innymi słowami. Trzeba było otworzyć aplikację, żeby dowiedzieć się, czy chodzi o „będę 10
minut później", czy o „nie dam rady, szukajcie kogoś". Osobno: zachęta do włączenia
powiadomień wracała przy każdym wejściu na mecz, w którym się gra.

ROZWIĄZANIE BOJO: tytuł powiadomienia niesie konkret, którego dotyczy (nazwa meczu, nazwa
ekipy), a treść mówi, co się wydarzyło — przy wiadomości jest to sama wiadomość
(`Kuba Nowak: Będę 10 minut później`), ucięta do 140 znaków z wielokropkiem. „Są składy"
i „nowy mecz w ekipie" dostały nazwę meczu w tytule oraz termin i miejsce w treści. Zachęta
do włączenia powiadomień pokazuje się teraz WYŁĄCZNIE w chwili zapisania się na mecz, jako
pasek wysuwany z dołu ekranu — nie jako kafelek w treści strony. Propozycja dodania Bojo do
ekranu głównego jest arkuszem z przyciemnionym tłem, a nie wąskim paskiem: duża ikona
aplikacji, nagłówek „Miej Bojo na ekranie głównym" i trzy korzyści zamiast jednego zdania
(zwolnione miejsce w meczu jako pierwsza, bo tylko ona przepada w kilka minut). Kapitana
drużyny da się wskazać w KAŻDYM trybie dzielenia składu, a nie tylko w trybie „kapitanowie";
widać go teraz na liście składów (litera „c" w okręgu przy nazwisku, `OznaczenieKapitana.tsx`). Na boisku w Taktyce widnieje pełne imię i nazwisko łamane na dwie linijki, a w kółku nazwa pozycji (BR, LO, ŚP, N…) — kółko mówi „gdzie", podpis mówi „kto"; samo imię nie rozróżniało dwóch Mateuszów w jednym składzie. Przy najbliższym meczu ekipy stoi ten sam panel „Zaproś znajomych" co w widoku meczu (udostępnienie + kopiowanie linku) zamiast pojedynczego „Udostępnij mecz" i przy nazwie drużyny w zakładce Taktyka.

MECHANIKA: migracja `111` (funkcje `powiadom_o_wiadomosci_w_meczu`,
`powiadom_o_wiadomosci_w_grupie`, `powiadom_o_skladach`, `powiadom_o_nowym_meczu_w_grupie`),
`components/events/ZachetaPush.tsx` (zdarzenie `zaproponujPowiadomienia()`, wołane po
udanym zapisie — ten sam wzorzec co `zaproponujInstalacje()`), `components/ZachetaInstalacji.tsx`
z listą korzyści w `lib/instalacja.ts` (`korzysciInstalacji()` — reguła produktowa poza
widokiem, więc sprawdzalna testem bez renderowania). Gwiazdka kapitana w `TeamsPanel.tsx`
zależy od `variant === 'manage'`, nie od `team_mode`; `setCaptain()` (`lib/eventFeatures.ts`)
idzie przez `zaktualizujJedenWiersz()`, więc cicha odmowa RLS zamienia się w błąd. Zatwierdzenie propozycji
składów nie publikuje ich automatycznie (`accept_team_proposal` z `059` nie rusza
`teams_published`), więc komunikat po zatwierdzeniu mówi wprost, że trzeba jeszcze
opublikować.

### 2026-08-19 — Kolejka rezerwowa liczyła czas od obserwowania, nie od zapisu

PROBLEM: gracz, który najpierw kliknął „Obserwuj", a dopiero później „Dołącz", widział
pod swoim nazwiskiem na liście rezerwowej moment rozpoczęcia obserwowania, nie moment
realnego zapisu — bo „Obserwuję" i zwykły zapis to w bazie ten sam wiersz, a przejście
między nimi jest aktualizacją, nie nowym wpisem. Poważniejsze niż zła etykieta: dokładnie
ten sam znacznik ustawia kolejność w kolejce rezerwowej, więc taka osoba wskakiwała
przed każdego, kto zapisał się w międzyczasie, i to ona dostawała każde zwolnione miejsce.

ROZWIĄZANIE BOJO: osobna kolumna `zapisano_at` — wyłącznie moment, od którego liczy się
miejsce w kolejce. Trigger ustawia ją na `now()` (zegar serwera) dokładnie w chwili
przejścia z „obserwuję" na „dołączam", nigdy przy samym obserwowaniu. `created_at` zostaje
nietknięte i nadal znaczy „kiedy powstał wiersz". Rozliczenia w zakładce „Rozliczenia"
dostały przycisk „Wszyscy oddali" (i „Cofnij", gdy już wszyscy oddali) — masowe oznaczenie
całego składu zamiast klikania po jednej osobie, z kwotą liczoną per osoba (zniżka z karty
sportowej). Różowa plakietka z liczbą nieprzeczytanych na karcie meczu prowadzi teraz
prosto do zakładki „Rozmowa"; przytrzymanie „Moje" na dolnej nawigacji otwiera panel
z listą wszystkich rozmów z nieprzeczytanymi (mecze i ekipy razem, od najnowszej). Swipe
w bok przełącza zakładki na `/moje-gry`, `/grupy/[id]` i `/wydarzenia/[id]`.

MECHANIKA: migracja `110` — `event_participants.zapisano_at`, trigger `trg_moment_zapisu`,
`sync_reserve_claim()` sortuje kolejkę po `zapisano_at`. Klient: `momentZapisu()`
w `lib/events.ts` (fallback na `created_at` dla bazy bez migracji). Rozliczenia:
`ustawPlatnoscWszystkim()` w `lib/eventFeatures.ts`, helper `zaktualizujWiersze()`
w `lib/zapytania.ts`. Skrót do rozmowy: plakietka w `EventBrowseCard.tsx` nawiguje na
`?tab=rozmowa`. Panel rozmów: `useDlugieWcisniecie()`, `components/layout/PanelRozmow.tsx`,
`rozmowyZNieprzeczytanymi()`/`rozmowyGrupZNieprzeczytanymi()`. Swipe: `useSwipeZakladek()`
w `lib/useSwipeZakladek.ts`, bez zawijania na krańcach, wyłączony na pasku zakładek
i w miejscach z własnym gestem (podział na drużyny, pole tekstowe rozmowy).

### 2026-08-19 — Ustawienia powiadomień i powiadomienia o wiadomościach

PROBLEM: powiadomienia na telefon działały „wszystko albo nic" — jedyną reakcją na zbyt
wiele było wyłączenie ich w całości, razem z tymi, które naprawdę mają znaczenie
(zwolnione miejsce, odwołany mecz). Osobno: wiadomości w rozmowie meczu i na tablicy
ekipy NIE miały żadnego powiadomienia — nieprzeczytane liczyła sama przeglądarka, więc
o nowej wiadomości dowiadywał się tylko ten, kto i tak otworzył aplikację.

ROZWIĄZANIE BOJO: w profilu, pod przełącznikiem powiadomień, jest rozwijana lista „O czym
powiadamiać" z osobnym przełącznikiem dla każdego rodzaju: zwolnione miejsce, odwołany
mecz, pytanie o udział, zaproszenie, prośba o dołączenie, składy, nowy mecz w ekipie,
wiadomości w meczu, wiadomości w ekipie, ogłoszenia. Rzeczy wymagające reakcji stoją na
górze i mają znacznik „ważne" — Bojo ostrzega, ale nie zabrania ich wyłączyć. Ustawienia
dotyczą WYŁĄCZNIE telefonu: dzwonek w aplikacji pokazuje wszystko.

Doszły powiadomienia o wiadomościach (w meczu i w ekipie) oraz o opublikowaniu składów.
Wiadomości mają zaporę: najwyżej jedno powiadomienie na godzinę z danej rozmowy, bo
rozmowa przed meczem potrafi mieć trzydzieści wpisów w kwadrans, a trzydzieści
powiadomień kończy się wyłączeniem wszystkich.

MECHANIKA: migracja `109` — `profiles.push_wylaczone` (lista WYŁĄCZONYCH, żeby nowy rodzaj
był domyślnie aktywny), filtr w wyzwalaczu wysyłki, wyzwalacze na `event_comments`,
`group_posts` i `events.teams_published`. Klient: `lib/ustawieniaPowiadomien.ts`
i `components/PowiadomieniaPush.tsx`. Przy logowaniu przez Google Bojo prosi teraz zawsze
o wybór konta (`prompt=select_account`) — bez tego przy kilku kontach Google logowało od
razu na pierwsze z brzegu.
