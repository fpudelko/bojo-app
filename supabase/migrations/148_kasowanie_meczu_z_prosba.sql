-- 148: Mecz z NIEROZPATRZONĄ prośbą o dołączenie znowu da się usunąć.
--
-- OBJAW: organizator klika „Usuń mecz", mecz zostaje. Warunek: ktoś czeka na
-- akceptację zapisu (`pending_approval = true`). W bazie:
--
--   insert or update on table "notifications" violates foreign key constraint
--   "notifications_event_id_fkey"
--
-- PRZYCZYNA: `powiadom_o_odrzuceniu_prosby()` wisi na `BEFORE DELETE ON
-- event_participants`. Przy `DELETE FROM events` sekwencja jest taka: wiersz
-- meczu znika → `ON DELETE CASCADE` kasuje uczestników → odpala ich
-- `BEFORE DELETE`. Wyzwalacz wstawia wtedy powiadomienie wskazujące na mecz,
-- którego już nie ma, i klucz obcy wywraca całe kasowanie.
--
-- TO JEST REGRESJA, NIE NOWY BŁĄD — i to jest w tej migracji najważniejsze.
-- `116` naprawiła dokładnie to samo, osłoną `IF NOT FOUND THEN RETURN OLD`.
-- `135` dokładała do tej funkcji inny warunek (anulowanie własnej prośby to nie
-- odrzucenie przez organizatora) i wzięła ciało z `076` — czyli z wersji SPRZED
-- `116`. Osłona zniknęła po cichu: `CREATE OR REPLACE FUNCTION` nie mówi, co
-- właśnie nadpisał, a żaden test tej ścieżki wtedy nie pilnował.
--
-- Dlatego ta migracja NIE tylko przywraca osłonę: razem z nią wchodzi
-- `supabase/test/kasowanie-meczu.sql` (uruchamiany przez `baza-testowa.sh`,
-- czyli w CI), który sprawdza OBIE strony naraz — że mecz z czekającą prośbą
-- daje się usunąć ORAZ że odrzucenie pojedynczej prośby dalej powiadamia.
-- Bez tej drugiej asercji „naprawą" byłoby wyłączenie powiadomienia.
--
-- Ciało poniżej = wersja z `135` (warunek `auth.uid()`) + osłona z `116`.
-- Migracja jest idempotentna.

CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;

  -- Z `135`: gracz wycofał prośbę sam (przycisk „Anuluj" w banerze „Oczekujesz
  -- na akceptację" woła ten sam DELETE co odrzucenie przez organizatora).
  -- „Organizator nie przyjął Twojej prośby" byłoby wtedy nieprawdą — i to
  -- nieprawdą obciążającą organizatora.
  IF auth.uid() IS NOT DISTINCT FROM OLD.user_id THEN RETURN OLD; END IF;

  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;

  -- Z `116`: meczu już nie ma, czyli to kaskada z `DELETE FROM events`. Nikt
  -- niczego nie odrzucił — zniknęło całe wydarzenie, a o tym mówi osobne
  -- powiadomienie `mecz_usuniety` (`powiadom_o_usunieciu_meczu()`, `116`).
  IF NOT FOUND THEN RETURN OLD; END IF;

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
