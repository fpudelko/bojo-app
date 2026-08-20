-- 112_seo_tier_i_lokalizacja.sql
--
-- Fundament pod tierowanie indeksacji katalogu boisk w wyszukiwarkach
-- (SEO/GEO). Audyt produkcyjnej bazy (2026-08-20) pokazał, że:
--   - `fields` ma dziś 32 684 wiersze (import całej Polski z OSM już się
--     wydarzył — scraper/import_osm_pbf.py), nie hipotetyczne "35k do
--     zaimportowania". Ryzyko cienkiej treści jest aktualne, nie prewencyjne.
--   - tylko 40 obiektów w całej historii miało kiedykolwiek mecz (events).
--     Kryterium "ma mecz" samo w sobie dałoby Tier 1 rzędu dziesiątek, nie
--     tysięcy rekordów — to sygnał PROMOCJI, nie doboru początkowego.
--   - nie ma kolumn city/voivodeship. Jest tylko district (12% wypełnione),
--     postcode (26%), osm_tags->>'addr:city' (1%). Jedyne pola w 100%:
--     lat/lng i address (wolny tekst, parsowany dziś niespójnie w kilku
--     miejscach frontendu — miejscowoscZAdresu() w boisko/[id]/page.tsx
--     i komentarz w lib/structuredData.ts#eventJsonLd).
--   - baza nie ma PostGIS — dopasowanie punkt→miasto/województwo robi
--     scraper/backfill_lokalizacja.py (Python, Shapely/osmium, reużywa
--     nearest_place() z import_osm_pbf.py), nie SQL w tej migracji.
--
-- Kolejność uruchomienia: ta migracja → scraper/backfill_lokalizacja.py
-- (ręcznie, per województwo) → triggery niżej same przeliczają seo_tier,
-- bo backfill zapisuje city/voivodeship przez UPDATE OF city, co je budzi.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS voivodeship TEXT,
  ADD COLUMN IF NOT EXISTS seo_tier SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE fields
  DROP CONSTRAINT IF EXISTS fields_seo_tier_check;
ALTER TABLE fields
  ADD CONSTRAINT fields_seo_tier_check CHECK (seo_tier IN (1, 2, 3));

COMMENT ON COLUMN fields.city IS
  'Miejscowość, normalizowana w scraper/backfill_lokalizacja.py (nearest_place() z importu OSM). NIE parsować z address w nowym kodzie.';
COMMENT ON COLUMN fields.voivodeship IS
  'Slug województwa jak w scraper/import_osm_pbf.py WOJEWODZTWA (np. "wielkopolskie").';
COMMENT ON COLUMN fields.seo_tier IS
  '1 = pełna indeksacja (index,follow), 2 = index,follow warunkowo (po Fazie 1 — programmatic content), 3 = noindex,follow. Liczone przez oblicz_seo_tier(), patrz triggery niżej — nie ustawiać ręcznie poza backfillem.';

CREATE INDEX IF NOT EXISTS idx_fields_city ON fields (city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_voivodeship ON fields (voivodeship) WHERE voivodeship IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_seo_tier ON fields (seo_tier);

-- ---------------------------------------------------------------------------
-- Miasta priorytetowe — "duże i średnie miasto" bez PostGIS i bez tabeli
-- populacji w bazie. Analogiczne do dzisiejszego hardkodowanego MIASTA
-- w frontend/src/content/graj.ts (dziś tylko Poznań), tylko szersze: ~100
-- polskich miast powyżej ok. 15 tys. mieszkańców (dane GUS, publiczne).
-- Rozszerzenie hubów /[sport]/[miasto] poza Poznań to osobna decyzja
-- (Faza 2, BACKLOG.md) — ta tabela służy WYŁĄCZNIE do tieringu indeksacji.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS miasta_priorytetowe (
  nazwa TEXT PRIMARY KEY
);

ALTER TABLE miasta_priorytetowe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "miasta_priorytetowe_select" ON miasta_priorytetowe;
CREATE POLICY "miasta_priorytetowe_select" ON miasta_priorytetowe FOR SELECT
  USING (true);

INSERT INTO miasta_priorytetowe (nazwa) VALUES
  ('Warszawa'), ('Kraków'), ('Łódź'), ('Wrocław'), ('Poznań'),
  ('Gdańsk'), ('Szczecin'), ('Bydgoszcz'), ('Lublin'), ('Białystok'),
  ('Katowice'), ('Gdynia'), ('Częstochowa'), ('Radom'), ('Sosnowiec'),
  ('Toruń'), ('Kielce'), ('Rzeszów'), ('Gliwice'), ('Zabrze'),
  ('Olsztyn'), ('Bielsko-Biała'), ('Bytom'), ('Zielona Góra'), ('Rybnik'),
  ('Ruda Śląska'), ('Opole'), ('Tychy'), ('Gorzów Wielkopolski'), ('Dąbrowa Górnicza'),
  ('Elbląg'), ('Płock'), ('Wałbrzych'), ('Włocławek'), ('Tarnów'),
  ('Chorzów'), ('Koszalin'), ('Kalisz'), ('Legnica'), ('Grudziądz'),
  ('Słupsk'), ('Jaworzno'), ('Jastrzębie-Zdrój'), ('Nowy Sącz'), ('Jelenia Góra'),
  ('Siedlce'), ('Mysłowice'), ('Konin'), ('Piotrków Trybunalski'), ('Inowrocław'),
  ('Lubin'), ('Ostrowiec Świętokrzyski'), ('Suwałki'), ('Stargard'), ('Gniezno'),
  ('Ostrów Wielkopolski'), ('Siemianowice Śląskie'), ('Głogów'), ('Pabianice'), ('Chełm'),
  ('Zamość'), ('Tomaszów Mazowiecki'), ('Łomża'), ('Tarnowskie Góry'), ('Przemyśl'),
  ('Stalowa Wola'), ('Kędzierzyn-Koźle'), ('Piła'), ('Mielec'), ('Świdnica'),
  ('Ostrołęka'), ('Będzin'), ('Racibórz'), ('Legionowo'), ('Leszno'),
  ('Zgierz'), ('Piekary Śląskie'), ('Skierniewice'), ('Świnoujście'), ('Krosno'),
  ('Ełk'), ('Starachowice'), ('Biała Podlaska'), ('Wejherowo'), ('Puławy'),
  ('Bielawa'), ('Żory'), ('Sopot'), ('Iława'), ('Rumia'),
  ('Nysa'), ('Wodzisław Śląski'), ('Otwock'), ('Kutno'), ('Wołomin'),
  ('Sieradz'), ('Piaseczno'), ('Ciechanów'), ('Skarżysko-Kamienna'), ('Świętochłowice'),
  ('Malbork'), ('Jarosław')
ON CONFLICT (nazwa) DO NOTHING;

-- ---------------------------------------------------------------------------
-- oblicz_seo_tier — czysta funkcja, bez side-effectów. Bierze dane obiektu
-- jako parametry (nie SELECT po id z fields) właśnie po to, żeby działała
-- poprawnie w triggerze BEFORE INSERT — w tym momencie NEW.* jeszcze nie
-- jest widoczne przez SELECT z tej samej tabeli.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION oblicz_seo_tier(
  p_id uuid, p_city text, p_is_verified boolean, p_sport text[], p_name text
) RETURNS smallint
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN (p_city IS NOT NULL AND p_city IN (SELECT nazwa FROM miasta_priorytetowe))
      OR p_is_verified IS TRUE
      OR EXISTS (SELECT 1 FROM events e WHERE e.field_id = p_id)
      OR EXISTS (SELECT 1 FROM field_comments fc WHERE fc.field_id = p_id AND fc.deleted_at IS NULL)
    THEN 1
    WHEN p_city IS NOT NULL
      AND p_sport IS NOT NULL AND array_length(p_sport, 1) > 0
      AND coalesce(length(trim(p_name)), 0) > 0
    THEN 2
    ELSE 3
  END
$$;

COMMENT ON FUNCTION oblicz_seo_tier IS
  'Tier 1: miasto priorytetowe, LUB is_verified_venue, LUB ma mecz, LUB ma komentarz. Tier 2: ma miejscowość + sport + nazwę. Tier 3: reszta. Historia meczów/komentarzy jest sygnałem promocji (patrz triggery events/field_comments), nie głównym kryterium doboru — przy 40 obiektach z meczem w całej bazie samo to kryterium dałoby Tier 1 rzędu dziesiątek, nie tysięcy.';

CREATE OR REPLACE FUNCTION trg_fields_przelicz_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.seo_tier := oblicz_seo_tier(NEW.id, NEW.city, NEW.is_verified_venue, NEW.sport, NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fields_przelicz_tier ON fields;
CREATE TRIGGER fields_przelicz_tier
  BEFORE INSERT OR UPDATE OF city, is_verified_venue, sport, name ON fields
  FOR EACH ROW EXECUTE FUNCTION trg_fields_przelicz_tier();

-- Awans do Tier 1, gdy ktoś zorganizuje mecz na obiekcie — jednokierunkowy
-- (mecz odwołany/usunięty nie degraduje z powrotem, tak jak inne "raz
-- zdobyte" stany w tej aplikacji, np. is_verified_venue).
CREATE OR REPLACE FUNCTION trg_events_promuj_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.field_id IS NOT NULL THEN
    UPDATE fields SET seo_tier = 1 WHERE id = NEW.field_id AND seo_tier <> 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_promuj_tier ON events;
CREATE TRIGGER events_promuj_tier
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION trg_events_promuj_tier();

CREATE OR REPLACE FUNCTION trg_field_comments_promuj_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE fields SET seo_tier = 1 WHERE id = NEW.field_id AND seo_tier <> 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS field_comments_promuj_tier ON field_comments;
CREATE TRIGGER field_comments_promuj_tier
  AFTER INSERT ON field_comments
  FOR EACH ROW EXECUTE FUNCTION trg_field_comments_promuj_tier();
