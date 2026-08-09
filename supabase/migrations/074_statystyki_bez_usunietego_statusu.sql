-- 074_statystyki_bez_usunietego_statusu.sql
--
-- NAPRAWA REGRESJI. Migracja `064` skasowała `event_participants.status` razem
-- ze śledzeniem obecności, ale nie ruszyła funkcji `get_player_stats()`, która
-- tej kolumny używała (`ep.status = 'potwierdzony'`, migracja `055`).
--
-- Skutek na produkcji: funkcja przestała się wykonywać, a strona gracza łapie
-- każdy wyjątek jednym `catch` i pokazuje „Nie znaleziono gracza". Czyli awaria
-- jednej statystyki udawała nieistniejące konto — także własne, wejściem
-- „Moje statystyki" z profilu.
--
-- Pole `attended` znika z wyniku, a nie dostaje zastępczej definicji. Liczyło
-- potwierdzenia obecności, a obecności w Bojo już nie ma; utrzymywanie kolumny
-- zwracającej zawsze zero to obietnica funkcji, której nie ma. Aplikacja nigdzie
-- tej wartości nie pokazywała — mapowanie w `lib/players.ts` było jedynym
-- miejscem, w którym w ogóle występowała.
--
-- Zmiana kształtu wyniku wymaga DROP przed CREATE: `CREATE OR REPLACE` nie
-- pozwala zmienić listy zwracanych kolumn.

DROP FUNCTION IF EXISTS get_player_stats(UUID);

CREATE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  events_joined     INT,
  events_organized  INT,
  matches_played    INT,
  goals_total       INT,
  no_shows          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- Mecze, na które gracz się realnie zapisał. „Obserwuję" (rsvp = 'maybe')
    -- nie zajmuje miejsca, więc nie jest udziałem.
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id
        AND ep.is_guest = false
        AND ep.rsvp <> 'maybe'),

    (SELECT count(*)::int
       FROM events e
      WHERE e.organizer_id = p_user_id),

    -- Rozegrane: w składzie (nie na rezerwie), mecz się odbył i nie został odwołany.
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE ep.user_id    = p_user_id
        AND ep.is_guest   = false
        AND ep.is_reserve = false
        AND ep.rsvp      <> 'maybe'
        AND e.status      != 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

    (SELECT COALESCE(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN event_participants ep ON ep.id = pg.participant_id
      WHERE ep.user_id = p_user_id),

    (SELECT count(*)::int
       FROM player_reports pr
       JOIN event_participants ep ON ep.id = pr.reported_participant_id
      WHERE ep.user_id = p_user_id AND pr.report_type = 'nie_przyszedl')
$$;
