-- 111: Treści powiadomień — tytuł mówi CZEGO dotyczy, treść mówi CO się stało.
--
-- PO CO: powiadomienie na telefonie widać przez sekundę, na zablokowanym
-- ekranie, w dwóch linijkach. Musi w tym czasie odpowiedzieć na jedno pytanie:
-- „czy mnie to teraz obchodzi". Dotychczasowe treści odpowiadały wolniej, niż
-- trzeba, a przy wiadomościach nie odpowiadały wcale.
--
-- ZASADA, którą to wprowadza i której warto się trzymać przy nowych typach:
--   TYTUŁ  = konkret, którego dotyczy (nazwa meczu, nazwa ekipy),
--   TREŚĆ  = co się wydarzyło, najlepiej cudzymi słowami (treść wiadomości).
--
-- Odwrotnie było przy wiadomościach: tytuł brzmiał „Nowa wiadomość" (czyli to,
-- co i tak widać po ikonie), a treść mówiła „X napisał w rozmowie" — czyli
-- powtarzała tytuł innymi słowami i NIE pokazywała samej wiadomości. Po takim
-- powiadomieniu trzeba było otworzyć aplikację, żeby dowiedzieć się, czy chodzi
-- o „będę 10 minut później", czy o „nie dam rady, szukajcie kogoś".

-- ---------------------------------------------------------------------------
-- 1. Wiadomość w rozmowie meczu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tytul TEXT;
  v_tresc TEXT;
BEGIN
  SELECT title INTO v_tytul FROM events WHERE id = NEW.event_id;

  -- 140 znaków: tyle mniej więcej mieści się w powiadomieniu na telefonie,
  -- zanim system i tak utnie resztę. Ucinamy sami, żeby dołożyć wielokropek —
  -- inaczej wiadomość kończy się w pół słowa i wygląda jak błąd.
  v_tresc := NEW.user_name || ': ' ||
    CASE WHEN length(NEW.body) > 140 THEN left(NEW.body, 140) || '…' ELSE NEW.body END;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'wiadomosc_w_meczu',
         coalesce(v_tytul, 'Rozmowa meczu'),
         v_tresc,
         NEW.event_id
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id
     AND ep.pending_approval = false
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ep.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'wiadomosc_w_meczu'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wiadomość na tablicy ekipy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa TEXT;
  v_tresc TEXT;
BEGIN
  IF NEW.pinned_at IS NOT NULL THEN
    RETURN NEW;   -- ogłoszenie ma własne powiadomienie (093)
  END IF;

  SELECT name INTO v_nazwa FROM groups WHERE id = NEW.group_id;

  v_tresc := NEW.user_name || ': ' ||
    CASE WHEN length(NEW.body) > 140 THEN left(NEW.body, 140) || '…' ELSE NEW.body END;

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'wiadomosc_w_grupie',
         coalesce(v_nazwa, 'Twoja ekipa'),
         v_tresc,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id
          AND n.group_id = NEW.group_id
          AND n.type = 'wiadomosc_w_grupie'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Publikacja składów
-- ---------------------------------------------------------------------------
-- „Są składy" jako tytuł mówiło CO, ale nie CZEGO dotyczy — przy dwóch meczach
-- w tygodniu trzeba było wejść, żeby sprawdzić który. Teraz tytuł niesie nazwę
-- meczu, a treść dokłada termin, bo to jest następne pytanie po „który mecz".
CREATE OR REPLACE FUNCTION powiadom_o_skladach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.teams_published IS NOT TRUE OR OLD.teams_published IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'sklady_opublikowane',
         coalesce(NEW.title, 'Mecz'),
         'Są składy — sprawdź, w której drużynie grasz. '
           || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id
    FROM event_participants ep
   WHERE ep.event_id = NEW.id
     AND ep.user_id IS NOT NULL
     AND ep.is_reserve = false
     AND ep.pending_approval = false;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Nowy mecz w ekipie
-- ---------------------------------------------------------------------------
-- Tytuł „Nowy mecz w grupie" nie mówił W KTÓREJ, a przy kilku ekipach to jest
-- pierwsze pytanie. Treść dostaje miejsce — bo „czwartek 20:00" bez boiska nie
-- wystarcza do decyzji, gdy ekipa gra w dwóch miejscach.
CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa_grupy TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_nazwa_grupy FROM groups WHERE id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         coalesce(v_nazwa_grupy, 'Twoja ekipa') || ' — nowy mecz',
         coalesce(NEW.title, 'Mecz') || ', '
           || to_char(NEW.event_date, 'DD.MM') || ' godz. '
           || to_char(NEW.event_time, 'HH24:MI')
           || coalesce(' · ' || NEW.field_name, '') || '.',
         NEW.id,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;   -- zakładający wie, że założył

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_meczu_w_grupie ON events;
CREATE TRIGGER trg_powiadom_o_nowym_meczu_w_grupie
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_nowym_meczu_w_grupie();
