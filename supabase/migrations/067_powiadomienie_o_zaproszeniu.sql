-- 067_powiadomienie_o_zaproszeniu.sql
--
-- Imienne zaproszenie na mecz nie tworzyło powiadomienia. Zaproszony widział je
-- wyłącznie wchodząc na stronę główną Bojo — czyli dokładnie wtedy, gdy i tak
-- by je zobaczył. Dzwonek pokazywał zero, mimo trzech czekających zaproszeń.
--
-- Powiadomienia (`025`) powstały wcześniej niż zaproszenia (`060`) i nikt ich
-- wtedy nie połączył. Ta migracja to naprawia oraz uzupełnia wpisy dla zaproszeń,
-- które już czekają w bazie — inaczej naprawa działałaby dopiero od następnego
-- zaproszenia, a te dzisiejsze zostałyby niewidoczne na zawsze.

CREATE OR REPLACE FUNCTION powiadom_o_zaproszeniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul     TEXT;
  v_data      DATE;
  v_godzina   TIME;
  v_kto       TEXT;
BEGIN
  SELECT coalesce(e.title, e.sport), e.event_date, e.event_time
    INTO v_tytul, v_data, v_godzina
    FROM events e
   WHERE e.id = NEW.event_id;

  SELECT p.display_name INTO v_kto FROM profiles p WHERE p.id = NEW.invited_by;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    NEW.user_id,
    'zaproszenie_na_mecz',
    coalesce(v_kto || ' zaprasza Cię na mecz', 'Zaproszenie na mecz'),
    coalesce(v_tytul, 'Mecz') || ' — ' || to_char(v_data, 'DD.MM')
      || ', godz. ' || to_char(v_godzina, 'HH24:MI') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zaproszeniu ON event_player_invites;
CREATE TRIGGER trg_powiadom_o_zaproszeniu
  AFTER INSERT ON event_player_invites
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zaproszeniu();

-- ---------------------------------------------------------------------------
-- Uzupełnienie zaległych zaproszeń
-- ---------------------------------------------------------------------------
-- Tylko te, które wciąż na coś czekają: nieodrzucone i dotyczące meczu, który
-- się jeszcze nie odbył. Powiadomienie o zaproszeniu na mecz sprzed tygodnia
-- byłoby hałasem, nie informacją.
--
-- `NOT EXISTS` chroni przed powtórką, gdyby migracja poszła drugi raz.
INSERT INTO notifications (user_id, type, title, body, event_id, created_at)
SELECT i.user_id,
       'zaproszenie_na_mecz',
       coalesce(p.display_name || ' zaprasza Cię na mecz', 'Zaproszenie na mecz'),
       coalesce(e.title, e.sport) || ' — ' || to_char(e.event_date, 'DD.MM')
         || ', godz. ' || to_char(e.event_time, 'HH24:MI') || '.',
       i.event_id,
       i.created_at
  FROM event_player_invites i
  JOIN events e ON e.id = i.event_id
  LEFT JOIN profiles p ON p.id = i.invited_by
 WHERE i.dismissed_at IS NULL
   AND e.status = 'active'
   AND (e.event_date + e.event_time)::timestamp > now()
   AND NOT EXISTS (
     SELECT 1 FROM notifications n
      WHERE n.user_id = i.user_id
        AND n.event_id = i.event_id
        AND n.type = 'zaproszenie_na_mecz'
   );
