-- ============================================================================
-- BOJO — dlaczego obiektów z lubelskiego nie widać na mapie
-- ============================================================================
-- Odtwarza DOKŁADNIE zapytanie, którym mapa pobiera obiekty
-- (`getExplorerFields()` w lib/api.ts), i pokazuje, na którym warunku
-- wykrusza się ile obiektów. Same SELECT-y.
--
-- Uruchamiaj po jednym zapytaniu (zaznacz + Ctrl+Enter).
-- ============================================================================


-- ── 1. LEJEK — na czym się urywa ────────────────────────────────────────────
-- Każdy wiersz to kolejny warunek dokładany do zapytania mapy.
-- Tam, gdzie liczba spada do zera, leży przyczyna.
WITH lub AS (
  SELECT * FROM fields
  WHERE lat BETWEEN 50.20 AND 52.30
    AND lng BETWEEN 21.50 AND 24.20
)
SELECT format('%-46s %s', etykieta, liczba) AS wynik
FROM (
  SELECT '1. w prostokącie lubelskiego (cokolwiek)' AS etykieta, count(*) AS liczba, 1 AS ord FROM lub
  UNION ALL SELECT '2. + ma współrzędne', count(*), 2 FROM lub WHERE lat IS NOT NULL AND lng IS NOT NULL
  UNION ALL SELECT '3. + source = osm', count(*), 3 FROM lub WHERE source = 'osm'
  UNION ALL SELECT '4. + map_visibility = public', count(*), 4
    FROM lub WHERE lat IS NOT NULL AND map_visibility = 'public'
  UNION ALL SELECT '5. + sport z listy mapy  ← TO WIDZI MAPA', count(*), 5
    FROM lub WHERE lat IS NOT NULL AND map_visibility = 'public'
      AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna']
) s
ORDER BY ord;


-- ── 2. Jakie sporty faktycznie wpadły z importu ─────────────────────────────
-- Mapa filtruje po sześciu dyscyplinach. Wszystko inne (rugby, hokej,
-- baseball, „inne") nie pojawi się, choćby było opublikowane.
SELECT format('%-24s %s', coalesce(s.sport_val, '(brak)'), count(*)) AS wynik
FROM fields f
CROSS JOIN LATERAL unnest(coalesce(f.sport, ARRAY[NULL::text])) AS s(sport_val)
WHERE f.lat BETWEEN 50.20 AND 52.30 AND f.lng BETWEEN 21.50 AND 24.20
GROUP BY s.sport_val
ORDER BY count(*) DESC;


-- ── 3. Ile w ogóle zobaczy mapa — w całej Polsce ────────────────────────────
-- Jedna liczba: dokładnie tyle pinezek dostanie przeglądarka.
SELECT format('mapa pobierze %s obiektów (limit zapytania: 5000)', count(*)) AS wynik
FROM fields
WHERE map_visibility = 'public'
  AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna'];


-- ── 4. Czy import w ogóle coś zapisał ───────────────────────────────────────
-- Jeśli liczba jest podejrzanie okrągła (np. 20), import poszedł z ustawionym
-- `limit` — w formularzu akcji domyślnie jest 0, ale przy testach łatwo zostawić 20.
SELECT format('wierszy z source=osm w lubelskiem: %s | najnowszy: %s',
  count(*), coalesce(max(created_at)::text, '—')) AS wynik
FROM fields
WHERE source = 'osm'
  AND lat BETWEEN 50.20 AND 52.30 AND lng BETWEEN 21.50 AND 24.20;
