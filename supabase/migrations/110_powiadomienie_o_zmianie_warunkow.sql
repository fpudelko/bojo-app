-- 110: Powiadomienie o zmianie miejsca lub kosztu meczu.
--
-- Jedyne triggery reagujące na edycję meczu to `065` (zmiana daty/godziny)
-- i `070` (odwołanie). Przeniesienie meczu na inne boisko albo zmiana ceny —
-- dwie rzeczy, które organizator faktycznie zmienia w edycji — nie generowały
-- żadnego powiadomienia. Na czacie grupowym taka informacja by padła; Bojo
-- ma być lepsze od czatu, nie gorsze.
--
-- Jeden trigger na oba przypadki (miejsce + koszt), bo `updateEvent()`
-- (`lib/events.ts`) zapisuje ZAWSZE cały wiersz jedną instrukcją UPDATE —
-- rozdzielenie na dwa triggery dawałoby dwa powiadomienia z jednego kliknięcia
-- "Zapisz zmiany", gdy organizator zmienia oba naraz.

CREATE OR REPLACE FUNCTION powiadom_o_zmianie_warunkow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tytul           TEXT;
  v_miejsce_zmiana  BOOLEAN;
  v_cena_zmiana     BOOLEAN;
  v_body            TEXT;
BEGIN
  v_miejsce_zmiana := NEW.field_id IS DISTINCT FROM OLD.field_id
    OR NEW.field_name IS DISTINCT FROM OLD.field_name
    OR NEW.custom_location_name IS DISTINCT FROM OLD.custom_location_name
    OR NEW.custom_address IS DISTINCT FROM OLD.custom_address
    OR NEW.lat IS DISTINCT FROM OLD.lat
    OR NEW.lng IS DISTINCT FROM OLD.lng;
  v_cena_zmiana := NEW.cost_grosz IS DISTINCT FROM OLD.cost_grosz;

  IF NOT v_miejsce_zmiana AND NOT v_cena_zmiana THEN RETURN NEW; END IF;
  IF NEW.status = 'cancelled' OR NEW.event_date < current_date THEN RETURN NEW; END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);
  v_body := coalesce(v_tytul, 'Mecz') || ' — ';
  IF v_miejsce_zmiana AND v_cena_zmiana THEN
    v_body := v_body || 'zmieniło się miejsce i koszt.';
  ELSIF v_miejsce_zmiana THEN
    v_body := v_body || 'zmieniło się miejsce: '
      || coalesce(NEW.field_name, NEW.custom_location_name, 'nowa lokalizacja') || '.';
  ELSE
    v_body := v_body || 'zmienił się koszt: '
      || to_char(NEW.cost_grosz / 100.0, 'FM999990.00') || ' zł od osoby.';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id, 'zmiana_warunkow_meczu', 'Zmiana w meczu', v_body, NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id AND p.user_id IS NOT NULL AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_warunkow ON events;
CREATE TRIGGER trg_powiadom_o_zmianie_warunkow
  AFTER UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_zmianie_warunkow();
