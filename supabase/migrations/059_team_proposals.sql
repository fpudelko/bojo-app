-- 059: Propozycje składów od uczestników.
--
-- Dotąd składy ustalał wyłącznie organizator. Teraz każdy uczestnik może
-- zaproponować własny podział, reszta go popiera (👍), a organizator jednym
-- kliknięciem przenosi wybraną propozycję na realne drużyny.
--
-- Rozdział ról jest tu istotny: propozycja NIE zmienia niczego w składzie.
-- Dopóki organizator jej nie zatwierdzi, `event_participants.team` pozostaje
-- nietknięte — propozycja to osobny byt, nie „szkic" prawdziwych drużyn.

CREATE TABLE IF NOT EXISTS team_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'accepted' ustawia organizator przy zatwierdzeniu; historia zostaje.
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted'))
);

-- Jedna aktywna propozycja na osobę i mecz — inaczej ktoś zasypie listę.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_one_per_author
  ON team_proposals (event_id, proposed_by);

CREATE INDEX IF NOT EXISTS idx_proposals_event ON team_proposals (event_id);

-- Przypisania w ramach propozycji. Osobno od event_participants.team.
CREATE TABLE IF NOT EXISTS team_proposal_picks (
  proposal_id    UUID NOT NULL REFERENCES team_proposals(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  team           TEXT NOT NULL CHECK (team IN ('A', 'B')),
  PRIMARY KEY (proposal_id, participant_id)
);

-- Poparcia. Jeden głos na osobę.
CREATE TABLE IF NOT EXISTS team_proposal_votes (
  proposal_id UUID NOT NULL REFERENCES team_proposals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
);

ALTER TABLE team_proposals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_proposal_picks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_proposal_votes  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS. Czytać może każdy, kto widzi mecz (spójnie z resztą — mecze prywatne
-- chroni nieodgadywalny link, nie polityka). Pisać — tylko uczestnicy.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Proposals readable" ON team_proposals;
CREATE POLICY "Proposals readable" ON team_proposals FOR SELECT USING (true);

-- Zaproponować może tylko ktoś, kto realnie gra w tym meczu.
DROP POLICY IF EXISTS "Participant proposes" ON team_proposals;
CREATE POLICY "Participant proposes" ON team_proposals FOR INSERT
  WITH CHECK (
    auth.uid() = proposed_by
    AND EXISTS (
      SELECT 1 FROM event_participants ep
       WHERE ep.event_id = team_proposals.event_id
         AND ep.user_id = auth.uid()
         AND ep.pending_approval = false
    )
  );

-- Autor może swoją propozycję usunąć; organizator — każdą (moderacja).
DROP POLICY IF EXISTS "Author or organizer deletes proposal" ON team_proposals;
CREATE POLICY "Author or organizer deletes proposal" ON team_proposals FOR DELETE
  USING (
    auth.uid() = proposed_by
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
  );

-- Zatwierdzenie (status → 'accepted') to decyzja wyłącznie organizatora.
DROP POLICY IF EXISTS "Organizer accepts proposal" ON team_proposals;
CREATE POLICY "Organizer accepts proposal" ON team_proposals FOR UPDATE
  USING     (auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id))
  WITH CHECK(auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id));

DROP POLICY IF EXISTS "Picks readable" ON team_proposal_picks;
CREATE POLICY "Picks readable" ON team_proposal_picks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Author writes picks" ON team_proposal_picks;
CREATE POLICY "Author writes picks" ON team_proposal_picks FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT proposed_by FROM team_proposals WHERE id = proposal_id)
  );

DROP POLICY IF EXISTS "Votes readable" ON team_proposal_votes;
CREATE POLICY "Votes readable" ON team_proposal_votes FOR SELECT USING (true);

-- Głosować może uczestnik meczu, w swoim imieniu.
DROP POLICY IF EXISTS "Participant votes" ON team_proposal_votes;
CREATE POLICY "Participant votes" ON team_proposal_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM team_proposals tp
        JOIN event_participants ep ON ep.event_id = tp.event_id
       WHERE tp.id = proposal_id
         AND ep.user_id = auth.uid()
         AND ep.pending_approval = false
    )
  );

DROP POLICY IF EXISTS "Own vote removable" ON team_proposal_votes;
CREATE POLICY "Own vote removable" ON team_proposal_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- accept_team_proposal — przenosi propozycję na realne drużyny.
--
-- SECURITY DEFINER, bo musi zapisać `team` na cudzych wierszach uczestników,
-- a polityki pozwalają na to tylko organizatorowi. Sprawdzenie uprawnień jest
-- w środku: kto nie jest organizatorem, dostaje wyjątek.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_team_proposal(p_proposal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM team_proposals WHERE id = p_proposal_id;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Propozycja nie istnieje';
  END IF;

  IF auth.uid() <> (SELECT organizer_id FROM events WHERE id = v_event_id) THEN
    RAISE EXCEPTION 'Tylko organizator może zatwierdzić składy';
  END IF;

  -- Czyścimy poprzedni podział, żeby zatwierdzona propozycja była pełnym
  -- obrazem, a nie nakładką na stare przypisania.
  UPDATE event_participants SET team = NULL WHERE event_id = v_event_id;

  UPDATE event_participants ep
     SET team = pick.team
    FROM team_proposal_picks pick
   WHERE pick.proposal_id = p_proposal_id
     AND pick.participant_id = ep.id;

  UPDATE team_proposals SET status = 'accepted' WHERE id = p_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_team_proposal(UUID) TO authenticated;
