-- 164: Naprawa rozjazdu między dziennikiem migracji i produkcją.
--
-- CO SIĘ STAŁO. Dziennik `schema_migracje` na produkcji dostał wpisy dla
-- `117`, `126` i `131` przez backfill (`--oznacz-do`, 2026-09-22), ale
-- odpowiadające im OBIEKTY na produkcji nie istniały. Sonda backfillu widzi
-- WYŁĄCZNIE tabele (`supabase/migrations/README.md`, „to jest dolna
-- granica") — migracja, która dokłada samą funkcję albo kolumnę, jest dla
-- niej niewidoczna. Ktoś wcześniej wkleił do SQL Editora nowsze ciało
-- `wyslij_przypomnienia()` (z `144`/`160`) bez pomocnika `odmien_nie_oddalo()`
-- z `131` — CREATE FUNCTION przechodzi mimo brakującej zależności (PL/pgSQL
-- nie sprawdza ciała przy tworzeniu), więc błąd wyszedł dopiero przy
-- WYWOŁANIU. Dokładnie ta pułapka, co „migracja przerwana w połowie"
-- z AGENTS.md, tylko że tym razem połowicznym stanem jest cały BACKFILL,
-- nie jedna migracja.
--
-- SKUTEK NA PRODUKCJI (zmierzone 2026-09-26, same liczby):
--   - `bojo-przypomnienia` (pg_cron, codziennie 16:00 UTC) pada od 2026-09-12,
--     KAŻDY dzień: `ERROR: function odmien_nie_oddalo(integer) does not
--     exist`. Ani „jutro grasz", ani „domknij mecz" nie wychodzą.
--   - Szukanie obiektu w kreatorze bez polskich znaków nie działa: „lodz"
--     znajduje 0 ze 194 publicznych obiektów, „poznan" 6 ze 179 — bo
--     `fields.szukaj_norm` (`126`) nie istnieje i `searchExplorerFields()`
--     spada na zapasowe `ilike` z wymaganymi ogonkami.
--   - Poprawka pushy na współdzielonym telefonie (`117`) nigdy nie weszła —
--     `dopnij_subskrypcje_push()` nie istnieje, RPC pada po cichu
--     (`catch {}` w `frontend/src/lib/push.ts`).
--
-- CO TA MIGRACJA ROBI. Powtarza DOSŁOWNIE idempotentne fragmenty `126`,
-- `131` i `117` — zero nowej logiki, żeby diff dało się zweryfikować przez
-- porównanie z oryginałem. Na bazie postawionej z repo (`baza-testowa.sh`,
-- `stos-bez-dockera.sh`) wszystkie trzy fragmenty są no-op: obiekty już
-- istnieją. Na produkcji dokładają dokładnie to, czego brakuje.
--
-- CZEGO TA MIGRACJA NIE ROBI: nie odtwarza funkcji serii wydarzeń
-- cyklicznych (`utworz_termin_serii`, `utworz_nalezne_terminy_serii`,
-- `powiadom_o_nowym_terminie_serii`, `073`/`092`) — na produkcji ich i tak
-- nie ma (`SHOW_RECURRING` wyłączone od 2026-08-16), a decyzja właściciela
-- (runda 9, D-4) jest jasna: gry cykliczne mają zniknąć całkowicie, nie
-- wrócić. Zamiast tego SEKCJA 4 niżej kasuje je też na bazie z repo, żeby
-- porównanie schematu (`scripts/odcisk-schematu.sh`) nie zgłaszało różnicy,
-- której nikt nie planuje naprawiać. Pełne usunięcie tabel serii
-- (`recurring_events`, `recurring_event_invites`) idzie osobną, RĘCZNĄ
-- migracją w PR-L (`DROP TABLE`).
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ — każda instrukcja niżej jest `IF NOT EXISTS`/
-- `OR REPLACE`/`IF EXISTS`, tak jak w oryginałach.

-- ---------------------------------------------------------------------------
-- 1. Z migracji 126 — szukanie boisk bez polskich ogonków
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS szukaj_norm TEXT
  GENERATED ALWAYS AS (
    translate(
      lower(coalesce(name, '') || ' ' || coalesce(address, '')),
      'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
      'acelnoszzacelnoszz'
    )
  ) STORED;

COMMENT ON COLUMN fields.szukaj_norm IS
  'Nazwa + adres złożone do postaci bez ogonków i małymi literami (migracja 126). Do szukania `ilike` bez polskich znaków. Odpowiednik foldText() z frontend/src/lib/searchText.ts — zmiana po jednej stronie wymaga zmiany po drugiej.';

CREATE INDEX IF NOT EXISTS fields_szukaj_norm_trgm
  ON fields USING gin (szukaj_norm gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. Z migracji 131 — pomocnik odmiany, którego brak wywraca przypomnienia
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION odmien_nie_oddalo(n integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT n || CASE
    WHEN n = 1 THEN ' osoba jeszcze nie oddała'
    WHEN n % 10 BETWEEN 2 AND 4 AND n % 100 NOT BETWEEN 12 AND 14
      THEN ' osoby jeszcze nie oddały'
    ELSE ' osób jeszcze nie oddało'
  END;
$$;

COMMENT ON FUNCTION odmien_nie_oddalo(integer) IS
  'Odmieniony człon „N osób jeszcze nie oddało" do treści powiadomienia po meczu. Odpowiednik withCount() z frontend/src/lib/plural.ts — razem z czasownikiem, bo ten też się odmienia.';

-- ---------------------------------------------------------------------------
-- 3. Z migracji 117 — dopięcie subskrypcji push do aktualnego konta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dopnij_subskrypcje_push(
  p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_przegladarka TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, przegladarka)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_przegladarka)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id      = excluded.user_id,
        p256dh       = excluded.p256dh,
        auth         = excluded.auth,
        przegladarka = excluded.przegladarka;
END;
$$;

GRANT EXECUTE ON FUNCTION dopnij_subskrypcje_push(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION dopnij_subskrypcje_push IS
  'Przypina istniejącą subskrypcję push (per przeglądarka) do aktualnie zalogowanego konta. Wołane po cichu przy logowaniu (lib/auth.tsx) — naprawia sytuację, w której współdzielone urządzenie zostaje na zawsze przypięte do PIERWSZEGO konta, które kiedykolwiek kliknęło „Włącz" (migracja 117).';

-- ---------------------------------------------------------------------------
-- 4. Gry cykliczne: kasujemy to, co produkcja i tak nie ma (decyzja D-4)
-- ---------------------------------------------------------------------------
-- Trójka funkcji serii i wyzwalacz z `073` (tabela `recurring_events`, którą
-- zakłada ten sam plik, na produkcji ISTNIEJE — więc backfill zaliczył `073`
-- po tabeli) na produkcji NIE ISTNIEJE — sprawdzone wprost porównaniem
-- odcisku schematu, 2026-09-26. Backfill (`--oznacz-do`) niczego nie
-- URUCHAMIA, tylko zgaduje po tabelach, jak daleko doszła wcześniejsza ręczna
-- historia — więc mógł zaliczyć plik, którego dolna połowa (funkcje,
-- wyzwalacz) nigdy realnie nie poszła. Nieważne, jak dokładnie do tego
-- doszło: produkcja i repo mają się zgadzać, a właściciel zdecydował (runda 9,
-- D-4), że gry cykliczne znikają, nie wracają.
--
-- Zamiast odtwarzać trójkę na produkcji (byłaby martwa — `SHOW_RECURRING`
-- wyłączone od 2026-08-16), kasujemy ją też na bazie z repo, żeby porównanie
-- schematu (`scripts/odcisk-schematu.sh`) startowało bez różnicy, której nikt
-- nie planuje naprawiać w drugą stronę. Pełne usunięcie modułu (tabele,
-- kolumna `events.recurring_event_id`, front) idzie osobno w PR-L.
--
-- `DROP FUNCTION`/`DROP TRIGGER` są dla skanera ryzyka ODWRACALNE (wzorzec
-- idempotentny), więc migracja zostaje bezpieczna i idzie automatem.
DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_terminie_serii ON events;
DROP FUNCTION IF EXISTS powiadom_o_nowym_terminie_serii();
DROP FUNCTION IF EXISTS utworz_nalezne_terminy_serii();
DROP FUNCTION IF EXISTS utworz_termin_serii(uuid, date);
