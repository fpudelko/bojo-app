-- ============================================================================
-- 187_turniej_wycofanie_i_nazwa_druzyny.sql — kapitan nie wycofuje drużyny
-- sam, a nazwę zmienia tylko do momentu ustalonego przez organizatora.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Uwagi właściciela z 2026-11-25: „za łatwo można wycofać drużynę”
-- i „zmiana nazwy drużyny nie powinna być możliwa po jakimś momencie”.
-- Do tego przycisk „Wycofaj drużynę” u kapitana NIC nie robił: kasowanie
-- drużyny przepuszcza tylko `czy_zarzadza_druzynami()` (145), więc DELETE
-- kapitana dotykał zera wierszy, a aplikacja i tak pokazywała „Drużyna
-- wycofana”.
--
-- 1. `turnieje.kapitan_zmienia_nazwe`: 'do_zamkniecia_zapisow' (domyślnie),
--    'zawsze' albo 'nigdy'. Pilnuje tego wyzwalacz, nie interfejs: kapitan,
--    który nie zarządza turniejem, dostaje błąd przy zmianie nazwy po czasie.
-- 2. Prośba 'wycofanie' w `turniej_prosby` (186): kapitan prosi, organizator
--    decyduje; po przyjęciu drużyna dostaje status 'wycofana' (nie znika,
--    zostaje w historii terminarza).
--
-- Same dokładające zmiany (CHECK poszerzony, nie zawężony), automatem.
-- ============================================================================

ALTER TABLE turnieje ADD COLUMN IF NOT EXISTS kapitan_zmienia_nazwe text NOT NULL DEFAULT 'do_zamkniecia_zapisow';
DO $$ BEGIN
  ALTER TABLE turnieje ADD CONSTRAINT turnieje_kapitan_zmienia_nazwe_check
    CHECK (kapitan_zmienia_nazwe IN ('do_zamkniecia_zapisow', 'zawsze', 'nigdy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION pilnuj_nazwy_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t turnieje%ROWTYPE;
BEGIN
  IF NEW.nazwa IS NOT DISTINCT FROM OLD.nazwa OR auth.uid() IS NULL
     OR czy_zarzadza_druzynami(NEW.turniej_id) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_t FROM turnieje t WHERE t.id = NEW.turniej_id;
  IF v_t.kapitan_zmienia_nazwe = 'nigdy'
     OR (v_t.kapitan_zmienia_nazwe = 'do_zamkniecia_zapisow' AND v_t.status NOT IN ('szkic', 'zapisy')) THEN
    RAISE EXCEPTION 'Nazwy drużyny nie da się już zmienić. Napisz do organizatora turnieju.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pilnuj_nazwy_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_pilnuj_nazwy_druzyny BEFORE UPDATE OF nazwa ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION pilnuj_nazwy_druzyny();

-- Prośba o wycofanie: poszerzenie listy typów z 186.
ALTER TABLE turniej_prosby DROP CONSTRAINT IF EXISTS turniej_prosby_typ_check;
ALTER TABLE turniej_prosby ADD CONSTRAINT turniej_prosby_typ_check
  CHECK (typ IN ('dolaczenie', 'to_ja', 'kapitan', 'wycofanie'));

CREATE OR REPLACE FUNCTION zloz_prosbe_do_druzyny(
  p_druzyna uuid, p_typ text, p_zawodnik uuid DEFAULT NULL, p_imie text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna turniej_druzyny%ROWTYPE;
  v_turniej turnieje%ROWTYPE;
  v_inna    turniej_druzyny%ROWTYPE;
  v_id      uuid;
  v_kto     text;
  v_odbiorca uuid;
  v_tytul   text;
  v_tresc   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby wysłać prośbę.';
  END IF;
  IF p_typ NOT IN ('dolaczenie', 'to_ja', 'kapitan', 'wycofanie') THEN
    RAISE EXCEPTION 'Nieznany rodzaj prośby: %.', p_typ;
  END IF;

  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = p_druzyna;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono drużyny.'; END IF;
  SELECT * INTO v_turniej FROM turnieje t WHERE t.id = v_druzyna.turniej_id;
  IF v_turniej.status IN ('zakonczony', 'odwolany') THEN
    RAISE EXCEPTION 'Ten turniej jest już zamknięty.';
  END IF;
  IF v_druzyna.status IN ('odrzucona', 'wycofana') THEN
    RAISE EXCEPTION 'Ta drużyna nie bierze udziału w turnieju.';
  END IF;

  -- 187: prośbę o wycofanie składa wyłącznie kapitan tej drużyny, do
  -- organizatora. Kapitan nie wycofuje drużyny sam.
  IF p_typ = 'wycofanie' THEN
    IF v_druzyna.kapitan_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'O wycofanie drużyny prosi jej kapitan.';
    END IF;
  ELSE
  -- Jedna drużyna na osobę w turnieju (jak `dolacz_do_druzyny_kodem`, 172).
  SELECT d.* INTO v_inna
    FROM turniej_zawodnicy z JOIN turniej_druzyny d ON d.id = z.druzyna_id
   WHERE z.turniej_id = v_turniej.id AND z.user_id = auth.uid();
  IF FOUND AND (p_typ <> 'kapitan' OR v_inna.id <> v_druzyna.id) THEN
    IF v_inna.id = v_druzyna.id THEN
      RAISE EXCEPTION 'Już grasz w tej drużynie.';
    END IF;
    RAISE EXCEPTION 'Grasz już w tym turnieju w drużynie %.', v_inna.nazwa;
  END IF;

  IF p_typ = 'to_ja' AND NOT EXISTS (
    SELECT 1 FROM turniej_zawodnicy z
     WHERE z.id = p_zawodnik AND z.druzyna_id = v_druzyna.id AND z.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'To miejsce w składzie jest już przypisane do konta.';
  END IF;
  IF p_typ = 'kapitan' AND v_druzyna.kapitan_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ta drużyna ma już kapitana.';
  END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM turniej_prosby p
              WHERE p.druzyna_id = v_druzyna.id AND p.user_id = auth.uid()
                AND p.typ = p_typ AND p.status = 'czeka') THEN
    RAISE EXCEPTION 'Twoja prośba już czeka na decyzję.';
  END IF;

  INSERT INTO turniej_prosby (turniej_id, druzyna_id, user_id, typ, zawodnik_id, imie)
  VALUES (v_turniej.id, v_druzyna.id, auth.uid(), p_typ,
          CASE WHEN p_typ = 'to_ja' THEN p_zawodnik END,
          NULLIF(left(btrim(coalesce(p_imie, '')), 60), ''))
  RETURNING id INTO v_id;

  -- Powiadomienie: kapitan, a bez kapitana (i zawsze przy 'kapitan')
  -- organizator.
  SELECT coalesce(NULLIF(btrim(p.display_name), ''), 'Gracz') INTO v_kto
    FROM profiles p WHERE p.id = auth.uid();
  v_kto := coalesce(v_kto, 'Gracz');
  v_odbiorca := CASE WHEN p_typ IN ('kapitan', 'wycofanie') OR v_druzyna.kapitan_id IS NULL
                     THEN v_turniej.organizator_id ELSE v_druzyna.kapitan_id END;
  v_tytul := CASE p_typ
    WHEN 'dolaczenie' THEN v_kto || ' chce dołączyć do drużyny'
    WHEN 'to_ja' THEN v_kto || ' mówi, że jest w składzie'
    WHEN 'wycofanie' THEN 'Kapitan prosi o wycofanie drużyny ' || v_druzyna.nazwa
    ELSE v_kto || ' chce być kapitanem' END;
  v_tresc := CASE p_typ
    WHEN 'to_ja' THEN v_druzyna.nazwa || ': „' || (SELECT z.imie FROM turniej_zawodnicy z WHERE z.id = p_zawodnik) || '” to ' || v_kto || '?'
    ELSE v_druzyna.nazwa || ' · ' || v_turniej.nazwa END;
  IF v_odbiorca IS NOT NULL AND v_odbiorca <> auth.uid() THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_odbiorca, 'turniej_prosba_do_druzyny', v_tytul, v_tresc, v_turniej.id);
  END IF;

  RETURN v_id;
END $$;


CREATE OR REPLACE FUNCTION rozpatrz_prosbe_do_druzyny(p_prosba uuid, p_przyjmij boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p       turniej_prosby%ROWTYPE;
  v_druzyna turniej_druzyny%ROWTYPE;
  v_turniej turnieje%ROWTYPE;
  v_ile     int;
  v_imie    text;
  v_zawodnik uuid;
  v_zmienione int;
BEGIN
  SELECT * INTO v_p FROM turniej_prosby p WHERE p.id = p_prosba FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono prośby.'; END IF;
  IF v_p.status <> 'czeka' THEN RAISE EXCEPTION 'Ta prośba jest już rozpatrzona.'; END IF;

  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = v_p.druzyna_id;
  SELECT * INTO v_turniej FROM turnieje t WHERE t.id = v_p.turniej_id;

  IF v_p.typ IN ('kapitan', 'wycofanie') THEN
    IF NOT czy_zarzadza_druzynami(v_p.turniej_id) THEN
      RAISE EXCEPTION 'O kapitanie i wycofaniu drużyny decyduje organizator turnieju.';
    END IF;
  ELSIF NOT czy_kapitan_druzyny(v_p.druzyna_id) THEN
    RAISE EXCEPTION 'Prośbę rozpatruje kapitan drużyny albo organizator.';
  END IF;

  IF p_przyjmij AND v_p.typ = 'wycofanie' THEN
    UPDATE turniej_druzyny d SET status = 'wycofana' WHERE d.id = v_p.druzyna_id;
  ELSIF p_przyjmij THEN
    -- Gracz w międzyczasie dołączył gdzie indziej? Wtedy nie dublujemy.
    IF EXISTS (SELECT 1 FROM turniej_zawodnicy z
                WHERE z.turniej_id = v_p.turniej_id AND z.user_id = v_p.user_id
                  AND z.druzyna_id <> v_p.druzyna_id) THEN
      RAISE EXCEPTION 'Ta osoba gra już w innej drużynie tego turnieju.';
    END IF;

    SELECT z.id INTO v_zawodnik FROM turniej_zawodnicy z
     WHERE z.druzyna_id = v_p.druzyna_id AND z.user_id = v_p.user_id;

    IF v_zawodnik IS NULL AND v_p.typ = 'to_ja' THEN
      UPDATE turniej_zawodnicy z SET user_id = v_p.user_id
       WHERE z.id = v_p.zawodnik_id AND z.user_id IS NULL
       RETURNING z.id INTO v_zawodnik;
      IF v_zawodnik IS NULL THEN
        RAISE EXCEPTION 'To miejsce w składzie jest już przypisane do konta.';
      END IF;
    ELSIF v_zawodnik IS NULL THEN
      SELECT count(*) INTO v_ile FROM turniej_zawodnicy z WHERE z.druzyna_id = v_p.druzyna_id;
      IF v_ile >= v_turniej.max_zawodnikow THEN
        RAISE EXCEPTION 'Skład jest pełny (% osób).', v_turniej.max_zawodnikow;
      END IF;
      v_imie := v_p.imie;
      IF v_imie IS NULL THEN
        SELECT coalesce(NULLIF(btrim(p.display_name), ''), 'Zawodnik') INTO v_imie
          FROM profiles p WHERE p.id = v_p.user_id;
      END IF;
      INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie)
      VALUES (v_p.druzyna_id, v_p.turniej_id, v_p.user_id, left(coalesce(v_imie, 'Zawodnik'), 60))
      RETURNING id INTO v_zawodnik;
    END IF;

    IF v_p.typ = 'kapitan' THEN
      IF v_druzyna.kapitan_id IS NOT NULL AND v_druzyna.kapitan_id <> v_p.user_id THEN
        RAISE EXCEPTION 'Ta drużyna ma już kapitana.';
      END IF;
      UPDATE turniej_zawodnicy z SET kapitan = (z.id = v_zawodnik)
       WHERE z.druzyna_id = v_p.druzyna_id AND z.kapitan IS DISTINCT FROM (z.id = v_zawodnik);
      UPDATE turniej_druzyny d SET kapitan_id = v_p.user_id WHERE d.id = v_p.druzyna_id;
    END IF;
  END IF;

  UPDATE turniej_prosby p
     SET status = CASE WHEN p_przyjmij THEN 'przyjeta' ELSE 'odrzucona' END,
         rozpatrzona_at = now(), rozpatrzyl = auth.uid()
   WHERE p.id = p_prosba;
  GET DIAGNOSTICS v_zmienione = ROW_COUNT;

  -- Pozostałe czekające prośby tej osoby w tym turnieju tracą sens po
  -- przyjęciu (jedna drużyna na osobę), poza prośbą o kapitana tej drużyny.
  IF p_przyjmij AND v_p.typ <> 'wycofanie' THEN
    UPDATE turniej_prosby p SET status = 'odrzucona', rozpatrzona_at = now(), rozpatrzyl = auth.uid()
     WHERE p.turniej_id = v_p.turniej_id AND p.user_id = v_p.user_id AND p.status = 'czeka'
       AND p.druzyna_id <> v_p.druzyna_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  VALUES (v_p.user_id, 'turniej_prosba_rozpatrzona',
          CASE WHEN p_przyjmij THEN
            CASE v_p.typ WHEN 'kapitan' THEN 'Jesteś kapitanem drużyny ' || v_druzyna.nazwa
                         WHEN 'wycofanie' THEN 'Drużyna ' || v_druzyna.nazwa || ' wycofana z turnieju'
                         ELSE 'Jesteś w składzie drużyny ' || v_druzyna.nazwa END
          ELSE 'Prośba do drużyny ' || v_druzyna.nazwa || ' nie została przyjęta' END,
          v_turniej.nazwa, v_p.turniej_id);
END $$;

