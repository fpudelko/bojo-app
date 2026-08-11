-- Tryb miejsc dla bramkarzy: rezerwacja albo sam limit
--
-- DLACZEGO
-- Przy 14 miejscach i 2 bramkarzach zawodnicy z pola walczyli o 12 miejsc
-- (`max_players - max_goalkeepers`), więc trzynasty chętny lądował na rezerwie,
-- podczas gdy dwa miejsca dla bramkarzy stały puste — także wtedy, gdy żaden
-- bramkarz się nie zapisał i już nie miał zamiaru. Liczba wpisana przez
-- organizatora jako „liczba miejsc" nie była liczbą osób, które mogą dołączyć,
-- a nic o tym nie mówiło.
--
-- Rezerwacja bywa jednak dokładnie tym, czego organizator chce: bez niej można
-- skończyć z kompletem zawodników z pola i zerem bramkarzy. Zamiast wybierać
-- za wszystkich, dajemy wybór.
--
-- SEMANTYKA
--   goalkeeper_slots_reserved = true  (dotychczasowe zachowanie)
--     pole:      max_players - max_goalkeepers
--     bramkarze: max_goalkeepers
--     Miejsca bramkarzy czekają, choćby do końca.
--
--   goalkeeper_slots_reserved = false
--     wspólna pula max_players dla wszystkich,
--     bramkarze dodatkowo ograniczeni do max_goalkeepers.
--     Kto pierwszy, ten w składzie; bramkarza może zabraknąć.
--
-- Domyślnie `true`, bo tak działały wszystkie mecze istniejące w chwili tej
-- migracji — zmiana domyślnej wartości przestawiłaby im zasady w trakcie.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS goalkeeper_slots_reserved BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN events.goalkeeper_slots_reserved IS
  'true = miejsca dla bramkarzy są zarezerwowane (pole ma max_players - max_goalkeepers); '
  'false = wspólna pula max_players, bramkarze tylko ograniczeni do max_goalkeepers.';

-- ---------------------------------------------------------------------------
-- sync_reserve_claim respektuje tryb
-- ---------------------------------------------------------------------------
-- Bez tego kolejka rezerwowa liczyłaby pojemność inaczej niż aplikacja przy
-- zapisie: gracz wchodziłby do składu, a funkcja i tak trzymałaby go w kolejce
-- (albo odwrotnie — proponowałaby miejsce, którego nie ma).
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int; v_max_gk int; v_gk_enabled boolean; v_gk_reserved boolean;
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_field_confirmed int; v_gk_confirmed int;
  v_field_offered int; v_gk_offered int;
  v_field_cap int; v_gk_cap int;
  v_zajete int;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT max_players, max_goalkeepers, goalkeepers_enabled, goalkeeper_slots_reserved,
         reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_max, v_max_gk, v_gk_enabled, v_gk_reserved, v_hours, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN RETURN; END IF;

  -- Mark expired claims as passed
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- Count confirmed (non-reserve, not pending, not maybe) per role
  SELECT count(*) FILTER (WHERE NOT is_goalkeeper), count(*) FILTER (WHERE is_goalkeeper)
    INTO v_field_confirmed, v_gk_confirmed
    FROM event_participants
   WHERE event_id = p_event_id AND is_reserve = false AND pending_approval = false AND rsvp <> 'maybe';

  -- Count offered spots (held by active claims) per role
  SELECT count(*) FILTER (WHERE NOT is_goalkeeper), count(*) FILTER (WHERE is_goalkeeper)
    INTO v_field_offered, v_gk_offered
    FROM event_participants
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL;

  v_zajete := v_field_confirmed + v_field_offered + v_gk_confirmed + v_gk_offered;

  -- Pojemność per rola.
  IF NOT v_gk_enabled THEN
    v_gk_cap := 0;
    v_field_cap := v_max;
  ELSIF v_gk_reserved THEN
    v_gk_cap := v_max_gk;
    v_field_cap := GREATEST(0, v_max - v_max_gk);
  ELSE
    -- Wspólna pula: limit dla roli to tyle, ile zostało w całości — a dla
    -- bramkarzy dodatkowo nie więcej, niż mówi ich własny limit. Liczone jako
    -- „ile jeszcze wejdzie" i przeliczane na pułap dla tej roli, żeby dalsza
    -- część funkcji mogła zostać bez zmian.
    v_field_cap := v_field_confirmed + v_field_offered + GREATEST(0, v_max - v_zajete);
    v_gk_cap := v_gk_confirmed + v_gk_offered
                + LEAST(GREATEST(0, v_max - v_zajete), GREATEST(0, v_max_gk - v_gk_confirmed - v_gk_offered));
  END IF;

  -- Field players
  IF v_field_confirmed + v_field_offered < v_field_cap THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
      -- Zajęliśmy miejsce ze wspólnej puli — bramkarz nie może dostać tego samego.
      IF v_gk_enabled AND NOT v_gk_reserved THEN
        v_gk_cap := v_gk_cap - 1;
      END IF;
    END IF;
  END IF;

  -- Goalkeepers — the same pattern, separate queue
  IF v_gk_enabled AND v_gk_confirmed + v_gk_offered < v_gk_cap THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;
