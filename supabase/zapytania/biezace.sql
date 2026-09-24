-- Weryfikacja skutku migracji 158 (potwierdzenia promują obiekt do Tier 1).
-- Migracja poszła na produkcję 2026-09-22 19:56 (przebieg 35776319535).

\echo '== 1. Czy wyzwalacz jest zainstalowany =='
SELECT tgname AS wyzwalacz,
       pg_get_triggerdef(t.oid) LIKE '%INSERT OR UPDATE%' AS lapie_insert_i_update
FROM pg_trigger t
WHERE NOT tgisinternal
  AND tgrelid = 'potwierdzenia_obiektu'::regclass;

\echo '== 2. Rozkład tierów (Tier 3 = poza indeksem) =='
SELECT seo_tier, count(*) AS obiektow
FROM fields GROUP BY seo_tier ORDER BY seo_tier;

\echo '== 3. Czy ktokolwiek w ogóle głosuje w ankietach pod obiektem =='
SELECT count(*)                       AS glosow_razem,
       count(DISTINCT field_id)       AS obiektow_z_glosem,
       count(DISTINCT user_id)        AS glosujacych
FROM potwierdzenia_obiektu;

\echo '== 4. Obiekty z KWORUM (para fakt+wartosc >= 2 glosy) i ich tier =='
-- To jest liczba, którą promuje migracja 158. Jeśli wychodzi 0, backfill nie
-- miał czego podnieść i pętla zacznie działać dopiero przy pierwszym kworum.
WITH kworum AS (
  SELECT field_id
  FROM potwierdzenia_obiektu
  GROUP BY field_id, fakt, wartosc
  HAVING count(*) >= 2
)
SELECT f.seo_tier, count(DISTINCT f.id) AS obiektow_z_kworum
FROM fields f
JOIN kworum k ON k.field_id = f.id
GROUP BY f.seo_tier ORDER BY f.seo_tier;

\echo '== 5. Kontrola spojnosci: kworum, ktore NIE jest Tier 1 (ma byc pusto) =='
WITH kworum AS (
  SELECT field_id
  FROM potwierdzenia_obiektu
  GROUP BY field_id, fakt, wartosc
  HAVING count(*) >= 2
)
SELECT f.id, f.name, f.seo_tier
FROM fields f JOIN kworum k ON k.field_id = f.id
WHERE f.seo_tier <> 1
LIMIT 10;
