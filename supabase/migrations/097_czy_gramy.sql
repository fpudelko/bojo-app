-- 097: „Czy gramy?" — próg minimum graczy i jawna odmowa.
--
-- Dowód z życia: ekipa „Pilka PLEK niedziela" odtworzyła ręcznie w WhatsAppie
-- dokładnie ten model, który Bojo już ma (bramka/gram/pass + rezerwa), a całą
-- resztą wątku jest praca biurowa organizatora: „Czyli brakuje nam 1go?
-- Dobrze liczę?", „10 to minimum żeby zagrać", „Może jeszcze ktoś się
-- decyduje?". Bojo zna skład i zna odpowiedzi — ta migracja daje mu
-- policzenie tego za organizatora i pokazanie werdyktu wprost.
--
-- DLACZEGO OSOBNA TABELA `event_declines`, A NIE NOWA WARTOŚĆ `rsvp`.
-- Kuszące jest dorzucenie `rsvp = 'out'` do istniejącej kolumny, ale `rsvp`
-- jest wplecione w regułę pojemności zduplikowaną w trzech miejscach
-- (joinEvent/addGuest/confirmFromMaybe) oraz w zapytania statystyk
-- (`lib/players.ts` robi `.neq('rsvp', 'maybe')` — nowa wartość wpadłaby tam
-- jako uczestnik). Osobna tabela nie dotyka niczego istniejącego i „odmowa"
-- nie jest tym samym co „nieobecność" (`player_reports`, `091`) — to dwa
-- różne, świadomie nie mylone ze sobą fakty.

-- ---------------------------------------------------------------------------
-- 1. Minimum graczy
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS min_players INT;
-- NULL = organizator nie ustawił progu — zero zmiany zachowania dla
-- wszystkich istniejących meczów w bazie.
COMMENT ON COLUMN events.min_players IS
  'Ilu graczy musi być, żeby gra się odbyła. NULL = brak progu. Liczone tą
   samą regułą składu co pojemność: pending_approval IS NOT TRUE AND
   is_reserve IS NOT TRUE (ta sama para warunków co w 079).';

-- ---------------------------------------------------------------------------
-- 2. Jawna odmowa — „nie gram"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_declines (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
COMMENT ON TABLE event_declines IS
  'Jawne "nie gram" członka ekipy przy meczu. NIE jest nieobecnością —
   player_reports (091) karmi statystykę "Niezawodność" wyłącznie ze zgłoszeń
   nie-przyjścia; wcześniejsza, jawna odmowa jest zachowaniem dobrym i nie ma
   z tamtą tabelą żadnego związku.';

ALTER TABLE event_declines ENABLE ROW LEVEL SECURITY;

-- Widoczne dla siebie, organizatora meczu i całej ekipy (gdy mecz jest
-- przypięty do grupy) — panel "kto milczy" pyta o to samo, o co pyta lista
-- uczestników, więc widoczność musi być tej samej szerokości.
CREATE POLICY "event_declines_select" ON event_declines FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM events e
       WHERE e.id = event_id AND e.group_id IS NOT NULL AND czy_czlonek_grupy(e.group_id)
    )
  );

-- Odmawiam wyłącznie za siebie — nikt nie odmawia za kogoś innego.
CREATE POLICY "event_declines_insert" ON event_declines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_declines_delete" ON event_declines FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. RPC „zapytaj tych, co milczą"
-- ---------------------------------------------------------------------------
-- `notifications` (025) nie ma polityki INSERT — powiadomienie zawsze pisze
-- się KOMU INNEMU niż ten, kto wywołał akcję, więc SECURITY DEFINER jest
-- jedyną drogą, wzorem 065/070/072/079/086. Działa wyłącznie dla meczów
-- przypiętych do grupy — bez znanego składu ekipy pojęcie "kto milczy" nie
-- ma znaczenia (publiczny mecz nie ma zamkniętej listy oczekiwanych osób).
CREATE OR REPLACE FUNCTION zapytaj_milczacych(p_event_id UUID) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id     UUID;
  v_organizer_id UUID;
  v_tytul        TEXT;
  v_data         DATE;
  v_godz         TIME;
  v_n            INT;
BEGIN
  SELECT group_id, organizer_id, coalesce(title, sport), event_date, event_time
    INTO v_group_id, v_organizer_id, v_tytul, v_data, v_godz
    FROM events WHERE id = p_event_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Ta funkcja działa tylko dla meczów przypiętych do ekipy';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_organizer_id
     AND NOT czy_moze_tworzyc_wydarzenia_w_grupie(v_group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby zapytać ekipę o ten mecz';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id, 'pytanie_o_udzial',
         'Grasz w ' || coalesce(v_tytul, 'meczu') || '?',
         to_char(v_data, 'DD.MM') || ', godz. ' || to_char(v_godz, 'HH24:MI')
           || ' — daj znać, czy wchodzisz.',
         p_event_id, v_group_id
    FROM group_members gm
   WHERE gm.group_id = v_group_id
     AND NOT EXISTS (
       SELECT 1 FROM event_participants ep WHERE ep.event_id = p_event_id AND ep.user_id = gm.user_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM event_declines ed WHERE ed.event_id = p_event_id AND ed.user_id = gm.user_id
     )
     -- Zapora przed spamem: kto był zaczepiony w ciągu ostatnich 12 h, czeka.
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id AND n.event_id = p_event_id AND n.type = 'pytanie_o_udzial'
          AND n.created_at > now() - interval '12 hours'
     );

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION zapytaj_milczacych(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Powiadomienie o przekroczeniu progu (w obie strony)
-- ---------------------------------------------------------------------------
-- Wzorem `powiadom_o_zmianie_kompletu` (079): reaguje na ZMIANĘ STANU, nie na
-- każdy zapis — inaczej skład rosnący 1 → 14 dałby kilkanaście powiadomień
-- zamiast jednego, w momencie przekroczenia progu.
CREATE OR REPLACE FUNCTION powiadom_o_progu_gry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_actor    UUID;
  v_min      INT;
  v_status   TEXT;
  v_data     DATE;
  v_tytul    TEXT;
  v_po       INT;
  v_przed    INT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id; v_actor := OLD.user_id;
  ELSE v_event_id := NEW.event_id; v_actor := NEW.user_id; END IF;

  SELECT min_players, status, event_date, coalesce(title, sport)
    INTO v_min, v_status, v_data, v_tytul
    FROM events WHERE id = v_event_id;

  IF v_min IS NULL OR v_status <> 'active' OR v_data < current_date THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_po
    FROM event_participants
   WHERE event_id = v_event_id AND pending_approval IS NOT TRUE AND is_reserve IS NOT TRUE;

  v_przed := v_po;
  IF TG_OP <> 'INSERT' AND OLD.pending_approval IS NOT TRUE AND OLD.is_reserve IS NOT TRUE THEN
    v_przed := v_przed + 1;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.pending_approval IS NOT TRUE AND NEW.is_reserve IS NOT TRUE THEN
    v_przed := v_przed - 1;
  END IF;

  -- ── Poniżej progu → gramy ─────────────────────────────────────────────
  IF v_przed < v_min AND v_po >= v_min THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    SELECT ep.user_id, 'gra_potwierdzona', 'Gramy! ✓',
           coalesce(v_tytul, 'Mecz') || ' — skład przekroczył minimum (' || v_po || '/' || v_min || ').',
           v_event_id
      FROM event_participants ep
     WHERE ep.event_id = v_event_id AND ep.pending_approval IS NOT TRUE AND ep.is_reserve IS NOT TRUE
       AND ep.user_id IS NOT NULL AND ep.user_id IS DISTINCT FROM v_actor;
    RETURN NULL;
  END IF;

  -- ── Gramy → poniżej progu ─────────────────────────────────────────────
  IF v_przed >= v_min AND v_po < v_min THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    SELECT ep.user_id, 'gra_zagrozona', 'Gra zagrożona',
           coalesce(v_tytul, 'Mecz') || ' — brakuje ' || (v_min - v_po) || ' do minimum (' || v_po || '/' || v_min || ').',
           v_event_id
      FROM event_participants ep
     WHERE ep.event_id = v_event_id AND ep.pending_approval IS NOT TRUE AND ep.is_reserve IS NOT TRUE
       AND ep.user_id IS NOT NULL AND ep.user_id IS DISTINCT FROM v_actor;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_progu_gry ON event_participants;
CREATE TRIGGER trg_powiadom_o_progu_gry
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_progu_gry();
