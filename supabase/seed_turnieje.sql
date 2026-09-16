-- ============================================================
-- Bojo — dane testowe: TURNIEJE ROZEGRANE (marker [TUR], TU1…TU6)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg po
-- markerze "[TUR]" w opisie i tworzy wszystko od nowa.
--
-- PO CO. Pozostałe seedy turniejowe zostawiają turniej na etapie ZAPISÓW —
-- a widoki, których nie da się inaczej zobaczyć, zaczynają się dopiero
-- PO pierwszym gwizdku: tabela grupy z podświetleniem awansujących, drabinka
-- z wynikami, klasyfikacja strzelców, mecz rozstrzygnięty karnymi, walkower.
-- Doprowadzenie turnieju do finału przez interfejs to kilkadziesiąt kliknięć,
-- więc w praktyce nikt tych ekranów nie oglądał inaczej niż na produkcji.
--
-- Sześć turniejów, każdy zatrzymany na INNYM etapie:
--   TU1  zakończony w całości, finał rozstrzygnięty KARNYMI, jest mistrz
--   TU2  faza grupowa w połowie — część meczów rozegrana, drabinki jeszcze nie ma
--   TU3  grupy zamknięte, drabinka w połowie — półfinały po, finał przed
--   TU4  liga (każdy z każdym), rozegrana w 2/3, koszykówka — bez drabinki
--   TU5  puchar bez grup, z WALKOWEREM w ćwierćfinale, zakończony
--   TU6  mecz NA ŻYWO w trakcie fazy grupowej
--
-- WYMAGANIA:
--   • konto franekks@gmail.com w auth.users (zaloguj się raz do apki)
--   • migracje 145 i 146 — bez nich nie ma czego wypełniać
--   • migracja 147 jest OPCJONALNA: z nią gole wchodzą jako zdarzenia i działa
--     klasyfikacja strzelców, bez niej wynik zapisuje się wprost, a strzelcy
--     zostają puści. Skrypt sam sprawdza, co jest w bazie.
-- ============================================================

DELETE FROM turnieje WHERE opis LIKE '[TUR]%';

DO $$
DECLARE
  me UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do apki i uruchom ponownie.';
  END IF;
  IF to_regclass('public.turniej_mecze') IS NULL THEN
    RAISE EXCEPTION 'Brak tabeli `turniej_mecze` — uruchom migracje 145 i 146.';
  END IF;
END $$;


-- ── Narzędzia seeda ─────────────────────────────────────────────────────────
-- W `pg_temp`, czyli znikają razem z sesją SQL Editora. To NIE są funkcje
-- aplikacji — nic w repo ich nie woła, a migracja nie ma prawa ich zobaczyć.

CREATE OR REPLACE FUNCTION pg_temp.nowy_turniej(
  p_nazwa text, p_sport text, p_format text, p_status text,
  p_liczba_grup int, p_awansuje int, p_dni_od_dzis int, p_opis text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO turnieje (
    organizator_id, nazwa, sport, format, status, widocznosc,
    miejsce_nazwa, miasto, data_startu, godzina_startu,
    max_druzyn, min_zawodnikow, max_zawodnikow, graczy_w_polu,
    liczba_grup, awansuje_z_grupy, mecz_o_3_miejsce,
    czas_meczu_min, przerwa_min, wpisowe_grosz, wymaga_akceptacji, opis
  ) VALUES (
    (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com'),
    p_nazwa, p_sport, p_format, p_status, 'publiczny',
    'Boisko Orlik Rataje', 'Poznań', CURRENT_DATE + p_dni_od_dzis, '10:00',
    16, 5, 12, CASE WHEN p_sport = 'koszykówka' THEN 5 ELSE 6 END,
    p_liczba_grup, p_awansuje, true,
    15, 5, 5000, false, '[TUR] ' || p_opis
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.grupa(p_turniej uuid, p_nazwa text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO turniej_grupy (turniej_id, nazwa) VALUES (p_turniej, p_nazwa) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Drużyna razem ze składem: 7 zawodników z numerami 1–7, kapitan z numerem 1.
-- Skład jest tu po to, żeby gole miały komu się przypisać w klasyfikacji.
CREATE OR REPLACE FUNCTION pg_temp.druzyna(
  p_turniej uuid, p_nazwa text, p_grupa uuid, p_rozstawienie int
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  imiona CONSTANT text[] := ARRAY['Kamil','Bartek','Michał','Tomek','Paweł','Adrian','Sebastian'];
  j int;
BEGIN
  INSERT INTO turniej_druzyny (
    turniej_id, nazwa, status, grupa_id, rozstawienie, dodana_recznie,
    regulamin_zaakceptowany_at, wpisowe_oplacone_at
  ) VALUES (
    p_turniej, p_nazwa, 'przyjeta', p_grupa, p_rozstawienie, true, now(), now()
  ) RETURNING id INTO v_id;

  FOR j IN 1 .. 7 LOOP
    INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie, numer, kapitan)
    VALUES (v_id, p_turniej, imiona[j] || ' ' || left(p_nazwa, 1) || '.', j, j = 1);
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.mecz(
  p_turniej uuid, p_numer int, p_faza text, p_grupa uuid, p_kolejka int,
  p_a uuid, p_b uuid, p_godzin_od_startu int
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_start date;
BEGIN
  SELECT data_startu INTO v_start FROM turnieje WHERE id = p_turniej;
  INSERT INTO turniej_mecze (
    turniej_id, numer, faza, grupa_id, kolejka, druzyna_a_id, druzyna_b_id,
    arena_id, zaplanowany_at
  ) VALUES (
    p_turniej, p_numer, p_faza, p_grupa, p_kolejka, p_a, p_b,
    (SELECT id FROM turniej_areny WHERE turniej_id = p_turniej ORDER BY created_at LIMIT 1),
    (v_start + time '10:00' + (p_godzin_od_startu || ' hours')::interval)::timestamptz
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Mecz drabinki, którego uczestnicy jeszcze nie są znani — sloty wypełni
-- wyzwalacz `propaguj_zwyciezce` (146), gdy skończy się mecz źródłowy.
CREATE OR REPLACE FUNCTION pg_temp.mecz_ze_slotow(
  p_turniej uuid, p_numer int, p_faza text, p_kolejka int,
  p_zrodlo_a uuid, p_typ_a text, p_zrodlo_b uuid, p_typ_b text, p_godzin_od_startu int
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_start date;
BEGIN
  SELECT data_startu INTO v_start FROM turnieje WHERE id = p_turniej;
  INSERT INTO turniej_mecze (
    turniej_id, numer, faza, kolejka,
    zrodlo_a_mecz_id, zrodlo_a_typ, zrodlo_b_mecz_id, zrodlo_b_typ,
    arena_id, zaplanowany_at
  ) VALUES (
    p_turniej, p_numer, p_faza, p_kolejka,
    p_zrodlo_a, p_typ_a, p_zrodlo_b, p_typ_b,
    (SELECT id FROM turniej_areny WHERE turniej_id = p_turniej ORDER BY created_at LIMIT 1),
    (v_start + time '10:00' + (p_godzin_od_startu || ' hours')::interval)::timestamptz
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Rozegranie meczu. Gole wchodzą jako ZDARZENIA, gdy wgrana jest migracja 147
-- — wtedy wynik przelicza wyzwalacz `trg_zdarzenia_przelicz`, dokładnie tak
-- jak przy prowadzeniu meczu z konsoli, i działa klasyfikacja strzelców.
-- Bez 147 wynik zapisuje się wprost, a strzelcy zostają puści.
--
-- Zwycięzcę wyznaczamy TAK SAMO jak `zakoncz_mecz()` (147): wynik, a przy
-- remisie karne. Samego `zakoncz_mecz()` wołać się nie da — sprawdza
-- `czy_prowadzi_mecz()`, czyli `auth.uid()`, a w SQL Editorze nie ma nikogo
-- zalogowanego.
CREATE OR REPLACE FUNCTION pg_temp.zagraj(
  p_mecz uuid, p_a int, p_b int, p_karne_a int DEFAULT NULL, p_karne_b int DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v turniej_mecze%ROWTYPE;
  v_zwyciezca uuid;
  v_typ text;
  i int;
BEGIN
  SELECT * INTO v FROM turniej_mecze WHERE id = p_mecz;

  IF to_regclass('public.turniej_zdarzenia') IS NOT NULL THEN
    v_typ := CASE WHEN (SELECT sport FROM turnieje WHERE id = v.turniej_id) = 'koszykówka'
                  THEN 'punkty' ELSE 'gol' END;
    FOR i IN 1 .. p_a LOOP
      EXECUTE 'INSERT INTO turniej_zdarzenia (mecz_id, turniej_id, druzyna_id, zawodnik_id, typ, wartosc, minuta)
               VALUES ($1, $2, $3, (SELECT id FROM turniej_zawodnicy WHERE druzyna_id = $3 AND numer = $4), $5, 1, $6)'
        USING p_mecz, v.turniej_id, v.druzyna_a_id, ((i - 1) % 7) + 1, v_typ, least(i * 3, 90);
    END LOOP;
    FOR i IN 1 .. p_b LOOP
      EXECUTE 'INSERT INTO turniej_zdarzenia (mecz_id, turniej_id, druzyna_id, zawodnik_id, typ, wartosc, minuta)
               VALUES ($1, $2, $3, (SELECT id FROM turniej_zawodnicy WHERE druzyna_id = $3 AND numer = $4), $5, 1, $6)'
        USING p_mecz, v.turniej_id, v.druzyna_b_id, ((i + 2) % 7) + 1, v_typ, least(i * 4, 90);
    END LOOP;
  END IF;

  IF p_a > p_b THEN v_zwyciezca := v.druzyna_a_id;
  ELSIF p_b > p_a THEN v_zwyciezca := v.druzyna_b_id;
  ELSIF p_karne_a IS NOT NULL AND p_karne_a <> p_karne_b THEN
    v_zwyciezca := CASE WHEN p_karne_a > p_karne_b THEN v.druzyna_a_id ELSE v.druzyna_b_id END;
  ELSE v_zwyciezca := NULL;
  END IF;

  IF v.faza NOT IN ('grupa','liga') AND v_zwyciezca IS NULL THEN
    RAISE EXCEPTION 'Mecz M% (%) to remis w fazie pucharowej — podaj karne.', v.numer, v.faza;
  END IF;

  UPDATE turniej_mecze SET
    wynik_a = p_a, wynik_b = p_b, wynik_recznie = (to_regclass('public.turniej_zdarzenia') IS NULL),
    karne_a = p_karne_a, karne_b = p_karne_b,
    status = 'zakonczony', zwyciezca_id = v_zwyciezca,
    rozpoczety_at = zaplanowany_at,
    zakonczony_at = zaplanowany_at + interval '20 minutes'
  WHERE id = p_mecz;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.walkower(p_mecz uuid, p_dla uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE turniej_mecze SET
    status = 'walkower', walkower_dla = p_dla, zwyciezca_id = p_dla,
    wynik_a = 0, wynik_b = 0, wynik_recznie = true,
    zakonczony_at = zaplanowany_at,
    notatka = 'Drużyna nie stawiła się na mecz.'
  WHERE id = p_mecz;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.na_zywo(p_mecz uuid, p_a int, p_b int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE turniej_mecze SET status = 'trwa', wynik_a = p_a, wynik_b = p_b,
    wynik_recznie = true, rozpoczety_at = now() - interval '8 minutes'
  WHERE id = p_mecz;
END $$;

-- Kto wychodzi z grupy — TA SAMA kolejność, co liczy `posortujTabele()`
-- (`lib/turniejTabela.ts`): punkty → różnica → bramki zdobyte → nazwa.
-- Gdyby te dwie kolejności się rozjechały, drabinka pokazywałaby drużynę,
-- której tabela obok nie stawia w strefie awansu — czyli seed sam produkowałby
-- obraz wyglądający na błąd aplikacji.
CREATE OR REPLACE FUNCTION pg_temp.z_grupy(p_grupa uuid, p_miejsce int)
RETURNS uuid LANGUAGE sql AS $$
  WITH rozegrane AS (
    SELECT m.druzyna_a_id AS dom, m.druzyna_b_id AS gosc, m.wynik_a AS bd, m.wynik_b AS bg, m.zwyciezca_id
      FROM turniej_mecze m WHERE m.grupa_id = p_grupa AND m.status IN ('zakonczony','walkower')
  ), strony AS (
    SELECT dom AS druzyna, bd AS zdobyte, bg AS stracone, zwyciezca_id FROM rozegrane
    UNION ALL
    SELECT gosc,           bg,            bd,             zwyciezca_id FROM rozegrane
  ), dorobek AS (
    SELECT d.id, d.nazwa,
      coalesce(sum(CASE WHEN s.zwyciezca_id = d.id THEN t.punkty_za_wygrana
                        WHEN s.zwyciezca_id IS NULL THEN t.punkty_za_remis
                        ELSE 0 END), 0)                     AS punkty,
      coalesce(sum(s.zdobyte), 0) - coalesce(sum(s.stracone), 0) AS roznica,
      coalesce(sum(s.zdobyte), 0)                           AS zdobyte
    FROM turniej_druzyny d
    JOIN turnieje t ON t.id = d.turniej_id
    LEFT JOIN strony s ON s.druzyna = d.id
    WHERE d.grupa_id = p_grupa
    GROUP BY d.id, d.nazwa
  )
  SELECT id FROM dorobek
  ORDER BY punkty DESC, roznica DESC, zdobyte DESC, nazwa
  OFFSET p_miejsce - 1 LIMIT 1;
$$;

-- Komplet meczów grupy czteroosobowej metodą karuzeli — ta sama kolejność par
-- i ta sama zamiana gospodarza co `meczeKazdyZKazdym()` (`lib/turniejFormat.ts`):
-- k1: 1-4, 2-3 · k2: 3-1, 2-4 · k3: 1-2, 3-4.
CREATE OR REPLACE FUNCTION pg_temp.grupa_czworka(
  p_turniej uuid, p_grupa uuid, p_numer_od int, p_d uuid[]
) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE
  pary CONSTANT int[][] := ARRAY[[1,4,1],[2,3,1],[3,1,2],[2,4,2],[1,2,3],[3,4,3]];
  wynik uuid[] := '{}';
  i int;
BEGIN
  FOR i IN 1 .. 6 LOOP
    wynik := wynik || pg_temp.mecz(
      p_turniej, p_numer_od + i - 1, 'grupa', p_grupa, pary[i][3],
      p_d[pary[i][1]], p_d[pary[i][2]], (i - 1)
    );
  END LOOP;
  RETURN wynik;
END $$;


-- ── TU1 — turniej zakończony w całości, finał na karne ──────────────────────
DO $$
DECLARE
  t uuid; gA uuid; gB uuid; a uuid[]; b uuid[]; mA uuid[]; mB uuid[];
  sf1 uuid; sf2 uuid; m3 uuid; fin uuid;
BEGIN
  t := pg_temp.nowy_turniej('TU1 Puchar Rataj — zakończony', 'piłka nożna', 'grupy_puchar',
       'zakonczony', 2, 2, -21,
       'SPRAWDŹ: pełny turniej od grupy do finału. Tabele grup z podświetleniem awansu, '
       'drabinka z wynikami, finał rozstrzygnięty karnymi (1:1, k. 4:3), klasyfikacja strzelców.');
  gA := pg_temp.grupa(t, 'A');
  gB := pg_temp.grupa(t, 'B');

  a := ARRAY[
    pg_temp.druzyna(t, 'Dragon Team',     gA, 1),
    pg_temp.druzyna(t, 'FC Rataje',       gA, 2),
    pg_temp.druzyna(t, 'Wilki Grunwald',  gA, 3),
    pg_temp.druzyna(t, 'Amatorzy Dębiec', gA, 4)];
  b := ARRAY[
    pg_temp.druzyna(t, 'Stara Gwardia',   gB, 5),
    pg_temp.druzyna(t, 'Górna Wilda FC',  gB, 6),
    pg_temp.druzyna(t, 'Junaki Jeżyce',   gB, 7),
    pg_temp.druzyna(t, 'Sokoły Sołacz',   gB, 8)];

  mA := pg_temp.grupa_czworka(t, gA, 1, a);
  mB := pg_temp.grupa_czworka(t, gB, 7, b);

  -- Grupa A kończy się: Dragon 7 pkt, Wilki 5, Rataje 4, Dębiec 0 — awansują dwa pierwsze.
  PERFORM pg_temp.zagraj(mA[1], 3, 1);   -- Dragon  – Dębiec
  PERFORM pg_temp.zagraj(mA[2], 2, 2);   -- Rataje  – Wilki
  PERFORM pg_temp.zagraj(mA[3], 1, 1);   -- Wilki   – Dragon
  PERFORM pg_temp.zagraj(mA[4], 4, 0);   -- Rataje  – Dębiec
  PERFORM pg_temp.zagraj(mA[5], 2, 0);   -- Dragon  – Rataje
  PERFORM pg_temp.zagraj(mA[6], 3, 1);   -- Wilki   – Dębiec

  -- Grupa B: Gwardia i Wilda po 7 pkt — o pierwsze miejsce rozstrzyga RÓŻNICA BRAMEK
  -- (+4 do +3), czyli dokładnie ten tie-break, który liczy `posortujTabele()`.
  -- Dalej Jeżyce 3, Sołacz 0.
  PERFORM pg_temp.zagraj(mB[1], 2, 0);   -- Gwardia – Sołacz
  PERFORM pg_temp.zagraj(mB[2], 3, 1);   -- Wilda   – Jeżyce
  PERFORM pg_temp.zagraj(mB[3], 0, 2);   -- Jeżyce  – Gwardia
  PERFORM pg_temp.zagraj(mB[4], 2, 1);   -- Wilda   – Sołacz
  PERFORM pg_temp.zagraj(mB[5], 1, 1);   -- Gwardia – Wilda
  PERFORM pg_temp.zagraj(mB[6], 2, 1);   -- Jeżyce  – Sołacz

  -- Krzyżowo: zwycięzca A z drugim B. Drabinka dostaje drużyny WPROST, bo
  -- grupy są już rozstrzygnięte — `z_grupy()` czyta tę samą kolejność, którą
  -- pokazuje tabela obok.
  sf1 := pg_temp.mecz(t, 13, 'polfinal', NULL, 1, pg_temp.z_grupy(gA, 1), pg_temp.z_grupy(gB, 2), 6);
  sf2 := pg_temp.mecz(t, 14, 'polfinal', NULL, 1, pg_temp.z_grupy(gB, 1), pg_temp.z_grupy(gA, 2), 7);
  m3  := pg_temp.mecz_ze_slotow(t, 15, 'o_3_miejsce', 2, sf1, 'przegrany', sf2, 'przegrany', 8);
  fin := pg_temp.mecz_ze_slotow(t, 16, 'final',       2, sf1, 'zwyciezca', sf2, 'zwyciezca', 9);

  PERFORM pg_temp.zagraj(sf1, 2, 1);
  PERFORM pg_temp.zagraj(sf2, 0, 1);
  PERFORM pg_temp.zagraj(m3,  3, 2);
  PERFORM pg_temp.zagraj(fin, 1, 1, 4, 3);   -- karne — nowa linijka „k. 4:3" na karcie

  UPDATE turnieje SET mvp_zawodnik_id =
    (SELECT id FROM turniej_zawodnicy WHERE druzyna_id = a[1] AND numer = 1) WHERE id = t;
END $$;


-- ── TU2 — faza grupowa w połowie, drabinki jeszcze nie ma ───────────────────
DO $$
DECLARE t uuid; gA uuid; gB uuid; a uuid[]; b uuid[]; mA uuid[]; mB uuid[];
BEGIN
  t := pg_temp.nowy_turniej('TU2 Liga Piątek — trwa faza grupowa', 'piłka nożna', 'grupy_puchar',
       'trwa', 2, 2, -1,
       'SPRAWDŹ: tabela liczona z NIEPEŁNEJ grupy — po dwóch kolejkach z trzech. '
       'Zakładka Wyniki ma tabele, ale sekcji „Drabinka" nie ma wcale (nie wygenerowano).');
  gA := pg_temp.grupa(t, 'A');
  gB := pg_temp.grupa(t, 'B');
  a := ARRAY[
    pg_temp.druzyna(t, 'Orły Naramowice', gA, 1), pg_temp.druzyna(t, 'Piast Winogrady', gA, 2),
    pg_temp.druzyna(t, 'Huragan Podolany', gA, 3), pg_temp.druzyna(t, 'Zenit Zawady', gA, 4)];
  b := ARRAY[
    pg_temp.druzyna(t, 'Start Starołęka', gB, 5), pg_temp.druzyna(t, 'Malta United', gB, 6),
    pg_temp.druzyna(t, 'Cytadela FC', gB, 7), pg_temp.druzyna(t, 'Łazarz Boys', gB, 8)];
  mA := pg_temp.grupa_czworka(t, gA, 1, a);
  mB := pg_temp.grupa_czworka(t, gB, 7, b);

  -- Dwie pierwsze kolejki rozegrane, trzecia czeka.
  PERFORM pg_temp.zagraj(mA[1], 1, 0);
  PERFORM pg_temp.zagraj(mA[2], 2, 2);
  PERFORM pg_temp.zagraj(mA[3], 1, 3);
  PERFORM pg_temp.zagraj(mA[4], 0, 0);
  PERFORM pg_temp.zagraj(mB[1], 4, 2);
  PERFORM pg_temp.zagraj(mB[2], 1, 1);
  PERFORM pg_temp.zagraj(mB[3], 2, 0);
  PERFORM pg_temp.zagraj(mB[4], 3, 1);
END $$;


-- ── TU3 — grupy zamknięte, drabinka w połowie ───────────────────────────────
DO $$
DECLARE t uuid; gA uuid; gB uuid; a uuid[]; b uuid[]; mA uuid[]; mB uuid[]; sf1 uuid; sf2 uuid;
BEGIN
  t := pg_temp.nowy_turniej('TU3 Puchar Warty — półfinały za nami', 'piłka nożna', 'grupy_puchar',
       'trwa', 2, 2, 0,
       'SPRAWDŹ: drabinka z JEDNĄ rundą rozegraną. Finał i mecz o 3. miejsce mają już '
       'obsadzone drużyny — wstawił je wyzwalacz propaguj_zwyciezce (146), nie seed.');
  gA := pg_temp.grupa(t, 'A');
  gB := pg_temp.grupa(t, 'B');
  a := ARRAY[
    pg_temp.druzyna(t, 'Lech Amatorzy', gA, 1), pg_temp.druzyna(t, 'Warta Old Boys', gA, 2),
    pg_temp.druzyna(t, 'Olimpia Ogrody', gA, 3), pg_temp.druzyna(t, 'Posnania FC', gA, 4)];
  b := ARRAY[
    pg_temp.druzyna(t, 'Chwaliszewo TS', gB, 5), pg_temp.druzyna(t, 'Wierzbak Team', gB, 6),
    pg_temp.druzyna(t, 'Górczyn Rangers', gB, 7), pg_temp.druzyna(t, 'Świerczewo FC', gB, 8)];
  mA := pg_temp.grupa_czworka(t, gA, 1, a);
  mB := pg_temp.grupa_czworka(t, gB, 7, b);

  PERFORM pg_temp.zagraj(mA[1], 2, 1); PERFORM pg_temp.zagraj(mA[2], 0, 3);
  PERFORM pg_temp.zagraj(mA[3], 1, 2); PERFORM pg_temp.zagraj(mA[4], 2, 0);
  PERFORM pg_temp.zagraj(mA[5], 1, 0); PERFORM pg_temp.zagraj(mA[6], 2, 2);
  PERFORM pg_temp.zagraj(mB[1], 3, 0); PERFORM pg_temp.zagraj(mB[2], 1, 2);
  PERFORM pg_temp.zagraj(mB[3], 1, 1); PERFORM pg_temp.zagraj(mB[4], 0, 1);
  PERFORM pg_temp.zagraj(mB[5], 2, 3); PERFORM pg_temp.zagraj(mB[6], 4, 1);

  sf1 := pg_temp.mecz(t, 13, 'polfinal', NULL, 1, pg_temp.z_grupy(gA, 1), pg_temp.z_grupy(gB, 2), 6);
  sf2 := pg_temp.mecz(t, 14, 'polfinal', NULL, 1, pg_temp.z_grupy(gB, 1), pg_temp.z_grupy(gA, 2), 7);
  PERFORM pg_temp.mecz_ze_slotow(t, 15, 'o_3_miejsce', 2, sf1, 'przegrany', sf2, 'przegrany', 8);
  PERFORM pg_temp.mecz_ze_slotow(t, 16, 'final',       2, sf1, 'zwyciezca', sf2, 'zwyciezca', 9);

  PERFORM pg_temp.zagraj(sf1, 3, 2);
  PERFORM pg_temp.zagraj(sf2, 1, 1, 5, 4);   -- półfinał na karne
END $$;


-- ── TU4 — liga każdy z każdym, rozegrana w 2/3 (koszykówka) ─────────────────
DO $$
DECLARE t uuid; d uuid[]; m uuid[]; i int;
  -- kolejka, gospodarz, gość — karuzela dla sześciu drużyn (5 kolejek × 3 mecze)
  pary CONSTANT int[][] := ARRAY[
    [1,1,6],[1,2,5],[1,3,4],
    [2,6,3],[2,4,2],[2,5,1],
    [3,1,4],[3,2,6],[3,3,5],
    [4,5,3],[4,6,4],[4,2,1],
    [5,1,3],[5,4,5],[5,6,2]];
BEGIN
  t := pg_temp.nowy_turniej('TU4 Liga Koszykarska — 3 z 5 kolejek', 'koszykówka', 'liga',
       'trwa', NULL, 2, -7,
       'SPRAWDŹ: format LIGA — jedna tabela bez grup, więc BEZ podświetlenia awansu '
       '(nie ma dokąd awansować) i bez drabinki. Punkty koszykarskie, nie gole.');
  d := ARRAY[
    pg_temp.druzyna(t, 'Rataje Ballers', NULL, 1), pg_temp.druzyna(t, 'Wilda Hoops', NULL, 2),
    pg_temp.druzyna(t, 'Jeżyce Slam', NULL, 3),    pg_temp.druzyna(t, 'Dębiec Dunkers', NULL, 4),
    pg_temp.druzyna(t, 'Winogrady Wolves', NULL, 5), pg_temp.druzyna(t, 'Sołacz Shooters', NULL, 6)];

  FOR i IN 1 .. 15 LOOP
    m := m || pg_temp.mecz(t, i, 'liga', NULL, pary[i][1], d[pary[i][2]], d[pary[i][3]], i - 1);
  END LOOP;

  -- Trzy kolejki z pięciu. Wyniki koszykarskie, ale skromne — zdarzeń jest
  -- tyle, ile punktów, a 80:75 to 155 wierszy na jeden mecz.
  PERFORM pg_temp.zagraj(m[1], 21, 18); PERFORM pg_temp.zagraj(m[2], 15, 22); PERFORM pg_temp.zagraj(m[3], 19, 19);
  PERFORM pg_temp.zagraj(m[4], 24, 20); PERFORM pg_temp.zagraj(m[5], 17, 17); PERFORM pg_temp.zagraj(m[6], 12, 25);
  PERFORM pg_temp.zagraj(m[7], 20, 16); PERFORM pg_temp.zagraj(m[8], 18, 21); PERFORM pg_temp.zagraj(m[9], 23, 14);
END $$;


-- ── TU5 — puchar bez grup, z walkowerem, zakończony ─────────────────────────
DO $$
DECLARE t uuid; d uuid[]; c uuid[]; sf1 uuid; sf2 uuid; fin uuid; i int;
BEGIN
  t := pg_temp.nowy_turniej('TU5 Puchar Jednego Dnia — zakończony', 'piłka nożna', 'puchar',
       'zakonczony', NULL, 2, -3,
       'SPRAWDŹ: drabinka bez fazy grupowej, od ćwierćfinałów. W M2 WALKOWER — wynik 0:0, '
       'a mimo to jest zwycięzca (dlatego karta czyta zwyciezca_id, nie wynik).');
  d := ARRAY[
    pg_temp.druzyna(t, 'Błyskawica Grunwald', NULL, 1), pg_temp.druzyna(t, 'Szybcy i Wściekli', NULL, 2),
    pg_temp.druzyna(t, 'Kibolskie Marzenie', NULL, 3),  pg_temp.druzyna(t, 'Dzikie Koty', NULL, 4),
    pg_temp.druzyna(t, 'Ostatni Skład', NULL, 5),       pg_temp.druzyna(t, 'Nocna Zmiana', NULL, 6),
    pg_temp.druzyna(t, 'Piwo po Meczu', NULL, 7),       pg_temp.druzyna(t, 'Rezerwa Życiowa', NULL, 8)];

  FOR i IN 1 .. 4 LOOP
    c := c || pg_temp.mecz(t, i, 'cwierc', NULL, 1, d[2 * i - 1], d[2 * i], i - 1);
  END LOOP;
  sf1 := pg_temp.mecz_ze_slotow(t, 5, 'polfinal', 2, c[1], 'zwyciezca', c[2], 'zwyciezca', 4);
  sf2 := pg_temp.mecz_ze_slotow(t, 6, 'polfinal', 2, c[3], 'zwyciezca', c[4], 'zwyciezca', 5);
  PERFORM pg_temp.mecz_ze_slotow(t, 7, 'o_3_miejsce', 3, sf1, 'przegrany', sf2, 'przegrany', 6);
  fin := pg_temp.mecz_ze_slotow(t, 8, 'final',       3, sf1, 'zwyciezca', sf2, 'zwyciezca', 7);

  PERFORM pg_temp.zagraj(c[1], 2, 0);
  PERFORM pg_temp.walkower(c[2], d[3]);          -- „Dzikie Koty" nie dojechały
  PERFORM pg_temp.zagraj(c[3], 1, 2);
  PERFORM pg_temp.zagraj(c[4], 0, 0, 3, 2);      -- bezbramkowy, rozstrzygnięty karnymi
  PERFORM pg_temp.zagraj(sf1, 1, 0);
  PERFORM pg_temp.zagraj(sf2, 2, 3);
  PERFORM pg_temp.zagraj((SELECT id FROM turniej_mecze WHERE turniej_id = t AND numer = 7), 1, 4);
  PERFORM pg_temp.zagraj(fin, 2, 1);
END $$;


-- ── TU6 — mecz na żywo w trakcie fazy grupowej ──────────────────────────────
DO $$
DECLARE t uuid; g uuid; d uuid[]; m uuid[];
BEGIN
  t := pg_temp.nowy_turniej('TU6 Turniej Sobotni — mecz NA ŻYWO', 'piłka nożna', 'grupy_puchar',
       'trwa', 1, 2, 0,
       'SPRAWDŹ: plakietka „Na żywo" na karcie meczu i to, że mecz W TRAKCIE nie wchodzi '
       'jeszcze do tabeli — tabela liczy wyłącznie zakończone i walkowery.');
  g := pg_temp.grupa(t, 'A');
  d := ARRAY[
    pg_temp.druzyna(t, 'Sobotni Skład', g, 1), pg_temp.druzyna(t, 'Poranna Zmiana', g, 2),
    pg_temp.druzyna(t, 'Ekipa z Osiedla', g, 3), pg_temp.druzyna(t, 'Weterani Wildy', g, 4)];
  m := pg_temp.grupa_czworka(t, g, 1, d);

  PERFORM pg_temp.zagraj(m[1], 2, 1);
  PERFORM pg_temp.zagraj(m[2], 0, 1);
  PERFORM pg_temp.na_zywo(m[3], 1, 1);   -- trwa
END $$;


-- ── Lista kontrolna ─────────────────────────────────────────────────────────
-- Podzapytania skalarne, nie dwa LEFT JOIN-y: złączenie drużyn i meczów naraz
-- mnoży wiersze przez siebie i `count()` pokazuje iloczyn zamiast liczby.
SELECT
  t.nazwa,
  t.status,
  (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id)          AS druzyn,
  (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id
     AND m.status IN ('zakonczony','walkower'))                               AS rozegranych,
  (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id)            AS meczow,
  'https://bojo.pl/turnieje/' || t.id || '?tab=wyniki'                        AS wyniki
FROM turnieje t
WHERE t.opis LIKE '[TUR]%'
ORDER BY t.nazwa;
