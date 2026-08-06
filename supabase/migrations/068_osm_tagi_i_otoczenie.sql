-- 068_osm_tagi_i_otoczenie.sql
--
-- Surowe tagi OpenStreetMap, metadane wpisu i otoczenie obiektu.
--
-- Dlaczego jedna kolumna JSON zamiast dwudziestu kolumn. Importer czytał
-- kilkanaście tagów i resztę wyrzucał. Każde późniejsze „dorzućmy jeszcze X"
-- oznaczało nową kolumnę, nową migrację i PONOWNY IMPORT CAŁEGO KRAJU: pobranie
-- kilkunastu plików po 100–200 MB i godziny przetwarzania, żeby odzyskać dane,
-- które już raz mieliśmy w pamięci. `osm_tags` zapisuje komplet raz; decyzję,
-- co z tego pokazać, podejmujemy potem zwykłym SQL-em.
--
-- Kolumny osobne dostają tylko te rzeczy, po których chcemy FILTROWAĆ na mapie
-- — filtr po polu JSON nie skorzysta z indeksu tak dobrze jak kolumna, a lista
-- boisk ma być szybka przy dziesiątkach tysięcy wierszy.

ALTER TABLE fields
  -- Komplet tagów obiektu z OSM, bez interpretacji. Źródło prawdy dla wszystkiego,
  -- czego jeszcze nie wyciągnęliśmy do osobnej kolumny.
  ADD COLUMN IF NOT EXISTS osm_tags        JSONB,
  -- Kiedy ktokolwiek edytował ten obiekt w OSM. UWAGA przy interpretacji: brak
  -- edycji nie znaczy „nieaktualne". Boisko zmapowane w 2014 i od tego czasu
  -- nietknięte najczęściej dalej tam jest — po prostu nikt nie miał czego
  -- poprawiać. Ta data mówi o AKTYWNOŚCI MAPERÓW, nie o stanie boiska.
  ADD COLUMN IF NOT EXISTS osm_updated_at  TIMESTAMPTZ,
  -- Ile razy obiekt był edytowany. Wysoka liczba = ktoś go pilnuje.
  ADD COLUMN IF NOT EXISTS osm_version     INT,
  -- `check_date` / `survey:date` — jedyny tag, który znaczy „ktoś to sprawdził
  -- w terenie tego dnia". Rzadki, ale gdy jest, wart więcej niż cała reszta.
  ADD COLUMN IF NOT EXISTS osm_checked_at  DATE,

  -- --- cechy, po których filtrujemy ---
  ADD COLUMN IF NOT EXISTS is_covered      BOOLEAN,   -- zadaszone (covered/indoor)
  ADD COLUMN IF NOT EXISTS reservation     TEXT,      -- required | recommended | no
  ADD COLUMN IF NOT EXISTS operator_kind   TEXT,      -- public | private | government | community…
  ADD COLUMN IF NOT EXISTS hoops           INT,       -- liczba koszy
  ADD COLUMN IF NOT EXISTS seasonal        TEXT,      -- np. winter — lodowiska, plażówki
  ADD COLUMN IF NOT EXISTS surveillance    BOOLEAN,   -- monitoring
  ADD COLUMN IF NOT EXISTS wheelchair      TEXT,      -- yes | limited | no

  -- --- otoczenie: liczone złączeniem przestrzennym przy imporcie ---
  -- Odpowiada na pytania, których gracz nie zada wprost, a które decydują
  -- o wyborze boiska: gdzie zaparkuję, jak dojadę bez auta.
  ADD COLUMN IF NOT EXISTS parking_m       INT,       -- odległość do parkingu w metrach
  ADD COLUMN IF NOT EXISTS transit_m       INT,       -- odległość do przystanku
  ADD COLUMN IF NOT EXISTS toilets_m       INT,       -- odległość do toalety publicznej

  -- Ile boisk leży w tym samym obiekcie nadrzędnym (szkoła, ośrodek). Pozwala
  -- powiedzieć „kompleks 3 boisk" zamiast pokazywać trzy osobne pinezki bez
  -- związku.
  ADD COLUMN IF NOT EXISTS siblings        INT,

  -- Alternatywne nazwy z OSM. Ludzie szukają „Orlik na Górczynie", a nie nazwy
  -- z tabliczki przy wejściu.
  ADD COLUMN IF NOT EXISTS alt_names       TEXT[];

COMMENT ON COLUMN fields.osm_tags       IS 'Surowe tagi OSM. Źródło prawdy dla pól jeszcze nie wyciągniętych do kolumn.';
COMMENT ON COLUMN fields.osm_updated_at IS 'Ostatnia edycja w OSM. Mówi o aktywności maperów, NIE o aktualności boiska.';
COMMENT ON COLUMN fields.osm_checked_at IS 'check_date/survey:date — ktoś zweryfikował obiekt w terenie tego dnia.';
COMMENT ON COLUMN fields.siblings       IS 'Ile boisk w tym samym obiekcie nadrzędnym (kompleks).';

-- Indeksy tylko tam, gdzie filtruje mapa. Częściowe, bo większość obiektów
-- będzie miała NULL i nie ma sensu ich indeksować.
CREATE INDEX IF NOT EXISTS idx_fields_covered   ON fields (is_covered)   WHERE is_covered = true;
CREATE INDEX IF NOT EXISTS idx_fields_operator  ON fields (operator_kind) WHERE operator_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_osm_dates ON fields (osm_updated_at) WHERE osm_updated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_osm_tags  ON fields USING GIN (osm_tags);
