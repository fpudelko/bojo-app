-- 112: Powiadomienie o twardym usunięciu meczu.
--
-- `deleteEvent()` (`lib/events.ts`) to goły `DELETE FROM events`. Modal
-- potwierdzenia mówi wprost „Wszyscy uczestnicy stracą dostęp do meczu"
-- (`EventDetailClient.tsx`) — a mimo to nikt z nich nic nie dostawał. To
-- jedyne miejsce w produkcie, gdzie usunięcie danych jest całkowicie ciche.
--
-- ⚠️ PUŁAPKA ON DELETE CASCADE — PRZECZYTAJ PRZED ZMIANĄ TEGO PLIKU.
-- `notifications.event_id REFERENCES events(id) ON DELETE CASCADE` (`025`).
-- Gdyby ten trigger wstawiał powiadomienie z `event_id = OLD.id`, kaskada
-- Postgresa skasowałaby WŁASNY wiersz tego powiadomienia razem z resztą
-- danych zależnych od usuwanego meczu — insert by się powiódł, ale nic by nie
-- przetrwało, po cichu, bez błędu. Dlatego insert niżej celowo wstawia
-- `event_id = NULL`. `celPowiadomienia()` (`NotificationBell.tsx`) już dziś
-- obsługuje `eventId = null` — renderuje wiersz jako nieklikalny, zamiast
-- linkować do martwej strony 404. NIE zamieniaj `NULL` na `OLD.id`.
--
-- `BEFORE DELETE`: wiersz meczu (`sport`, `title`, `event_date`, `event_time`)
-- musi jeszcze istnieć, żeby zbudować treść powiadomienia.

CREATE OR REPLACE FUNCTION powiadom_o_usunieciu_meczu()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT;
BEGIN
  -- Mecz z przeszłości i tak nikogo nie zaskoczy na boisku — nie mieszamy
  -- graczowi w głowie powiadomieniem o dawno rozegranym/zapomnianym meczu.
  IF OLD.event_date < current_date THEN RETURN OLD; END IF;

  v_tytul := coalesce(OLD.title, OLD.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id, 'mecz_usuniety', 'Mecz usunięty',
    coalesce(v_tytul, 'Mecz') || ' — ' || to_char(OLD.event_date, 'DD.MM') || ', godz. '
      || to_char(OLD.event_time, 'HH24:MI') || '. Organizator usunął ten mecz na stałe.',
    NULL::uuid -- CELOWO NULL, nie OLD.id — patrz komentarz na górze pliku (pułapka CASCADE)
    FROM event_participants p
   WHERE p.event_id = OLD.id AND p.user_id IS NOT NULL AND p.user_id <> OLD.organizer_id;

  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_usunieciu_meczu ON events;
CREATE TRIGGER trg_powiadom_o_usunieciu_meczu
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_usunieciu_meczu();

-- ---------------------------------------------------------------------------
-- Naprawa odkryta przy ręcznym teście tej migracji na bazie testowej:
-- `powiadom_o_odrzuceniu_prosby()` (`076`) blokowała twarde usunięcie KAŻDEGO
-- meczu z choćby jedną oczekującą prośbą o dołączenie.
-- ---------------------------------------------------------------------------
-- Sekwencja przy `DELETE FROM events`: `BEFORE DELETE` na `events` (ten
-- trigger, wyżej) → wiersz meczu znika z tabeli → `ON DELETE CASCADE` kasuje
-- powiązane `event_participants` → to odpala ICH `BEFORE DELETE`, czyli też
-- `076`. W tym momencie `events` z tym `id` już nie istnieje, a `076` mimo to
-- próbowała wstawić powiadomienie z `event_id = OLD.event_id` — INSERT łamał
-- FK `notifications_event_id_fkey` i cała transakcja `DELETE FROM events`
-- wywracała się z błędem klucza obcego zamiast po prostu usunąć mecz.
-- Odtworzone ręcznie: mecz z jedną oczekującą prośbą, `DELETE FROM events`
-- kończył się `ERROR: insert or update on table "notifications" violates
-- foreign key constraint "notifications_event_id_fkey"`.
--
-- Naprawa: ten sam wzorzec osłony co w `powiadom_o_usunieciu_uczestnika()`
-- wyżej — gdy mecz już nie istnieje (kaskada), trigger milczy. O usunięciu
-- całego meczu i tak mówi powiadomienie `mecz_usuniety` wyżej.
CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;
  -- Mecz już nie istnieje (kaskadowe usunięcie całego meczu, patrz komentarz
  -- wyżej) — nic do odrzucenia, bo nie było decyzji organizatora, tylko
  -- usunięcie wydarzenia. INSERT z NULLami w treści i tak złamałby FK.
  IF NOT FOUND THEN RETURN OLD; END IF;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (OLD.user_id, 'prosba_odrzucona', 'Prośba o dołączenie odrzucona',
    'Organizator nie przyjął Twojej prośby o dołączenie do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    OLD.event_id);
  RETURN OLD;
END; $$;
