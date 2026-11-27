-- ============================================================================
-- 191_turniej_opusc_druzyne.sql — zawodnik sam opuszcza drużynę turniejową.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Prośba właściciela (2026-11-27): ze składu usuwał tylko kapitan
-- albo organizator (polityka „Sklad prowadzi kapitan”, 145). Zawodnik, który
-- dołączył przez pomyłkę albo nie zagra, nie miał jak się wypisać.
--
-- `opusc_druzyne(p_druzyna)`: zalogowany kasuje SWÓJ wpis w składzie.
--   • Gdy ma już zdarzenia w meczach (gole, kartki), wpis zostaje jako
--     zawodnik bez konta (user_id = NULL): kasowanie wyzerowałoby strzelców
--     w rozegranych meczach i klasyfikację (ON DELETE SET NULL, 147).
--   • Kapitan też może odejść: drużyna zostaje bez kapitana, a ktoś ze
--     składu może poprosić o kapitanat (186). Interfejs mówi o tym w oknie.
--   • Nie po zakończeniu ani odwołaniu turnieju (jak `mozeEdytowacSklad()`).
-- Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION opusc_druzyne(p_druzyna uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna turniej_druzyny%ROWTYPE;
  v_status  text;
  v_wpis    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby opuścić drużynę.';
  END IF;
  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = p_druzyna;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiej drużyny.';
  END IF;
  SELECT t.status INTO v_status FROM turnieje t WHERE t.id = v_druzyna.turniej_id;
  IF v_status IN ('zakonczony', 'odwolany') THEN
    RAISE EXCEPTION 'Turniej już się skończył, skład zostaje taki, jaki grał.';
  END IF;
  SELECT z.id INTO v_wpis FROM turniej_zawodnicy z
   WHERE z.druzyna_id = p_druzyna AND z.user_id = auth.uid()
   LIMIT 1;
  IF v_wpis IS NULL THEN
    RAISE EXCEPTION 'Nie ma Cię w składzie tej drużyny.';
  END IF;

  IF EXISTS (SELECT 1 FROM turniej_zdarzenia e
              WHERE e.zawodnik_id = v_wpis OR e.asysta_zawodnik_id = v_wpis) THEN
    UPDATE turniej_zawodnicy SET user_id = NULL, kapitan = false WHERE id = v_wpis;
  ELSE
    DELETE FROM turniej_zawodnicy WHERE id = v_wpis;
  END IF;

  IF v_druzyna.kapitan_id = auth.uid() THEN
    UPDATE turniej_druzyny SET kapitan_id = NULL WHERE id = p_druzyna;
  END IF;
END $$;

REVOKE ALL ON FUNCTION opusc_druzyne(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opusc_druzyne(uuid) TO authenticated;
