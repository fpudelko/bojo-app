-- ============================================================================
-- BOJO — publikacja obiektów zaimportowanych z lubelskiego
-- ============================================================================
-- Do wklejenia w Supabase → SQL Editor.
--
-- Po co: import ustawia `map_visibility` według wybranej bramki jakości, więc
-- przy bramce `waska` lub `srednia` część obiektów wylądowała w
-- `organizer_only` — są wybieralne przy tworzeniu meczu, ale nie ma ich
-- na mapie. Ten skrypt publikuje wszystkie z lubelskiego.
--
-- Zakres wyznacza prostokąt wokół województwa lubelskiego. Obiekty z Poznania
-- leżą poza nim, więc ich nie ruszy.
--
-- UWAGA: sam SQL NIE wystarczy. Mapa miała zaszyty prostokąt wokół Poznania
-- i filtr „ma telefon albo stronę albo opis" — świeży import z OSM nie ma
-- żadnej z tych rzeczy. Jedno i drugie zdjęte w tym samym PR co ten plik;
-- bez wdrożenia tamtej zmiany obiekty nadal będą niewidoczne.
--
-- Sekcje 1–2 to podgląd. Sekcja 3 zapisuje, ale kończy się ROLLBACK —
-- żeby zapisać naprawdę, zamień ostatnią linię na COMMIT.
-- ============================================================================


-- ── 1. Co w ogóle mamy w lubelskiem ─────────────────────────────────────────
SELECT format('%s | %s obiektów', coalesce(map_visibility, '(brak)'), count(*)) AS wynik
FROM fields
WHERE lat BETWEEN 50.20 AND 52.30
  AND lng BETWEEN 21.50 AND 24.20
GROUP BY map_visibility
ORDER BY count(*) DESC;


-- ── 2. Próbka — czy nazwy wyglądają tak, jak w raporcie ─────────────────────
SELECT format('%s | %s | %s | %s',
  name,
  coalesce(address, '—'),
  coalesce(array_to_string(sport, '+'), '—'),
  coalesce(surface, '—')) AS wynik
FROM fields
WHERE lat BETWEEN 50.20 AND 52.30
  AND lng BETWEEN 21.50 AND 24.20
ORDER BY md5(id::text)
LIMIT 30;


-- ── 3. Publikacja ───────────────────────────────────────────────────────────
BEGIN;

-- Ile się zmieni
SELECT format('do opublikowania: %s obiektów', count(*)) AS wynik
FROM fields
WHERE lat BETWEEN 50.20 AND 52.30
  AND lng BETWEEN 21.50 AND 24.20
  AND source = 'osm'
  AND map_visibility <> 'public';

UPDATE fields
SET map_visibility = 'public',
    moderation_status = 'approved'
WHERE lat BETWEEN 50.20 AND 52.30
  AND lng BETWEEN 21.50 AND 24.20
  AND source = 'osm'
  AND map_visibility <> 'public';

-- Kontrola: po zmianie wszystko z lubelskiego ma być publiczne
SELECT format('po zmianie: %s | %s',
  coalesce(map_visibility, '(brak)'), count(*)) AS wynik
FROM fields
WHERE lat BETWEEN 50.20 AND 52.30
  AND lng BETWEEN 21.50 AND 24.20
GROUP BY map_visibility;

-- Zadowolony? Zamień na COMMIT.
ROLLBACK;
