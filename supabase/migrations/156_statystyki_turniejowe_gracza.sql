-- ============================================================================
-- 156_statystyki_turniejowe_gracza.sql — sekcja „Turnieje" na profilu gracza.
-- ----------------------------------------------------------------------------
-- DLACZEGO OSOBNA FUNKCJA, A NIE DOPISANIE DO `get_player_stats()`.
--
-- `get_player_stats()` (`043`, naprawiana w `045`/`055`/`074`) liczy
-- `matches_played`, `goals_total` i `no_shows` z MECZÓW. Te liczby mają dziś
-- konsekwencje widoczne dla ludzi: `matchesPlayed` i `noShows` sterują odznaką
-- rzetelnego gracza i paskiem frekwencji na `/gracz/[id]`. Wrzucenie do nich
-- turniejów po cichu zmieniłoby znaczenie liczb, które ktoś już widział —
-- frekwencja spadłaby każdemu, kto zagrał w turnieju, bo turniej nie ma
-- zapisów, rezerwy ani nieobecności.
--
-- Mecz turniejowy jest też po prostu INNĄ RZECZĄ niż gierka: nie zgłaszasz
-- się na niego, tylko jesteś w składzie drużyny, a rozegrałeś go wtedy, gdy
-- rozegrała go drużyna.
--
-- ŚCIANA LOGOWANIA EGZEKWUJE SIĘ SAMA. Funkcja jest `SECURITY INVOKER`, więc
-- czyta `turniej_zawodnicy` i `turniej_zdarzenia` prawami wołającego — a te
-- tabele od migracji `145` wymagają `auth.uid() IS NOT NULL`. Niezalogowany
-- dostanie zera, czyli dokładnie to, co dostaje wszędzie indziej w module.
-- `SECURITY DEFINER` obszedłby tu politykę, którą cały moduł stoi.
--
-- MIEJSCE W TURNIEJU LICZYMY, NIE ZAPISUJEMY. Kusi kolumna
-- `turniej_druzyny.miejsce` — i byłaby drugą prawdą o tym, kto wygrał, która
-- rozjedzie się z tabelą przy pierwszej korekcie wyniku (`wynik_recznie`
-- istnieje właśnie dlatego). Zwracamy wyłącznie `wygrany` — „ta drużyna jest
-- zwycięzcą finału tego turnieju" — czyli JEDEN fakt z jednego wiersza,
-- ten sam, którym `podiumTurnieju()` (`lib/turniejPodium.ts`) wyznacza
-- pierwsze miejsce. Drugiego i trzeciego miejsca celowo tu nie ma: ich reguła
-- (mecz o 3. miejsce, a gdy go nie było — brak trzeciego) żyje w jednym
-- miejscu, w przeglądarce.
--
-- Migracja jest idempotentna.
-- ============================================================================

DROP FUNCTION IF EXISTS get_player_turniej_stats(uuid);

CREATE FUNCTION get_player_turniej_stats(p_user_id uuid)
RETURNS TABLE (
  turniejow     int,
  meczow        int,
  goli          int,
  asyst         int,
  mvp           int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH moje AS (
    SELECT z.id, z.turniej_id, z.druzyna_id
      FROM turniej_zawodnicy z
     WHERE z.user_id = p_user_id
  )
  SELECT
    (SELECT count(DISTINCT turniej_id)::int FROM moje),

    -- Rozegrane: mecze MOJEJ drużyny, które się odbyły. Walkower też się
    -- odbył — z punktu widzenia tabeli i klasyfikacji jest meczem.
    (SELECT count(*)::int
       FROM turniej_mecze m
      WHERE m.status IN ('zakonczony','walkower')
        AND EXISTS (SELECT 1 FROM moje
                     WHERE moje.druzyna_id IN (m.druzyna_a_id, m.druzyna_b_id))),

    -- Gole: `wartosc`, nie liczba wierszy — koszykarska trójka to trzy punkty
    -- (ta sama reguła co `przelicz_wynik_meczu()` w `147`). Samobójczy NIE
    -- liczy się strzelcowi jako gol.
    (SELECT COALESCE(sum(zd.wartosc), 0)::int
       FROM turniej_zdarzenia zd
      WHERE zd.typ IN ('gol','punkty')
        AND zd.zawodnik_id IN (SELECT id FROM moje)),

    (SELECT count(*)::int
       FROM turniej_zdarzenia zd
      WHERE zd.asysta_zawodnik_id IN (SELECT id FROM moje)),

    (SELECT count(*)::int
       FROM turniej_mecze m
      WHERE m.mvp_zawodnik_id IN (SELECT id FROM moje))
$$;

GRANT EXECUTE ON FUNCTION get_player_turniej_stats(uuid) TO anon, authenticated;

-- ── Lista turniejów gracza — do sekcji „Turnieje" na profilu ────────────────

DROP FUNCTION IF EXISTS get_player_turnieje(uuid, int);

CREATE FUNCTION get_player_turnieje(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS TABLE (
  turniej_id   uuid,
  nazwa        text,
  sport        text,
  data_startu  date,
  druzyna      text,
  wygrany      boolean,
  meczow       int,
  goli         int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH moje AS (
    SELECT z.id AS zawodnik_id, z.turniej_id, z.druzyna_id
      FROM turniej_zawodnicy z
     WHERE z.user_id = p_user_id
  )
  SELECT
    t.id,
    t.nazwa,
    t.sport,
    t.data_startu,
    d.nazwa,
    -- Jeden fakt z jednego wiersza: czy moja drużyna wygrała finał tego
    -- turnieju. Reszta podium liczy się w przeglądarce — patrz nagłówek.
    EXISTS (
      SELECT 1 FROM turniej_mecze f
       WHERE f.turniej_id = t.id
         AND f.faza = 'final'
         AND f.status IN ('zakonczony','walkower')
         AND f.zwyciezca_id = m.druzyna_id
    ),
    (SELECT count(*)::int FROM turniej_mecze mm
      WHERE mm.status IN ('zakonczony','walkower')
        AND m.druzyna_id IN (mm.druzyna_a_id, mm.druzyna_b_id)),
    (SELECT COALESCE(sum(zd.wartosc), 0)::int FROM turniej_zdarzenia zd
      WHERE zd.typ IN ('gol','punkty') AND zd.zawodnik_id = m.zawodnik_id)
    FROM moje m
    JOIN turnieje t        ON t.id = m.turniej_id
    JOIN turniej_druzyny d ON d.id = m.druzyna_id
   WHERE t.status <> 'odwolany'
   ORDER BY t.data_startu DESC
   LIMIT GREATEST(1, COALESCE(p_limit, 5))
$$;

GRANT EXECUTE ON FUNCTION get_player_turnieje(uuid, int) TO anon, authenticated;
