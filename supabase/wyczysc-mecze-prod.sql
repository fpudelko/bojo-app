-- ============================================================
-- Bojo — SPRZĄTANIE TESTOWYCH MECZÓW NA PRODUKCJI (2026-09-25)
-- ============================================================
-- To NIE jest migracja. Wklej CAŁOŚĆ w Supabase → SQL Editor i uruchom.
--
-- DWA PRZEBIEGI, TEN SAM PLIK:
--   1. `kasuj := false` (tak jest domyślnie) → nic nie znika, na dole raport:
--      ile meczów leci z jakiego powodu, a pod spodem KAŻDY mecz, który
--      zostaje (albo zależy od opcji), żebyś zobaczył go okiem.
--   2. Ustaw `kasuj := true` (i ewentualnie opcje) → kasuje. Raport na dole
--      pokazuje stan PO: wiersze „poleci" mają wtedy 0, a lista „zostaje"
--      to dokładnie to, co zostało na produkcji.
--
-- BUDOWA: całe kasowanie to JEDEN blok `DO`, a raport to JEDNO samodzielne
-- zapytanie. Pierwsza wersja trzymała listy w tabelach tymczasowych
-- i wywróciła się w SQL Editorze na `relation "konta_testowe" does not
-- exist`: edytor puszcza instrukcje osobno, a tabela tymczasowa żyje tylko
-- w połączeniu, które ją założyło. Jedna instrukcja = jedno połączenie
-- i jedna transakcja; błąd w środku cofa CAŁOŚĆ.
--
-- DLACZEGO NIE `wyczysc-testowe.sql`. Tamten kasuje wyłącznie po markerze
-- w opisie (`[TEST]`, `[REG]`…). Przegląd `zapytania/przeglad-meczow.sql`
-- pokazał, że dużej części testów markera brak: mecze z czasów Lovable
-- (test1..test10@example.com, czerwiec), klikanie z własnych kont, konta
-- audytów (`@mailinator.com`, `qa.tester…@example.com`), demo pod zrzuty
-- landingu (`__landing-demo__`). Tu decyduje głównie KONTO organizatora.
--
-- CO ZOSTAJE ŚWIADOMIE: mecze prawdziwych ludzi (fabrowski4, slawomir.osak,
-- kloc.kamil, januszpilaczynsk, kubaolesinski17 i każdy inny spoza reguł).
-- Tracą tylko wpisy KONT TESTOWYCH w składzie (`testowi_z_prawdziwych`),
-- bo test1 zapisany na cudzy mecz to ten sam fałsz.
--
-- WYZWALACZE. Usunięcie meczu normalnie wysyła uczestnikom powiadomienie
-- „Mecz usunięty" (`116`), a za nim push (`102`) i e-mail (`140`) przez
-- `net.http_post`; kasowanie wpisów odpala maile do gości (`133`) itd. Przy
-- kilkuset meczach to lawina pushy na Twoje konta i maile do obcych ludzi
-- o meczach, których nie było. Dlatego blok wyłącza wyzwalacze UŻYTKOWNIKA
-- na `events` i `event_participants` i włącza je z powrotem przed końcem.
-- Klucze obce i kaskady to wyzwalacze SYSTEMOWE i działają dalej: składy,
-- komentarze, wyniki, powiadomienia o tych meczach znikają razem z meczem.
-- `ALTER TABLE` jest transakcyjne, więc błąd w środku przywraca też
-- wyzwalacze. Raport i tak sprawdza, czy któryś nie został wyłączony.
--
-- REGUŁY SĄ W DWÓCH MIEJSCACH (blok i raport) — zmieniasz jedno, zmień
-- drugie. Kontrola: po `kasuj := true` wiersze „poleci" w raporcie mają 0.
--
-- KONT (auth.users) NIE KASUJE. Ekip i turniejów z seedów też nie —
-- te sprząta `wyczysc-testowe.sql`, sekcja 2.
-- ============================================================

DO $$
DECLARE
  kasuj                 boolean := false;  -- ← true = kasuj naprawdę

  -- Konta zespołu/testerów. W przeglądzie niemal same testy („Cykl test",
  -- „Testowa cykliczna", „cykl testowa ed", „Ui", mecze bez tytułu z 1-2
  -- wpisami), ale ZDARZAJĄ się tam składy wyglądające na prawdziwe
  -- („Czwartkowa ligówka" 9 osób, „Sparing" 6 osób). Decyzja właściciela.
  konta_jana            boolean := false;  -- j4n.brz0@gmail.com (+ aliasy j4n.brz0+N@)
  konto_edooqoo         boolean := false;  -- edooqoo@gmail.com

  testowi_z_prawdziwych boolean := true;   -- wypisz konta testowe z meczów, które zostają

  n_meczow int;
  n_wpisow int;
BEGIN
  IF NOT kasuj THEN
    RAISE NOTICE 'Podgląd: nic nie skasowano (kasuj = false).';
    RETURN;
  END IF;

  CREATE TEMP TABLE _testowe ON COMMIT DROP AS
  SELECT id FROM profiles
   WHERE email LIKE '%@example.com' OR email LIKE '%@seed.bojo'
      OR email LIKE '%@mailinator.com' OR email LIKE '%@test.local';

  CREATE TEMP TABLE _mecze ON COMMIT DROP AS
  SELECT e.id
    FROM events e
    LEFT JOIN profiles p ON p.id = e.organizer_id
   WHERE e.description ~ '^\[(TEST|TEST-G|TEST-J|REG|TAK|WIZ|DEMO-LANDING|PRZED|DWA)\]'
      OR e.organizer_id IN (SELECT id FROM _testowe)
      OR e.custom_location_name IN ('__landing-demo__', '__landing-demo-join__')
      OR p.email IN ('franekks@gmail.com', 'franciszekpudelko@gmail.com')
      OR (konta_jana AND (p.email = 'j4n.brz0@gmail.com' OR p.email LIKE 'j4n.brz0+%@gmail.com'))
      OR (konto_edooqoo AND p.email = 'edooqoo@gmail.com');

  ALTER TABLE events             DISABLE TRIGGER USER;
  ALTER TABLE event_participants DISABLE TRIGGER USER;

  DELETE FROM event_participants
   WHERE testowi_z_prawdziwych
     AND user_id IN (SELECT id FROM _testowe)
     AND event_id NOT IN (SELECT id FROM _mecze);
  GET DIAGNOSTICS n_wpisow = ROW_COUNT;

  DELETE FROM events WHERE id IN (SELECT id FROM _mecze);
  GET DIAGNOSTICS n_meczow = ROW_COUNT;

  ALTER TABLE events             ENABLE TRIGGER USER;
  ALTER TABLE event_participants ENABLE TRIGGER USER;

  RAISE NOTICE 'Skasowano meczów: %, wpisów kont testowych w meczach, które zostały: %',
    n_meczow, n_wpisow;
END $$;


-- ── Raport (SQL Editor pokazuje tylko ten wynik) ────────────────────────
WITH testowe AS (
  SELECT id FROM profiles
   WHERE email LIKE '%@example.com' OR email LIKE '%@seed.bojo'
      OR email LIKE '%@mailinator.com' OR email LIKE '%@test.local'
),
mecze AS (
  SELECT e.*, p.email,
    CASE
      WHEN e.description ~ '^\[(TEST|TEST-G|TEST-J|REG|TAK|WIZ|DEMO-LANDING|PRZED|DWA)\]'
                                                         THEN '1 marker seeda'
      WHEN e.organizer_id IN (SELECT id FROM testowe)    THEN '2 organizator: konto testowe'
      WHEN e.custom_location_name IN ('__landing-demo__', '__landing-demo-join__')
                                                         THEN '3 demo pod zrzuty landingu'
      WHEN p.email IN ('franekks@gmail.com', 'franciszekpudelko@gmail.com')
                                                         THEN '4 organizator: moje konto'
    END AS powod,
    CASE
      WHEN p.email = 'j4n.brz0@gmail.com' OR p.email LIKE 'j4n.brz0+%@gmail.com'
                                                         THEN 'OPCJA konta_jana'
      WHEN p.email = 'edooqoo@gmail.com'                 THEN 'OPCJA konto_edooqoo'
      ELSE 'zostaje'
    END AS los
  FROM events e
  LEFT JOIN profiles p ON p.id = e.organizer_id
)
SELECT * FROM (
  SELECT 0 AS kolejnosc, 'poleci' AS co, powod AS szczegol,
         count(*) AS meczow,
         count(*) FILTER (WHERE visibility = 'public')      AS publicznych,
         count(*) FILTER (WHERE event_date >= CURRENT_DATE) AS nadchodzacych,
         NULL::text AS organizator, NULL::date AS termin, NULL::text AS adres
    FROM mecze WHERE powod IS NOT NULL GROUP BY powod

  UNION ALL
  SELECT 1, 'poleci', 'wpisy kont testowych w meczach spoza reguł 1-4',
         count(*), NULL, NULL, NULL, NULL, NULL
    FROM event_participants ep
   WHERE ep.user_id IN (SELECT id FROM testowe)
     AND ep.event_id IN (SELECT id FROM mecze WHERE powod IS NULL)

  UNION ALL
  SELECT 2, 'UWAGA', 'wyłączony wyzwalacz: ' || c.relname || '.' || t.tgname,
         NULL, NULL, NULL, NULL, NULL, NULL
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname IN ('events', 'event_participants')
     AND c.relnamespace = 'public'::regnamespace
     AND NOT t.tgisinternal AND t.tgenabled = 'D'

  UNION ALL
  SELECT 3, los,
         visibility || ' · ' || status || ' · ' || coalesce(title, sport)
           || ' · ' || coalesce(custom_location_name, field_name),
         (SELECT count(*) FROM event_participants x WHERE x.event_id = mecze.id),
         NULL, NULL,
         coalesce(email, organizer_name), event_date, '/wydarzenia/' || id
    FROM mecze WHERE powod IS NULL
) raport
ORDER BY kolejnosc, co, termin DESC NULLS LAST, szczegol;
