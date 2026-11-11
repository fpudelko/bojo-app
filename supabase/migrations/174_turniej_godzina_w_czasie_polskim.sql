-- ============================================================================
-- 174_turniej_godzina_w_czasie_polskim.sql — powiadomienie „Wasz mecz jest
-- następny" podaje godzinę w czasie POLSKIM.
-- ----------------------------------------------------------------------------
-- DLACZEGO. `turniej_mecze.zaplanowany_at` to `timestamptz`, a sesja bazy
-- Supabase stoi na UTC. `to_char(zaplanowany_at, 'HH24:MI')` dawało więc
-- godzinę UTC: zawodnik meczu o 10:20 w Luboniu dostałby „Boisko 1, ok. 09:20"
-- (latem dwie godziny za wcześnie). Ten sam błąd był we froncie: karty meczów
-- wycinały godzinę z zapisu UTC (`slice(11, 16)`), stąd „start 10:00, pierwszy
-- mecz 09:00" na turnieju pokazowym (audyty 6 i 7, 2026-11-11). Front
-- naprawiony w tym samym PR (`chwilaWPolsce()` w `lib/czasPolski.ts`).
--
-- Przy okazji warunek „tylko gdy następny mecz jest DZIŚ" porównuje daty
-- w Polsce, nie w UTC: mecz o 00:30 w nocy był dla bazy „wczoraj".
--
-- Ciało funkcji przepisane z `155` bez innych zmian. Samo `CREATE OR REPLACE`,
-- idempotentna, bezpieczna dla skanera ryzyka (jedzie automatem).
-- ============================================================================

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
     AND (v_nastepny.zaplanowany_at AT TIME ZONE 'Europe/Warsaw')::date
         <> (now() AT TIME ZONE 'Europe/Warsaw')::date THEN
    RETURN NEW;
  END IF;

  SELECT nazwa INTO v_arena FROM turniej_areny WHERE id = NEW.arena_id;
  v_kiedy := CASE
    WHEN v_nastepny.zaplanowany_at IS NULL THEN 'zaraz'
    ELSE 'ok. ' || to_char(v_nastepny.zaplanowany_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI')
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

