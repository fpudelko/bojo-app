-- ============================================================================
-- JEDNORAZOWE ZADANIE: kopia turnieju „dla Marysi” do sprawdzania wyników
-- ============================================================================
--
-- Cel: turniej o tych samych ustawieniach co „dla Marysi” (sport, format,
-- liczba drużyn, grupy, czas meczu, punktacja), ale:
--   • organizatorem jest franekks@gmail.com,
--   • ma KOMPLET drużyn (`max_druzyn`, wszystkie przyjęte, ze składami),
--   • ma gotowy terminarz i status „trwa”, czyli od razu da się wpisywać
--     wyniki (szybko: sam wynik końcowy, albo na żywo: gole ze strzelcami),
--   • jest widoczny wyłącznie z linku (`na_link`), nie na liście turniejów.
--
-- NIKT PRAWDZIWY NIE DOSTANIE POWIADOMIENIA. Z oryginału kopiujemy WYŁĄCZNIE
-- nazwy drużyn. Zawodnicy kopii to wymyślone nazwiska BEZ kont (`user_id`
-- NULL), a drużyny nie mają kapitanów. Bez tego każdy wpisany wynik i każdy
-- zapisany terminarz wysyłałby push do ludzi z turnieju Marysi (wyzwalacze
-- z migracji 146 i 155 powiadamiają zawodników z kontami).
--
-- Terminarz liczy ten skrypt sam, tą samą metodą co aplikacja
-- (`frontend/src/lib/turniejFormat.ts`): karuzela „każdy z każdym” dla grup
-- i ligi, drabinka z rozstawieniem i wolnymi losami dla pucharu. Przy
-- formacie „grupy → puchar” powstaje wyłącznie faza grupowa, tak jak
-- w panelu.
--
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzednią kopię po
-- markerze `[TURNIEJ-TEST]` w opisie (ten sam marker sprząta
-- `supabase/wyczysc-testowe.sql`) i zakłada wszystko od nowa.
--
-- CZĘŚĆ A niczego nie zmienia: pokazuje, który turniej zostanie skopiowany.
-- CZĘŚĆ B zapisuje. Uruchamiane RĘCZNIE w Supabase → SQL Editor.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A: PODGLĄD. Musi wyjść DOKŁADNIE jeden wiersz.
-- ============================================================================

SELECT
  t.id, t.nazwa, t.status, t.sport, t.format, t.max_druzyn, t.liczba_grup,
  (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id) AS druzyn,
  (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id)   AS meczow,
  coalesce(p.display_name, '(brak profilu)')                         AS organizator,
  '/turnieje/' || t.id                                               AS adres
FROM turnieje t
LEFT JOIN profiles p ON p.id = t.organizator_id
WHERE t.nazwa ILIKE '%marysi%'
  AND coalesce(t.opis, '') NOT LIKE '[TURNIEJ-TEST]%';


-- ============================================================================
-- CZĘŚĆ B: KOPIA. Uruchom po sprawdzeniu części A.
-- ============================================================================

DO $$
DECLARE
  imiona   CONSTANT text[] := ARRAY['Kamil','Bartek','Michał','Tomek','Paweł','Adrian',
                                    'Sebastian','Marcin','Łukasz','Damian','Kuba','Olek'];
  nazwiska CONSTANT text[] := ARRAY['Nowak','Wójcik','Kowalczyk','Lewandowski','Zieliński',
                                    'Szymański','Woźniak','Dąbrowski','Kozłowski','Jankowski',
                                    'Mazur','Krawczyk','Piotrowski','Grabowski','Pawlak','Michalski'];
  litery   CONSTANT text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];
  fazy     CONSTANT text[] := ARRAY['final','polfinal','cwierc','1/8','1/16','1/32'];

  me      uuid := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  src     turnieje%ROWTYPE;
  ile_src int;
  v_id    uuid;
  n       int;           -- liczba drużyn kopii
  sklad   int;           -- zawodników w drużynie
  g       int;           -- liczba grup
  druzyny uuid[] := '{}';
  los     int[];
  grupy   uuid[] := '{}';
  areny   uuid[];
  v_druzyna uuid;
  v_nazwa text;
  v_numer int := 1;
  i int; j int; k int;

  -- karuzela
  lista uuid[]; m int; pol int; a uuid; b uuid;
  -- drabinka
  rozmiar int; rund int; siew int[]; nowa int[]; s int;
  poprzednia uuid[]; biezaca uuid[]; mecz uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users.';
  END IF;

  SELECT count(*) INTO ile_src FROM turnieje
   WHERE nazwa ILIKE '%marysi%' AND coalesce(opis, '') NOT LIKE '[TURNIEJ-TEST]%';
  IF ile_src <> 1 THEN
    RAISE EXCEPTION 'Nazwę „%%marysi%%” ma % turniejów zamiast jednego. Zawęź warunek w części A i B.', ile_src;
  END IF;
  SELECT * INTO src FROM turnieje
   WHERE nazwa ILIKE '%marysi%' AND coalesce(opis, '') NOT LIKE '[TURNIEJ-TEST]%';

  DELETE FROM turnieje WHERE opis LIKE '[TURNIEJ-TEST]%' AND organizator_id = me;

  -- ── Turniej ───────────────────────────────────────────────────────────────
  INSERT INTO turnieje (
    organizator_id, nazwa, sport, format, status, widocznosc,
    field_id, miejsce_nazwa, miejsce_adres, lat, lng, miasto,
    data_startu, data_konca, godzina_startu, zapisy_do,
    max_druzyn, min_druzyn, min_zawodnikow, max_zawodnikow, graczy_w_polu,
    liczba_grup, awansuje_z_grupy, mecz_o_3_miejsce, czas_meczu_min, przerwa_min,
    punkty_za_wygrana, punkty_za_remis, karne_przy_remisie,
    wpisowe_grosz, regulamin, opis, wymaga_akceptacji
  ) VALUES (
    me, left('TEST wyników: ' || src.nazwa, 80), src.sport, src.format, 'trwa', 'na_link',
    src.field_id, src.miejsce_nazwa, src.miejsce_adres, src.lat, src.lng, src.miasto,
    CURRENT_DATE, NULL, src.godzina_startu, NULL,
    src.max_druzyn, src.min_druzyn, src.min_zawodnikow, src.max_zawodnikow, src.graczy_w_polu,
    src.liczba_grup, src.awansuje_z_grupy, src.mecz_o_3_miejsce, src.czas_meczu_min, src.przerwa_min,
    src.punkty_za_wygrana, src.punkty_za_remis, src.karne_przy_remisie,
    src.wpisowe_grosz, src.regulamin,
    '[TURNIEJ-TEST] Kopia turnieju „' || src.nazwa || '” do sprawdzania wpisywania wyników. '
      || 'Zawodnicy są wymyśleni i nie mają kont.',
    false
  ) RETURNING id INTO v_id;

  -- ── Areny: te same co w oryginale (wyzwalacz założył już „Boisko 1”) ─────
  IF EXISTS (SELECT 1 FROM turniej_areny WHERE turniej_id = src.id) THEN
    DELETE FROM turniej_areny WHERE turniej_id = v_id;
    INSERT INTO turniej_areny (turniej_id, nazwa, kolejnosc)
    SELECT v_id, nazwa, kolejnosc FROM turniej_areny WHERE turniej_id = src.id;
  END IF;
  SELECT array_agg(id ORDER BY kolejnosc, nazwa) INTO areny FROM turniej_areny WHERE turniej_id = v_id;

  -- ── Drużyny: nazwy z oryginału, reszta do kompletu ────────────────────────
  n := src.max_druzyn;
  sklad := greatest(src.min_zawodnikow, least(coalesce(src.graczy_w_polu, 5) + 2, src.max_zawodnikow));

  -- ── Grupy (tylko „grupy → puchar”), PRZED drużynami ───────────────────────
  -- Grupę dostaje drużyna już przy INSERT. `UPDATE grupa_id` z SQL Editora
  -- cofnąłby wyzwalacz `pilnuj_wlasnej_druzyny` (145): bez `auth.uid()` nikt
  -- nie „zarządza drużynami”, więc przydział wraca do poprzedniej wartości.
  IF src.format = 'grupy_puchar' THEN
    -- `domyslnaLiczbaGrup()` z turniejFormat.ts, gdy oryginał nie ma ustawionej
    g := src.liczba_grup;
    IF g IS NULL THEN
      g := CASE WHEN n <= 4 THEN 1 ELSE greatest(1, round(n / 4.0)::int) END;
      WHILE g > 1 AND n::numeric / g < 3 LOOP g := g - 1; END LOOP;
    END IF;
    g := greatest(1, least(g, n / 2));

    FOR k IN 1 .. g LOOP
      INSERT INTO turniej_grupy (turniej_id, nazwa) VALUES (v_id, litery[k]) RETURNING id INTO mecz;
      grupy := grupy || mecz;
    END LOOP;
  END IF;
  -- Losowanie jak `rozlosujGrupy()`: tasowanie, potem po kolei do grup.
  los := ARRAY(SELECT x FROM generate_series(1, n) x ORDER BY random());

  FOR i IN 1 .. n LOOP
    SELECT d.nazwa INTO v_nazwa FROM turniej_druzyny d
     WHERE d.turniej_id = src.id AND d.status IN ('przyjeta','zgloszona','rezerwa')
     ORDER BY (d.status = 'przyjeta') DESC, d.created_at, d.nazwa
     OFFSET i - 1 LIMIT 1;
    IF v_nazwa IS NULL THEN v_nazwa := 'Drużyna testowa ' || i; END IF;

    INSERT INTO turniej_druzyny (
      turniej_id, nazwa, status, grupa_id, dodana_recznie, regulamin_zaakceptowany_at, wpisowe_oplacone_at
    ) VALUES (
      v_id, v_nazwa, 'przyjeta',
      CASE WHEN src.format = 'grupy_puchar' THEN grupy[((los[i] - 1) % g) + 1] END,
      true, now(), CASE WHEN src.wpisowe_grosz > 0 THEN now() END
    ) RETURNING id INTO v_druzyna;
    druzyny := druzyny || v_druzyna;

    -- Skok o 5 po imionach i o 7 po nazwiskach (względnie pierwsze z 12 i 16),
    -- żeby w jednej drużynie nie wyszło pięciu Nowaków.
    FOR j IN 1 .. sklad LOOP
      INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie, numer, kapitan)
      VALUES (
        v_druzyna, v_id,
        imiona[((i * 5 + j) % 12) + 1] || ' ' || nazwiska[((i + j * 7) % 16) + 1],
        j, j = 1
      );
    END LOOP;
    v_nazwa := NULL;
  END LOOP;

  -- ── Terminarz ─────────────────────────────────────────────────────────────
  IF src.format IN ('grupy_puchar','liga') THEN
    -- Karuzela „każdy z każdym”, port `meczeKazdyZKazdym()`. NULL = pauza.
    FOR k IN 1 .. CASE WHEN src.format = 'liga' THEN 1 ELSE g END LOOP
      IF src.format = 'liga' THEN
        lista := druzyny;
      ELSE
        lista := ARRAY(SELECT id FROM turniej_druzyny WHERE grupa_id = grupy[k] ORDER BY random());
      END IF;
      IF array_length(lista, 1) % 2 = 1 THEN lista := lista || NULL::uuid; END IF;
      m := array_length(lista, 1);
      pol := m / 2;

      FOR j IN 1 .. m - 1 LOOP            -- kolejka
        FOR i IN 1 .. pol LOOP
          a := lista[i];
          b := lista[m + 1 - i];
          IF a IS NOT NULL AND b IS NOT NULL THEN
            INSERT INTO turniej_mecze (turniej_id, numer, faza, grupa_id, kolejka, druzyna_a_id, druzyna_b_id)
            VALUES (
              v_id, v_numer,
              CASE WHEN src.format = 'liga' THEN 'liga' ELSE 'grupa' END,
              CASE WHEN src.format = 'liga' THEN NULL ELSE grupy[k] END,
              j,
              CASE WHEN j % 2 = 1 THEN a ELSE b END,
              CASE WHEN j % 2 = 1 THEN b ELSE a END
            );
            v_numer := v_numer + 1;
          END IF;
        END LOOP;
        -- pozycja 1 stoi, reszta obraca się o jedno miejsce
        lista := ARRAY[lista[1], lista[m]] || lista[2 : m - 1];
      END LOOP;
    END LOOP;

    -- Numery po kolejkach, nie po grupach: wtedy M1, M2, M3… idą w kolejności
    -- gry, tak jak wychodzi z `ulozHarmonogram()`. Dwa kroki, bo numer jest
    -- unikalny w turnieju.
    UPDATE turniej_mecze SET numer = -numer WHERE turniej_id = v_id;
    UPDATE turniej_mecze t SET numer = x.nowy
      FROM (SELECT id, row_number() OVER (ORDER BY kolejka, -numer) AS nowy
              FROM turniej_mecze WHERE turniej_id = v_id) x
     WHERE t.id = x.id;

  ELSE
    -- Puchar: port `zbudujDrabinke()` z rozstawieniem 1-8-4-5-2-7-3-6.
    druzyny := ARRAY(SELECT x FROM unnest(druzyny) x ORDER BY random());
    rozmiar := 1;
    WHILE rozmiar < n LOOP rozmiar := rozmiar * 2; END LOOP;
    rund := round(log(2, rozmiar))::int;

    siew := ARRAY[1];
    WHILE array_length(siew, 1) < rozmiar LOOP
      nowa := '{}';
      FOREACH s IN ARRAY siew LOOP
        nowa := nowa || s || (array_length(siew, 1) * 2 + 1 - s);
      END LOOP;
      siew := nowa;
    END LOOP;

    poprzednia := '{}';
    FOR i IN 0 .. rozmiar / 2 - 1 LOOP
      a := druzyny[siew[2 * i + 1]];   -- poza zakresem tablicy = NULL = wolny los
      b := druzyny[siew[2 * i + 2]];
      INSERT INTO turniej_mecze (
        turniej_id, numer, faza, kolejka, pozycja_w_drabince, druzyna_a_id, druzyna_b_id,
        status, zwyciezca_id, walkower_dla
      ) VALUES (
        v_id, v_numer, fazy[rund], 1, i, a, b,
        CASE WHEN a IS NULL OR b IS NULL THEN 'walkower' ELSE 'zaplanowany' END,
        CASE WHEN b IS NULL THEN a WHEN a IS NULL THEN b END,
        CASE WHEN b IS NULL THEN a WHEN a IS NULL THEN b END
      ) RETURNING id INTO mecz;
      poprzednia := poprzednia || mecz;
      v_numer := v_numer + 1;
    END LOOP;

    FOR k IN 2 .. rund LOOP
      biezaca := '{}';
      FOR i IN 0 .. array_length(poprzednia, 1) / 2 - 1 LOOP
        INSERT INTO turniej_mecze (
          turniej_id, numer, faza, kolejka, pozycja_w_drabince,
          zrodlo_a_mecz_id, zrodlo_a_typ, zrodlo_b_mecz_id, zrodlo_b_typ
        ) VALUES (
          v_id, v_numer, fazy[rund - k + 1], k, i,
          poprzednia[2 * i + 1], 'zwyciezca', poprzednia[2 * i + 2], 'zwyciezca'
        ) RETURNING id INTO mecz;
        biezaca := biezaca || mecz;
        v_numer := v_numer + 1;
      END LOOP;
      IF k = rund AND src.mecz_o_3_miejsce AND rund >= 2 THEN
        INSERT INTO turniej_mecze (
          turniej_id, numer, faza, kolejka,
          zrodlo_a_mecz_id, zrodlo_a_typ, zrodlo_b_mecz_id, zrodlo_b_typ
        ) VALUES (
          v_id, v_numer, 'o_3_miejsce', rund,
          poprzednia[1], 'przegrany', poprzednia[2], 'przegrany'
        );
      END IF;
      poprzednia := biezaca;
    END LOOP;

    -- Wolne losy przechodzą do 2. rundy od razu, jak w `zapisz_terminarz()`.
    PERFORM propaguj_zwyciezce_dla(id) FROM turniej_mecze
     WHERE turniej_id = v_id AND status = 'walkower';
  END IF;

  -- ── Godziny: port `ulozHarmonogram()`. Kolejka po kolejce, mecze tej samej
  -- kolejki równolegle na arenach, nadmiar w kolejnych „falach”. Godziny są
  -- tylko podpowiedzią: aplikacja niczego na nich nie blokuje.
  WITH plan AS (
    SELECT id, kolejka,
           (row_number() OVER (PARTITION BY kolejka ORDER BY numer) - 1) AS poz
      FROM turniej_mecze WHERE turniej_id = v_id AND status = 'zaplanowany'
  ), fale AS (
    SELECT kolejka, ceil(count(*)::numeric / array_length(areny, 1))::int AS fal
      FROM plan GROUP BY kolejka
  ), przed AS (
    SELECT kolejka, coalesce(sum(fal) OVER (ORDER BY kolejka ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS fal_przed
      FROM fale
  )
  UPDATE turniej_mecze t SET
    arena_id = areny[(p.poz % array_length(areny, 1)) + 1],
    zaplanowany_at = ((CURRENT_DATE + src.godzina_startu) AT TIME ZONE 'Europe/Warsaw')
      + ((pr.fal_przed + p.poz / array_length(areny, 1)) * (src.czas_meczu_min + src.przerwa_min)) * interval '1 minute'
    FROM plan p JOIN przed pr USING (kolejka)
   WHERE t.id = p.id;

  RAISE NOTICE 'Gotowe: /turnieje/% (% drużyn, % meczów)', v_id, n,
    (SELECT count(*) FROM turniej_mecze WHERE turniej_id = v_id);
END $$;


-- Adres kopii — otwórz go zalogowany jako franekks@gmail.com.
SELECT nazwa, status, '/turnieje/' || id AS adres, '/turnieje/' || id || '/panel' AS panel
FROM turnieje WHERE opis LIKE '[TURNIEJ-TEST]%';
