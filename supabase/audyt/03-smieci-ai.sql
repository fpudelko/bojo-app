-- Obiekty, o których model napisał wprost "brak boiska".
-- Sprawdza, czy 13% ze wcześniejszej próbki utrzymuje się na całej bazie.

SELECT format('%s | %s | vis=%s', name, coalesce(address,'—'), map_visibility) AS wynik
FROM fields
WHERE ai_notes ~* '(brak (jakiegokolwiek|wyraźnego|widocznego|żadnego)?\s*(obiektu sportowego|boiska)|nie ma boiska|a nie (betonowe )?boisk|brak boiska)'
ORDER BY map_visibility, name;
