-- 122: Odświeżenie powiadomienia o wiadomości w oknie ciszy.
--
-- PO CO: zgłoszone wprost — w panelu „Wiadomości" dzwonka (`NotificationBell.tsx`)
-- nie pojawiała się najnowsza wiadomość, mimo że osobny panel „Nieprzeczytane
-- rozmowy" (`PanelRozmow.tsx`, czyta wprost z `event_comments`/`group_posts`,
-- bez throttlingu) pokazywał ją poprawnie i z nowszą godziną.
--
-- Powód: `111` wstawia najwyżej jedno powiadomienie na odbiorcę na rozmowę
-- na godzinę (`NOT EXISTS (... created_at > now() - interval '60 minutes')`)
-- — to CELOWA ochrona przed spamem (rozmowa przed meczem potrafi mieć
-- trzydzieści wiadomości w kwadrans, jedno powiadomienie na godzinę
-- wystarcza jako sygnał). Problem: przy DRUGIEJ i KOLEJNYCH wiadomościach
-- w tej samej godzinie warunek po prostu pomijał wstawienie — istniejący
-- wiersz zostawał z treścią PIERWSZEJ wiadomości z tej godziny, a treść
-- kolejnych ginęła bez śladu, nawet w samej bazie.
--
-- NAPRAWA: zamiast pomijać wstawienie, ISTNIEJĄCY wiersz (ten sam odbiorca,
-- ta sama rozmowa, sprzed mniej niż godziny) dostaje treść NAJNOWSZEJ
-- wiadomości, świeży `created_at` i wraca do stanu nieprzeczytanego. Limit
-- (najwyżej jedno powiadomienie na godzinę) zostaje nietknięty — zmienia się
-- wyłącznie to, że TO JEDNO powiadomienie zawsze pokazuje ostatnią wiadomość,
-- nie zamrożoną pierwszą.
--
-- Push nie dubluje się: `trg_wyslij_push` (102) łapie wyłącznie INSERT, więc
-- UPDATE poniżej nie wysyła nowego powiadomienia na telefon — dokładnie to
-- samo ograniczenie co dotąd, celowo zachowane. `NotificationBell.tsx` w tym
-- samym PR dostaje osobną subskrypcję na UPDATE, żeby odświeżony wiersz
-- pokazał się na żywo, bez przeładowania panelu.

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

  -- Odbiorcy, którzy już mają powiadomienie o tej rozmowie sprzed mniej niż
  -- godziny: podmieniamy treść na najnowszą i cofamy do nieprzeczytanego,
  -- zamiast dokładać drugi wiersz.
  UPDATE notifications n
     SET body = v_tresc,
         created_at = now(),
         read_at = NULL
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id
     AND ep.pending_approval = false
     AND n.user_id = ep.user_id
     AND n.event_id = NEW.event_id
     AND n.type = 'wiadomosc_w_meczu'
     AND n.created_at > now() - interval '60 minutes';

  -- Reszta — nikt jeszcze nie dostał powiadomienia o tej rozmowie w tej
  -- godzinie — dostaje nowy wiersz. UPDATE wyżej już nadpisał `created_at`
  -- na `now()` u objętych odbiorców, więc `NOT EXISTS` poniżej ich pomija
  -- (widzi świeży wiersz) i trafia tylko do tych bez żadnego powiadomienia.
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

  UPDATE notifications n
     SET body = v_tresc,
         created_at = now(),
         read_at = NULL
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND n.user_id = gm.user_id
     AND n.group_id = NEW.group_id
     AND n.type = 'wiadomosc_w_grupie'
     AND n.created_at > now() - interval '60 minutes';

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
