-- ============================================================================
-- JEDNORAZOWE ZADANIE: terminarz „Gramy dla Marysi!” na 28.11.2026
-- z PDF-a organizatora („28.11.2026 Poma-Gramy.pdf”, wersja z 27.11)
-- ============================================================================
--
-- Prośba właściciela z 2026-11-27: dwie drużyny wypadły, organizator przysłał
-- nowy harmonogram. Ten skrypt ustawia prawdziwy turniej
-- `e9a3763f-7bd9-99e9-76d6-1c852d6b8f47` dokładnie według PDF-a:
--
--   • 13 drużyn: grupa A (7) i grupa B (6), każdy z każdym, jedno boisko,
--   • mecze po 10 min, zmiana drużyn 2 min, start 08:45,
--   • 36 meczów grupowych w kolejności i godzinach z PDF-a (M1…M36),
--   • M37 o 3. miejsce 16:12 (A2 – B2), M38 finał 16:24 (A1 – B1); drużyny
--     wpisze baza sama, gdy grupy się rozstrzygną (`wypelnij_z_grupy()`, 175),
--   • przerwy: Konkurs 12:45–13:00, Dekoracja 16:34–16:49.
--
-- DRUŻYNY dopasowuje po nazwie (bez wielkości liter i spacji na brzegach),
-- więc istniejące drużyny ZACHOWUJĄ skład, kapitana i link. Brakujące
-- zakłada jako dodane przez organizatora (bez powiadomień). Drużyny spoza
-- PDF-a dostają status „wycofana” (nie znikają, nikt nie dostaje
-- powiadomienia; „wycofana” go nie wysyła, 145).
--
-- KASUJE: wszystkie mecze, zdarzenia (gole, kartki) i przerwy tego turnieju,
-- oraz grupy inne niż A i B. Nikt nie dostanie powiadomienia: wstawianie
-- meczów nie uruchamia żadnego wyzwalacza powiadomień (tylko zmiana statusu
-- i godziny już istniejącego meczu, 155/174).
--
-- RĘCZNIE w Supabase → SQL Editor: najpierw CZĘŚĆ A (podgląd, nic nie
-- zmienia), potem CZĘŚĆ B, na końcu CZĘŚĆ C (sprawdzenie). Część B można
-- puścić drugi raz: wynik będzie ten sam.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A: PODGLĄD. Niczego nie zmienia.
-- ============================================================================

WITH pdf(grupa, nazwa) AS (VALUES
  ('A','Ekipa Marysi'), ('A','Młodzi Emeryci'), ('A','Fundacja Dobro Się Niesie'),
  ('A','Natanael i Przyjaciele'), ('A','KS Pyry'), ('A','Club Deportivo Luboń'), ('A','Rossoneri'),
  ('B','Niedźwiedzie FC'), ('B','Chaos United'), ('B','Emar Instalacje'),
  ('B','Unilink Szamotuły & MedKomplex'), ('B','AFC Poznań'), ('B','Ekipa Fortnite Skurczybyki')
), w_bazie AS (
  SELECT d.id, d.nazwa, d.status,
         (SELECT count(*) FROM turniej_zawodnicy z WHERE z.druzyna_id = d.id) AS zawodnikow,
         d.kapitan_id IS NOT NULL AS ma_kapitana
    FROM turniej_druzyny d
   WHERE d.turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
)
SELECT coalesce(p.grupa, '—') AS grupa_z_pdf,
       coalesce(p.nazwa, b.nazwa) AS druzyna,
       CASE WHEN b.id IS NULL THEN 'ZAŁOŻĘ NOWĄ'
            WHEN p.nazwa IS NULL THEN 'WYCOFAM (nie ma jej w PDF)'
            ELSE 'zostaje (' || b.status || ')' END AS co_sie_stanie,
       b.zawodnikow, b.ma_kapitana
  FROM pdf p
  FULL JOIN w_bazie b ON lower(btrim(b.nazwa)) = lower(btrim(p.nazwa))
 ORDER BY 1, 2;

-- Co zniknie: mecze z wynikiem i zdarzenia (powinno być 0, jeśli nikt nie grał).
SELECT (SELECT count(*) FROM turniej_mecze m
         WHERE m.turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
           AND m.status <> 'zaplanowany') AS meczow_z_wynikiem,
       (SELECT count(*) FROM turniej_zdarzenia z
         WHERE z.turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47') AS zdarzen,
       (SELECT count(*) FROM turniej_mecze m
         WHERE m.turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47') AS meczow_teraz;


-- ============================================================================
-- CZĘŚĆ B: ZMIANA.
-- ============================================================================

DO $$
DECLARE
  v_id      uuid := 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';
  v_grupa_a uuid;
  v_grupa_b uuid;
  v_arena   uuid;
  v_nazwa   text;
  v_druzyna uuid;
  v_status  text;
  r         record;
  -- Drużyny w kolejności z PDF-a.
  a_nazwy text[] := ARRAY['Ekipa Marysi','Młodzi Emeryci','Fundacja Dobro Się Niesie',
                          'Natanael i Przyjaciele','KS Pyry','Club Deportivo Luboń','Rossoneri'];
  b_nazwy text[] := ARRAY['Niedźwiedzie FC','Chaos United','Emar Instalacje',
                          'Unilink Szamotuły & MedKomplex','AFC Poznań','Ekipa Fortnite Skurczybyki'];
BEGIN
  SELECT t.status INTO v_status FROM turnieje t WHERE t.id = v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie ma turnieju %.', v_id; END IF;

  -- SQL Editor nie ma zalogowanego użytkownika, a `trg_pilnuj_wlasnej_druzyny`
  -- (145) PO CICHU cofa zmianę grupy i statusu drużyny każdemu, kto nie
  -- zarządza turniejem. Bez tego przypisanie do grup by nie weszło, bez
  -- żadnego błędu. Na czas tej transakcji działamy jako organizator turnieju
  -- (`is_local = true`: ustawienie znika po COMMIT).
  PERFORM set_config('request.jwt.claim.sub', (SELECT organizator_id::text FROM turnieje WHERE id = v_id), true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', (SELECT organizator_id FROM turnieje WHERE id = v_id), 'role', 'authenticated')::text, true);
  IF NOT czy_zarzadza_druzynami(v_id) THEN
    RAISE EXCEPTION 'Nie udało się działać jako organizator (auth.uid() = %).', auth.uid();
  END IF;

  -- ── 1. Ustawienia z PDF-a ──────────────────────────────────────────────
  UPDATE turnieje SET
    format            = 'grupy_puchar',
    data_startu       = DATE '2026-11-28',
    godzina_startu    = TIME '08:45',
    czas_meczu_min    = 10,
    przerwa_min       = 2,
    awansuje_z_grupy  = 2,
    max_druzyn        = GREATEST(max_druzyn, 13),
    -- Turniej po testach wraca przed pierwszy gwizdek.
    status            = CASE WHEN status IN ('trwa','zakonczony') THEN 'zamkniete_zapisy' ELSE status END
  WHERE id = v_id;

  -- ── 2. Czysty terminarz ────────────────────────────────────────────────
  DELETE FROM turniej_zdarzenia WHERE turniej_id = v_id;
  DELETE FROM turniej_mecze     WHERE turniej_id = v_id;
  DELETE FROM turniej_przerwy   WHERE turniej_id = v_id;

  -- ── 3. Grupy A i B ─────────────────────────────────────────────────────
  INSERT INTO turniej_grupy (turniej_id, nazwa) VALUES (v_id, 'A')
    ON CONFLICT (turniej_id, nazwa) DO NOTHING;
  INSERT INTO turniej_grupy (turniej_id, nazwa) VALUES (v_id, 'B')
    ON CONFLICT (turniej_id, nazwa) DO NOTHING;
  SELECT id INTO v_grupa_a FROM turniej_grupy WHERE turniej_id = v_id AND nazwa = 'A';
  SELECT id INTO v_grupa_b FROM turniej_grupy WHERE turniej_id = v_id AND nazwa = 'B';
  UPDATE turniej_grupy SET finalowa = false WHERE id IN (v_grupa_a, v_grupa_b);

  -- ── 4. Drużyny ─────────────────────────────────────────────────────────
  UPDATE turniej_druzyny SET grupa_id = NULL WHERE turniej_id = v_id;
  FOR r IN
    SELECT n AS nazwa, 'A' AS grupa FROM unnest(a_nazwy) n
    UNION ALL SELECT n, 'B' FROM unnest(b_nazwy) n
  LOOP
    SELECT d.id INTO v_druzyna FROM turniej_druzyny d
     WHERE d.turniej_id = v_id AND lower(btrim(d.nazwa)) = lower(btrim(r.nazwa))
     ORDER BY d.created_at LIMIT 1;
    IF v_druzyna IS NULL THEN
      INSERT INTO turniej_druzyny (turniej_id, nazwa, status, dodana_recznie, regulamin_zaakceptowany_at)
      VALUES (v_id, r.nazwa, 'przyjeta', true, now())
      RETURNING id INTO v_druzyna;
      RAISE NOTICE 'Założona drużyna: %', r.nazwa;
    END IF;
    UPDATE turniej_druzyny
       SET grupa_id = CASE r.grupa WHEN 'A' THEN v_grupa_a ELSE v_grupa_b END,
           status = 'przyjeta'
     WHERE id = v_druzyna;
  END LOOP;

  -- Drużyny spoza PDF-a: wycofane (bez grupy). Nie kasujemy: zostają w historii.
  FOR v_nazwa IN
    UPDATE turniej_druzyny d SET status = 'wycofana'
     WHERE d.turniej_id = v_id AND d.grupa_id IS NULL AND d.status <> 'wycofana'
    RETURNING d.nazwa
  LOOP
    RAISE NOTICE 'Wycofana drużyna (nie ma jej w PDF): %', v_nazwa;
  END LOOP;

  DELETE FROM turniej_grupy WHERE turniej_id = v_id AND id NOT IN (v_grupa_a, v_grupa_b);

  -- ── 5. Boisko: pierwsze istniejące albo nowe ───────────────────────────
  SELECT id INTO v_arena FROM turniej_areny WHERE turniej_id = v_id ORDER BY kolejnosc, created_at LIMIT 1;
  IF v_arena IS NULL THEN
    INSERT INTO turniej_areny (turniej_id, nazwa) VALUES (v_id, 'Hala LOSiR') RETURNING id INTO v_arena;
  END IF;

  -- ── 6. Mecze grupowe M1…M36 (godziny polskie z PDF-a) ──────────────────
  INSERT INTO turniej_mecze (turniej_id, numer, faza, grupa_id, druzyna_a_id, druzyna_b_id, arena_id, zaplanowany_at)
  SELECT v_id, x.numer, 'grupa',
         CASE x.grupa WHEN 'A' THEN v_grupa_a ELSE v_grupa_b END,
         (SELECT d.id FROM turniej_druzyny d WHERE d.turniej_id = v_id AND lower(btrim(d.nazwa)) = lower(x.a) ORDER BY d.created_at LIMIT 1),
         (SELECT d.id FROM turniej_druzyny d WHERE d.turniej_id = v_id AND lower(btrim(d.nazwa)) = lower(x.b) ORDER BY d.created_at LIMIT 1),
         v_arena,
         (TIMESTAMP '2026-11-28 00:00' + x.godzina) AT TIME ZONE 'Europe/Warsaw'
    FROM (VALUES
      ( 1, '08:45'::interval, 'A', 'Ekipa Marysi',                   'Młodzi Emeryci'),
      ( 2, '08:57', 'A', 'Fundacja Dobro Się Niesie',      'Natanael i Przyjaciele'),
      ( 3, '09:09', 'A', 'Ekipa Marysi',                   'Club Deportivo Luboń'),
      ( 4, '09:21', 'A', 'Młodzi Emeryci',                 'Fundacja Dobro Się Niesie'),
      ( 5, '09:33', 'A', 'Natanael i Przyjaciele',         'KS Pyry'),
      ( 6, '09:45', 'A', 'Ekipa Marysi',                   'Fundacja Dobro Się Niesie'),
      ( 7, '09:57', 'A', 'Młodzi Emeryci',                 'Club Deportivo Luboń'),
      ( 8, '10:09', 'A', 'Ekipa Marysi',                   'KS Pyry'),
      ( 9, '10:21', 'A', 'Natanael i Przyjaciele',         'Club Deportivo Luboń'),
      (10, '10:33', 'A', 'Fundacja Dobro Się Niesie',      'Rossoneri'),
      (11, '10:45', 'A', 'Ekipa Marysi',                   'Natanael i Przyjaciele'),
      (12, '10:57', 'A', 'KS Pyry',                        'Rossoneri'),
      (13, '11:09', 'B', 'Niedźwiedzie FC',                'Chaos United'),
      (14, '11:21', 'A', 'Ekipa Marysi',                   'Rossoneri'),
      (15, '11:33', 'A', 'Młodzi Emeryci',                 'Natanael i Przyjaciele'),
      (16, '11:45', 'A', 'Fundacja Dobro Się Niesie',      'Club Deportivo Luboń'),
      (17, '11:57', 'A', 'Natanael i Przyjaciele',         'Rossoneri'),
      (18, '12:09', 'B', 'Niedźwiedzie FC',                'Unilink Szamotuły & MedKomplex'),
      (19, '12:21', 'A', 'Fundacja Dobro Się Niesie',      'KS Pyry'),
      (20, '12:33', 'B', 'Chaos United',                   'Unilink Szamotuły & MedKomplex'),
      (21, '13:00', 'A', 'Młodzi Emeryci',                 'KS Pyry'),
      (22, '13:12', 'A', 'Club Deportivo Luboń',           'Rossoneri'),
      (23, '13:24', 'B', 'Niedźwiedzie FC',                'Emar Instalacje'),
      (24, '13:36', 'B', 'Chaos United',                   'Ekipa Fortnite Skurczybyki'),
      (25, '13:48', 'B', 'Unilink Szamotuły & MedKomplex', 'AFC Poznań'),
      (26, '14:00', 'A', 'KS Pyry',                        'Club Deportivo Luboń'),
      (27, '14:12', 'B', 'Emar Instalacje',                'AFC Poznań'),
      (28, '14:24', 'B', 'Niedźwiedzie FC',                'Ekipa Fortnite Skurczybyki'),
      (29, '14:36', 'A', 'Młodzi Emeryci',                 'Rossoneri'),
      (30, '14:48', 'B', 'Emar Instalacje',                'Ekipa Fortnite Skurczybyki'),
      (31, '15:00', 'B', 'Chaos United',                   'AFC Poznań'),
      (32, '15:12', 'B', 'Emar Instalacje',                'Unilink Szamotuły & MedKomplex'),
      (33, '15:24', 'B', 'Niedźwiedzie FC',                'AFC Poznań'),
      (34, '15:36', 'B', 'Unilink Szamotuły & MedKomplex', 'Ekipa Fortnite Skurczybyki'),
      (35, '15:48', 'B', 'Chaos United',                   'Emar Instalacje'),
      (36, '16:00', 'B', 'AFC Poznań',                     'Ekipa Fortnite Skurczybyki')
    ) AS x(numer, godzina, grupa, a, b);

  -- ── 7. O 3. miejsce i finał: drużyny z miejsc w grupach ────────────────
  INSERT INTO turniej_mecze (turniej_id, numer, faza, pozycja_w_drabince, arena_id, zaplanowany_at,
                             zrodlo_a_grupa_id, zrodlo_a_miejsce, zrodlo_b_grupa_id, zrodlo_b_miejsce)
  VALUES
    (v_id, 37, 'o_3_miejsce', 1, v_arena, TIMESTAMP '2026-11-28 16:12' AT TIME ZONE 'Europe/Warsaw',
     v_grupa_a, 2, v_grupa_b, 2),
    (v_id, 38, 'final',       1, v_arena, TIMESTAMP '2026-11-28 16:24' AT TIME ZONE 'Europe/Warsaw',
     v_grupa_a, 1, v_grupa_b, 1);

  -- ── 8. Przerwy z nazwą ─────────────────────────────────────────────────
  INSERT INTO turniej_przerwy (turniej_id, od_at, do_at, nazwa, opis) VALUES
    (v_id, TIMESTAMP '2026-11-28 12:45' AT TIME ZONE 'Europe/Warsaw', TIMESTAMP '2026-11-28 13:00' AT TIME ZONE 'Europe/Warsaw',
     'Konkurs: obijanie poprzeczki', 'Po 1 reprezentancie każdej drużyny'),
    (v_id, TIMESTAMP '2026-11-28 16:34' AT TIME ZONE 'Europe/Warsaw', TIMESTAMP '2026-11-28 16:49' AT TIME ZONE 'Europe/Warsaw',
     'Dekoracja', 'Wręczenie nagród i podziękowania');

  IF EXISTS (SELECT 1 FROM turniej_mecze WHERE turniej_id = v_id AND faza = 'grupa'
              AND (druzyna_a_id IS NULL OR druzyna_b_id IS NULL)) THEN
    RAISE EXCEPTION 'Któryś mecz grupowy nie znalazł drużyny. Sprawdź nazwy w części A.';
  END IF;

  RAISE NOTICE 'Gotowe: 36 meczów grupowych, o 3. miejsce, finał, 2 przerwy.';
END $$;


-- ============================================================================
-- CZĘŚĆ C: SPRAWDZENIE. Niczego nie zmienia.
-- ============================================================================

-- Terminarz dnia, godziny polskie (porównaj z PDF-em).
SELECT m.numer,
       to_char(m.zaplanowany_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI') AS godzina,
       coalesce(g.nazwa, m.faza) AS grupa_lub_faza,
       coalesce(a.nazwa, 'miejsce ' || m.zrodlo_a_miejsce || ' gr. ' || ga.nazwa) AS druzyna_1,
       coalesce(b.nazwa, 'miejsce ' || m.zrodlo_b_miejsce || ' gr. ' || gb.nazwa) AS druzyna_2
  FROM turniej_mecze m
  LEFT JOIN turniej_grupy g ON g.id = m.grupa_id
  LEFT JOIN turniej_grupy ga ON ga.id = m.zrodlo_a_grupa_id
  LEFT JOIN turniej_grupy gb ON gb.id = m.zrodlo_b_grupa_id
  LEFT JOIN turniej_druzyny a ON a.id = m.druzyna_a_id
  LEFT JOIN turniej_druzyny b ON b.id = m.druzyna_b_id
 WHERE m.turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
 ORDER BY m.zaplanowany_at, m.numer;

-- Każda drużyna grupy A gra 6 meczów, grupy B 5.
SELECT g.nazwa AS grupa, d.nazwa AS druzyna,
       (SELECT count(*) FROM turniej_mecze m
         WHERE m.faza = 'grupa' AND (m.druzyna_a_id = d.id OR m.druzyna_b_id = d.id)) AS meczow
  FROM turniej_druzyny d JOIN turniej_grupy g ON g.id = d.grupa_id
 WHERE d.turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
 ORDER BY g.nazwa, d.nazwa;
