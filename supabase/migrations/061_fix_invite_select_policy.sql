-- 061_fix_invite_select_policy.sql
--
-- Naprawa: „new row violates row-level security policy for table
-- event_player_invites" przy zapraszaniu przez UCZESTNIKA (nie organizatora).
--
-- Co się działo. `invitePlayers()` woła
--     .upsert(rows, …).select('id')
-- czyli w SQL: INSERT … RETURNING id. Postgres stosuje do wierszy zwracanych
-- przez RETURNING politykę SELECT — i gdy wiersz jej nie przejdzie, przerywa
-- całą operację błędem o naruszeniu RLS. Wygląda to na odrzucony zapis, choć
-- warunek INSERT (WITH CHECK) przeszedł bez zarzutu.
--
-- Polityka SELECT z migracji `060` przepuszczała tylko zaproszonego,
-- organizatora i administratora. Uczestnik zapraszający kolegę nie jest żadnym
-- z nich: nowy wiersz ma `user_id` = zapraszany, a nie on. Efekt — zaproszenie
-- powstawało w bazie tylko wtedy, gdy wysyłał je organizator.
--
-- Dlatego INSERT nie wymaga zmian; brakowało prawa do odczytu.
--
-- Przy okazji druga rzecz z tego samego korzenia: dialog „Zaproś z ekipy"
-- podpisuje „już zaproszony" na podstawie `getEventPlayerInvites()`. Uczestnik
-- nie widział cudzych zaproszeń, więc etykieta kłamała i dało się zaprosić
-- kogoś drugi raz. Uczestnicy meczu widzą teraz jego zaproszenia — to mniejsza
-- ekspozycja niż sam skład, który jest czytelny dla wszystkich
-- (`event_participants` ma SELECT USING (true) od migracji `002`).

DROP POLICY IF EXISTS "Invitee and organizer read invites" ON event_player_invites;

CREATE POLICY "Invitee, inviter and participants read invites" ON event_player_invites FOR SELECT
  USING (
    -- zaproszony
    user_id = auth.uid()
    -- kto wysłał (bez tego INSERT … RETURNING wywala się uczestnikowi)
    OR invited_by = auth.uid()
    -- organizator meczu
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    -- uczestnik tego meczu — żeby „już zaproszony" mówiło prawdę
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_player_invites.event_id
        AND ep.user_id = auth.uid()
        AND ep.pending_approval = false
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
