-- ============================================================================
-- 155_turniej_nastepny_mecz.sql — „Wasz mecz jest następny" oraz walkower
-- wpisywany przez prowadzącego.
-- ----------------------------------------------------------------------------
-- POWIADOMIENIE. Plan modułu (docs/turnieje-plan-duze-klocki.md §12) nazwał ten
-- typ najlepszym w całym module i jako jedyny z dziewięciu nie powstał. Rzecz
-- polega na tym, że NIE POTRZEBUJE ANI CRONA, ANI ZEGARA: moment, w którym
-- wiadomo, że jakaś drużyna gra za chwilę, to moment zakończenia poprzedniego
-- meczu na tej samej arenie. Czyli zwykły wyzwalacz.
--
-- Trzy warunki, bez których to powiadomienie szkodzi zamiast pomagać:
--   1. tylko gdy turniej NAPRAWDĘ trwa (`turnieje.status = 'trwa'`) — inaczej
--      poprawka wyniku wpisana tydzień później budzi pół listy kontaktów,
--   2. tylko gdy następny mecz jest DZIŚ — turniej weekendowy nie ma budzić
--      w sobotę wieczorem drużyny grającej w niedzielę rano,
--   3. tylko do zawodników Z KONTEM w obu drużynach tego meczu; gdy któraś
--      drużyna jest jeszcze nieznana (slot drabinki czeka na zwycięzcę),
--      powiadamiamy tę, która jest znana — „gracie następni" jest prawdziwe
--      także wtedy, gdy nie wiadomo jeszcze z kim.
--
-- Dlaczego AFTER UPDATE na `turniej_mecze`, a nie w `zakoncz_mecz()`: mecz
-- kończy się TAKŻE walkowerem (poniżej) i ręczną poprawką organizatora
-- w panelu. Wyzwalacz łapie wszystkie trzy drogi, funkcja RPC złapałaby jedną.
--
-- WALKOWER. `turniej_mecze.status = 'walkower'` istnieje od migracji `146`
-- i jest poprawnie liczony przez tabelę, ale wpisywał go wyłącznie generator
-- terminarza przy wolnych losach. Prowadzący na boisku, któremu drużyna nie
-- dojechała — przypadek z KAŻDEGO turnieju amatorskiego — nie miał jak go
-- zapisać. RPC domyka tę drogę tym samym sprawdzeniem uprawnień co
-- `zakoncz_mecz()` i tą samą propagacją zwycięzcy w drabince.
--
-- Migracja jest idempotentna.
-- ============================================================================

-- ── 1. Walkower z konsoli prowadzącego ──────────────────────────────────────

CREATE OR REPLACE FUNCTION walkower_meczu(p_mecz uuid, p_zwyciezca uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mecz turniej_mecze%ROWTYPE;
BEGIN
  IF NOT czy_prowadzi_mecz(p_mecz) THEN
    RAISE EXCEPTION 'Brak uprawnień do tego meczu.';
  END IF;

  SELECT * INTO v_mecz FROM turniej_mecze WHERE id = p_mecz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu.';
  END IF;
  IF v_mecz.status NOT IN ('zaplanowany','trwa') THEN
    RAISE EXCEPTION 'Ten mecz jest już rozstrzygnięty.';
  END IF;
  IF p_zwyciezca IS NULL
     OR p_zwyciezca NOT IN (COALESCE(v_mecz.druzyna_a_id, '00000000-0000-0000-0000-000000000000'::uuid),
                            COALESCE(v_mecz.druzyna_b_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'Walkower musi wskazywać jedną z drużyn tego meczu.';
  END IF;

  -- Wynik zostaje 0:0, a zwycięzcę niesie `zwyciezca_id` — dokładnie tak, jak
  -- robi to generator przy wolnym losie, i tak samo czyta to `obliczTabele()`
  -- (`lib/turniejTabela.ts`: walkower to wygrana bez bramek).
  UPDATE turniej_mecze SET
    status        = 'walkower',
    walkower_dla  = p_zwyciezca,
    zwyciezca_id  = p_zwyciezca,
    zakonczony_at = now()
   WHERE id = p_mecz;
END $$;

GRANT EXECUTE ON FUNCTION walkower_meczu(uuid, uuid) TO authenticated;

-- ── 2. „Wasz mecz jest następny" ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION powiadom_o_nastepnym_meczu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_turniej  turnieje%ROWTYPE;
  v_nastepny turniej_mecze%ROWTYPE;
  v_arena    text;
  v_kiedy    text;
  v_rywal_a  text;
  v_rywal_b  text;
BEGIN
  -- Tylko realne przejście do stanu rozstrzygniętego. Powtórny zapis tego
  -- samego statusu (poprawka wyniku, dopisanie MVP) nie budzi nikogo.
  IF NEW.status NOT IN ('zakonczony','walkower') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.arena_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_turniej FROM turnieje WHERE id = NEW.turniej_id;
  IF v_turniej.status <> 'trwa' THEN
    RETURN NEW;
  END IF;

  -- Następny w kolejce NA TEJ ARENIE. Kolejność jak na terminarzu: najpierw
  -- godzina, a gdy jej nie ma (mecz drabinki bez przypisanego slotu) — numer.
  SELECT * INTO v_nastepny
    FROM turniej_mecze m
   WHERE m.arena_id = NEW.arena_id
     AND m.id <> NEW.id
     AND m.status = 'zaplanowany'
   ORDER BY m.zaplanowany_at NULLS LAST, m.numer
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Turniej weekendowy: nie budzimy w sobotę drużyny grającej w niedzielę.
  IF v_nastepny.zaplanowany_at IS NOT NULL
     AND v_nastepny.zaplanowany_at::date <> CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  SELECT nazwa INTO v_arena FROM turniej_areny WHERE id = NEW.arena_id;
  v_kiedy := CASE
    WHEN v_nastepny.zaplanowany_at IS NULL THEN 'zaraz'
    ELSE 'ok. ' || to_char(v_nastepny.zaplanowany_at, 'HH24:MI')
  END;

  SELECT nazwa INTO v_rywal_a FROM turniej_druzyny WHERE id = v_nastepny.druzyna_a_id;
  SELECT nazwa INTO v_rywal_b FROM turniej_druzyny WHERE id = v_nastepny.druzyna_b_id;

  -- Każdy zawodnik z kontem w którejkolwiek z dwóch drużyn. `DISTINCT`, bo
  -- teoretycznie ta sama osoba mogłaby mieć dwa wpisy — indeks tego pilnuje,
  -- ale powiadomienie nie jest miejscem, w którym warto na to liczyć.
  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  SELECT DISTINCT z.user_id,
         'turniej_nastepny_mecz',
         'Wasz mecz jest następny',
         COALESCE(v_arena, 'Boisko') || ', ' || v_kiedy
           || CASE
                WHEN z.druzyna_id = v_nastepny.druzyna_a_id AND v_rywal_b IS NOT NULL
                  THEN ', z ' || v_rywal_b
                WHEN z.druzyna_id = v_nastepny.druzyna_b_id AND v_rywal_a IS NOT NULL
                  THEN ', z ' || v_rywal_a
                ELSE ''
              END,
         NEW.turniej_id
    FROM turniej_zawodnicy z
   WHERE z.user_id IS NOT NULL
     AND z.druzyna_id IN (v_nastepny.druzyna_a_id, v_nastepny.druzyna_b_id);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nastepny_mecz ON turniej_mecze;
CREATE TRIGGER trg_nastepny_mecz AFTER UPDATE OF status ON turniej_mecze
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_nastepnym_meczu();
