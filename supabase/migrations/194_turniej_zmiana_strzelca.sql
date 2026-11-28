-- ============================================================================
-- 194_turniej_zmiana_strzelca.sql — strzelec dopisany albo zmieniony po golu
-- i zawodnik dopisany do składu w trakcie meczu.
-- ----------------------------------------------------------------------------
-- DLACZEGO (prośba właściciela z 2026-11-28, dzień turnieju w Luboniu):
-- prowadzący wpisuje gola w biegu, często „bez strzelca”, a kto strzelił,
-- wychodzi minutę później albo po meczu. Do tej pory zdarzenie dało się tylko
-- dopisać albo skasować, i tylko w trwającym meczu (147), więc strzelca
-- nie było jak uzupełnić. Do tego strzelca często nie ma w składzie: drużyna
-- dodana ręcznie przez organizatora przychodzi bez listy zawodników.
--
-- 1. `ustaw_strzelca_zdarzenia(p_zdarzenie, p_zawodnik)`: zmienia WYŁĄCZNIE
--    zawodnika przy zdarzeniu (gol, samobój, kartka, punkty), nigdy drużynę
--    ani wartość, więc nie rusza wyniku. Dlatego działa także w meczu już
--    rozstrzygniętym. Zawodnik musi być z drużyny zdarzenia; NULL = bez
--    strzelca. Wołać może prowadzący mecz (`czy_prowadzi_mecz()`, 146).
-- 2. `dopisz_zawodnika_w_meczu(p_mecz, p_druzyna, p_imie)`: prowadzący
--    dopisuje zawodnika (samo imię, bez konta) do jednej z drużyn tego meczu.
--    Polityka składu (145) przepuszcza tylko kapitana i zarządzającego
--    drużynami; prowadzący meczu nim nie jest. Limit składu (`max_zawodnikow`)
--    świadomie nie obowiązuje: w dniu turnieju liczy się zapis gola.
--
-- Same dokładające zmiany (CREATE OR REPLACE), automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION ustaw_strzelca_zdarzenia(p_zdarzenie uuid, p_zawodnik uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_z turniej_zdarzenia%ROWTYPE;
BEGIN
  SELECT * INTO v_z FROM turniej_zdarzenia z WHERE z.id = p_zdarzenie;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiego zdarzenia.';
  END IF;
  IF NOT czy_prowadzi_mecz(v_z.mecz_id) THEN
    RAISE EXCEPTION 'Strzelca zmienia prowadzący mecz.';
  END IF;
  IF p_zawodnik IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM turniej_zawodnicy zw WHERE zw.id = p_zawodnik AND zw.druzyna_id = v_z.druzyna_id
  ) THEN
    RAISE EXCEPTION 'Ten zawodnik nie gra w drużynie, której dotyczy zdarzenie.';
  END IF;
  UPDATE turniej_zdarzenia z SET zawodnik_id = p_zawodnik WHERE z.id = p_zdarzenie;
END $$;

REVOKE ALL ON FUNCTION ustaw_strzelca_zdarzenia(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ustaw_strzelca_zdarzenia(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION dopisz_zawodnika_w_meczu(p_mecz uuid, p_druzyna uuid, p_imie text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_imie text := btrim(coalesce(p_imie, ''));
  v_turniej uuid;
  v_id uuid;
BEGIN
  IF NOT czy_prowadzi_mecz(p_mecz) THEN
    RAISE EXCEPTION 'Zawodnika w meczu dopisuje prowadzący mecz.';
  END IF;
  SELECT m.turniej_id INTO v_turniej FROM turniej_mecze m
   WHERE m.id = p_mecz AND p_druzyna IN (m.druzyna_a_id, m.druzyna_b_id);
  IF v_turniej IS NULL THEN
    RAISE EXCEPTION 'Ta drużyna nie gra w tym meczu.';
  END IF;
  IF char_length(v_imie) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Podaj imię zawodnika (do 60 znaków).';
  END IF;
  INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie)
  VALUES (p_druzyna, v_turniej, v_imie)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION dopisz_zawodnika_w_meczu(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dopisz_zawodnika_w_meczu(uuid, uuid, text) TO authenticated;
