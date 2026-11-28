-- ============================================================================
-- 195_turniej_gol_na_samoboj.sql — wpisany gol zamieniony na samobój (i z
-- powrotem) bez zmiany wyniku.
-- ----------------------------------------------------------------------------
-- DLACZEGO (dzień turnieju w Luboniu, 2026-11-28): prowadzący wpisuje „GOL”
-- w biegu, a po chwili wychodzi, że to był samobój zawodnika rywala. `194`
-- pozwala zmienić tylko strzelca w obrębie drużyny zdarzenia; samobój ma
-- inną drużynę (strzelającego) i inny typ, więc trzeba go było kasować, a po
-- meczu nie dało się wcale (polityki z 147).
--
-- `zamien_gol_samoboj(p_zdarzenie, p_zawodnik)`:
--   • gol drużyny X → samobój zawodnika drużyny Y (druzyna_id := Y),
--   • samobój zawodnika Y → gol drużyny X (druzyna_id := X).
-- Wynik się nie zmienia: wyzwalacz z 147 liczy gol X i samobój Y tak samo,
-- jako bramkę dla X. Zawodnik musi być z nowej drużyny zdarzenia; NULL = bez
-- strzelca. Wołać może prowadzący mecz (`czy_prowadzi_mecz()`), także po
-- meczu. Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION zamien_gol_samoboj(p_zdarzenie uuid, p_zawodnik uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_z turniej_zdarzenia%ROWTYPE;
  v_m turniej_mecze%ROWTYPE;
  v_nowa uuid;
  v_typ text;
BEGIN
  SELECT * INTO v_z FROM turniej_zdarzenia z WHERE z.id = p_zdarzenie;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiego zdarzenia.';
  END IF;
  IF NOT czy_prowadzi_mecz(v_z.mecz_id) THEN
    RAISE EXCEPTION 'Gol zmienia prowadzący mecz.';
  END IF;
  IF v_z.typ NOT IN ('gol', 'samobojczy') THEN
    RAISE EXCEPTION 'Na samobój da się zamienić tylko gola.';
  END IF;
  SELECT * INTO v_m FROM turniej_mecze m WHERE m.id = v_z.mecz_id;
  v_nowa := CASE WHEN v_z.druzyna_id = v_m.druzyna_a_id THEN v_m.druzyna_b_id ELSE v_m.druzyna_a_id END;
  v_typ  := CASE WHEN v_z.typ = 'gol' THEN 'samobojczy' ELSE 'gol' END;
  IF v_nowa IS NULL THEN
    RAISE EXCEPTION 'Mecz nie ma jeszcze drugiej drużyny.';
  END IF;
  IF p_zawodnik IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM turniej_zawodnicy zw WHERE zw.id = p_zawodnik AND zw.druzyna_id = v_nowa
  ) THEN
    RAISE EXCEPTION 'Ten zawodnik nie gra w drużynie, która strzeliła.';
  END IF;
  UPDATE turniej_zdarzenia z
     SET typ = v_typ, druzyna_id = v_nowa, zawodnik_id = p_zawodnik, asysta_zawodnik_id = NULL
   WHERE z.id = p_zdarzenie;
END $$;

REVOKE ALL ON FUNCTION zamien_gol_samoboj(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zamien_gol_samoboj(uuid, uuid) TO authenticated;
