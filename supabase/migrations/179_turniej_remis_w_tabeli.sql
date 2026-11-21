-- ============================================================================
-- 179_turniej_remis_w_tabeli.sql — remis w tabeli: kolejność ustalona przez
-- organizatora i komentarz pod tabelą grupy.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Grupa finałowa „Gramy dla Marysi” (2026-11-21) skończyła się
-- trzema drużynami z identycznym bilansem: 3 pkt, 1:1. Bojo ułożyło je po
-- nazwie i ogłosiło podium 🥇🥈🥉, czyli rozstrzygnięcie, którego nikt nie
-- podjął. Frontend pokazuje dziś takie drużyny ex aequo, a organizator
-- ustala kolejność sam i może dopisać, jak ją rozstrzygnął („karne po
-- meczu”, „losowanie”).
--
-- KOLEJNOŚĆ PRZY GRUPIE, NIE PRZY DRUŻYNIE. `turniej_druzyny.pozycja_recznie`
-- (145) to jedna liczba na drużynę, a drużyna z grupy finałowej ma też swoją
-- pierwotną grupę: 1. miejsce w finałowej przestawiłoby ją w grupie A
-- i mogło zmienić, kto awansował. `turniej_grupy.kolejnosc_reczna` to lista
-- drużyn tej jednej grupy w kolejności wybranej przez organizatora.
--
-- 1. `turniej_grupy.komentarz` (do 300 znaków) i `kolejnosc_reczna uuid[]`.
--    Pisze zarządzający (polityka „Grupy turnieju zarzadza organizator”, 146).
-- 2. `kolejnosc_w_grupie()` (175) uwzględnia `kolejnosc_reczna`, więc drużyny
--    trafiają do grupy finałowej / drabinki w kolejności organizatora.
-- 3. Zmiana `kolejnosc_reczna` od razu przelicza miejsca z grupy
--    (`wypelnij_z_grupy()`); dotąd przeliczała je wyłącznie zmiana meczu.
--
-- Same dokładające zmiany, automatem.
-- ============================================================================

ALTER TABLE turniej_grupy
  ADD COLUMN IF NOT EXISTS komentarz text,
  ADD COLUMN IF NOT EXISTS kolejnosc_reczna uuid[];

ALTER TABLE turniej_grupy DROP CONSTRAINT IF EXISTS turniej_grupy_komentarz_dlugosc;
ALTER TABLE turniej_grupy ADD CONSTRAINT turniej_grupy_komentarz_dlugosc
  CHECK (komentarz IS NULL OR char_length(komentarz) <= 300);

-- Ciało z 175 bez zmian, na końcu kolejność organizatora.
CREATE OR REPLACE FUNCTION kolejnosc_w_grupie(p_grupa uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_liczone uuid[];
  v_wynik   uuid[];
  v_reszta  uuid[] := '{}';
  v_n       int;
  v_d       uuid;
  v_poz     int;
  i         int;
  j         int := 1;
  v_reczna  uuid[];
BEGIN
  WITH druzyny AS (
    SELECT d.id, d.nazwa, CASE WHEN d.grupa_id = p_grupa THEN d.pozycja_recznie END AS reczna
      FROM turniej_druzyny d
     WHERE d.grupa_id = p_grupa
        OR d.id IN (SELECT m.druzyna_a_id FROM turniej_mecze m WHERE m.grupa_id = p_grupa
                    UNION SELECT m.druzyna_b_id FROM turniej_mecze m WHERE m.grupa_id = p_grupa)
  ), rozegrane AS (
    SELECT m.druzyna_a_id AS dom, m.druzyna_b_id AS gosc, m.wynik_a AS bd, m.wynik_b AS bg, m.zwyciezca_id
      FROM turniej_mecze m
     WHERE m.grupa_id = p_grupa AND m.status IN ('zakonczony','walkower')
       AND m.druzyna_a_id IS NOT NULL AND m.druzyna_b_id IS NOT NULL
  ), strony AS (
    SELECT dom AS druzyna, bd AS zdobyte, bg AS stracone, zwyciezca_id FROM rozegrane
    UNION ALL
    SELECT gosc, bg, bd, zwyciezca_id FROM rozegrane
  ), dorobek AS (
    SELECT dr.id, dr.nazwa,
      coalesce(sum(CASE WHEN s.druzyna IS NULL THEN 0
                        WHEN s.zwyciezca_id = dr.id THEN t.punkty_za_wygrana
                        WHEN s.zwyciezca_id IS NULL THEN t.punkty_za_remis
                        ELSE 0 END), 0) AS punkty,
      coalesce(sum(s.zdobyte), 0) - coalesce(sum(s.stracone), 0) AS roznica,
      coalesce(sum(s.zdobyte), 0) AS zdobyte
    FROM druzyny dr
    JOIN turniej_grupy g ON g.id = p_grupa
    JOIN turnieje t ON t.id = g.turniej_id
    LEFT JOIN strony s ON s.druzyna = dr.id
    GROUP BY dr.id, dr.nazwa
  )
  SELECT array_agg(id ORDER BY punkty DESC, roznica DESC, zdobyte DESC, nazwa)
    INTO v_liczone FROM dorobek;

  v_n := coalesce(array_length(v_liczone, 1), 0);
  IF v_n = 0 THEN RETURN '{}'; END IF;
  v_wynik := array_fill(NULL::uuid, ARRAY[v_n]);

  FOR i IN 1 .. v_n LOOP
    v_d := v_liczone[i];
    SELECT CASE WHEN d.grupa_id = p_grupa THEN d.pozycja_recznie END INTO v_poz
      FROM turniej_druzyny d WHERE d.id = v_d;
    IF v_poz IS NOT NULL AND v_poz BETWEEN 1 AND v_n AND v_wynik[v_poz] IS NULL THEN
      v_wynik[v_poz] := v_d;
    ELSE
      v_reszta := v_reszta || v_d;
    END IF;
  END LOOP;
  FOR i IN 1 .. v_n LOOP
    IF v_wynik[i] IS NULL THEN
      v_wynik[i] := v_reszta[j];
      j := j + 1;
    END IF;
  END LOOP;

  -- 179: kolejność wybrana przez organizatora przy GRUPIE wygrywa z liczoną.
  -- Drużyny z listy (o ile grają w tej grupie) idą pierwsze, w jej
  -- kolejności; reszta za nimi, w kolejności liczonej.
  SELECT g.kolejnosc_reczna INTO v_reczna FROM turniej_grupy g WHERE g.id = p_grupa;
  IF v_reczna IS NOT NULL AND array_length(v_reczna, 1) > 0 THEN
    v_wynik := ARRAY(SELECT x FROM unnest(v_reczna) WITH ORDINALITY u(x, n) WHERE x = ANY(v_wynik) ORDER BY n)
            || ARRAY(SELECT x FROM unnest(v_wynik) WITH ORDINALITY u(x, n) WHERE NOT (x = ANY(v_reczna)) ORDER BY n);
  END IF;
  RETURN v_wynik;
END $$;


GRANT EXECUTE ON FUNCTION kolejnosc_w_grupie(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION przelicz_grupe_po_kolejnosci()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.kolejnosc_reczna IS DISTINCT FROM NEW.kolejnosc_reczna THEN
    PERFORM wypelnij_z_grupy(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_przelicz_grupe_po_kolejnosci ON turniej_grupy;
CREATE TRIGGER trg_przelicz_grupe_po_kolejnosci AFTER UPDATE OF kolejnosc_reczna ON turniej_grupy
  FOR EACH ROW EXECUTE FUNCTION przelicz_grupe_po_kolejnosci();
