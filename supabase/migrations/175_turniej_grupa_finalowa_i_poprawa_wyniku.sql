-- ============================================================================
-- 175_turniej_grupa_finalowa_i_poprawa_wyniku.sql
-- ----------------------------------------------------------------------------
-- DLACZEGO. Turniej charytatywny w Luboniu (28.11.2026) ma harmonogram, którego
-- Bojo nie umiało odwzorować: trzy grupy po pięć drużyn, a potem GRUPA
-- FINAŁOWA zwycięzców A, B i C (każdy z każdym). Mecze finałowe stoją
-- w harmonogramie od początku jako „Zwycięzca A – Zwycięzca B", a pierwszy
-- z nich gra się, zanim skończy się grupa C. Do tego właściciel zamówił
-- „Popraw wynik" (wszystkie audyty: pomyłka w dniu turnieju nie miała wyjścia).
--
-- 1. Format `grupy_finalowa` obok `grupy_puchar`, `puchar`, `liga`.
-- 2. `turniej_grupy.finalowa`: grupa, do której drużyny trafiają z innych grup,
--    a nie przez `turniej_druzyny.grupa_id` (drużyna gra w A ORAZ w F).
-- 3. Źródło „miejsce w grupie": `zrodlo_{a,b}_grupa_id` + `zrodlo_{a,b}_miejsce`.
--    Gdy ostatni mecz grupy się rozstrzygnie, `wypelnij_z_grupy()` wpisuje
--    drużyny w mecze, które na nią czekają. Ten sam mechanizm daje drabinkę
--    po grupach w `grupy_puchar` (półfinał „1. A – 2. B"), której do dziś nie
--    było (audyt 5, N1: format kończył się na grupach).
--    Kolejność w grupie liczy `kolejnosc_w_grupie()`, TA SAMA reguła co
--    `posortujTabele()` w `lib/turniejTabela.ts`: punkty, różnica, bramki,
--    nazwa, a potem pozycje ustawione ręcznie przez organizatora.
-- 4. `cofnij_wynik_meczu()`: organizator otwiera rozstrzygnięty mecz do
--    poprawy, dopóki żaden mecz zależny od niego jeszcze się nie zaczął.
--    Wynik wpisuje potem zwykłą drogą (szybki wynik / zakończenie meczu),
--    więc propagacja do drabinki i grupy finałowej idzie tymi samymi
--    wyzwalaczami co za pierwszym razem.
-- 5. `zapisz_terminarz()` przyjmuje nowe kolumny i mówi po ludzku, czemu
--    odmawia (audyt 5, N3c).
--
-- Tylko dokłada: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, CHECK formatu
-- wymieniony wzorcem DROP/ADD CONSTRAINT (odwracalny). Jedzie automatem.
-- ============================================================================

-- ── 1. Format ───────────────────────────────────────────────────────────────

ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS turnieje_format_check;
ALTER TABLE turnieje ADD CONSTRAINT turnieje_format_check
  CHECK (format IN ('grupy_puchar','grupy_finalowa','puchar','liga'));

-- ── 2. Grupa finałowa ───────────────────────────────────────────────────────

ALTER TABLE turniej_grupy ADD COLUMN IF NOT EXISTS finalowa boolean NOT NULL DEFAULT false;

-- ── 3. Źródło „miejsce w grupie" ────────────────────────────────────────────

ALTER TABLE turniej_mecze
  ADD COLUMN IF NOT EXISTS zrodlo_a_grupa_id uuid REFERENCES turniej_grupy(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zrodlo_a_miejsce  int,
  ADD COLUMN IF NOT EXISTS zrodlo_b_grupa_id uuid REFERENCES turniej_grupy(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zrodlo_b_miejsce  int;

CREATE INDEX IF NOT EXISTS idx_mecze_zrodlo_a_grupa ON turniej_mecze(zrodlo_a_grupa_id) WHERE zrodlo_a_grupa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mecze_zrodlo_b_grupa ON turniej_mecze(zrodlo_b_grupa_id) WHERE zrodlo_b_grupa_id IS NOT NULL;

-- Drużyny grupy: przypisane do niej (`grupa_id`) ORAZ te, które grają w jej
-- meczach (grupa finałowa nie ma przypisanych drużyn, ma tylko mecze).
-- Kolejność: punkty, różnica, bramki zdobyte, nazwa; potem ręczne pozycje
-- organizatora (`pozycja_recznie`, tylko w grupie, do której drużyna należy)
-- wstawiane na wskazane miejsce, reszta wokół nich. Lustro `posortujTabele()`.
CREATE OR REPLACE FUNCTION kolejnosc_w_grupie(p_grupa uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_liczone uuid[];
  v_wynik   uuid[];
  v_reszta  uuid[] := '{}';
  v_n       int;
  v_d       uuid;
  v_poz     int;
  i         int;
  j         int := 1;
BEGIN
  WITH druzyny AS (
    SELECT d.id, d.nazwa, CASE WHEN d.grupa_id = p_grupa THEN d.pozycja_recznie END AS reczna
      FROM turniej_druzyny d
     WHERE d.grupa_id = p_grupa
        OR d.id IN (SELECT m.druzyna_a_id FROM turniej_mecze m WHERE m.grupa_id = p_grupa
                    UNION SELECT m.druzyna_b_id FROM turniej_mecze m WHERE m.grupa_id = p_grupa)
  ), rozegrane AS (
    SELECT m.druzyna_a_id AS dom, m.druzyna_b_id AS gosc, m.wynik_a AS bd, m.wynik_b AS bg, m.zwyciezca_id
      FROM turniej_mecze m
     WHERE m.grupa_id = p_grupa AND m.status IN ('zakonczony','walkower')
       AND m.druzyna_a_id IS NOT NULL AND m.druzyna_b_id IS NOT NULL
  ), strony AS (
    SELECT dom AS druzyna, bd AS zdobyte, bg AS stracone, zwyciezca_id FROM rozegrane
    UNION ALL
    SELECT gosc, bg, bd, zwyciezca_id FROM rozegrane
  ), dorobek AS (
    SELECT dr.id, dr.nazwa,
      coalesce(sum(CASE WHEN s.druzyna IS NULL THEN 0
                        WHEN s.zwyciezca_id = dr.id THEN t.punkty_za_wygrana
                        WHEN s.zwyciezca_id IS NULL THEN t.punkty_za_remis
                        ELSE 0 END), 0) AS punkty,
      coalesce(sum(s.zdobyte), 0) - coalesce(sum(s.stracone), 0) AS roznica,
      coalesce(sum(s.zdobyte), 0) AS zdobyte
    FROM druzyny dr
    JOIN turniej_grupy g ON g.id = p_grupa
    JOIN turnieje t ON t.id = g.turniej_id
    LEFT JOIN strony s ON s.druzyna = dr.id
    GROUP BY dr.id, dr.nazwa
  )
  SELECT array_agg(id ORDER BY punkty DESC, roznica DESC, zdobyte DESC, nazwa)
    INTO v_liczone FROM dorobek;

  v_n := coalesce(array_length(v_liczone, 1), 0);
  IF v_n = 0 THEN RETURN '{}'; END IF;
  v_wynik := array_fill(NULL::uuid, ARRAY[v_n]);

  FOR i IN 1 .. v_n LOOP
    v_d := v_liczone[i];
    SELECT CASE WHEN d.grupa_id = p_grupa THEN d.pozycja_recznie END INTO v_poz
      FROM turniej_druzyny d WHERE d.id = v_d;
    IF v_poz IS NOT NULL AND v_poz BETWEEN 1 AND v_n AND v_wynik[v_poz] IS NULL THEN
      v_wynik[v_poz] := v_d;
    ELSE
      v_reszta := v_reszta || v_d;
    END IF;
  END LOOP;
  FOR i IN 1 .. v_n LOOP
    IF v_wynik[i] IS NULL THEN
      v_wynik[i] := v_reszta[j];
      j := j + 1;
    END IF;
  END LOOP;
  RETURN v_wynik;
END $$;

GRANT EXECUTE ON FUNCTION kolejnosc_w_grupie(uuid) TO anon, authenticated;

-- Wpisuje drużyny w mecze czekające na miejsce z tej grupy, gdy KAŻDY mecz
-- grupy jest rozstrzygnięty. Rusza wyłącznie mecze jeszcze niezaczęte:
-- rozegranego meczu nie przepisuje się po cichu (poprawa idzie przez
-- `cofnij_wynik_meczu()`, która sama pilnuje, czy coś zależnego już ruszyło).
-- Przy grupie niedokończonej czyści sloty, które wcześniej wypełniła, żeby
-- cofnięcie wyniku w grupie nie zostawiło nieaktualnej drużyny w finale.
CREATE OR REPLACE FUNCTION wypelnij_z_grupy(p_grupa uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kolejnosc uuid[];
  v_komplet   boolean;
BEGIN
  SELECT count(*) > 0 AND bool_and(m.status IN ('zakonczony','walkower')) INTO v_komplet
    FROM turniej_mecze m WHERE m.grupa_id = p_grupa;

  IF v_komplet THEN
    v_kolejnosc := kolejnosc_w_grupie(p_grupa);
  END IF;

  UPDATE turniej_mecze m
     SET druzyna_a_id = CASE WHEN v_komplet THEN v_kolejnosc[m.zrodlo_a_miejsce] END
   WHERE m.zrodlo_a_grupa_id = p_grupa AND m.status = 'zaplanowany'
     AND m.druzyna_a_id IS DISTINCT FROM (CASE WHEN v_komplet THEN v_kolejnosc[m.zrodlo_a_miejsce] END);
  UPDATE turniej_mecze m
     SET druzyna_b_id = CASE WHEN v_komplet THEN v_kolejnosc[m.zrodlo_b_miejsce] END
   WHERE m.zrodlo_b_grupa_id = p_grupa AND m.status = 'zaplanowany'
     AND m.druzyna_b_id IS DISTINCT FROM (CASE WHEN v_komplet THEN v_kolejnosc[m.zrodlo_b_miejsce] END);
END $$;

CREATE OR REPLACE FUNCTION wypelnij_z_grupy_wyzwalacz()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.grupa_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.wynik_a IS NOT DISTINCT FROM NEW.wynik_a
     AND OLD.wynik_b IS NOT DISTINCT FROM NEW.wynik_b
     AND OLD.zwyciezca_id IS NOT DISTINCT FROM NEW.zwyciezca_id THEN
    RETURN NEW;
  END IF;
  PERFORM wypelnij_z_grupy(NEW.grupa_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wypelnij_z_grupy ON turniej_mecze;
CREATE TRIGGER trg_wypelnij_z_grupy AFTER UPDATE ON turniej_mecze
  FOR EACH ROW EXECUTE FUNCTION wypelnij_z_grupy_wyzwalacz();

-- ── 4. Poprawa wyniku ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cofnij_wynik_meczu(p_mecz uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mecz     turniej_mecze%ROWTYPE;
  v_zalezny  int;
BEGIN
  SELECT * INTO v_mecz FROM turniej_mecze m WHERE m.id = p_mecz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu.';
  END IF;
  IF NOT czy_zarzadza_turniejem(v_mecz.turniej_id) THEN
    RAISE EXCEPTION 'Wynik poprawia organizator turnieju.';
  END IF;
  IF v_mecz.status NOT IN ('zakonczony','walkower') THEN
    RAISE EXCEPTION 'Ten mecz nie ma jeszcze wyniku do poprawienia.';
  END IF;
  IF czy_wolny_los(v_mecz) THEN
    RAISE EXCEPTION 'Wolnego losu nie da się poprawić: nikt w nim nie grał.';
  END IF;

  -- Mecz zależny, który już ruszył, blokuje poprawę: przepięcie drużyny
  -- w rozegranym meczu zmieniłoby historię bez wiedzy grających.
  SELECT min(z.numer) INTO v_zalezny
    FROM turniej_mecze z
   WHERE z.status <> 'zaplanowany'
     AND (z.zrodlo_a_mecz_id = p_mecz OR z.zrodlo_b_mecz_id = p_mecz
          OR (v_mecz.grupa_id IS NOT NULL
              AND (z.zrodlo_a_grupa_id = v_mecz.grupa_id OR z.zrodlo_b_grupa_id = v_mecz.grupa_id)));
  IF v_zalezny IS NOT NULL THEN
    RAISE EXCEPTION 'Mecz M% zależy od tego wyniku i już się zaczął. Najpierw popraw tamten mecz.', v_zalezny;
  END IF;

  DELETE FROM turniej_zdarzenia zd WHERE zd.mecz_id = p_mecz;

  UPDATE turniej_mecze m SET
    status = 'zaplanowany', wynik_a = 0, wynik_b = 0, wynik_recznie = false,
    karne_a = NULL, karne_b = NULL, zwyciezca_id = NULL, walkower_dla = NULL,
    mvp_zawodnik_id = NULL, zakonczony_at = NULL, rozpoczety_at = NULL, sety = NULL
   WHERE m.id = p_mecz;

  -- Zwycięzca/przegrany tego meczu znika z kolejnej rundy. Miejsca z grupy
  -- czyści `wypelnij_z_grupy()` wołane wyzwalaczem po zmianie statusu.
  UPDATE turniej_mecze m SET druzyna_a_id = NULL
   WHERE m.zrodlo_a_mecz_id = p_mecz AND m.status = 'zaplanowany';
  UPDATE turniej_mecze m SET druzyna_b_id = NULL
   WHERE m.zrodlo_b_mecz_id = p_mecz AND m.status = 'zaplanowany';
END $$;

GRANT EXECUTE ON FUNCTION cofnij_wynik_meczu(uuid) TO authenticated;

-- ── 5. Zapis terminarza z nowymi źródłami ───────────────────────────────────

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
    -- Zdanie dla organizatora, bez długiego myślnika i z poprawną odmianą
    -- (audyt 5, N3c). Front i tak wyłącza przycisk, to ostatnia linia obrony.
    RAISE EXCEPTION 'Rozegrano już mecze (%), więc terminarza nie da się ułożyć od nowa. Godziny zmienisz przy każdym meczu.', v_niedokonczone;
  END IF;

  DELETE FROM turniej_mecze WHERE turniej_id = p_turniej;

  INSERT INTO turniej_mecze (
    id, turniej_id, numer, faza, grupa_id, kolejka, pozycja_w_drabince,
    druzyna_a_id, druzyna_b_id, zrodlo_a_mecz_id, zrodlo_b_mecz_id,
    zrodlo_a_typ, zrodlo_b_typ, arena_id, zaplanowany_at, status,
    zwyciezca_id, walkower_dla,
    zrodlo_a_grupa_id, zrodlo_a_miejsce, zrodlo_b_grupa_id, zrodlo_b_miejsce
  )
  SELECT
    (m->>'id')::uuid, p_turniej, (m->>'numer')::int, m->>'faza',
    NULLIF(m->>'grupaId','')::uuid, (m->>'kolejka')::int, (m->>'pozycjaWDrabince')::int,
    NULLIF(m->>'druzynaAId','')::uuid, NULLIF(m->>'druzynaBId','')::uuid,
    NULLIF(m->>'zrodloAMeczId','')::uuid, NULLIF(m->>'zrodloBMeczId','')::uuid,
    NULLIF(m->>'zrodloATyp',''), NULLIF(m->>'zrodloBTyp',''),
    NULLIF(m->>'arenaId','')::uuid, (m->>'zaplanowanyAt')::timestamptz,
    coalesce(NULLIF(m->>'status',''), 'zaplanowany'),
    NULLIF(m->>'zwyciezcaId','')::uuid, NULLIF(m->>'walkowerDla','')::uuid,
    NULLIF(m->>'zrodloAGrupaId','')::uuid, NULLIF(m->>'zrodloAMiejsce','')::int,
    NULLIF(m->>'zrodloBGrupaId','')::uuid, NULLIF(m->>'zrodloBMiejsce','')::int
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
         'Sprawdź, kiedy gracie: ' || t.nazwa, p_turniej
    FROM turniej_zawodnicy z
    JOIN turnieje t ON t.id = p_turniej
   WHERE z.turniej_id = p_turniej AND z.user_id IS NOT NULL;

  RETURN v_wstawiono;
END $$;

GRANT EXECUTE ON FUNCTION zapisz_terminarz(uuid, jsonb) TO authenticated;


-- ── 6. „Przetestuj" (173) kopiuje też grupę finałową i miejsca z grup ──────

CREATE OR REPLACE FUNCTION utworz_probe_turnieju(p_turniej uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  src      turnieje%ROWTYPE;
  v_id     uuid;
  v_nazwa  text;
  m_areny  jsonb;
  m_grupy  jsonb;
  m_druzyn jsonb;
  m_meczow jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT czy_zarzadza_turniejem(p_turniej) THEN
    RAISE EXCEPTION 'Próbę może zrobić tylko organizator tego turnieju.';
  END IF;

  SELECT * INTO src FROM turnieje t WHERE t.id = p_turniej;
  IF coalesce(src.opis, '') LIKE '[TURNIEJ-TEST]%' THEN
    RAISE EXCEPTION 'To już jest turniej próbny.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM turniej_mecze m WHERE m.turniej_id = p_turniej) THEN
    RAISE EXCEPTION 'Najpierw wygeneruj terminarz, wtedy będzie co przetestować.';
  END IF;

  v_nazwa := left('Próba: ' || src.nazwa, 80);
  DELETE FROM turnieje t
   WHERE t.organizator_id = auth.uid() AND t.nazwa = v_nazwa
     AND coalesce(t.opis, '') LIKE '[TURNIEJ-TEST]%';

  INSERT INTO turnieje (
    organizator_id, nazwa, sport, format, status, widocznosc,
    field_id, miejsce_nazwa, miejsce_adres, lat, lng, miasto,
    data_startu, godzina_startu,
    max_druzyn, min_zawodnikow, max_zawodnikow, graczy_w_polu,
    liczba_grup, awansuje_z_grupy, mecz_o_3_miejsce, czas_meczu_min, przerwa_min,
    punkty_za_wygrana, punkty_za_remis, karne_przy_remisie,
    wpisowe_grosz, opis, wymaga_akceptacji, okladka_url
  ) VALUES (
    auth.uid(), v_nazwa, src.sport, src.format, 'trwa', 'na_link',
    src.field_id, src.miejsce_nazwa, src.miejsce_adres, src.lat, src.lng, src.miasto,
    src.data_startu, src.godzina_startu,
    src.max_druzyn, src.min_zawodnikow, src.max_zawodnikow, src.graczy_w_polu,
    src.liczba_grup, src.awansuje_z_grupy, src.mecz_o_3_miejsce, src.czas_meczu_min, src.przerwa_min,
    src.punkty_za_wygrana, src.punkty_za_remis, src.karne_przy_remisie,
    0,
    '[TURNIEJ-TEST] Próba turnieju „' || src.nazwa || '”. Wyniki wpisane tutaj nie trafiają '
      || 'do prawdziwego turnieju, a zawodnicy nie dostają powiadomień.',
    false, src.okladka_url
  ) RETURNING id INTO v_id;

  -- Boiska: wyzwalacz `utworz_domyslna_arene()` (146) założył już „Boisko 1",
  -- więc zastępujemy je kopią boisk oryginału.
  DELETE FROM turniej_areny a WHERE a.turniej_id = v_id;
  SELECT coalesce(jsonb_object_agg(a.id::text, gen_random_uuid()), '{}') INTO m_areny
    FROM turniej_areny a WHERE a.turniej_id = p_turniej;
  INSERT INTO turniej_areny (id, turniej_id, nazwa, kolejnosc)
  SELECT (m_areny->>a.id::text)::uuid, v_id, a.nazwa, a.kolejnosc
    FROM turniej_areny a WHERE a.turniej_id = p_turniej;

  SELECT coalesce(jsonb_object_agg(g.id::text, gen_random_uuid()), '{}') INTO m_grupy
    FROM turniej_grupy g WHERE g.turniej_id = p_turniej;
  INSERT INTO turniej_grupy (id, turniej_id, nazwa, finalowa)
  SELECT (m_grupy->>g.id::text)::uuid, v_id, g.nazwa, g.finalowa
    FROM turniej_grupy g WHERE g.turniej_id = p_turniej;

  -- Drużyny przyjęte i każda, która stoi w terminarzu (na wszelki wypadek,
  -- gdyby organizator zmienił status już po wygenerowaniu meczów).
  SELECT coalesce(jsonb_object_agg(d.id::text, gen_random_uuid()), '{}') INTO m_druzyn
    FROM turniej_druzyny d
   WHERE d.turniej_id = p_turniej
     AND (d.status = 'przyjeta' OR EXISTS (
       SELECT 1 FROM turniej_mecze m
        WHERE m.turniej_id = p_turniej AND d.id IN (m.druzyna_a_id, m.druzyna_b_id)));
  INSERT INTO turniej_druzyny (id, turniej_id, nazwa, status, grupa_id, dodana_recznie, regulamin_zaakceptowany_at)
  SELECT (m_druzyn->>d.id::text)::uuid, v_id, d.nazwa, 'przyjeta',
         (m_grupy->>d.grupa_id::text)::uuid, true, now()
    FROM turniej_druzyny d
   WHERE m_druzyn ? d.id::text;

  -- Składy jako imiona bez kont; drużyna bez nikogo w składzie dostaje dwóch
  -- zawodników zastępczych, żeby w próbie dało się przypisać strzelca.
  INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie, numer)
  SELECT (m_druzyn->>z.druzyna_id::text)::uuid, v_id, z.imie, z.numer
    FROM turniej_zawodnicy z
   WHERE m_druzyn ? z.druzyna_id::text;
  INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie, numer)
  SELECT (m_druzyn->>d.id::text)::uuid, v_id, 'Zawodnik ' || n, n
    FROM turniej_druzyny d CROSS JOIN generate_series(1, 2) n
   WHERE m_druzyn ? d.id::text
     AND NOT EXISTS (SELECT 1 FROM turniej_zawodnicy z WHERE z.druzyna_id = d.id);

  -- Terminarz z przemapowanymi odwołaniami. Jeden INSERT: odwołania
  -- `zrodlo_*_mecz_id` do meczów z tej samej partii są poprawne, bo klucze
  -- obce sprawdzają się na końcu polecenia (ten sam wzorzec co
  -- `zapisz_terminarz()`, 146).
  SELECT coalesce(jsonb_object_agg(m.id::text, gen_random_uuid()), '{}') INTO m_meczow
    FROM turniej_mecze m WHERE m.turniej_id = p_turniej;
  INSERT INTO turniej_mecze (
    id, turniej_id, numer, faza, grupa_id, kolejka, pozycja_w_drabince,
    druzyna_a_id, druzyna_b_id, zrodlo_a_mecz_id, zrodlo_b_mecz_id,
    zrodlo_a_typ, zrodlo_b_typ, arena_id, zaplanowany_at, status,
    zwyciezca_id, walkower_dla,
    zrodlo_a_grupa_id, zrodlo_a_miejsce, zrodlo_b_grupa_id, zrodlo_b_miejsce
  )
  SELECT (m_meczow->>m.id::text)::uuid, v_id, m.numer, m.faza,
         (m_grupy->>m.grupa_id::text)::uuid, m.kolejka, m.pozycja_w_drabince,
         (m_druzyn->>m.druzyna_a_id::text)::uuid, (m_druzyn->>m.druzyna_b_id::text)::uuid,
         (m_meczow->>m.zrodlo_a_mecz_id::text)::uuid, (m_meczow->>m.zrodlo_b_mecz_id::text)::uuid,
         m.zrodlo_a_typ, m.zrodlo_b_typ,
         (m_areny->>m.arena_id::text)::uuid, m.zaplanowany_at,
         -- Próba zaczyna od zera: rozegrane w oryginale wracają do planu,
         -- wolne losy zostają walkowerem (drużyna i tak awansuje bez gry).
         CASE WHEN czy_wolny_los(m) THEN 'walkower' ELSE 'zaplanowany' END,
         CASE WHEN czy_wolny_los(m) THEN (m_druzyn->>m.zwyciezca_id::text)::uuid END,
         CASE WHEN czy_wolny_los(m) THEN (m_druzyn->>m.walkower_dla::text)::uuid END,
         (m_grupy->>m.zrodlo_a_grupa_id::text)::uuid, m.zrodlo_a_miejsce,
         (m_grupy->>m.zrodlo_b_grupa_id::text)::uuid, m.zrodlo_b_miejsce
    FROM turniej_mecze m WHERE m.turniej_id = p_turniej;

  -- Mecze kolejnych rund w kopii nie znają jeszcze nikogo poza wolnymi
  -- losami: drużyny z rozegranych w oryginale meczów zostały przeniesione
  -- razem z ich wynikami, więc czyścimy je tam, gdzie jest źródło.
  UPDATE turniej_mecze m SET
    druzyna_a_id = CASE WHEN m.zrodlo_a_mecz_id IS NOT NULL THEN NULL ELSE m.druzyna_a_id END,
    druzyna_b_id = CASE WHEN m.zrodlo_b_mecz_id IS NOT NULL THEN NULL ELSE m.druzyna_b_id END
   WHERE m.turniej_id = v_id AND (m.zrodlo_a_mecz_id IS NOT NULL OR m.zrodlo_b_mecz_id IS NOT NULL);
  -- To samo dla miejsc z grup (175): w próbie grupy zaczynają od zera.
  UPDATE turniej_mecze m SET
    druzyna_a_id = CASE WHEN m.zrodlo_a_grupa_id IS NOT NULL THEN NULL ELSE m.druzyna_a_id END,
    druzyna_b_id = CASE WHEN m.zrodlo_b_grupa_id IS NOT NULL THEN NULL ELSE m.druzyna_b_id END
   WHERE m.turniej_id = v_id AND (m.zrodlo_a_grupa_id IS NOT NULL OR m.zrodlo_b_grupa_id IS NOT NULL);
  PERFORM propaguj_zwyciezce_dla(m.id) FROM turniej_mecze m
   WHERE m.turniej_id = v_id AND m.status = 'walkower';

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION utworz_probe_turnieju(uuid) TO authenticated;

