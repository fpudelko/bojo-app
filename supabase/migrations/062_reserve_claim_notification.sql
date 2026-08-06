-- 062: Powiadomienie o ofercie zwolnionego miejsca z rezerwy.
--
-- sync_reserve_claim (058) ustawia claim_offered_at, ale dotąd nikt się o tym
-- nie dowiadywał, dopóki rezerwowy sam nie wszedł na stronę meczu — funkcja
-- jest wołana tylko przy ładowaniu strony, nie ma crona ani pusha. Oferta
-- regularnie przepadała niezauważona, co podważa obietnicę „znajdź
-- brakujących graczy i nie odwołuj gry": rezerwowy nie dostawał sygnału.
--
-- Ta migracja dopisuje wpis do notifications (już używanej przez alerty gry,
-- 025_game_alerts.sql) w tym samym momencie, w którym oferta zostaje
-- ustawiona — bez nowego kanału dostawy, tylko istniejąca skrzynka w appce.
-- Wstawiane jest tylko w gałęzi, w której v_next_id był dotąd NULL (patrz
-- WHERE claim_offered_at IS NULL w zapytaniu niżej), więc jedna oferta =
-- jedno powiadomienie, bez duplikatów przy kolejnych wywołaniach.

CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max          INT;
  v_hours        SMALLINT;
  v_started      BOOLEAN;
  v_title        TEXT;
  v_sport        TEXT;
  v_taken        INT;
  v_active_offer INT;
  v_next_id      UUID;
  v_next_user    UUID;
BEGIN
  SELECT max_players,
         reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport),
         sport
    INTO v_max, v_hours, v_started, v_title, v_sport
    FROM events
   WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN
    RETURN; -- brak wydarzenia albo już się zaczęło/odwołane — nie ruszamy kolejki
  END IF;

  -- 1. Wygasłe oferty: przepuszczone, miejsce wraca do puli.
  UPDATE event_participants
     SET claim_passed = true,
         claim_offered_at = NULL
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- 2. Ile miejsc realnie zajętych (ta sama definicja co w joinEvent).
  SELECT count(*) INTO v_taken
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = false
     AND pending_approval = false
     AND rsvp <> 'maybe';

  SELECT count(*) INTO v_active_offer
    FROM event_participants
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL;

  -- Miejsce pod aktywną ofertą jest zarezerwowane — nie oferujemy go drugi raz.
  IF v_taken + v_active_offer >= v_max THEN
    RETURN;
  END IF;

  -- 3. Zaproponuj miejsce pierwszej osobie w kolejce.
  SELECT id, user_id INTO v_next_id, v_next_user
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = true
     AND claim_passed = false
     AND claim_offered_at IS NULL
     AND pending_approval = false
     AND rsvp <> 'maybe'
     AND user_id IS NOT NULL   -- gość bez konta nie kliknie „Wchodzę"
   ORDER BY created_at
   LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE event_participants
       SET claim_offered_at = now()
     WHERE id = v_next_id;

    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (
      v_next_user,
      'reserve_claim_offered',
      'Zwolniło się miejsce!',
      'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '” (' || v_sport || ').',
      p_event_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;
