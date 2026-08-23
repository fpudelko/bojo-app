-- 124: Rozmowy prywatne między graczami (1-na-1) wraz z blokowaniem
--      i zgłaszaniem.
--
-- PO CO. Jedynym pisemnym kanałem w Bojo były dotąd rozmowy POD meczem
-- (`event_comments`, 026) i tablica ekipy (`group_posts`, 093) — obie grupowe
-- i obie zawieszone na czymś większym. Prywatne „Kuba, grasz w czwartek?"
-- albo „daj znać, jak zwolni się miejsce" szło na Messengera — do ludzi,
-- których gracz zna często TYLKO z boiska i nie ma do nich numeru.
--
-- BLOKOWANIE I ZGŁASZANIE SĄ CZĘŚCIĄ TEJ SAMEJ MIGRACJI, nie osobnym etapem.
-- Otwarty kanał do dowolnej osoby bez wyjścia awaryjnego to nie jest wersja
-- „pierwsza, uproszczona" — to jest wersja, której nie wolno wypuścić.
-- Aplikacja, w której organizator podaje numer telefonu do BLIKA, nie może
-- dawać obcemu możliwości pisania bez możliwości ucięcia tego jednym
-- kliknięciem.
--
-- KSZTAŁT WIADOMOŚCI. Bliźniaczy do `event_comments`/`group_posts`: płaska
-- lista (odpowiedzią jest nowa wiadomość), długość 1..1000, miękkie kasowanie
-- (`deleted_at`), nazwa nadawcy zapisana na sztywno przy wpisie. Czwarta kopia
-- tego samego kształtu jest celowa — patrz uzasadnienie w `063`.
--
-- JEDNA ROZMOWA = JEDNA PARA. Para jest KANONICZNA: `low_user_id < high_user_id`
-- (pilnuje CHECK). Rozmowa A↔B to zawsze dokładnie jeden wiersz, niezależnie
-- od tego, kto pisze pierwszy — bez tego porządku trzeba by pilnować dwóch
-- permutacji przy każdym zapisie i każdym odczycie, a pomyłka oznacza dwie
-- równoległe rozmowy tych samych osób. Klucz główny na parze daje unikalność
-- za darmo; tabela nie potrzebuje własnego `id`.
--
-- OSOBNE TABELE, NIE KOLUMNA „typ" W `event_comments`. Komentarz meczowy jest
-- czytelny dla uczestników meczu, rozmowa prywatna — wyłącznie dla dwóch osób.
-- Różnica widoczności o KLASĘ ważniejsza niż oszczędność dwóch tabel: polityki
-- RLS dla DM muszą być czytelne na pierwszy rzut oka, bo ich błąd oznacza cudzą
-- korespondencję na wyciągnięcie ręki.

CREATE TABLE IF NOT EXISTS dm_conversations (
  low_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  high_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (low_user_id, high_user_id),
  CHECK (low_user_id < high_user_id)
);

COMMENT ON TABLE dm_conversations IS
  'Rozmowy prywatne 1-na-1 (migracja 124). Para kanoniczna low < high: rozmowa A↔B to jeden wiersz bez względu na to, kto pisze pierwszy.';

CREATE TABLE IF NOT EXISTS dm_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  low_user_id  UUID NOT NULL,
  high_user_id UUID NOT NULL,
  sender_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name  TEXT NOT NULL,
  content      TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  FOREIGN KEY (low_user_id, high_user_id)
    REFERENCES dm_conversations (low_user_id, high_user_id) ON DELETE CASCADE,
  -- Nadawca MUSI być stroną rozmowy — CHECK, nie tylko RLS, żeby reguła
  -- obowiązywała także zapisy omijające polityki (service role, wyzwalacz).
  CHECK (sender_id = low_user_id OR sender_id = high_user_id)
);

COMMENT ON TABLE dm_messages IS
  'Wiadomości prywatne (migracja 124). Miękkie kasowanie przez deleted_at, jak event_comments.';

CREATE INDEX IF NOT EXISTS dm_messages_rozmowa_czas
  ON dm_messages (low_user_id, high_user_id, created_at);

-- ---------------------------------------------------------------------------
-- Blokady
-- ---------------------------------------------------------------------------
-- KIERUNKOWA, nie symetryczna: „ja zablokowałem jego". Blokada działa jednak
-- w OBIE strony przy pisaniu — zablokowany nie napisze do mnie, a ja nie
-- napiszę do niego. To drugie jest celowe: kanał, który po zablokowaniu działa
-- w jedną stronę, jest gorszy niż brak blokady, bo daje złudzenie kontaktu.

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

COMMENT ON TABLE user_blocks IS
  'Kto kogo zablokował (migracja 124). Wpis kierunkowy, ale przy pisaniu obowiązuje w obie strony — patrz czy_zablokowani().';

CREATE TABLE IF NOT EXISTS user_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  powod       TEXT NOT NULL CHECK (char_length(btrim(powod)) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_id)
);

COMMENT ON TABLE user_reports IS
  'Zgłoszenia użytkowników (migracja 124). Czyta wyłącznie administracja — zgłaszający nie widzi cudzych zgłoszeń, a zgłoszony nie widzi żadnego.';

/**
 * Czy między tą parą stoi blokada — W KTÓRĄKOLWIEK stronę.
 * SECURITY DEFINER, bo polityka `dm_messages_insert` musi móc zajrzeć do
 * `user_blocks` drugiej osoby, których to wierszy zwykły użytkownik nie czyta.
 */
CREATE OR REPLACE FUNCTION czy_zablokowani(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
     WHERE (blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a)
  );
$$;

GRANT EXECUTE ON FUNCTION czy_zablokowani(UUID, UUID) TO authenticated;

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports     ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Polityki: widzi i pisze WYŁĄCZNIE uczestnik pary
-- ---------------------------------------------------------------------------
-- W przeciwieństwie do `event_comments` nie ma tu polityki dla `anon` i nie ma
-- ŻADNEJ ścieżki czytania cudzej rozmowy.

DROP POLICY IF EXISTS "dm_conversations_select" ON dm_conversations;
CREATE POLICY "dm_conversations_select" ON dm_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = low_user_id OR auth.uid() = high_user_id);

DROP POLICY IF EXISTS "dm_conversations_insert" ON dm_conversations;
CREATE POLICY "dm_conversations_insert" ON dm_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = low_user_id OR auth.uid() = high_user_id)
    AND NOT czy_zablokowani(low_user_id, high_user_id)
  );

DROP POLICY IF EXISTS "dm_messages_select" ON dm_messages;
CREATE POLICY "dm_messages_select" ON dm_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = low_user_id OR auth.uid() = high_user_id);

-- Blokada wchodzi w warunek ZAPISU, nie odczytu: historia sprzed blokady
-- zostaje widoczna obu stronom. Kasowanie cudzych wiadomości przy blokowaniu
-- byłoby przepisywaniem przeszłości — a zgłoszenie ma się do czego odwołać.
DROP POLICY IF EXISTS "dm_messages_insert" ON dm_messages;
CREATE POLICY "dm_messages_insert" ON dm_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (auth.uid() = low_user_id OR auth.uid() = high_user_id)
    AND NOT czy_zablokowani(low_user_id, high_user_id)
  );

-- Miękkie kasowanie: wyłącznie autor własnej wiadomości (jak w migracji 100
-- dla `event_comments`).
DROP POLICY IF EXISTS "dm_messages_update" ON dm_messages;
CREATE POLICY "dm_messages_update" ON dm_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Blokady: widzę i zakładam WYŁĄCZNIE własne. Nikt nie sprawdzi, czy został
-- zablokowany — dowiaduje się o tym tylko tyle, że wiadomość nie przechodzi.
DROP POLICY IF EXISTS "user_blocks_select" ON user_blocks;
CREATE POLICY "user_blocks_select" ON user_blocks FOR SELECT
  TO authenticated USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_insert" ON user_blocks;
CREATE POLICY "user_blocks_insert" ON user_blocks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_delete" ON user_blocks;
CREATE POLICY "user_blocks_delete" ON user_blocks FOR DELETE
  TO authenticated USING (auth.uid() = blocker_id);

-- Zgłoszenia: wyłącznie zapis. Ani zgłaszający, ani zgłoszony nie czytają
-- niczego — lista zgłoszeń jest sprawą administracji, a możliwość sprawdzenia
-- „czy ktoś mnie zgłosił" zamieniłaby narzędzie ochrony w narzędzie nacisku.
DROP POLICY IF EXISTS "user_reports_insert" ON user_reports;
CREATE POLICY "user_reports_insert" ON user_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);
