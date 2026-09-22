# Turniej: galeria zdjęć i sponsorzy — specyfikacja wdrożenia

> Zgłoszone 2026-09-19 przy okazji przywrócenia zakładki „Info" (PR #403, patrz
> `BACKLOG.md` §6). Ten plik jest odniesieniem historycznym dla implementacji —
> aktualizuj go, gdy realny kształt kodu odjedzie od tego, co tu zapisane (a nie
> odwrotnie: kod ma się z tym zgadzać, chyba że podejmiesz nową decyzję).
>
> Stan repo w chwili pisania: ostatnia migracja `157`, `SHOW_TURNIEJE = false`
> (moduł nadal wyłączony po przeglądzie z 2026-09-17, dostępny pod bezpośrednim
> linkiem). Sprawdź to na nowo przed wdrożeniem — moduł zmienia się szybko
> (Franek aktywnie nad nim pracuje, patrz `git log --oneline -- 'frontend/src/**/turniej*'`).
>
> **Aktualizacja 2026-09-22 — Etap 0 zrobiony (patrz §9).** Numer `158` z §4
> zajęła w międzyczasie inna migracja („Potwierdzenia graczy wpuszczają
> boisko do indeksu"); migracja galerii/sponsorów startuje od kolejnego
> wolnego numeru w chwili wdrożenia (`ls supabase/migrations/ | tail -1`),
> nie od `158`. `SHOW_TURNIEJE` nadal `false`.

## 0. Czego NIE budujemy teraz

Pierwotne zgłoszenie mówiło o trzech rzeczach: „galeria zdjęć", „sponsorzy,
logotypy" i „rozbudowane info o organizatorze". Trzecia część **nie dostaje
nowego modelu danych** — organizator ma już publiczny profil (`/gracz/[id]`,
link z zakładki Info), `opis` i `regulamin` turnieju to wolny tekst, a
ogłoszenia (migracja `150`) to kanał na bieżące komunikaty. Jeśli po zrobieniu
galerii i sponsorów nadal będzie brakować czegoś konkretnego o organizatorze
(np. logo firmy-organizatora, nie osoby) — to osobna, węższa decyzja do
podjęcia później, nie część tego planu.

Poza zakresem: kolejność zdjęć drag-and-drop (wystarczą strzałki góra/dół),
wideo, zdjęcia od uczestników (tylko organizator dodaje), edycja/kadrowanie
w przeglądarce (upload całego pliku, tak jak `CoverUpload`), limit sponsorów
egzekwowany w bazie (UI wystarczy).

## 1. Zatwierdzone decyzje

| # | Decyzja | Uzasadnienie |
|---|---|---|
| 1 | Dwie nowe tabele: `turniej_zdjecia`, `turniej_sponsorzy` | Osobne encje, osobne porządkowanie (`kolejnosc`), osobne cykle życia |
| 2 | Nowy bucket Storage `turniej-media`, NIE `covers` | `covers` (migracja `046`) ma politykę wyłącznie po `bucket_id` — każdy zalogowany może nadpisać/skasować CUDZE zdjęcie. Nowy bucket dostaje politykę PO ŚCIEŻCE (`czy_zarzadza_turniejem()` na segment ścieżki) — patrz §4. Nie naprawiamy `covers` przy okazji — to osobne ryzyko, osobna decyzja |
| 3 | Czyta każdy, zarządza wyłącznie `czy_zarzadza_turniejem()` | Tak samo jak ogłoszenia (migracja `150`) i terminarz — to treść PUBLICZNA turnieju, nie coś drużynowego. Kapitan NIE dokłada zdjęć ani sponsorów |
| 4 | Zdjęcie okładki (`turnieje.okladka_url`) to ODDZIELNA sprawa, robimy ją jako Etap 0 tego planu | Kolumna i `setOkladkaTurnieju()` istnieją od Etapu 0 modułu (2026-09-13), bucket `covers` już ma politykę — brakuje wyłącznie `<CoverUpload>` w UI. Jeden komponent, zero nowej migracji, dobra rozgrzewka przed resztą |
| 5 | Logo sponsora jest OPCJONALNE | Sponsor bez logo (sam tekst + link) ma sens — mały sponsor bez przygotowanej grafiki nie ma być wykluczony |

## 2. Mapa plików

```
supabase/migrations/
  158_turniej_galeria_sponsorzy.sql   turniej_zdjecia, turniej_sponsorzy, RLS,
                                       polityki storage.objects dla 'turniej-media'
supabase/test/rls.sql                 nowa sekcja: zdjęcia i sponsorzy

frontend/src/types/index.ts           TurniejZdjecie, TurniejSponsor

frontend/src/lib/
  turniejGaleria.ts          nowy: CRUD zdjęć i sponsorów + upload/usuwanie z Storage
  storageUpload.ts           nowy: wspólna walidacja (rozmiar, typ) + upload,
                              wydzielona z CoverUpload.tsx, żeby nie kopiować
                              tej samej walidacji trzeci raz

frontend/src/components/turnieje/
  Galeria.tsx                 nowy: siatka miniatur + lightbox, w zakładce Info
  Lightbox.tsx                 nowy: pełnoekranowy podgląd, wzorem istniejących
                               dialogów (overlay + Escape + klik w tło)
  Sponsorzy.tsx                nowy: rząd logotypów, w zakładce Info
  PanelGaleria.tsx              nowy: zarządzanie zdjęciami w panelu (dodaj/usuń/kolejność)
  PanelSponsorzy.tsx            nowy: zarządzanie sponsorami w panelu (dodaj/edytuj/usuń)

frontend/src/app/turnieje/[id]/TurniejClient.tsx   Galeria + Sponsorzy w zakładce Info
frontend/src/app/turnieje/[id]/panel/PanelClient.tsx
  zakładka Ustawienia: <CoverUpload> dla okładki (Etap 0) + dwie nowe sekcje
  (Etap 2/3) — NIE nowa zakładka panelu (dziś 5, szósta powtórzyłaby błąd
  „Drabinka" z 2026-09-17: nie mieści się w szerokości telefonu)

frontend/src/__tests__/
  turniejGaleria.test.ts      czyste funkcje (sortowanie po kolejności, walidacja)
```

## 3. Kontrakt typów

Blok do `frontend/src/types/index.ts`, obok istniejących `TurniejOgloszenie`:

```ts
export interface TurniejZdjecie {
  id: string;
  turniejId: string;
  url: string;
  kolejnosc: number;
  dodanePrzez?: string;
  createdAt: string;
}

export interface TurniejSponsor {
  id: string;
  turniejId: string;
  nazwa: string;
  logoUrl?: string;
  link?: string;
  kolejnosc: number;
  createdAt: string;
}
```

**Baza trzyma `sciezka` (ścieżka w Storage), typ TS trzyma `url` (publiczny adres).**
Mapowanie `sciezka` → `url` liczy `toZdjecie()`/`toSponsor()` przez
`supabase.storage.from('turniej-media').getPublicUrl(sciezka)` — nie trzymamy
gotowego URL-a w bazie. Powód: każdy upload dostaje NOWĄ ścieżkę (UUID w nazwie
pliku, nie nadpisanie w miejscu jak `CoverUpload`), więc nie ma problemu
cache'owania, który `CoverUpload` rozwiązuje dopisując `?t=<timestamp>` — tu
adres jest raz na zawsze poprawny, licząc go za każdym odczytem unikamy
przechowywania dwóch źródeł prawdy (ścieżka + adres, które mogłyby się rozjechać,
gdyby ktoś kiedyś zmienił nazwę bucketu).

## 4. Migracja 158 — szkic SQL

Numer do weryfikacji przy wdrożeniu (`ls supabase/migrations/ | tail -1`) — jeśli
master poszedł dalej, przesuń. Idempotentna, jak każda migracja w tym repo.

```sql
-- 158_turniej_galeria_sponsorzy.sql — galeria zdjęć i sponsorzy turnieju.
-- ============================================================================
-- PO CO. Zgłoszone przy przeglądzie modułu: turniej dziś nie ma jak pokazać
-- atmosfery z poprzedniej edycji ani podziękować sponsorom. Obie rzeczy to
-- treść PUBLICZNA (jak terminarz, jak ogłoszenia) — czyta każdy, dokłada
-- wyłącznie zarządzający turniejem.
--
-- BUCKET 'turniej-media' — załóż ręcznie w Supabase Dashboard → Storage jako
-- PUBLICZNY (ten sam krok co przy 'covers', migracja 046), DOPIERO POTEM
-- uruchom tę migrację. Bez bucketu polityki poniżej nie mają czego pilnować,
-- ale też nic nie zepsują — CREATE POLICY na storage.objects nie wymaga,
-- żeby bucket już istniał.
--
-- ŚCIEŻKA JEST GRANICĄ DOSTĘPU, NIE TYLKO KONWENCJĄ. `covers` (046) ma
-- politykę WYŁĄCZNIE po `bucket_id` — każdy zalogowany może nadpisać albo
-- skasować CUDZE zdjęcie, bo nic w polityce nie sprawdza, czyj to obiekt.
-- Tu ścieżka ma sztywny kształt `turnieje/<turniej_id>/galeria/<uuid>.<ext>`
-- albo `.../sponsorzy/<uuid>.<ext>`, a polityka czyta drugi segment ścieżki
-- (`storage.foldername(name)`) jako `turniej_id` i woła `czy_zarzadza_turniejem()`
-- — dokładnie tę samą funkcję, co polityki na zwykłych tabelach. Nie da się
-- wgrać pliku pod cudzy turniej, nawet znając jego UUID.
-- ============================================================================

-- ── 1. Zdjęcia ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_zdjecia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id   uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  sciezka      text NOT NULL,
  kolejnosc    int NOT NULL DEFAULT 0,
  dodane_przez uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zdjecia_turniej ON turniej_zdjecia(turniej_id, kolejnosc);

ALTER TABLE turniej_zdjecia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zdjecia czyta kazdy" ON turniej_zdjecia;
CREATE POLICY "Zdjecia czyta kazdy" ON turniej_zdjecia FOR SELECT USING (true);

DROP POLICY IF EXISTS "Zdjecia zarzadza organizator" ON turniej_zdjecia;
CREATE POLICY "Zdjecia zarzadza organizator" ON turniej_zdjecia FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));

-- ── 2. Sponsorzy ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_sponsorzy (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  nazwa      text NOT NULL CHECK (char_length(nazwa) BETWEEN 1 AND 60),
  sciezka_logo text,
  link       text,
  kolejnosc  int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsorzy_turniej ON turniej_sponsorzy(turniej_id, kolejnosc);

ALTER TABLE turniej_sponsorzy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sponsorzy czyta kazdy" ON turniej_sponsorzy;
CREATE POLICY "Sponsorzy czyta kazdy" ON turniej_sponsorzy FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sponsorzy zarzadza organizator" ON turniej_sponsorzy;
CREATE POLICY "Sponsorzy zarzadza organizator" ON turniej_sponsorzy FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));

-- ── 3. Storage: bucket 'turniej-media' ──────────────────────────────────────
-- Ścieżka: turnieje/<turniej_id>/{galeria|sponsorzy}/<uuid>.<ext> — segment
-- [2] (1-indeksowany w storage.foldername) jest zawsze UUID-em turnieju.

DROP POLICY IF EXISTS "Media turnieju sa publiczne" ON storage.objects;
CREATE POLICY "Media turnieju sa publiczne" ON storage.objects FOR SELECT
  USING (bucket_id = 'turniej-media');

DROP POLICY IF EXISTS "Media turnieju wgrywa zarzadzajacy" ON storage.objects;
CREATE POLICY "Media turnieju wgrywa zarzadzajacy" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'turniej-media'
    AND czy_zarzadza_turniejem(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "Media turnieju kasuje zarzadzajacy" ON storage.objects;
CREATE POLICY "Media turnieju kasuje zarzadzajacy" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'turniej-media'
    AND czy_zarzadza_turniejem(((storage.foldername(name))[2])::uuid)
  );

-- Bez UPDATE: pliki się nie nadpisuje (nowy upload = nowa ścieżka z nowym UUID-em),
-- więc UPDATE na obiekcie nie ma tu zastosowania — inaczej niż w 'covers',
-- gdzie ta sama ścieżka wraca przy każdej zmianie okładki.
```

**Uwaga wdrożeniowa (jak przy `covers`, migracja `046`):** bucket
`turniej-media` trzeba założyć ręcznie w Supabase Dashboard → Storage → New
bucket → publiczny, PRZED uruchomieniem migracji albo po niej — kolejność nie
ma znaczenia, `CREATE POLICY` nie wymaga istniejącego bucketu.

## 5. `lib/storageUpload.ts` — wspólna walidacja (nowy plik)

Wydzielone z `CoverUpload.tsx`, żeby nie kopiować tej samej walidacji
(rozmiar, typ pliku) trzeci raz przy galerii i czwarty przy logotypach
sponsorów.

```ts
export interface WynikUploadu { url: string; sciezka: string }

/** Waliduje (≤5 MB, `image/*`) i wgrywa plik pod wskazaną ścieżkę w podanym
 *  bucketcie. Rzuca z czytelnym komunikatem PL przy odrzuceniu. */
export async function uploadObrazek(
  bucket: string,
  sciezka: string,
  plik: File,
): Promise<WynikUploadu>

export async function usunObrazek(bucket: string, sciezka: string): Promise<void>
```

`CoverUpload.tsx` NIE jest refaktoryzowany w tym PR-ze na korzystanie z tego
pliku — działa, nikt go nie zgłosił jako zepsuty, a dotykanie go poszerza PR
bez potrzeby. Nowy kod (galeria, sponsorzy) korzysta z `storageUpload.ts` od
razu; przeniesienie `CoverUpload` na wspólny helper zostaje osobnym,
mniejszym sprzątaniem, jeśli ktoś zechce.

## 6. `lib/turniejGaleria.ts` — sygnatury

```ts
// Zdjęcia
export async function getZdjecia(turniejId: string): Promise<TurniejZdjecie[]>
export async function dodajZdjecie(turniejId: string, plik: File, userId: string): Promise<TurniejZdjecie>
export async function usunZdjecie(zdjecie: Pick<TurniejZdjecie, 'id'>): Promise<void>
  // kasuje wiersz ORAZ obiekt w Storage — w tej kolejności: najpierw Storage,
  // potem wiersz. Odwrotna kolejność zostawiałaby osierocony plik w buckecie,
  // gdyby DELETE wiersza się nie udał — plik bez wiersza jest tylko martwym
  // bajtem, wiersz bez pliku jest zepsutym <img>.
export async function przesunZdjecie(id: string, kierunek: 'gora' | 'dol'): Promise<void>
  // zamienia `kolejnosc` z sąsiadem — dwa UPDATE-y, nie przeliczanie całej listy

// Sponsorzy
export async function getSponsorzy(turniejId: string): Promise<TurniejSponsor[]>
export async function dodajSponsora(turniejId: string, dane: { nazwa: string; link?: string }): Promise<string>
export async function ustawLogoSponsora(sponsorId: string, plik: File | null): Promise<void>
  // `null` = usuń logo, zostaw sponsora jako sam tekst
export async function aktualizujSponsora(id: string, dane: { nazwa?: string; link?: string }): Promise<void>
export async function usunSponsora(sponsor: Pick<TurniejSponsor, 'id' | 'logoUrl'>): Promise<void>

/** CZYSTA. Kolejność do wyświetlenia — po `kolejnosc`, potem po `createdAt`
 *  jako tie-break (nowo dodane bez ustawionej kolejności trafiają na koniec
 *  w kolejności dodania, nie losowo). */
export function posortujPoKolejnosci<T extends { kolejnosc: number; createdAt: string }>(lista: T[]): T[]
```

Wszystkie funkcje piszące używają `zaktualizujJedenWiersz()`/wzorca z reszty
`lib/turnieje*.ts` — cisza RLS (0 zaktualizowanych wierszy) ma zostać
wyjątkiem, nie cichym „nic się nie stało".

## 7. Ekrany

### Zakładka Info (`TurniejClient.tsx`) — pod istniejącą kartą (termin/miejsce/
format/wpisowe/organizator/opis/regulamin), przed przyciskiem „Zgłoś drużynę":

**Galeria** (`components/turnieje/Galeria.tsx`) — siatka miniatur
(`grid grid-cols-3 gap-1.5`, mobile-first, żadnego `md:` na start — trzy
kolumny mieszczą się już na 360px). Dotknięcie otwiera `Lightbox.tsx`
(pełny ekran, strzałki lewo/prawo, Escape/klik w tło zamyka — bez
zewnętrznej biblioteki, wzorem istniejących dialogów w `components/**/*Dialog.tsx`).
Sekcja znika całkiem, gdy zdjęć nie ma I nikt nie zarządza turniejem — dla
zarządzającego zawsze widać „+ Dodaj zdjęcia" nawet przy pustej galerii
(ten sam wzorzec co `Ogloszenia.tsx`).

**Sponsorzy** (`components/turnieje/Sponsorzy.tsx`) — rząd logotypów
(`flex flex-wrap items-center gap-4`), każdy w kwadracie ~64×64px,
`object-contain` (logo nie ma się przycinać ani rozciągać). Sponsor bez
logo pokazuje nazwę jako plakietkę tekstową w tym samym rzędzie. Kliknięcie
otwiera `link` w nowej karcie, jeśli podany.

### Panel, zakładka Ustawienia (`PanelClient.tsx`)

- **Okładka turnieju** (Etap 0 tego planu): `<CoverUpload path={`turnieje/${id}/cover`} currentUrl={turniej.okladkaUrl} onSaved={...}>` — bucket `covers`, wzorem grup i meczów. Zero nowego kodu poza samym wywołaniem komponentu i podpięciem do `setOkladkaTurnieju()`.
- **Galeria** (`PanelGaleria.tsx`): lista miniatur z przyciskiem „usuń" (X) i strzałkami góra/dół, plus „+ Dodaj zdjęcie" (input pliku, jak w `CoverUpload`, ale dodaje zamiast zastępować).
- **Sponsorzy** (`PanelSponsorzy.tsx`): lista wierszy (logo/placeholder + nazwa + link), przycisk edycji nazwy/linku inline, upload/zmiana/usunięcie logo per wiersz, „+ Dodaj sponsora" na końcu.

Obie sekcje **nie są nową zakładką panelu** — wchodzą do „Ustawienia", pod
istniejącym BLIK-iem/wpisowym, żeby nie powtórzyć błędu z sześcioma
zakładkami na `/turnieje/[id]` (2026-09-17: „Drabinka" nie mieściła się
w szerokości telefonu).

## 8. Testy

### Vitest (`turniejGaleria.test.ts`)
```
posortujPoKolejnosci
  ✓ sortuje po kolejnosc rosnąco
  ✓ przy remisie kolejnosc sortuje po createdAt (starsze pierwsze)
uploadObrazek (storageUpload.test.ts)
  ✓ odrzuca plik > 5 MB z czytelnym komunikatem
  ✓ odrzuca plik, który nie jest image/*
```

### `supabase/test/rls.sql` — nowa sekcja
Dane: turniej „T" (organizator O), obcy X, drugi turniej „T2" (inny organizator).

- `anon`: czyta zdjęcia (SELECT na `turniej_zdjecia`), czyta sponsorów.
- X (obcy, zalogowany): **nie** dopisze zdjęcia do T (INSERT z `turniej_id = T`
  odrzucony na WITH CHECK), **nie** skasuje zdjęcia T (USING filtruje do zera
  — wzorzec „obcy nie przyjął cudzej drużyny" z sekcji 145: bezpośredni
  UPDATE/DELETE jako X, `RESET ROLE`, assert bez zmian).
- **Storage:** X nie wgra obiektu pod ścieżką `turnieje/<T>/galeria/...` — test
  bezpośrednio na `storage.objects` tym samym wzorcem `SET ROLE`/`set_config`.
  To jest jedyne miejsce w całym module, które testuje politykę NA STORAGE, nie
  na zwykłej tabeli — pierwszy raz w tym repo, więc dopisz komentarz
  wyjaśniający `storage.foldername()` dla następnej osoby, która to czyta.
- O (organizator T): wgrywa/kasuje zdjęcia i sponsorów T, **nie** T2.

## 9. Kolejność prac (jak w każdym etapie modułu)

1. Bucket `turniej-media` ręcznie w Supabase Dashboard (publiczny).
2. Migracja `158` — `baza-testowa.sh` (bucket nie istnieje lokalnie, więc
   testy Storage w `rls.sql` operują na samych POLITYKACH `storage.objects`,
   nie na realnym uploadzie pliku — `shim.sql` już ma tabelę `storage.objects`
   dla atrap, sprawdź czy ma też `storage.foldername()`; jeśli nie, dopisz).
3. Asercje RLS — od razu, nie na końcu.
4. Typy w `types/index.ts`.
5. `lib/storageUpload.ts`, `lib/turniejGaleria.ts` + testy.
6. **Etap 0** (okładka): `<CoverUpload>` w panelu — najmniejszy, samodzielny
   kawałek, dobry pierwszy commit/PR. **Zrobione 2026-09-22** — panel
   (zakładka Ustawienia) wgrywa okładkę, `KartaTurnieju` na `/turnieje` już
   ją pokazywała. Zero migracji, zgodnie z decyzją #4 w §1.
7. Komponenty: `Lightbox.tsx` → `Galeria.tsx` → `Sponsorzy.tsx` → `PanelGaleria.tsx` → `PanelSponsorzy.tsx`.
8. Podpięcie w `TurniejClient.tsx` (zakładka Info) i `PanelClient.tsx` (zakładka Ustawienia).
9. Bramki: `tsc` → `lint` → `test` → `build` → `check:docs`.
10. Dokumentacja w tym samym PR-ze: `docs/domena.md` (nowa sekcja „Turniej:
    galeria i sponsorzy"), `docs/baza-danych.md` (dwie tabele + bucket),
    `BACKLOG.md` §6 (odhaczyć pozycję, zastąpić linkiem do tego planu jako
    „zrobione"), `docs/llm-context.md` jeśli `SHOW_TURNIEJE` jest wtedy `true`
    (dziś `false` — jeśli nadal, ten krok czeka razem z odmrożeniem).
11. Zrzuty — jeśli `SHOW_TURNIEJE` włączona w chwili wdrożenia, dopisz trasę/
    scenariusz do `wizualne.spec.ts`; jeśli nadal wyłączona, pomiń (moduł nie
    jest jeszcze w publicznym `TRASY`).

Każdy z punktów 6–8 może być OSOBNYM, mniejszym PR-em (jak Etapy modułu
turniejowego) zamiast jednego dużego — okładka osobno od galerii osobno od
sponsorów, każdy z zielonym CI. Rekomendowane, jeśli implementacja ma trwać
więcej niż jedną sesję.

## 10. Rozstrzygnięcia z góry (jak w §N głównego planu)

| Sytuacja | Rozstrzygnięcie |
|---|---|
| Ile zdjęć max? | Brak twardego limitu w bazie; UI może ostrzec po ~20, nie blokować |
| Kolejność zdjęć/sponsorów przy remisie `kolejnosc` | `createdAt` rosnąco (starsze pierwsze) |
| Sponsor bez logo | Wyświetla się jako plakietka z samą nazwą, klikalna jeśli ma `link` |
| Usunięcie turnieju | `ON DELETE CASCADE` na obu tabelach — wiersze znikają, obiekty w Storage
  ZOSTAJĄ (Postgres nie sprząta plików) — świadomy, drobny wyciek, ten sam,
  jaki ma dziś `covers` przy skasowanym meczu/grupie. Sprzątanie Storage przy
  kasowaniu turnieju to osobne zadanie, nie blokuje tego planu |
| Zdjęcie/sponsor przy turnieju „na_link" | Widoczne tak samo jak reszta turnieju — brak trzeciego poziomu widoczności, zgodnie z resztą modułu |
| Format pliku | Cokolwiek `image/*` akceptuje przeglądarka; bez konwersji/kompresji po stronie serwera (Bojo nie ma własnego backendu) |
