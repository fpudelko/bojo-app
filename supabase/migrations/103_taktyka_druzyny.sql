-- 103: Taktyka drużyny — ustawienie na boisku, pozycje graczy i czat drużyny.
--
-- PO CO: po opublikowaniu składów mecz ma dwie drużyny, ale każda z nich jest
-- dziś tylko listą nazwisk. Kto gra w obronie, kto na skrzydle i co robimy
-- z piłką — ustala się przed meczem, ustnie, i połowa składu tego nie słyszy.
-- Osobno: rozmowa meczu (`event_comments`) jest wspólna dla obu drużyn, więc
-- nie da się w niej uzgodnić niczego, czego nie ma przeczytać rywal.
--
-- TRZY TABELE, TRZY RÓŻNE RZECZY:
--   `event_team_setup`    — ustawienie i taktyka drużyny (jeden wiersz na drużynę),
--   `event_team_slots`    — kto stoi na której pozycji,
--   `event_team_messages` — czat WEWNĄTRZ drużyny.
--
-- STATUS: funkcja wchodzi WYŁĄCZNIE dla administratora platformy (bramka
-- w interfejsie). Polityki są jednak pisane docelowo — dla uczestników meczu,
-- nie dla admina — bo polityka „tylko admin", którą potem trzeba przepisać,
-- to drugi zestaw reguł do pomylenia. Zdjęcie bramki w interfejsie ma być
-- jedyną zmianą potrzebną do udostępnienia tego wszystkim.

-- ---------------------------------------------------------------------------
-- 0. Kto należy do drużyny
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER z tego samego powodu co `czy_czlonek_grupy()` w `092`:
-- polityka na `event_team_messages`, która sama odpytuje `event_participants`,
-- działa dobrze, ale robi to przy każdym wierszu. Funkcja `STABLE` liczy się
-- raz na zapytanie.
CREATE OR REPLACE FUNCTION czy_w_druzynie(p_event_id UUID, p_team TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = auth.uid()
      AND ep.team = p_team
      AND ep.pending_approval = false
  );
$$;

GRANT EXECUTE ON FUNCTION czy_w_druzynie(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ustawienie i taktyka drużyny
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_team_setup (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team       TEXT NOT NULL CHECK (team IN ('A', 'B')),
  -- Schemat jako TEKST (`'1-4-4-2'`), nie zestaw kolumn: pozycje wylicza z niego
  -- `pozycjeZeSchematu()` w `lib/taktyka.ts`, więc dodanie nowego ustawienia
  -- nie wymaga ŻADNEJ zmiany w bazie.
  schemat    TEXT,
  -- Cztery decyzje (krycie, wyjście, pressing, tempo) — jsonb, bo to zbiór
  -- wyborów, który będzie rósł, a każdy jako osobna kolumna oznacza migrację
  -- przy każdym nowym pytaniu.
  taktyka    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Nazwiska: kto bije rożne, kto karne. Lista wyboru by tego nie objęła.
  notatka    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, team)
);

ALTER TABLE event_team_setup ENABLE ROW LEVEL SECURITY;

-- Czyta każdy, kto widzi mecz: ustawienie rywala nie jest tajemnicą (i tak
-- widać je na boisku po pierwszej minucie), a ukrywanie go zmusiłoby do
-- osobnej ścieżki dla „mojej" i „ich" drużyny.
DROP POLICY IF EXISTS "team_setup_select" ON event_team_setup;
CREATE POLICY "team_setup_select" ON event_team_setup FOR SELECT
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id));

-- Zmienia organizator, delegat (`can_edit_event` z `089`) albo ktoś Z TEJ
-- drużyny. Ostatni warunek jest celowy: ustawienie to rzecz drużyny, a nie
-- własność organizatora, który często gra w tej drugiej.
DROP POLICY IF EXISTS "team_setup_write" ON event_team_setup;
CREATE POLICY "team_setup_write" ON event_team_setup FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team))
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team));

-- ---------------------------------------------------------------------------
-- 2. Kto na której pozycji
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_team_slots (
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team           TEXT NOT NULL CHECK (team IN ('A', 'B')),
  slot           INTEGER NOT NULL CHECK (slot >= 0 AND slot < 20),
  participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, team, slot)
);

-- Jedna osoba nie może stać na dwóch pozycjach naraz. Bez tego indeksu
-- przypisanie kogoś na drugą pozycję zostawiało go na obu, a widok pokazywał
-- to samo nazwisko dwa razy — wygląda jak błąd renderowania, a jest błędem
-- danych.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_slots_uczestnik
  ON event_team_slots (event_id, participant_id);

ALTER TABLE event_team_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_slots_select" ON event_team_slots;
CREATE POLICY "team_slots_select" ON event_team_slots FOR SELECT
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id));

DROP POLICY IF EXISTS "team_slots_write" ON event_team_slots;
CREATE POLICY "team_slots_write" ON event_team_slots FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team))
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team));

-- ---------------------------------------------------------------------------
-- 3. Czat drużyny
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_team_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team       TEXT NOT NULL CHECK (team IN ('A', 'B')),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name  TEXT NOT NULL,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_event
  ON event_team_messages (event_id, team, created_at);

ALTER TABLE event_team_messages ENABLE ROW LEVEL SECURITY;

-- Czyta WYŁĄCZNIE swoja drużyna (plus organizator/delegat) — na tym polega
-- cała różnica wobec rozmowy meczu, która jest wspólna dla obu stron.
--
-- `deleted_at IS NULL OR auth.uid() = user_id` — od razu, nie po fakcie.
-- Migracja `100` naprawiała dokładnie ten błąd w trzech innych tabelach:
-- kasowanie jest miękkie (UPDATE ustawiający `deleted_at`), a Postgres
-- sprawdza nowy wiersz także politykami SELECT, więc warunek „widać tylko
-- nieskasowane" uniemożliwia autorowi skasowanie własnej wiadomości.
DROP POLICY IF EXISTS "team_messages_select" ON event_team_messages;
CREATE POLICY "team_messages_select" ON event_team_messages FOR SELECT
  USING (
    (czy_w_druzynie(event_id, team) OR can_edit_event(event_id))
    AND (deleted_at IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "team_messages_insert" ON event_team_messages;
CREATE POLICY "team_messages_insert" ON event_team_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (czy_w_druzynie(event_id, team) OR can_edit_event(event_id))
  );

-- Zmienia (czyli kasuje miękko) wyłącznie autor. Organizator nie kasuje cudzych
-- wiadomości w czacie drużyny — do której zwykle nawet nie należy.
DROP POLICY IF EXISTS "team_messages_update" ON event_team_messages;
CREATE POLICY "team_messages_update" ON event_team_messages FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE event_team_setup IS
  'Ustawienie (schemat tekstem, np. 1-4-4-2) i taktyka drużyny. Pozycje wylicza frontend z samego schematu — patrz lib/taktyka.ts (migracja 103).';
COMMENT ON TABLE event_team_messages IS
  'Czat wewnątrz drużyny, osobny od rozmowy meczu (event_comments), która jest wspólna dla obu drużyn (migracja 103).';
