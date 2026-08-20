-- 109: Powiadomienie o usunięciu POTWIERDZONEGO gracza ze składu.
--
-- `076_pelniejsze_tresci_powiadomien.sql#powiadom_o_odrzuceniu_prosby`
-- powiadamia wyłącznie o odrzuceniu PROŚBY (`OLD.pending_approval IS TRUE`).
-- Wyrzucenie gracza, który był już w składzie — bo `removeParticipant()`
-- (`lib/events.ts`) robi identyczny DELETE w obu przypadkach — nie generowało
-- żadnego powiadomienia. Gracz dowiadywał się dopiero wchodząc na stronę
-- meczu, albo na boisku. To ta sama klasa błędu, którą `070` naprawiła dla
-- odwołania meczu, jeden poziom niżej.
--
-- Trigger jest BEFORE DELETE, tak jak `076`, żeby oba triggery na tym samym
-- zdarzeniu działały w tym samym momencie cyklu życia wiersza — dzielą
-- wzajemnie wykluczające się warunki (pending vs nie-pending), nie kolidują.
--
-- Rozróżnienie "sam się wypisał" vs "organizator/delegat usunął": jedyna
-- ścieżka DELETE to `removeParticipant`, a polityka RLS (`108`) pozwala na nią
-- właścicielowi wiersza, organizatorowi albo delegatowi z `can_manage_squad` —
-- `auth.uid() IS NOT DISTINCT FROM OLD.user_id` wystarczy, żeby odróżnić
-- samowypisanie (nie ma o czym powiadamiać) od usunięcia przez kogoś innego.
--
-- Gdy usuwany jest CAŁY mecz, `event_participants` kaskaduje (`ON DELETE
-- CASCADE`) i `SELECT ... FROM events WHERE id = OLD.event_id` nie zwróci
-- nic — trigger wtedy milczy, bo o usunięciu meczu mówi osobne powiadomienie
-- (migracja `112`). Bez tego warunku każdy uczestnik usuniętego meczu
-- dostałby mylące "usunięto Cię ze składu" zamiast "mecz został usunięty".

CREATE OR REPLACE FUNCTION powiadom_o_usunieciu_uczestnika()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tytul  TEXT;
  v_data   DATE;
  v_godz   TIME;
  v_status TEXT;
BEGIN
  IF OLD.user_id IS NULL
     OR OLD.pending_approval IS TRUE               -- pokrywa 076
     OR auth.uid() IS NOT DISTINCT FROM OLD.user_id -- samowypisanie
  THEN
    RETURN OLD;
  END IF;

  SELECT coalesce(title, sport), event_date, event_time, status
    INTO v_tytul, v_data, v_godz, v_status
    FROM events WHERE id = OLD.event_id;

  -- Mecz usunięty (kaskada) → nic do znalezienia; mecz odwołany albo już
  -- rozegrany → nie dorzucamy kolejnego powiadomienia do tego, co już wysłała
  -- `070`, ani nie mieszamy graczowi w głowie datą z przeszłości.
  IF v_status IS NULL OR v_status = 'cancelled' OR v_data < current_date THEN
    RETURN OLD;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    OLD.user_id, 'usuniety_ze_skladu', 'Usunięto Cię ze składu',
    coalesce(v_tytul, 'Mecz') || ' — ' || to_char(v_data, 'DD.MM') || ', godz. '
      || to_char(v_godz, 'HH24:MI') || '. Organizator usunął Twój zapis.',
    OLD.event_id
  );
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_usunieciu_uczestnika ON event_participants;
CREATE TRIGGER trg_powiadom_o_usunieciu_uczestnika
  BEFORE DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_usunieciu_uczestnika();
