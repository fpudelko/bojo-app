-- Surowy output modelu zapisany do bazy jako dane: znaczniki cytowań
-- <cite index="...">, markdown [tekst](url), placeholdery antyspamowe.
--
-- Podgląd. Nic nie zapisuje.

SELECT format('%s | pole=%s | %s', name, pole, wartosc) AS wynik
FROM (
  SELECT name, 'operator' AS pole, operator AS wartosc FROM fields
  UNION ALL SELECT name, 'phone',    phone    FROM fields
  UNION ALL SELECT name, 'email',    email    FROM fields
  UNION ALL SELECT name, 'website',  website  FROM fields
  UNION ALL SELECT name, 'address',  address  FROM fields
) s
WHERE wartosc ~* '(<cite|\[.*\]\(|\[email protected\]|</|&lt;)'
ORDER BY name;
