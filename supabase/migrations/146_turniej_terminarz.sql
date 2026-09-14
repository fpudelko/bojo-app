-- ============================================================================
-- 146_turniej_terminarz.sql — moduł turniejowy, część 2: grupy, areny, mecze
-- ----------------------------------------------------------------------------
-- PO CO. Fundament (145) dał turniej, drużyny i skład. Ta migracja dokłada to,
-- co czyni z listy drużyn realny plan dnia: grupy do losowania, areny (boiska
-- turnieju — jeden turniej gra zwykle na 2-3 naraz) i mecze z terminarzem.
-- Generator terminarza (rozlosowanie grup, karuzela „każdy z każdym", drabinka
-- pucharowa, rozkład na areny i godziny) to CZYSTE funkcje w
-- `frontend/src/lib/turniejFormat.ts` — baza wyłącznie PRZYJMUJE gotowy plan
-- (`zapisz_terminarz`) i pilnuje jego integralności.
--
-- DLACZEGO KLIENT GENERUJE UUID-y MECZÓW. Mecze w drabince odwołują się do
-- SIEBIE NAWZAJEM (`zrodlo_a_mecz_id` — „zwycięzca meczu M9") jeszcze zanim
-- którykolwiek z nich istnieje w bazie. Jedno wielorzędowe `INSERT ... SELECT
-- FROM jsonb_array_elements()` z identyfikatorami nadanymi PRZEZ PRZEGLĄDARKĘ
-- (`crypto.randomUUID()`) rozwiązuje to bez dwóch przebiegów: PostgreSQL
-- sprawdza klucze obce dopiero PO zakończeniu całego INSERT-u, więc wzajemne
-- odwołania w jednej partii są poprawne.
--
-- WOLNE LOSY (drabinka niebędąca potęgą dwójki) WCHODZĄ OD RAZU JAKO
-- `walkower` (nie `zakonczony` — mecz nigdy się nie odbył, drużyna awansuje
-- bez gry, do tego służy kolumna `walkower_dla`). Wyzwalacz `propaguj_zwyciezce`
-- słucha UPDATE, nie INSERT, więc
-- nie odpaliłby się dla nich sam — `zapisz_terminarz()` na końcu woła wprost
-- `propaguj_zwyciezce_dla()` (tę samą funkcję, którą w locie wywołuje
-- wyzwalacz) dla każdego świeżo wstawionego meczu o statusie innym niż
-- `zaplanowany`. Wolne losy istnieją WYŁĄCZNIE w pierwszej rundzie drabinki,
-- więc jeden przebieg wystarcza — nie ma kaskady głębszej niż jeden poziom.
-- ============================================================================

-- ── 1. Grupy fazy grupowej ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_grupy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id    uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  nazwa         text NOT NULL,                 -- 'A', 'B', 'C', …
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turniej_id, nazwa)
);

ALTER TABLE turniej_druzyny DROP CONSTRAINT IF EXISTS fk_druzyna_grupa;
ALTER TABLE turniej_druzyny ADD CONSTRAINT fk_druzyna_grupa
  FOREIGN KEY (grupa_id) REFERENCES turniej_grupy(id) ON DELETE SET NULL;

ALTER TABLE turniej_grupy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Grupy turnieju czyta kazdy" ON turniej_grupy;
CREATE POLICY "Grupy turnieju czyta kazdy" ON turniej_grupy FOR SELECT USING (true);
DROP POLICY IF EXISTS "Grupy turnieju zarzadza organizator" ON turniej_grupy;
CREATE POLICY "Grupy turnieju zarzadza organizator" ON turniej_grupy FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));


-- ── 2. Areny (boiska turnieju) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_areny (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id    uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  nazwa         text NOT NULL CHECK (char_length(nazwa) BETWEEN 1 AND 40),
  field_id      uuid REFERENCES fields(id) ON DELETE SET NULL,
  kolejnosc     int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turniej_id, nazwa)
);

ALTER TABLE turniej_areny ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Areny turnieju czyta kazdy" ON turniej_areny;
CREATE POLICY "Areny turnieju czyta kazdy" ON turniej_areny FOR SELECT USING (true);
DROP POLICY IF EXISTS "Areny turnieju zarzadza organizator" ON turniej_areny;
CREATE POLICY "Areny turnieju zarzadza organizator" ON turniej_areny FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));

-- Turniej bez ani jednej areny nie ma jak dostać terminarza — kreator (Etap 0)
-- o nie pyta, więc każdy nowy turniej dostaje jedną domyślną, którą organizator
-- może potem przemianować albo dołożyć kolejne w panelu.
CREATE OR REPLACE FUNCTION utworz_domyslna_arene()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO turniej_areny (turniej_id, nazwa, kolejnosc) VALUES (NEW.id, 'Boisko 1', 1);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_domyslna_arena ON turnieje;
CREATE TRIGGER trg_domyslna_arena AFTER INSERT ON turnieje
  FOR EACH ROW EXECUTE FUNCTION utworz_domyslna_arene();


-- ── 3. Mecze (faza grupowa, liga, drabinka pucharowa) ───────────────────────

CREATE TABLE IF NOT EXISTS turniej_mecze (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id         uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  numer              int NOT NULL,             -- „M12" na terminarzu, kolejność w turnieju
  faza               text NOT NULL DEFAULT 'grupa'
                       -- `1/32` domyka drabinkę dla górnej granicy `max_druzyn` (64,
                       -- migracja 145) — bez niej 6-rundowa drabinka nie miałaby nazwy
                       -- dla swojej pierwszej rundy.
                       CHECK (faza IN ('grupa','liga','1/32','1/16','1/8','cwierc',
                                       'polfinal','o_3_miejsce','final')),
  grupa_id           uuid REFERENCES turniej_grupy(id) ON DELETE CASCADE,
  kolejka            int,
  pozycja_w_drabince int,

  druzyna_a_id       uuid REFERENCES turniej_druzyny(id) ON DELETE SET NULL,
  druzyna_b_id       uuid REFERENCES turniej_druzyny(id) ON DELETE SET NULL,
  -- W drabince: z którego meczu „spływa" drużyna do tego slotu, i czy to
  -- zwycięzca czy przegrany źródłowego meczu (mecz o 3. miejsce bierze
  -- przegranych z półfinałów).
  zrodlo_a_mecz_id   uuid REFERENCES turniej_mecze(id) ON DELETE SET NULL,
  zrodlo_b_mecz_id   uuid REFERENCES turniej_mecze(id) ON DELETE SET NULL,
  zrodlo_a_typ       text CHECK (zrodlo_a_typ IN ('zwyciezca','przegrany')),
  zrodlo_b_typ       text CHECK (zrodlo_b_typ IN ('zwyciezca','przegrany')),

  arena_id           uuid REFERENCES turniej_areny(id) ON DELETE SET NULL,
  zaplanowany_at     timestamptz,
  prowadzacy_id      uuid REFERENCES auth.users ON DELETE SET NULL,

  status             text NOT NULL DEFAULT 'zaplanowany'
                       CHECK (status IN ('zaplanowany','trwa','zakonczony',
                                         'walkower','odwolany')),
  rozpoczety_at      timestamptz,
  zakonczony_at      timestamptz,
  wynik_a            int NOT NULL DEFAULT 0,
  wynik_b            int NOT NULL DEFAULT 0,
  sety               jsonb,                    -- [{a:21,b:18},…] — siatkówka
  karne_a            int,
  karne_b            int,
  wynik_recznie      boolean NOT NULL DEFAULT false,
  walkower_dla       uuid REFERENCES turniej_druzyny(id) ON DELETE SET NULL,
  zwyciezca_id       uuid REFERENCES turniej_druzyny(id) ON DELETE SET NULL,
  mvp_zawodnik_id    uuid REFERENCES turniej_zawodnicy(id) ON DELETE SET NULL,
  notatka            text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT turniej_mecze_rozne_druzyny
    CHECK (druzyna_a_id IS NULL OR druzyna_b_id IS NULL OR druzyna_a_id <> druzyna_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mecz_numer_w_turnieju ON turniej_mecze(turniej_id, numer);
CREATE INDEX IF NOT EXISTS idx_mecze_turniej ON turniej_mecze(turniej_id);
CREATE INDEX IF NOT EXISTS idx_mecze_grupa   ON turniej_mecze(grupa_id);
CREATE INDEX IF NOT EXISTS idx_mecze_druzyna_a ON turniej_mecze(druzyna_a_id);
CREATE INDEX IF NOT EXISTS idx_mecze_druzyna_b ON turniej_mecze(druzyna_b_id);
CREATE INDEX IF NOT EXISTS idx_mecze_zrodlo_a ON turniej_mecze(zrodlo_a_mecz_id);
CREATE INDEX IF NOT EXISTS idx_mecze_zrodlo_b ON turniej_mecze(zrodlo_b_mecz_id);

DROP TRIGGER IF EXISTS trg_mecze_updated ON turniej_mecze;
CREATE TRIGGER trg_mecze_updated BEFORE UPDATE ON turniej_mecze
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ── 4. Kto prowadzi mecz — funkcja pomocnicza do polityk ────────────────────
-- Trzecia droga (obok organizatora i `moze_prowadzic` ogólnego) jest CELOWO
-- najwęższa: `prowadzacy_id` wpisany wprost na TYM JEDNYM meczu, bez żadnego
-- uprawnienia w `turniej_osoby`. Organizator turnieju na kilku boiskach naraz
-- oddaje telefon koledze na czas jednego meczu, nie na cały turniej.

CREATE OR REPLACE FUNCTION czy_prowadzi_mecz(p_mecz uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM turniej_mecze m
    WHERE m.id = p_mecz
      AND (
        czy_zarzadza_turniejem(m.turniej_id)
        OR m.prowadzacy_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM turniej_osoby o
          WHERE o.turniej_id = m.turniej_id AND o.user_id = auth.uid() AND o.moze_prowadzic
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION czy_prowadzi_mecz(uuid) TO anon, authenticated;

ALTER TABLE turniej_mecze ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mecze turnieju czyta kazdy" ON turniej_mecze;
CREATE POLICY "Mecze turnieju czyta kazdy" ON turniej_mecze FOR SELECT USING (true);
DROP POLICY IF EXISTS "Mecze wstawia i kasuje zarzadzajacy" ON turniej_mecze;
CREATE POLICY "Mecze wstawia i kasuje zarzadzajacy" ON turniej_mecze FOR INSERT
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));
DROP POLICY IF EXISTS "Mecze kasuje zarzadzajacy" ON turniej_mecze;
CREATE POLICY "Mecze kasuje zarzadzajacy" ON turniej_mecze FOR DELETE
  USING (czy_zarzadza_turniejem(turniej_id));
DROP POLICY IF EXISTS "Mecz aktualizuje kto go prowadzi" ON turniej_mecze;
CREATE POLICY "Mecz aktualizuje kto go prowadzi" ON turniej_mecze FOR UPDATE
  USING      (czy_prowadzi_mecz(id))
  WITH CHECK (czy_prowadzi_mecz(id));


-- ── 5. Propagacja zwycięzcy w drabince ───────────────────────────────────────
-- Wyzwalacz, nie kod w przeglądarce: prowadzący kończy mecz na boisku, przy
-- słabym zasięgu, i jeśli drugi zapis (z klienta) nie przejdzie, kolejna runda
-- zostaje bez drużyny — i nikt tego nie zauważy do momentu, w którym trzeba ją
-- rozegrać.
--
-- Sama praca siedzi w osobnej funkcji (nie tylko w treści wyzwalacza), bo
-- potrzebuje jej też `zapisz_terminarz()` dla wolnych losów wstawianych OD RAZU
-- jako `walkower` — tam nie ma żadnej realnej ZMIANY (OLD i NEW byłyby
-- identyczne przy udawanym „dotknięciu"), więc wyzwalacz UPDATE nigdy by się
-- nie odpalił z realną pracą do zrobienia.

CREATE OR REPLACE FUNCTION propaguj_zwyciezce_dla(p_mecz uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_zwyciezca uuid;
  v_druzyna_a uuid;
  v_druzyna_b uuid;
  v_przegrany uuid;
BEGIN
  SELECT zwyciezca_id, druzyna_a_id, druzyna_b_id INTO v_zwyciezca, v_druzyna_a, v_druzyna_b
    FROM turniej_mecze WHERE id = p_mecz;
  IF v_zwyciezca IS NULL THEN RETURN; END IF;   -- remis bez karnych — jeszcze nierozstrzygnięty

  v_przegrany := CASE WHEN v_zwyciezca = v_druzyna_a THEN v_druzyna_b ELSE v_druzyna_a END;

  UPDATE turniej_mecze SET druzyna_a_id = v_zwyciezca
   WHERE zrodlo_a_mecz_id = p_mecz AND zrodlo_a_typ = 'zwyciezca';
  UPDATE turniej_mecze SET druzyna_b_id = v_zwyciezca
   WHERE zrodlo_b_mecz_id = p_mecz AND zrodlo_b_typ = 'zwyciezca';
  IF v_przegrany IS NOT NULL THEN
    UPDATE turniej_mecze SET druzyna_a_id = v_przegrany
     WHERE zrodlo_a_mecz_id = p_mecz AND zrodlo_a_typ = 'przegrany';
    UPDATE turniej_mecze SET druzyna_b_id = v_przegrany
     WHERE zrodlo_b_mecz_id = p_mecz AND zrodlo_b_typ = 'przegrany';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION propaguj_zwyciezce()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('zakonczony','walkower') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status AND OLD.zwyciezca_id IS NOT DISTINCT FROM NEW.zwyciezca_id THEN
    RETURN NEW;                        -- „dotknięcie" bez realnej zmiany — nic do zrobienia
  END IF;
  PERFORM propaguj_zwyciezce_dla(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_propaguj_zwyciezce ON turniej_mecze;
CREATE TRIGGER trg_propaguj_zwyciezce AFTER UPDATE ON turniej_mecze
  FOR EACH ROW EXECUTE FUNCTION propaguj_zwyciezce();


-- ── 6. Zapis wygenerowanego terminarza ───────────────────────────────────────
-- Jedna funkcja na cały terminarz, nie mecz po meczu — wielorzędowy INSERT
-- pozwala meczom w tej samej partii odwoływać się do siebie nawzajem
-- (`zrodlo_a_mecz_id`/`zrodlo_b_mecz_id`), patrz nagłówek pliku.

CREATE OR REPLACE FUNCTION zapisz_terminarz(p_turniej uuid, p_mecze jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_niedokonczone int;
  v_wstawiono int;
BEGIN
  IF NOT czy_zarzadza_turniejem(p_turniej) THEN
    RAISE EXCEPTION 'Brak uprawnień do edycji terminarza tego turnieju.';
  END IF;

  -- Terminarz można wygenerować od nowa TYLKO, gdy żaden mecz jeszcze się nie
  -- zaczął — inaczej „Wygeneruj ponownie" skasowałoby rozegrane wyniki.
  SELECT count(*) INTO v_niedokonczone FROM turniej_mecze
   WHERE turniej_id = p_turniej AND status <> 'zaplanowany';
  IF v_niedokonczone > 0 THEN
    RAISE EXCEPTION 'Terminarz ma % nie w pełni zaplanowanych meczów — nie można go nadpisać.', v_niedokonczone;
  END IF;

  DELETE FROM turniej_mecze WHERE turniej_id = p_turniej;

  INSERT INTO turniej_mecze (
    id, turniej_id, numer, faza, grupa_id, kolejka, pozycja_w_drabince,
    druzyna_a_id, druzyna_b_id, zrodlo_a_mecz_id, zrodlo_b_mecz_id,
    zrodlo_a_typ, zrodlo_b_typ, arena_id, zaplanowany_at, status,
    zwyciezca_id, walkower_dla
  )
  SELECT
    (m->>'id')::uuid, p_turniej, (m->>'numer')::int, m->>'faza',
    NULLIF(m->>'grupaId','')::uuid, (m->>'kolejka')::int, (m->>'pozycjaWDrabince')::int,
    NULLIF(m->>'druzynaAId','')::uuid, NULLIF(m->>'druzynaBId','')::uuid,
    NULLIF(m->>'zrodloAMeczId','')::uuid, NULLIF(m->>'zrodloBMeczId','')::uuid,
    NULLIF(m->>'zrodloATyp',''), NULLIF(m->>'zrodloBTyp',''),
    NULLIF(m->>'arenaId','')::uuid, (m->>'zaplanowanyAt')::timestamptz,
    coalesce(NULLIF(m->>'status',''), 'zaplanowany'),
    NULLIF(m->>'zwyciezcaId','')::uuid, NULLIF(m->>'walkowerDla','')::uuid
  FROM jsonb_array_elements(p_mecze) AS m;
  GET DIAGNOSTICS v_wstawiono = ROW_COUNT;

  -- Wolne losy w pierwszej rundzie wchodzą od razu jako `walkower` — wołamy
  -- propagację wprost (nie przez UPDATE-wyzwalacz: między świeżym INSERT-em
  -- a jakimkolwiek „dotknięciem" nie ma żadnej RÓŻNICY, więc wyzwalacz nigdy
  -- by się nie odpalił z realną pracą), żeby drugi poziom drabinki od razu
  -- poznał swoją drużynę.
  PERFORM propaguj_zwyciezce_dla(id) FROM turniej_mecze
   WHERE turniej_id = p_turniej AND status <> 'zaplanowany';

  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  SELECT DISTINCT z.user_id, 'turniej_terminarz_gotowy', 'Terminarz gotowy',
         'Sprawdź, kiedy gracie — ' || t.nazwa, p_turniej
    FROM turniej_zawodnicy z
    JOIN turnieje t ON t.id = p_turniej
   WHERE z.turniej_id = p_turniej AND z.user_id IS NOT NULL;

  RETURN v_wstawiono;
END $$;

GRANT EXECUTE ON FUNCTION zapisz_terminarz(uuid, jsonb) TO authenticated;


-- ── 7. Przesunięcie terminarza — organizator turniej się opóźnia ────────────

CREATE OR REPLACE FUNCTION przesun_terminarz(p_turniej uuid, p_od_meczu uuid, p_minuty int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_od timestamptz;
  v_ile int;
BEGIN
  IF NOT czy_zarzadza_turniejem(p_turniej) THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany terminarza tego turnieju.';
  END IF;

  SELECT zaplanowany_at INTO v_od FROM turniej_mecze
   WHERE id = p_od_meczu AND turniej_id = p_turniej;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu w tym turnieju.';
  END IF;
  -- Osobny komunikat: `v_od IS NULL` przy znalezionym wierszu znaczy co innego
  -- niż brak meczu — mecz istnieje, ale nie ma jeszcze ustalonej godziny,
  -- więc nie ma od czego liczyć przesunięcia.
  IF v_od IS NULL THEN
    RAISE EXCEPTION 'Ten mecz nie ma jeszcze ustalonej godziny — nie da się liczyć przesunięcia od niego.';
  END IF;

  UPDATE turniej_mecze
     SET zaplanowany_at = zaplanowany_at + make_interval(mins => p_minuty)
   WHERE turniej_id = p_turniej AND status = 'zaplanowany' AND zaplanowany_at >= v_od;
  GET DIAGNOSTICS v_ile = ROW_COUNT;

  IF v_ile > 0 THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    SELECT DISTINCT z.user_id, 'turniej_zmiana_terminu', 'Zmiana terminarza',
           format('Terminarz przesunięty o %s min — %s', p_minuty, t.nazwa), p_turniej
      FROM turniej_mecze m
      JOIN turniej_zawodnicy z ON z.druzyna_id IN (m.druzyna_a_id, m.druzyna_b_id)
      JOIN turnieje t ON t.id = p_turniej
     WHERE m.turniej_id = p_turniej AND z.user_id IS NOT NULL
       AND m.zaplanowany_at >= v_od + make_interval(mins => p_minuty);
  END IF;

  RETURN v_ile;
END $$;

GRANT EXECUTE ON FUNCTION przesun_terminarz(uuid, uuid, int) TO authenticated;
