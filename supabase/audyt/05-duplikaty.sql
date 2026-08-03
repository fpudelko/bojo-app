-- Obiekty w tym samym punkcie. Rozstrzyga, czy 169 klastrów to kompleksy
-- z kilkoma boiskami, czy ten sam obiekt zaimportowany dwa razy.

SELECT format('%sx @ %s,%s | źródła: %s | %s',
  count(*), round(lat::numeric, 5), round(lng::numeric, 5),
  string_agg(DISTINCT coalesce(source, '?'), '+'),
  string_agg(name, ' / ' ORDER BY name)) AS wynik
FROM fields
WHERE lat IS NOT NULL
GROUP BY round(lat::numeric, 5), round(lng::numeric, 5)
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 200;
