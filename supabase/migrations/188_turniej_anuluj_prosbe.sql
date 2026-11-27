-- ============================================================================
-- 188_turniej_anuluj_prosbe.sql — autor cofa własną prośbę do drużyny.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Test przed turniejem (2026-11-26): „kliknąłem testowo prośbę
-- o wycofanie z turnieju, prośba się od razu wysłała bez potwierdzenia i nie
-- da się tego cofnąć”. Potwierdzenie dokłada interfejs; tu jest cofnięcie.
-- Autor kasuje WŁASNĄ, jeszcze czekającą prośbę (186/187). Rozpatrzonej się
-- nie cofa: decyzja kapitana albo organizatora już zapadła. Powiadomienie
-- u odbiorcy gaśnie samo, bo prośba przestaje czekać (`WYMAGA_AKCJI`).
-- Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION anuluj_prosbe_do_druzyny(p_prosba uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ile int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby cofnąć prośbę.';
  END IF;
  DELETE FROM turniej_prosby p
   WHERE p.id = p_prosba AND p.user_id = auth.uid() AND p.status = 'czeka';
  GET DIAGNOSTICS v_ile = ROW_COUNT;
  IF v_ile = 0 THEN
    RAISE EXCEPTION 'Tej prośby nie da się już cofnąć: została rozpatrzona albo nie jest Twoja.';
  END IF;
END $$;

REVOKE ALL ON FUNCTION anuluj_prosbe_do_druzyny(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anuluj_prosbe_do_druzyny(uuid) TO authenticated;
