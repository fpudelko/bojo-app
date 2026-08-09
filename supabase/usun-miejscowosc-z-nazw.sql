-- usun-miejscowosc-z-nazw.sql
--
-- Zdejmuje miejscowość z KOŃCA nazwy obiektu tam, gdzie powtarza ona to, co
-- i tak stoi w adresie.
--
-- Skąd się wzięła. Import z OSM doklejał miejscowość do nazwy, żeby „Boisko
-- piłkarskie" nie powtarzało się identycznie w każdej gminie. Ale karta obiektu
-- w aplikacji pokazuje nazwę I adres, jedno pod drugim — a adres kończy się
-- właśnie miejscowością. Wychodziło:
--
--     Boisko do siatkówki, Kozanów
--     Kozanów
--
-- Importer już tego nie robi (`build_name` w `scraper/import_osm_pbf.py`).
-- Ten skrypt naprawia wiersze, które powstały wcześniej — bez ponownego
-- pobierania kilkunastu plików po 200 MB.
--
-- Warunek jest wąski celowo: ucinamy ostatni człon nazwy TYLKO wtedy, gdy jest
-- dosłownie tym samym co ostatni człon adresu. Nazwa typu „Orlik — Zespół Szkół,
-- Warsztaty" zostaje nietknięta, bo jej ogon nie zgadza się z adresem.

-- ===========================================================================
-- KROK 1 — PODGLĄD. Uruchom sam i obejrzyj, zanim cokolwiek zapiszesz.
-- ===========================================================================

WITH kandydaci AS (
  SELECT id,
         name,
         address,
         -- ostatni człon nazwy i adresu, bez spacji wokół
         btrim(split_part(name,    ',', array_length(string_to_array(name,    ','), 1))) AS ogon_nazwy,
         btrim(split_part(address, ',', array_length(string_to_array(address, ','), 1))) AS ogon_adresu
    FROM fields
   WHERE source = 'osm'
     AND name LIKE '%,%'
     AND address IS NOT NULL
)
SELECT count(*) AS do_poprawy
  FROM kandydaci
 WHERE ogon_nazwy = ogon_adresu
   -- Nazwa nie może zniknąć w całości: „Kozanów" jako cała nazwa to nie jest
   -- doklejona miejscowość, tylko wszystko, co o tym obiekcie wiemy.
   AND position(',' in name) > 0;

-- Próbka 25 zmian do obejrzenia
WITH kandydaci AS (
  SELECT id, name, address,
         btrim(split_part(name,    ',', array_length(string_to_array(name,    ','), 1))) AS ogon_nazwy,
         btrim(split_part(address, ',', array_length(string_to_array(address, ','), 1))) AS ogon_adresu
    FROM fields
   WHERE source = 'osm' AND name LIKE '%,%' AND address IS NOT NULL
)
SELECT name AS przed,
       btrim(left(name, length(name) - length(ogon_nazwy) - 1), ' ,') AS po,
       address
  FROM kandydaci
 WHERE ogon_nazwy = ogon_adresu
 LIMIT 25;

-- ===========================================================================
-- KROK 2 — ZAPIS. Odkomentuj po obejrzeniu podglądu.
-- ===========================================================================
--
-- UPDATE fields f
--    SET name = btrim(left(f.name, length(f.name) - length(k.ogon_nazwy) - 1), ' ,')
--   FROM (
--     SELECT id,
--            btrim(split_part(name,    ',', array_length(string_to_array(name,    ','), 1))) AS ogon_nazwy,
--            btrim(split_part(address, ',', array_length(string_to_array(address, ','), 1))) AS ogon_adresu
--       FROM fields
--      WHERE source = 'osm' AND name LIKE '%,%' AND address IS NOT NULL
--   ) k
--  WHERE f.id = k.id
--    AND k.ogon_nazwy = k.ogon_adresu
--    -- po obcięciu musi zostać sensowna nazwa
--    AND length(btrim(left(f.name, length(f.name) - length(k.ogon_nazwy) - 1), ' ,')) >= 3;

-- ===========================================================================
-- UWAGA o adresach stron boisk
-- ===========================================================================
-- Adres `/boisko/[slug]` liczy się ze slugu nazwy, więc po tej zmianie stare
-- linki do obiektów przestaną trafiać (dostaną 404 z `resolveField`). Dotyczy
-- to wyłącznie obiektów z importu OSM, których nikt jeszcze nie linkował
-- z zewnątrz — mapa i wyszukiwarka w aplikacji budują adresy na bieżąco.
-- Mapa witryny (`sitemap.ts`) też liczy je z aktualnych nazw, więc przy
-- następnym przejściu robota adresy się zgodzą.
