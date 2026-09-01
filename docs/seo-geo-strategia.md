# Bojo — strategia SEO i GEO

> **Stan na:** 2026-08-23 · audyt kodu na commicie `318cd85` · warstwa produkcyjna
> **niezweryfikowana** (patrz „Czego nie sprawdziłem"). Rozdział 0 doszedł do
> 2026-08-25 (runda 2 promptu, `docs/prompt-seo-geo.md`) — rozjazd BACKLOG/kod
> ponownie sprawdzony, warstwa produkcyjna nadal niezweryfikowana z nowym powodem.
>
> Warstwa operacyjna i fazy → [strategia.md](./strategia.md).
> Kierunek produktu → [wizja.md](./wizja.md) (dokument nadrzędny).

## Streszczenie dla kogoś, kto nie zna się na SEO

Bojo ma zbudowaną całą maszynerię do bycia znajdowanym w Google i polecanym przez
asystentów AI, ale ta maszyneria w dużej części **nie działa dla robotów**, które
czytają strony. Wygląda to tak: mamy ponad trzydzieści tysięcy stron boisk, do których
prowadzi mapa strony, ale robot wchodzący na taką stronę widzi pustą ramkę — treść
dorysowuje się dopiero w przeglądarce, a robot przeglądarką nie jest. Szesnaście stron
wojewódzkich nie ma ani jednego odnośnika prowadzącego do nich z innej strony, więc
w praktyce nie istnieją. Do tego jedna rzecz jest wyciekiem: strona prywatnego meczu
podaje w swoich niewidocznych danych nazwę, sport, datę, godzinę i boisko — czyli
dokładnie to, czego strzeże kod dołączenia.

Dobra wiadomość: to są tanie naprawy. Zła: nawet naprawione, nie wystarczą. Nazwa
„bojo" jest w polszczyźnie potocznym słowem znaczącym „boisko", więc zapytanie o markę
zawsze trafi w słownik, a nie w produkt — to trzeba rozwiązać osobno. A rynek, wbrew
temu, co zakładaliśmy, nie jest pusty.

Dokument mówi, co naprawić najpierw, na jakie pytania Bojo ma realnie odpowiadać,
a od jakich trzymać się z daleka, i po czym poznamy za trzy miesiące, że to działa.

**Żargon, który dalej pada:**
- **crawler / robot / bot** — program wyszukiwarki, który pobiera stronę. Zwykle nie
  uruchamia JavaScriptu albo robi to z opóźnieniem, więc widzi mniej niż człowiek.
- **indeksacja** — trafienie strony do bazy wyszukiwarki. `noindex` = prośba
  o pominięcie.
- **canonical** — deklaracja „to jest właściwy adres tej treści", gdy ta sama treść
  jest pod kilkoma adresami.
- **JSON-LD / schema.org** — dane o stronie w formacie dla maszyn, ukryte w kodzie.
- **GEO** (Generative Engine Optimization) — to samo co SEO, ale dla ChatGPT,
  Perplexity i Gemini: chodzi o bycie **cytowanym w odpowiedzi**, nie o pozycję.
- **encja** — byt, który wyszukiwarka rozumie jako rzecz („Bojo, aplikacja"),
  a nie jako ciąg znaków.
- **SZACUNEK** — moja ocena bez pomiaru. Przy każdej piszę, czym ją zweryfikować.

---

## PILNE — do naprawy niezależnie od reszty dokumentu

Cztery rzeczy znalezione w audycie kodu. Idą osobnym, małym PR-em; nie czekają na
decyzję o strategii.

### P1. Metadane prywatnego meczu wyciekają do wyszukiwarek

`frontend/src/app/wydarzenia/[id]/eventMeta.ts:26-33` czyta wiersz meczu **bez filtra
po `visibility`**. Z tego odczytu `generateMetadata` (`page.tsx:36-37`) składa:

- `<title>` = „«nazwa meczu» — «dzień» «godzina» | Bojo"
- `<meta name="description">` = „«sport» • «dzień», «godzina» • «nazwa boiska». Dołącz…"
- `og:title` i `og:description` = „📍 «miejsce»" (`page.tsx:47-49`)

a `opengraph-image.tsx:23-60` renderuje **publicznie dostępny obrazek** z sportem,
terminem, miejscem, liczbą wolnych miejsc i ceną — dla każdego meczu, też prywatnego.

JSON-LD jest chroniony (`lib/structuredData.ts:83` zwraca `null` dla niepublicznych)
i treść strony też (klient anon + RLS). Chroniona jest więc warstwa, o której ktoś
pomyślał, a odsłonięta ta, o której nie. Kod sam to nazywa — komentarz przy canonicalu
(`page.tsx:42-43`) mówi: *„a private one is reachable solely through its join link and
must not advertise an indexable address"*. Brak canonicala nie jest jednak instrukcją
`noindex`, a `/wydarzenia/` nie ma w `DISALLOW` w `robots.ts:9`.

Warunek wykorzystania: znajomość identyfikatora meczu. Link krąży po czatach ekipy —
wystarczy, że raz trafi na publiczne forum albo do historii przeglądarki
zsynchronizowanej z wyszukiwarką.

**Łatka** (`app/wydarzenia/[id]/page.tsx`, w `generateMetadata`):

```ts
const publiczny = ev.visibility === 'public';
if (!publiczny) {
  // Prywatny mecz: żadnych szczegółów w metadanych i żadnego wejścia do indeksu.
  // Ten sam próg, który w structuredData.ts blokuje JSON-LD.
  return { title: 'Mecz | Bojo', robots: { index: false, follow: false } };
}
```

**Łatka** (`app/wydarzenia/[id]/opengraph-image.tsx`, zaraz po `getEventMeta`):

```ts
if (!ev || ev.visibility !== 'public') {
  return new ImageResponse(<KartaOgolna />, { ...size });
}
```

**Test**, który przypina regułę tak, jak `structuredData.test.ts` przypina ją dla
JSON-LD: dla `visibility: 'private'` metadane nie zawierają nazwy obiektu ani daty,
a `robots.index === false`. Bez testu ta poprawka odejdzie przy pierwszym refaktorze —
dokładnie tak, jak odeszła przy wydzielaniu `eventMeta.ts`.

### P2. Opis 32 tysięcy stron obiektów obiecuje funkcję, której nie ma

`app/boisko/[id]/page.tsx:180`:

```
description: `${field.name}, ${field.address}. Sporty: ${sportsStr}. Znajdź nadchodzące mecze i zarezerwuj termin na Bojo.`
```

„Zarezerwuj termin" to `FEATURE_RESERVATIONS`, czyli funkcja **wyłączona**
([funkcje.md](./funkcje.md#flagi-funkcji)). Zdanie idzie do wyszukiwarek przy każdej
stronie obiektu i jest dokładnie tym, czego zabrania `content/zakazaneFrazy.ts`
(wzorzec `rezerw(uj|acj[aeę]) boisk`) — tyle że walidator sprawdza wyłącznie pliki
w `content/`, a nie metadane w `app/`. Skutek podwójny: obietnica bez pokrycia dla
człowieka i sygnał dla modeli, że Bojo jest systemem rezerwacji, czyli dokładna
odwrotność pozycjonowania z `content/miasta.ts#CZYM_BOJO_NIE_JEST`.

**Łatka**: końcówka opisu na „Zobacz nadchodzące mecze i zbierz skład na Bojo."
Docelowo (rozdział 3) całe `description` powinno pochodzić z `opisObiektu()`, żeby
metadane i widoczna treść miały jedno źródło.

### P3. Tytuł kończy się „| Bojo | Bojo"

`layout.tsx:66` ustawia `title.template = '%s | Bojo'`, a pięć plików dokłada `| Bojo`
ręcznie do stringa. Next.js nakłada szablon na wierzchu, więc tytuł brzmi
„Orlik Rataje — piłka nożna w Poznaniu | Bojo | Bojo".

Dotyczy: `app/boisko/[id]/page.tsx:168,179,189`, `app/boiska/[sport]/page.tsx:71,75,81`,
`app/boiska/woj/[wojewodztwo]/page.tsx:53,57,65`, `app/wydarzenia/[id]/page.tsx:25,36`,
`app/gracz/przejmij/[token]/page.tsx:6` — czyli praktycznie **cały indeksowalny
wolumen serwisu**.

**Łatka**: usunąć ręczny sufiks z `title` (zostawić w `openGraph.title`, bo tam szablon
się nie stosuje).

### P4. Trasy techniczne i wyłączone funkcje są otwarte dla robotów

`robots.ts:9` blokuje `/admin`, `/api`, `/profil`, `/moje-gry`, `/d/`, `/g/`. Nie
blokuje natomiast tras, które są komponentami klienckimi bez własnych metadanych —
każda zwraca tytuł strony głównej i nie ma canonicala:

| Trasa | Dlaczego nie powinna być w indeksie |
|---|---|
| `/auth/callback`, `/auth/reset` | techniczne trasy logowania |
| `/turniej*` (5), `/cykliczne*` (4), `/obiekt*` (6), `/rezerwacje` | funkcje za wyłączonymi flagami — [funkcje.md](./funkcje.md#flagi-funkcji) mówi wprost: „reklamowanie ich wyszukiwarce obiecuje coś, czego użytkownik nie znajdzie w interfejsie" |
| `/wydarzenia/nowe`, `/grupy/nowe`, `/wydarzenia/[id]/edytuj`, `/grupy/[id]/edytuj` | kreatory i formularze; `/wydarzenia/nowe` jest linkowane ze stopki i z czterech CTA landingu, więc realnie zbiera odesłania |
| `/logowanie`, `/zglos-blad` | bez wartości w wynikach |
| `/gracz/[id]` | publiczne profile z imieniem, statystykami i historią meczów, pod generycznym tytułem, bez canonicala |

**Łatka**: dopisać do `DISALLOW` w `robots.ts` (`/auth/`, `/turniej`, `/cykliczne`,
`/obiekt`, `/rezerwacje`, `/logowanie`, `/zglos-blad`) oraz dodać
`robots: { index: false, follow: true }` w metadanych `/gracz/[id]` i tras kreatorów.
Uwaga na kolejność: `robots.txt` **nie usuwa** z indeksu strony już zaindeksowanej —
jeśli GSC pokaże takie adresy, trzeba je najpierw wypuścić z `noindex`, a dopiero
potem zablokować.

**Osobna decyzja do podjęcia** (`/gracz/[id]`): profil gracza z imieniem i historią
meczów w wyszukiwarce to pytanie o prywatność, nie o SEO. Domyślnie proponuję
`noindex`; jeśli profile mają być publiczne celowo, wymaga to zgody i osobnego wątku.

---

## 0. Stan faktyczny — plan kontra kod kontra produkcja

Trzy kolumny, bo to trzy różne rzeczy i właśnie ich mylenie zrobiło dzisiejszy stan:
coś jest odhaczone w backlogu, kod istnieje, a mimo to nie działa tam, gdzie miało.

Kolumna „Produkcja" jest wszędzie oznaczona jako niezweryfikowana — nie miałem dostępu
sieciowego do `bojo.pl` (patrz „Czego nie sprawdziłem"). Sposób sprawdzenia: Załącznik B.

| Rzecz | BACKLOG | Kod | Co realnie dostaje robot | Dowód |
|---|---|---|---|---|
| Tiering indeksacji (Faza 0) | zrobione | działa | zgodnie z zamysłem | `boisko/[id]/page.tsx:187`, `sitemap-boiska/[plik]/route.ts:38` |
| Sitemapy per województwo | zrobione | działa | 16 plików + indeks | `sitemap-index.xml/route.ts:16-19` |
| Fact-dense opis obiektu (Faza 1) | zrobione | funkcja istnieje, prop przekazywany | **nic** — `VenueDetailClient` zwraca szkielet do czasu `useEffect`, więc w HTML nie ma ani `<h1>`, ani opisu | `VenueDetailClient.tsx:197`, `boisko/[id]/page.tsx:300-329` |
| Huby wojewódzkie (Faza 2b) | zrobione | strony renderują się poprawnie | **strony osierocone** — zero linków przychodzących w HTML | `VenueDetailClient.tsx:252-256` (link za bramką ładowania) |
| Huby sport+miasto (Faza 2) | zrobione | 12 stron, najgęściej zalinkowana część serwisu | działa, ale wejście tylko z `/boiska/[sport]`, zawsze na `/poznan` | `boiska/[sport]/page.tsx:210` |
| Mikro-ankiety UGC (Faza 3) | zrobione | działa | niewidoczne dla robota z tego samego powodu co opis obiektu | `AnkietyObiektu.tsx` w `VenueDetailClient` |
| JSON-LD | zrobione | działa | emitowany serwerowo, czyli **jedyna** rzecz, którą robot dostaje na stronie obiektu | `boisko/[id]/page.tsx:302-309` |
| `llms.txt`, `llm-context.md` | zrobione | pliki statyczne | serwowane, nie podpięte do żadnej trasy | `frontend/public/` |
| Crawlery AI wpuszczone z nazwy | zrobione | działa | — | `robots.ts:12-19` |

**Runda 2 (2026-08-25) — co dało się zweryfikować, a co dalej nie.** Cztery pozycje
PILNE (P1–P4) potwierdzone w kodzie z przechodzącymi testami regresyjnymi
(`eventMetadata.test.ts`, `robots.test.ts`, komentarz przy `boisko/[id]/page.tsx:193`)
i odhaczone w BACKLOG.md, gdzie wcześniej stały z pustym kwadracikiem mimo naprawy —
rozjazd opisany w D-liście poniżej dotąd szedł w jedną stronę (odhaczone-a-niedziałające),
tu poszedł w drugą (naprawione-a-nieodhaczone). `./scripts/baza-testowa.sh` (goły
Postgres + migracje + `supabase/test/rls.sql`) przeszedł w całości: 43/43 scenariusze
`seed_regresja`, wszystkie asercje RLS.

**Nowe ograniczenie środowiska, silniejsze niż brak dostępu do `bojo.pl`.** Zastępnik
zaproponowany w prompcie rundy 2 — pełny stos lokalny (`scripts/stos-lokalny.sh`,
Postgres + GoTrue + PostgREST) — wymaga obrazów Dockera. Rejestr jest zablokowany tą
samą polityką sieciową, która blokuje `bojo.pl`: `docker run hello-world` kończy się
`403 Forbidden` z `production.cloudfront.docker.com`, potwierdzone też w statusie
proxy agenta (`connect_rejected`, „gateway answered 403 to CONNECT"). Skutek: `node
scripts/audyt-robota.mjs` dało się uruchomić tylko w trybie `--bez-bazy` — przeszedł
(`/`, `/jak-dziala-bojo`, `/dlaczego-bojo`, `/faq`, `/kalkulator-kosztow-boiska`,
`/wydarzenia`, `/grupy`, `/boiska/pilka-nozna`, `/boiska/woj/wielkopolskie`,
`/pilka-nozna/poznan`, `/wydarzenia/[id]`), ale **strona obiektu — ta, dla której
skrypt w ogóle powstał — została pominięta**, bo bez PostgREST nie ma skąd wziąć
realnego sluga. To samo dotyczy `/boiska/[sport]/[miasto]`, który bez bazy zwraca 404.
Rozdział 0 pozostaje więc bez zmiany w tym jednym punkcie: **co realnie dostaje robot
na stronie obiektu i na hubach miejskich jest nadal NIEZWERYFIKOWANE** — potrzeba do
tego środowiska z dostępem do rejestru obrazów albo przebiegu przeciwko produkcji
(Załącznik B).

**Runda 3 (2026-08-26) — trzecia próba dotarcia do produkcji, trzeci wynik negatywny.**
Sprawdzone na starcie, w tej kolejności, z wklejonym wynikiem:

```
curl -sS -o /dev/null -w "%{http_code}" https://bojo.pl/robots.txt
  → curl: (56) CONNECT tunnel failed, response 403
  → 000

docker run --rm hello-world
  → failed to connect to the docker API at unix:///var/run/docker.sock:
    dial unix /var/run/docker.sock: connect: no such file or directory
```

Status proxy agenta potwierdza pierwszą blokadę wprost:
`{"kind":"connect_rejected","detail":"gateway answered 403 to CONNECT","host":"bojo.pl:443"}`.
Druga blokada jest **mocniejsza niż w rundzie 2**: wtedy demon Dockera działał, a odpadał
sam rejestr obrazów; teraz nie ma demona w ogóle, więc `scripts/stos-lokalny.sh` nie ma
się o co oprzeć. Tryb rundy 3 to zatem **TRYB OKROJONY**:

- `./scripts/baza-testowa.sh` — **przeszedł** (goły Postgres 16 z systemu, migracje od
  zera, `supabase/test/rls.sql` w całości, 16 kont / 44 mecze / 162 uczestników).
- `node scripts/audyt-robota.mjs --bez-bazy` przeciwko lokalnemu buildowi produkcyjnemu
  — **przeszedł**: 13 tras OK, `/boiska/pilka-nozna/poznan` pominięte (404 bez bazy),
  strona obiektu pominięta (brak realnego sluga).

Sprawdzona i **odpadła też trzecia droga**, na którą łatwo wpaść: adres podglądu
Vercela z PR-a (`bojo-app-git-<gałąź>-….vercel.app`) kusi, bo deploy podglądowy ma
prawdziwe klucze Supabase, a więc i prawdziwy katalog obiektów. Ta sama polityka
blokuje go tak samo jak domenę produkcyjną:
`curl … .vercel.app/robots.txt` → `CONNECT tunnel failed, response 403`.
Zapisane wprost, żeby runda 4 nie szukała tam po raz drugi.

**Wniosek bez zmian od rundy 1: strona obiektu i huby miejskie — czyli praktycznie cały
indeksowalny wolumen — są NIEZWERYFIKOWANE.** Wszystko, co o nich wiemy, wiemy z lektury
kodu. Trzy rundy z rzędu, trzy różne powody, ten sam brak. To przestaje być pechem
środowiska, a zaczyna być stanem, który ktoś musi rozstrzygnąć decyzją: jedno wejście
`curl https://bojo.pl/boisko/<slug>` z dowolnej maszyny z internetem zamyka pytanie,
na które ten dokument nie umie odpowiedzieć od trzech rund.

**Sprostowanie 2026-08-27 — diagnoza „nie ma demona" z rundy 3 była za szeroka.**
Sprawdzone w kolejnej sesji tego samego dnia po rundzie 3: `docker version` pokazuje
klienta, `dockerd` jest zainstalowany, a `systemctl status docker` odpowiada „System
has not been booted with systemd" — środowisko po prostu nie startuje demona
automatycznie, nie usuwa go z obrazu. Ręczne `dockerd &` (sesja ma `root`, cgroup v1
działa) podnosi demon bez błędu: `API listen on /var/run/docker.sock`. Dopiero wtedy
`docker run --rm hello-world` dochodzi do pobrania manifestu i pada na tej samej
warstwie co w rundzie 2 — `403 Forbidden` z `production.cloudfront.docker.com`,
potwierdzone też w statusie proxy (`connect_rejected`, `policy denial`, host
`production.cloudfront.docker.com:443`).

**Skutek dla wniosku, nie dla stanu:** `scripts/stos-lokalny.sh` nadal nie działa —
opiera się na `supabase start`, którego CLI w tej sesji nie ma zainstalowanego,
a które i tak ściągnęłoby własny zestaw obrazów (Postgres, GoTrue, PostgREST) z tego
samego zablokowanego rejestru. Ale przyczyna jest węższa, niż rozdział 0 rundy 3
sugerował: blokada leży **wyłącznie w polityce sieciowej wobec rejestru obrazów**,
nie w niedostępności demona. Rozróżnienie ma znaczenie dla następnej sesji: nie warto
sprawdzać `docker version`/`systemctl` i poprzestawać na tym — demon prawie na pewno
da się podnieść ręcznie, a przebieg i tak skończy się na tym samym `403` przy pierwszym
pociągnięciu obrazu. Test, który faktycznie rozstrzyga sprawę, to `docker run --rm
hello-world` po ręcznym starcie demona, nie sam status demona.

**Domknięcie 2026-08-27, ta sama sesja — CLI zainstalowane, `supabase start` puszczony
naprawdę, blokada szersza niż zakładano.** `npm install supabase` przechodzi bez
przeszkód (rejestr npm jest poza polityką blokującą), CLI startuje (`2.116.0`). Po
ręcznym starcie demona `supabase start` na tym repo próbuje ściągnąć siedem obrazów —
i **żaden nie przechodzi**:

| Obraz | Rejestr | Wynik |
|---|---|---|
| `supabase/postgres:15.8.1.085` | Docker Hub | `403 Forbidden` |
| `postgrest/postgrest:v16.1` | Docker Hub | `403 Forbidden` |
| `supabase/gotrue:v2.196.0` | Docker Hub | `403 Forbidden` |
| `library/kong:2.8.1` | Docker Hub | `403 Forbidden` |
| `supabase/storage-api:v1.70.3` | GHCR | `403 Forbidden` |
| `supabase/realtime:v2.129.3` | GHCR | `403 Forbidden` |
| `supabase/edge-runtime:v1.74.3` | GHCR | `403 Forbidden` |

Nowy fakt wobec akapitu wyżej: blokada **nie jest wyłącznie Docker Huba**
(`production.cloudfront.docker.com`). Cztery z siedmiu obrazów Supabase idą z GitHub
Container Registry, którego blob CDN (`pkg-containers.githubusercontent.com`) zwraca
ten sam `403 Forbidden`. Dwa różne rejestry, dwa różne CDN-y, jedna polityka — pełna
blokada, zero udanych ściągnięć. `supabase stop` posprzątał czysto (`docker ps -a`
puste), demon zgaszony.

**Wniosek nie zmienia się co do stanu** (`stos-lokalny.sh` nadal niedostępny), ale
zamyka pytanie, które akapit wyżej zostawiał otwarte: nie ma sensu instalować CLI po
raz drugi w kolejnej rundzie licząc, że któryś z dwóch rejestrów akurat przepuści —
oba są zablokowane tą samą polityką, sprawdzone wprost, nie przez analogię.

Co udało się zweryfikować w rundzie 3 **twardo, w surowym HTML** (lokalny build
produkcyjny, `curl` bez JavaScriptu — czyli tak, jak widzi to crawler):

| Co | Wynik |
|---|---|
| `Organization` niesie `alternateName` i `disambiguatingDescription` | `"alternateName":["Bojo.pl","aplikacja Bojo"]` na `/` |
| `sameAs` nie zostało dopisane na zapas | zero wystąpień na stronie |
| Hub sportu linkuje do wszystkich miast, nie tylko Poznania | `/pilka-nozna/{poznan,warszawa,krakow}` w HTML |
| Wszystkie 12 landingów sport+miasto istnieje | 12 × HTTP 200 |
| Liczba tabel w bazie | **53** (schemat postawiony od zera przez `baza-testowa.sh`), nie 45 jak deklarował znacznik w `llm-context.md` |
| Liczba testów | **827** (`npm test`), nie 775 jak deklarował ten sam znacznik |

**Znalezione przy okazji rundy 3, poza zakresem SEO/GEO: regresja wizualna nie
pilnuje dziś niczego.** Nie jest to dług SEO i nie wchodzi do listy `D*` niżej, ale
dotyka narzędzia, na którym opiera się przegląd każdej zmiany widoku — więc zostaje
zapisane tutaj, żeby nie zginęło.

- **Wzorce nie były aktualizowane od PR #217**, a repozytorium jest na #281 —
  sześćdziesiąt kilka PR-ów bez odświeżenia (`git log -- frontend/e2e/wzorce/`).
- **Sześć tras z listy `TRASY` nie ma wzorca w repo w ogóle**: `trasa-rozmowy`,
  `trasa-rozmowa-ekipy`, `trasa-rozmowa-meczu`, `trasa-rozmowa-prywatna`
  (rozmowy prywatne, migracja `125`), `trasa-sport-miasto-poznan`,
  `trasa-sport-miasto-warszawa`. Sprawdzone `git ls-files` — to brak pliku,
  nie różnica renderowania, więc CI nie ma ich z czym porównać w żadnym
  środowisku. Te widoki **nigdy nie zostały obejrzane**.
- **Raport z bota jest dziś nieodróżnialny od szumu.** PR #280 nie zmienia ani
  jednego piksela (JSON-LD i dwa nagłówki w Markdownie), a dostał **dokładnie ten
  sam** raport co #281, który zmienia układ linków: „zmienione: 11, nowe: 5"
  (scenariusze) i „zmienione: 17, nowe: 12" (widoki publiczne). Skoro no-op i realna
  zmiana wyglądają identycznie, raport nie niesie informacji.

Skutek, który trzeba nazwać: mechanizm opisany w AGENTS.md („zmiana widoku pokazuje
się w PR-ze jako różnica obrazków, do przejrzenia") **nie działa** — nie dlatego, że
jest źle zbudowany, tylko dlatego, że nikt nie nadał etykiety `zrzuty:zaakceptuj`
od #217. Następna prawdziwa regresja wizualna utonie w dwudziestu dziewięciu
obrazkach, których nikt nie przegląda.

**Czego świadomie NIE zrobiłem:** nie przyjąłem wzorców za właściciela. AGENTS.md
mówi wprost, że wzorce wchodzą do repo dopiero po etykiecie, bo pierwszy zrzut widoku
staje się wzorcem na zawsze i to jego warto obejrzeć. Lokalny przebieg
`npm run zrzuty` dopisał brakujące pliki — usunąłem je, wzorce w repo są nietknięte.
**Zaakceptowane 2026-08-27** — właściciel poprosił wprost o etykietę i odświeżenie.
Osobny PR z jednym `zrzuty:zaakceptuj`, bez zmian w kodzie: `.github/dopisz-wzorce.sh`
puścił `zrzuty:akceptuj` i `scenariusze:akceptuj` przeciwko CI (nie lokalnemu
kontenerowi — patrz NIEZWERYFIKOWANE niżej) i odesłał nowe wzorce na gałąź PR-a.
Sześć brakujących plików dostało pierwszy wzorzec; reszta wróciła do zgodności
z masterem po pięciu kolejnych PR-ach zmergowanych między rundą 3 a tym PR-em
(#283–#286 — pinezki mapy, pusta lista obiektów, domyślny widok „Szukaj", kadr
mapy meczów). Diff wzorców obejrzany przed mergem — pełny opis w PR-ze.

**NIEZWERYFIKOWANE:** lokalny `npm run zrzuty` pokazał 42 różnice na 131 zrzutów, ale
tej liczby **nie wolno czytać jako stanu mastera** — renderowanie czcionek w tym
kontenerze różni się od CI (CI podało 17 zmienionych tam, gdzie lokalnie wyszło ~36).
Przenośne są wyłącznie dwie rzeczy wyżej: brak sześciu plików i identyczny raport
na no-opie.

### DŁUG — rzeczy zepsute albo niespójne

Ponumerowane, bo wracają w roadmapie w rozdziale 9.

- **D1.** Wyciek metadanych prywatnego meczu → P1.
- **D2.** „Zarezerwuj termin" w opisie 32 tys. stron → P2.
- **D3.** Podwójny sufiks w tytułach → P3.
- **D4.** Trasy techniczne i za flagami otwarte dla robotów → P4.
- **D5.** ~~**Strona obiektu jest pusta dla robota.**~~ **(naprawione 2026-08-23: nagłówek, opis i adres renderują się serwerowo, także w stanie ładowania.)** Stan sprzed poprawki: `page.tsx` nie renderuje własnego
  `<h1>` ani `opis`; oba trafiają wyłącznie do `VenueDetailClient`, który do czasu
  `useEffect` zwraca szkielet. Jedyny serwerowy fragment treści to ukryty `<div>`
  z `itemProp` (`page.tsx:311-318`), i to **tylko gdy obiekt ma nadchodzące mecze** —
  czyli dla garstki obiektów.
- **D6.** ~~**Strona obiektu nie ma ani jednego linku wychodzącego**~~ **(naprawione 2026-08-23: widoczna nawigacja do huba województwa, huba sportu i `/jak-dziala-bojo`, plus stopka.)** Stan sprzed poprawki: brak linków w HTML, przy
  zadeklarowanym `follow: true` (`page.tsx:187`). Robot nie ma po czym pójść dalej,
  więc hierarchia kończy się na wejściu z sitemapy.
- **D7.** ~~**Huby wojewódzkie osierocone**~~ **(naprawione 2026-08-23 przez nawigację na stronie obiektu — komentarz w kodzie mówi wreszcie prawdę.)** Stan sprzed poprawki: 0 linków przychodzących, a komentarz
  w kodzie twierdzi, że link jest „widoczny, żeby crawler mógł go realnie przejść".
  Komentarz opisuje intencję, nie stan.
- **D8.** **Częściowo naprawione 2026-08-23** — grupa „Boiska" w stopce daje sześć
  hubów sportowych z każdej strony ze stopką. Zostaje zahardkodowany Poznań w linku
  z hubu sportu. Stan sprzed poprawki: **`/boiska/[sport]` i `/[sport]/[miasto]` to
  zamknięta pętla bez drzwi** —
  żadnego wejścia ze strony głównej, nagłówka ani stopki. Do tego link z hubu sportu
  prowadzi zawsze do Poznania, więc osiem kombinacji z Warszawą i Krakowem nie ma
  wejścia spoza własnego rodzeństwa.
- **D9.** ~~**Stopka jest tylko na czterech typach stron**~~ **(naprawione 2026-08-23:
  doszła na huby katalogu oraz `/wydarzenia` i `/grupy`; `/mapa` świadomie bez niej —
  `h-[100dvh] overflow-hidden` by ją przyciął).** Stan sprzed poprawki: (`app/page.tsx`,
  `/[sport]/[miasto]`, `/profil`, strony treści przez `StronaTresci`). Huby boisk,
  strona obiektu, `/mapa`, `/wydarzenia` i `/grupy` nie mają jej wcale — a stopka jest
  jedynym miejscem w serwisie z linkami do `/jak-dziala-bojo`, `/dlaczego-bojo` i `/faq`.
- **D10.** ~~**Sitemap zgłasza trzy puste strony z wysokim priorytetem**: `/mapa` (0.8),
  `/wydarzenia` (0.8), `/grupy` (0.6). Wszystkie trzy renderują się po stronie klienta
  albo mają `ssr: false`, więc robot dostaje nagłówek i napis o ładowaniu.~~ **(naprawione
  2026-08-25, runda 2: priorytety obniżone poniżej stron treści — `/mapa` 0.3,
  `/wydarzenia` 0.5, `/grupy` 0.4. Test: `sitemapPriorytety.test.ts`.)**
- **D11.** ~~**Huby listują obiekty `noindex`** — do 60 linków i 60 pozycji `ItemList`
  na stronę, bez filtra po `seo_tier` (`boiska/[sport]/page.tsx:98-104`,
  `boiska/woj/[wojewodztwo]/page.tsx:81-87`). Budżet skanowania, którego broni tiering,
  wydają własne huby.~~ **(naprawione 2026-08-25, runda 2: `.in('seo_tier', [1, 2])`
  dołożony w obu zapytaniach, wydzielonych do `lib/hubKatalogu.ts#obiektyHubuSportu`/
  `obiektyHubuWojewodztwa` — testowalne bez renderowania JSX. Test:
  `hubKatalogu.test.ts`.)**
- **D12.** ~~**`.neq('seo_tier', 3)` gubi wiersze `NULL`**~~ **(naprawione 2026-08-24,
  i uzasadnienie okazało się mocniejsze, niż tu napisano: `fields.seo_tier` jest
  `SMALLINT NOT NULL` z `CHECK IN (1, 2, 3)`, migracja `112` — `NULL` jest niemożliwy
  na poziomie bazy, nie tylko przefiltrowany tym zapytaniem. `.in('seo_tier', [1, 2])`
  i sygnatura `priorytetDlaTier(tier: 1 | 2)` mówią to wprost zamiast przez domysł.)**
  Stan sprzed poprawki: w SQL `NULL <> 3` daje `NULL`, nie `TRUE`. Efekt netto był
  poprawny (bo `page.tsx:40` mapuje `NULL → 3`), ale gałąź `NULL` w
  `lib/sitemapTier.ts:13` była nieosiągalna, a test `sitemapBoiska.test.ts:17-19`
  sprawdzał scenariusz, który nie mógł zajść.
- **D13.** ~~**Liczba obiektów rozjeżdża się między powierzchniami.**~~ **(naprawione
  2026-08-24: dwa komentarze w kodzie ze sztywną liczbą „32 684" — już nieaktualną,
  katalog urósł do 36 268 — zastąpione tą samą frazą „ponad 30 000" co w treści
  widocznej dla użytkownika. Datowany zapis w BACKLOG zostaje jako historia, nie
  konkuruje z liczbą bieżącą.)** Stan sprzed poprawki: `content/dlaczego.ts:86`
  i `llms.txt` mówiły „ponad 30 000", dwa komentarze w kodzie sztywne „32 684",
  BACKLOG 36 268 (3 605 Tier 1, 28 491 Tier 2, 4 172 Tier 3), a `llm-context.md`
  nie podawał liczby wcale.
- **D14.** ~~`/boiska/inne` istnieje, jest indeksowalne i linkowane z breadcrumbów
  obiektu, ale nie ma go w `sitemap.ts`~~ **SPROSTOWANIE (runda 2, 2026-08-25):
  nie jest to przeoczenie.** `lib/sports.ts` mówi to dziś wprost w komentarzu przy
  `HUBY_KATALOGU_SPORTOWYCH` (decyzja z 2026-08-24): „«Inne» celowo poza tą listą —
  to kosz na sporty bez własnej kategorii, nie sport, do którego ktoś szuka huba po
  nazwie". Strona `/boiska/inne` dalej istnieje i dalej się renderuje (dostępna
  z filtra na mapie i z breadcrumbów obiektu), po prostu świadomie nie dostaje
  własnego wejścia w sitemapie ani w linkowaniu poziomym hubów — tak jak katalog
  produktowy nie robi kategorii „Inne" głównym punktem nawigacji. Kod zostaje
  bez zmian.
- **D15.** ~~**Paginacja hubów bez ograniczeń** — `?strona=N` z self-referencing
  canonicalem, bez `noindex`, przy `force-dynamic` i katalogu 32 tys. wierszy.~~
  **(naprawione 2026-08-25, runda 2: strony 2+ dostają `robots: {index: false,
  follow: true}` — canonical zostaje self-referencing, bo każda strona ma inny
  zestaw obiektów. Wydzielone do `lib/hubKatalogu.ts#metadanePaginacjiHuba()`.
  Test: `hubKatalogu.test.ts`.)**
- **D16.** `/gracze` przekierowuje kodem 307 (tymczasowym), a redirect z `/graj/:sport/:miasto`
  to 308, nie 301. Funkcjonalnie równoważne dla Google, ale jeśli gdzieś zapisano „301",
  to nieprawda.
- **D17.** ~~**Martwy OG.** `app/opengraph-image.tsx` (konwencja plikowa) ma pierwszeństwo
  przed `metadata.openGraph.images` z `layout.tsx:77`, więc `poznan-satellite.jpg`
  (215 KB w `public/`) prawdopodobnie nie jest nigdy serwowany. Dwa sprzeczne źródła
  obrazka podglądu.~~ **(naprawione 2026-08-25, runda 2: potwierdzone, że obrazek
  był rzeczywiście martwy — usunięty z `layout.tsx` razem z plikiem w `public/`.
  Jeden generator obrazka OG zostaje: `app/opengraph-image.tsx` jako domyślny,
  `wydarzenia/[id]/opengraph-image.tsx` jako bardziej szczegółowy dla meczów.
  Przy okazji odpowiedź na pytanie z Partii 1: zdjęcie satelitarne Poznania nie
  było właściwym podglądem dla obiektu w Gdańsku ani dla kalkulatora — i tak nigdy
  się nie renderowało, więc pytanie o trafność jest dziś bezprzedmiotowe. Test:
  `ogImageJednoZrodlo.test.ts`.)**
- **D18.** ~~**Jedyny „żywy" dowód aktywności nie istnieje dla robota.**~~ **(naprawione
  2026-08-24: oba komponenty są dziś komponentami serwerowymi, zweryfikowane na atrapie
  PostgREST-a — landing oddaje w HTML link do realnego meczu i realnego obiektu.)**
  Stan sprzed poprawki: `LandingOpenGames` był komponentem klienckim i zwracał `null`,
  gdy otwartych gier nie było — a `LandingVenues` tak samo. W pierwszej odpowiedzi
  serwera strona główna nie zawierała ani jednego linku do meczu ani do obiektu.

---

## 1. Kto pyta i dlaczego — sześć sytuacji

Nie persony, tylko momenty. Przy każdej: co człowiek wpisuje, o co pyta model, i czy
Bojo ma prawo się w odpowiedzi pojawić. Dwie sytuacje wykreśliłem — to ważniejsze niż
te, które zostały.

### S1. Czwartek 21:30, dwóch odpadło na jutro

Organizator ma opłacone boisko na piątek 19:00 i skład 10 z 12. Wpisuje: *„szukam
graczy piłka nożna Poznań jutro"*, *„brakuje 2 osób do składu"*. Pyta model: *„gdzie
szybko znaleźć dwóch graczy na jutrzejszy mecz w Poznaniu?"*

Dziś dostaje: grupy na Facebooku. **Bojo ma prawo się pojawić — jako narzędzie, nie
jako rynek.** Uczciwa odpowiedź brzmi: „wystaw mecz publicznie i wklej link tam, gdzie
Twoi ludzie już są". Obietnica „znajdziemy Ci graczy" byłaby dziś kłamstwem: przy
zerowej płynności publiczny mecz to dodatkowa szansa, nie mechanizm. Tak też mówi
`content/graj.ts#GRAJ_BRAK_MECZY` i to jest właściwy ton.

### S2. Niedziela wieczór, organizator liczy „+1" w komentarzach

Prowadzi gierkę co tydzień od dwóch lat. Wpisuje: *„jak zapisywać ludzi na mecz"*,
*„aplikacja do organizowania gierek"*, *„lista obecności na mecz online"*, *„jak
ogarnąć zapisy na piłkę"*. Pyta model: *„czym zastąpić ankietę na WhatsAppie do
zapisów na cotygodniową gierkę?"*

**To jest sytuacja Bojo.** Produkt rozwiązuje ją w całości i bez zależności od
płynności: licznik miejsc, twardy limit, rezerwa z kolejnością, „Obserwuję" jako
odróżnialne „może wpadnę". Zero konieczności zakładania konta przez graczy jest tu
argumentem rozstrzygającym, bo najczęstszy sprzeciw brzmi „moi ludzie nie założą
kolejnej apki". Cały rozdział 3 jest podporządkowany tej sytuacji.

### S3. Poniedziałek, kto komu został winien 23 zł

Po meczu zostaje rozliczenie. Wpisuje: *„jak podzielić koszt boiska na graczy"*,
*„kalkulator kosztów wynajmu boiska"*, *„ile od osoby za halę"*, *„jak rozliczyć mecz
ze znajomymi"*. Pyta model: *„jak sprawiedliwie podzielić 280 zł za halę między
14 osób, gdy część ma karty sportowe?"*

**Sytuacja Bojo, i to najsłabiej obsadzona przez kogokolwiek.** Zniżki z kart
Multisport, FitProfit i Medicover Sport to polska specyfika, której zagraniczne
narzędzia nie mają, a polskie konkurencyjne aplikacje (rozdział „Tło konkurencyjne")
raczej liczą składki niż uwzględniają karty. Wymaga jednak strony, której dziś nie ma —
patrz rozdział 4, propozycja kalkulatora.

### S4. Wtorek, ktoś nowy w mieście

Wpisuje: *„gdzie pograć w siatkówkę Poznań"*, *„szukam ekipy do gry w kosza Warszawa"*.
Pyta model: *„przeprowadziłem się do Poznania, gdzie znaleźć ludzi do grania
w siatkówkę?"*

**Bojo ma tu stronę (`/[sport]/[miasto]`), ale nie ma czym wygrać.** Odpowiedzią są
istniejące społeczności: grupy na Facebooku, aplikacje z realną płynnością, uczelniane
sekcje. Strona zostaje, bo jest tania w utrzymaniu i uczciwie opisuje, czym Bojo jest —
ale **nie inwestujemy w ten klaster**, dopóki nie ma meczów do pokazania. Inwestowanie
teraz to obiecywanie ruchu, którego nie dostarczymy, i najkrótsza droga do tego, żeby
model zacytował nas raz, a użytkownik odbił się od pustej listy.

### S5. Sobota rano, gdzie tu jest boisko

Wpisuje: *„orlik w pobliżu"*, *„boisko do siatkówki plażowej Poznań"*, *„boiska ze
sztuczną nawierzchnią «dzielnica»"*. Pyta model: *„gdzie w «mieście» jest boisko do
koszykówki z oświetleniem?"*

**Zapytanie zajęte, i to przez kogoś z przewagą wieku.** Katalog Bojo jest większy
(36 268 wierszy wobec ~20 tys. deklarowanych przez boiskawpolsce.pl), ale liczba
wierszy nie jest przewagą — przewagą jest odpowiedź na pytanie, którego tamci nie mają:
*czy tu się realnie gra i czy to oświetlenie na pewno działa*. To jedyna droga do tego
klastra i jest opisana w rozdziale 8 jako fosa. Dziś, przy pustych stronach obiektu
(D5), nie mamy nawet stawki w tej grze.

### S6. Ktokolwiek, pytający modelu zamiast wyszukiwarki

*„Jaka jest najlepsza aplikacja do organizowania amatorskich meczów w Polsce?"*,
*„czy jest coś polskiego zamiast Spond do gierek?"*

**Sytuacja rozstrzygająca dla GEO i jedyna, w której Bojo może wygrać bez płynności** —
bo model porównuje opisy, nie liczbę użytkowników. Wygrywa się tu gęstością faktów,
jednoznacznym określeniem, czym produkt NIE jest, i obecnością marki w źródłach spoza
własnej domeny. Rozdziały 5 i 6.

### Wykreślone

- **„Jak wynająć orlik / rezerwacja boiska «miasto»"** — Bojo nie wnosi nic.
  `FEATURE_RESERVATIONS` jest wyłączona, a `content/miasta.ts#CZYM_BOJO_NIE_JEST`
  mówi to wprost. Każda treść celująca w to zapytanie jest obietnicą bez pokrycia
  (i dokładnie ten błąd popełnia dziś opis 32 tys. stron obiektów — D2).
- **„Statystyki / ranking amatorski / poziom zaawansowania"** — nie istnieje
  ([funkcje.md](./funkcje.md), sekcja „Czego NIE ma"), a `content/zakazaneFrazy.ts`
  zakazuje o tym pisać twierdząco. Wizja mówi o „Stravie dla amatorskich gier", ale
  wizja to kierunek, nie stan — treść opisuje stan.

---

## 2. Mapa popytu

Dwie warstwy, bo rządzą się innymi prawami: w Google wygrywa się pozycją, w modelach —
byciem cytowanym. Te same słowa, inne mechanizmy.

**Zastrzeżenie do wszystkich liczb w tym rozdziale:** nie miałem narzędzia do wolumenów
ani dostępu do Search Console, a wyszukiwarka dostępna w sesji zwraca wyniki dla rynku
amerykańskiego. Każda ocena wielkości i trudności jest **SZACUNKIEM** na podstawie
struktury zapytania i tego, kto odpowiada w wynikach ogólnych. Weryfikacja: Załącznik B,
punkty 4–6.

### 2a. Klastry klasyczne

| Klaster | Przykłady fraz | Wielkość (SZACUNEK) | Trudność | Kto dziś odpowiada | Strona Bojo |
|---|---|---|---|---|---|
| **Narzędzie organizatora** | „aplikacja do organizowania meczów", „jak zapisywać ludzi na mecz", „lista zapisów na gierkę" | mała, ale najwyższa intencja | średnia | konkurencyjne aplikacje, poradniki ogólne | `/jak-dziala-bojo` (główna) + `/` |
| **Zamiast czatu** | „alternatywa dla grupy na whatsappie", „jak ogarnąć gierkę bez chaosu na messengerze" | mała | **niska** | praktycznie nikt celowo | `/dlaczego-bojo` |
| **Rozliczenie** | „jak podzielić koszt boiska", „kalkulator wynajmu hali na osobę", „ile od osoby za orlik" | średnia | **niska** | kalkulatory ogólne, fora | **brak — do zbudowania** (4a) |
| **Karty sportowe** | „multisport na orlik", „czy multisport działa na wynajem boiska" | średnia | średnia | operatorzy kart, obiekty | sekcja na stronie kalkulatora |
| **Problem składu** | „brakuje graczy na mecz", „co zrobić jak ekipa odwołuje" | mała | niska | fora, grupy | sekcja `brakuje-graczy` w `/jak-dziala-bojo` |
| **Lokalne: gra** | „szukam graczy «sport» «miasto»" | średnia | **wysoka** | Facebook, aplikacje z płynnością | `/[sport]/[miasto]` — utrzymanie, nie inwestycja |
| **Lokalne: obiekt** | „boiska «sport» «miasto»", „orlik w pobliżu" | **duża** | **wysoka** | boiskawpolsce.pl, orlik2012.pl, strony MOSiR, mapy | `/boiska/*`, `/boisko/[id]` — wyłącznie z fosą z rozdz. 8 |
| **Markowe** | „bojo", „bojo.pl", „aplikacja bojo" | znikoma | **nierozstrzygalna dla samego „bojo"** | słowniki slangu | patrz 2c |

### 2b. Kanibalizacje, które już istnieją

Trzy typy stron mówią dziś częściowo o tym samym i nic w kodzie nie rozdziela ich
intencji:

- `/boiska/[sport]` (kraj) kontra `/boiska/woj/[x]` (region) — pierwsza to lista
  wszystkich obiektów danego sportu w Polsce, druga wszystkich obiektów w województwie.
  Dla zapytania „boiska do koszykówki w mazowieckiem" obie są częściowo trafne i żadna
  celnie. **Brakującą warstwą jest sport × województwo i sport × miasto**, i to ona
  powinna powstać zamiast dokładania kolejnych miast do `/[sport]/[miasto]` (4a).
- `/[sport]/[miasto]` celuje w intencję „chcę zagrać", a `/boiska/*` w „gdzie jest
  boisko". To rozróżnienie jest poprawne i warte utrzymania — ale linki wewnętrzne je
  zacierają, bo jedyne przejście między klastrami prowadzi z hubu sportu do Poznania
  (D8), niezależnie od tego, czego dotyczyła strona.
- Paginacja (`?strona=N`) z self-referencing canonicalem tworzy setki adresów
  konkurujących z pierwszą stroną hubu o tę samą frazę (D15).

### 2c. Problem, którego nie da się obejść: nazwa

**„Bojo" to w polszczyźnie potocznej słowo znaczące „boisko"** — udokumentowane
w słownikach slangu i w Wikisłowniku, z przykładem użycia „lecę na bojo pograć w piłkę".
Do tego angielska Wikipedia ma hasło „Bojo" o czymś zupełnie innym.

Konsekwencje, których żadna optymalizacja treści nie zniesie:

1. Zapytanie „co to jest bojo" **zawsze** zwróci definicję słownikową. Nie walczymy o nie.
2. Model odpowiadający o marce musi mieć sygnał, że chodzi o **aplikację**, nie o słowo.
   Stąd zasada dla całej treści i wszystkich profili: encja nazywa się **„Bojo (bojo.pl)"**
   albo **„aplikacja Bojo"**, nigdy samo „Bojo" w pierwszym wystąpieniu w sekcji.
   `llm-context.md` już to robi dobrze; `llms.txt` częściowo.
3. W danych strukturalnych trzeba to powiedzieć maszynom wprost — `alternateName`
   i `disambiguatingDescription` (rozdział 5).

Jest i druga strona: nazwa jest semantycznie **natywna** dla dziedziny. Gdy marka już
zaistnieje, „bojo" i „boisko" wzmacniają się nawzajem. Problemem jest wyłącznie okres,
w którym marka jest nieznana — czyli teraz.

### 2d. Warstwa GEO — zestaw pomiarowy

Czterdzieści promptów po polsku, w czterech koszykach, w **Załączniku A**. Zestaw jest
celowo stały: sens ma wyłącznie porównanie tej samej listy w czasie. Zmiana pytania
w połowie pomiaru kasuje historię.

Wartość bazowa: **niezmierzona** (brak dostępu do modeli z tej sesji). Jedyne, co udało
się ustalić, to że wyszukiwanie ograniczone do domeny `bojo.pl` nie zwróciło żadnego
wyniku — co jest słabą przesłanką, nie dowodem, bo to nie był indeks Google i nie był
to rynek polski. Pomiar bazowy jest **pierwszą pozycją roadmapy**, przed jakąkolwiek
optymalizacją: bez niego za trzy miesiące nie odróżnimy poprawy od wrażenia poprawy.

---

## 3. Audyt istniejących stron z gotowym copy

Kryterium jest jedno i wynika z tego, jak modele wybierają, co zacytować: **czy fragment
wyrwany z kontekstu strony nadal odpowiada na pytanie i nadal nazywa Bojo po imieniu.**
Wszystkie proponowane teksty są gotowe do wklejenia — po polsku, bez języka
marketingowego, bez liczb, których nie da się dziś obronić.

Reguła przy każdej zmianie: copy stron treści żyje w `frontend/src/content/*.ts`
i jest testowane (`tresciStron.test.ts`, `landingContent.test.ts`). Nowy tekst wchodzi
tam, nie do JSX.

### 3a. `/` — strona główna

**Stan:** H1 „Zorganizuj mecz / w dwie minuty", lead „Stwórz grę i wyślij ekipie jeden
link…". Sekcje: hero → statystyki → trzy kroki → otwarte gry → wartości → boiska → FAQ.
`faqJsonLd(LANDING_FAQ)` z ośmioma pytaniami, pokrytymi widocznym tekstem. Stopka jest.

**Co jest nie tak dla modelu:** cała górna część strony nie zawiera **ani razu słowa
„Bojo"** w zdaniu, które mówi, czym to jest. Model cytujący pierwszy ekran dostaje
bezpodmiotowe polecenie „Zorganizuj mecz w dwie minuty" — przy nazwie kolidującej ze
słowem pospolitym (2c) to najgorszy możliwy start. Do tego trzy statystyki
(`LANDING_STATS`) to statyczne literały, a dwie sekcje mające dowodzić, że coś się
dzieje (otwarte gry, boiska), nie istnieją w HTML dla robota (D18).

**Nagłówek:** zostaje. Landing ma sprzedawać, a nie recytować definicję.

**Do dodania — akapit bezpośredniej odpowiedzi**, renderowany serwerowo pod hero,
przed statystykami (nowa stała w `components/home/landing/content.ts`):

> Bojo to darmowa aplikacja webowa do organizowania amatorskich meczów. Zakładasz grę —
> sport, boisko z mapy, termin i liczba miejsc — i wysyłasz jeden link tam, gdzie Twoja
> ekipa już rozmawia. Osoba z linkiem zapisuje się bez zakładania konta, podając imię
> i e-mail. Bojo liczy zajęte miejsca, prowadzi listę rezerwową z widoczną kolejnością
> i dzieli koszt wynajmu obiektu na graczy.

Sześćdziesiąt słów, cztery fakty, nazwa encji na początku. To jest fragment, który
model ma zacytować, gdy ktoś zapyta „czym jest Bojo". **ZROBIONE 2026-08-24**
(`LandingDirectAnswer.tsx`, poz. 10 roadmapy) — sprawdzone ponownie w Partii 2 rundy 2:
sekcja renderuje się serwerowo między hero a statystykami, dokładnie tym tekstem, i przy
okazji rozwiązuje dwa problemy naraz — „czym jest Bojo" (S6) i pierwsze wystąpienie
nazwy w kontekście jednoznacznie identyfikującym aplikację, nie słowo potoczne (2c).
Osobnej zmiany pod dezambiguację w warstwie treści nie trzeba było dokładać.

**Statystyki:** sprawdzone ponownie w Partii 2 rundy 2 — werdykt się nie zmienił, kod
mu odpowiada. albo liczone z bazy, albo z datą przy liczbie. Dziś `sportsValue: '4'`
i `priceValue: '0 zł'` są prawdziwe i bezterminowe — mogą zostać. `timeValue: '2 min'`
to obietnica, nie pomiar; zostawiam, ale nie dokładam do niej kolejnych. **Nie
proponuję dopisywania liczby boisk na landing**, dopóki nie ma jednego źródła tej
liczby (D13) — cztery różne wartości w serwisie są gorsze niż jej brak.

**Otwarte gry i boiska:** obie sekcje powinny renderować się serwerowo (te same dane
są już pobierane serwerowo na `/[sport]/[miasto]`). To jedyne miejsce, w którym strona
główna dałaby robotowi linki w głąb serwisu — dziś nie daje żadnych.

### 3b. `/jak-dziala-bojo`

**Stan:** najlepsza strona w serwisie. Bezpośrednia odpowiedź nad spisem treści,
dwanaście sekcji H2, `HowTo` + `FAQPage` pokryte widoczną treścią, sekcja „Czego Bojo
nie robi". Nie ruszać struktury.

**Trzy braki:**

1. **Rozliczenie nie ma własnej odpowiedzi.** Sekcja `pieniadze` istnieje i jest dobra,
   ale klaster z S3 („jak podzielić koszt boiska") zasługuje na własną stronę (4a) —
   tutaj zostaje link do niej.
2. **Brak jawnego odróżnienia od systemów rezerwacji.** Zdanie z
   `content/miasta.ts#CZYM_BOJO_NIE_JEST` jest na stronach miejskich, a nie ma go tam,
   gdzie modele czytają najczęściej. **Do dodania jako nowa sekcja H2 „Bojo a systemy
   rezerwacji obiektów"**, przed „Czego Bojo nie robi":

   > Bojo nie wynajmuje obiektów i nie pośredniczy w opłatach za termin. Halę czy orlik
   > załatwiasz tak jak dotąd — bezpośrednio z obiektem. Bojo zaczyna się krok później:
   > gdy termin jest już Twój, a trzeba zebrać na niego ludzi, policzyć miejsca
   > i podzielić rachunek. Dlatego Bojo bywa używane razem z systemem rezerwacji tego
   > samego obiektu, nie zamiast niego.

3. **Nowe pytania do FAQ** (do `content/faq.ts`, kategoria `organizator`):

   | Pytanie | Odpowiedź |
   |---|---|
   | „Czy Bojo zadziała dla ekipy, która gra od lat tym samym składem?" | „Tak — to najczęstszy przypadek. Zakładasz mecz, wklejasz link na czat, którego ekipa już używa, i przestajesz liczyć „+1" w komentarzach. Nikt nie musi zakładać konta ani zmieniać miejsca, w którym rozmawiacie." |
   | „Ile osób musi mieć konto, żeby to działało?" | „Jedna — organizator. Pozostali zapisują się z linku, podając imię i e-mail." |
   | „Co, jeśli ekipa nie chce kolejnej aplikacji?" | „Nie musi jej mieć. Bojo działa w przeglądarce, a dołączenie do meczu nie wymaga konta ani instalacji. Kolejną aplikację zakłada wyłącznie organizator." |

### 3c. `/dlaczego-bojo`

**Stan:** bezpośrednia odpowiedź, lista bolączek, dziesięciowierszowa tabela
porównawcza, sekcje o koncie, o tym, czego Bojo nie zastąpi, i uczciwa sekcja
o wczesnym etapie. Tabela porównawcza to najlepszy materiał cytacyjny w całym
serwisie — modele sięgają po tabele chętniej niż po prozę.

**Dwa braki:**

1. **Tabela jest w DOM dwa razy** (wersja tabelaryczna i karty `md:hidden`). Dla
   człowieka niewidoczne, dla robota to ta sama treść zduplikowana na jednej stronie.
   Nie jest to błąd krytyczny, ale osłabia jednoznaczność. **Sprawdzone w Partii 2
   rundy 2, świadomie odłożone**: `audyt-robota.mjs` (który nie wykonuje CSS, tak jak
   docelowy crawler) potwierdza, że oba bloki trafiają w surowy HTML niezależnie od
   `md:hidden`/`hidden md:block`. Naprawa bez utraty responsywnej karty na telefonie
   wymaga przebudowy znacznika (jeden `<table>` stylizowany CSS-em na dwa układy, wzorem
   `data-label`), nie zmiany treści — to zadanie dla UI, nie dla tej partii. Zostaje
   w rozdziale 9 jako osobna pozycja.
2. **Brak wiersza rozstrzygającego kategorię.** Tabela porównuje Bojo z grupą na
   Facebooku. Model pytający „czym to się różni od aplikacji do rezerwacji" nie dostaje
   odpowiedzi. **Do dodania jako nowa sekcja H2 „Trzy różne rzeczy, które ludzie mylą"** —
   bez nazywania konkretnych produktów, bo to nie jest strona porównawcza:

   > **System rezerwacji obiektu** odpowiada na pytanie „czy hala jest wolna w czwartek
   > o 20:00" i przyjmuje opłatę za termin. **Komunikator** (WhatsApp, Messenger)
   > odpowiada na „kto idzie", ale liczyć trzeba samemu. **Bojo** jest trzecią rzeczą:
   > przyjmuje zapisy na konkretny, już ustalony termin, liczy skład i rezerwę i dzieli
   > koszt na graczy. Bojo nie rezerwuje obiektu i nie zastępuje czatu ekipy — działa
   > obok jednego i drugiego.

   Ten akapit jest napisany wprost pod S6: pod pytanie „czym to właściwie jest".

### 3d. `/faq`

**Stan:** 41 pytań w sześciu kategoriach, pełny `FAQPage`, treść pokrywa się ze schemą.

**Braki — stan po Partii 2 rundy 2 (2026-08-25):**

1. ~~**Pytania nie są nagłówkami.**~~ **NAPRAWIONE.** `MiniFaq.tsx` owija każde pytanie
   w `<h3>` wewnątrz `<summary>` — zero zmian wizualnych (Tailwind Preflight resetuje
   margines i wagę czcionki nagłówków, style zostały na `<h3>` samym), pełna struktura
   dla maszyn na wszystkich pięciu stronach, które reużywają ten komponent (`/faq`,
   `/jak-dziala-bojo`, `/dlaczego-bojo`, `/[sport]/[miasto]`,
   `/kalkulator-kosztow-boiska`). Test źródłowy (bez importu `.tsx`, ten sam powód co
   przy D17): `faqNaglowki.test.ts`.
2. **Brakujące pytania — sprawdzone jedno po drugim, nie dopisane hurtem.** Z czterech
   propozycji z rundy 1 dwie były już pokryte, zanim ten dokument zdążył je zgłosić:
   „Czym Bojo różni się od systemu rezerwacji boisk?" istnieje w kategorii `podstawy`
   niemal dosłownie (dodane przy poz. 11 roadmapy, 2026-08-24), a pytanie o Multisport
   przy podziale kosztu pokrywają razem dwa istniejące wpisy w `pieniadze` („Jak
   sprawiedliwie rozliczyć koszty…" + „Czy Bojo uwzględnia Multisport…"). Dopisanie
   trzeciego, prawie identycznego pytania obniżyłoby gęstość informacyjną, nie
   podniosło jej — więc **nie dopisano**. Dwa pozostałe były realną luką i **dodane**:
   „Czy da się prowadzić zapisy bez zakładania grupy?" (`organizator`) i „Skąd wiadomo,
   czy na boisku jest oświetlenie?" (`boiska`, opisuje mechanizm potwierdzeń UGC
   z kworum 2 — F1 w rozdziale 8, wcześniej nieopisany w żadnym FAQ).

### 3e. `/[sport]/[miasto]`

**Stan:** najgęściej zalinkowana strona serwisu, dobra bezpośrednia odpowiedź
(`odpowiedzMiasta`), uczciwy komunikat przy braku meczów, zdanie odróżniające od
systemów rezerwacji, licznik obiektów w okolicy liczony geograficznie.

**Braki:** wejście tylko z hubu sportu i zawsze na Poznań (D8) — to naprawa linkowania
z 4b, nie copy. Poza tym strona jest gotowa. **Nie dokładać tu treści** i nie rozszerzać
listy miast (uzasadnienie w S4 i w anty-liście).

### 3f. `/boisko/[id]` — najważniejsza zmiana w całym dokumencie

**Stan:** dla człowieka strona jest kompletna. Dla robota to dwa `<script>` z JSON-LD
i pusty szkielet (D5), bez jednego linku wychodzącego (D6), z opisem obiecującym
rezerwację (D2) i tytułem z podwójnym sufiksem (D3). Mówimy o **32 096 stronach**
(Tier 1 + Tier 2), czyli o praktycznie całym indeksowalnym wolumenie serwisu.

**ZROBIONE 2026-08-23.** Rozwiązane inaczej, niż zakładał ten szkic, i lepiej: zamiast
drugiego nagłówka w `page.tsx` (co dałoby dwa `<h1>` po hydratacji) powstał wspólny
`NaglowekObiektu` w `VenueDetailClient.tsx`, renderowany w OBU stanach. Stan ładowania
JEST tym, co dostaje crawler — więc przestał być szarym szkieletem i wypełnia się
danymi z `page.tsx`. Człowiek zyskał przy okazji: od pierwszej klatki widzi, na jakim
obiekcie jest. Szkic pierwotny zostaje niżej jako zapis decyzji.

**Poprawka nie polega na pisaniu treści — treść już istnieje.** `opisObiektu()` generuje
poprawny akapit i jest przekazywany jako prop. Rzecz w tym, żeby renderować go
serwerowo, **nad** komponentem klienckim:

```tsx
// page.tsx — przed <VenueDetailClient />
<main>
  <h1>{field.name}</h1>
  <p>{opis}</p>
  <p>{field.address}</p>
  <nav aria-label="Powiązane">
    {wojewodztwoSlug && (
      <Link href={`/boiska/woj/${wojewodztwoSlug}`}>
        Boiska w województwie {wojewodztwoLabel}
      </Link>
    )}
    {sportSlug && <Link href={`/boiska/${sportSlug}`}>Wszystkie boiska do {sportLabel}</Link>}
    <Link href="/jak-dziala-bojo">Jak zebrać skład na ten obiekt</Link>
  </nav>
</main>
```

Komponent kliencki zostaje bez zmian i przejmuje stronę po hydratacji — tak jak dziś.
Jedno posunięcie zamyka D5, D6, D7 i połowę D9: strona obiektu przestaje być ślepym
zaułkiem, a staje się drogą do hubów.

**`description` w metadanych** powinno pochodzić z tego samego `opisObiektu()` co
widoczna treść — jedno źródło zamiast dwóch wersji opisu tego samego obiektu (i przy
okazji koniec z „zarezerwuj termin", D2).

**Aktualizacja 2026-08-29 — akapit przeniesiony na dół strony, treść wzmocniona.**
Właściciel ocenił, że akapit tuż pod `<h1>`, nad zdjęciem obiektu, czyta się dla
człowieka jak wstawka dla wyszukiwarki — zdjęcie i karta z danymi są tym, po co ktoś
tu przyszedł. `NaglowekObiektu` w `VenueDetailClient.tsx` rozdzielony na dwa komponenty:
`NaglowekTop` (wyłącznie `<h1>` i strzałka wstecz, zostaje na górze) i
`OpisIPowiazane` (opis, `zdanieMeczow`, nowe `zdanieUgc` niżej, adres w stanie
ładowania, `<nav>`), przeniesiony pod `VenueComments`, tuż nad atrybucją OSM. Kluczowe:
**pozycja w drzewie DOM nie ma znaczenia dla crawlera bez wykonania JS** — ma znaczenie
WYŁĄCZNIE to, w którym stanie komponentu (`fieldLoading` vs załadowany) blok się
renderuje, a renderuje się w obu, bezwarunkowo, tak jak wcześniej. `OpisIPowiazane`
w gałęzi ładowania (czyli w SSR, które dostaje każdy fetcher bez JS — GEO w tym) stoi
pod dwoma skeletonami, imitując docelową pozycję; w gałęzi załadowanej stoi naprawdę
na dole. Dwa wywołania tego samego komponentu, nie duplikat tekstu na stronie.

Przy tej samej okazji poprawione dwie rzeczy w samym `opisObiektu()`:

1. **Biernik zamiast mianownika w „do gry w X".** `field.sport` niesie mianownik
   wprost z importu OSM (`scraper/import_osm_pbf.py#OSM_SPORT_MAP`, zbiór zamknięty),
   a „grać w piłka nożna" jest złą polszczyzną na ~32 tysiącach stron. Mapa
   `SPORT_BIERNIK` w `content/opisObiektu.ts` pokrywa cały zbiór; „wielofunkcyjne"
   i „inne" (nie są nazwami konkretnej gry — `sport=multi` albo tag nierozpoznany)
   dostają opisowe „różne sporty" zamiast fałszywej odmiany. Test:
   `opisObiektu.test.ts`.
2. **Nowa funkcja `zdaniePotwierdzen()`** — te same potwierdzenia graczy, które
   `venueAmenityFeatures()` (5b) wystawia w `amenityFeature`, teraz też jako zdanie
   w widocznym tekście i w `description` JSON-LD (`page.tsx`), z tym samym progiem
   kworum. Domyka lukę z wiersza „Mikro-ankiety UGC" w tabeli rozdziału 0: dane były
   niewidoczne dla robota, który czyta tekst, a nie wyłącznie dane strukturalne.

### 3g. `/boiska/[sport]` i `/boiska/woj/[wojewodztwo]`

**Stan:** H1, jedna linijka „Znalezionych obiektów: N", lista i paginacja. Zero prozy.
Dla wyszukiwarki to strona listingowa bez treści — dokładnie ten typ, który przegrywa
z serwisem, który obok listy tłumaczy, co na niej jest.

**Do dodania** — akapit bezpośredniej odpowiedzi pod H1, generowany z danych, wzorem
`content/miasta.ts#zdanieOKatalogu` (nowa funkcja w `content/`, nie w JSX).

Dla hubu sportu:

> W katalogu Bojo jest {N} obiektów, na których da się zagrać w {sport} — od orlików
> i boisk osiedlowych po hale. Dane pochodzą z OpenStreetMap, a szczegóły takie jak
> nawierzchnia i oświetlenie potwierdzają gracze przy poszczególnych obiektach. Bojo
> nie wynajmuje tych obiektów: służy do zebrania składu na termin, który już masz.

Dla hubu wojewódzkiego — to samo z nazwą województwa.

**Do dodania — linkowanie poziome**, bo obie strony są dziś końcem drogi: hub
wojewódzki linkuje do pozostałych piętnastu województw i do hubów sportowych; hub
sportu linkuje do szesnastu województw zamiast do jednego zahardkodowanego miasta.
Szczegóły w 4b.

**Stopka:** ~~obie strony jej nie mają~~ — dodana 2026-08-23 (D9), razem z grupą
„Boiska" prowadzącą do sześciu hubów sportowych z każdej strony, która stopkę ma.

---

## 4. Architektura treści i skala

### 4a. Nowe typy stron — dwa, nie dziesięć

Przy dwuosobowym zespole każdy nowy typ strony to zobowiązanie na lata. Poniższe dwa
mają uzasadnienie w rozdziale 1; wszystko inne odpada do czasu, aż te dwa zadziałają.

**N1. `/kalkulator-kosztow-boiska` — strona narzędziowa (priorytet najwyższy)**
**ZROBIONE 2026-08-24.**

- **Intencja:** klaster „Rozliczenie" i „Karty sportowe" z 2a, sytuacja S3.
- **Dlaczego pierwsza:** to jedyna strona w całym planie, która **nie potrzebuje ani
  jednego użytkownika, ani jednego meczu i ani jednego linku**, żeby być użyteczna.
  Odpowiada na pytanie zadawane niezależnie od tego, czy Bojo istnieje, a odpowiada na
  nie lepiej niż kalkulator ogólny, bo uwzględnia karty sportowe — polską specyfikę,
  której narzędzia zagraniczne nie mają.
- **Zawartość:** działający kalkulator (koszt obiektu, liczba graczy, ilu z kartą,
  stawka dla posiadacza karty) + akapit bezpośredniej odpowiedzi + FAQ + naturalne
  przejście do założenia meczu.
- **Kod:** liczy `priceForParticipant()` z `lib/payments.ts` — ta sama funkcja co
  w aplikacji, zgodnie z regułą z AGENTS.md („cenę zawsze liczy `priceForParticipant()`").
  **Doszła jedna rzecz, której ten szkic nie przewidział:** kalkulator bierze koszt
  CAŁEGO obiektu i dzieli go na graczy — tej formuły `lib/payments.ts` wcześniej nie
  miał, bo w aplikacji organizator wpisuje cenę per gracz wprost (kreator w
  `app/wydarzenia/nowe/page.tsx` liczy podział inline, w PLN-stringu, przy każdym
  wpisanym znaku). Zamiast pisać drugi wzór, wydzielono `perPlayerPriceGrosze()` do
  `lib/payments.ts` — matematycznie tożsamy z formułą kreatora (zweryfikowane
  w `payments.test.ts` na tej samej parze liczb), tylko liczony wprost w groszach
  zamiast przez tekstowe pole formularza. Sam kreator zostaje nietknięty — refaktor
  jego działającego kodu pod DRY nie był częścią tego zadania. Orkiestracja obu funkcji
  (przycinanie wejścia z formularza, składanie wyniku) jest w `lib/kalkulatorKosztow.ts`,
  osobno od komponentu klienckiego, żeby dało się przetestować bez renderowania.
- **Renderowanie:** strona statyczna, kalkulator po stronie klienta. Bez `useSearchParams()`
  — potwierdzone w buildzie: `○ /kalkulator-kosztow-boiska`.
- **Copy — akapit otwierający:**

  > Koszt wynajmu boiska dzieli się na liczbę graczy, którzy realnie wchodzą do składu —
  > nie na tych, którzy „może wpadną". Przy 280 zł za halę i czternastu graczach wychodzi
  > 20 zł od osoby. Jeśli część ekipy ma kartę Multisport, FitProfit albo Medicover
  > Sport, ich stawka bywa inna, więc reszta dopłaca różnicę. Ten kalkulator liczy to
  > tak samo, jak robi to Bojo przy każdym meczu, i przelicza wynik za każdym razem,
  > gdy skład się zmienia.

**N2. `/boiska/[sport]/[miasto]` — brakująca warstwa katalogu**
**ZROBIONE 2026-08-25.**

- **Intencja:** klaster „Lokalne: obiekt", dziś rozstrzelony między hub krajowy
  a wojewódzki (kanibalizacja z 2b).
- **Źródło danych:** `fields` z wypełnionym `city` i sportem. **Lista miast jest
  ograniczona tabelą `miasta_priorytetowe`** (migracja `112`) — nie generujemy strony
  dla każdej miejscowości, jaka wpadła z OpenStreetMap.
- **Próg jakości — strona NIE powstaje**, gdy w danym mieście i sporcie są mniej niż
  **3** obiekty. **Decyzja właściciela (2026-08-25), nie propozycja z 4c** — 4c
  (próg dowodowy „potwierdzenie/mecz/komplet danych") jest odrzucone, więc bazą liczenia
  zostaje dzisiejsza definicja indeksowalności: `seo_tier IN (1, 2)`, ta sama, której
  używa `sitemap-boiska/[plik]/route.ts`. Pusta strona lokalna szkodzi bardziej, niż
  pomaga — to ta sama zasada, która jest już zapisana w komentarzu `content/miasta.ts`.
- **Renderowanie:** `force-dynamic`, bez `generateStaticParams()` — wzorem
  `/boiska/[sport]` i `/boiska/woj/[wojewodztwo]` (siostrzane huby, nie `/boisko/[id]`,
  które używa `revalidate` — dwa różne, już istniejące wzorce w tym samym katalogu, oba
  bez liniowego kosztu przy buildzie). Próg poniżej 3 obiektów i błąd zapytania do bazy
  dają ten sam wynik — 404, nigdy 500.
- **Sitemap:** `lib/hubMiasta.ts#paryHubowMiastSportu()` — jedno zapytanie na sport
  z `KATALOG_SPORT_MAP` (siedem, nie sto razy siedem), zawężone do miast z listy
  priorytetowej, więc ograniczone niezależnie od wielkości katalogu, jak `sportPages`
  i `wojewodztwoPages`. Degraduje do pustej listy przy niedostępnej bazie.

**Czego NIE budujemy:** kolejnych miast w `/[sport]/[miasto]` (S4), bloga (rozdział 6
i anty-lista), stron per dzielnica (próg jakości nie do utrzymania przy dzisiejszych
danych), stron per nawierzchnia.

### 4b. Sieć linków — najtańsza rzecz o największym wpływie

Dzisiejszy stan w jednym zdaniu: **wszystko, co jest w sitemapie, jest albo osierocone,
albo puste.** Robot dostaje listę adresów bez sieci, która by je łączyła, więc żaden
sygnał nigdzie nie płynie.

Docelowo cztery warstwy, każda linkująca w obie strony:

```
/                          → /boiska/[sport] (6-7), /jak-dziala-bojo, /faq, /mapa
/boiska/[sport]            → 16 województw, [sport]×[miasto] dla miast priorytetowych
/boiska/woj/[x]            → pozostałe 15 województw, huby sportowe, miasta w regionie
/boiska/[sport]/[miasto]   → obiekty, hub sportu, hub województwa, /[sport]/[miasto]
/boisko/[id]               → hub województwa, hub sportu, /jak-dziala-bojo   ← dziś ZERO
```

W poprzek: strona obiektu ↔ mecze na tym obiekcie (`upcomingEvents` już są pobierane
serwerowo, tylko nie renderowane w HTML), strona meczu → strona obiektu,
`/[sport]/[miasto]` ↔ `/boiska/[sport]/[miasto]`.

Trzy naprawy, każda na kilkanaście linijek:

1. **Stopka na wszystkich stronach publicznych** (D9) — dziś jest na czterech typach,
   a to jedyne miejsce z linkami do stron treści.
2. **Link ze strony głównej do hubów sportowych** — dziś nie ma **żadnego** wejścia
   z landingu do katalogu poza mapą, która dla robota jest pusta (D10).
3. **Serwerowy `<nav>` na stronie obiektu** (3f) — zamyka hierarchię od dołu.

### 4c. Ile obiektów powinno być w indeksie — mniej niż dziś

**ODRZUCONE 2026-08-25.** Decyzja właściciela: nie zmniejszamy indeksu. Obiekty
w katalogu Bojo są dziś przede wszystkim pinezkami na mapie — mają wartość samą
w sobie jako miejsce do znalezienia, niezależnie od tego, czy mają potwierdzenie
albo rozegrany mecz. Dodatkowe dane (ankiety, uzupełnienia adminów) są plusem,
nie warunkiem obecności w wyszukiwarce. `seo_tier`/`oblicz_seo_tier()` (migracja
`112`) zostają bez zmian — poniższe rozumowanie zostaje w dokumencie jako
uzasadnienie propozycji, która nie weszła w życie, nie jako plan do zrobienia.

Dziś indeksowalne jest **32 096 stron** (Tier 1 + Tier 2). Uczciwa odpowiedź brzmi:
**to o rząd wielkości za dużo jak na to, co mamy do powiedzenia**.

Rozumowanie:

- Strona obiektu, na którym nikt nigdy nie zagrał i o którym wiemy tylko tyle, ile
  było w OpenStreetMap, nie wnosi nic ponad to, co jest w OpenStreetMap. Powiela dane
  źródłowe, konkuruje z katalogiem mającym przewagę wieku i zjada budżet skanowania.
- Wartość dodana Bojo przy obiekcie jest dokładnie jedna: **czy tu się gra i czy dane
  się zgadzają według ludzi, którzy tam byli**. To jest treść, której nie ma nikt inny —
  i której dziś prawie nie mamy, bo mechanizm potwierdzeń ruszył w sierpniu 2026.

**Proponowany próg dowodowy.** Strona obiektu jest indeksowalna, gdy spełnia
przynajmniej jeden warunek:

1. ma co najmniej jedno potwierdzenie graczy po osiągnięciu kworum
   (`potwierdzenia_obiektu`, migracja `123`), albo
2. odbył się na niej kiedykolwiek jakikolwiek mecz, albo
3. ma komplet danych podstawowych: nazwę, adres, miejscowość, sport **i** nawierzchnię
   lub informację o oświetleniu.

Mechanizm już istnieje — to `seo_tier` i funkcja `oblicz_seo_tier()` z migracji `112`
wraz z wyzwalaczami promocji. Nie trzeba nowej maszynerii, trzeba zmienić definicję
tieru. Reszta katalogu zostaje w aplikacji: na mapie, w wyszukiwarce obiektów, jako
miejsce meczu. **Niewidoczność w Google nie jest karą dla obiektu — jest przyznaniem,
że nie mamy o nim nic do powiedzenia.**

Ile stron zostanie: **SZACUNEK — rząd kilku tysięcy na starcie** (dziś Tier 1 to 3 605
obiektów, a warunków 1 i 2 praktycznie nikt nie spełnia: przy audycie mecz miało kiedyś
około czterdziestu obiektów). Weryfikacja: zapytanie z Załącznika B, punkt 7.

Efekt uboczny jest najciekawszą częścią tego pomysłu: **indeks zaczyna rosnąć wtedy,
gdy rośnie produkt.** Każde potwierdzenie od gracza i każdy rozegrany mecz promuje
obiekt do indeksu. To pętla, której konkurent bez społeczności nie odtworzy — wraca
w rozdziale 8.

### 4d. Jak powiedzieć maszynie, czym Bojo nie jest

Rozproszone dziś w `content/miasta.ts#CZYM_BOJO_NIE_JEST`. Powinno stać w czterech
miejscach, tym samym zdaniem (jedno źródło, importowane):

| Miejsce | Po co |
|---|---|
| `/jak-dziala-bojo`, sekcja „Bojo a systemy rezerwacji obiektów" (3b) | strona najczęściej czytana przez modele |
| `/dlaczego-bojo`, sekcja „Trzy różne rzeczy, które ludzie mylą" (3c) | ujęcie kategorialne |
| `/faq`, pytanie „Czym Bojo różni się od systemu rezerwacji boisk?" (3d) | trafia do `FAQPage` |
| `llm-context.md`, sekcja „Czego Bojo NIE robi" | już tam jest — zostaje wzorcem |

---

## 5. Warstwa maszynowa

### 5a. Tożsamość encji — zmiana o największym znaczeniu

Dzisiejszy `Organization` (`lib/structuredData.ts:14-22`) nie mówi maszynie, że „Bojo"
to nazwa własna aplikacji, a nie potoczne słowo (2c). Do dodania:

```ts
{
  '@type': 'Organization',
  '@id': `${base}/#organization`,
  name: 'Bojo',
  alternateName: ['Bojo.pl', 'aplikacja Bojo'],
  // Nazwa koliduje z potocznym słowem „bojo" (= boisko). To pole jest jedynym
  // miejscem, w którym da się to maszynie powiedzieć wprost.
  disambiguatingDescription:
    'Bojo (bojo.pl) to aplikacja webowa do organizowania amatorskich meczów sportowych '
    + 'w Polsce. Nazwa pokrywa się z potocznym polskim słowem „bojo" oznaczającym boisko '
    + '— ten wpis dotyczy aplikacji.',
  url: base,
  description: '…',
  areaServed: { '@type': 'Country', name: 'Polska', addressCountry: 'PL' },
  // sameAs: dopisać dopiero wtedy, gdy profile realnie istnieją (rozdział 6).
  // Puste albo zmyślone sameAs jest gorsze niż jego brak.
}
```

`sameAs` jest tu najważniejszym polem — i jedynym, którego dziś nie da się wypełnić
uczciwie, bo Bojo nie ma żadnego profilu poza własną domeną. To wiąże rozdział 5
z rozdziałem 6: **dane strukturalne nie zbudują encji, jeśli encja nie istnieje nigdzie
indziej.**

**Stan na 2026-08-26 (runda 3):** `alternateName` i `disambiguatingDescription`
**dopisane** (`lib/structuredData.ts#siteJsonLd`), zweryfikowane w surowym HTML
lokalnego builda produkcyjnego. `sameAs` nadal **nie** — i to jest jedyne pole
zablokowane pozycją 15. Przez dwie rundy cała trójka stała w BACKLOG-u jako jedna
pozycja „czeka na Jana", choć dwa pola z trzech nie zależały od niczego poza repo;
to spłaszczenie było powodem, dla którego zmiana o „największym znaczeniu" w tym
rozdziale nie została wykonana przez dwie rundy. Wniosek ogólniejszy niż ta pozycja:
**pozycja backlogu zablokowana w całości przez jedną ze swoich części zostaje
niezrobiona w całości.**

### 5b. Potwierdzenia graczy jako dane strukturalne

Faza 3 (mikro-ankiety) stworzyła dane, których nie ma nikt inny, i nie wystawiła ich
maszynom. `SportsActivityLocation` na `/boisko/[id]` powinien je nieść — ale
**wyłącznie po osiągnięciu kworum**, tego samego, które decyduje o pokazaniu ich
człowiekowi:

```ts
// tylko gdy liczbaGlosow >= 2 (to samo kworum co w AnkietyObiektu.tsx)
amenityFeature: [
  {
    '@type': 'LocationFeatureSpecification',
    name: 'Oświetlenie',
    value: true,
    // Źródło jest częścią faktu: to nie dane z OSM, tylko głos ludzi, którzy tam byli.
    description: 'Potwierdzone przez 4 graczy w Bojo',
  },
  {
    '@type': 'LocationFeatureSpecification',
    name: 'Nawierzchnia: sztuczna trawa',
    value: true,
    description: 'Potwierdzone przez 3 graczy w Bojo',
  },
],
```

To jest dokładnie ten rodzaj treści, po który sięgają modele: konkretny fakt
z podanym źródłem i liczbą. Żaden katalog importujący dane z OpenStreetMap nie może
tego mieć, bo nie ma ludzi, którzy tam grają.

### 5c. Czego NIE dodawać

- **`AggregateRating` i `Review`** — Bojo nie ma recenzji obiektów. Dodanie tego
  bez pokrycia w widocznej treści to sygnał spamu i realne ryzyko ręcznej kary,
  a nie przewaga. Ta sama zasada, która jest już zapisana przy `faqJsonLd()`
  i `howToJsonLd()`, obowiązuje wszędzie.
- **`SearchAction` w `WebSite`** — sprawdziłem: żadna publiczna trasa nie przyjmuje
  frazy wyszukiwania w adresie (`searchParams` obsługują wyłącznie `strona` i `tab`).
  Deklarowanie nieistniejącego adresu wyszukiwania to obietnica dla maszyny, której
  serwis nie spełnia. Dodać dopiero, gdy taka trasa powstanie.
- **`Dataset` dla katalogu** — kuszące (36 tys. obiektów brzmi jak zbiór danych), ale
  dane pochodzą z OpenStreetMap na licencji **ODbL**, która przy publikowaniu zbioru
  pochodnego wymaga udostępnienia go na tych samych warunkach. Dopóki nie ma decyzji,
  co dokładnie publikujemy i na jakiej licencji, `Dataset` obiecuje coś, czego nie
  wydajemy. Wraca w rozdziale 8 jako świadome posunięcie, nie jako dodatek do schemy.

### 5d. Co poprawić w tym, co już jest

| Co | Problem | Poprawka |
|---|---|---|
| `ItemList` na hubach | ~~listuje obiekty z `noindex` (D11)~~ | **NAPRAWIONE 2026-08-25** (runda 2, Partia 1): `.in('seo_tier', [1, 2])` w `lib/hubKatalogu.ts` — istniejący próg tieringu (migracja 112), NIE próg z odrzuconego 4c. Test: `hubKatalogu.test.ts` |
| `SportsEvent` | poprawny, ale strona nie ma `noindex` dla prywatnych (P1) | patrz P1 |
| `BreadcrumbList` na `/boisko/[id]` | prowadzi do hubu, do którego nie ma widocznego linku (D7) | rozwiązuje `<nav>` z 3f |
| `SoftwareApplication.featureList` | mówi o zniżkach z kart i o liście rezerwowej — zgodne z produktem | zostaje |

### 5e. `llms.txt` i `llm-context.md`

Zastrzeżenie z [README.md](./README.md) zostaje aktualne: żaden duży dostawca nie
potwierdził, że czyta `llms.txt`, więc plik ma być krótki i tani. Trzy zmiany:

1. **Ujednolicić liczbę obiektów** (D13). Jedna wartość, w jednym miejscu, z datą.
   Dziś w czterech miejscach są cztery różne.
2. ~~**Dopisać jedno zdanie ujednoznaczniające** do nagłówka `llms.txt` i `llm-context.md`~~
   **ZROBIONE 2026-08-26** (runda 3; proponowane w rundzie 1, przez dwie rundy niedopisane):
   „Nazwa Bojo pokrywa się z potocznym polskim słowem oznaczającym boisko; ten
   dokument dotyczy aplikacji bojo.pl." Model czytający plik na zimno dostaje wtedy
   rozstrzygnięcie od razu, a nie zgaduje.
3. **Nie rozbudowywać.** `llm-context.md` ma 34,8 tys. znaków i dobrą strukturę
   (bloki PROBLEM / ROZWIĄZANIE / MECHANIKA, pytania przy każdej sekcji). Dokładanie
   do niego treści marketingowej zepsuje jedyny plik w repo, który jest napisany
   dokładnie tak, jak trzeba.

**Czego nie robić:** nie dopisywać list słów kluczowych. Badania GEO (Aggarwal i in.,
KDD 2024) pokazują, że keyword stuffing wypada najsłabiej ze wszystkich testowanych
metod i obniża ocenę gęstości informacyjnej. Ta zasada jest już zapisana w AGENTS.md
i obowiązuje tak samo tutaj.

---

## Tło konkurencyjne — poza osią strategii

Oś tego dokumentu została świadomie utrzymana tam, gdzie stawia ją
[wizja.md](./wizja.md): Bojo konkuruje z chaosem w komunikatorach, nie z platformami.
Ten rozdział jest tłem, a nie zmianą kierunku — ale zapisuję go, bo wpływa na ocenę
ryzyka w rozdziale 9.

Rozpoznanie w wyszukiwarce (sierpień 2026) pokazało, że pole nie jest puste:

| Kategoria | Kto | Uwaga |
|---|---|---|
| Aplikacje do organizowania gierek | amator.app, Orlikfy, Meet and Play, LocalPlay | ta sama obietnica co Bojo: zbieranie składu, historia meczów, rozliczenia; LocalPlay ma wzmianki w mediach ogólnopolskich |
| Rezerwacja obiektów wchodząca w społeczność | BallSquad | rezerwacja i płatność online, ale **dokłada „Squad" i poziomy zaawansowania**, czyli wchodzi na pole Bojo od strony obiektów; ma udokumentowane wzmianki w portalach lokalnych i u zarządców obiektów |
| Katalogi boisk | boiskawpolsce.pl (deklaruje ~20 tys. obiektów, z recenzjami), orlik2012.pl, katalogi miejskie i portale MOSiR | bezpośredni incumbent dla klastra „Lokalne: obiekt" (S5) |

Trzy wnioski, które przenoszę dalej:

1. **Klaster lokalny obiektowy jest zajęty przez serwis z przewagą wieku i z recenzjami.**
   Nie ścigamy się liczbą wierszy, tylko danymi, których tamci nie mają — potwierdzenia
   graczy (F1) i ślad rozegranych meczów z datą (F4), nie próg indeksacji (4c odrzucone
   2026-08-25, poz. 19).
2. **Wzmianki u zarządców obiektów i w portalach lokalnych działają w tym rynku** —
   widać to po śladzie, jaki zostawił BallSquad. To najlepiej udokumentowany kanał
   off-page dla produktu sportowego w Polsce i dlatego trafia do rozdziału 6 mimo
   ciasnego budżetu czasu.
3. **Zapytanie „jaka aplikacja do organizowania meczów" ma już kandydatów.** W S6
   Bojo nie startuje z pustego pola, tylko wchodzi do istniejącego zestawienia —
   co czyni gęstość faktów i jednoznaczne „czym to nie jest" jeszcze ważniejszymi.

---

## 6. Ślad w sieci przy budżecie poniżej dwóch godzin tygodniowo

Dane dostawców narzędzi GEO z 2026 mówią, że około dwie trzecie cytowań w odpowiedziach
AI pochodzi ze źródeł **spoza** własnej domeny, a pokrycie między pierwszą dziesiątką
Google a cytowaniami modeli spadło poniżej jednej piątej. **Traktuję to jako wskazówkę,
nie jako fakt** — to liczby firm sprzedających usługi GEO, nierecenzowane i wygodne dla
sprzedającego. Kierunek jest jednak zgodny z tym, co widać w S6: model porównuje opisy
z wielu źródeł, nie tylko z witryny producenta.

I tu jest główne napięcie tej strategii: **najmocniejsza dźwignia leży poza repo,
a poza repo mamy poniżej dwóch godzin tygodniowo.** Nie da się tego rozwiązać
planem — da się tylko wybrać. Wybieram cztery rzeczy o trwałej wartości i mówię
wprost, co przez to odpada.

### Co robimy

**1. Spójna nazwa encji — koszt zerowy, wpływ wysoki.**
Wszędzie, gdzie marka pada po raz pierwszy w sekcji: **„Bojo (bojo.pl)"** albo
„aplikacja Bojo", nigdy samo „Bojo". Dotyczy treści stron, opisów profili, wiadomości
do obiektów i wpisów w mediach. To nie jest kosmetyka: przy nazwie kolidującej ze słowem
pospolitym (2c) to jedyny sposób, żeby wzmianka w ogóle policzyła się do właściwej encji.
**Kto:** oboje, przy każdym tekście. **Sygnał:** zapytanie markowe w modelu przestaje
zwracać definicję słownikową.

**2. Trzy profile, raz a dobrze — łącznie ok. 2 godzin, jednorazowo.**
Nie dziesięć katalogów. Trzy miejsca, które modele realnie cytują przy pytaniach
„czym zastąpić X" i „jaka aplikacja do Y", i które nie wymagają utrzymania:
katalogi alternatyw dla oprogramowania oraz katalog aplikacji. Opis w każdym z nich
to ten sam akapit bezpośredniej odpowiedzi co z 3a — jedno źródło, zero wariantów.
Po założeniu profili **wracamy do `sameAs` w danych strukturalnych** (5a), bo dopiero
wtedy jest co tam wpisać. **Kto:** Jan. **Sygnał:** marka pojawia się w odpowiedzi na
pytanie kategorialne z koszyka 2 w Załączniku A.

**3. Wkład zwrotny do OpenStreetMap — ODRZUCONE 2026-08-25.**
Cały katalog Bojo pochodzi z OSM i mamy dane, których OSM nie ma (potwierdzenia
oświetlenia i nawierzchni), ale decyzja właściciela jest: nie ma potrzeby oddawać
tego z powrotem. Nie realizujemy — patrz ryzyko w rozdziale 8, posunięcie F1.

**4. Jeden kontakt tygodniowo do obiektu lub portalu lokalnego — do 1 godziny.**
Kanał z udokumentowanym śladem w tym rynku (patrz tło konkurencyjne). Panel
`/admin/outreach` już istnieje i już jest zadaniem Jana w [strategia.md](./strategia.md) §7 —
**nie dokładamy nowej roboty, tylko dopisujemy do istniejącej rozmowy jedno zdanie**:
prośbę o wzmiankę z linkiem, gdy obiekt i tak publikuje komunikaty o wydarzeniach.
**Kto:** Jan. **Sygnał:** pierwszy link przychodzący spoza własnych profili.

### Co przez ten budżet odpada — i niech to będzie zapisane

- **Regularna obecność na Reddicie, Wykopie i w grupach Facebooka.** Kanał wysokiej
  wartości dla GEO, ale wymaga bycia obecnym co tydzień przez miesiące. Przy dwóch
  godzinach to albo zniknie po trzech tygodniach, albo zamieni się w spam. Jedno i drugie
  jest gorsze niż nieobecność.
- **Blog i treści poradnikowe.** Bez autora z czasem martwy blog szkodzi: sygnalizuje
  porzucony serwis.
- **Wikidata.** Wymaga niezależnych źródeł, których Bojo nie ma. Wpis bez nich zostanie
  usunięty, a usunięcie jest gorszym sygnałem niż brak wpisu. Wracamy do tego, gdy będą
  wzmianki z punktu 4.
- **Kontakt z mediami i noty prasowe.** Kosztowne czasowo, nieprzewidywalne.

### Czego nie robimy nigdy

Żadnego udawania użytkowników, kupowania linków ani zakładania kont, które mają
wyglądać na cudze. Nie z powodów moralnych w pierwszej kolejności, tylko dlatego, że
przy jednej domenie i dwuosobowym zespole wykrycie oznacza utratę wszystkiego, co
zbudowaliśmy, a zysk jest niepewny. Jeśli ktoś kiedyś zaproponuje taktykę z tej szarej
strefy, ten akapit jest odpowiedzią.

---

## 7. Pomiar

Bez tego rozdziału cała reszta jest opinią. Zasada nadrzędna: **pomiar bazowy przed
pierwszą optymalizacją.** Jeśli zaczniemy zmieniać treść przed zmierzeniem, za trzy
miesiące nie odróżnimy poprawy od wrażenia poprawy.

### 7a. Co mierzymy

| Miernik | Czym | Jak często | Wartość bazowa |
|---|---|---|---|
| Pokrycie indeksu (ile stron realnie w Google) | Search Console → Strony | miesięcznie | **zmierzone 2026-08-29** — 2 zaindeksowane, 0 zeskanowano-bez-indeksu, 0 wykryto-bez-indeksu; sitemapa nigdy wcześniej niezgłoszona, zgłoszona w tej rundzie — patrz 7a.2 |
| Wyświetlenia i pozycje wg klastra z 2a | Search Console → Skuteczność | miesięcznie | **zmierzone 2026-08-29** — 0 kliknięć / 56 wyświetleń / CTR 0% / śr. pozycja 9,4 (3 mies.), wyłącznie zapytania markowe — patrz 7a.2 |
| Obecność w odpowiedziach modeli | 40 promptów z Załącznika A | co 6 tygodni | **niezmierzona** |
| Wzmianki marki poza domeną | wyszukiwanie nazwy z kwalifikatorem | co 6 tygodni | **zero znanych** |
| Ruch crawlerów AI | logi Vercela wg `User-Agent` z `robots.ts:12-19` | miesięcznie | nieznana |
| Core Web Vitals | PageSpeed Insights na 5 typach stron | kwartalnie | **zmierzone 2026-08-29** — patrz 7a.1 niżej |
| Kontrakt HTML dla robota | `scripts/audyt-robota.mjs` (niżej) | przy każdym PR | do zbudowania |

### 7a.1. Core Web Vitals — pomiar bazowy z 2026-08-29

Zmierzone przez właściciela (Jan) w przeglądarce, na **pagespeed.web.dev**, bezpośrednio
przeciwko `bojo.pl` — nie z tej sesji, która nie ma dostępu sieciowego do produkcji
(rozdział 0). Pierwsza próba automatyzacji zawiodła: PageSpeed Insights API (przez klucz
właściciela) zwracał odpowiedzi zbyt duże dla narzędzia do pobierania stron dostępnego
w tej sesji, które obcinało JSON przed metrykami LCP/CLS/TBT — stąd pomiar ręczny,
nie automatyczny. Wszystkie pięć typów stron z roadmapy, telefon i pulpit,
Lighthouse 13.4.1, `29 sie 2026, 18:27–18:35 CEST`:

| Strona | Wydajność 📱/💻 | Dostępność 📱/💻 | Sprawdzone metody | SEO | Agentowe |
|---|---|---|---|---|---|
| `/` (landing) | 84 / 100 | 92 / 92 | 100 / 100 | 100 / 100 | 3/3 · 3/3 |
| `/boisko/dubidzkie-lwy-741e4f384561` | 80 / 98 | 87 / 87 | 100 / 100 | 100 / 100 | **2/3 · 2/3** |
| `/boiska/pilka-nozna` (hub) | 94 / 100 | 86 / 87 | 100 / 100 | 100 / 100 | 3/3 · 3/3 |
| `/pilka-nozna/poznan` (sport+miasto) | 94 / 100 | 95 / 95 | 100 / 100 | 100 / 100 | 3/3 · 3/3 |
| `/wydarzenia/671d717f-380a-4e77-a039-d615f1d6927d` | 84 / 99 | 95 / 95 | 100 / 100 | 100 / 100 | 3/3 · 3/3 |

Pełne rozbicie na Core Web Vitals (nie tylko zbiorczy wynik „Wydajność") zebrane
wyłącznie dla landing page — pozostałe cztery mają na razie sam wynik Lighthouse:

| Metryka | `/` telefon | `/` pulpit |
|---|---|---|
| First Contentful Paint | 1,3 s | 0,3 s |
| **Largest Contentful Paint** | **4,0 s** | **0,6 s** |
| Total Blocking Time | 10 ms | 10 ms |
| **Cumulative Layout Shift** | **0** | 0,001 |
| Speed Index | 4,6 s | 0,7 s |
| Łączny transfer strony | — | 582 KiB (same czcionki: ~173 KiB) |

Różnica telefon/pulpit na landing page (LCP 4,0 s vs 0,6 s) jest zamierzonym skutkiem
profilu pomiarowego — telefonowy dławi celowo do wolnego 4G, pulpitowy nie — nie
dowodem regresji. Element LCP na telefonie to `<h1>` „Zorganizuj mecz w dwie minuty";
sam raport wskazuje 2,51 s **opóźnienia renderowania** tego elementu przy TTFB=0 ms,
z trzema nazwanymi przyczynami: ~600–750 ms blokujących renderowanie żądań CSS,
44 KiB nieużywanego JS w jednym chunku, 11,6 KiB zbędnych polyfillów
(`Array.prototype.at/flat/flatMap`, `Object.hasOwn`, `String.prototype.trimEnd/trimStart`
— kod jest transpilowany pod przeglądarki, które już nie istnieją na rynku).

**Do decyzji, nie zdecydowane teraz** (zasada z rozdziału 8, „nie optymalizujemy przed
pomiarem" — pomiar dopiero się skończył):
- Landing page na telefonie ma LCP 4,0 s przy realnych, nazwanych przyczynach wyżej —
  to jest coś, co dałoby się poprawić, kiedy przyjdzie kolej na tę pozycję roadmapy.
- **Strona obiektu ma `2/3` w kategorii „Przeglądanie agentowe" — jedyna z pięciu.**
  Wszystkie pozostałe cztery mają 3/3. Nie wiadomo, który z trzech audytów pada
  (kategoria sprawdza m.in. poprawność danych strukturalnych i drzewo dostępności —
  obszary, które ta runda mocno ruszała), bo zrzut ekranu nie rozwijał tej sekcji.
  **NIEZWERYFIKOWANE które konkretnie audyty padają** — sposób sprawdzenia: rozwinąć
  sekcję „Przeglądanie agentowe" na `pagespeed.web.dev` dla tej strony.
- Dostępność na hubie katalogu (`/boiska/pilka-nozna`, 86/87) jest zauważalnie niższa
  niż gdziekolwiek indziej (92–95 na pozostałych czterech stronach) — bez rozwiniętej
  listy audytów nie wiadomo, co konkretnie ciągnie wynik w dół.

**Dopisek 2026-08-29** — właściciel rozwinął sekcję „Ułatwienia dostępu" na
`/boiska/pilka-nozna` i wkleił pełny audyt. Pięć elementów z niewystarczającym
kontrastem tekst/tło; policzone dokładnie formułą WCAG względnej luminancji, nie
„na oko": stopka (nagłówki grup linków + `Prywatność`/`Regulamin`/`Zgłoś błąd`,
3,75:1), plakietka „Wczesny etap" (4,34:1), licznik paginacji i etykiety sekcji na
trzech hubach katalogu (2,45–2,56:1) — wszystkie poniżej progu AA 4,5:1. Naprawione
w [PR #302](https://github.com/fpudelko/bojo-app/pull/302), jednym stopniem w skali
Tailwinda, bez zmiany charakteru wizualnego. Dwa pozostałe znaleziska z tego samego
audytu świadomie NIE naprawione, bo wymagają decyzji produktowej, nie mechanicznej
poprawki koloru: linki rozróżnialne wyłącznie po kolorze (wzorzec `hover:underline`
powtórzony w setkach linków w repo) i za małe pola dotykowe na listach miast/
województw. **NIEZWERYFIKOWANE:** czy to wyczerpuje różnicę 86/87 vs 92–95 wyżej —
audyt nie podał osobno wpływu każdego znaleziska na wynik zbiorczy, a strona nie
została zmierzona ponownie po poprawce.

**NIEZWERYFIKOWANE z tej sesji:** wszystkie liczby wyżej pochodzą z przeglądarki
właściciela, nie z tej sesji — ta nie ma dostępu sieciowego do `bojo.pl` (rozdział 0)
ani do `pagespeed.web.dev`, który blokuje ten sam adres tą samą polityką. Przyjęte
bez własnej weryfikacji, bo źródłem jest bezpośredni zrzut ekranu z narzędzia Google,
nie twierdzenie do zweryfikowania.

### 7a.2. Search Console — pomiar bazowy z 2026-08-29

Zmierzone przez właściciela (Jan) w przeglądarce, w Google Search Console — nie z tej
sesji, która nie ma dostępu sieciowego do `bojo.pl` ani do `search.google.com/search-console`
(rozdział 0). Usługa: `https://www.bojo.pl/`, typ **prefiks adresu URL** (nie usługa
domenowa) — jeśli obok istnieje osobna usługa domenowa `bojo.pl` bez `www`, ta runda
jej nie objęła.

**Odkrycie, które tłumaczy resztę liczb: mapa witryny nigdy wcześniej nie została
zgłoszona do tej usługi.** `Indeksowanie → Mapy witryn` pokazywał „Przesłane mapy
witryn: 0–0 z 0" — nie błąd pobrania, tylko brak jakiegokolwiek zgłoszenia. Zgłoszona
w trakcie tej rundy (`sitemap-index.xml`, 2026-08-29): stan po przetworzeniu —
„Sukces", typ „Indeks mapy witryny", **„Wykryte strony": 0** w chwili pomiaru. Zero
przy świeżo zaakceptowanym indeksie jest oczekiwane — Google osobno musi jeszcze zejść
do 17 map wojewódzkich, które ten indeks wylicza; właściciel sprawdzi ponownie za
2–3 dni. To jest jedyna pozycja z tego pomiaru, która nie jest jeszcze zamknięta.

**Pokrycie indeksu** (`Indeksowanie → Strony`, przed propagacją zgłoszonej sitemapy):

| Kategoria | Liczba |
|---|---|
| Zaindeksowane | **2** (`https://www.bojo.pl/`, `https://www.bojo.pl/dlaczego-bojo`) |
| Zeskanowano — obecnie bez indeksu | 0 |
| Wykryto — obecnie bez indeksu | 0 |

Innymi słowy: przed zgłoszeniem sitemapy Google **w ogóle nie wiedział**, że reszta
serwisu istnieje — nie chodziło (na razie) o odrzucenie stron, tylko o brak adresu,
pod którym miałby ich szukać. To jest inny, wcześniejszy problem niż D5 (pusty HTML
strony obiektu) — oba są realne i oba trzeba mieć naprawione, żeby wolumen realnie
trafił do indeksu.

**Skuteczność** (`Skuteczność → Wyniki wyszukiwania`, zakres 3 miesiące do 2026-08-29):
kliknięcia **0**, wyświetlenia **56**, średni CTR **0%**, średnia pozycja **9,4**.
Wykres skupia dane wyłącznie w ostatnich ~2 tygodniach mimo 3-miesięcznego zakresu —
wcześniej praktycznie zero wyświetleń. Najczęstsze zapytania: „co to bojo" (18 wyśw.),
„bojo" (8), „bojo co to" (7), „boisko klej" (7) — wszystkie markowe, zero kliknięć
mimo pozycji ~9. Twarda liczba pod problemem z nazwą opisanym w rozdziale 2c: ktoś,
kto widzi Bojo na tej pozycji dla zapytania o markę, i tak nie klika.

**Do sprawdzenia ponownie za 2–3 dni:** czy „Wykryte strony" przy `sitemap-index.xml`
rośnie. Jeśli tak — potwierdza, że jedynym problemem był brak zgłoszenia. Jeśli
zostanie przy zerze mimo statusu „Sukces" — dopiero wtedy wymaga sprawdzenia treści
samych map wojewódzkich (`/sitemap-boiska/*.xml`).

**NIEZWERYFIKOWANE z tej sesji:** wszystkie liczby wyżej pochodzą ze zrzutów ekranu
właściciela, tak jak w 7a.1 — ta sesja nie ma własnego dostępu do Search Console.

### 7b. Progi sukcesu

Celowo skromne, bo punktem wyjścia jest zero, a produkt jest przed startem.

- **30 dni:** wartość bazowa zmierzona dla wszystkich pozycji z 7a. Wszystkie PILNE
  naprawione. Zero stron z pustym HTML wśród typów objętych kontraktem z 7c.
- **90 dni:** **SPROSTOWANIE (runda 2, 2026-08-25)** — próg „liczba stron w indeksie
  spada i to jest sukces" odsyłał do 4c, odrzuconego decyzją właściciela (poz. 19: nie
  zmniejszamy indeksu). Zastąpiony miernikiem, który nie zależy od tej decyzji: **udział
  obiektów z dowodem aktywności rośnie** — potwierdzenie graczy (F1) albo rozegrany
  mecz z datą (F4), liczone jako odsetek Tier 1+2. Rośnie wraz ze społecznością, nie
  wymaga zmiany progu indeksacji. W koszyku markowym Załącznika A model podaje poprawną
  odpowiedź, czym jest Bojo, zamiast definicji słownikowej. Pierwszy link przychodzący
  spoza własnych profili.
- **180 dni:** Bojo pojawia się w odpowiedzi na przynajmniej jedno pytanie kategorialne
  (koszyk 2) i przynajmniej jedno problemowe (koszyk 3). Strona kalkulatora (N1) ma
  niezerowe wyświetlenia w Search Console na frazy z klastra „Rozliczenie".

### 7c. Co da się zautomatyzować

Repo ma jedenaście workflowów, w tym gotowy wzorzec bramki
(`.github/bramka-scenariuszy.mjs`). Proponuję jeden nowy skrypt, bo dokładnie ta klasa
błędu przeszła dziś niezauważona przez `tsc`, Vitest, ESLint i Playwrighta naraz:

**`scripts/audyt-robota.mjs`** — pobiera zbudowaną aplikację po HTTP **bez wykonywania
JavaScriptu** (zwykły `fetch`, tak jak robi to crawler) dla po jednym adresie z każdego
typu strony i sprawdza:

1. jest dokładnie jeden `<h1>` i nie jest pusty,
2. `<title>` nie zawiera dwukrotnie `| Bojo`,
3. jest `<meta name="description">` i nie zawiera fraz z `content/zakazaneFrazy.ts`,
4. jest przynajmniej jeden `<a href="/...">` prowadzący w głąb serwisu,
5. strony, które mają być `noindex`, mają `noindex`, a te, które nie mają — nie mają,
6. każdy typ strony wymieniony w `sitemap.ts` przechodzi punkty 1–4.

To jest bramka, która **cofnęłaby dzisiejszy stan** i której brak sprawił, że Fazy 1
i 2b zostały odhaczone jako zrobione. Testy zrzutów ekranu tego nie łapią, bo Playwright
wykonuje JavaScript — czyli patrzy na aplikację z tej strony, z której problemu nie widać.

Pomiar w modelach zostaje ręczny: 40 promptów, raz na sześć tygodni, wynik dopisywany
do tabeli w tym dokumencie. Automatyzacja przez API kosztuje i wymaga kluczy — nie
przy tym budżecie.

---

## 8. Fosa — czego konkurencja nie skopiuje

Wszystko z rozdziałów 3–7 konkurent z budżetem odtworzy w kwartał. Poniższe nie —
bo wymaga posiadania tego, co Bojo ma, a czego nie da się kupić: katalogu 36 tys.
obiektów z OpenStreetMap **połączonego** ze zdarzeniami i z ludźmi, którzy na tych
obiektach grają.

Warunek, który odrzucił połowę pomysłów: **musi działać przy stu użytkownikach.**
Wszystko, co potrzebuje skali, jest planem na cudzy produkt.

### F1. Katalog weryfikowany przez grających, nie przez import

**Na czym polega:** przy każdym obiekcie gracze potwierdzają oświetlenie i nawierzchnię
(mechanizm istnieje od migracji `123`, kworum dwa głosy). To jedyna informacja
o polskich boiskach, której nie ma w OpenStreetMap i nie ma w żadnym katalogu
importującym z OSM — bo wymaga ludzi, którzy tam byli.
**Dlaczego nie do skopiowania:** katalog bez społeczności może dopisać pole
„oświetlenie", ale nie ma kto go wypełnić. Serwis z recenzjami ma opinie o obiektach,
a nie zweryfikowane fakty z kworum.
**Co trzeba zbudować:** wystawić te dane maszynom. **ZROBIONE 2026-08-24** —
`venueAmenityFeatures()` w `lib/structuredData.ts` (poz. 18 roadmapy).
**SPROSTOWANIE (runda 2, 2026-08-25):** wcześniejsza wersja tego akapitu wiązała F1
z „uczynieniem potwierdzeń warunkiem indeksacji" (4c) — tej pozycji nie realizujemy
(decyzja właściciela, poz. 19). To nie unieważnia F1: fosa nie jest w GATINGU
indeksu, tylko w SAMYCH potwierdzeniach — danych, których nie ma żaden konkurent,
niezależnie od tego, czy sterują one indeksacją, czy nie. F1 stoi samodzielnie
i jest dziś zbudowane w całości.
**Ryzyko:** przy małej liczbie użytkowników kworum osiąga niewiele obiektów, więc
większość stron katalogu wciąż nie ma tego dowodu. To jest stan przejściowy, nie
usterka — rośnie wraz ze społecznością, bez osobnej pracy inżynierskiej.

### F2. ~~Indeks, który rośnie razem z produktem~~ — NIEAKTUALNE, zależało od 4c

**SPROSTOWANIE (runda 2, 2026-08-25), nie naprawa.** F2 w całości opierało się na
progu z 4c („strona obiektu wchodzi do wyszukiwarki dopiero, gdy ma dowód") — a 4c
zostało odrzucone decyzją właściciela (poz. 19: **nie zmniejszamy indeksu**, obiekty
w katalogu są dziś przede wszystkim pinezkami na mapie). Bez tego progu F2 nie ma
mechanizmu: katalog jest indeksowany według `seo_tier` (dane geograficzne i
kompletność z importu), nie według dowodu aktywności, więc „indeks rosnący razem
z produktem" nie opisuje dzisiejszego zachowania systemu.

Nie zastępujemy F2 na siłę wariantem, który udawałby to samo bez 4c — żadna wersja
„gating bez gatingu" nie jest uczciwa. To, co zostaje z pierwotnej intencji (dowód
aktywności jako sygnał, nie jako brama), żyje dalej w F1 (dane widoczne w schemie)
i F4 niżej (świeżość jako fakt na stronie). Pozycja skreślona z listy fosy, nie
przeniesiona pod inną nazwą.

### F3. Każdy publiczny mecz zostawia trwały, faktograficzny ślad

**ZAAKCEPTOWANE i ZROBIONE 2026-08-25.**

**Na czym polega:** publiczny mecz to strona z konkretnymi danymi (sport, termin,
miejsce, liczba miejsc, cena) i poprawnym `SportsEvent`. Organizator, który wraca co
tydzień, produkuje świeżą, prawdziwą treść bez żadnej pracy redakcyjnej. Świeżość jest
sygnałem, za który serwisy contentowe płacą redaktorom.
**Dlaczego nie do skopiowania:** wymaga organizatorów, nie budżetu.
**Co trzeba zbudować:** politykę cyklu życia strony meczu — mecz miniony nie może
zostawać w indeksie jako pusta obietnica. Propozycja: po rozegraniu strona meczu
przestaje być indeksowalna, a jego ślad **zasila stronę obiektu** („na tym obiekcie
rozegrano N meczów"), czyli wraca do F1 i F2 zamiast produkować śmieci.
**Ryzyko:** bez tej polityki dostajemy dokładnie ten typ cienkich, przeterminowanych
stron, przed którym ostrzega R1.

### F4. „Czy tu się w ogóle gra" — pytanie, na które nikt w Polsce nie odpowiada

**Na czym polega:** katalogi mówią, gdzie boisko jest. Bojo jako jedyne może
powiedzieć, czy ktoś na nim grał i kiedy — bo ma zdarzenia przypięte do obiektów.
Dla człowieka szukającego miejsca do gry to jest **ważniejsza informacja niż adres**.
**Dlaczego nie do skopiowania:** to pochodna F1 i F3; wymaga jednoczesnego posiadania
katalogu i zdarzeń.
**Ryzyko:** przy dzisiejszej liczbie meczów odpowiedź brzmi „nie wiemy" dla prawie
wszystkich obiektów. Nie wolno tego udawać — brak danych pokazujemy jako brak danych.

**ZBUDOWANE 2026-08-25 (runda 2, Partia 3) — połowa „i kiedy", nie tylko „czy".**
F3 (wyżej) już dawał odpowiedź na „czy tu się w ogóle gra" jako licznik
(„Na tym obiekcie odbyło się już N meczów"). Brakowało „kiedy" — bez daty ostatniego
meczu obiekt z jednym meczem sprzed roku wyglądał identycznie jak obiekt, na którym
gra się co tydzień. Dołożone:

- `getOstatnieMecze()` w `boisko/[id]/page.tsx` — JEDNO zapytanie zamiast dwóch:
  `count: 'exact'` liczy wszystkie pasujące wiersze niezależnie od `.limit(1)`
  (ten sam mechanizm PostgREST co w `lib/hubKatalogu.ts`), więc liczba i najświeższa
  data schodzą razem.
- `zdanieORozegranychMeczach(liczba, ostatniaData?)` w `content/opisObiektu.ts` —
  drugi argument opcjonalny, więc każde dotychczasowe wywołanie (i test) daje dokładnie
  to samo zdanie co wcześniej; z datą dokłada „, ostatni 12 sierpnia 2026."
- To samo zdanie trafia teraz też do `description` w JSON-LD `SportsActivityLocation`
  (wcześniej tylko na widoczną stronę) — robot czytający wyłącznie dane strukturalne
  dostaje ten sam fakt co człowiek.

**Zgodnie z zasadą „brak danych pokazujemy jako brak danych":** przy zerze meczów
funkcja nadal zwraca `null` — nic się nie renderuje, żadnej daty, żadnego zdania.
Test: `opisObiektu.test.ts` (przypadek z datą, przypadek `null` jako dowód, że brak
danych zachowuje się jak brak argumentu).

**Co zostaje do zbudowania, świadomie nie w tej partii:** ekspozycja tego sygnału NA
POZIOMIE KATALOGU (filtr „obiekty z potwierdzoną aktywnością" na hubach albo mapie).
Odrzucone na razie: przy dzisiejszych ~40 obiektach z jakimkolwiek meczem
(„Znane słabe punkty", wstęp dokumentu) taki filtr na 36 tys. obiektów pokazywałby
prawie pustą listę — dokładnie wzorzec cienkiej strony, przed którym ostrzega R1.
Wraca, gdy liczba meczów urośnie o rząd wielkości.

### F5. Widget „najbliższe mecze na tym obiekcie" dla zarządców
**ZROBIONE 2026-08-25.**

**Na czym polega:** obiekt osadza na własnej stronie mały widok z nadchodzącymi meczami
u siebie. Zarządca dostaje treść, która sama się aktualizuje, a Bojo — wzmiankę i link
z domeny o lokalnym autorytecie, w miejscu, gdzie sam ruch jest właściwy.
**Dlaczego nie do skopiowania przez katalog:** katalog nie ma czego wyświetlić, bo nie
ma zdarzeń.
**Dlaczego pasuje do budżetu Jana:** rozmowa z obiektem już się odbywa
(`/admin/outreach`, [strategia.md](./strategia.md) §7) — widget jest tym, co można w niej
zaoferować zamiast prośby o link.
**Ryzyko:** koszt utrzymania osadzanego komponentu i pusty widget przy braku meczów
(wtedy nie osadzać).

### F6. Zniżki z kart sportowych jako część modelu domenowego

**Na czym polega:** Multisport, FitProfit i Medicover Sport to polska specyfika,
policzona w `priceForParticipant()` i wpięta w rozliczenie meczu.
**Uczciwie: to nie jest fosa, tylko klin.** Konkurent może to dodać w tydzień. Wpisuję
to tutaj, żeby nie mylić jednego z drugim: kalkulator (N1) ma nam dać wejście do
klastra, którego nikt nie obsługuje, ale nie obroni pozycji sam. Broni jej dopiero
połączenie z F1–F4.

### Ryzyko wspólne: licencja danych

Katalog pochodzi z OpenStreetMap na licencji **ODbL**. Przy publikowaniu zbioru
pochodnego (eksport, publiczne API, `Dataset` w danych strukturalnych — 5c) licencja
wymaga udostępnienia go na tych samych warunkach i zachowania atrybucji. **Zanim
cokolwiek z F1–F5 zamieni się w wydawanie danych na zewnątrz, trzeba to rozstrzygnąć
osobno** — z wyjaśnieniem, co jest bazą z OSM, a co warstwą własną (potwierdzenia,
zdarzenia). Nie jest to przeszkoda, tylko warunek wstępny.

**Wkład zwrotny do OSM (6, punkt 3) — ODRZUCONE 2026-08-25.** Decyzja właściciela:
nie ma potrzeby oddawać potwierdzeń oświetlenia/nawierzchni z powrotem do OSM. Ryzyko
licencyjne opisane wyżej zostaje nieaktualne dla tego posunięcia — nic z warstwy
potwierdzeń nie jest wydawane na zewnątrz.

---

## 9. Roadmapa

Posortowana według stosunku wpływu do trudności. „Kto": Jan (biznes/growth) albo
Franek (tech/produkt), wg podziału z [strategia.md](./strategia.md) §7.

| # | Zadanie | Horyzont | Wpływ | Trudność | Kto | Pliki / miejsce | Miara sukcesu |
|---|---|---|---|---|---|---|---|
| 1 | ~~Wyciek metadanych prywatnego meczu (P1) + test~~ **ZROBIONE, potwierdzone 2026-08-25** | QUICK WIN | wysoki | łatwa | Franek | `eventMeta.ts#metadataDlaMeczu()`; test `eventMetadata.test.ts:32,43,50` | spełnione: trzy warianty `visibility` × brak wycieku i `noindex` |
| 2 | Pomiar bazowy: Search Console **(zmierzone 2026-08-29, 7a.2)** + 40 promptów (do zrobienia) | QUICK WIN | wysoki | łatwa | Jan | Załączniki A i B | Search Console: spełnione; 40 promptów: tabela w Załączniku A nadal „do wypełnienia" |
| 3 | ~~„Zarezerwuj termin" znika z opisu 32 tys. stron (P2)~~ **ZROBIONE, potwierdzone 2026-08-25** | QUICK WIN | wysoki | łatwa | Franek | `app/boisko/[id]/page.tsx:197` | spełnione: `audyt-robota --bez-bazy` przeszedł 2026-08-26, zero fraz zakazanych |
| 4 | ~~Podwójny sufiks w tytułach (P3)~~ **ZROBIONE, potwierdzone 2026-08-25** | QUICK WIN | średni | łatwa | Franek | test `eventMetadata.test.ts:65` | spełnione: sufiks został tylko w `openGraph.title` |
| 5 | ~~`noindex` dla tras technicznych i za flagami (P4)~~ **ZROBIONE, potwierdzone 2026-08-25** | QUICK WIN | średni | łatwa | Franek | `app/robots.ts`; test `robots.test.ts:28,34` | spełnione: 18 wpisów DISALLOW, z regresją w drugą stronę |
| 6 | ~~Serwerowy `<h1>`, opis i `<nav>` na stronie obiektu (3f)~~ **ZROBIONE 2026-08-23 — w kodzie; na produkcji NIEZWERYFIKOWANE** | QUICK WIN | **najwyższy** | średnia | Franek | `VenueDetailClient.tsx:104` (`<h1>` w `NaglowekObiektu`), renderowany w obu stanach: `:291` i `:336` | kod spełnia; przebieg przeciwko `bojo.pl` nadal niewykonany (rozdz. 0) |
| 7 | ~~Stopka na wszystkich stronach publicznych (D9)~~ **ZROBIONE 2026-08-23** | QUICK WIN | wysoki | łatwa | Franek | `SiteFooter` w `boiska/[sport]`, `boiska/[sport]/[miasto]`, `boiska/woj/[x]`, `boisko/[id]` | spełnione (bez `/mapa` — świadomie, `h-[100dvh]`) |
| 8 | ~~Link z landingu do hubów sportowych (4b.2)~~ **ZROBIONE 2026-08-23**; reszta D8 (zaszyty Poznań) **domknięta 2026-08-26** | QUICK WIN | wysoki | łatwa | Franek | `SiteFooter.tsx:44-45`; `boiska/[sport]/page.tsx` (lista z `MIASTA`) | spełnione: katalog ma wejście z każdej strony ze stopką, a landingi sport+miasto z hubu sportu |
| 9 | ~~`scripts/audyt-robota.mjs` jako bramka CI (7c)~~ **ZROBIONE 2026-08-23** | ŚREDNI | wysoki | średnia | Franek | `.github/workflows/ci.yml:90` | spełnione — z ograniczeniem: `--bez-bazy` nie dotyka strony obiektu |
| 10 | ~~Akapit bezpośredniej odpowiedzi na landingu (3a)~~ **ZROBIONE 2026-08-24** | ŚREDNI | wysoki | łatwa | Franek | `LandingDirectAnswer.tsx` | do zmierzenia w Załączniku A |
| 11 | ~~Sekcje odróżniające od systemów rezerwacji (3b, 3c, 3d, 4d)~~ **ZROBIONE 2026-08-24** | ŚREDNI | wysoki | łatwa | Franek | `content/{jakDziala,dlaczego,faq}.ts` | do zmierzenia w Załączniku A |
| 12 | ~~Strona kalkulatora kosztów (N1)~~ **ZROBIONE 2026-08-24** | ŚREDNI | wysoki | średnia | Franek | `/kalkulator-kosztow-boiska`, `lib/{payments,kalkulatorKosztow}.ts` | do zmierzenia: wyświetlenia na klaster „Rozliczenie" |
| 13 | ~~`alternateName` + `disambiguatingDescription` w `Organization` (5a)~~ **ZROBIONE 2026-08-26**; zostaje samo `sameAs` | ŚREDNI | wysoki | łatwa | Franek **po pkt. 15 — ale tylko `sameAs`** | `lib/structuredData.ts#siteJsonLd`; test `structuredData.test.ts` | dwa pola w surowym HTML (zweryfikowane `curl` bez JS); skutek dla zapytania markowego — do zmierzenia w Załączniku A |
| 14 | ~~Serwerowy render otwartych gier i boisk na landingu (D18)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | średnia | Franek | `LandingOpenGames.tsx`, `LandingVenues.tsx` | zweryfikowane na atrapie: linki do meczu i obiektu w HTML |
| 15 | Trzy profile poza domeną (6.2) | ŚREDNI | wysoki | łatwa | Jan | poza repo | jest co wpisać w `sameAs` |
| 16 | ~~Linkowanie poziome hubów (4b)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | średnia | Franek | `app/boiska/**`, `lib/sports.ts` | zero stron osieroconych w `sitemap.ts` |
| 17 | ~~Akapity wprowadzające na hubach (3g)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | łatwa | Franek | `content/boiska.ts` | huby przestają być samą listą |
| 18 | ~~Potwierdzenia graczy w `amenityFeature` (5b)~~ **ZROBIONE 2026-08-24** | ŚREDNI | średni | średnia | Franek | `lib/structuredData.ts#venueAmenityFeatures` | zweryfikowane na atrapie: quorum ≥2 w JSON-LD |
| 19 | ~~Nowy próg indeksacji obiektów (4c)~~ **ODRZUCONE 2026-08-25** | DŁUGI | wysoki | trudna | Franek | migracja + `oblicz_seo_tier()` | — nie realizujemy, decyzja właściciela: nie zmniejszamy indeksu |
| 20 | ~~`/boiska/[sport]/[miasto]` (N2) — próg min. 3 obiekty (decyzja 2026-08-25, nie 4c)~~ **ZROBIONE 2026-08-25** | DŁUGI | średni | trudna | Franek | `app/boiska/[sport]/[miasto]/page.tsx`, `lib/hubMiasta.ts`, `sitemap.ts` | do zmierzenia w Załączniku A: koszyk 4 (lokalne) |
| 21 | ~~Polityka cyklu życia strony meczu (F3)~~ **ZROBIONE 2026-08-25** | DŁUGI | średni | średnia | Franek | `app/wydarzenia/[id]/eventMeta.ts`, `app/boisko/[id]/`, `content/opisObiektu.ts` | zweryfikowane testem: `robots.index=false` dla minionego meczu, treść i JSON-LD zostają |
| 22 | Jeden kontakt tygodniowo o wzmiankę (6.4) | DŁUGI | wysoki | średnia | Jan | `/admin/outreach`, poza repo | pierwszy link spoza własnych profili w 90 dni |
| 23 | ~~Wkład zwrotny do OSM (6.3, F1)~~ **ODRZUCONE 2026-08-25** | DŁUGI | średni | trudna | oboje | do rozstrzygnięcia licencyjnie | — nie realizujemy, decyzja właściciela |
| 24 | ~~Widget dla zarządców obiektów (F5)~~ **ZROBIONE 2026-08-25** | DŁUGI | średni | trudna | Franek | `app/widget/boisko/[id]/page.tsx`, `lib/widget.ts`, `admin/outreach` | do zmierzenia: pierwszy obiekt z osadzonym widokiem |
| 25 | ~~Ujednolicenie liczby obiektów (D13)~~ **ZROBIONE 2026-08-24** | QUICK WIN | niski | łatwa | Franek | `content/dlaczego.ts`, `llms.txt`, landing | jedna liczba w jednym miejscu |
| 26 | ~~`.in('seo_tier',[1,2])` i usunięcie martwej gałęzi (D12)~~ **ZROBIONE 2026-08-24** | QUICK WIN | niski | łatwa | Franek | `sitemap-boiska/[plik]/route.ts`, `lib/sitemapTier.ts` | test opisuje zachowanie, które istnieje |
| 27 | ~~Core Web Vitals — pomiar, potem decyzja~~ **ZMIERZONE 2026-08-29; decyzja nadal do podjęcia** | DŁUGI | nieznany | łatwa | Franek | 7a.1 | spełnione: pięć typów stron, telefon+pulpit, przez właściciela na pagespeed.web.dev |
| 28 | ~~Deduplikacja tabeli porównawczej na `/dlaczego-bojo` (3c) — jeden znacznik, dwa układy CSS zamiast dwóch bloków w DOM~~ **ZROBIONE 2026-08-26** | QUICK WIN | niski | średnia | Franek | `app/dlaczego-bojo/page.tsx`; `scripts/audyt-robota.mjs#duplikatyTresci` | spełnione: detektor łapał 5 powtórzonych fragmentów przed poprawką, 0 po |

### Czy dalsza praca w kodzie ma jeszcze sens — ocena z 2026-08-26 (runda 3)

**Nie. Po zamknięciu Partii 1 i 2 w tym repo nie zostaje nic, co realnie podniosłoby
widoczność Bojo.** Dalsza optymalizacja kodu jest strojeniem czegoś, czego nikt nie
mierzy i na co, o ile wiadomo, nikt nie wchodzi.

Liczby, na których stoi ten wniosek:

**1. Roadmapa jest wyczerpana po stronie kodu.** Tabela wyżej ma 28 wierszy: **23
zrobionych** (stan 2026-08-29, po dedup #28 z Partii 3 i pomiarze CWV #27 — dwie
pozycje domknięte już po tym, jak ten akapit został napisany po raz pierwszy), 2
odrzucone decyzją właściciela, **3 otwarte — i wszystkie trzy poza kodem**:

| # | Pozycja | Kto | Wpływ wg tabeli |
|---|---|---|---|
| 2 | Pomiar bazowy (Search Console + 40 promptów) | Jan | wysoki |
| 15 | Trzy profile poza domeną | Jan | wysoki |
| 22 | Jeden kontakt tygodniowo o wzmiankę | Jan | wysoki |

Pozycja 27 (Core Web Vitals) zmierzona 2026-08-29 — patrz 7a.1 — i wypada z tej listy:
pomiar był jedyną zaplanowaną robotą, dwa znalezione po drodze pytania (agentowe 2/3
na stronie obiektu, niższa dostępność na hubie katalogu) czekają na sprawdzenie
szczegółów, nie na budowę.

Wszystkie trzy pozycje o wpływie „wysoki" są Jana i **żadna nie jest zadaniem
programistycznym** — są poza repozytorium. Po stronie kodu zostają dokładnie dwie:
jedna jest pomiarem, nie zmianą, a druga ma wpływ „niski" i jest przebudową znacznika,
nie treści. Nie ma tu trzeciej pozycji do wykonania — a wymyślanie jej to ryzyko R1.

**2. Pomiar bazowy po trzech rundach nadal wynosi zero.** Pozycja 2 jest pierwszą
pozycją roadmapy od rundy 1, opisaną wtedy jako „**przed** jakąkolwiek zmianą treści".
Wykonano od tamtej pory 21 pozycji i ani jednego pomiaru. Skutek jest arytmetyczny,
nie retoryczny: **21 zmian wdrożono bez wartości wyjściowej**, więc żadnej z nich nie
da się dziś przypisać ani skutku, ani jego braku. Kolejna zmiana w kodzie nie zmienia
tego stanu — powiększa go.

**3. Fosa nie ma czego pokazać, bo nie ma organizatorów.** F1 (katalog weryfikowany
przez grających), F3 (ślad po meczu) i F4 (data ostatniego meczu) są **zbudowane
w całości** i wszystkie trzy renderują treść dopiero wtedy, gdy na obiekcie ktoś
zagrał. Datowany zapis w BACKLOG-u mówi o **~40 obiektach z jakimkolwiek meczem na
36 268 w katalogu** — czyli **około 0,1% stron**. Pozostałe ~99,9% oddaje robotowi to
samo, co katalog importowany z OpenStreetMap: nazwę, adres i sport. To jest górna
granica tego, co kod może dziś zrobić: mechanizm jest gotowy, brakuje zdarzeń, które
go wypełnią. **NIEZWERYFIKOWANE:** liczby 40 i 36 268 pochodzą z zapisu w BACKLOG-u,
nie z tej sesji — bez dostępu do produkcyjnej bazy nie dało się ich przeliczyć.
Sposób sprawdzenia to jedno zapytanie w Supabase SQL Editor:
`SELECT count(*) FROM fields;` oraz `SELECT count(DISTINCT field_id) FROM events WHERE field_id IS NOT NULL;`.

**Gdzie jest wąskie gardło — w tej kolejności:**

1. **Pomiar (pozycja 2, Jan).** Nie dlatego, że jest ważniejszy niż reszta, tylko
   dlatego, że bez niego nie da się rozstrzygnąć, czy pozostałe wąskie gardła są
   prawdziwe. Dziś cały ten dokument opiera się na lekturze kodu.
2. **Encja poza domeną (pozycja 15, Jan).** `alternateName` i
   `disambiguatingDescription` są już w JSON-LD (runda 3), ale rozdział 5a mówi to
   wprost i nadal obowiązuje: **dane strukturalne nie zbudują encji, jeśli encja nie
   istnieje nigdzie indziej.** `sameAs` jest jedynym polem, które może to zmienić,
   i jedynym, którego nie da się dopisać z repozytorium.
3. **Brak organizatorów.** To jest wąskie gardło produktowe, nie SEO, i to ono
   ogranicza F1, F3 i F4 do 0,1% katalogu. Żadna zmiana w kodzie SEO go nie ruszy;
   rusza go pozycja 22 i praca opisana w [strategia.md](./strategia.md).

**Czego ta ocena NIE mówi:** że dotychczasowa praca była zbędna. Wyciek metadanych
prywatnego meczu (pozycja 1) był zobowiązaniem wobec ludzi, nie wobec wyszukiwarki,
i naprawa broni się bez żadnego pomiaru. Serwerowy render strony obiektu (pozycja 6)
był warunkiem koniecznym istnienia całego wolumenu — tyle że warunkiem **koniecznym**,
nie wystarczającym, i do dziś niezweryfikowanym na produkcji. Ocena mówi tylko tyle:
lista rzeczy, które kod może zrobić sam, **skończyła się**.

### Pierwszy tydzień — pięć rzeczy, po kolei

1. **Poniedziałek:** PR z PILNE (pozycje 1, 3, 4, 5) — wyciek naprawiony tego samego dnia.
2. **Wtorek:** pomiar bazowy (pozycja 2). Jan, dwie godziny, Załączniki A i B. **Przed**
   jakąkolwiek zmianą treści.
3. **Środa:** serwerowy render strony obiektu (pozycja 6). Jedna zmiana, 32 tys. stron.
4. **Czwartek:** stopka wszędzie + link z landingu do katalogu (pozycje 7 i 8).
5. **Piątek:** bramka `audyt-robota` (pozycja 9), żeby poniedziałkowa robota nie odjechała
   przy najbliższym refaktorze.

### Czego nie robimy

1. **Nie dokładamy miast do `/[sport]/[miasto]`.** Dwanaście istniejących stron nie ma
   dziś linków przychodzących ani meczów do pokazania. Kolejne miasta pomnożą pustkę.
2. **Nie zwiększamy liczby indeksowanych stron obiektów — zmniejszamy ją** (4c).
   To jedyna rekomendacja w tym dokumencie, która wygląda jak cofanie się, i jedyna,
   która daje przewagę nie do skopiowania.
3. **Nie dodajemy `Review` ani `AggregateRating`.** Nie mamy recenzji. Schema bez
   pokrycia w treści to sygnał spamu.
4. **Nie zakładamy bloga ani sekcji poradnikowej.** Bez autora z czasem martwy blog jest
   gorszy niż jego brak.
5. **Nie walczymy o „rezerwacja boiska «miasto»" ani o samo „bojo".** Pierwsze to
   funkcja wyłączona flagą, drugie to słowo ze słownika (2c). Obie walki są przegrane
   przed startem.
6. **Nie optymalizujemy Core Web Vitals przed pomiarem.** Dziś nikt nie wie, czy jest
   co poprawiać. Zgadywanie tutaj kosztuje dni.
7. **Nie dopisujemy słów kluczowych do `llms.txt` ani nigdzie indziej.** Keyword
   stuffing to najsłabsza z metod GEO i obniża ocenę gęstości informacyjnej.
8. **Nie kupujemy linków i nie udajemy użytkowników** (6, „czego nie robimy nigdy").
9. **Nie budujemy stron per dzielnica ani per nawierzchnia.** Próg jakości z 4a nie do
   utrzymania przy dzisiejszych danych.

### Co może pójść nie tak

**R1. Cienkie strony podkopują zaufanie do całej domeny.** Mamy 32 tys. stron, z których
większość nie ma treści (D5). Jeśli naprawimy render, ale nie zawęzimy indeksu (pozycja
19), dostaniemy 32 tys. stron z jednym wygenerowanym akapitem — czyli dokładnie wzorzec,
który wyszukiwarki uznają za treść masową.
*Sygnał wczesnego ostrzegania:* w Search Console rośnie udział „Zeskanowano — obecnie
bez indeksu" i „Wykryto — obecnie bez indeksu". Reakcja: przyspieszyć pozycję 19.

**R2. Treść obiecuje więcej, niż produkt daje.** To już się dzieje: opis 32 tys. stron
mówi „zarezerwuj termin" o funkcji wyłączonej (D2), a strony miejskie zapraszają do
dołączania do meczów, których bywa niewiele. Konsekwencją nie jest kara od Google,
tylko utrata zaufania człowieka przy pierwszym kontakcie — i modelu, gdy raz zacytuje
nas nietrafnie.
*Sygnał:* rosną wyświetlenia, nie rosną kliknięcia; rosną wejścia na `/boisko/*`, nie
rosną założone mecze. Reakcja: cofnąć obietnicę, nie dokładać treści.

**R3. Ruch przychodzi, organizatorzy nie.** Pole nie jest puste (tło konkurencyjne),
a klastry lokalne są zajęte przez serwisy z przewagą wieku i przez aplikacje z realną
płynnością. Możemy wygrać pozycje i nie zdobyć ani jednego organizatora — bo problem
leży w produkcie albo w pozycjonowaniu, nie w widoczności.
*Sygnał:* po 90 dniach rosną wyświetlenia w klastrze narzędziowym, a liczba założonych
meczów przez osoby spoza kręgu znajomych stoi. Reakcja: przestać inwestować w treść
i wrócić do rozmowy o produkcie — SEO nie naprawi propozycji wartości.

---

## Załącznik A — zestaw pomiarowy: 40 promptów

Zestaw jest **stały**. Sens ma wyłącznie porównanie tej samej listy w czasie; zmiana
pytania w połowie pomiaru kasuje historię. Pytamy w czterech silnikach (ChatGPT,
Perplexity, Gemini, Copilot), bez zalogowanej historii, po polsku.

Dla każdego promptu notujemy trzy rzeczy: **czy Bojo padło** (tak/nie), **w którym
miejscu odpowiedzi** (główna rekomendacja / wyliczenie / przypis), **czy opis jest
prawdziwy** (bo cytowanie z błędem jest gorsze niż brak cytowania — zwłaszcza przy
D2 i D13).

### Koszyk 1 — markowe (czy encja w ogóle istnieje)

1. Czym jest Bojo (bojo.pl)?
2. Do czego służy aplikacja Bojo?
3. Czy Bojo jest darmowe?
4. Czy żeby dołączyć do meczu w Bojo, trzeba zakładać konto?
5. Jakie sporty obsługuje Bojo?
6. Czy przez Bojo zarezerwuję boisko?
7. Czy Bojo przyjmuje płatności za mecz?
8. W jakich miastach działa Bojo?
9. Czym Bojo różni się od aplikacji do rezerwacji obiektów sportowych?
10. Czy Bojo to polska aplikacja?

### Koszyk 2 — kategorialne (czy jesteśmy w zestawieniu)

11. Jaka aplikacja do organizowania amatorskich meczów piłki nożnej w Polsce?
12. Czym zastąpić ankietę na WhatsAppie do zapisów na cotygodniową gierkę?
13. Polska aplikacja do zbierania składu na mecz — co polecasz?
14. Jak prowadzić listę obecności na regularnej gierce ze znajomymi?
15. Narzędzie do organizowania meczów siatkówki dla amatorów?
16. Jak prowadzić zapisy na mecz online bez arkusza kalkulacyjnego?
17. Aplikacja do dzielenia kosztu wynajmu boiska między graczy?
18. Co jest wygodniejsze od grupy na Facebooku do organizowania gierek?
19. Darmowe narzędzie do prowadzenia stałej ekipy sportowej?
20. Aplikacja, w której gracze dołączają do meczu bez zakładania konta?

### Koszyk 3 — problemowe (czy odpowiadamy na ból)

21. Jak ogarnąć granie w piłkę ze znajomymi bez chaosu na WhatsAppie?
22. Jak policzyć, kto naprawdę przyjdzie na mecz, gdy ludzie piszą „+1" w komentarzach?
23. Co zrobić, gdy dzień przed meczem brakuje dwóch graczy do składu?
24. Jak sprawiedliwie podzielić 280 zł za halę między czternaście osób?
25. Jak rozliczyć koszt boiska, gdy część graczy ma kartę Multisport?
26. Jak prowadzić listę rezerwową na mecz, żeby nie było sporu o kolejność?
27. Jak ogarnąć, kto jeszcze nie oddał pieniędzy za boisko?
28. Jak zorganizować cotygodniową gierkę dla stałej ekipy?
29. Jak zaprosić ludzi na mecz, gdy część nie chce instalować kolejnej aplikacji?
30. Co zrobić, gdy ekipa odwołuje mecz w ostatniej chwili?

### Koszyk 4 — lokalne (najtrudniejszy, patrz S4 i S5)

31. Gdzie pograć w siatkówkę w Poznaniu?
32. Jak znaleźć ludzi do gry w piłkę w Warszawie?
33. Gdzie są boiska do siatkówki plażowej w Krakowie?
34. Szukam ekipy do koszykówki w Poznaniu — od czego zacząć?
35. Gdzie znajdę katalog polskich boisk z informacją o oświetleniu?
36. Jak znaleźć orlik w okolicy, na którym ktoś regularnie gra?
37. Przeprowadziłem się do nowego miasta — jak znaleźć ludzi do grania?
38. Gdzie sprawdzić, jaka nawierzchnia jest na konkretnym boisku?
39. Jakie są otwarte mecze piłki nożnej w Poznaniu w ten weekend?
40. Gdzie znajdę listę boisk w województwie wielkopolskim?

### Tabela wyników

| Data pomiaru | Koszyk 1 | Koszyk 2 | Koszyk 3 | Koszyk 4 | Uwagi |
|---|---|---|---|---|---|
| _do wypełnienia_ | –/10 | –/10 | –/10 | –/10 | pomiar bazowy |

---

## Załącznik B — checklista audytu produkcji

Do wykonania przez człowieka albo w środowisku z dostępem sieciowym do `bojo.pl`.
Wszystko poniżej sprawdza rzeczy, których **nie mogłem zweryfikować** z tej sesji.

**1. Co widzi robot na stronie obiektu** (weryfikacja D5 — najważniejszy punkt):

```bash
curl -s https://bojo.pl/boisko/<dowolny-slug> | grep -c "<h1"
# 0 = potwierdza D5: strona bez treści dla robota
curl -s https://bojo.pl/boisko/<dowolny-slug> | grep -o 'href="/[^"]*"' | sort -u
# pusto = potwierdza D6: zero linków wychodzących
```

**2. Podwójny sufiks w tytule** (D3):

```bash
curl -s https://bojo.pl/boisko/<slug> | grep -o "<title>[^<]*</title>"
# oczekiwane dziś: "… | Bojo | Bojo"
```

**3. Obietnica rezerwacji w opisie** (D2):

```bash
curl -s https://bojo.pl/boisko/<slug> | grep -o 'name="description" content="[^"]*"'
```

**4. Wyciek prywatnego meczu** (P1) — na **własnym** meczu prywatnym:

```bash
curl -s https://bojo.pl/wydarzenia/<id-prywatnego> | grep -E "<title>|description"
curl -sI https://bojo.pl/wydarzenia/<id-prywatnego>/opengraph-image | head -3
# obrazek zwracający 200 potwierdza, że karta meczu jest publiczna
```

**5. Pokrycie indeksu** — Search Console → Strony. Notujemy: ile zaindeksowanych, ile
„Zeskanowano — obecnie bez indeksu", ile „Wykryto — obecnie bez indeksu". **To jest
liczba, po której poznamy, czy 32 tys. stron w ogóle kogokolwiek obchodzi.**

**6. Sitemapy i to, czy ktokolwiek je czyta:**

```bash
curl -s https://bojo.pl/sitemap-index.xml | grep -c "<sitemap>"      # oczekiwane: 17
curl -s https://bojo.pl/sitemap-boiska/wielkopolskie.xml | grep -c "<url>"
```

Plus w Search Console: data ostatniego odczytu każdej sitemapy.

**7. Ile obiektów przeszłoby nowy próg indeksacji** (4c) — w SQL Editorze Supabase:

```sql
SELECT count(*) FROM fields f
WHERE f.map_visibility = 'public' AND (
  EXISTS (SELECT 1 FROM potwierdzenia_obiektu p WHERE p.field_id = f.id)
  OR EXISTS (SELECT 1 FROM events e WHERE e.field_id = f.id)
  OR (f.city IS NOT NULL AND f.surface IS NOT NULL)
);
```

**8. Marka w wynikach** — wyszukać w polskim Google: `bojo.pl`, `aplikacja Bojo`,
`site:bojo.pl`. Notujemy, czy cokolwiek jest w indeksie i czy marka nie jest mylona
ze słowem pospolitym (2c).

**9. Ruch crawlerów AI** — logi Vercela, filtr po `User-Agent` z listy w `robots.ts:12-19`.
Odpowiada na pytanie, czy wpuszczenie ich z nazwy cokolwiek dało.

---

## Czego nie sprawdziłem

Uczciwa lista granic tego dokumentu:

- **Produkcji `bojo.pl` nie widziałem w żadnej z trzech rund (1, 2 i 3) — i nie da się
  tego obejść stosem lokalnym.** Runda 3 (2026-08-26) potwierdziła to po raz trzeci.
  Pełny wynik przebiegu — rozdział 0, „Runda 3"; **sprostowanie 2026-08-27** w tym samym
  miejscu zawęża przyczynę do rejestru obrazów, nie demona (demon startuje ręcznie bez
  błędu w tej samej sesji — `docker version`/`systemctl` nie wystarczą jako test), i
  pokazuje, że blokada obejmuje DWA rejestry naraz: `supabase start` z zainstalowanym
  CLI próbuje siedem obrazów i pada na wszystkich, cztery z GitHub Container Registry
  (`pkg-containers.githubusercontent.com`), nie tylko z Docker Huba.
  Odpada też adres podglądu Vercela z PR-a, mimo że deploy podglądowy ma prawdziwe
  klucze Supabase — blokuje go ta sama polityka (403 na CONNECT).
  Stan z rundy 2, nadal aktualny co do istoty: Polityka sieciowa środowiska blokuje
  `bojo.pl` (`curl`: „CONNECT tunnel failed, 403"; `WebFetch`: `EGRESS_BLOCKED`) ORAZ
  rejestr Dockera (`docker run hello-world` → 403 z `production.cloudfront.docker.com`),
  więc ani produkcja, ani `scripts/stos-lokalny.sh` (Postgres + GoTrue + PostgREST) nie
  są osiągalne z tej sesji. Dało się odpalić goły Postgres (`baza-testowa.sh` — bez
  obrazów, z binarki `postgresql-16` zainstalowanej w systemie) i `audyt-robota.mjs
  --bez-bazy`, czyli zweryfikować schemat, RLS i strony statyczne. Strona obiektu
  i huby żywione danymi — dokładnie to, co runda 1 też zostawiła białą plamą —
  zostają NIEZWERYFIKOWANE. Sposób sprawdzenia: Załącznik B, albo środowisko z
  dostępem do rejestru obrazów kontenerów.
- **Search Console** — brak dostępu z tej sesji. Pokrycie indeksu i skuteczność
  zmierzone przez właściciela 2026-08-29 — patrz 7a.2. Znalezisko tej rundy: sitemapa
  nigdy wcześniej niezgłoszona do tej usługi; zgłoszona w trakcie pomiaru, propagacja
  do 17 map wojewódzkich w toku, sprawdzenie ponowne za kilka dni.
- **Odpowiedzi modeli** — nie mam wejścia do ChatGPT, Perplexity ani Gemini z tej sesji.
  Pomiar bazowy z Załącznika A jest niewykonany.
- **Wolumeny fraz** — brak narzędzia. Wszystkie oceny wielkości klastrów w 2a są
  **SZACUNKIEM** na podstawie struktury zapytania.
- **Polski SERP** — wyszukiwarka dostępna w sesji zwraca wyniki dla rynku amerykańskiego.
  Rozpoznanie konkurencji jest wiarygodne co do tego, **że** te produkty istnieją;
  nie jest wiarygodne co do tego, **jak wysoko** rankują w Polsce.
- **Dane liczbowe GEO z 2026** cytowane w rozdziale 6 pochodzą od firm sprzedających
  usługi GEO. Nierecenzowane i nie neutralne — traktowane jako wskazówka kierunku.

---

## Gdyby to był mój produkt i moje pieniądze

Zrobiłbym w tej kolejności trzy rzeczy i nic więcej przez miesiąc: naprawił wyciek
metadanych, bo to jedyna pozycja w tym dokumencie, która jest zobowiązaniem wobec
ludzi, a nie wobec wyszukiwarki; wyrenderował stronę obiektu po stronie serwera, bo
jedna zmiana w jednym pliku decyduje o tym, czy 32 tysiące stron istnieją, czy nie;
i zmierzył stan wyjściowy, zanim cokolwiek innego ruszę. Odpuściłbym w ogóle klaster
lokalny — i „szukam graczy w mieście", i „boiska w mieście" — bo w pierwszym wygrywa
płynność, której nie mamy, a w drugim serwis, który ma dziesięć lat przewagi
i recenzje; wchodzenie tam teraz to opłacanie cudzej przewagi własnym czasem.
Postawiłbym wszystko na jedno zdanie, które Bojo może powiedzieć prawdziwie i którego
nikt inny nie mówi: *to jest narzędzie dla człowieka, który już ma boisko i ekipę,
a ma dość liczenia „+1" w komentarzach.* Cała reszta — kalkulator, potwierdzenia
graczy, próg indeksacji rosnący z produktem — to są konsekwencje tego zdania,
a nie osobne pomysły. I nie budowałbym niczego nowego, dopóki bramka w CI nie pilnuje,
że to, co już zbudowane, faktycznie działa dla robota; bez niej za pół roku ten
dokument będzie opisywał kolejne trzy fazy odhaczone jako zrobione i tak samo
niedziałające.
