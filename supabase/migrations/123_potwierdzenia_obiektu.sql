-- 123_potwierdzenia_obiektu.sql
--
-- Faza 3 SEO/GEO (BACKLOG.md §7a) — mikro-ankiety UGC: "czy to boisko jest
-- oświetlone?", "jaka tu jest nawierzchnia?". Google traktuje ciągłą zmianę
-- treści przez użytkowników jako sygnał świeżości; dla graczy to po prostu
-- fakt o obiekcie potwierdzony przez kogoś, kto tam realnie był.
--
-- OSOBNA TABELA od `zgloszenia_bledow` (migracja 099) — to inny mechanizm
-- z innym odbiorcą. `zgloszenia_bledow` jest widoczne WYŁĄCZNIE dla admina
-- i trafia do moderacji ("coś tu się nie zgadza, sprawdźcie"); to poniżej
-- jest publiczny, zagregowany głos ("potwierdzam: tak") bez moderacji —
-- świadomie NIC nie nadpisuje w `fields` (kolumny `lit`/`surface` z OSM
-- zostają nietknięte, patrz otwarty punkt "Zgłaszanie błędów: w aplikacji
-- i w danych obiektu" w BACKLOG.md o tym, czy/kiedy przejść na override).
--
-- Kształt bliźniaczy do `field_comments` (migracja 063): ten sam wzorzec
-- RLS (publiczny odczyt, zapis wyłącznie we własnym imieniu), bo to ta sama
-- klasa danych — publiczna, przypisana do zalogowanego autora, bez PII.

CREATE TABLE IF NOT EXISTS potwierdzenia_obiektu (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    uuid NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- Dwa fakty na start — dokładnie te z wklejonego przez użytkownika planu
  -- SEO/GEO. Kolejny fakt = kolejna dozwolona wartość `wartosc`, nie nowa
  -- kolumna ani nowa tabela.
  fakt        TEXT NOT NULL CHECK (fakt IN ('oswietlenie', 'nawierzchnia')),

  -- Zestaw wartości zależny od `fakt`. Nawierzchnia używa DOKŁADNIE tych
  -- samych sześciu kluczy co SURFACE_MAP w scraper/import_osm_pbf.py i
  -- SURFACE_LABELS w frontend/src/lib/labels.ts — inaczej głos użytkownika
  -- i dane z OSM pokazywałyby się pod różnymi etykietami tej samej rzeczy.
  wartosc     TEXT NOT NULL,
  CONSTRAINT potwierdzenia_obiektu_wartosc_check CHECK (
    (fakt = 'oswietlenie' AND wartosc IN ('tak', 'nie'))
    OR (fakt = 'nawierzchnia' AND wartosc IN ('grass', 'artificial', 'hardcourt', 'concrete', 'clay', 'sand'))
  ),

  utworzono   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Jeden głos na fakt na obiekt na osobę. `ON CONFLICT` w zapisie (patrz
  -- lib/potwierdzeniaObiektu.ts) pozwala zmienić zdanie, nie zagłosować
  -- dwa razy pod dwoma wpisami.
  UNIQUE (field_id, user_id, fakt)
);

CREATE INDEX IF NOT EXISTS idx_potwierdzenia_obiektu_field
  ON potwierdzenia_obiektu (field_id);

ALTER TABLE potwierdzenia_obiektu ENABLE ROW LEVEL SECURITY;

-- Czyta każdy, także niezalogowany — strona boiska jest publiczna, a "kto
-- potwierdził oświetlenie" nie jest informacją wrażliwą (ten sam poziom
-- jawności co autor komentarza pod obiektem, field_comments).
DROP POLICY IF EXISTS "potwierdzenia_obiektu_select" ON potwierdzenia_obiektu;
CREATE POLICY "potwierdzenia_obiektu_select" ON potwierdzenia_obiektu FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "potwierdzenia_obiektu_insert" ON potwierdzenia_obiektu;
CREATE POLICY "potwierdzenia_obiektu_insert" ON potwierdzenia_obiektu FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Zmiana zdania nadpisuje własny głos zamiast dokładać kolejny.
DROP POLICY IF EXISTS "potwierdzenia_obiektu_update" ON potwierdzenia_obiektu;
CREATE POLICY "potwierdzenia_obiektu_update" ON potwierdzenia_obiektu FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
