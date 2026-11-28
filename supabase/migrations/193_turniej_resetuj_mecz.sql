-- ============================================================================
-- 193_turniej_resetuj_mecz.sql — „Resetuj mecz”: mecz w trakcie albo po
-- wraca do stanu sprzed pierwszego gwizdka i da się go odpalić od nowa.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Dzień turnieju (2026-11-28): prowadzący wystartował zły mecz
-- albo nabił gole nie tej drużynie. „Popraw wynik” (175/185) działa tylko
-- na meczu ZAKOŃCZONYM, a meczu w trakcie nie dało się cofnąć wcale.
-- `resetuj_mecz()` robi to samo co `cofnij_wynik_meczu()`, ale także dla
-- meczu w trakcie: kasuje gole i kartki, zeruje wynik, zegar, karne,
-- zwycięzcę i zawodnika meczu, status wraca na 'zaplanowany', a zwycięzca
-- znika z kolejnej rundy. Ta sama blokada: mecz zależny, który już ruszył,
-- trzeba zresetować najpierw.
-- Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION resetuj_mecz(p_mecz uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mecz     turniej_mecze%ROWTYPE;
  v_zalezny  int;
BEGIN
  SELECT * INTO v_mecz FROM turniej_mecze m WHERE m.id = p_mecz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu.';
  END IF;
  IF NOT czy_prowadzi_mecz(p_mecz) THEN
    RAISE EXCEPTION 'Mecz resetuje organizator albo prowadzący mecze.';
  END IF;
  IF v_mecz.status = 'zaplanowany' THEN
    RAISE EXCEPTION 'Ten mecz jeszcze się nie zaczął, nie ma czego resetować.';
  END IF;
  IF czy_wolny_los(v_mecz) THEN
    RAISE EXCEPTION 'Wolnego losu nie da się zresetować: nikt w nim nie grał.';
  END IF;

  SELECT min(z.numer) INTO v_zalezny
    FROM turniej_mecze z
   WHERE z.status <> 'zaplanowany' AND z.id <> p_mecz
     AND (z.zrodlo_a_mecz_id = p_mecz OR z.zrodlo_b_mecz_id = p_mecz
          OR (v_mecz.grupa_id IS NOT NULL
              AND (z.zrodlo_a_grupa_id = v_mecz.grupa_id OR z.zrodlo_b_grupa_id = v_mecz.grupa_id)));
  IF v_zalezny IS NOT NULL THEN
    RAISE EXCEPTION 'Mecz M% zależy od tego meczu i już się zaczął. Najpierw zresetuj tamten.', v_zalezny;
  END IF;

  DELETE FROM turniej_zdarzenia zd WHERE zd.mecz_id = p_mecz;

  UPDATE turniej_mecze m SET
    status = 'zaplanowany', wynik_a = 0, wynik_b = 0, wynik_recznie = false,
    karne_a = NULL, karne_b = NULL, zwyciezca_id = NULL, walkower_dla = NULL,
    mvp_zawodnik_id = NULL, zakonczony_at = NULL, rozpoczety_at = NULL, sety = NULL,
    zegar_od = NULL, zegar_sekundy = 0, polowa = 1
   WHERE m.id = p_mecz;

  UPDATE turniej_mecze m SET druzyna_a_id = NULL
   WHERE m.zrodlo_a_mecz_id = p_mecz AND m.status = 'zaplanowany';
  UPDATE turniej_mecze m SET druzyna_b_id = NULL
   WHERE m.zrodlo_b_mecz_id = p_mecz AND m.status = 'zaplanowany';
END $$;

REVOKE ALL ON FUNCTION resetuj_mecz(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resetuj_mecz(uuid) TO authenticated;
