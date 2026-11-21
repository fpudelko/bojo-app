-- ============================================================================
-- 177_adresy_z_nazwa.sql — adresy turniejów i meczów z nazwą zamiast uuid.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Link wysyłany na Messengera wyglądał tak:
--   bojo.pl/turnieje/e9a3763f-7bd9-99e9-76d6-1c852d6b8f47
-- i nie mówił nic, zanim ktoś w niego kliknie. Decyzja właściciela
-- z 2026-11-21: turniej i mecz mają adres z nazwą i datą, np.
--   bojo.pl/turnieje/gramy-dla-marysi-28-11-2026
--   bojo.pl/wydarzenia/czwartkowa-gierka-27-11-2026
-- (organizator z Lubonia sam proponował „link z nazwy i daty”).
--
-- OSOBNA TABELA, NIE KOLUMNA `slug` W `events`. Uzupełnienie adresów dla
-- istniejących meczów kolumną wymagałoby UPDATE na `events`, a na tej tabeli
-- wisi kilkanaście wyzwalaczy AFTER UPDATE (powiadomienia o zmianie terminu,
-- warunków, odwołaniu, poczta do gości). Wstawienie wierszy do osobnej tabeli
-- nie dotyka meczów wcale. Do tego frontend czyta adres osobnym zapytaniem
-- i bez tej migracji (podgląd PR-a na starej bazie) po prostu zostaje przy
-- uuid, zamiast wywrócić stronę meczu nieznaną kolumną.
--
-- ADRES JEST STAŁY. Nadawany raz, przy utworzeniu; zmiana nazwy albo daty go
-- nie przepisuje, bo rozesłane linki muszą działać. Stary adres z uuid działa
-- dalej (middleware tłumaczy adres z nazwą na uuid, nie odwrotnie).
-- Powtórzona nazwa i data dostaje dopisek „-2”, „-3”.
--
-- Same dokładające zmiany (tabela, funkcje, wyzwalacze, INSERT), automatem.
-- ============================================================================

CREATE TABLE IF NOT EXISTS adresy_z_nazwa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  turniej_id  uuid REFERENCES turnieje ON DELETE CASCADE,
  event_id    uuid REFERENCES events ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adres_jednego_obiektu CHECK (num_nonnulls(turniej_id, event_id) = 1)
);

-- Osobne przestrzenie: turniej i mecz mogą mieć ten sam adres, bo żyją pod
-- różnymi ścieżkami (/turnieje/…, /wydarzenia/…).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_adres_turnieju ON adresy_z_nazwa (slug) WHERE turniej_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_adres_meczu    ON adresy_z_nazwa (slug) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_adres_dla_turnieju ON adresy_z_nazwa (turniej_id) WHERE turniej_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_adres_dla_meczu    ON adresy_z_nazwa (event_id) WHERE event_id IS NOT NULL;

ALTER TABLE adresy_z_nazwa ENABLE ROW LEVEL SECURITY;
-- Czyta każdy: adres to część publicznego linku. Mecze czyta dziś każdy
-- (patrz „ZNANE, ŚWIADOMIE OTWARTE” w supabase/test/rls.sql), więc adres nie
-- odsłania niczego, czego nie widać już po uuid. Pisze wyłącznie
-- `nadaj_adres()` (SECURITY DEFINER), żadnej polityki zapisu.
DROP POLICY IF EXISTS "Adresy czyta kazdy" ON adresy_z_nazwa;
CREATE POLICY "Adresy czyta kazdy" ON adresy_z_nazwa FOR SELECT USING (true);
GRANT SELECT ON adresy_z_nazwa TO anon, authenticated;

-- „Gramy dla Marysi!” → „gramy-dla-marysi”. Polskie litery bez ogonków,
-- reszta znaków na myślnik, najwyżej 60 znaków bez myślnika na końcu.
CREATE OR REPLACE FUNCTION slug_z_tekstu(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(left(btrim(regexp_replace(
           translate(lower(coalesce(p, '')), 'ąćęłńóśźżáéíúüöä', 'acelnoszzaeiuuoa'),
           '[^a-z0-9]+', '-', 'g'), '-'), 60), '-')
$$;

-- Nadaje adres obiektowi, który go jeszcze nie ma. Zajęty adres dostaje
-- dopisek „-2”, „-3”… Zwraca nadany adres albo NULL, gdy obiekt już go ma.
CREATE OR REPLACE FUNCTION nadaj_adres(p_baza text, p_turniej uuid, p_event uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_baza text := nullif(btrim(left(coalesce(p_baza, ''), 70), '-'), '');
  v_slug text;
  n      int  := 1;
BEGIN
  IF EXISTS (SELECT 1 FROM adresy_z_nazwa a
              WHERE a.turniej_id = p_turniej OR a.event_id = p_event) THEN
    RETURN NULL;
  END IF;
  v_baza := coalesce(v_baza, CASE WHEN p_turniej IS NOT NULL THEN 'turniej' ELSE 'mecz' END);
  v_slug := v_baza;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM adresy_z_nazwa a
       WHERE a.slug = v_slug
         AND ((p_turniej IS NOT NULL AND a.turniej_id IS NOT NULL)
           OR (p_event   IS NOT NULL AND a.event_id   IS NOT NULL))
    ) THEN
      BEGIN
        INSERT INTO adresy_z_nazwa (slug, turniej_id, event_id) VALUES (v_slug, p_turniej, p_event);
        RETURN v_slug;
      EXCEPTION WHEN unique_violation THEN
        -- Wyścig z równoległym zapisem: próbujemy następnego numeru.
        NULL;
      END;
    END IF;
    n := n + 1;
    v_slug := v_baza || '-' || n;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION adres_dla_turnieju(t turnieje)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT slug_z_tekstu(t.nazwa) || '-' || to_char(t.data_startu, 'DD-MM-YYYY')
$$;

CREATE OR REPLACE FUNCTION adres_dla_meczu(e events)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(slug_z_tekstu(e.title), ''), slug_z_tekstu(e.sport))
         || '-' || to_char(e.event_date, 'DD-MM-YYYY')
$$;

-- Adres powstaje razem z obiektem. Błąd przy nadawaniu adresu nie może
-- zablokować założenia meczu: wtedy mecz zostaje przy adresie z uuid.
CREATE OR REPLACE FUNCTION nadaj_adres_turniejowi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM nadaj_adres(adres_dla_turnieju(NEW), NEW.id, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'nadaj_adres_turniejowi(%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION nadaj_adres_meczowi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM nadaj_adres(adres_dla_meczu(NEW), NULL, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'nadaj_adres_meczowi(%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nadaj_adres_turniejowi ON turnieje;
CREATE TRIGGER trg_nadaj_adres_turniejowi AFTER INSERT ON turnieje
  FOR EACH ROW EXECUTE FUNCTION nadaj_adres_turniejowi();

DROP TRIGGER IF EXISTS trg_nadaj_adres_meczowi ON events;
CREATE TRIGGER trg_nadaj_adres_meczowi AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION nadaj_adres_meczowi();

-- Istniejące obiekty, od najstarszego: pierwszy z danej nazwy i daty dostaje
-- adres bez dopisku. Pętla, nie `SELECT … ORDER BY`: funkcja w liście SELECT
-- liczy się przed sortowaniem, więc kolejność nadawania byłaby przypadkowa.
-- Idempotentne: obiekt z adresem jest pomijany.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT t.* FROM turnieje t
            WHERE NOT EXISTS (SELECT 1 FROM adresy_z_nazwa a WHERE a.turniej_id = t.id)
            ORDER BY t.created_at, t.id LOOP
    PERFORM nadaj_adres(slug_z_tekstu(r.nazwa) || '-' || to_char(r.data_startu, 'DD-MM-YYYY'), r.id, NULL);
  END LOOP;
  FOR r IN SELECT e.id, e.title, e.sport, e.event_date FROM events e
            WHERE NOT EXISTS (SELECT 1 FROM adresy_z_nazwa a WHERE a.event_id = e.id)
            ORDER BY e.created_at, e.id LOOP
    PERFORM nadaj_adres(coalesce(nullif(slug_z_tekstu(r.title), ''), slug_z_tekstu(r.sport))
                        || '-' || to_char(r.event_date, 'DD-MM-YYYY'), NULL, r.id);
  END LOOP;
END $$;
