-- 150: Ekipa przestaje być publiczną wizytówką — obcy widzi NAZWĘ, a wejście
--      do niej zawsze wymaga CZYJEJŚ DECYZJI.
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
--
-- CO JEST PO. Obcy widzi nazwę (bo link zaproszenia i podgląd na Messengerze
-- muszą mieć co pokazać) i przycisk „Poproś o dołączenie". Skład, rozmowa,
-- statystyki i kod — wyłącznie dla członków. Rozmowa i statystyki były
-- domknięte od `093`/`095`; ta migracja dociąga do nich samą ekipę.
--
-- DO EKIPY NIE WCHODZI SIĘ Z LINKU — TO JEST SEDNO TEJ MIGRACJI.
-- `dolacz_do_grupy_kodem()` (`094`) dopisywała do składu KAŻDEGO, kto podał
-- kod: link wklejony raz na czacie zostaje na zawsze, a kod jest jeden dla
-- całej ekipy i nie da się go cofnąć jednej osobie. Ta funkcja ZNIKA. Kod
-- i link dalej działają, tylko robią co innego: pokazują wizytówkę ekipy
-- i SKŁADAJĄ PROŚBĘ podpisaną zaproszeniem (`z_kodu`, `invited_by`), którą
-- założyciel albo ktoś z `can_manage_members` przyjmuje jednym kliknięciem.
-- Po tej migracji do `group_members` prowadzą dokładnie dwie drogi, obie
-- przez czyjąś decyzję: `rozpatrz_prosbe_do_grupy()` i
-- `dodaj_czlonka_do_grupy()` (`094`, `can_manage_members`).
--
-- DLACZEGO NAZWA ZOSTAJE PUBLICZNA. Musi ją wypisać podgląd linku
-- (`/g/[kod]`, `/grupy/[id]` w metadanych OG) renderowany kluczem `anon`,
-- zanim ktokolwiek się zaloguje. Nazwa jest tym, co i tak wkleja się na
-- Messengerze razem z linkiem. Wydaje ją funkcja `grupa_publicznie()` —
-- wąskie okno na dwie kolumny zamiast polityki wierszowej `USING (true)`,
-- która oddawała cały wiersz z kodem dołączenia włącznie.
--
-- CZEGO TA MIGRACJA ŚWIADOMIE NIE RUSZA: POLITYK NA `events`.
-- Mecz prywatny przypięty do ekipy zostaje czytelny dla każdego, kto ma
-- adres — bo z linku do meczu MAJĄ grać ludzie spoza ekipy. To jest cały
-- model „private = unlisted, dzielony linkiem" z `002` i decyzja produktowa,
-- nie przeoczenie. Skutek uboczny, który trzeba znać: `events` ma dalej
-- `USING (true)`, a RLS jest wierszowe i nie umie odróżnić „odczyt po id"
-- od „odczytu po `group_id`" — czyli terminarz ekipy nadal da się wylistować
-- jednym zapytaniem, znając UUID ekipy. Zamknięcie tego BEZ zabrania linku
-- graczom nie jest możliwe politykami; pilnuje tego asercja w sekcji
-- „ZNANE, ŚWIADOMIE OTWARTE" w `supabase/test/rls.sql`.
--
-- Strona ekipy nie pokazuje obcemu tych meczów, bo nie ma skąd — `groups`
-- i `group_members` są zamknięte, więc UI nie ma czego renderować.

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
-- 3. Prośba o dołączenie — jedyna droga do składu poza zaproszeniem wprost
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
  -- Prośba z LINKU/KODU zaproszenia, nie z błądzenia po aplikacji — plus kto
  -- ten link dał (`invited_by`, weryfikowane w bazie tak samo jak w `094`:
  -- musi sam być w ekipie). Rozpatrujący widzi wtedy „Krzysiek go zaprosił"
  -- zamiast gołego imienia obcej osoby — i to jest cała różnica między
  -- kliknięciem „Przyjmij" od razu a odkładaniem decyzji.
  z_kodu         BOOLEAN NOT NULL DEFAULT false,
  invited_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rozpatrzyl     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rozpatrzona_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Migracja MUSI dać się puścić drugi raz (AGENTS.md): gdy tabela powstała
-- wcześniejszym przebiegiem tego pliku, kolumny dokladamy tutaj.
ALTER TABLE group_join_requests
  ADD COLUMN IF NOT EXISTS z_kodu     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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
-- 3a. Złożenie prośby — wspólne jądro obu wejść
-- ---------------------------------------------------------------------------
-- NIE JEST WOŁANA Z PRZEGLĄDARKI. `z_kodu` i `invited_by` muszą być
-- WYLICZONE z prawdziwego kodu, nie przysłane przez klienta — inaczej każdy
-- podpisałby sobie prośbę „z zaproszenia od założyciela", a to jest jedyna
-- rzecz, na której rozpatrujący ma się oprzeć.
--
-- `REVOKE ... FROM PUBLIC` jest tu konieczne: Postgres nadaje EXECUTE roli
-- PUBLIC każdej nowej funkcji, a PostgREST wystawia schemat `public` — bez
-- tego „wewnętrzna" funkcja byłaby zwykłym endpointem REST-a.
CREATE OR REPLACE FUNCTION zloz_prosbe_do_grupy(
  p_group_id  UUID,
  p_wiadomosc TEXT,
  p_od        UUID,
  p_z_kodu    BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_nazwa       TEXT;
  v_id          UUID;
  v_status      TEXT;
  v_rozpatrzona TIMESTAMPTZ;
  v_imie        TEXT;
  v_tresc       TEXT;
  v_od          UUID := NULL;
  v_od_imie     TEXT;
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

  -- Zapraszający liczy się TYLKO wtedy, gdy sam należy do ekipy — ten sam
  -- warunek co w `dolacz_do_grupy_kodem()` (`094`), bo `?od=` przychodzi
  -- z adresu i każdy może tam wpisać, co chce.
  IF p_od IS NOT NULL AND EXISTS (
       SELECT 1 FROM group_members m WHERE m.group_id = p_group_id AND m.user_id = p_od
     ) THEN
    v_od := p_od;
  END IF;

  SELECT r.id, r.status, r.rozpatrzona_at INTO v_id, v_status, v_rozpatrzona
    FROM group_join_requests r
   WHERE r.group_id = p_group_id AND r.user_id = v_user;

  -- Prośba już wisi — powtórne kliknięcie (odświeżona strona, dwa telefony,
  -- link otwarty drugi raz) oddaje tę samą prośbę zamiast dokładać drugi
  -- dzwonek.
  IF v_status = 'oczekuje' THEN
    RETURN v_id;
  END IF;

  -- Odrzucenie ma trzymać tydzień — także prośbę z linku. Inaczej odrzucony
  -- wracałby kolejnym kliknięciem w ten sam link, a „Poproś o dołączenie"
  -- byłoby przyciskiem „zawołaj założyciela" bez wyłącznika.
  IF v_status = 'odrzucona' AND v_rozpatrzona > now() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Ta ekipa nie przyjęła Twojej prośby. Możesz spróbować ponownie za jakiś czas.';
  END IF;

  v_tresc := nullif(btrim(coalesce(p_wiadomosc, '')), '');
  IF char_length(v_tresc) > 300 THEN
    v_tresc := left(v_tresc, 300);
  END IF;

  INSERT INTO group_join_requests (group_id, user_id, wiadomosc, z_kodu, invited_by)
  VALUES (p_group_id, v_user, v_tresc, coalesce(p_z_kodu, false), v_od)
  ON CONFLICT (group_id, user_id) DO UPDATE
     SET status = 'oczekuje', wiadomosc = EXCLUDED.wiadomosc,
         z_kodu = EXCLUDED.z_kodu, invited_by = EXCLUDED.invited_by,
         rozpatrzyl = NULL, rozpatrzona_at = NULL, created_at = now()
  RETURNING id INTO v_id;

  SELECT coalesce(p.display_name, 'Gracz') INTO v_imie
    FROM profiles p WHERE p.id = v_user;
  SELECT p.display_name INTO v_od_imie FROM profiles p WHERE p.id = v_od;

  -- Dzwonek idzie do tych, którzy mogą to rozpatrzyć — założyciel i
  -- `can_manage_members`. Reszcie ekipy prośba nie daje nic do zrobienia.
  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'prosba_do_grupy',
         'Prośba o dołączenie do ekipy',
         coalesce(v_imie, 'Ktoś') || ' chce dołączyć do ekipy ' || v_nazwa || '.'
           || CASE
                WHEN v_od_imie IS NOT NULL THEN ' Z zaproszenia: ' || v_od_imie || '.'
                WHEN coalesce(p_z_kodu, false) THEN ' Z linku zaproszenia.'
                ELSE ''
              END,
         p_group_id
    FROM group_members gm
   WHERE gm.group_id = p_group_id
     AND gm.user_id <> v_user
     AND (gm.can_manage_members
          OR gm.user_id = (SELECT g.created_by FROM groups g WHERE g.id = p_group_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION zloz_prosbe_do_grupy(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3b. Dwa wejścia: ze strony ekipy i z linku/kodu zaproszenia
-- ---------------------------------------------------------------------------
-- Prośba „od siebie": ktoś trafił na ekipę i chce do niej wejść.
CREATE OR REPLACE FUNCTION popros_o_dolaczenie_do_grupy(
  p_group_id UUID,
  p_wiadomosc TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT zloz_prosbe_do_grupy(p_group_id, p_wiadomosc, NULL, false);
$$;

GRANT EXECUTE ON FUNCTION popros_o_dolaczenie_do_grupy(UUID, TEXT) TO authenticated;

-- Prośba Z LINKU — następca `dolacz_do_grupy_kodem()`. Kod dalej jest wart
-- tyle, że OD RAZU wiadomo, o którą ekipę chodzi i kto zaprasza; przestał
-- być natomiast przepustką do składu. Nieznany kod wraca tym samym błędem co
-- dotąd, żeby literowka w kodzie nie wyglądała jak awaria.
CREATE OR REPLACE FUNCTION popros_o_dolaczenie_kodem(
  p_code TEXT,
  p_od UUID DEFAULT NULL,
  p_wiadomosc TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group UUID;
BEGIN
  SELECT g.id INTO v_group FROM groups g
   WHERE g.join_code = upper(btrim(coalesce(p_code, '')));
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Nie ma grupy o tym kodzie';
  END IF;

  PERFORM zloz_prosbe_do_grupy(v_group, p_wiadomosc, p_od, true);
  -- Zwracamy EKIPĘ, nie prośbę: wołający nawiguje na jej stronę, żeby
  -- zobaczyć, że prośba czeka.
  RETURN v_group;
END;
$$;

GRANT EXECUTE ON FUNCTION popros_o_dolaczenie_kodem(TEXT, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3b'. Koniec wchodzenia do ekipy z linku
-- ---------------------------------------------------------------------------
-- `dolacz_do_grupy_kodem()` (`094`) dopisywała do `group_members` każdego, kto
-- podał kod. Kod jest JEDEN dla całej ekipy, link zostaje w czacie na zawsze
-- i nie da się go unieważnić jednej osobie — a wejście do ekipy ma być
-- czyjąś decyzją. Funkcja ZNIKA, nie zostaje „na wszelki wypadek": dopóki
-- istnieje z GRANT-em dla `authenticated`, jest działającym obejściem
-- wszystkiego, co robi ta migracja — jednym wywołaniem REST-a.
--
-- KOLEJNOŚĆ WDROŻENIA MA ZNACZENIE (migracje puszcza się ręcznie): stary
-- front woła tę funkcję przy „Mam kod", więc między uruchomieniem migracji
-- a deployem tego PR-a „Mam kod" odpowie błędem. Tak jest lepiej niż
-- odwrotnie — funkcja, która po cichu dalej wpuszcza, jest dokładnie tą
-- dziurą, którą zamykamy.
DROP FUNCTION IF EXISTS dolacz_do_grupy_kodem(TEXT, UUID);

-- ---------------------------------------------------------------------------
-- 3c. Rozpatrzenie prośby
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
    -- „Kto go przyprowadził" (`094`): autor zaproszenia, jeśli prośba przyszła
    -- z jego linku, a w przeciwnym razie ten, kto ją przyjął.
    INSERT INTO group_members (group_id, user_id, role, invited_by)
    VALUES (v_prosba.group_id, v_prosba.user_id, 'member',
            coalesce(v_prosba.invited_by, auth.uid()))
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
-- 4. Podgląd zaproszenia — co widzi ktoś z kodem, jeszcze przed prośbą
-- ---------------------------------------------------------------------------
-- `/g/[kod]` czytało dotąd `groups` i `group_members` wprost, kluczem `anon`.
-- Po punktach 1–2 nie ma do tego prawa, a strona musi pokazać, DO CZEGO ktoś
-- jest zapraszany — inaczej link prowadzi do pustej kartki. Uprawnieniem jest
-- sam kod, tak jak `claim_token` przy wpisie gościa (`128`): kto go ma,
-- dostaje wizytówkę ekipy. Nie skład — liczbę osób. Samo obejrzenie
-- wizytówki niczego nie przesądza: wejście to osobny krok, przez prośbę.
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
