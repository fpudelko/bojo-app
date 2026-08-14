-- 090: Rozszerzenie istniejących polityk RLS o delegatów z migracji 089.
--
-- `events` UPDATE dostaje can_edit_event() — pełna edycja, włącznie z
-- odwołaniem meczu (UPDATE status='cancelled'). Fizyczne USUNIĘCIE (DELETE)
-- zostaje bez zmian: tylko prawdziwy organizator/admin.
--
-- `event_participants` UPDATE/INSERT/DELETE dostają can_manage_squad() —
-- świadomy kompromis: RLS w Postgresie jest na poziomie wiersza, nie kolumny,
-- więc UPDATE tej tabeli pokrywa zarówno pola składowe (is_reserve, team,
-- pending_approval) jak i has_paid. Rozdzielenie tego czysto między
-- can_manage_squad a can_manage_payments wymagałoby przepisania wszystkich
-- zapisów na dedykowane RPC — nieproporcjonalny refaktor względem ryzyka (to
-- wciąż tylko wiersz uczestnictwa W TYM meczu, nie cała tabela events).
-- Polityka dostaje więc OBA warunki, a precyzyjny podział "kto klika co"
-- pilnuje UI — dokładnie jak dziś robi to MatchResultForm z parametrem
-- organizerId, świadomie nieużywanym poza samym gate'em w komponencie.
--
-- Płatności na `events` (accepted_payment_methods, blik_phone) NIE dostają
-- rozszerzenia ogólnej polityki UPDATE — ta tabela ma ~30 kolumn niezwiązanych
-- z płatnościami, więc delegat od płatności dostałby możliwość zmiany
-- dowolnego pola wydarzenia. Zamiast tego: dedykowana funkcja RPC
-- event_set_payment_settings(), która modyfikuje WYŁĄCZNIE te dwie kolumny.

-- ---- events: pełna edycja + odwołanie ----
DROP POLICY IF EXISTS "Organizer updates own events" ON events;
CREATE POLICY "Organizer or edit-delegate updates events"
  ON events FOR UPDATE
  USING (auth.uid() = organizer_id OR can_edit_event(id))
  WITH CHECK (auth.uid() = organizer_id OR can_edit_event(id));

-- ---- event_participants: skład + płatności (patrz uzasadnienie wyżej) ----
DROP POLICY IF EXISTS "Organizer updates participants" ON event_participants;
DROP POLICY IF EXISTS "Organiser updates participant" ON event_participants;
CREATE POLICY "Organizer or delegate updates participants"
  ON event_participants FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  );

DROP POLICY IF EXISTS "Join or organiser adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest"
  ON event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );

DROP POLICY IF EXISTS "Leave or organiser removes" ON event_participants;
CREATE POLICY "Leave or organiser or delegate removes"
  ON event_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );

-- ---- team_proposals: zatwierdzanie i moderacja ----
DROP POLICY IF EXISTS "Author or organizer deletes proposal" ON team_proposals;
CREATE POLICY "Author or organizer or delegate deletes proposal" ON team_proposals FOR DELETE
  USING (
    auth.uid() = proposed_by
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
    OR can_manage_squad(team_proposals.event_id)
  );

DROP POLICY IF EXISTS "Organizer accepts proposal" ON team_proposals;
CREATE POLICY "Organizer or delegate accepts proposal" ON team_proposals FOR UPDATE
  USING     (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
    OR can_manage_squad(team_proposals.event_id)
  )
  WITH CHECK(
    auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
    OR can_manage_squad(team_proposals.event_id)
  );

-- accept_team_proposal() pisze na cudzych wierszach event_participants (stąd
-- SECURITY DEFINER) — sprawdzenie uprawnień jest wewnątrz funkcji, nie w RLS.
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

  IF auth.uid() <> (SELECT organizer_id FROM events WHERE id = v_event_id)
     AND NOT can_manage_squad(v_event_id) THEN
    RAISE EXCEPTION 'Tylko organizator może zatwierdzić składy';
  END IF;

  UPDATE event_participants SET team = NULL WHERE event_id = v_event_id;

  UPDATE event_participants ep
     SET team = pick.team
    FROM team_proposal_picks pick
   WHERE pick.proposal_id = p_proposal_id
     AND pick.participant_id = ep.id;

  UPDATE team_proposals SET status = 'accepted' WHERE id = p_proposal_id;
END;
$$;

-- set_event_teams_published() był SECURITY INVOKER z warunkiem organizer_id
-- wpisanym wprost w WHERE — zamiana na SECURITY DEFINER + can_manage_squad(),
-- bo ogólna polityka UPDATE na `events` (wyżej) celowo NIE obejmuje
-- can_manage_squad (żeby delegat od składów nie mógł zmieniać dowolnych pól
-- wydarzenia) — bez tej zmiany delegat od składów przechodziłby RLS, ale
-- funkcja i tak filtrowałaby jego update do zera wierszy.
CREATE OR REPLACE FUNCTION set_event_teams_published(
  p_event_id  UUID,
  p_published BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_manage_squad(p_event_id) THEN
    RAISE EXCEPTION 'Brak uprawnień do publikowania składów tego wydarzenia';
  END IF;
  UPDATE events SET teams_published = p_published WHERE id = p_event_id;
END;
$$;

-- ---- match_results, player_goals: wynik meczu ----
DROP POLICY IF EXISTS "Organizer manages match results" ON match_results;
CREATE POLICY "Organizer or delegate manages match results"
  ON match_results FOR ALL
  USING  (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

DROP POLICY IF EXISTS "Organizer manages player goals" ON player_goals;
CREATE POLICY "Organizer or delegate manages player goals"
  ON player_goals FOR ALL
  USING  (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

-- ---- event_player_invites: zapraszanie graczy do meczu ----
DROP POLICY IF EXISTS "Invitee and organizer read invites" ON event_player_invites;
CREATE POLICY "Invitee, organizer, delegate and admin read invites" ON event_player_invites FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_squad(event_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "Organizer and participants invite" ON event_player_invites;
CREATE POLICY "Organizer, delegate, admin or participant invite" ON event_player_invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_squad(event_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_player_invites.event_id
        AND ep.user_id = auth.uid()
        AND ep.pending_approval = false
    )
  );

DROP POLICY IF EXISTS "Organizer or invitee removes invite" ON event_player_invites;
CREATE POLICY "Organizer, delegate, invitee or admin removes invite" ON event_player_invites FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_squad(event_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ---- Płatności: RPC dedykowana, nie rozszerzenie ogólnej polityki `events` ----
CREATE OR REPLACE FUNCTION event_set_payment_settings(
  p_event_id UUID,
  p_accepted_payment_methods TEXT[],
  p_blik_phone TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_manage_payments(p_event_id) THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany ustawień płatności tego wydarzenia';
  END IF;
  UPDATE events
    SET accepted_payment_methods = p_accepted_payment_methods,
        blik_phone = p_blik_phone
    WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION event_set_payment_settings(UUID, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_event_teams_published(UUID, BOOLEAN) TO authenticated;
