-- 100: Kasowanie wiadomości było niemożliwe — polityka SELECT blokowała UPDATE.
--
-- OBJAW: „Usuń" w rozmowie meczu kończyło się czerwoną chmurką
--   new row violates row-level security policy for table "event_comments"
-- Ta sama pułapka siedziała w tablicy ekipy (`group_posts`, migracja `093`)
-- i w komentarzach do obiektu (`field_comments`).
--
-- DLACZEGO, bo z samych polityk nie widać tego gołym okiem. Kasowanie jest
-- MIĘKKIE: to UPDATE ustawiający `deleted_at`. Polityki na `event_comments`
-- (migracja `026`) wyglądały poprawnie —
--   UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
-- i autor swój własny wiersz przechodzi obiema klauzulami.
--
-- Blokowała trzecia, pozornie niezwiązana:
--   SELECT USING (deleted_at IS NULL)
-- Postgres przy UPDATE sprawdza NOWY wiersz także politykami SELECT — wiersz
-- po zmianie musi zostać widoczny dla tego, kto go zmienił. A miękkie
-- kasowanie robi dokładnie to, czego polityka SELECT zabrania: ustawia
-- `deleted_at`, czyli wypycha wiersz poza własną widoczność. Stąd komunikat
-- o „new row”, mimo że nikt nie wstawiał nowego wiersza.
--
-- Odtworzone na gołym Postgresie ze wszystkimi migracjami
-- (`./scripts/baza-testowa.sh --zostaw`): UPDATE wywala się wyjątkiem,
-- a po samej zmianie polityki SELECT przechodzi. Polityki na produkcji były
-- identyczne z repo — to nie był rozjazd, tylko błąd projektowy w `026`.
--
-- ROZWIĄZANIE: skasowany wiersz widzi ten, kto miał prawo go skasować.
-- Warunek widoczności skasowanych jest LUSTREM polityki UPDATE każdej tabeli
-- — inaczej moderator, który kasuje CUDZY wpis, wpadłby w ten sam wyjątek,
-- co autor przed poprawką.
--
-- Nic nie wycieka do interfejsu: `getComments()`, `getGroupPosts()` i
-- `getFieldComments()` filtrują `deleted_at IS NULL` w samym zapytaniu.
-- Polityka domyka to od strony bazy — skasowanej wiadomości nie odczyta ktoś
-- postronny, nawet omijając aplikację.

-- ---------------------------------------------------------------------------
-- 1. Rozmowa meczu
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "comments_select" ON event_comments;
CREATE POLICY "comments_select" ON event_comments FOR SELECT
  USING (deleted_at IS NULL OR auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Tablica ekipy (093) — kasować może autor, moderator i admin platformy,
--    więc dokładnie ci trzej widzą skasowane.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "group_posts_select" ON group_posts;
CREATE POLICY "group_posts_select" ON group_posts FOR SELECT
  USING (
    czy_czlonek_grupy(group_id)
    AND (
      deleted_at IS NULL
      OR auth.uid() = user_id
      OR czy_moze_moderowac_tablice(group_id)
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Komentarze do obiektu
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "field_comments_select" ON field_comments;
CREATE POLICY "field_comments_select" ON field_comments FOR SELECT
  USING (
    deleted_at IS NULL
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );
