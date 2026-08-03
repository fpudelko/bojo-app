-- 060_event_player_invites.sql
--
-- Imienne zaproszenia na mecz kierowane do użytkowników Bojo.
--
-- Powód: dotąd jedynym sposobem ściągnięcia ekipy był link zaproszenia wklejony
-- na czacie. Kto go przewinął, nie dowiadywał się o meczu. Zaproszenie ma
-- wylądować w aplikacji zapraszanego, a nie w cudzym wątku na Messengerze.
--
-- Dlaczego nowa tabela, a nie wiersz w event_participants: pojemność meczu liczy
-- się po wierszach uczestników (is_reserve = false AND pending_approval = false).
-- Zaproszony NIE zajmuje miejsca. Wrzucenie zaproszeń tam wymagałoby dopisania
-- wyjątku do trzech niezależnych miejsc liczących pojemność (joinEvent, addGuest,
-- confirmFromMaybe) i było prostą drogą do rozjazdu między nimi.
--
-- Dlaczego nie istniejąca tabela event_invites (migracja 036): tamta trzyma
-- zaproszenia po ADRESIE E-MAIL z tokenem, ma email NOT NULL i nie jest przez
-- aplikację używana (lib/invites.ts nie jest nigdzie importowany). Tu chodzi
-- o zaproszenie konta, które już istnieje — inny klucz, inny cykl życia.

CREATE TABLE IF NOT EXISTS event_player_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events     ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  invited_by   UUID          REFERENCES auth.users ON DELETE SET NULL,
  -- Skąd wyszło zaproszenie — pozwala pokazać kontekst „z ekipy Środowa Liga".
  group_id     UUID          REFERENCES groups     ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Zaproszony odrzucił albo schował. Wiersz zostaje, żeby ponowne „zaproś
  -- grupę" nie wskrzeszało zaproszenia, które ktoś świadomie odrzucił.
  dismissed_at TIMESTAMPTZ,

  UNIQUE (event_id, user_id)
);

COMMENT ON TABLE  event_player_invites              IS 'Imienne zaproszenia na mecz. Nie zajmują miejsca w składzie.';
COMMENT ON COLUMN event_player_invites.dismissed_at IS 'Zaproszony odrzucił lub schował zaproszenie. Wiersz zostaje, żeby nie wróciło.';
COMMENT ON COLUMN event_player_invites.group_id     IS 'Grupa, z której poszło zaproszenie — tylko do wyświetlenia kontekstu.';

CREATE INDEX IF NOT EXISTS idx_event_player_invites_user
  ON event_player_invites (user_id) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_player_invites_event
  ON event_player_invites (event_id);

ALTER TABLE event_player_invites ENABLE ROW LEVEL SECURITY;

-- Widzi: zaproszony, organizator meczu, administrator.
DROP POLICY IF EXISTS "Invitee and organizer read invites" ON event_player_invites;
CREATE POLICY "Invitee and organizer read invites" ON event_player_invites FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Zaprasza: organizator, administrator albo ktoś już zapisany na ten mecz.
-- Uczestnik i tak może dziś rozesłać link zaproszenia (JoinCodePanel), więc
-- imienne zaproszenie nie daje mu nowej możliwości, tylko wygodę.
DROP POLICY IF EXISTS "Organizer and participants invite" ON event_player_invites;
CREATE POLICY "Organizer and participants invite" ON event_player_invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_player_invites.event_id
        AND ep.user_id = auth.uid()
        AND ep.pending_approval = false
    )
  );

-- Odrzucenie/schowanie robi wyłącznie zaproszony.
DROP POLICY IF EXISTS "Invitee dismisses own invite" ON event_player_invites;
CREATE POLICY "Invitee dismisses own invite" ON event_player_invites FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Wycofać zaproszenie może organizator, administrator albo sam zaproszony.
DROP POLICY IF EXISTS "Organizer or invitee removes invite" ON event_player_invites;
CREATE POLICY "Organizer or invitee removes invite" ON event_player_invites FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
