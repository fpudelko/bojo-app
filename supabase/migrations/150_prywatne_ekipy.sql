-- 150: Ekipa przestaje być publiczną wizytówką — obcy widzi NAZWĘ i nic więcej.
--
-- STAN SPRZED TEJ MIGRACJI. `groups` i `group_members` miały od `044` politykę
-- SELECT `USING (true)` z komentarzem „nic wrażliwego tu nie leży". Leżało:
--
--   1. SKŁAD EKIPY. Jedno zapytanie do REST-a po `group_members` oddawało
--      komplet `user_id` każdej ekipy w bazie — a `profiles` jest czytelne,
--      więc z tego robi się lista imion, nazwisk i awatarów.
--   2. KOD DOŁĄCZENIA. `groups.join_code` jest zwykłą kolumną publicznie
--      czytelnego wiersza. Migracja `094` zamknęła INSERT na `group_members`
--      („kod dołączenia był dekoracją"), ale kod dało się po prostu ODCZYTAĆ
--      i podać do `dolacz_do_grupy_kodem()`. Bramka pilnowała drzwi, przy
--      których leżał klucz.
--   3. MECZE EKIPY. `events` ma `USING (true)`, więc `?group_id=eq.<uuid>`
--      oddawało cały terminarz ekipy, łącznie z meczami prywatnymi. UUID nie
--      jest sekretem — stoi w adresie każdego linku do ekipy.
--
-- CO JEST PO. Obcy widzi nazwę (bo link zaproszenia i podgląd na Messengerze
-- muszą mieć co pokazać) i przycisk „Poproś o dołączenie". Skład, terminarz,
-- rozmowa, statystyki i kod — wyłącznie dla członków. Rozmowa i statystyki
-- były domknięte od `093`/`095`; ta migracja dociąga do nich resztę.
--
-- DLACZEGO NAZWA ZOSTAJE PUBLICZNA. Musi ją wypisać podgląd linku
-- (`/g/[kod]`, `/grupy/[id]` w metadanych OG) renderowany kluczem `anon`,
-- zanim ktokolwiek się zaloguje. Nazwa jest tym, co i tak wkleja się na
-- Messengerze razem z linkiem. Wydaje ją funkcja `grupa_publicznie()` —
-- wąskie okno na dwie kolumny zamiast polityki wierszowej `USING (true)`,
-- która oddawała cały wiersz z kodem dołączenia włącznie.
--
-- MECZ PRYWATNY PRZYPIĘTY DO EKIPY PRZESTAJE BYĆ DOSTĘPNY Z LINKU. To jest
-- zmiana zachowania, nie tylko szczelności: do dziś `private` znaczyło
-- „niewidoczny na listach, ale otwarty dla każdego, kto ma adres" (`002`).
-- Dla meczu przypiętego do ekipy publiczność jest inna — to mecz ekipy, więc
-- widzą go członkowie, skład, imiennie zaproszeni (`060`), delegaci (`089`)
-- i organizator. Kto chce wpuścić kogoś z zewnątrz, ma dwie drogi, obie
-- istniejące: zaprosić imiennie albo zrobić mecz publicznym. Mecz prywatny
-- BEZ ekipy zostaje nietknięty — tam „unlisted, dzielony linkiem" dalej jest
-- całym modelem.
--
-- Do tej pory pilnowała tego asercja „OTWARTE: mecz prywatny czyta każdy"
-- w `supabase/test/rls.sql`; ta migracja jest tym momentem, w którym zmienia
-- się w niej OCZEKIWANIE (patrz nagłówek tamtej sekcji).
--
-- GOŚĆ BEZ KONTA NIE TRACI NIC: jego strona (`/gracz/przejmij/[token]`) chodzi
-- wyłącznie przez `podejrzyj_wpis_goscia()`/`wypisz_wpis_goscia()` (`128`),
-- czyli SECURITY DEFINER, gdzie uprawnieniem jest sam token.

-- ---------------------------------------------------------------------------
-- 1. Ekipa: wiersz widzą członkowie, nazwę — każdy, przez wąską funkcję
-- ---------------------------------------------------------------------------
-- Polityka jest WIERSZOWA, więc „obcy widzi nazwę, członek całość" nie da się
-- zapisać jednym warunkiem — obcy albo widzi wiersz z `join_code`, albo nie
-- widzi go wcale. Stąd podział: polityka zamyka wiersz, funkcja wydaje dwie
-- kolumny.
DROP POLICY IF EXISTS "Groups are readable" ON groups;
DROP POLICY IF EXISTS "Ekipe czyta jej czlonek" ON groups;
-- `created_by` OBOK członkostwa, nie zamiast: `createGroup()` robi
-- `INSERT … RETURNING id`, a wiersz w `group_members` dopisuje wyzwalacz
-- AFTER (`044`), który odpala się PO wyliczeniu RETURNING. Bez tej gałęzi
-- zakładanie ekipy wywracałoby się na własnej polityce.
CREATE POLICY "Ekipe czyta jej czlonek" ON groups FOR SELECT
  USING (
    created_by = auth.uid()
    OR czy_czlonek_grupy(id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

-- Nazwa ekipy dla kogoś z zewnątrz — tyle, ile widać w linku wklejonym na
-- czacie. Bez `join_code`, bez opisu, bez liczby członków.
CREATE OR REPLACE FUNCTION grupa_publicznie(p_group_id UUID)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name FROM groups g WHERE g.id = p_group_id;
$$;

GRANT EXECUTE ON FUNCTION grupa_publicznie(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Skład ekipy: wyłącznie dla ekipy
-- ---------------------------------------------------------------------------
-- `czy_czlonek_grupy()` jest SECURITY DEFINER (`092`) właśnie po to: polityka
-- na `group_members`, która sama czyta `group_members`, wywraca się na
-- „infinite recursion detected in policy for relation group_members".
DROP POLICY IF EXISTS "Members are readable" ON group_members;
DROP POLICY IF EXISTS "Sklad ekipy czyta ekipa" ON group_members;
CREATE POLICY "Sklad ekipy czyta ekipa" ON group_members FOR SELECT
  USING (
    czy_czlonek_grupy(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

-- ---------------------------------------------------------------------------
-- 3. Mecz ekipy widzi ekipa
-- ---------------------------------------------------------------------------
-- Lustro `czy_widzi_rozmowe_meczu()` z `120`, poszerzone o delegatów i
-- imiennie zaproszonych: rozmowy nie czyta się „z zaproszenia", ale samą
-- stronę meczu — owszem, inaczej zaproszenie prowadziłoby donikąd.
CREATE OR REPLACE FUNCTION czy_widoczny_mecz(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
     WHERE e.id = p_event_id
       AND (
         e.group_id IS NULL
         OR e.visibility <> 'private'
         OR e.organizer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM group_members gm
                     WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM event_participants ep
                     WHERE ep.event_id = e.id AND ep.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM event_player_invites i
                     WHERE i.event_id = e.id AND i.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM event_delegates d
                     WHERE d.event_id = e.id AND d.user_id = auth.uid())
       )
  );
$$;

GRANT EXECUTE ON FUNCTION czy_widoczny_mecz(UUID) TO anon, authenticated;

-- Warunek taniej części stoi PRZED wywołaniem funkcji: mecz publiczny i mecz
-- bez ekipy (czyli zdecydowana większość wierszy na każdej liście) rozstrzyga
-- się bez wchodzenia do funkcji.
DROP POLICY IF EXISTS "Events readable by all" ON events;
DROP POLICY IF EXISTS "Mecz ekipy widzi ekipa" ON events;
-- DRUGA POLITYKA SELECT, KTÓRA UNIEWAŻNIAŁA PIERWSZĄ. `041` dołożyło
-- „Join code lookup" z warunkiem `join_code IS NOT NULL` — a `join_code` jest
-- w tej tabeli NOT NULL od tej samej migracji, więc warunek jest prawdziwy
-- dla KAŻDEGO wiersza. Polityki SELECT sumują się przez OR, więc bez tego
-- DROP-a nowa polityka niżej nie zmieniałaby zupełnie nic (złapane przez
-- `supabase/test/rls.sql`, nie przez czytanie kodu).
--
-- Trasa `/d/[kod]`, dla której tamta polityka powstała, działa dalej bez
-- niej: mecz publiczny i mecz prywatny BEZ ekipy widać z samej polityki
-- niżej. Kod do meczu ekipy prowadzi odtąd donikąd dla kogoś z zewnątrz —
-- to jest dokładnie ta zmiana, o którą tu chodzi.
DROP POLICY IF EXISTS "Join code lookup" ON events;
CREATE POLICY "Mecz ekipy widzi ekipa" ON events FOR SELECT
  USING (group_id IS NULL OR visibility <> 'private' OR czy_widoczny_mecz(id));

-- Skład idzie za meczem. Bez tego `event_participants` (nadal `USING (true)`)
-- oddawałoby imiona ze składu meczu, którego samego nie widać — czyli dokładnie
-- tę listę nazwisk, którą ta migracja zamyka w `group_members`.
-- Uprawnienia KOLUMNOWE z `127` (e-mail gościa, telefony, `claim_token`)
-- zostają nietknięte — to druga, niezależna warstwa.
DROP POLICY IF EXISTS "Participants readable by all" ON event_participants;
DROP POLICY IF EXISTS "Sklad widoczny razem z meczem" ON event_participants;
CREATE POLICY "Sklad widoczny razem z meczem" ON event_participants FOR SELECT
  USING (czy_widoczny_mecz(event_id));

-- ---------------------------------------------------------------------------
-- 4. Prośba o dołączenie — jedyne, co obcy może z ekipą zrobić
-- ---------------------------------------------------------------------------
-- DLACZEGO OSOBNA TABELA, A NIE `group_members.status`. Wiersz w składzie
-- znaczy dziś dokładnie jedno: „ta osoba jest w ekipie". Dołożenie do niego
-- stanu „jeszcze nie" kazałoby dopisać `AND status = 'aktywny'` w każdym
-- miejscu, które dziś pyta o członkostwo — w `czy_czlonek_grupy()`,
-- `czy_moze_zarzadzac_grupa()`, politykach `group_posts`, statystykach,
-- liczniku na karcie. Jedno przeoczenie = ktoś, kto poprosił, czyta rozmowę
-- ekipy. Osobna tabela nie ma jak tego zepsuć.
--
-- UNIQUE (group_id, user_id): jedna prośba na osobę i ekipę. Ponowienie
-- nadpisuje wiersz, nie dokłada kolejnego — inaczej odrzucony wracałby co
-- minutę, a założyciel dostawałby dzwonek za dzwonkiem.
CREATE TABLE IF NOT EXISTS group_join_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'oczekuje'
                 CHECK (status IN ('oczekuje', 'przyjeta', 'odrzucona')),
  -- Krótka nota „kto to w ogóle jest". Ekipa jest odtąd niewidoczna, więc
  -- rozpatrujący widzi samo imię z profilu — a „gram z Kubą w czwartki" jest
  -- całą różnicą między przyjęciem a odrzuceniem.
  wiadomosc      TEXT CHECK (wiadomosc IS NULL OR char_length(wiadomosc) BETWEEN 1 AND 300),
  rozpatrzyl     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rozpatrzona_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_join_requests_group
  ON group_join_requests (group_id, created_at DESC) WHERE status = 'oczekuje';
CREATE INDEX IF NOT EXISTS idx_group_join_requests_user
  ON group_join_requests (user_id);

ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;

-- Swoją prośbę widzi proszący (żeby wiedzieć, że wisi) i rozpatrujący.
-- Reszta ekipy nie — to nie jest ogłoszenie dla wszystkich.
DROP POLICY IF EXISTS "Prosbe widzi proszacy i rozpatrujacy" ON group_join_requests;
CREATE POLICY "Prosbe widzi proszacy i rozpatrujacy" ON group_join_requests FOR SELECT
  USING (auth.uid() = user_id OR czy_moze_zarzadzac_grupa(group_id));

-- Wycofanie własnej prośby. Rozpatrujący NIE kasuje — od tego jest decyzja,
-- która zostawia ślad (`odrzucona`), inaczej odrzucony prosiłby w kółko, nie
-- wiedząc, że już raz dostał odpowiedź.
DROP POLICY IF EXISTS "Wycofanie wlasnej prosby" ON group_join_requests;
CREATE POLICY "Wycofanie wlasnej prosby" ON group_join_requests FOR DELETE
  USING (auth.uid() = user_id);

-- Brak polityk INSERT i UPDATE — jedyne wejście to dwie funkcje niżej.
-- Bez tego proszący ustawiłby sobie `status = 'przyjeta'` (RLS jest
-- wierszowe, nie kolumnowe — ta sama pułapka co w `132`), a samo przyjęcie
-- i tak musi pisać do `group_members`, gdzie od `094` nie ma polityki INSERT.

-- ---------------------------------------------------------------------------
-- 4a. Wysłanie prośby
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION popros_o_dolaczenie_do_grupy(
  p_group_id UUID,
  p_wiadomosc TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_nazwa     TEXT;
  v_id        UUID;
  v_status    TEXT;
  v_rozpatrzona TIMESTAMPTZ;
  v_imie      TEXT;
  v_tresc     TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby poprosić o dołączenie';
  END IF;

  SELECT g.name INTO v_nazwa FROM groups g WHERE g.id = p_group_id;
  IF v_nazwa IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiej ekipy';
  END IF;

  IF EXISTS (SELECT 1 FROM group_members m
              WHERE m.group_id = p_group_id AND m.user_id = v_user) THEN
    RAISE EXCEPTION 'Jesteś już w tej ekipie';
  END IF;

  SELECT r.id, r.status, r.rozpatrzona_at INTO v_id, v_status, v_rozpatrzona
    FROM group_join_requests r
   WHERE r.group_id = p_group_id AND r.user_id = v_user;

  -- Prośba już wisi — powtórne kliknięcie (odświeżona strona, dwa telefony)
  -- oddaje tę samą prośbę zamiast dokładać drugi dzwonek.
  IF v_status = 'oczekuje' THEN
    RETURN v_id;
  END IF;

  -- Odrzucenie ma trzymać tydzień. Bez tego „Poproś" jest przyciskiem
  -- „zawołaj założyciela", którego nie da się wyłączyć.
  IF v_status = 'odrzucona' AND v_rozpatrzona > now() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Ta ekipa nie przyjęła Twojej prośby. Możesz spróbować ponownie za jakiś czas.';
  END IF;

  v_tresc := nullif(btrim(coalesce(p_wiadomosc, '')), '');
  IF char_length(v_tresc) > 300 THEN
    v_tresc := left(v_tresc, 300);
  END IF;

  INSERT INTO group_join_requests (group_id, user_id, wiadomosc)
  VALUES (p_group_id, v_user, v_tresc)
  ON CONFLICT (group_id, user_id) DO UPDATE
     SET status = 'oczekuje', wiadomosc = EXCLUDED.wiadomosc,
         rozpatrzyl = NULL, rozpatrzona_at = NULL, created_at = now()
  RETURNING id INTO v_id;

  SELECT coalesce(p.display_name, 'Gracz') INTO v_imie
    FROM profiles p WHERE p.id = v_user;

  -- Dzwonek idzie do tych, którzy mogą to rozpatrzyć — założyciel i
  -- `can_manage_members`. Reszcie ekipy prośba nie daje nic do zrobienia.
  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'prosba_do_grupy',
         'Prośba o dołączenie do ekipy',
         coalesce(v_imie, 'Ktoś') || ' chce dołączyć do ekipy ' || v_nazwa || '.',
         p_group_id
    FROM group_members gm
   WHERE gm.group_id = p_group_id
     AND gm.user_id <> v_user
     AND (gm.can_manage_members
          OR gm.user_id = (SELECT g.created_by FROM groups g WHERE g.id = p_group_id));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION popros_o_dolaczenie_do_grupy(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4b. Rozpatrzenie prośby
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rozpatrz_prosbe_do_grupy(p_request_id UUID, p_akceptuj BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prosba group_join_requests%ROWTYPE;
  v_nazwa  TEXT;
BEGIN
  SELECT * INTO v_prosba FROM group_join_requests WHERE id = p_request_id;
  IF v_prosba.id IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiej prośby';
  END IF;
  IF NOT czy_moze_zarzadzac_grupa(v_prosba.group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby rozpatrywać prośby do tej ekipy';
  END IF;
  IF v_prosba.status <> 'oczekuje' THEN
    RAISE EXCEPTION 'Ta prośba została już rozpatrzona';
  END IF;

  SELECT g.name INTO v_nazwa FROM groups g WHERE g.id = v_prosba.group_id;

  UPDATE group_join_requests
     SET status = CASE WHEN p_akceptuj THEN 'przyjeta' ELSE 'odrzucona' END,
         rozpatrzyl = auth.uid(),
         rozpatrzona_at = now()
   WHERE id = p_request_id;

  IF p_akceptuj THEN
    -- `invited_by` = ten, kto przyjął: „kto go przyprowadził" (`094`) ma tu
    -- dokładnie to samo znaczenie co przy zaproszeniu linkiem.
    INSERT INTO group_members (group_id, user_id, role, invited_by)
    VALUES (v_prosba.group_id, v_prosba.user_id, 'member', auth.uid())
    ON CONFLICT (group_id, user_id) DO NOTHING;

    INSERT INTO notifications (user_id, type, title, body, group_id)
    VALUES (v_prosba.user_id,
            'prosba_do_grupy_przyjeta',
            'Jesteś w ekipie ' || coalesce(v_nazwa, ''),
            'Od teraz widzisz jej mecze, skład i rozmowę.',
            v_prosba.group_id);
  ELSE
    -- Bez nazwy ekipy w treści i bez `group_id`: kliknięcie prowadziłoby na
    -- stronę, na której i tak nic nie ma. Odmowa ma być krótka i skończona.
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (v_prosba.user_id,
            'prosba_do_grupy_odrzucona',
            'Prośba o dołączenie nie została przyjęta',
            'Ekipa nie przyjęła Twojej prośby o dołączenie.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rozpatrz_prosbe_do_grupy(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Podgląd zaproszenia — jedyna rzecz, która działa BEZ członkostwa
-- ---------------------------------------------------------------------------
-- `/g/[kod]` czytało dotąd `groups`, `group_members` i `events` wprost,
-- kluczem `anon`. Po punktach 1–3 nie ma do tego prawa, a strona musi
-- pokazać, DO CZEGO ktoś jest zapraszany — inaczej link prowadzi do pustej
-- kartki. Uprawnieniem jest sam kod, tak jak `claim_token` przy wpisie gościa
-- (`128`): kto go ma, dostaje wizytówkę ekipy. Nie skład — liczbę osób.
CREATE OR REPLACE FUNCTION podglad_zaproszenia_do_grupy(p_code TEXT, p_od UUID DEFAULT NULL)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  sport             TEXT,
  city              TEXT,
  field_name        TEXT,
  cover_image_url   TEXT,
  join_code         TEXT,
  created_at        TIMESTAMPTZ,
  member_count      INT,
  matches_played    INT,
  next_date         DATE,
  next_time         TIME,
  next_field_name   TEXT,
  next_max_players  INT,
  next_taken        INT,
  inviter_name      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH g AS (
    SELECT * FROM groups WHERE join_code = upper(btrim(coalesce(p_code, '')))
  ),
  nast AS (
    SELECT e.* FROM events e, g
     WHERE e.group_id = g.id AND e.status <> 'cancelled' AND e.event_date >= CURRENT_DATE
     ORDER BY e.event_date, e.event_time
     LIMIT 1
  )
  SELECT g.id, g.name, g.sport, g.city, g.field_name, g.cover_image_url,
         g.join_code, g.created_at,
         (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id),
         (SELECT count(*)::int FROM events e
           WHERE e.group_id = g.id AND e.status <> 'cancelled' AND e.event_date < CURRENT_DATE),
         n.event_date, n.event_time, n.field_name, n.max_players,
         (SELECT count(*)::int FROM event_participants ep
           WHERE ep.event_id = n.id AND NOT ep.is_reserve AND NOT ep.pending_approval),
         -- Zapraszający liczy się WYŁĄCZNIE wtedy, gdy sam jest w ekipie —
         -- ten sam warunek co w `dolacz_do_grupy_kodem()` (`094`), bo `?od=`
         -- przychodzi z adresu i każdy może tam wpisać, co chce.
         (SELECT p.display_name FROM profiles p
           JOIN group_members m ON m.user_id = p.id AND m.group_id = g.id
          WHERE p.id = p_od)
    FROM g LEFT JOIN nast n ON true;
$$;

GRANT EXECUTE ON FUNCTION podglad_zaproszenia_do_grupy(TEXT, UUID) TO anon, authenticated;
