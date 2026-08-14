-- 091: Oznaczanie nieobecności przez organizatora + zaostrzenie RLS player_reports.
--
-- Infrastruktura istnieje od migracji 011 (tabela player_reports,
-- get_player_stats() z migracji 074 już liczy no_shows z report_type =
-- 'nie_przyszedl'), ale nic w kliencie do niej nie pisało. Polityka INSERT
-- była też za szeroka: DOWOLNY zalogowany użytkownik mógł zgłosić
-- "nie przyszedł" o dowolnym uczestniku dowolnego meczu (auth.uid() IS NOT
-- NULL) — furtka do fałszywych zgłoszeń psujących cudzą odznakę "Niezawodny"
-- na /gracz/[id]. Zawężamy do organizatora i delegatów z uprawnieniem do
-- składu (can_manage_squad, migracja 089/090).

-- Bez unikalności powtórne kliknięcie "nie przyszedł" dokładałoby kolejne
-- wiersze i sztucznie zawyżało licznik no_shows w get_player_stats().
ALTER TABLE player_reports
  ADD CONSTRAINT player_reports_unique_per_event UNIQUE (event_id, reported_participant_id, report_type);

DROP POLICY IF EXISTS "Authenticated can submit reports" ON player_reports;
CREATE POLICY "Organizer or squad delegate submits reports"
  ON player_reports FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

-- Brakowało w ogóle możliwości cofnięcia błędnego oznaczenia.
DROP POLICY IF EXISTS "Organizer or squad delegate deletes own event reports" ON player_reports;
CREATE POLICY "Organizer or squad delegate deletes own event reports"
  ON player_reports FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

-- SELECT też ma widzieć delegat, nie tylko organizator — inaczej modal
-- "Kto nie przyszedł" nie potrafiłby pokazać aktualnego stanu.
DROP POLICY IF EXISTS "Organizer reads reports for their events" ON player_reports;
CREATE POLICY "Organizer or squad delegate reads reports"
  ON player_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );
