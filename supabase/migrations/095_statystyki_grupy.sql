-- 095: Statystyki grupy — to, po co ekipa w ogóle trzyma się razem.
--
-- `get_player_stats()` (`043`/`045`/`055`/`074`) liczy wszystko, czego gracz
-- dotknął w całej aplikacji. Nie ma wymiaru grupy, więc strona ekipy nie
-- potrafi odpowiedzieć na jedyne pytanie, które w ekipie pada: "kto strzela,
-- kto przychodzi, ile już rozegraliśmy".
--
-- Dwie funkcje, nie jedna: nagłówek grupy potrzebuje pięciu liczb i jest
-- publiczny, tabela graczy potrzebuje wiersza na osobę i jest wyłącznie dla
-- członków. Skleić się tego nie da, bo różnią się i kształtem, i dostępem.
--
-- UCZCIWOŚĆ CO DO DANYCH — trzy rzeczy, których ta funkcja NIE udaje:
--
--  * ZWYCIĘSTWA liczą się wyłącznie tam, gdzie mecz miał podział na drużyny
--    (`event_participants.team`, migracja `011`) ORAZ zapisany wynik
--    (`match_results.winner`, migracja `014`). Domyślny `team_mode` to 'brak',
--    więc dla większości meczów `team` jest NULL i zwycięstwa nie ma jak
--    przypisać. Dlatego funkcja zwraca też `matches_with_teams` — mianownik.
--    Bez niego "0 zwycięstw" znaczy naraz "przegrywa wszystko" i "nigdy nie
--    dzieliliśmy drużyn", a to są dwie różne informacje.
--
--  * NIEZAWODNOŚĆ to nie frekwencja. Śledzenie obecności zniknęło z Bojo
--    w migracji `064`, a `074` wyrzuciło `attended` z get_player_stats
--    właśnie dlatego, że kolumna zwracająca zawsze zero jest obietnicą
--    funkcji, której nie ma. `niezawodnosc_pct` = ile procent meczów,
--    na które gracz był zapisany do składu, rozegrał BEZ zgłoszenia
--    "nie przyszedł" (`player_reports`, migracja `091`).
--
--  * GOLE istnieją tylko tam, gdzie ktoś je wpisał. Brak wpisu to brak
--    danych, nie zero.
--
-- SECURITY DEFINER w tabeli graczy, bo `player_reports` czyta wyłącznie
-- organizator i delegat od składu (`091`). Zwykły członek grupy dostałby
-- z SECURITY INVOKER same zera w kolumnie nieobecności i nie miałby jak się
-- dowiedzieć, że to nie zera tylko brak dostępu. Zamiast tego funkcja
-- sprawdza członkostwo sama i odmawia wprost, pierwszą instrukcją.
--
-- DROP przed CREATE — `CREATE OR REPLACE` nie pozwala zmienić listy kolumn
-- zwracanych przez funkcję tabelaryczną (lekcja z `074`).

-- ---------------------------------------------------------------------------
-- 1. Nagłówek grupy — publiczny, pięć liczb
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_group_stats(UUID);

CREATE FUNCTION get_group_stats(p_group_id UUID)
RETURNS TABLE (
  matches_played    INT,
  matches_upcoming  INT,
  goals_total       INT,
  members_count     INT,
  distinct_players  INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- Rozegrane: mecz się odbył i nie został odwołany. Ten sam warunek co
    -- w get_player_stats (`074`), żeby liczby na stronie gracza i na stronie
    -- grupy nie kłóciły się ze sobą.
    (SELECT count(*)::int
       FROM events e
      WHERE e.group_id = p_group_id
        AND e.status <> 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

    (SELECT count(*)::int
       FROM events e
      WHERE e.group_id = p_group_id
        AND e.status <> 'cancelled'
        AND (e.event_date + e.event_time)::timestamp > now()),

    (SELECT coalesce(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN events e ON e.id = pg.event_id
      WHERE e.group_id = p_group_id),

    (SELECT count(*)::int
       FROM group_members gm
      WHERE gm.group_id = p_group_id),

    -- Ilu RÓŻNYCH ludzi z kontem grało w meczach tej grupy. To nie to samo co
    -- members_count: w meczu ekipy gra się też z kimś, kto do grupy nie należy.
    (SELECT count(DISTINCT ep.user_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE e.group_id = p_group_id
        AND ep.is_guest = false
        AND ep.user_id IS NOT NULL
        AND ep.rsvp <> 'maybe')
$$;

GRANT EXECUTE ON FUNCTION get_group_stats(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabela graczy — wyłącznie dla członków
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_group_leaderboard(UUID);

CREATE FUNCTION get_group_leaderboard(p_group_id UUID)
RETURNS TABLE (
  user_id             UUID,
  matches_played      INT,
  goals               INT,
  wins                INT,
  matches_with_teams  INT,
  no_shows            INT,
  niezawodnosc_pct    INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT czy_czlonek_grupy(p_group_id) THEN
    RAISE EXCEPTION 'Statystyki grupy widzą wyłącznie jej członkowie';
  END IF;

  RETURN QUERY
  WITH sklad AS (
    -- Wiersz na (gracz, mecz): był w składzie rozegranego meczu tej grupy.
    -- Rezerwa, obserwujący i prośba czekająca na akceptację nie grają.
    SELECT ep.id AS participant_id, ep.user_id, ep.event_id, ep.team
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
     WHERE e.group_id          = p_group_id
       AND e.status           <> 'cancelled'
       AND (e.event_date + e.event_time)::timestamp <= now()
       AND ep.is_guest         = false
       AND ep.user_id IS NOT NULL
       AND ep.is_reserve       = false
       AND ep.pending_approval = false
       AND ep.rsvp            <> 'maybe'
  )
  SELECT
    s.user_id,
    count(DISTINCT s.event_id)::int,
    coalesce(sum(pg.goals), 0)::int,
    count(*) FILTER (
      WHERE s.team IS NOT NULL AND mr.winner IS NOT NULL AND mr.winner = s.team
    )::int,
    count(*) FILTER (
      WHERE s.team IS NOT NULL AND mr.winner IS NOT NULL
    )::int,
    count(*) FILTER (WHERE pr.id IS NOT NULL)::int,
    CASE
      WHEN count(DISTINCT s.event_id) = 0 THEN 100
      ELSE round(
        100.0 * (count(DISTINCT s.event_id) - count(*) FILTER (WHERE pr.id IS NOT NULL))
        / count(DISTINCT s.event_id)
      )::int
    END
  FROM sklad s
  LEFT JOIN player_goals pg
         ON pg.participant_id = s.participant_id
  LEFT JOIN match_results mr
         ON mr.event_id = s.event_id
  LEFT JOIN player_reports pr
         ON pr.reported_participant_id = s.participant_id
        AND pr.report_type = 'nie_przyszedl'
  GROUP BY s.user_id
  ORDER BY 3 DESC, 2 DESC;   -- gole, potem rozegrane
END;
$$;

GRANT EXECUTE ON FUNCTION get_group_leaderboard(UUID) TO authenticated;
