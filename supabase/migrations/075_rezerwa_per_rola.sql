-- Rezerwa: limit pola i bramkarzy osobno
--
-- sync_reserve_claim liczyło jedną, wspólną pulę `taken vs max_players` — to samo
-- uproszczenie, które w TypeScripcie (joinEvent i inne) pozwalało zawodnikom z pola
-- wchodzić do składu mimo wyczerpanego limitu pola. Naprawa jest symetryczna: bramkarze
-- i zawodnicy z pola mają teraz OSOBNE pule i osobne kolejki rezerwy, a funkcja może
-- w jednym przebiegu zaproponować miejsce w obu rolach naraz.
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int; v_max_gk int; v_gk_enabled boolean;
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_field_confirmed int; v_gk_confirmed int;
  v_field_offered int; v_gk_offered int;
  v_field_cap int; v_gk_cap int;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT max_players, max_goalkeepers, goalkeepers_enabled, reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_max, v_max_gk, v_gk_enabled, v_hours, v_started, v_title, v_sport
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

  -- Capacity per role
  v_gk_cap := CASE WHEN v_gk_enabled THEN v_max_gk ELSE 0 END;
  v_field_cap := CASE WHEN v_gk_enabled THEN GREATEST(0, v_max - v_max_gk) ELSE v_max END;

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
