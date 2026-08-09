-- 072_brakujace_powiadomienia.sql
--
-- Dwie luki potwierdzone czytaniem kodu, nie tylko zgłoszeniem: zdarzenia,
-- o których zainteresowany dotąd nie miał jak się dowiedzieć bez wejścia na
-- stronę meczu/grupy na chybił trafił.
--
-- 1. ORGANIZATOR NIE WIDZIAŁ, ŻE KTOŚ CZEKA NA AKCEPTACJĘ. Włączenie
--    "Wymagaj akceptacji" (`events.require_approval`) sprawia, że zapis
--    (`event_participants.pending_approval = true`) nie wchodzi do składu
--    automatycznie — ale nic nie mówiło organizatorowi, że w ogóle ktoś
--    czeka. Jedyny sposób, żeby się dowiedzieć: wejść na stronę meczu i
--    sprawdzić panel "Prośby o dołączenie".
--
-- 2. CZŁONKOWIE GRUPY NIE WIDZIELI NOWEGO MECZU W GRUPIE. Dodanie meczu do
--    grupy (`events.group_id`) nie powiadamiało nikogo poza samym faktem,
--    że mecz pojawi się na stronie grupy — trzeba było na nią wejść, żeby
--    się dowiedzieć.
--
-- Wyzwalacze, nie kod aplikacji — ten sam powód co w migracjach `065`/`070`:
-- `notifications` nie ma polityki INSERT dla użytkownika, bo powiadomienie
-- zawsze pisze się KOMU INNEMU niż ten, kto wywołał akcję. Funkcja
-- `SECURITY DEFINER` jest jedynym miejscem, w którym da się to zrobić bez
-- otwierania tabeli na oścież.
--
-- Kanał: skrzynka w aplikacji (dzwonek), ta sama co `025`, `062`, `065`, `067`, `070`.

-- ---------------------------------------------------------------------------
-- 1. Organizator: ktoś prosi o dołączenie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_prosbie_o_dolaczenie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
  v_tytul        TEXT;
BEGIN
  IF NEW.pending_approval IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT organizer_id, coalesce(title, sport)
    INTO v_organizer_id, v_tytul
    FROM events
   WHERE id = NEW.event_id;

  -- Organizator prosi sam siebie o dołączenie? Nie zdarza się w praktyce
  -- (własny zapis organizatora nigdy nie ma pending_approval), ale strzeżemy
  -- się dubla ze zdrowym rozsądkiem, jak w `065`/`070`.
  IF v_organizer_id IS NULL OR v_organizer_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    v_organizer_id,
    'prosba_o_dolaczenie',
    'Nowa prośba o dołączenie',
    coalesce(NEW.name, 'Gracz') || ' chce dołączyć do meczu: ' || coalesce(v_tytul, 'mecz') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_prosbie_o_dolaczenie ON event_participants;
CREATE TRIGGER trg_powiadom_o_prosbie_o_dolaczenie
  AFTER INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_prosbie_o_dolaczenie();

-- ---------------------------------------------------------------------------
-- 2. Członkowie grupy: nowy mecz w grupie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         'Nowy mecz w grupie',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_meczu_w_grupie ON events;
CREATE TRIGGER trg_powiadom_o_nowym_meczu_w_grupie
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_nowym_meczu_w_grupie();
