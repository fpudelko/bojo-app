-- 104: Administrator platformy może zapisywać taktykę.
--
-- OBJAW: wejście w zakładkę „Taktyka" i kliknięcie czegokolwiek kończyło się
--   new row violates row-level security policy for table "event_team_setup"
--
-- PRZYCZYNA — rozjazd między bramką w interfejsie a polityką w bazie.
-- Zakładka jest dziś widoczna WYŁĄCZNIE dla administratora platformy
-- (`isAdmin` w `EventDetailClient.tsx`), a polityki z migracji `103`
-- wpuszczają do zapisu organizatora, delegata (`can_edit_event`, `089`) albo
-- kogoś z tej drużyny. Administratora nie ma na żadnej z tych list — chyba że
-- przypadkiem organizuje ten mecz. Efekt: jedyna osoba, która może tę zakładkę
-- otworzyć, nie może w niej nic zapisać.
--
-- To ta sama klasa błędu co w `098`: uprawnienie egzekwowane w dwóch miejscach
-- według dwóch różnych reguł. Lekcja na przyszłość jest prosta — jeżeli widok
-- jest za bramką `isAdmin`, to `czy_admin()` musi być w polityce od pierwszego
-- dnia, a nie po pierwszym czerwonym komunikacie.
--
-- Administrator dostaje też ODCZYT czatu drużyny: bez tego zakładka otwiera
-- się z pustą rozmową i wygląda, jakby wiadomości nie było. Świadomie NIE
-- dostaje prawa kasowania cudzych wiadomości — to zostaje przy autorze,
-- dokładnie jak w rozmowie meczu.

-- ---------------------------------------------------------------------------
-- 1. Ustawienie i taktyka
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "team_setup_write" ON event_team_setup;
CREATE POLICY "team_setup_write" ON event_team_setup FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin())
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin());

-- ---------------------------------------------------------------------------
-- 2. Pozycje na boisku
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "team_slots_write" ON event_team_slots;
CREATE POLICY "team_slots_write" ON event_team_slots FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin())
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin());

-- ---------------------------------------------------------------------------
-- 3. Czat drużyny — odczyt i pisanie
-- ---------------------------------------------------------------------------
-- Warunek „widać skasowane własne" zostaje bez zmian: to on sprawia, że autor
-- w ogóle może skasować swoją wiadomość (patrz migracja `100`).
DROP POLICY IF EXISTS "team_messages_select" ON event_team_messages;
CREATE POLICY "team_messages_select" ON event_team_messages FOR SELECT
  USING (
    (czy_w_druzynie(event_id, team) OR can_edit_event(event_id) OR czy_admin())
    AND (deleted_at IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "team_messages_insert" ON event_team_messages;
CREATE POLICY "team_messages_insert" ON event_team_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (czy_w_druzynie(event_id, team) OR can_edit_event(event_id) OR czy_admin())
  );
