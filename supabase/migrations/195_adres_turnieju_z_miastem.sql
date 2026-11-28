-- ============================================================================
-- 195_adres_turnieju_z_miastem.sql — miasto w adresie turnieju.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Prośba właściciela (2026-11-28): adres z nazwą (177) to dziś
-- „gramy-dla-marysi-28-11-2026”. Od następnego turnieju ma nieść też miasto:
-- „gramy-dla-marysi-lubon-28-11-2026”. Kto dostaje link, od razu widzi, gdzie
-- się gra, a turnieje o tej samej nazwie w różnych miastach nie dostają
-- dopisku „-2”.
--
-- Zmienia się WYŁĄCZNIE wzór dla NOWYCH turniejów (wyzwalacz AFTER INSERT
-- z 177 woła tę funkcję). Istniejące adresy zostają: linki już poszły
-- w świat. Miasta nie dokładamy, gdy już stoi w nazwie („Turniej Luboń”).
-- Całość mieści się w 70 znakach z `nadaj_adres()`: przycina się nazwa,
-- nie miasto ani data.
-- Same dokładające zmiany (podmiana ciała funkcji), automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION adres_dla_turnieju(t turnieje)
RETURNS text LANGUAGE sql STABLE AS $$
  WITH c AS (
    SELECT slug_z_tekstu(t.nazwa) AS nazwa,
           slug_z_tekstu(t.miasto) AS miasto,
           to_char(t.data_startu, 'DD-MM-YYYY') AS data
  ), m AS (
    SELECT nazwa, data,
           CASE WHEN miasto = '' OR ('-' || nazwa || '-') LIKE ('%-' || miasto || '-%') THEN ''
                ELSE miasto END AS miasto
      FROM c
  )
  SELECT btrim(left(nazwa, 70 - char_length(data) - 1 - CASE WHEN miasto = '' THEN 0 ELSE char_length(miasto) + 1 END), '-')
         || CASE WHEN miasto = '' THEN '' ELSE '-' || miasto END
         || '-' || data
    FROM m
$$;
