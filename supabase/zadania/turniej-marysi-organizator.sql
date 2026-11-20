-- ============================================================================
-- JEDNORAZOWE ZADANIE: turniej pokazowy „Gramy dla Marysi” do testu wyników
-- ============================================================================
--
-- Cel (prośba właściciela z 2026-11-20): przećwiczyć wpisywanie wyników na
-- turnieju pokazowym (`/turnieje/6c501b7d-…`, docs/turnieje-poprawki-lubon.md):
--   • organizatorem zostaje franekks@gmail.com,
--   • dotychczasowy organizator NIE traci dostępu: dostaje pełne prawa przez
--     `turniej_osoby` (edycja, prowadzenie meczów, drużyny),
--   • franciszekpudelko@gmail.com zostaje kapitanem drużyny z meczu M1
--     (konto w składzie, `kapitan_id`), więc zobaczysz powiadomienia i widok
--     kapitana z drugiego telefonu,
--   • pole „Regulamin” dostaje regulamin. Było w nim ogłoszenie o zapisach
--     („Jeśli chcesz zgłosić drużynę…”), które i tak stoi w opisie.
--     Liczby (czas meczu, skład, punkty) idą z ustawień turnieju. Tekst da się
--     potem poprawić w Panel → Ustawienia → Regulamin.
--
-- UWAGA NA POWIADOMIENIA: wyzwalacze 146/155 powiadamiają zawodników Z KONTEM.
-- Część A pokazuje, ile kont (poza dwoma powyżej) siedzi w składach. Jeśli
-- `obce_konta` > 0, wpisany wynik obudzi prawdziwych ludzi. Wtedy zamiast tego
-- skryptu użyj „Przetestuj” w panelu (kopia bez kont, migracja 173).
--
-- Bezpieczne do ponownego uruchomienia. Uruchamiane RĘCZNIE w Supabase →
-- SQL Editor: najpierw część A, potem B.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A: PODGLĄD. Niczego nie zmienia.
-- ============================================================================

SELECT
  t.id, t.nazwa, t.status, t.format,
  (SELECT email FROM auth.users u WHERE u.id = t.organizator_id)          AS organizator,
  (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id)      AS druzyn,
  (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id)        AS meczow,
  (SELECT count(*) FROM turniej_zawodnicy z
     JOIN auth.users u ON u.id = z.user_id
    WHERE z.turniej_id = t.id
      AND u.email NOT IN ('franekks@gmail.com','franciszekpudelko@gmail.com')) AS obce_konta,
  left(coalesce(t.regulamin, ''), 60)                                      AS regulamin_teraz
FROM turnieje t
WHERE t.nazwa ILIKE '%marysi%'
ORDER BY t.created_at;


-- ============================================================================
-- CZĘŚĆ B: ZMIANA. Turniej wybiera prefiks id z dokumentacji (6c501b7d);
-- gdyby to był inny turniej, wpisz pełne id z części A w `v_id`.
-- ============================================================================

DO $$
DECLARE
  me      uuid := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  kapitan uuid := (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');
  v_id    uuid := NULL;            -- ← pełne id, jeśli prefiks nie trafi
  t       turnieje%ROWTYPE;
  v_druzyna uuid;
  v_imie  text;
  ile     int;
BEGIN
  IF me IS NULL OR kapitan IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com albo franciszekpudelko@gmail.com.';
  END IF;

  IF v_id IS NULL THEN
    SELECT count(*) INTO ile FROM turnieje
     WHERE id::text LIKE '6c501b7d%' AND nazwa ILIKE '%marysi%';
    IF ile <> 1 THEN
      RAISE EXCEPTION 'Prefiks 6c501b7d trafia w % turniejów. Wpisz pełne id z części A w v_id.', ile;
    END IF;
    SELECT id INTO v_id FROM turnieje WHERE id::text LIKE '6c501b7d%' AND nazwa ILIKE '%marysi%';
  END IF;
  SELECT * INTO t FROM turnieje WHERE id = v_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Nie ma turnieju %.', v_id; END IF;

  -- ── 1. Organizator ────────────────────────────────────────────────────────
  IF t.organizator_id <> me THEN
    INSERT INTO turniej_osoby (turniej_id, user_id, moze_edytowac, moze_prowadzic,
                               moze_zarzadzac_druzynami, dodany_przez)
    VALUES (v_id, t.organizator_id, true, true, true, me)
    ON CONFLICT (turniej_id, user_id) DO UPDATE
      SET moze_edytowac = true, moze_prowadzic = true, moze_zarzadzac_druzynami = true;
    UPDATE turnieje SET organizator_id = me WHERE id = v_id;
  END IF;
  -- Organizator nie potrzebuje wpisu w `turniej_osoby`; zostawiony dublowałby
  -- go w zakładce „Ludzie”.
  DELETE FROM turniej_osoby WHERE turniej_id = v_id AND user_id = me;

  -- ── 2. Kapitan: drużyna A z meczu o najniższym numerze ───────────────────
  SELECT m.druzyna_a_id INTO v_druzyna FROM turniej_mecze m
   WHERE m.turniej_id = v_id AND m.druzyna_a_id IS NOT NULL
   ORDER BY m.numer LIMIT 1;
  IF v_druzyna IS NULL THEN
    SELECT d.id INTO v_druzyna FROM turniej_druzyny d
     WHERE d.turniej_id = v_id AND d.status = 'przyjeta' ORDER BY d.nazwa LIMIT 1;
  END IF;
  IF v_druzyna IS NULL THEN RAISE EXCEPTION 'Turniej nie ma przyjętej drużyny.'; END IF;

  -- Jedna osoba gra w jednej drużynie turnieju (`idx_zawodnik_raz_w_turnieju`):
  -- wpis z innej drużyny (poprzednie uruchomienie) przenosimy, nie dublujemy.
  UPDATE turniej_druzyny SET kapitan_id = NULL
   WHERE turniej_id = v_id AND kapitan_id = kapitan AND id <> v_druzyna;
  DELETE FROM turniej_zawodnicy
   WHERE turniej_id = v_id AND user_id = kapitan AND druzyna_id <> v_druzyna;

  UPDATE turniej_druzyny SET kapitan_id = kapitan WHERE id = v_druzyna;
  UPDATE turniej_zawodnicy SET kapitan = false
   WHERE druzyna_id = v_druzyna AND coalesce(user_id, '00000000-0000-0000-0000-000000000000') <> kapitan;

  IF EXISTS (SELECT 1 FROM turniej_zawodnicy WHERE druzyna_id = v_druzyna AND user_id = kapitan) THEN
    UPDATE turniej_zawodnicy SET kapitan = true WHERE druzyna_id = v_druzyna AND user_id = kapitan;
  ELSE
    v_imie := left(coalesce(nullif(trim((SELECT display_name FROM profiles WHERE id = kapitan)), ''),
                            'Franciszek'), 60);
    INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie, kapitan)
    VALUES (v_druzyna, v_id, kapitan, v_imie, true);
  END IF;

  -- ── 3. Regulamin ──────────────────────────────────────────────────────────
  UPDATE turnieje SET regulamin =
       '1. Turniej rozgrywamy na hali, w obuwiu halowym (bez korków i lanek).' || E'\n'
    || '2. Skład drużyny to maksymalnie ' || t.max_zawodnikow || ' zawodników'
    || coalesce(', na boisku ' || t.graczy_w_polu || ' (z bramkarzem)', '')
    || '. Zmiany hokejowe, bez limitu.' || E'\n'
    || '3. Mecz trwa ' || t.czas_meczu_min || ' minut, bez zmiany stron.' || E'\n'
    || '4. W grupie: ' || t.punkty_za_wygrana || ' pkt za zwycięstwo, ' || t.punkty_za_remis
    || ' pkt za remis. O kolejności decydują punkty, potem różnica bramek, potem bramki zdobyte.' || E'\n'
    || '5. Drużyna, która nie stawi się na mecz 5 minut po wyznaczonej godzinie, przegrywa walkowerem.' || E'\n'
    || '6. Gramy bez wślizgów. Za niebezpieczną grę sędzia może odesłać zawodnika na ławkę na 2 minuty.' || E'\n'
    || '7. Decyzje sędziego są ostateczne. Sprawy, których regulamin nie opisuje, rozstrzyga organizator.' || E'\n'
    || '8. Zawodnicy grają na własną odpowiedzialność. Osoby niepełnoletnie potrzebują zgody rodzica.' || E'\n'
    || '9. Udział oznacza zgodę na zdjęcia i nagrania w relacjach z turnieju.' || E'\n'
    || '10. Gramy fair play. Gramy dla Marysi.'
  WHERE id = v_id;

  RAISE NOTICE 'Gotowe: /turnieje/% · organizator franekks · kapitan franciszekpudelko w drużynie „%”',
    v_id, (SELECT nazwa FROM turniej_druzyny WHERE id = v_druzyna);
END $$;


-- Sprawdzenie.
SELECT t.nazwa, t.status,
       (SELECT email FROM auth.users u WHERE u.id = t.organizator_id) AS organizator,
       d.nazwa AS druzyna_kapitana,
       '/turnieje/' || t.id || '/panel' AS panel
FROM turnieje t
JOIN turniej_druzyny d ON d.turniej_id = t.id
JOIN auth.users k ON k.id = d.kapitan_id AND k.email = 'franciszekpudelko@gmail.com'
WHERE t.nazwa ILIKE '%marysi%';
