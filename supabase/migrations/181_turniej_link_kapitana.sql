-- ============================================================================
-- 181_turniej_link_kapitana.sql — jednorazowy link, przez który kapitan
-- przejmuje drużynę wpisaną przez organizatora.
-- ----------------------------------------------------------------------------
-- DLACZEGO. „Gramy dla Marysi” (2026-11-22): organizator wpisał piętnaście
-- drużyn sam i chce rozesłać kapitanom linki, przez które się zalogują
-- i przejmą drużynę. Link drużyny (`/t/<kod>`) celowo NIE nadaje kapitanatu
-- (172): kapitanem zostawał każdy, komu link przesłano dalej. Dlatego osobny
-- link kapitana z trzema bezpiecznikami:
--   1. Kod w OSOBNEJ tabeli, którą czyta tylko zarządzający drużynami.
--      `turniej_druzyny` czyta każdy (145), więc kolumna tam byłaby jawna
--      tak samo jak kod dołączenia.
--   2. Link działa RAZ: po przejęciu kod znika, więc przesłany dalej nie
--      daje już niczego.
--   3. Drużyny, która ma już kapitana, linkiem nie da się przejąć. Zmiana
--      kapitana zostaje przy organizatorze (`ustaw_kapitana_druzyny`, 172).
--
-- Przejęcie = dołączenie do składu tą samą funkcją co link drużyny
-- (`dolacz_do_druzyny_kodem`, z „to ja” dla wpisu z ręki) + ustawienie
-- `kapitan_id` i flagi `turniej_zawodnicy.kapitan` w jednej transakcji.
--
-- Tabela, polityka i funkcje: same dokładające zmiany, automatem
-- (DELETE siedzi wyłącznie w ciele funkcji).
-- ============================================================================

CREATE TABLE IF NOT EXISTS turniej_kody_kapitana (
  druzyna_id  uuid PRIMARY KEY REFERENCES turniej_druzyny(id) ON DELETE CASCADE,
  turniej_id  uuid NOT NULL REFERENCES turnieje(id) ON DELETE CASCADE,
  kod         text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turniej_kody_kapitana ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kody kapitana widzi zarzadzajacy" ON turniej_kody_kapitana;
CREATE POLICY "Kody kapitana widzi zarzadzajacy" ON turniej_kody_kapitana FOR SELECT
  USING (czy_zarzadza_druzynami(turniej_id));
-- Bez polityk INSERT/UPDATE/DELETE: kody nadaje i zużywa wyłącznie funkcja.


-- ── 1. Organizator przygotowuje linki ───────────────────────────────────────
-- Dla każdej drużyny w turnieju BEZ kapitana nadaje kod (albo oddaje już
-- nadany), dla drużyn z kapitanem zwraca NULL i imię kapitana.
CREATE OR REPLACE FUNCTION przygotuj_linki_kapitanow(p_turniej uuid)
RETURNS TABLE (druzyna_id uuid, nazwa text, kod text, kapitan text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record;
  v_kod text;
BEGIN
  IF NOT czy_zarzadza_druzynami(p_turniej) THEN
    RAISE EXCEPTION 'Linki dla kapitanów przygotowuje organizator turnieju.';
  END IF;

  FOR d IN
    SELECT td.id, td.kapitan_id FROM turniej_druzyny td
     WHERE td.turniej_id = p_turniej AND td.status IN ('przyjeta', 'rezerwa', 'zgloszona')
  LOOP
    IF d.kapitan_id IS NULL AND NOT EXISTS (SELECT 1 FROM turniej_kody_kapitana k WHERE k.druzyna_id = d.id) THEN
      LOOP
        v_kod := upper(substr(md5(random()::text || clock_timestamp()::text || d.id::text), 1, 8));
        BEGIN
          INSERT INTO turniej_kody_kapitana (druzyna_id, turniej_id, kod) VALUES (d.id, p_turniej, v_kod);
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          -- Powtórzony kod (prawie niemożliwe): losujemy jeszcze raz.
        END;
      END LOOP;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT td.id, td.nazwa,
           CASE WHEN td.kapitan_id IS NULL THEN k.kod END,
           (SELECT z.imie FROM turniej_zawodnicy z WHERE z.druzyna_id = td.id AND z.kapitan LIMIT 1)
      FROM turniej_druzyny td
      LEFT JOIN turniej_kody_kapitana k ON k.druzyna_id = td.id
     WHERE td.turniej_id = p_turniej AND td.status IN ('przyjeta', 'rezerwa', 'zgloszona')
     ORDER BY td.nazwa;
END $$;

GRANT EXECUTE ON FUNCTION przygotuj_linki_kapitanow(uuid) TO authenticated;


-- ── 2. Strona linku: co to za drużyna (także przed zalogowaniem) ────────────
-- Zwraca kod dołączenia, żeby strona pokazała wolne wpisy składu („to ja”).
-- Kapitan i tak dostaje go razem z drużyną, więc nic tu nie wycieka.
CREATE OR REPLACE FUNCTION druzyna_po_kodzie_kapitana(p_kod text)
RETURNS TABLE (druzyna_id uuid, nazwa text, turniej_id uuid, turniej_nazwa text,
               kod_dolaczenia text, ma_kapitana boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT td.id, td.nazwa, t.id, t.nazwa, td.kod_dolaczenia, td.kapitan_id IS NOT NULL
    FROM turniej_kody_kapitana k
    JOIN turniej_druzyny td ON td.id = k.druzyna_id
    JOIN turnieje t ON t.id = td.turniej_id
   WHERE k.kod = upper(trim(p_kod));
$$;

GRANT EXECUTE ON FUNCTION druzyna_po_kodzie_kapitana(text) TO anon, authenticated;


-- ── 3. Kapitan przejmuje drużynę ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION przejmij_druzyne_kapitanem(
  p_kod         text,
  p_zawodnik_id uuid DEFAULT NULL,
  p_imie        text DEFAULT NULL
)
RETURNS TABLE (druzyna_id uuid, turniej_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kod      turniej_kody_kapitana%ROWTYPE;
  v_druzyna  turniej_druzyny%ROWTYPE;
  v_zawodnik uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby przejąć drużynę.';
  END IF;

  SELECT * INTO v_kod FROM turniej_kody_kapitana k WHERE k.kod = upper(trim(p_kod)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ten link kapitana już nie działa. Poproś organizatora o nowy.';
  END IF;

  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = v_kod.druzyna_id FOR UPDATE;
  IF v_druzyna.kapitan_id IS NOT NULL AND v_druzyna.kapitan_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Ta drużyna ma już kapitana. Zmienić go może organizator turnieju.';
  END IF;

  -- Do składu tą samą drogą co link drużyny: „to ja” albo nowy zawodnik,
  -- z jej sprawdzeniami (turniej otwarty, limit składu, jedna drużyna na osobę).
  SELECT j.zawodnik_id INTO v_zawodnik
    FROM dolacz_do_druzyny_kodem(v_druzyna.kod_dolaczenia, false, p_zawodnik_id, p_imie) j;

  UPDATE turniej_zawodnicy z SET kapitan = (z.id = v_zawodnik)
   WHERE z.druzyna_id = v_druzyna.id AND z.kapitan IS DISTINCT FROM (z.id = v_zawodnik);
  UPDATE turniej_druzyny d SET kapitan_id = auth.uid() WHERE d.id = v_druzyna.id;

  -- Link jednorazowy: przesłany dalej nie da już niczego.
  DELETE FROM turniej_kody_kapitana k WHERE k.druzyna_id = v_druzyna.id;

  RETURN QUERY SELECT v_druzyna.id, v_druzyna.turniej_id;
END $$;

GRANT EXECUTE ON FUNCTION przejmij_druzyne_kapitanem(text, uuid, text) TO authenticated;
