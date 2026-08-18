-- 101: „kto się wypisał" widoczne dla uczestników meczu, nie tylko organizatora.
--
-- PO CO: wypisanie się jest jedyną zmianą składu, która nie zostawia po sobie
-- żadnego śladu — wiersz w `event_participants` znika i nikt nie odróżnia
-- „odpadł" od „nigdy się nie zapisał". Ktoś patrzy na listę, widzi jedno
-- miejsce wolne i nie wie, czy właśnie się zwolniło.
--
-- Dziennik (`event_activity_log`, migracja `026`) ma już rodzaje
-- `participant_left` i `participant_removed`, ale polityka SELECT z `026`
-- wpuszcza WYŁĄCZNIE organizatora meczu.
--
-- Poszerzamy WĄSKO: dokładamy DRUGĄ politykę (permissive, więc sumuje się
-- z istniejącą) obejmującą tylko te dwa rodzaje wpisów. Reszta dziennika —
-- płatności, zmiany ustawień, publikacja składów — zostaje przy organizatorze.
-- Poszerzenie starej polityki zamiast dołożenia nowej otworzyłoby wszystko.
--
-- Kto zobaczy: każdy, kto widzi sam mecz. Podzapytanie o `events` wykonuje się
-- z uprawnieniami pytającego, więc RLS tabeli `events` załatwia tu całą robotę
-- — mecz prywatny pozostaje prywatny razem ze swoją listą wypisań i nie ma
-- drugiego miejsca, w którym reguła widoczności mogłaby się rozjechać.

DROP POLICY IF EXISTS "activity_log_wypisania" ON event_activity_log;
CREATE POLICY "activity_log_wypisania" ON event_activity_log FOR SELECT
  USING (
    action IN ('participant_left', 'participant_removed')
    AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_id)
  );
