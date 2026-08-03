-- ============================================================================
-- BOJO — sprzątanie katalogu boisk na podstawie notatek AI
-- ============================================================================
-- Analiza satelitarna zapisywała w `ai_notes` własne wątpliwości, ale
-- `_ai_visibility` w analyze_venues.py chowa obiekt tylko wtedy, gdy model
-- jawnie ustawił `is_verified_venue = false`. Gdy zamiast tego napisał
-- w notatce „brak jakiegokolwiek boiska", obiekt został publiczny.
--
-- Ten plik wyciąga tę wiedzę z notatek. Nie woła modelu, nic nie kosztuje —
-- korzysta z analiz, za które już zapłaciłeś.
--
-- Zapytania 1–3 to PODGLĄD. Sekcja 4 zapisuje, ale w transakcji zakończonej
-- ROLLBACK — żeby coś zmienić, zamień ostatnią linię na COMMIT.
-- ============================================================================


-- ── 1. PODGLĄD: obiekty, o których model napisał „to nie jest boisko" ──────
-- Wzorce dobrane pod zwroty, które faktycznie występują w notatkach.
SELECT format('%s | %s | vis=%s | %s',
  name, coalesce(address, '—'), map_visibility, ai_notes) AS wynik
FROM fields
WHERE ai_notes IS NOT NULL
  AND ai_notes ~* '(brak (jakiegokolwiek|wyraźnego|widocznego|żadnego)?\s*(obiektu sportowego|boiska)|nie ma boiska|a nie (betonowe )?boisk|brak boiska)'
ORDER BY map_visibility, name;


-- ── 2. PODGLĄD: model sam zgłosił niepewność ──────────────────────────────
-- Te obiekty nie są śmieciem, ale nie powinny udawać zweryfikowanych.
SELECT format('%s | typ=%s | vis=%s | %s',
  name, coalesce(venue_type, '—'), map_visibility, ai_notes) AS wynik
FROM fields
WHERE ai_notes IS NOT NULL
  AND ai_notes ~* '(ocena niepewna|niepewn|prawdopodobnie bramki|jakość obrazu niska|niewidoczne z tej wysokości|możliwy błąd)'
ORDER BY name;


-- ── 3. PODGLĄD: nazwa kłóci się z typem wykrytym ze zdjęcia ───────────────
-- Klasyk: wiersz nazwany „Boisko — koszykówka", a na zdjęciu kort tenisowy.
SELECT format('%s | typ=%s | sporty=%s | %s',
  name, coalesce(venue_type, '—'),
  coalesce(array_to_string(sport, '+'), '—'), coalesce(ai_notes, '—')) AS wynik
FROM fields
WHERE venue_type IS NOT NULL
  AND (
       (name ILIKE '%koszykówka%' AND venue_type NOT LIKE 'basketball%' AND venue_type <> 'multi_sport')
    OR (name ILIKE '%piłka nożna%' AND venue_type IN ('tennis_outdoor', 'volleyball_beach', 'basketball_full', 'basketball_half'))
    OR (name ILIKE '%orlik%'      AND venue_type IN ('tennis_outdoor', 'other'))
  )
ORDER BY name;


-- ── 4. ZAPIS: schowanie obiektów, które nie są boiskami ───────────────────
-- Nie kasuje wierszy — ustawia map_visibility = 'hidden' i moderation_status
-- = 'hidden'. Dane zostają, gdyby okazało się, że model się mylił.
BEGIN;

-- Co się zmieni:
SELECT format('UKRYJ: %s | %s', name, ai_notes) AS wynik
FROM fields
WHERE map_visibility <> 'hidden'
  AND ai_notes IS NOT NULL
  AND ai_notes ~* '(brak (jakiegokolwiek|wyraźnego|widocznego|żadnego)?\s*(obiektu sportowego|boiska)|nie ma boiska|a nie (betonowe )?boisk|brak boiska)'
ORDER BY name;

UPDATE fields
SET map_visibility = 'hidden', moderation_status = 'hidden'
WHERE map_visibility <> 'hidden'
  AND ai_notes IS NOT NULL
  AND ai_notes ~* '(brak (jakiegokolwiek|wyraźnego|widocznego|żadnego)?\s*(obiektu sportowego|boiska)|nie ma boiska|a nie (betonowe )?boisk|brak boiska)';

-- Model powiedział wprost „to nie jest obiekt sportowy", a obiekt jest publiczny.
UPDATE fields
SET map_visibility = 'hidden', moderation_status = 'hidden'
WHERE is_verified_venue = false
  AND map_visibility = 'public';

-- Zadowolony z listy powyżej? Zamień na COMMIT.
ROLLBACK;


-- ── 5. ZAPIS: czytelne nazwy zamiast 30 pinezek „Boisko sportowe" ─────────
-- Nie zmienia kolumny `name` (to dane źródłowe z OSM) — dokłada dzielnicę
-- albo ulicę do nazwy generycznej, żeby dało się odróżnić pinezki od siebie.
-- Uruchom DOPIERO po przywróceniu współrzędnych i uzupełnieniu adresów.
BEGIN;

SELECT format('%s  →  %s', name,
  name || ' · ' || coalesce(district, split_part(address, ',', 1))) AS wynik
FROM fields
WHERE name ~* '^(Boisko|Boisko sportowe|Orlik)( —|$| sportowe)'
  AND (district IS NOT NULL OR address IS NOT NULL)
  AND name !~ '·'
ORDER BY name
LIMIT 100;

-- Podgląd wystarczy? Odkomentuj UPDATE i zamień ROLLBACK na COMMIT.
-- UPDATE fields
-- SET name = name || ' · ' || coalesce(district, split_part(address, ',', 1))
-- WHERE name ~* '^(Boisko|Boisko sportowe|Orlik)( —|$| sportowe)'
--   AND (district IS NOT NULL OR address IS NOT NULL)
--   AND name !~ '·';

ROLLBACK;
