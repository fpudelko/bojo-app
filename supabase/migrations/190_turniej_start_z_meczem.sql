-- ============================================================================
-- 190_turniej_start_z_meczem.sql — turniej zaczyna się sam, gdy rusza
-- pierwszy mecz.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Uwaga właściciela (2026-11-27): wyniki dało się wpisywać dopiero
-- po „Rozpocznij turniej” w panelu, a w dniu turnieju nikt o tym przycisku
-- nie pamięta: prowadzący wchodzi w mecz i chce go zacząć. Teraz start meczu
-- (albo wpisanie wyniku) w turnieju na zapisach przestawia turniej na
-- „w trakcie”. Interfejs pyta o to wcześniej oknem „Rozpocząć turniej?”.
--
-- Wyzwalacz, nie kod w przeglądarce: prowadzący mecze (185) nie ma prawa
-- zmieniać wiersza turnieju, a to właśnie on zwykle zaczyna pierwszy mecz.
-- Tylko przejście z 'zaplanowany' na 'trwa' albo 'zakonczony'; walkower nie,
-- bo wolne losy drabinki wpisuje automat. Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION turniej_startuje_z_meczem()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE turnieje t SET status = 'trwa'
   WHERE t.id = NEW.turniej_id
     AND t.status IN ('zapisy', 'zamkniete_zapisy');
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION turniej_startuje_z_meczem() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_turniej_startuje_z_meczem ON turniej_mecze;
CREATE TRIGGER trg_turniej_startuje_z_meczem
  AFTER UPDATE OF status ON turniej_mecze
  FOR EACH ROW
  WHEN (OLD.status = 'zaplanowany' AND NEW.status IN ('trwa', 'zakonczony'))
  EXECUTE FUNCTION turniej_startuje_z_meczem();
