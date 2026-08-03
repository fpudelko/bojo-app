-- Adresy, które wyszły zepsute z reverse geocodingu:
--   "park owa"        — rozbite słowo (ul. Parkowa)
--   "ul. 187", "ul. 32" — numer drogi wojewódzkiej wzięty za nazwę ulicy
--   "Poznań"          — sama miejscowość bez ulicy
--
-- Podgląd. Nic nie zapisuje.

SELECT format('%sx | %s | %s', count(*), address, string_agg(DISTINCT name, ' / ')) AS wynik
FROM fields
WHERE address ~ '^(ul\.|al\.|os\.)?\s*\d+$'
   OR address ~* '^park owa'
   OR address ~ '^\s*(Poznań|Polska)\s*$'
   OR address !~ '[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{4}'
GROUP BY address
ORDER BY count(*) DESC;
