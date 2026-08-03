-- ============================================================================
-- NAPRAWA: adresy zepsute przez reverse geocoding
-- ============================================================================
--   "park owa"          — rozbite słowo (ul. Parkowa)
--   "ul. 187", "ul. 32" — numer drogi wojewódzkiej wzięty za nazwę ulicy
--   "Poznań"            — sama miejscowość, w dodatku błędna: obiekt
--                         o współrzędnych 52.20268,17.12413 leży pod Środą
--                         Wielkopolską, nie w Poznaniu
--
-- Kasujemy takie adresy zamiast je zgadywać. Puste pole jest uczciwe;
-- "ul. 187" wygląda jak dane, a nie jest.
--
-- Transakcja kończy się ROLLBACK. Zamień na COMMIT, gdy podgląd się zgadza.
-- ============================================================================

BEGIN;

SELECT format('%sx | "%s"', count(*), address) AS wynik
FROM fields
WHERE address ~ '^(ul\.|al\.|os\.|pl\.)?\s*\d+$'
   OR address ~* '^park owa$'
   OR address ~ '^\s*(Poznań|Polska)\s*$'
GROUP BY address
ORDER BY count(*) DESC;

UPDATE fields
SET address = NULL
WHERE address ~ '^(ul\.|al\.|os\.|pl\.)?\s*\d+$'
   OR address ~* '^park owa$'
   OR address ~ '^\s*(Poznań|Polska)\s*$';

ROLLBACK;  -- ← zamień na COMMIT, gdy podgląd się zgadza
