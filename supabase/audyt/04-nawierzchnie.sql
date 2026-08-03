-- Rozkład nawierzchni. Jeśli obok siebie stoi 'artificial' i 'sztuczna_trawa',
-- to słownik rozjechał się między importem OSM a analizą AI.

SELECT format('%-26s %s', coalesce(surface, '(brak)'), count(*)) AS wynik
FROM fields
GROUP BY surface
ORDER BY count(*) DESC;
