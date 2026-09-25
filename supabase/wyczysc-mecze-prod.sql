-- ============================================================
-- Bojo — SPRZĄTANIE TESTOWYCH MECZÓW NA PRODUKCJI (2026-09-25)
-- ============================================================
-- To NIE jest migracja. Wklej CAŁOŚĆ w Supabase → SQL Editor i uruchom.
--
-- DWA PRZEBIEGI, TEN SAM PLIK:
--   1. `kasuj = false` (tak jest domyślnie) → nic nie znika. Wynik na dole
--      to podgląd: ile meczów poleci i z jakiego powodu, a pod spodem KAŻDY
--      mecz, który ZOSTAJE, żebyś zobaczył, czy nie zostało nic testowego
--      i czy nie leci nic prawdziwego.
--   2. Zmień `kasuj` na `true` i uruchom jeszcze raz → kasuje i pokazuje
--      ten sam raport, już po fakcie.
--
-- DLACZEGO NIE `wyczysc-testowe.sql`. Tamten kasuje wyłącznie po markerze
-- w opisie (`[TEST]`, `[REG]`…). Przegląd `zapytania/przeglad-meczow.sql`
-- pokazał, że dużej części testów marker nie ma: mecze z czasów Lovable
-- (test1..test10@example.com, czerwiec), klikanie z własnych kont, konta
-- audytów (`@mailinator.com`, `qa.tester…@example.com`), demo pod zrzuty
-- landingu (`__landing-demo__`). Tu decyduje przede wszystkim KONTO
-- organizatora, nie opis.
--
-- CO ZOSTAJE ŚWIADOMIE: mecze prawdziwych ludzi (fabrowski4, slawomir.osak,
-- kloc.kamil, januszpilaczynsk, kubaolesinski17 i każdy inny spoza list
-- niżej). Ich mecze tracą tylko wpisy KONT TESTOWYCH w składzie (opcja
-- `testowi_z_prawdziwych`), bo test1 zapisany na cudzy mecz to ten sam fałsz.
--
-- WYZWALACZE. Usunięcie meczu normalnie wysyła uczestnikom powiadomienie
-- „Mecz usunięty" (`116`), a za nim push i e-mail; kasowanie wpisów
-- w składzie odpala powiadomienia o odrzuceniu prośby, maile do gości itd.
-- Przy kilkuset meczach naraz dostałbyś lawinę pushy na własne konta,
-- a goście z e-mailem (ludzie spoza aplikacji) maile o meczach, których
-- nigdy nie było. Dlatego na czas transakcji wyłączone są wyzwalacze
-- UŻYTKOWNIKA na `events` i `event_participants`. Klucze obce i kaskady
-- to wyzwalacze SYSTEMOWE i działają dalej: składy, komentarze, wyniki,
-- powiadomienia o skasowanych meczach znikają razem z meczem. Błąd w środku
-- = ROLLBACK całości, wyzwalacze wracają same (ALTER TABLE jest w transakcji).
--
-- KONT (auth.users) NIE KASUJE. Konta testowe bez meczów są niewidoczne dla
-- innych; ich usunięcie to osobna decyzja w panelu Authentication.
-- ============================================================

DROP TABLE IF EXISTS pg_temp.ustawienia;
CREATE TEMP TABLE ustawienia AS SELECT
  false AS kasuj,                   -- ← true = kasuj naprawdę

  -- Konta zespołu/testerów. Ich mecze w przeglądzie to niemal same testy
  -- („Cykl test", „Testowa cykliczna", „cykl testowa ed", „Ui", mecze bez
  -- tytułu z 1-2 wpisami), ale ZDARZAJĄ się tam wpisy prawdziwych graczy
  -- („Czwartkowa ligówka" 9 osób, „Sparing" 6 osób). Decyzja Twoja.
  false AS konta_jana,              -- j4n.brz0@gmail.com (+ aliasy j4n.brz0+N@)
  false AS konto_edooqoo,           -- edooqoo@gmail.com (też demo landingu)

  true  AS testowi_z_prawdziwych;   -- wypisz konta testowe z meczów, które zostają

-- Twoje konta: wszystko, co zorganizowały, to testy (decyzja z 2026-09-25).
DROP TABLE IF EXISTS pg_temp.moje;
CREATE TEMP TABLE moje(email) AS VALUES
  ('franekks@gmail.com'), ('franciszekpudelko@gmail.com');

-- Konto testowe = konto, którego adres nie należy do człowieka.
DROP TABLE IF EXISTS pg_temp.konta_testowe;
CREATE TEMP TABLE konta_testowe AS
SELECT id, email FROM profiles
 WHERE email LIKE '%@example.com'
    OR email LIKE '%@seed.bojo'
    OR email LIKE '%@mailinator.com'
    OR email LIKE '%@test.local';

-- ── Co leci i dlaczego (pierwszy pasujący powód wygrywa) ────────────────
DROP TABLE IF EXISTS pg_temp.do_kasacji;
CREATE TEMP TABLE do_kasacji AS
SELECT e.id, e.visibility, e.event_date,
  CASE
    WHEN e.description ~ '^\[(TEST|TEST-G|TEST-J|REG|TAK|WIZ|DEMO-LANDING|PRZED|DWA)\]'
                                                      THEN '1 marker seeda'
    WHEN e.organizer_id IN (SELECT id FROM konta_testowe)
                                                      THEN '2 organizator: konto testowe'
    WHEN e.custom_location_name IN ('__landing-demo__', '__landing-demo-join__')
                                                      THEN '3 demo pod zrzuty landingu'
    WHEN p.email IN (SELECT email FROM moje)          THEN '4 organizator: moje konto'
    WHEN u.konta_jana AND (p.email = 'j4n.brz0@gmail.com' OR p.email LIKE 'j4n.brz0+%@gmail.com')
                                                      THEN '5 organizator: Jan'
    WHEN u.konto_edooqoo AND p.email = 'edooqoo@gmail.com'
                                                      THEN '6 organizator: edooqoo'
  END AS powod
FROM events e
LEFT JOIN profiles p ON p.id = e.organizer_id
CROSS JOIN ustawienia u;
DELETE FROM do_kasacji WHERE powod IS NULL;

-- Wpisy kont testowych w meczach, które ZOSTAJĄ.
DROP TABLE IF EXISTS pg_temp.wpisy_do_kasacji;
CREATE TEMP TABLE wpisy_do_kasacji AS
SELECT ep.id, ep.event_id
  FROM event_participants ep
 WHERE ep.user_id IN (SELECT id FROM konta_testowe)
   AND ep.event_id NOT IN (SELECT id FROM do_kasacji)
   AND (SELECT testowi_z_prawdziwych FROM ustawienia);

-- ── Kasowanie (wykonuje się tylko przy kasuj = true) ────────────────────
BEGIN;
ALTER TABLE events             DISABLE TRIGGER USER;
ALTER TABLE event_participants DISABLE TRIGGER USER;

DELETE FROM event_participants
 WHERE id IN (SELECT id FROM wpisy_do_kasacji)
   AND (SELECT kasuj FROM ustawienia);

DELETE FROM events
 WHERE id IN (SELECT id FROM do_kasacji)
   AND (SELECT kasuj FROM ustawienia);

ALTER TABLE events             ENABLE TRIGGER USER;
ALTER TABLE event_participants ENABLE TRIGGER USER;
COMMIT;

-- ── Raport (SQL Editor pokazuje tylko ten wynik) ────────────────────────
-- Na górze: podsumowanie po powodach. Pod spodem: KAŻDY mecz, który zostaje.
SELECT * FROM (
  SELECT
    0                                                        AS kolejnosc,
    CASE WHEN (SELECT kasuj FROM ustawienia) THEN 'SKASOWANE' ELSE 'PODGLĄD: poleci' END AS co,
    powod                                                    AS szczegol,
    count(*)                                                 AS meczow,
    count(*) FILTER (WHERE visibility = 'public')            AS publicznych,
    count(*) FILTER (WHERE event_date >= CURRENT_DATE)       AS nadchodzacych,
    NULL::text                                               AS organizator,
    NULL::date                                               AS termin,
    NULL::text                                               AS adres
  FROM do_kasacji
  GROUP BY powod

  UNION ALL
  SELECT 1,
    CASE WHEN (SELECT kasuj FROM ustawienia) THEN 'SKASOWANE' ELSE 'PODGLĄD: poleci' END,
    'wpisy kont testowych w meczach, które zostają',
    count(*), NULL, NULL, NULL, NULL, NULL
  FROM wpisy_do_kasacji

  UNION ALL
  SELECT 2, 'ZOSTAJE',
    e.visibility || ' · ' || e.status || ' · ' || coalesce(e.title, e.sport)
      || ' · ' || coalesce(e.custom_location_name, e.field_name),
    NULL, NULL, NULL,
    coalesce(p.email, e.organizer_name),
    e.event_date,
    '/wydarzenia/' || e.id
  FROM events e
  LEFT JOIN profiles p ON p.id = e.organizer_id
  WHERE e.id NOT IN (SELECT id FROM do_kasacji)
) raport
ORDER BY kolejnosc, szczegol, termin DESC;
