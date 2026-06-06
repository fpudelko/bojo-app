-- ============================================================================
-- 029_tournaments.sql — BOJO Community Cup
-- ----------------------------------------------------------------------------
-- Amatorski turniej drużynowy (Poznań, orliki) sterowany w aplikacji:
--   • format: faza grupowa (grupy po 3, awansuje 2) → pucharowa drabinka
--   • skalowalny: 16 / 32 / 48 / 64 drużyn (group_size, advance_per_group)
--   • drużyny umawiają mecze same w obrębie tygodnia (propozycja → akceptacja)
--   • orliki partnerskie proponują wolne sloty do rezerwacji na poczet turnieju
--   • skład z pozycjami (bramkarz / obrońca / pomocnik / napastnik)
-- ============================================================================

-- ── 1. Turniej (jeden wiersz = jedna edycja) ────────────────────────────────
CREATE TABLE tournaments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,                 -- np. 'community-cup-2026'
  name                text NOT NULL,
  sport               text NOT NULL DEFAULT 'piłka nożna',
  city                text NOT NULL DEFAULT 'Poznań',
  -- Stan rozgrywek — steruje tym, co widać na landingu i co można robić.
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','registration','group_stage',
                                          'knockout','finals','completed')),
  -- Konfiguracja formatu (skalowalna — nic nie jest zahardkodowane na 64).
  format              text NOT NULL DEFAULT 'group_knockout',
  max_teams           int  NOT NULL DEFAULT 32 CHECK (max_teams BETWEEN 4 AND 128),
  group_size          int  NOT NULL DEFAULT 3  CHECK (group_size BETWEEN 3 AND 8),
  advance_per_group   int  NOT NULL DEFAULT 2  CHECK (advance_per_group BETWEEN 1 AND 4),
  -- Zasady składu.
  min_squad           int  NOT NULL DEFAULT 5  CHECK (min_squad BETWEEN 1 AND 20),
  max_squad           int  NOT NULL DEFAULT 10 CHECK (max_squad BETWEEN 1 AND 30),
  -- Terminy.
  registration_deadline timestamptz,
  start_date            date,
  finals_date           date,
  finals_venue          text,
  -- Treść landingu.
  tagline             text,
  prize_pool          text,
  rules               text,
  entry_fee_grosze    int  NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
-- Każdy (także niezalogowany) czyta — landing jest publiczny.
CREATE POLICY "tournaments_read" ON tournaments FOR SELECT USING (true);
-- Tylko admin zarządza edycją.
CREATE POLICY "tournaments_admin_write" ON tournaments FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 2. Grupy fazy grupowej ──────────────────────────────────────────────────
CREATE TABLE tournament_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          text NOT NULL,                 -- 'A', 'B', 'C', …
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_read" ON tournament_groups FOR SELECT USING (true);
CREATE POLICY "groups_admin_write" ON tournament_groups FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 3. Drużyny ──────────────────────────────────────────────────────────────
CREATE TABLE tournament_teams (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id     uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  district          text,                       -- dzielnica Poznania
  -- Kapitan zarządza drużyną. Musi być zalogowany.
  captain_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  captain_name      text NOT NULL,
  captain_phone     text,
  captain_email     text,
  -- Cykl życia zgłoszenia.
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','rejected',
                                        'eliminated','withdrawn')),
  paid_at           timestamptz,
  -- Rozstawienie i przydział do grupy (ustawiane przy losowaniu).
  group_id          uuid REFERENCES tournament_groups(id) ON DELETE SET NULL,
  seed              int,
  -- Dostępność tygodniowa — używana do parowania meczów „ten sam dzień”.
  availability_days int[] NOT NULL DEFAULT '{}',  -- 1=Pon…7=Niedz (ISO)
  availability_from time,
  availability_to   time,
  finals_confirmed  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_teams_group      ON tournament_teams(group_id);
CREATE INDEX idx_teams_captain    ON tournament_teams(captain_id);

ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
-- Lista drużyn jest publiczna (landing pokazuje zarejestrowane ekipy).
CREATE POLICY "teams_read" ON tournament_teams FOR SELECT USING (true);
-- Zalogowany rejestruje drużynę jako jej kapitan.
CREATE POLICY "teams_insert" ON tournament_teams FOR INSERT
  WITH CHECK (auth.uid() = captain_id);
-- Kapitan edytuje swoją drużynę; admin każdą.
CREATE POLICY "teams_update" ON tournament_teams FOR UPDATE
  USING (
    auth.uid() = captain_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  )
  WITH CHECK (
    auth.uid() = captain_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );
-- Kapitan może wycofać drużynę przed startem; admin zawsze.
CREATE POLICY "teams_delete" ON tournament_teams FOR DELETE
  USING (
    auth.uid() = captain_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );


-- ── 4. Skład z pozycjami ────────────────────────────────────────────────────
CREATE TABLE tournament_team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users ON DELETE SET NULL,  -- opcjonalnie powiązany z kontem
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  position      text NOT NULL DEFAULT 'uniwersalny'
                  CHECK (position IN ('bramkarz','obrońca','pomocnik',
                                      'napastnik','uniwersalny')),
  shirt_number  int CHECK (shirt_number BETWEEN 1 AND 99),
  is_captain    boolean NOT NULL DEFAULT false,
  is_reserve    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_team ON tournament_team_members(team_id);

ALTER TABLE tournament_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read" ON tournament_team_members FOR SELECT USING (true);
-- Skład edytuje wyłącznie kapitan drużyny (lub admin).
CREATE POLICY "members_write" ON tournament_team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.id = team_id
        AND (t.captain_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.id = team_id
        AND (t.captain_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
    )
  );


-- ── 5. Orliki partnerskie + proponowane sloty ───────────────────────────────
CREATE TABLE tournament_venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  field_id      uuid REFERENCES fields(id) ON DELETE SET NULL,  -- link do bazy boisk
  name          text NOT NULL,
  address       text,
  district      text,
  is_partner    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tournament_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_read" ON tournament_venues FOR SELECT USING (true);
CREATE POLICY "venues_admin_write" ON tournament_venues FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));

CREATE TABLE tournament_venue_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES tournament_venues(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 30 AND 240),
  status       text NOT NULL DEFAULT 'free'
                 CHECK (status IN ('free','reserved','taken')),
  match_id     uuid,                 -- FK ustawiany po utworzeniu meczów (poniżej)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slots_venue ON tournament_venue_slots(venue_id);

ALTER TABLE tournament_venue_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots_read" ON tournament_venue_slots FOR SELECT USING (true);
-- Kapitan może zarezerwować wolny slot (status free→reserved); admin wszystko.
CREATE POLICY "slots_update" ON tournament_venue_slots FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "slots_admin_write" ON tournament_venue_slots FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 6. Mecze (faza grupowa + pucharowa) ─────────────────────────────────────
CREATE TABLE tournament_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id     uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage             text NOT NULL DEFAULT 'group'
                      CHECK (stage IN ('group','round_of_32','round_of_16',
                                       'quarter','semi','third_place','final')),
  group_id          uuid REFERENCES tournament_groups(id) ON DELETE CASCADE,
  round             int,             -- numer rundy/kolejki w obrębie etapu
  bracket_position  int,             -- pozycja w drabince (do rysowania)
  -- Drużyny — NULL gdy jeszcze nieznane (np. „zwycięzca ćwierćfinału 1”).
  team_a_id         uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team_b_id         uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  -- W drabince: z którego meczu „spływa” zwycięzca do tego slotu.
  feeds_a_match_id  uuid REFERENCES tournament_matches(id) ON DELETE SET NULL,
  feeds_b_match_id  uuid REFERENCES tournament_matches(id) ON DELETE SET NULL,
  -- Umawianie terminu (drużyny robią to same).
  proposed_by_team_id uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  proposed_slot     timestamptz,
  venue_slot_id     uuid REFERENCES tournament_venue_slots(id) ON DELETE SET NULL,
  venue_text        text,
  scheduled_at      timestamptz,
  -- Stan i wynik.
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','proposed','scheduled',
                                        'played','walkover','disputed')),
  score_a           int,
  score_b           int,
  winner_team_id    uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  reported_by_team_id  uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  confirmed_by_team_id uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  dispute_note      text,
  proof_url         text,
  deadline          timestamptz,     -- do kiedy trzeba rozegrać (walkower po terminie)
  played_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_matches_group      ON tournament_matches(group_id);
CREATE INDEX idx_matches_team_a     ON tournament_matches(team_a_id);
CREATE INDEX idx_matches_team_b     ON tournament_matches(team_b_id);

-- domknij FK slot→match (utworzony wcześniej bez referencji)
ALTER TABLE tournament_venue_slots
  ADD CONSTRAINT fk_slot_match
  FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL;

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_read" ON tournament_matches FOR SELECT USING (true);
-- Kapitan jednej z grających drużyn umawia/zgłasza; admin zawsze.
CREATE POLICY "matches_update" ON tournament_matches FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
    OR EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.captain_id = auth.uid() AND t.id IN (team_a_id, team_b_id)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
    OR EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.captain_id = auth.uid() AND t.id IN (team_a_id, team_b_id)
    )
  );
CREATE POLICY "matches_admin_write" ON tournament_matches FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 7. Tabela grupowa (widok liczony z meczów) ──────────────────────────────
-- 3 pkt za zwycięstwo, 1 za remis. Walkower liczony jak rozegrany mecz.
CREATE OR REPLACE VIEW tournament_standings AS
WITH played AS (
  SELECT id, group_id, team_a_id AS team_id, score_a AS gf, score_b AS ga
  FROM tournament_matches
  WHERE stage = 'group' AND status IN ('played','walkover')
    AND group_id IS NOT NULL AND team_a_id IS NOT NULL
  UNION ALL
  SELECT id, group_id, team_b_id AS team_id, score_b AS gf, score_a AS ga
  FROM tournament_matches
  WHERE stage = 'group' AND status IN ('played','walkover')
    AND group_id IS NOT NULL AND team_b_id IS NOT NULL
)
SELECT
  t.id                                    AS team_id,
  t.tournament_id,
  t.group_id,
  t.name                                  AS team_name,
  COUNT(p.id)                             AS played,
  COUNT(*) FILTER (WHERE p.gf >  p.ga)    AS won,
  COUNT(*) FILTER (WHERE p.gf =  p.ga)    AS drawn,
  COUNT(*) FILTER (WHERE p.gf <  p.ga)    AS lost,
  COALESCE(SUM(p.gf), 0)                  AS goals_for,
  COALESCE(SUM(p.ga), 0)                  AS goals_against,
  COALESCE(SUM(p.gf), 0) - COALESCE(SUM(p.ga), 0) AS goal_diff,
  COUNT(*) FILTER (WHERE p.gf >  p.ga) * 3
    + COUNT(*) FILTER (WHERE p.gf = p.ga) AS points
FROM tournament_teams t
LEFT JOIN played p ON p.team_id = t.id
WHERE t.group_id IS NOT NULL
GROUP BY t.id, t.tournament_id, t.group_id, t.name;


-- ── 8. Parowanie meczów po wspólnym dniu dostępności ────────────────────────
-- Zwraca dni tygodnia (ISO) wspólne dla obu drużyn — frontend proponuje je
-- jako pierwsze przy umawianiu meczu.
CREATE OR REPLACE FUNCTION shared_availability_days(p_team_a uuid, p_team_b uuid)
RETURNS int[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT UNNEST(a.availability_days)
      INTERSECT
      SELECT UNNEST(b.availability_days)
      ORDER BY 1
    ), '{}'::int[]
  )
  FROM tournament_teams a, tournament_teams b
  WHERE a.id = p_team_a AND b.id = p_team_b
$$;


-- ── 9. Licznik wolnych miejsc (na landing) ──────────────────────────────────
CREATE OR REPLACE FUNCTION tournament_team_count(p_tournament uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::int FROM tournament_teams
  WHERE tournament_id = p_tournament AND status <> 'withdrawn'
$$;


-- ── 10. Seed: pierwsza edycja (otwórz rejestrację, edytowalne w adminie) ─────
INSERT INTO tournaments (
  slug, name, sport, city, status, max_teams, group_size, advance_per_group,
  min_squad, max_squad, tagline, prize_pool,
  registration_deadline, start_date
) VALUES (
  'community-cup-2026',
  'BOJO Community Cup',
  'piłka nożna',
  'Poznań',
  'registration',
  32, 3, 2,
  5, 10,
  'Pierwszy amatorski puchar Poznania. Zbierz ekipę, wejdź do gry.',
  'Puchar, nagrody dla podium oraz tytuły MVP i króla strzelców.',
  now() + interval '21 days',
  (now() + interval '28 days')::date
)
ON CONFLICT (slug) DO NOTHING;
