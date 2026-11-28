-- ============================================================================
-- 198_turniej_pasek_i_to_ja.sql — pasek „trwa turniej” i „To ja” bez czekania.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Prośba właściciela (2026-11-28): w dniu turnieju strona główna ma
-- mówić KAŻDEMU, także niezalogowanemu, że turniej trwa, a zawodnik ma jednym
-- wejściem znaleźć swoją drużynę i przypiąć ją do konta. Do tej pory drużynę
-- znajdował tylko ktoś, kto dostał link `/t/…` albo `/k/…`; reszta nie wiedziała
-- nawet, że turniej jest w Bojo.
--
-- 1. `pasek_turniejow()` — turnieje na pasek strony głównej: publiczne w toku
--    (`trwa`) i publiczne, które startują DZIŚ (w Polsce) — ludzie szukają
--    swojej drużyny na rozgrzewce, zanim organizator kliknie start. Zalogowany
--    zawodnik widzi też turniej „na link”, w którym gra. Dla jego drużyny
--    funkcja niesie najbliższy mecz (godzina, boisko, rywal).
--    SECURITY DEFINER, bo `turniej_zawodnicy` czyta wyłącznie zalogowany
--    (145), a funkcja zwraca o składzie tylko jedno: WŁASNĄ drużynę wołającego.
--
-- 2. `przejmij_wpis_zawodnika()` — „To ja” BEZ zatwierdzenia (decyzja
--    właściciela): zawodnik dopisany przez organizatora bez konta zostaje
--    przypięty do konta od razu. Stawką są jego gole i kartki, nie uprawnienia:
--    kapitanem robi WYŁĄCZNIE `turniej_druzyny.kapitan_id`, którego ta funkcja
--    nie dotyka, nawet gdy przejmowany wiersz ma `kapitan = true`. Edycja składu
--    zostaje za zatwierdzeniem (prośba „Chcę być kapitanem”, link `/k/…`).
--    Kapitan albo organizator dostaje powiadomienie `turniej_to_ja` i może
--    przypięcie cofnąć (`odlacz_konto_zawodnika()`), żeby „ktoś nie namieszał”.
--    Ślad zostaje w `turniej_prosby` (typ 'to_ja', od razu 'przyjeta').
--
-- 3. `odlacz_konto_zawodnika()` — cofnięcie przypięcia przez kapitana albo
--    zarządzającego. Wiersz zostaje (z golami), traci tylko konto. Kapitana
--    drużyny odpina wyłącznie zarządzający i wtedy drużyna traci kapitana.
--
-- 4. DOMYKA LUKĘ: polityka „Przypisz sie do wolnego wpisu” (145) pozwalała
--    zalogowanemu zaktualizować DOWOLNE kolumny wolnego wiersza składu, byle
--    ustawił w nim siebie — także `druzyna_id` (przeniesienie wpisu do innej
--    drużyny), `imie` i `kapitan`, z pominięciem zasady „jedna drużyna na osobę
--    w turnieju”. Frontend z niej nie korzysta (wszystkie przypięcia idą przez
--    funkcje SECURITY DEFINER), więc polityka znika, a „To ja” idzie przez (2).
--
-- Same dokładające zmiany (funkcje, DROP POLICY), automatem. Idempotentna.
-- ============================================================================

-- ── 1. Pasek na stronie głównej ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION pasek_turniejow()
RETURNS TABLE (
  turniej_id            uuid,
  nazwa                 text,
  miasto                text,
  status                text,
  data_startu           date,
  godzina_startu        time,
  moja_druzyna_id       uuid,
  moja_druzyna_nazwa    text,
  na_zywo               text,
  nastepny_at           timestamptz,
  nastepny_boisko       text,
  nastepny_rywal        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dzis AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d),
  kandydaci AS (
    SELECT t.*
      FROM turnieje t, dzis
     WHERE t.status = 'trwa'
        OR (t.status IN ('zapisy', 'zamkniete_zapisy') AND t.data_startu = dzis.d)
  ),
  moje AS (
    SELECT z.turniej_id, d.id AS druzyna_id, d.nazwa
      FROM turniej_zawodnicy z
      JOIN turniej_druzyny d ON d.id = z.druzyna_id
     WHERE z.user_id = auth.uid()
       AND auth.uid() IS NOT NULL
       AND d.status NOT IN ('odrzucona', 'wycofana')
  )
  SELECT k.id, k.nazwa, k.miasto, k.status, k.data_startu, k.godzina_startu,
         m.druzyna_id, m.nazwa,
         -- Mecz w toku: pierwszy rozpoczęty, w zapisie „A 2:1 B”.
         (SELECT da.nazwa || ' ' || coalesce(mm.wynik_a, 0) || ':' || coalesce(mm.wynik_b, 0) || ' ' || db.nazwa
            FROM turniej_mecze mm
            JOIN turniej_druzyny da ON da.id = mm.druzyna_a_id
            JOIN turniej_druzyny db ON db.id = mm.druzyna_b_id
           WHERE mm.turniej_id = k.id AND mm.status = 'trwa'
           ORDER BY mm.rozpoczety_at NULLS LAST, mm.numer
           LIMIT 1),
         n.zaplanowany_at, n.boisko, n.rywal
    FROM kandydaci k
    LEFT JOIN moje m ON m.turniej_id = k.id
    LEFT JOIN LATERAL (
      SELECT mm.zaplanowany_at,
             a.nazwa AS boisko,
             r.nazwa AS rywal
        FROM turniej_mecze mm
        LEFT JOIN turniej_areny a ON a.id = mm.arena_id
        LEFT JOIN turniej_druzyny r
               ON r.id = CASE WHEN mm.druzyna_a_id = m.druzyna_id THEN mm.druzyna_b_id ELSE mm.druzyna_a_id END
       WHERE m.druzyna_id IS NOT NULL
         AND mm.turniej_id = k.id
         AND m.druzyna_id IN (mm.druzyna_a_id, mm.druzyna_b_id)
         AND mm.status IN ('zaplanowany', 'trwa')
       ORDER BY (mm.status = 'trwa') DESC, mm.zaplanowany_at NULLS LAST, mm.numer
       LIMIT 1
    ) n ON true
   WHERE k.widocznosc = 'publiczny' OR m.druzyna_id IS NOT NULL
   -- Mój turniej pierwszy, potem trwające przed dzisiejszymi, a wśród
   -- trwających ten, który trwa najdłużej (najwcześniejszy start).
   ORDER BY (m.druzyna_id IS NOT NULL) DESC, (k.status = 'trwa') DESC,
            k.data_startu, k.godzina_startu NULLS LAST, k.created_at;
$$;

REVOKE ALL ON FUNCTION pasek_turniejow() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pasek_turniejow() TO anon, authenticated;


-- ── 2. „To ja” bez zatwierdzenia ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION przejmij_wpis_zawodnika(p_zawodnik uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_z       turniej_zawodnicy%ROWTYPE;
  v_druzyna turniej_druzyny%ROWTYPE;
  v_turniej turnieje%ROWTYPE;
  v_inna    turniej_druzyny%ROWTYPE;
  v_kto     text;
  v_odbiorca uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby przypisać się do drużyny.';
  END IF;

  SELECT * INTO v_z FROM turniej_zawodnicy z WHERE z.id = p_zawodnik FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono zawodnika.'; END IF;
  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = v_z.druzyna_id;
  SELECT * INTO v_turniej FROM turnieje t WHERE t.id = v_z.turniej_id;

  IF v_turniej.status IN ('zakonczony', 'odwolany') THEN
    RAISE EXCEPTION 'Ten turniej jest już zamknięty.';
  END IF;
  IF v_druzyna.status IN ('odrzucona', 'wycofana') THEN
    RAISE EXCEPTION 'Ta drużyna nie bierze udziału w turnieju.';
  END IF;

  -- Jedna drużyna na osobę w turnieju (jak 172/186).
  SELECT d.* INTO v_inna
    FROM turniej_zawodnicy z JOIN turniej_druzyny d ON d.id = z.druzyna_id
   WHERE z.turniej_id = v_turniej.id AND z.user_id = auth.uid();
  IF FOUND THEN
    IF v_inna.id = v_druzyna.id THEN
      RAISE EXCEPTION 'Już grasz w tej drużynie.';
    END IF;
    RAISE EXCEPTION 'Grasz już w tym turnieju w drużynie %.', v_inna.nazwa;
  END IF;

  IF v_z.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'To miejsce w składzie jest już przypisane do konta.';
  END IF;

  -- Wyłącznie `user_id`. `kapitan`, `imie`, `numer` zostają, a uprawnienia
  -- kapitana (`kapitan_id` drużyny) się NIE zmieniają.
  UPDATE turniej_zawodnicy z SET user_id = auth.uid() WHERE z.id = v_z.id;

  -- Ślad: kto i kiedy powiedział „to ja”. Od razu przyjęta, przez siebie.
  INSERT INTO turniej_prosby (turniej_id, druzyna_id, user_id, typ, zawodnik_id,
                              status, rozpatrzona_at, rozpatrzyl)
  VALUES (v_turniej.id, v_druzyna.id, auth.uid(), 'to_ja', v_z.id,
          'przyjeta', now(), auth.uid());

  -- Czekające prośby tej osoby w tym turnieju tracą sens: ma już drużynę.
  -- Wyjątek: prośba o kapitana TEJ drużyny (jak w `rozpatrz_prosbe_do_druzyny`).
  UPDATE turniej_prosby p
     SET status = 'odrzucona', rozpatrzona_at = now(), rozpatrzyl = auth.uid()
   WHERE p.turniej_id = v_turniej.id AND p.user_id = auth.uid() AND p.status = 'czeka'
     AND NOT (p.druzyna_id = v_druzyna.id AND p.typ = 'kapitan');

  -- Informacja, nie prośba: kapitan, a bez kapitana organizator.
  SELECT coalesce(NULLIF(btrim(p.display_name), ''), 'Gracz') INTO v_kto
    FROM profiles p WHERE p.id = auth.uid();
  v_odbiorca := coalesce(v_druzyna.kapitan_id, v_turniej.organizator_id);
  IF v_odbiorca IS NOT NULL AND v_odbiorca <> auth.uid() THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_odbiorca, 'turniej_to_ja',
            coalesce(v_kto, 'Gracz') || ' przypisał(a) się do składu',
            v_druzyna.nazwa || ': „' || v_z.imie || '” to teraz konto ' || coalesce(v_kto, 'Gracz')
              || '. Jeśli to pomyłka, odepnij konto na ekranie drużyny.',
            v_turniej.id);
  END IF;

  RETURN v_druzyna.id;
END $$;

REVOKE ALL ON FUNCTION przejmij_wpis_zawodnika(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION przejmij_wpis_zawodnika(uuid) TO authenticated;


-- ── 3. Cofnięcie przypięcia ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION odlacz_konto_zawodnika(p_zawodnik uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_z       turniej_zawodnicy%ROWTYPE;
  v_druzyna turniej_druzyny%ROWTYPE;
BEGIN
  SELECT * INTO v_z FROM turniej_zawodnicy z WHERE z.id = p_zawodnik FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono zawodnika.'; END IF;
  SELECT * INTO v_druzyna FROM turniej_druzyny d WHERE d.id = v_z.druzyna_id;

  IF NOT czy_kapitan_druzyny(v_druzyna.id) THEN
    RAISE EXCEPTION 'Konto odpina kapitan drużyny albo organizator.';
  END IF;
  IF v_z.user_id IS NULL THEN
    RETURN;
  END IF;
  IF v_z.user_id = v_druzyna.kapitan_id THEN
    IF NOT czy_zarzadza_druzynami(v_druzyna.turniej_id) THEN
      RAISE EXCEPTION 'Kapitana odpina organizator turnieju.';
    END IF;
    UPDATE turniej_druzyny d SET kapitan_id = NULL WHERE d.id = v_druzyna.id;
  END IF;

  UPDATE turniej_zawodnicy z SET user_id = NULL WHERE z.id = v_z.id;
END $$;

REVOKE ALL ON FUNCTION odlacz_konto_zawodnika(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION odlacz_konto_zawodnika(uuid) TO authenticated;


-- ── 4. Luka w polityce samodzielnego przypisania ────────────────────────────

DROP POLICY IF EXISTS "Przypisz sie do wolnego wpisu" ON turniej_zawodnicy;
