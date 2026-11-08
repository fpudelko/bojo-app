-- ============================================================================
-- 171_turniej_dolaczenie_i_wolne_losy.sql — dwa błędy znalezione przy turnieju
-- pokazowym (Luboń, 2026-11-08). Plan: docs/turnieje-poprawki-lubon.md, P0-1
-- i P0-2.
-- ----------------------------------------------------------------------------
-- 1. `dolacz_do_druzyny_kodem()` (145) NIE DZIAŁAŁA NIGDY. Zwraca
--    `RETURNS TABLE (druzyna_id, turniej_id, zostal_kapitanem, zawodnik_id)`,
--    a w PL/pgSQL kolumny wyniku są zmiennymi. Trzy niekwalifikowane
--    `WHERE druzyna_id = …` na `turniej_zawodnicy` kończyły się więc błędem
--    `column reference "druzyna_id" is ambiguous` — na KAŻDEJ drodze, także
--    przy „Zostań kapitanem" (po przejęciu funkcja idzie dalej do dopisania
--    wiersza i cała transakcja się wycofuje). Gracz widział ten komunikat
--    wprost na `/t/[kod]`. Poprawka: aliasy tabel wszędzie, gdzie nazwa
--    kolumny pokrywa się z kolumną wyniku. Treść funkcji poza tym bez zmian.
--
-- 2. WOLNY LOS BLOKOWAŁ TERMINARZ NA ZAWSZE. Generator drabinki zapisuje wolny
--    los jako mecz `walkower` z jedną drużyną (146), a `zapisz_terminarz()`
--    odmawiała nadpisania, gdy jakikolwiek mecz ma status inny niż
--    `zaplanowany`. Przy liczbie drużyn innej niż potęga dwójki pierwsza
--    wygenerowana drabinka była ostateczna, zanim ktokolwiek zagrał: nie dało
--    się dopisać drużyny ani zmienić godzin. Poprawka: `czy_wolny_los()` jako
--    jedna definicja dla bazy, ta sama co `czyWolnyLos()` we froncie.
--
-- Same `CREATE OR REPLACE` — migracja dokłada, nic nie kasuje, daje się
-- puścić drugi raz.
-- ============================================================================

-- ── 1. Wolny los — jedna definicja ──────────────────────────────────────────

-- Walkower z DOKŁADNIE jedną drużyną, bez meczu-źródła po żadnej stronie.
-- Bez warunku na źródła łapałby też prawdziwy walkower wpisany z konsoli
-- (`walkower_meczu`, 155) w meczu drugiej rundy, którego druga strona czeka
-- jeszcze na zwycięzcę — a to jest mecz, który realnie się rozstrzygnął.
CREATE OR REPLACE FUNCTION czy_wolny_los(m turniej_mecze)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT m.status = 'walkower'
     AND (m.druzyna_a_id IS NULL) <> (m.druzyna_b_id IS NULL)
     AND m.zrodlo_a_mecz_id IS NULL
     AND m.zrodlo_b_mecz_id IS NULL
$$;

GRANT EXECUTE ON FUNCTION czy_wolny_los(turniej_mecze) TO anon, authenticated;

-- ── 2. Terminarz z samymi wolnymi losami da się ułożyć od nowa ──────────────

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
  -- Wolny los NIE jest rozegranym meczem (171): to `walkower` z jedną drużyną
  -- i bez źródła po pustej stronie, wstawiany przez sam generator. Ta sama
  -- definicja co `czyWolnyLos()` w `lib/turniejWynik.ts`.
  SELECT count(*) INTO v_niedokonczone FROM turniej_mecze m
   WHERE m.turniej_id = p_turniej AND m.status <> 'zaplanowany'
     AND NOT czy_wolny_los(m);
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


-- ── 3. Dołączenie do drużyny z linku — kwalifikowane kolumny ────────────────

-- Każde odwołanie do `turniej_zawodnicy`/`turniej_druzyny`/`turnieje` idzie
-- przez alias tabeli. Kolumny wyniku (`druzyna_id`, `turniej_id`,
-- `zawodnik_id`) są w ciele funkcji zmiennymi i bez aliasu wygrywają z nimi
-- w niejednoznaczności — patrz nagłówek. Test: `supabase/test/rls.sql`,
-- sekcja „dołączenie do drużyny z linku, wszystkie trzy drogi".
CREATE OR REPLACE FUNCTION dolacz_do_druzyny_kodem(
  p_kod          text,
  p_jako_kapitan boolean DEFAULT false,
  p_zawodnik_id  uuid    DEFAULT NULL,
  p_imie         text    DEFAULT NULL
)
RETURNS TABLE (druzyna_id uuid, turniej_id uuid,
               zostal_kapitanem boolean, zawodnik_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna  turniej_druzyny%ROWTYPE;
  v_turniej  turnieje%ROWTYPE;
  v_ile      int;
  v_kapitan  boolean := false;
  v_zawodnik uuid;
  v_imie     text;
  v_inna     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby dołączyć do drużyny.';
  END IF;

  SELECT * INTO v_druzyna FROM turniej_druzyny d
   WHERE upper(d.kod_dolaczenia) = upper(trim(p_kod));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono drużyny o tym kodzie.';
  END IF;

  SELECT * INTO v_turniej FROM turnieje t WHERE t.id = v_druzyna.turniej_id;
  IF v_turniej.status IN ('zakonczony','odwolany') THEN
    RAISE EXCEPTION 'Ten turniej jest już zamknięty.';
  END IF;
  IF v_druzyna.status IN ('odrzucona','wycofana') THEN
    RAISE EXCEPTION 'Ta drużyna nie bierze udziału w turnieju.';
  END IF;

  -- 1. Kapitanat — pierwszy, kto otworzy link drużyny bez kapitana.
  --    Świadomy kompromis, ten sam co przy kodzie dołączenia do ekipy (094):
  --    kto ma link, ten wchodzi. Organizator dostaje powiadomienie i może
  --    kapitana zmienić, a kod — odświeżyć.
  IF p_jako_kapitan THEN
    IF v_druzyna.kapitan_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ta drużyna ma już kapitana.';
    END IF;
    UPDATE turniej_druzyny d SET kapitan_id = auth.uid() WHERE d.id = v_druzyna.id;
    v_kapitan := true;

    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_turniej.organizator_id, 'turniej_kapitan_przejal',
            'Drużyna ma kapitana',
            v_druzyna.nazwa || ' — ktoś przejął zarządzanie drużyną.',
            v_turniej.id);
  END IF;

  -- 2. Ta sama osoba nie gra w dwóch drużynach tego samego turnieju.
  SELECT d.nazwa INTO v_inna
    FROM turniej_zawodnicy z JOIN turniej_druzyny d ON d.id = z.druzyna_id
   WHERE z.turniej_id = v_turniej.id AND z.user_id = auth.uid();
  IF v_inna IS NOT NULL THEN
    IF v_inna = v_druzyna.nazwa THEN
      SELECT z.id INTO v_zawodnik FROM turniej_zawodnicy z
       WHERE z.druzyna_id = v_druzyna.id AND z.user_id = auth.uid();
      RETURN QUERY SELECT v_druzyna.id, v_turniej.id, v_kapitan, v_zawodnik;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Grasz już w tym turnieju w drużynie %.', v_inna;
  END IF;

  -- 3a. „To ja" — wolny wiersz składu wpisany wcześniej przez kapitana.
  IF p_zawodnik_id IS NOT NULL THEN
    UPDATE turniej_zawodnicy z SET user_id = auth.uid()
     WHERE z.id = p_zawodnik_id AND z.druzyna_id = v_druzyna.id AND z.user_id IS NULL
     RETURNING z.id INTO v_zawodnik;
    IF v_zawodnik IS NULL THEN
      RAISE EXCEPTION 'To miejsce w składzie jest już zajęte.';
    END IF;
  ELSE
  -- 3b. Nowy wiersz — imię z parametru albo z profilu.
    SELECT count(*) INTO v_ile FROM turniej_zawodnicy z WHERE z.druzyna_id = v_druzyna.id;
    IF v_ile >= v_turniej.max_zawodnikow THEN
      RAISE EXCEPTION 'Skład jest pełny (% osób).', v_turniej.max_zawodnikow;
    END IF;

    v_imie := NULLIF(trim(coalesce(p_imie, '')), '');
    IF v_imie IS NULL THEN
      SELECT coalesce(NULLIF(trim(p.display_name), ''), 'Zawodnik')
        INTO v_imie FROM profiles p WHERE p.id = auth.uid();
    END IF;

    INSERT INTO turniej_zawodnicy AS z (druzyna_id, turniej_id, user_id, imie, kapitan)
    VALUES (v_druzyna.id, v_turniej.id, auth.uid(), v_imie, v_kapitan)
    RETURNING z.id INTO v_zawodnik;
  END IF;

  RETURN QUERY SELECT v_druzyna.id, v_turniej.id, v_kapitan, v_zawodnik;
END $$;

GRANT EXECUTE ON FUNCTION dolacz_do_druzyny_kodem(text, boolean, uuid, text)
  TO authenticated;
