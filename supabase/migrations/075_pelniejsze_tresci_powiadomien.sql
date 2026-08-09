-- Powiadomienia: daty/godziny + odrzucenie prośby
--
-- Powiadomienia `zapis_zaakceptowany` i `prosba_o_dolaczenie` miały treść bez
-- daty/godziny meczu, co zmuszało odbiorce do wejścia do aplikacji, aby znaleźć
-- datę. Dodatkowo brakuje powiadomienia o odrzuceniu prośby.

CREATE OR REPLACE FUNCTION powiadom_o_akceptacji()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF NEW.user_id IS NULL OR OLD.pending_approval IS NOT TRUE OR NEW.pending_approval IS NOT FALSE THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = NEW.event_id;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (NEW.user_id, 'zapis_zaakceptowany', 'Jesteś w składzie',
    'Organizator przyjął Twój zapis na mecz: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    NEW.event_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION powiadom_o_prosbie_o_dolaczenie()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_organizer_id UUID; v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF NEW.pending_approval IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT organizer_id, coalesce(title, sport), event_date, event_time
    INTO v_organizer_id, v_tytul, v_data, v_godz FROM events WHERE id = NEW.event_id;
  IF v_organizer_id IS NULL OR v_organizer_id = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (v_organizer_id, 'prosba_o_dolaczenie', 'Nowa prośba o dołączenie',
    coalesce(NEW.name,'Gracz') || ' chce dołączyć do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    NEW.event_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (OLD.user_id, 'prosba_odrzucona', 'Prośba o dołączenie odrzucona',
    'Organizator nie przyjął Twojej prośby o dołączenie do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    OLD.event_id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_odrzuceniu_prosby ON event_participants;
CREATE TRIGGER trg_powiadom_o_odrzuceniu_prosby
  BEFORE DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_odrzuceniu_prosby();
