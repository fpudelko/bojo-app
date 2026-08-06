-- 063_field_comments.sql
--
-- Komentarze pod obiektem z katalogu boisk.
--
-- Po co osobna tabela zamiast doklejenia do `event_comments`. Tamte komentarze
-- należą do jednego meczu i znikają razem z nim (`ON DELETE CASCADE`).
-- Komentarz pod boiskiem żyje dłużej niż każdy pojedynczy mecz i mówi
-- o miejscu: „bramki bez siatek", „brama od strony parkingu zamknięta po 20",
-- „nawierzchnia sztuczna, nie trawa". Wspólna tabela z kolumną „na co wskazuje"
-- oznaczałaby, że każde zapytanie o komentarze meczu musi pamiętać o filtrze,
-- a polityki RLS obsłużyć oba przypadki naraz.
--
-- Kształt celowo bliźniaczy do `event_comments` z migracji `026`: ta sama
-- długość, to samo miękkie kasowanie, te same reguły dostępu. Dzięki temu
-- komponent i funkcje w `lib/` czyta się jak kopię tamtych, bo nią są.

CREATE TABLE IF NOT EXISTS field_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id   uuid NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_name  text NOT NULL,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Strona boiska pobiera komentarze po `field_id` i sortuje po dacie.
CREATE INDEX IF NOT EXISTS idx_field_comments_field
  ON field_comments (field_id, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE field_comments ENABLE ROW LEVEL SECURITY;

-- Czyta każdy, także niezalogowany: strony boisk są publiczne i mają sens
-- w wynikach wyszukiwania razem z tym, co ludzie o obiekcie napisali.
DROP POLICY IF EXISTS "field_comments_select" ON field_comments;
CREATE POLICY "field_comments_select" ON field_comments FOR SELECT
  USING (deleted_at IS NULL);

-- Pisze zalogowany, wyłącznie we własnym imieniu.
DROP POLICY IF EXISTS "field_comments_insert" ON field_comments;
CREATE POLICY "field_comments_insert" ON field_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Kasuje miękko tylko autor. Administrator ma osobną ścieżkę: `is_admin`
-- w `profiles` — bez tego moderacja obraźliwego wpisu wymagałaby wejścia
-- do SQL Editora.
DROP POLICY IF EXISTS "field_comments_update" ON field_comments;
CREATE POLICY "field_comments_update" ON field_comments FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
