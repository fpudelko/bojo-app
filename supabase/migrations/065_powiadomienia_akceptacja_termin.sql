-- 065_powiadomienia_akceptacja_termin.sql
--
-- Powiadomienia dla dwóch zdarzeń, o których gracz dotąd nie miał jak się
-- dowiedzieć: organizator zaakceptował jego zapis oraz mecz zmienił termin.
--
-- Dlaczego wyzwalacze, a nie kod aplikacji. Tabela `notifications` ma politykę
-- INSERT tylko dla własnych wierszy — i słusznie, bo inaczej dowolny użytkownik
-- mógłby wpisać komukolwiek cokolwiek do skrzynki. Powiadomienie zawsze pisze
-- się KOMU INNEMU niż ten, kto wywołał akcję: akceptuje organizator, a wpis
-- dostaje gracz. Wyzwalacz z SECURITY DEFINER jest jedynym miejscem, w którym
-- można to zrobić bez otwierania tabeli na oścież. Przy okazji działa niezależnie
-- od tego, którędy zmiana przyszła — z aplikacji, z panelu Supabase czy ze
-- skryptu.
--
-- Kanał: skrzynka w aplikacji, ta sama co alerty o grach (`025`) i oferta
-- zwolnionego miejsca (`062`). E-mail i SMS to osobna decyzja i osobna migracja;
-- struktura wpisu jest już taka, żeby dało się z niej złożyć wiadomość.

-- ---------------------------------------------------------------------------
-- 1. Organizator zaakceptował zapis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_akceptacji()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  -- Tylko przejście „czeka" → „przyjęty". Bez tego warunku każda inna zmiana
  -- w wierszu (drużyna, płatność, przejście na rezerwę) słałaby powiadomienie.
  IF NEW.user_id IS NULL
     OR OLD.pending_approval IS NOT TRUE
     OR NEW.pending_approval IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(title, sport) INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    NEW.user_id,
    'zapis_zaakceptowany',
    'Jesteś w składzie',
    'Organizator przyjął Twój zapis na mecz: ' || coalesce(v_tytul, 'mecz') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_akceptacji ON event_participants;
CREATE TRIGGER trg_powiadom_o_akceptacji
  AFTER UPDATE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_akceptacji();

-- ---------------------------------------------------------------------------
-- 2. Zmiana terminu meczu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zmianie_terminu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.event_time IS NOT DISTINCT FROM OLD.event_time THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  -- Dostają wszyscy związani z meczem, także rezerwowi i obserwujący: zmiana
  -- terminu unieważnia ich plany tak samo jak plany grających. Organizator nie,
  -- bo to on ją wprowadził.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'zmiana_terminu',
         'Zmiana terminu meczu',
         'Nowy termin: ' || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || ' — ' || coalesce(v_tytul, 'mecz') || '.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_terminu ON events;
CREATE TRIGGER trg_powiadom_o_zmianie_terminu
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zmianie_terminu();
