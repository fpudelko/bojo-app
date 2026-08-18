-- 106: Administrator platformy zarządza składem tak, jak pokazuje to interfejs.
--
-- OBJAW: przeciągnięcie gracza między drużynami kończyło się komunikatem
--   „Nie udało się przypisać gracza do drużyny — baza nie zmieniła żadnego
--    wiersza. Najczęstsza przyczyna: brak uprawnień (RLS)…"
-- Ten komunikat zrobił dokładnie to, do czego powstał (`zaktualizujJedenWiersz`
-- w `lib/zapytania.ts`): zamienił ciche „nic się nie stało" w konkretną
-- informację. Diagnoza była w nim od razu.
--
-- PRZYCZYNA — TRZECI RAZ TEN SAM WZORZEC. `isOwner` w `EventDetailClient.tsx`
-- to `user.id === event.organizerId || isAdmin`, więc administrator OGLĄDA
-- pełen panel organizatora: losowanie składu, przypisywanie drużyn, gwiazdkę
-- kapitana. Polityki na `event_participants` (`090`) znają wyłącznie
-- organizatora i delegata. Efekt: kontrolki są, klikają się i nic nie robią.
--
-- Wcześniej to samo naprawiały `098` (przełącznik admin/użytkownik) i `104`
-- (zapis taktyki). Wniosek jest zawsze ten sam i wart zapisania: jeżeli
-- w interfejsie administrator jest traktowany jak organizator, to `czy_admin()`
-- musi siedzieć w polityce — inaczej różnica wychodzi dopiero pod palcem
-- użytkownika, a nie w kodzie.
--
-- ZAKRES: UPDATE (drużyna, kapitan, płatność), INSERT (dopisanie gościa)
-- i DELETE (usunięcie ze składu) — czyli dokładnie te trzy rzeczy, które
-- panel organizatora pokazuje administratorowi.

-- ---------------------------------------------------------------------------
-- UPDATE — przypisanie drużyny, kapitan, oznaczenie płatności
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizer or delegate updates participants" ON event_participants;
CREATE POLICY "Organizer or delegate updates participants"
  ON event_participants FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id) OR czy_admin()
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id) OR czy_admin()
  );

-- ---------------------------------------------------------------------------
-- INSERT — dopisanie gościa bez konta
-- ---------------------------------------------------------------------------
-- Warunek „zapisuję siebie" (`auth.uid() = user_id`) zostaje pierwszy: to jest
-- zwykłe dołączenie do meczu i dotyczy wszystkich, nie tylko organizatora.
DROP POLICY IF EXISTS "Join or organiser or delegate adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest"
  ON event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
    OR czy_admin()
  );

-- ---------------------------------------------------------------------------
-- DELETE — usunięcie ze składu
-- ---------------------------------------------------------------------------
-- Nazwa polityki i jej dotychczasowy warunek pochodzą z `090`; odtwarzamy je
-- w całości, bo `CREATE POLICY` nie umie „dopisać" alternatywy do istniejącej.
DROP POLICY IF EXISTS "Leave or organiser or delegate removes" ON event_participants;
DROP POLICY IF EXISTS "Leave or organiser removes" ON event_participants;
CREATE POLICY "Leave or organiser or delegate removes"
  ON event_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
    OR czy_admin()
  );
