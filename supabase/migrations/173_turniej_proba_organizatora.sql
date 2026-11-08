-- ============================================================================
-- 173_turniej_proba_organizatora.sql — „Przetestuj" obok „Rozpocznij turniej".
-- ----------------------------------------------------------------------------
-- DLACZEGO. Widok dnia turnieju (pulpit „Turniej trwa", wpisywanie wyników,
-- drabinka rosnąca po każdym meczu) organizator widział dopiero w dniu
-- turnieju, po kliknięciu „Rozpocznij". Decyzja właściciela z 2026-11-08:
-- ma móc przećwiczyć to wcześniej, na kopii, bez skutków dla prawdziwego
-- turnieju i bez powiadomień do graczy.
--
-- `utworz_probe_turnieju()` kopiuje turniej RAZEM Z TERMINARZEM:
--   • status `trwa`, widoczność `na_link` (nie ma go na liście turniejów),
--   • te same boiska, grupy i drużyny (nazwy), składy jako IMIONA BEZ KONT —
--     wyzwalacze 146/155 powiadamiają wyłącznie zawodników z kontem, więc
--     wpisany w próbie wynik nie budzi nikogo z prawdziwego turnieju,
--   • drużyny `dodana_recznie = true` — wyzwalacz zgłoszeń (145) wtedy milczy,
--   • ten sam terminarz z przemapowanymi identyfikatorami (źródła drabinki,
--     wolne losy, grupy, boiska).
-- Opis kopii zaczyna się od `[TURNIEJ-TEST]`: ten sam marker co
-- `supabase/zadania/kopia-turnieju-do-testow.sql`, więc sprząta ją też
-- `supabase/wyczysc-testowe.sql`. Poprzednia próba tego samego turnieju tego
-- samego organizatora jest kasowana, zanim powstanie nowa.
--
-- Same `CREATE OR REPLACE`, idempotentna; DELETE stoi wyłącznie w ciele
-- funkcji, więc skaner ryzyka puszcza migrację automatem.
-- ============================================================================

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
  INSERT INTO turniej_grupy (id, turniej_id, nazwa)
  SELECT (m_grupy->>g.id::text)::uuid, v_id, g.nazwa
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
    zwyciezca_id, walkower_dla
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
         CASE WHEN czy_wolny_los(m) THEN (m_druzyn->>m.walkower_dla::text)::uuid END
    FROM turniej_mecze m WHERE m.turniej_id = p_turniej;

  -- Mecze kolejnych rund w kopii nie znają jeszcze nikogo poza wolnymi
  -- losami: drużyny z rozegranych w oryginale meczów zostały przeniesione
  -- razem z ich wynikami, więc czyścimy je tam, gdzie jest źródło.
  UPDATE turniej_mecze m SET
    druzyna_a_id = CASE WHEN m.zrodlo_a_mecz_id IS NOT NULL THEN NULL ELSE m.druzyna_a_id END,
    druzyna_b_id = CASE WHEN m.zrodlo_b_mecz_id IS NOT NULL THEN NULL ELSE m.druzyna_b_id END
   WHERE m.turniej_id = v_id AND (m.zrodlo_a_mecz_id IS NOT NULL OR m.zrodlo_b_mecz_id IS NOT NULL);
  PERFORM propaguj_zwyciezce_dla(m.id) FROM turniej_mecze m
   WHERE m.turniej_id = v_id AND m.status = 'walkower';

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION utworz_probe_turnieju(uuid) TO authenticated;
