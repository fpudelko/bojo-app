-- 159_turniej_galeria_sponsorzy.sql — galeria zdjęć i sponsorzy turnieju.
-- ============================================================================
-- PO CO. Zgłoszone przy przeglądzie modułu (patrz BACKLOG.md, PR #403): turniej
-- dziś nie ma jak pokazać atmosfery z poprzedniej edycji ani podziękować
-- sponsorom. Obie rzeczy to treść PUBLICZNA (jak terminarz, jak ogłoszenia
-- z migracji `150`) — czyta każdy, dokłada wyłącznie zarządzający turniejem.
-- Pełny plan → docs/turniej-galeria-sponsorzy-plan.md.
--
-- BUCKET 'turniej-media' — załóż ręcznie w Supabase Dashboard → Storage jako
-- PUBLICZNY (ten sam krok co przy 'covers', migracja 046), przed albo po
-- uruchomieniu tej migracji — kolejność nie ma znaczenia, `CREATE POLICY` na
-- `storage.objects` nie wymaga, żeby bucket już istniał.
--
-- ŚCIEŻKA JEST GRANICĄ DOSTĘPU, NIE TYLKO KONWENCJĄ. `covers` (046) ma
-- politykę WYŁĄCZNIE po `bucket_id` — każdy zalogowany może nadpisać albo
-- skasować CUDZE zdjęcie, bo nic w polityce nie sprawdza, czyj to obiekt.
-- Tu ścieżka ma sztywny kształt `turnieje/<turniej_id>/galeria/<uuid>.<ext>`
-- albo `.../sponsorzy/<uuid>.<ext>`, a polityka czyta drugi segment ścieżki
-- (`storage.foldername(name)`) jako `turniej_id` i woła `czy_zarzadza_turniejem()`
-- — dokładnie tę samą funkcję, co polityki na zwykłych tabelach turnieju.
-- Nie da się wgrać pliku pod cudzy turniej, nawet znając jego UUID.
-- ============================================================================

-- ── 1. Zdjęcia ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_zdjecia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id   uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  sciezka      text NOT NULL,
  kolejnosc    int NOT NULL DEFAULT 0,
  dodane_przez uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zdjecia_turniej ON turniej_zdjecia(turniej_id, kolejnosc);

ALTER TABLE turniej_zdjecia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zdjecia czyta kazdy" ON turniej_zdjecia;
CREATE POLICY "Zdjecia czyta kazdy" ON turniej_zdjecia FOR SELECT USING (true);

DROP POLICY IF EXISTS "Zdjecia zarzadza organizator" ON turniej_zdjecia;
CREATE POLICY "Zdjecia zarzadza organizator" ON turniej_zdjecia FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));

-- ── 2. Sponsorzy ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_sponsorzy (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id   uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  nazwa        text NOT NULL CHECK (char_length(nazwa) BETWEEN 1 AND 60),
  sciezka_logo text,
  link         text,
  kolejnosc    int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsorzy_turniej ON turniej_sponsorzy(turniej_id, kolejnosc);

ALTER TABLE turniej_sponsorzy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sponsorzy czyta kazdy" ON turniej_sponsorzy;
CREATE POLICY "Sponsorzy czyta kazdy" ON turniej_sponsorzy FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sponsorzy zarzadza organizator" ON turniej_sponsorzy;
CREATE POLICY "Sponsorzy zarzadza organizator" ON turniej_sponsorzy FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));

-- ── 3. Storage: bucket 'turniej-media' ──────────────────────────────────────
-- Ścieżka: turnieje/<turniej_id>/{galeria|sponsorzy}/<uuid>.<ext> — segment
-- [2] (1-indeksowany, jak w polityce awatarów z migracji 006) jest zawsze
-- UUID-em turnieju.

DROP POLICY IF EXISTS "Media turnieju sa publiczne" ON storage.objects;
CREATE POLICY "Media turnieju sa publiczne" ON storage.objects FOR SELECT
  USING (bucket_id = 'turniej-media');

DROP POLICY IF EXISTS "Media turnieju wgrywa zarzadzajacy" ON storage.objects;
CREATE POLICY "Media turnieju wgrywa zarzadzajacy" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'turniej-media'
    AND czy_zarzadza_turniejem(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "Media turnieju kasuje zarzadzajacy" ON storage.objects;
CREATE POLICY "Media turnieju kasuje zarzadzajacy" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'turniej-media'
    AND czy_zarzadza_turniejem(((storage.foldername(name))[2])::uuid)
  );

-- Bez UPDATE: pliki się nie nadpisuje (nowy upload = nowa ścieżka z nowym
-- UUID-em w nazwie), więc UPDATE na obiekcie nie ma tu zastosowania —
-- inaczej niż w 'covers', gdzie ta sama ścieżka wraca przy każdej zmianie
-- okładki.
