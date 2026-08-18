-- 108: Cofnięcie uprawnień administratora do cudzego składu (odwrócenie `106`).
--
-- DLACZEGO ODWRACAMY COŚ SPRZED GODZINY. `106` dokładała `czy_admin()` do
-- polityk na `event_participants`, żeby panel organizatora — pokazywany
-- administratorowi przez `isOwner = organizer || isAdmin` — w ogóle działał.
-- To była naprawa objawu. Przyczyną było samo `|| isAdmin`: administrator
-- dostawał cudzy mecz do zarządzania, choć nigdy nie było takiej potrzeby.
--
-- Łataliśmy to trzy razy z rzędu (`098`, `104`, `106`) i za każdym razem
-- wychodziło kolejne miejsce: przełącznik ról, zapis taktyki, przypisanie
-- drużyny, głos na propozycję składu. Warunek zniknął z interfejsu
-- (`EventDetailClient.tsx`), więc znika też z bazy — uprawnienie, z którego
-- nic nie korzysta, to wyłącznie ryzyko.
--
-- Polityki wracają DOKŁADNIE do brzmienia z `090`. Administrator ma własne
-- ekrany (`/admin/*`); meczem zarządza organizator i jego delegaci.
--
-- ZOSTAJE BEZ ZMIAN: „Admins can update any event" (`005`) — to jest
-- moderacja samego wydarzenia (odwołanie, ukrycie), a nie zarządzanie cudzym
-- składem, i nie ma z nią problemu opisanego wyżej.

DROP POLICY IF EXISTS "Organizer or delegate updates participants" ON event_participants;
CREATE POLICY "Organizer or delegate updates participants"
  ON event_participants FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  );

DROP POLICY IF EXISTS "Join or organiser or delegate adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest"
  ON event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );

DROP POLICY IF EXISTS "Leave or organiser or delegate removes" ON event_participants;
CREATE POLICY "Leave or organiser or delegate removes"
  ON event_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );
