-- ============================================================================
-- 185_turniej_prowadzacy_meczow.sql — rola „Prowadzący mecze”.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Prośba właściciela z 2026-11-25: osoba przy stoliku na hali
-- startuje mecze i wpisuje wyniki, a organizator nie musi jej dawać swojego
-- konta ani pełnych praw współorganizatora. Uprawnienie `moze_prowadzic`
-- istnieje od 145 i `czy_prowadzi_mecz()` (146) już je honoruje przy meczach,
-- zdarzeniach (147) i następnym meczu (155). Brakowało dwóch rzeczy:
--
-- 1. `dodaj_osobe_turnieju(p_turniej, p_email, p_rola)`: organizator dodaje
--    po e-mailu współorganizatora ('wspolorganizator', jak 178) albo
--    prowadzącego ('prowadzacy': tylko `moze_prowadzic`). Ponowne dodanie tej
--    samej osoby ustawia jej rolę na nowo, także w dół.
-- 2. `cofnij_wynik_meczu()` (175) wpuszcza prowadzącego: poprawka pomyłki przy
--    stoliku nie może czekać na organizatora. Przy okazji zeruje zegar (182),
--    inaczej poprawiany mecz startował z czasem z pierwszego podejścia.
--
-- Prowadzący NIE zmienia ustawień, drużyn, terminarza, przerw ani statusu
-- turnieju: tego pilnują polityki `czy_zarzadza_turniejem()` bez zmian.
-- Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION dodaj_osobe_turnieju(p_turniej uuid, p_email text, p_rola text)
RETURNS TABLE (osoba_id uuid, nazwa text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_pelne boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT czy_organizator_turnieju(p_turniej) THEN
    RAISE EXCEPTION 'Osoby do turnieju dodaje organizator turnieju.';
  END IF;
  IF p_rola NOT IN ('wspolorganizator', 'prowadzacy') THEN
    RAISE EXCEPTION 'Nieznana rola: %.', p_rola;
  END IF;
  v_pelne := p_rola = 'wspolorganizator';

  SELECT u.id INTO v_user FROM auth.users u
   WHERE lower(u.email) = lower(btrim(coalesce(p_email, '')))
   LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nie ma konta w Bojo z adresem %. Poproś tę osobę, żeby najpierw założyła konto.', btrim(p_email);
  END IF;
  IF EXISTS (SELECT 1 FROM turnieje t WHERE t.id = p_turniej AND t.organizator_id = v_user) THEN
    RAISE EXCEPTION 'Ta osoba już jest organizatorem tego turnieju.';
  END IF;

  INSERT INTO turniej_osoby (turniej_id, user_id, moze_edytowac, moze_prowadzic, moze_zarzadzac_druzynami, dodany_przez)
  VALUES (p_turniej, v_user, v_pelne, true, v_pelne, auth.uid())
  ON CONFLICT (turniej_id, user_id) DO UPDATE
    SET moze_edytowac = v_pelne, moze_prowadzic = true, moze_zarzadzac_druzynami = v_pelne;

  RETURN QUERY
    SELECT v_user, coalesce(nullif(btrim(p.display_name), ''), 'Bez nazwy')
      FROM (SELECT 1) x LEFT JOIN profiles p ON p.id = v_user;
END $$;

REVOKE ALL ON FUNCTION dodaj_osobe_turnieju(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dodaj_osobe_turnieju(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION cofnij_wynik_meczu(p_mecz uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mecz     turniej_mecze%ROWTYPE;
  v_zalezny  int;
BEGIN
  SELECT * INTO v_mecz FROM turniej_mecze m WHERE m.id = p_mecz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu.';
  END IF;
  -- 185: poprawia też prowadzący mecze (wcześniej tylko zarządzający).
  IF NOT czy_prowadzi_mecz(p_mecz) THEN
    RAISE EXCEPTION 'Wynik poprawia organizator albo prowadzący mecze.';
  END IF;
  IF v_mecz.status NOT IN ('zakonczony','walkower') THEN
    RAISE EXCEPTION 'Ten mecz nie ma jeszcze wyniku do poprawienia.';
  END IF;
  IF czy_wolny_los(v_mecz) THEN
    RAISE EXCEPTION 'Wolnego losu nie da się poprawić: nikt w nim nie grał.';
  END IF;

  -- Mecz zależny, który już ruszył, blokuje poprawę: przepięcie drużyny
  -- w rozegranym meczu zmieniłoby historię bez wiedzy grających.
  SELECT min(z.numer) INTO v_zalezny
    FROM turniej_mecze z
   WHERE z.status <> 'zaplanowany'
     AND (z.zrodlo_a_mecz_id = p_mecz OR z.zrodlo_b_mecz_id = p_mecz
          OR (v_mecz.grupa_id IS NOT NULL
              AND (z.zrodlo_a_grupa_id = v_mecz.grupa_id OR z.zrodlo_b_grupa_id = v_mecz.grupa_id)));
  IF v_zalezny IS NOT NULL THEN
    RAISE EXCEPTION 'Mecz M% zależy od tego wyniku i już się zaczął. Najpierw popraw tamten mecz.', v_zalezny;
  END IF;

  DELETE FROM turniej_zdarzenia zd WHERE zd.mecz_id = p_mecz;

  UPDATE turniej_mecze m SET
    status = 'zaplanowany', wynik_a = 0, wynik_b = 0, wynik_recznie = false,
    karne_a = NULL, karne_b = NULL, zwyciezca_id = NULL, walkower_dla = NULL,
    mvp_zawodnik_id = NULL, zakonczony_at = NULL, rozpoczety_at = NULL, sety = NULL,
    zegar_od = NULL, zegar_sekundy = 0, polowa = 1
   WHERE m.id = p_mecz;

  -- Zwycięzca/przegrany tego meczu znika z kolejnej rundy. Miejsca z grupy
  -- czyści `wypelnij_z_grupy()` wołane wyzwalaczem po zmianie statusu.
  UPDATE turniej_mecze m SET druzyna_a_id = NULL
   WHERE m.zrodlo_a_mecz_id = p_mecz AND m.status = 'zaplanowany';
  UPDATE turniej_mecze m SET druzyna_b_id = NULL
   WHERE m.zrodlo_b_mecz_id = p_mecz AND m.status = 'zaplanowany';
END $$;

GRANT EXECUTE ON FUNCTION cofnij_wynik_meczu(uuid) TO authenticated;
