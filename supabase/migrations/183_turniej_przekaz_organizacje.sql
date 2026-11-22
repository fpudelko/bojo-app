-- ============================================================================
-- 183_turniej_przekaz_organizacje.sql — organizator przekazuje turniej
-- współorganizatorowi.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Turniej „Gramy dla Marysi” przygotowało Bojo, więc na stronie
-- stoi „Organizuje Franek Pudełko”, a organizuje ktoś inny (prośba właściciela
-- z 2026-11-22). Do tej pory zmiana organizatora szła wyłącznie skryptem
-- w SQL Editorze (`supabase/zadania/turniej-marysi-organizator.sql`).
--
-- `przekaz_organizacje_turnieju(p_turniej, p_user)`: woła organizator albo
-- admin (`czy_organizator_turnieju()`, 145). Nowy organizator musi już być
-- współorganizatorem (178), więc nie da się oddać turnieju przypadkowemu
-- kontu. Zamiana miejsc: nowy organizator wychodzi z `turniej_osoby`,
-- dotychczasowy do niej wchodzi z pełnymi prawami, więc nikt nie traci
-- dostępu w dniu turnieju. Funkcję da się puścić drugi raz bez szkody.
-- Same dokładające zmiany, automatem.
-- ============================================================================

CREATE OR REPLACE FUNCTION przekaz_organizacje_turnieju(p_turniej uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stary uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT czy_organizator_turnieju(p_turniej) THEN
    RAISE EXCEPTION 'Organizację przekazuje organizator turnieju.';
  END IF;
  SELECT organizator_id INTO v_stary FROM turnieje WHERE id = p_turniej FOR UPDATE;
  IF v_stary IS NULL THEN RAISE EXCEPTION 'Nie ma takiego turnieju.'; END IF;
  IF v_stary = p_user THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM turniej_osoby WHERE turniej_id = p_turniej AND user_id = p_user) THEN
    RAISE EXCEPTION 'Najpierw dodaj tę osobę jako współorganizatora.';
  END IF;

  INSERT INTO turniej_osoby (turniej_id, user_id, moze_edytowac, moze_prowadzic, moze_zarzadzac_druzynami, dodany_przez)
  VALUES (p_turniej, v_stary, true, true, true, auth.uid())
  ON CONFLICT (turniej_id, user_id) DO UPDATE
    SET moze_edytowac = true, moze_prowadzic = true, moze_zarzadzac_druzynami = true;
  UPDATE turnieje SET organizator_id = p_user WHERE id = p_turniej;
  DELETE FROM turniej_osoby WHERE turniej_id = p_turniej AND user_id = p_user;
END $$;

REVOKE ALL ON FUNCTION przekaz_organizacje_turnieju(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION przekaz_organizacje_turnieju(uuid, uuid) TO authenticated;
