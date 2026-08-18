-- 105: Taktykę ustawia KAPITAN drużyny, nie administrator platformy.
--
-- ZMIANA DECYZJI, nie naprawa błędu. Migracja `104` wpuściła do zapisu
-- administratora, bo zakładka „Taktyka" była wtedy schowana za bramką
-- `isAdmin` — czyli tylko on mógł ją otworzyć. To założenie odpadło:
-- zakładkę widzi teraz każdy, kto GRA w meczu, i widzi wyłącznie SWOJĄ
-- drużynę, a ustawienie zmienia jedna osoba — kapitan.
--
-- DLACZEGO KAPITAN, A NIE „KAŻDY Z DRUŻYNY": ustalenie ustawienia to jedna
-- decyzja, a nie głosowanie. Przy dziesięciu osobach z prawem zapisu skład
-- zmieniałby się pod ręką i nikt nie wiedziałby, która wersja obowiązuje.
--
-- DLACZEGO ADMINISTRATOR TRACI DOSTĘP: nie ma już ekranu, z którego mógłby
-- z tego skorzystać, a uprawnienie bez zastosowania to wyłącznie ryzyko —
-- czat drużyny jest z definicji rozmową, której nie czyta nikt z zewnątrz.
-- Kasowanie własnych wiadomości zostaje bez zmian (autor, migracja `103`).

-- ---------------------------------------------------------------------------
-- 0. Kto jest kapitanem tej drużyny
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER wzorem `czy_w_druzynie()` z `103`: funkcja jest wołana
-- z wnętrza polityki, więc musi widzieć `event_participants` niezależnie od
-- tego, co widzi pytający.
CREATE OR REPLACE FUNCTION czy_kapitan_druzyny(p_event_id UUID, p_team TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = auth.uid()
      AND ep.team = p_team
      AND ep.is_captain
      AND ep.pending_approval = false
  );
$$;

GRANT EXECUTE ON FUNCTION czy_kapitan_druzyny(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ustawienie, taktyka i pozycje — wyłącznie kapitan
-- ---------------------------------------------------------------------------
-- Organizator, który nie gra w tej drużynie, też nie zapisuje. Jeśli chce
-- ustawiać, wskazuje siebie kapitanem w zakładce „Skład" — to jedno kliknięcie
-- i zostawia ślad, kto za to ustawienie odpowiada.
DROP POLICY IF EXISTS "team_setup_write" ON event_team_setup;
CREATE POLICY "team_setup_write" ON event_team_setup FOR ALL
  USING (czy_kapitan_druzyny(event_id, team))
  WITH CHECK (czy_kapitan_druzyny(event_id, team));

DROP POLICY IF EXISTS "team_slots_write" ON event_team_slots;
CREATE POLICY "team_slots_write" ON event_team_slots FOR ALL
  USING (czy_kapitan_druzyny(event_id, team))
  WITH CHECK (czy_kapitan_druzyny(event_id, team));

-- ---------------------------------------------------------------------------
-- 2. Czat drużyny — cała drużyna, bez administratora
-- ---------------------------------------------------------------------------
-- Czat NIE jest ograniczony do kapitana: ustawienie ustala jedna osoba, ale
-- rozmawia cała drużyna. Warunek „widać skasowane własne" zostaje — to on
-- pozwala autorowi skasować swoją wiadomość (patrz migracja `100`).
DROP POLICY IF EXISTS "team_messages_select" ON event_team_messages;
CREATE POLICY "team_messages_select" ON event_team_messages FOR SELECT
  USING (
    czy_w_druzynie(event_id, team)
    AND (deleted_at IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "team_messages_insert" ON event_team_messages;
CREATE POLICY "team_messages_insert" ON event_team_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND czy_w_druzynie(event_id, team));
