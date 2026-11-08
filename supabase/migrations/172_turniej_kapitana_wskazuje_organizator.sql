-- ============================================================================
-- 172_turniej_kapitana_wskazuje_organizator.sql — link do drużyny tylko
-- dołącza, kapitana wskazuje organizator.
-- ----------------------------------------------------------------------------
-- DLACZEGO. `dolacz_do_druzyny_kodem()` (145, 171) oddawała kapitanat
-- PIERWSZEJ osobie, która otworzyła link drużyny bez kapitana. Przy drużynach
-- dodanych ręcznie przez organizatora (turniej pokazowy w Luboniu,
-- 2026-11-08) kapitanem zostawał więc ktokolwiek, komu link przesłano dalej.
-- Decyzja właściciela: link wyłącznie dołącza („to ja" albo nowy zawodnik),
-- a kapitana wskazuje organizator. Drużyna zgłoszona przez `/zglos` dalej ma
-- kapitana od razu: to osoba, która ją zgłosiła (bez zmian).
--
-- `ustaw_kapitana_druzyny()` robi to w jednym miejscu: kolumna
-- `turniej_druzyny.kapitan_id` i flaga `turniej_zawodnicy.kapitan` muszą się
-- zgadzać, a zwykły UPDATE kapitana nie przejdzie przez politykę
-- „Druzyne edytuje kapitan" (WITH CHECK `kapitan_id = auth.uid()`). Wołać może
-- zarządzający drużynami ALBO obecny kapitan (przekazanie kapitanatu).
--
-- Same `CREATE OR REPLACE`, idempotentna, bez DROP/DELETE: jedzie automatem.
-- ============================================================================

-- ── 1. Dołączenie z linku bez kapitanatu ────────────────────────────────────

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
  v_kapitan  boolean := false;  -- zawsze false od 172
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

  -- 1. Link NIE nadaje kapitanatu (172). Do 2026-11-08 pierwsza osoba, która
  --    otworzyła link drużyny bez kapitana, mogła nim zostać jednym kliknięciem,
  --    czyli kapitanem drużyny wpisanej przez organizatora zostawał przypadkowy
  --    kolega, któremu link przesłano dalej. Kapitana wskazuje teraz
  --    organizator (`ustaw_kapitana_druzyny`). Parametr zostaje w sygnaturze,
  --    żeby stary klient dostał zrozumiały komunikat, a nie błąd PostgREST.
  IF p_jako_kapitan THEN
    RAISE EXCEPTION 'Kapitana drużyny wskazuje organizator turnieju. Dołącz jako zawodnik.';
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


-- ── 2. Organizator wskazuje kapitana ────────────────────────────────────────

CREATE OR REPLACE FUNCTION ustaw_kapitana_druzyny(p_druzyna uuid, p_zawodnik uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna turniej_druzyny%ROWTYPE;
  v_user    uuid;
BEGIN
  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = p_druzyna;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono drużyny.';
  END IF;
  -- `IS DISTINCT FROM`, nie `<>`/`=`: przy drużynie BEZ kapitana
  -- (`kapitan_id IS NULL`) porównanie dawało NULL, `NOT (false OR NULL)` to
  -- NULL, a IF traktuje NULL jak fałsz, więc warunek przepuszczał KAŻDEGO.
  -- Złapane asercją w `supabase/test/rls.sql` przed pierwszym commitem.
  IF NOT czy_zarzadza_druzynami(v_druzyna.turniej_id)
     AND v_druzyna.kapitan_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Kapitana wskazuje organizator turnieju albo obecny kapitan.';
  END IF;

  SELECT z.user_id INTO v_user FROM turniej_zawodnicy z
   WHERE z.id = p_zawodnik AND z.druzyna_id = p_druzyna;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tej osoby nie ma w składzie drużyny.';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Kapitanem może zostać tylko zawodnik z kontem w Bojo. Wyślij mu link do drużyny.';
  END IF;

  UPDATE turniej_zawodnicy z SET kapitan = (z.id = p_zawodnik)
   WHERE z.druzyna_id = p_druzyna AND z.kapitan IS DISTINCT FROM (z.id = p_zawodnik);
  UPDATE turniej_druzyny d SET kapitan_id = v_user WHERE d.id = p_druzyna;
END $$;

GRANT EXECUTE ON FUNCTION ustaw_kapitana_druzyny(uuid, uuid) TO authenticated;
