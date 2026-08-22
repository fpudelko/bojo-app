-- 120: Rozmowa meczu i numer BLIK przestają być czytelne dla całego internetu.
--
-- KONTEKST. Klucz `anon` siedzi w paczce JavaScriptu — musi, bo przeglądarka
-- rozmawia z Supabase bezpośrednio (patrz „Architektura w skrócie" w AGENTS.md).
-- Jedyną granicą jest więc RLS, a `event_comments` miało od `026` politykę
-- SELECT `USING (deleted_at IS NULL)`: BEZ WARUNKU NA OSOBĘ. Każdy, także
-- niezalogowany, mógł jednym zapytaniem do REST-a pobrać treść rozmów
-- WSZYSTKICH meczów w bazie — łącznie z prywatnymi. Interfejs pokazuje
-- zakładkę Rozmowa wyłącznie uczestnikom, organizatorowi i członkom ekipy
-- meczu (`mozeWidziecRozmowe` w EventDetailClient), ale to bramka w UI,
-- nie w bazie.
--
-- Tablica ekipy (`group_posts`, migracja `093`) była domknięta od pierwszego
-- dnia — ta migracja robi rozmowie meczu dokładnie to samo, tym samym
-- wzorcem: funkcja SECURITY DEFINER w warunku polityki.
--
-- DRUGA POŁOWA: NUMER BLIK. `events.blik_phone` to prywatny numer telefonu
-- organizatora. `canSeeBlikPhone()` (lib/payments.ts) chowa go w interfejsie
-- do godziny przed meczem, ale RLS na `events` jest WIERSZOWE, a polityka
-- SELECT na tej tabeli to `USING (true)` — czyli numer leciał w każdej
-- odpowiedzi `select('*')` do kogokolwiek, kto o mecz zapytał. Postgres nie
-- filtruje kolumn politykami, a odebranie uprawnienia do samej kolumny
-- (`REVOKE SELECT (blik_phone)`) wywróciłoby wszystkie `select('*')` w kodzie.
-- Dlatego numer przenosi się do OSOBNEJ TABELI z własną polityką — wiersz
-- widzi ten, kto ma coś do zapłacenia albo komu płacą.
--
-- KOLEJNOŚĆ WDROŻENIA (ważna, bo migracje puszcza się ręcznie):
--   1. ta migracja (`120`) — tworzy tabelę i kopiuje numery, `events.blik_phone`
--      zostaje nietknięte, więc STARY frontend działa dalej bez zmian,
--   2. deploy tego PR-a — frontend czyta i zapisuje już `event_blik`,
--   3. migracja `121` — dopiero ona kasuje kolumnę i zamyka wyciek.
-- Odwrócenie kroków 2 i 3 zostawia numer w świecie albo wywraca zapis meczu.

-- ---------------------------------------------------------------------------
-- 1. Kto widzi rozmowę meczu
-- ---------------------------------------------------------------------------
-- Lustro `mozeWidziecRozmowe` z EventDetailClient.tsx: uczestnik (każdy wpis
-- w `event_participants`, także oczekujący na akceptację i obserwujący — tak
-- samo jak w interfejsie), organizator oraz — gdy mecz jest przypięty do
-- ekipy — każdy jej członek. SECURITY DEFINER, bo funkcja czyta `events`
-- i `group_members` w imieniu polityki, a nie pytającego.
CREATE OR REPLACE FUNCTION czy_widzi_rozmowe_meczu(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
     WHERE e.id = p_event_id
       AND (
         e.organizer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM event_participants ep
                     WHERE ep.event_id = e.id AND ep.user_id = auth.uid())
         OR (e.group_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM group_members gm
                WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()))
       )
  );
$$;

GRANT EXECUTE ON FUNCTION czy_widzi_rozmowe_meczu(UUID) TO anon, authenticated;

-- UWAGA na pułapkę z migracji `100`: polityka SELECT rządzi też widocznością
-- wiersza PO zmianie, a kasowanie wiadomości jest miękkie (UPDATE ustawiający
-- `deleted_at`). Dlatego „swoje widzę zawsze" stoi jako osobny człon OR, poza
-- warunkiem widoczności rozmowy — inaczej autor, który zdążył wypisać się
-- z meczu, dostałby przy kasowaniu własnej wiadomości wyjątek
-- „new row violates row-level security policy".
DROP POLICY IF EXISTS "comments_select" ON event_comments;
CREATE POLICY "comments_select" ON event_comments FOR SELECT
  USING (
    (czy_widzi_rozmowe_meczu(event_id) AND deleted_at IS NULL)
    OR auth.uid() = user_id
  );

-- Pisać też tylko swoi. Dotąd wystarczyło być zalogowanym i znać `event_id`,
-- żeby dopisać się do rozmowy dowolnego meczu w bazie.
DROP POLICY IF EXISTS "comments_insert" ON event_comments;
CREATE POLICY "comments_insert" ON event_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND czy_widzi_rozmowe_meczu(event_id));

-- ---------------------------------------------------------------------------
-- 2. Numer BLIK w osobnej tabeli
-- ---------------------------------------------------------------------------
-- Jeden wiersz na mecz (PK = FK), więc PostgREST widzi relację jeden-do-jeden
-- i `select('*, event_blik(blik_phone)')` oddaje obiekt albo `null` — bez
-- numeru dla tych, których nie przepuści polityka niżej.
CREATE TABLE IF NOT EXISTS event_blik (
  event_id   UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  blik_phone TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_blik ENABLE ROW LEVEL SECURITY;

-- Uprawnienia WPROST, nie z domyślnych. `anon` MUSI mieć SELECT, choć nigdy
-- nie zobaczy ani jednego wiersza: strona meczu dociąga numer osadzeniem
-- (`select('*, event_blik(blik_phone)')`) i renderuje się także wylogowanemu.
-- Bez tego grantu PostgREST oddaje mu „permission denied" i pada CAŁA strona
-- meczu, zamiast po prostu nie pokazać numeru. Wiersze i tak odsiewa polityka.
GRANT SELECT ON event_blik TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_blik TO authenticated;

-- Widzą: organizator, delegaci (`089`) i KAŻDY, kto ma wpis w składzie —
-- rezerwowi i oczekujący na akceptację też, bo płacą tym samym numerem, gdy
-- wejdą. Reguła „dopiero godzinę przed meczem" (`canSeeBlikPhone`) zostaje
-- ŚWIADOMIE w interfejsie: to wygoda, nie ochrona przed uczestnikiem tego
-- samego meczu, a przeniesienie jej tutaj wymagałoby trzymania progu
-- `BLIK_PHONE_REVEAL_MINUTES` w dwóch miejscach naraz.
DROP POLICY IF EXISTS "event_blik_select" ON event_blik;
CREATE POLICY "event_blik_select" ON event_blik FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_payments(event_id)
    OR can_edit_event(event_id)
    OR EXISTS (SELECT 1 FROM event_participants ep
                WHERE ep.event_id = event_blik.event_id AND ep.user_id = auth.uid())
  );

-- Zapisuje organizator albo delegat od płatności/edycji — ta sama trójka co
-- przy `events`, bez uczestników.
DROP POLICY IF EXISTS "event_blik_write" ON event_blik;
CREATE POLICY "event_blik_write" ON event_blik FOR ALL
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_payments(event_id)
    OR can_edit_event(event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_payments(event_id)
    OR can_edit_event(event_id)
  );

-- Przeniesienie tego, co już jest w bazie. Idempotentne — migrację można
-- puścić drugi raz bez szkody.
INSERT INTO event_blik (event_id, blik_phone)
SELECT id, blik_phone FROM events
 WHERE blik_phone IS NOT NULL AND btrim(blik_phone) <> ''
ON CONFLICT (event_id) DO UPDATE SET blik_phone = EXCLUDED.blik_phone,
                                     updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. RPC delegata pisze do nowej tabeli
-- ---------------------------------------------------------------------------
-- `event_set_payment_settings` z `090` ustawiała `events.blik_phone`. Po
-- migracji `121` tamtej kolumny nie będzie, więc funkcja zmienia adres zapisu
-- już teraz — działa poprawnie zarówno przed `121`, jak i po niej.
CREATE OR REPLACE FUNCTION event_set_payment_settings(
  p_event_id UUID,
  p_accepted_payment_methods TEXT[],
  p_blik_phone TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_manage_payments(p_event_id) THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany ustawień płatności tego wydarzenia';
  END IF;

  UPDATE events
     SET accepted_payment_methods = p_accepted_payment_methods
   WHERE id = p_event_id;

  IF p_blik_phone IS NULL OR btrim(p_blik_phone) = '' THEN
    DELETE FROM event_blik WHERE event_id = p_event_id;
  ELSE
    INSERT INTO event_blik (event_id, blik_phone)
    VALUES (p_event_id, btrim(p_blik_phone))
    ON CONFLICT (event_id) DO UPDATE SET blik_phone = EXCLUDED.blik_phone,
                                         updated_at = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION event_set_payment_settings(UUID, TEXT[], TEXT) TO authenticated;

COMMENT ON TABLE event_blik IS
  'Numer BLIK organizatora — osobno od `events`, bo RLS w Postgresie jest wierszowe, a `events` czyta każdy.';
