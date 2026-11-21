-- ============================================================================
-- 178_wspolorganizator_po_emailu.sql — organizator dodaje współorganizatora
-- po adresie e-mail.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Turniej w Luboniu (28.11.2026) przygotowuje Bojo, a prowadzić go
-- ma organizator z Lubonia. Uprawnienia współorganizatora (`turniej_osoby`,
-- `moze_edytowac`) istnieją od `145`, ale nie było jak ich nadać: zakładka
-- „Ludzie” jest schowana, a przeglądarka nie może sama szukać kont po e-mailu
-- (`auth.users` jest poza zasięgiem `anon`/`authenticated`). Decyzja
-- właściciela z 2026-11-21: „opcja dodania organizatora po prostu”.
--
-- `dodaj_wspolorganizatora(p_turniej, p_email)`: wołać może organizator
-- turnieju albo admin (`czy_organizator_turnieju()`, 145). Konto szuka się po
-- e-mailu bez rozróżniania wielkości liter. Współorganizator dostaje pełne
-- prawa do prowadzenia (edycja, mecze, drużyny); usunąć turniej i nadawać
-- prawa dalej może tylko organizator (polityki z 145 bez zmian).
--
-- Funkcja zdradza wyłącznie to, czy pod adresem jest konto, i tylko
-- organizatorowi turnieju. Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION dodaj_wspolorganizatora(p_turniej uuid, p_email text)
RETURNS TABLE (osoba_id uuid, nazwa text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT czy_organizator_turnieju(p_turniej) THEN
    RAISE EXCEPTION 'Współorganizatora dodaje organizator turnieju.';
  END IF;

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
  VALUES (p_turniej, v_user, true, true, true, auth.uid())
  ON CONFLICT (turniej_id, user_id) DO UPDATE
    SET moze_edytowac = true, moze_prowadzic = true, moze_zarzadzac_druzynami = true;

  RETURN QUERY
    SELECT v_user, coalesce(nullif(btrim(p.display_name), ''), 'Współorganizator')
      FROM (SELECT 1) x LEFT JOIN profiles p ON p.id = v_user;
END $$;

REVOKE ALL ON FUNCTION dodaj_wspolorganizatora(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dodaj_wspolorganizatora(uuid, text) TO authenticated;
