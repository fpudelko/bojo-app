-- ============================================================================
-- 184_turniej_obserwujacy.sql — „Obserwuj turniej”.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Prośba właściciela z 2026-11-22: turniej ma być widoczny na koncie
-- („Moje”) u każdego, kto w nim gra, a kibic, rodzic albo zawodnik bez
-- drużyny ma móc go obserwować, żeby nie szukać linku na WhatsAppie w dniu
-- turnieju. Lista „moich” turniejów bierze się z czterech źródeł:
-- organizator (`turnieje`), współorganizator (`turniej_osoby`), zawodnik
-- (`turniej_zawodnicy`) i obserwujący (ta tabela).
--
-- Obserwowanie to prywatna sprawa użytkownika: każdy widzi i zmienia tylko
-- swoje wiersze. Organizator nie dostaje listy obserwujących (nie było takiej
-- potrzeby, a to dane o tym, kto czego szuka). Same dokładające zmiany,
-- automatem.
-- ============================================================================

CREATE TABLE IF NOT EXISTS turniej_obserwujacy (
  turniej_id uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (turniej_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_turniej_obserwujacy_user ON turniej_obserwujacy (user_id);

ALTER TABLE turniej_obserwujacy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Obserwowane czyta wlasciciel" ON turniej_obserwujacy;
CREATE POLICY "Obserwowane czyta wlasciciel" ON turniej_obserwujacy FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Obserwuj sam" ON turniej_obserwujacy;
CREATE POLICY "Obserwuj sam" ON turniej_obserwujacy FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Przestan obserwowac sam" ON turniej_obserwujacy;
CREATE POLICY "Przestan obserwowac sam" ON turniej_obserwujacy FOR DELETE
  TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON turniej_obserwujacy TO authenticated;
