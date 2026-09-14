-- ============================================================================
-- 147_turniej_rozgrywka.sql — moduł turniejowy, część 3: rozgrywka na żywo
-- ----------------------------------------------------------------------------
-- PO CO. Terminarz (146) dał plan dnia. Ta migracja dokłada to, co prowadzący
-- realnie robi na boisku: zapisuje gole/kartki/punkty w trakcie meczu i kończy
-- go wynikiem. Konsola prowadzącego (przeglądarka) to jedyny klient — logika
-- liczenia wyniku i wyznaczania zwycięzcy siedzi w bazie, nie w komponencie,
-- bo dwie ścieżki (RPC i ewentualny przyszły import wyniku) muszą liczyć
-- identycznie.
--
-- SIATKÓWKA/PLAŻÓWKA NIE UŻYWA TEJ TABELI. Tam liczy się WYGRANY SET, nie
-- pojedynczy punkt — dziesiątki punktów meczu zaśmiecałyby `turniej_zdarzenia`
-- bez żadnej korzyści (i tak nie obiecujemy klasyfikacji strzelców dla tych
-- sportów, patrz `docs/turnieje-plan-srednie-klocki.md` §N). Wynik siatkówki
-- (`turniej_mecze.sety` — JSON punktów w każdym secie, `wynik_a`/`wynik_b` —
-- liczba wygranych setów) zapisuje wprost `updateMecz()` z `wynik_recznie = true`.
-- `przelicz_wynik_meczu()` NIGDY nie rusza meczu bez zdarzeń — te dwie ścieżki
-- się nie mieszają.
--
-- SAMOBÓJCZY DOLICZA SIĘ PRZECIWNIKOWI. `druzyna_id` na zdarzeniu to drużyna
-- pechowego zawodnika (żeby dało się pokazać „samobójczy — Jan Kowalski (Drużyna
-- A)"), ale w liczniku wyniku ten gol dopisuje się DRUGIEJ stronie.
-- ============================================================================

-- ── 1. Zdarzenia meczowe ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_zdarzenia (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mecz_id             uuid NOT NULL REFERENCES turniej_mecze ON DELETE CASCADE,
  turniej_id          uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  druzyna_id          uuid NOT NULL REFERENCES turniej_druzyny ON DELETE CASCADE,
  zawodnik_id         uuid REFERENCES turniej_zawodnicy ON DELETE SET NULL,
  asysta_zawodnik_id  uuid REFERENCES turniej_zawodnicy ON DELETE SET NULL,
  typ                 text NOT NULL CHECK (typ IN ('gol','samobojczy','zolta','czerwona','punkty')),
  wartosc             int NOT NULL DEFAULT 1 CHECK (wartosc BETWEEN 1 AND 3),
  minuta              int CHECK (minuta IS NULL OR minuta BETWEEN 0 AND 200),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zdarzenia_mecz ON turniej_zdarzenia(mecz_id);
CREATE INDEX IF NOT EXISTS idx_zdarzenia_zawodnik ON turniej_zdarzenia(zawodnik_id) WHERE zawodnik_id IS NOT NULL;

-- turniej_id ustawia trigger z JEDNEGO źródła prawdy (mecz_id) — ten sam wzorzec
-- co `ustaw_turniej_zawodnika()` (145) dla `turniej_zawodnicy.turniej_id`.
CREATE OR REPLACE FUNCTION ustaw_turniej_zdarzenia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT m.turniej_id INTO NEW.turniej_id FROM turniej_mecze m WHERE m.id = NEW.mecz_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zdarzenia_turniej ON turniej_zdarzenia;
CREATE TRIGGER trg_zdarzenia_turniej BEFORE INSERT ON turniej_zdarzenia
  FOR EACH ROW EXECUTE FUNCTION ustaw_turniej_zdarzenia();

ALTER TABLE turniej_zdarzenia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Zdarzenia czyta kazdy" ON turniej_zdarzenia;
CREATE POLICY "Zdarzenia czyta kazdy" ON turniej_zdarzenia FOR SELECT USING (true);

-- Zdarzenie wolno dopisać/cofnąć TYLKO, gdy mecz jeszcze nie jest rozstrzygnięty —
-- inaczej dopisanie gola PO `zakoncz_mecz()` zmieniłoby wynik bez ponownego
-- wyznaczenia zwycięzcy (ten liczy się raz, w momencie kończenia meczu).
DROP POLICY IF EXISTS "Zdarzenia zarzadza prowadzacy" ON turniej_zdarzenia;
CREATE POLICY "Zdarzenia zarzadza prowadzacy" ON turniej_zdarzenia FOR INSERT
  WITH CHECK (
    czy_prowadzi_mecz(mecz_id)
    AND EXISTS (SELECT 1 FROM turniej_mecze m WHERE m.id = mecz_id AND m.status IN ('zaplanowany','trwa'))
  );
DROP POLICY IF EXISTS "Zdarzenia kasuje prowadzacy" ON turniej_zdarzenia;
CREATE POLICY "Zdarzenia kasuje prowadzacy" ON turniej_zdarzenia FOR DELETE
  USING (
    czy_prowadzi_mecz(mecz_id)
    AND EXISTS (SELECT 1 FROM turniej_mecze m WHERE m.id = mecz_id AND m.status IN ('zaplanowany','trwa'))
  );


-- ── 2. Przeliczenie wyniku ze zdarzeń ────────────────────────────────────────

CREATE OR REPLACE FUNCTION przelicz_wynik_meczu(p_mecz uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_wynik_a int;
  v_wynik_b int;
BEGIN
  SELECT druzyna_a_id, druzyna_b_id INTO v_a, v_b FROM turniej_mecze WHERE id = p_mecz;

  SELECT
    coalesce(sum(CASE
      WHEN typ IN ('gol','punkty') AND druzyna_id = v_a THEN wartosc
      WHEN typ = 'samobojczy'      AND druzyna_id = v_b THEN wartosc
      ELSE 0 END), 0),
    coalesce(sum(CASE
      WHEN typ IN ('gol','punkty') AND druzyna_id = v_b THEN wartosc
      WHEN typ = 'samobojczy'      AND druzyna_id = v_a THEN wartosc
      ELSE 0 END), 0)
    INTO v_wynik_a, v_wynik_b
  FROM turniej_zdarzenia WHERE mecz_id = p_mecz;

  UPDATE turniej_mecze SET wynik_a = v_wynik_a, wynik_b = v_wynik_b, wynik_recznie = false
   WHERE id = p_mecz;
END $$;

CREATE OR REPLACE FUNCTION trg_przelicz_wynik_meczu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM przelicz_wynik_meczu(COALESCE(NEW.mecz_id, OLD.mecz_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_zdarzenia_przelicz ON turniej_zdarzenia;
CREATE TRIGGER trg_zdarzenia_przelicz AFTER INSERT OR DELETE ON turniej_zdarzenia
  FOR EACH ROW EXECUTE FUNCTION trg_przelicz_wynik_meczu();


-- ── 3. Zakończenie meczu ─────────────────────────────────────────────────────
-- Jedna funkcja dla WSZYSTKICH sportów: wynik_a/wynik_b w tym momencie już
-- niesie prawdę (dla piłki/koszykówki — z sumy zdarzeń; dla siatkówki —
-- z liczby wygranych setów, zapisanej wprost przez klienta). Karne mają sens
-- wyłącznie przy remisie w fazie innej niż grupowa/liga — remis w grupie jest
-- normalnym wynikiem, remis w drabince wymaga rozstrzygnięcia, bo inaczej
-- `propaguj_zwyciezce` (146) nie miałby kogo przenieść do kolejnej rundy.

CREATE OR REPLACE FUNCTION zakoncz_mecz(
  p_mecz uuid,
  p_karne_a int DEFAULT NULL,
  p_karne_b int DEFAULT NULL,
  p_mvp_zawodnik_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mecz turniej_mecze%ROWTYPE;
  v_zwyciezca uuid;
BEGIN
  IF NOT czy_prowadzi_mecz(p_mecz) THEN
    RAISE EXCEPTION 'Brak uprawnień do zakończenia tego meczu.';
  END IF;

  SELECT * INTO v_mecz FROM turniej_mecze WHERE id = p_mecz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu.';
  END IF;
  IF v_mecz.status NOT IN ('zaplanowany','trwa') THEN
    RAISE EXCEPTION 'Ten mecz jest już zakończony.';
  END IF;

  IF v_mecz.wynik_a > v_mecz.wynik_b THEN
    v_zwyciezca := v_mecz.druzyna_a_id;
  ELSIF v_mecz.wynik_b > v_mecz.wynik_a THEN
    v_zwyciezca := v_mecz.druzyna_b_id;
  ELSIF p_karne_a IS NOT NULL AND p_karne_b IS NOT NULL AND p_karne_a <> p_karne_b THEN
    v_zwyciezca := CASE WHEN p_karne_a > p_karne_b THEN v_mecz.druzyna_a_id ELSE v_mecz.druzyna_b_id END;
  ELSE
    v_zwyciezca := NULL;  -- remis — dozwolony wyłącznie w grupie/lidze, patrz niżej
  END IF;

  IF v_mecz.faza NOT IN ('grupa','liga') AND v_zwyciezca IS NULL THEN
    RAISE EXCEPTION 'Remis w fazie pucharowej wymaga wyniku rzutów karnych.';
  END IF;

  UPDATE turniej_mecze SET
    status = 'zakonczony',
    zakonczony_at = now(),
    karne_a = p_karne_a,
    karne_b = p_karne_b,
    zwyciezca_id = v_zwyciezca,
    mvp_zawodnik_id = p_mvp_zawodnik_id
   WHERE id = p_mecz;
END $$;

GRANT EXECUTE ON FUNCTION zakoncz_mecz(uuid, int, int, uuid) TO authenticated;
