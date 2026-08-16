-- 093: Tablica grupy — miejsce, gdzie ekipa gada między meczami.
--
-- Dziś jedyne miejsce na słowo pisane w grupie to komentarze POD KONKRETNYM
-- meczem (`event_comments`, migracja `026`). Znikają razem z meczem
-- (ON DELETE CASCADE) i nie mają jak przenieść informacji, która meczu nie
-- dotyczy: "składka na siatki", "Kuba wraca po kontuzji", "w czwartek boisko
-- zajęte". Taka wiadomość albo szła na Messengera, albo nie szła nigdzie.
--
-- Kształt celowo bliźniaczy do `event_comments`/`field_comments`: ta sama
-- długość (1..1000), to samo miękkie kasowanie, to samo `user_name` zapisane
-- na sztywno przy wpisie. Trzecia kopia tego samego kształtu jest tańsza niż
-- wspólna tabela z kolumną "na co wskazuje" — patrz uzasadnienie w `063`.
--
-- PŁASKA LISTA, BEZ ODPOWIEDZI. Wątki wymagają parent_id, rekurencyjnego
-- odczytu, limitu zagnieżdżenia i reguły, co zrobić z odpowiedziami pod
-- skasowanym wpisem. Dwunastoosobowa ekipa tego nie potrzebuje — odpowiedzią
-- jest nowy wpis. Zamiast tego `pinned_at`: jedna rzecz naprawdę ważna
-- zostaje na górze (sortowanie potrzebuje daty, "przypięte 2 dni temu"
-- dostajemy za darmo).
--
-- CZYTAJĄ WYŁĄCZNIE CZŁONKOWIE — inaczej niż `event_comments`, które są
-- czytelne dla świata. Sama grupa (`groups`) zostaje publiczna, bo jej
-- strona jest celem linku zaproszenia i musi wyrenderować nazwę w
-- metadanych. Tablica jest o klasę bardziej prywatna: "składka 20 zł od
-- osoby" i "Kuba znowu nie przyszedł" nie mają być w wynikach Google.
-- Bramkę stawia `czy_czlonek_grupy()` z migracji `092`.
--
-- POWIADOMIENIE TYLKO O PRZYPIĘTYM WPISIE. Powiadamianie o każdym wpisie
-- zamienia dzwonek — dziś noszący prawie wyłącznie rzeczy WYMAGAJĄCE
-- DZIAŁANIA (patrz WYMAGA_AKCJI w lib/notifications.ts) — w kanał czatu.
-- Przypięcie robi świadomie ktoś z can_moderate_wall, więc jest dobrym
-- przybliżeniem "to jest ważne".

CREATE TABLE IF NOT EXISTS group_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name   TEXT NOT NULL,
  -- Ta sama długość co event_comments i field_comments — trzecia kopia tego
  -- samego kształtu jest tańsza niż wspólna tabela z kolumną "na co wskazuje".
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  -- pinned_at, nie is_pinned: sortowanie potrzebuje daty za darmo.
  pinned_at   TIMESTAMPTZ,
  -- Zapora przed powtórnym powiadomieniem przy odpięciu i ponownym przypięciu
  -- tego samego wpisu.
  notified_at TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_posts_group
  ON group_posts (group_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_posts_pinned
  ON group_posts (group_id, pinned_at DESC) WHERE deleted_at IS NULL AND pinned_at IS NOT NULL;

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_posts_select" ON group_posts;
CREATE POLICY "group_posts_select" ON group_posts FOR SELECT
  USING (deleted_at IS NULL AND czy_czlonek_grupy(group_id));

DROP POLICY IF EXISTS "group_posts_insert" ON group_posts;
CREATE POLICY "group_posts_insert" ON group_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND czy_czlonek_grupy(group_id));

-- UPDATE obsługuje DWIE rzeczy: miękkie kasowanie i przypinanie. RLS w
-- Postgresie działa na WIERSZ, nie na kolumnę, więc autor technicznie może
-- też przypiąć własny wpis. Świadomie na to pozwalamy (to jego ekipa i jego
-- wpis), ale POWIADOMIENIE i tak nie pójdzie — wyzwalacz niżej sprawdza
-- osobno, czy przypinający ma can_moderate_wall. Bez tego przypięcie byłoby
-- przyciskiem "wyślij powiadomienie do całej grupy" dla każdego.
DROP POLICY IF EXISTS "group_posts_update" ON group_posts;
CREATE POLICY "group_posts_update" ON group_posts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR czy_moze_moderowac_tablice(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR czy_moze_moderowac_tablice(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

-- Brak polityki DELETE: kasowanie jest wyłącznie miękkie, tak jak
-- w `event_comments` i `field_comments`.

-- ---------------------------------------------------------------------------
-- notifications.group_id — powiadomienie, które nie dotyczy meczu
-- ---------------------------------------------------------------------------
-- Dzwonek kieruje dziś wyłącznie na `/wydarzenia/{event_id}` albo na trasę
-- zaszytą w mapie TYP_NA_TRASE (`NotificationBell.tsx`). Powiadomienie
-- o ogłoszeniu w grupie nie ma meczu, więc bez tej kolumny renderowałoby się
-- jako martwy, nieklikalny wiersz.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

COMMENT ON COLUMN notifications.group_id IS
  'Grupa, której dotyczy powiadomienie. Gdy jest też event_id, pierwszeństwo w kierowaniu ma mecz.';

-- Powiadomienie o nowym meczu w grupie (`072`) też niesie odtąd grupę.
-- `event_id` zostaje, więc kierowanie w dzwonku nie zmienia się ani o piksel.
CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         'Nowy mecz w grupie',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Powiadomienie o przypiętym ogłoszeniu
-- ---------------------------------------------------------------------------
-- BEFORE, nie AFTER: `notified_at` ustawiamy prosto na NEW, bez UPDATE-u tego
-- samego wiersza z wnętrza wyzwalacza (który odpaliłby wyzwalacz ponownie).
-- SECURITY DEFINER z tego samego powodu co w `072`: `notifications` nie ma
-- polityki INSERT dla użytkownika, bo powiadomienie zawsze pisze się KOMU
-- INNEMU niż ten, kto wywołał akcję.
CREATE OR REPLACE FUNCTION powiadom_o_ogloszeniu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nazwa TEXT;
BEGIN
  IF NEW.pinned_at IS NULL OR NEW.notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pinned_at IS NOT NULL THEN
    RETURN NEW;  -- było już przypięte, nic nowego się nie stało
  END IF;
  -- Przypiąć własny wpis może autor (RLS jest wierszowe), ale rozesłać
  -- powiadomienie do całej ekipy — tylko ktoś z can_moderate_wall.
  IF NOT czy_moze_moderowac_tablice(NEW.group_id) THEN
    RETURN NEW;
  END IF;

  SELECT g.name INTO v_nazwa FROM groups g WHERE g.id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'ogloszenie_w_grupie',
         'Ogłoszenie w grupie ' || coalesce(v_nazwa, ''),
         left(NEW.body, 140),
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id;

  NEW.notified_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_ogloszeniu_w_grupie ON group_posts;
CREATE TRIGGER trg_powiadom_o_ogloszeniu_w_grupie
  BEFORE INSERT OR UPDATE ON group_posts
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_ogloszeniu_w_grupie();
