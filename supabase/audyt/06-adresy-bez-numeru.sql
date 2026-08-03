-- Próbka 150 z 1170 obiektów bez numeru w adresie. Pokaże, ile z tego to
-- uczciwe "boisko w parku", a ile urwany albo pusty adres.

SELECT format('%s ~ %s ~ %s ~ %s',
  name, coalesce(address, 'BRAK ADRESU'),
  coalesce(district, '—'), coalesce(source, '—')) AS wynik
FROM fields
WHERE address IS NULL OR address !~ '\d'
ORDER BY md5(id::text)
LIMIT 150;
