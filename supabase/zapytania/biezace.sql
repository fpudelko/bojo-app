-- Diagnoza: mecze są na liście, na mapie pusto.
-- Mapa rysuje pinezkę tylko dla meczu, który MA lat/lng (GamesMarkersLayer).

SELECT 'publiczne nadchodzące — ile ma współrzędne' AS co,
       count(*)                                    AS wszystkie,
       count(lat)                                  AS z_lat,
       count(lng)                                  AS z_lng,
       count(*) FILTER (WHERE lat IS NULL OR lng IS NULL) AS bez_wspolrzednych,
       count(field_id)                             AS z_obiektem
  FROM events
 WHERE visibility = 'public'
   AND event_date >= CURRENT_DATE
   AND status <> 'cancelled';

-- Czy to regresja świeża: rozkład po dacie utworzenia.
SELECT 'utworzone — brak współrzędnych w czasie' AS co,
       date_trunc('day', created_at)::date        AS dzien,
       count(*)                                   AS mecze,
       count(*) FILTER (WHERE lat IS NULL)        AS bez_lat
  FROM events
 WHERE created_at > now() - interval '21 days'
 GROUP BY 2
 ORDER BY 2 DESC;

-- Konkrety do obejrzenia.
SELECT 'ostatnie publiczne' AS co, id, title, field_name, field_id, lat, lng, created_at
  FROM events
 WHERE visibility = 'public'
   AND event_date >= CURRENT_DATE
 ORDER BY created_at DESC
 LIMIT 10;

-- Czy obiekt, do którego mecz jest przypięty, ma współrzędne (mecz mógłby je
-- odziedziczyć, gdyby aplikacja to robiła — sprawdzamy, czy jest z czego).
SELECT 'mecz bez lat, ale obiekt z lat' AS co, count(*) AS ile
  FROM events e
  JOIN fields f ON f.id = e.field_id
 WHERE e.visibility = 'public'
   AND e.event_date >= CURRENT_DATE
   AND e.lat IS NULL
   AND f.lat IS NOT NULL;
