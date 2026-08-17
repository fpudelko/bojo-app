-- ============================================================================
-- JEDNORAZOWE ZADANIE: mecze z jednego obiektu → grupa, gracze → członkowie
-- ============================================================================
--
-- Cel:
--   1. wszystkie wydarzenia rozegrane na wskazanym boisku przypiąć do grupy,
--   2. każdego, kto zagrał tam co najmniej DWA razy, dopisać do tej grupy.
--
-- OBIEKT: Szkoła Podstawowa nr 5 im. prof. Adama Wodziczki — boisko piłkarskie,
--         Swarzędz — 3412d621-6b78-4ae8-930e-2fd265729c2e
-- GRUPA:  922b4232-8e2d-4257-9a0a-340c485c7337
--
-- SKRYPT JEST DWUCZĘŚCIOWY I TAK MA ZOSTAĆ.
-- Część A niczego nie zmienia — pokazuje, co się stanie. Uruchamiasz ją,
-- czytasz wynik i dopiero gdy się zgadza, odpalasz część B. Nie sklejaj ich:
-- to zapis do produkcji, a pomyłka w identyfikatorze przypina cudze mecze
-- do cudzej grupy.
--
-- IDENTYFIKATORY SĄ WPISANE WPROST, w każdym zapytaniu z osobna. Brzydsze niż
-- zmienna, ale edytor SQL w Supabase to nie `psql` — nie zna `\set` ani `:nazwa`,
-- więc wersja ze zmiennymi wywaliłaby się przy pierwszym wklejeniu.
-- Zmieniasz obiekt albo grupę → podmień WSZĘDZIE (jest tego kilka miejsc).
--
-- Uruchamiane RĘCZNIE w Supabase → SQL Editor. To nie jest migracja: opisuje
-- jednorazową decyzję o konkretnych danych, a nie kształt schematu.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A — PODGLĄD. Same SELECT-y, zero zapisu. Wklej i uruchom w całości.
-- ============================================================================

-- A0. Czy w ogóle trafiliśmy w ten obiekt i tę grupę.
SELECT 'obiekt' AS co, f.id::text AS id, f.name AS nazwa, f.address AS adres
FROM fields f
WHERE f.id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
UNION ALL
SELECT 'grupa', g.id::text, g.name, NULL
FROM groups g
WHERE g.id = '922b4232-8e2d-4257-9a0a-340c485c7337';


-- A1. Mecze na tym obiekcie i co się z nimi stanie.
--     Patrz na kolumnę `co_zrobimy`: mecz przypięty już do INNEJ grupy zostanie
--     PRZEPIĘTY. Jeśli takie się pojawią — przeczytaj listę, zanim odpalisz B.
SELECT
  e.id,
  e.event_date,
  e.title,
  e.organizer_name,
  e.group_id AS grupa_teraz,
  CASE
    WHEN e.group_id IS NULL                                        THEN 'przypniemy'
    WHEN e.group_id = '922b4232-8e2d-4257-9a0a-340c485c7337'::uuid THEN 'już przypięty — bez zmian'
    ELSE                                                                'UWAGA: przepniemy z innej grupy'
  END AS co_zrobimy
FROM events e
WHERE e.field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
ORDER BY e.event_date DESC;


-- A2. Mecze — podsumowanie liczbowe.
SELECT
  count(*)                                                          AS meczow_lacznie,
  count(*) FILTER (WHERE group_id IS NULL)                          AS do_przypiecia,
  count(*) FILTER (WHERE group_id = '922b4232-8e2d-4257-9a0a-340c485c7337'::uuid)
                                                                    AS juz_w_tej_grupie,
  count(*) FILTER (WHERE group_id IS NOT NULL
                     AND group_id <> '922b4232-8e2d-4257-9a0a-340c485c7337'::uuid)
                                                                    AS z_innej_grupy
FROM events
WHERE field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e';


-- A3. Kto zostanie dopisany do grupy.
--     „Zagrał" liczymy WĄSKO i celowo:
--       - `user_id IS NOT NULL`      — gość dopisany ręcznie nie ma konta,
--                                      więc nie ma kogo dodać do grupy,
--       - `is_reserve = false`       — rezerwowy nie zagrał, tylko czekał,
--       - `pending_approval = false` — prośba bez akceptacji to nie udział.
--     Jeśli któreś założenie Ci nie pasuje, zmień je TU, a potem tak samo
--     w części B — obie muszą liczyć identycznie.
WITH udzialy AS (
  SELECT ep.user_id, count(DISTINCT ep.event_id) AS ile
  FROM event_participants ep
  JOIN events e ON e.id = ep.event_id
  WHERE e.field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
    AND ep.user_id IS NOT NULL
    AND ep.is_reserve = false
    AND ep.pending_approval = false
  GROUP BY ep.user_id
)
SELECT
  u.ile                                   AS ile_meczow,
  COALESCE(p.display_name, '(bez nazwy)') AS kto,
  u.user_id,
  CASE WHEN gm.user_id IS NULL THEN 'dopiszemy' ELSE 'już w grupie' END AS co_zrobimy
FROM udzialy u
LEFT JOIN profiles p       ON p.id = u.user_id
LEFT JOIN group_members gm ON gm.user_id = u.user_id
                          AND gm.group_id = '922b4232-8e2d-4257-9a0a-340c485c7337'
WHERE u.ile >= 2
ORDER BY u.ile DESC, kto;


-- A4. Ludzie — jedna liczba na koniec.
--     `odpada_ponizej_progu` mówi, ilu grało tam raz. Jeśli ta liczba jest duża,
--     warto świadomie zdecydować, czy próg 2 to na pewno dobry próg.
WITH udzialy AS (
  SELECT ep.user_id, count(DISTINCT ep.event_id) AS ile
  FROM event_participants ep
  JOIN events e ON e.id = ep.event_id
  WHERE e.field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
    AND ep.user_id IS NOT NULL
    AND ep.is_reserve = false
    AND ep.pending_approval = false
  GROUP BY ep.user_id
)
SELECT
  count(*) FILTER (WHERE u.ile >= 2)                              AS spelnia_prog,
  count(*) FILTER (WHERE u.ile >= 2 AND gm.user_id IS NULL)       AS realnie_dopiszemy,
  count(*) FILTER (WHERE u.ile <  2)                              AS odpada_ponizej_progu
FROM udzialy u
LEFT JOIN group_members gm ON gm.user_id = u.user_id
                          AND gm.group_id = '922b4232-8e2d-4257-9a0a-340c485c7337';


-- ============================================================================
-- CZĘŚĆ B — ZAPIS. Wklej i uruchom DOPIERO gdy część A wygląda dobrze.
-- ============================================================================
-- Całość w jednej transakcji: albo przypniemy mecze i dopiszemy ludzi, albo nic.
-- Bez tego dałoby się skończyć z połową roboty i bez wiedzy, na czym stanęło.
--
--   BEGIN;
--
--   -- B1. Mecze → grupa.
--   --     `IS DISTINCT FROM` pomija już przypięte — nie ma po co ich ruszać.
--   UPDATE events
--   SET group_id = '922b4232-8e2d-4257-9a0a-340c485c7337'
--   WHERE field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
--     AND group_id IS DISTINCT FROM '922b4232-8e2d-4257-9a0a-340c485c7337'::uuid;
--
--   -- B2. Gracze → członkowie grupy.
--   --     `ON CONFLICT DO NOTHING` po UNIQUE (group_id, user_id) z migracji 044:
--   --     kto już jest, zostaje nietknięty — nie chcemy zresetować mu uprawnień.
--   --     Roli nie ustawiamy: wylicza ją trigger `ustaw_role_czlonka` (migracja
--   --     092) z kolumn `can_*`, a wpisana wprost i tak zostałaby nadpisana.
--   INSERT INTO group_members (group_id, user_id)
--   SELECT '922b4232-8e2d-4257-9a0a-340c485c7337', ep.user_id
--   FROM event_participants ep
--   JOIN events e ON e.id = ep.event_id
--   WHERE e.field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
--     AND ep.user_id IS NOT NULL
--     AND ep.is_reserve = false
--     AND ep.pending_approval = false
--   GROUP BY ep.user_id
--   HAVING count(DISTINCT ep.event_id) >= 2
--   ON CONFLICT (group_id, user_id) DO NOTHING;
--
--   COMMIT;
--
-- Po zapisie sprawdź, czy liczby zgadzają się z podglądem:
--
--   SELECT
--     (SELECT count(*) FROM events
--        WHERE field_id = '3412d621-6b78-4ae8-930e-2fd265729c2e'
--          AND group_id = '922b4232-8e2d-4257-9a0a-340c485c7337') AS meczow_w_grupie,
--     (SELECT count(*) FROM group_members
--        WHERE group_id = '922b4232-8e2d-4257-9a0a-340c485c7337') AS czlonkow_grupy;
