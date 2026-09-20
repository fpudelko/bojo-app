-- ============================================================================
-- 154_turniej_zaproszenia.sql — kapitan zaprasza imiennie, drugą drogą
-- obok linku `/t/[kod]`.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Link do drużyny działa dla kolegów spoza Bojo i na WhatsAppie,
-- ale dla kogoś, kto konto JUŻ MA, jest najsłabszą możliwą drogą: turniej ginie
-- w wklejonym odnośniku zamiast pojawić się w aplikacji. Imienne zaproszenie
-- robi dokładnie to samo, co `event_player_invites` przy meczu (migracja `060`)
-- i powtarza jego trzy zasady:
--
--   1. zaproszenie NIE zajmuje miejsca w składzie i niczego nie przesądza —
--      jest wyłącznie sposobem, żeby rzecz pojawiła się u zapraszanego,
--   2. duplikaty pomija baza (`UNIQUE (druzyna_id, user_id)`), więc powtórne
--      „zaproś ekipę" nie wskrzesza zaproszenia, które ktoś świadomie odrzucił,
--   3. odrzucone zostaje w tabeli (`dismissed_at`), żeby nie wróciło.
--
-- KTO ZAPRASZA: wyłącznie KAPITAN drużyny. Nie organizator — decyzja właściciela
-- z 2026-09-20: organizator nie widzi i nie tyka zaproszeń w cudzych drużynach.
-- Dlatego polityki NIE używają `czy_kapitan_druzyny()` (145), która celowo
-- przepuszcza też zarządzających turniejem, tylko nowej, ściślejszej
-- `czy_sam_kapitan_druzyny()`. Dwie funkcje o podobnych nazwach to koszt, który
-- płacimy świadomie — alternatywą jest polityka udająca, że organizator jest
-- kapitanem każdej drużyny.
--
-- KOGO MOŻNA ZAPROSIĆ: interfejs bierze kandydatów wyłącznie z EKIP kapitana
-- (`getMyGroups` → `getGroupMembers`, jak `InviteFromGroupDialog.tsx` przy
-- meczu). Baza tego nie wymusza i nie ma po czym — ale wyszukiwarka po całym
-- Bojo wymagałaby udostępnienia listy wszystkich kont, więc jej nie ma.
--
-- `turniej_id` STOI W TABELI, choć wynika z `druzyna_id`. Ten sam wybór co
-- w `turniej_zawodnicy` (145): powiadomienia niosą `notifications.turniej_id`,
-- a zapytania kapitana i zaproszonego filtrują po turnieju — join w każdej
-- polityce kosztowałby więcej niż jedna kolumna pilnowana wyzwalaczem.
--
-- SPRZĄTANIE PO SOBIE: gdy zaproszony realnie wejdzie do drużyny, zaproszenie
-- gaśnie samo (wyzwalacz na `turniej_zawodnicy`). Bez tego karta „Marek
-- zaprasza Cię do drużyny Dziki" wisiałaby na stronie głównej człowiekowi,
-- który już w tej drużynie gra.
--
-- Migracja jest idempotentna — patrz AGENTS.md, „migracja ma dać się puścić
-- drugi raz".
-- ============================================================================

-- ── 1. Tabela ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_zaproszenia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id   uuid NOT NULL REFERENCES turnieje        ON DELETE CASCADE,
  druzyna_id   uuid NOT NULL REFERENCES turniej_druzyny ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users      ON DELETE CASCADE,
  zaprosil_id  uuid          REFERENCES auth.users      ON DELETE SET NULL,
  -- Z której ekipy wyszło zaproszenie — pozwala napisać „z ekipy Czwartkowa
  -- gierka", tak samo jak `event_player_invites.group_id` (060).
  group_id     uuid          REFERENCES groups          ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,

  UNIQUE (druzyna_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_turniej_zaproszenia_user
  ON turniej_zaproszenia (user_id) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_turniej_zaproszenia_druzyna
  ON turniej_zaproszenia (druzyna_id);

-- ── 2. Kapitan i tylko kapitan ──────────────────────────────────────────────

-- Świadomie WĘŻSZA od `czy_kapitan_druzyny()` (145), która przepuszcza także
-- zarządzających turniejem. Tu chodzi o samego kapitana — patrz nagłówek.
CREATE OR REPLACE FUNCTION czy_sam_kapitan_druzyny(p_druzyna uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM turniej_druzyny d
    WHERE d.id = p_druzyna AND d.kapitan_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION czy_sam_kapitan_druzyny(uuid) TO anon, authenticated;

-- ── 3. Spójność `turniej_id` z drużyną ──────────────────────────────────────

-- Kolumna jest zdenormalizowana (patrz nagłówek), więc ktoś musi jej pilnować.
-- Wyzwalacz, nie CHECK: CHECK nie może sięgnąć do innej tabeli.
CREATE OR REPLACE FUNCTION turniej_zaproszenia_dopelnij()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT d.turniej_id INTO NEW.turniej_id
    FROM turniej_druzyny d WHERE d.id = NEW.druzyna_id;
  IF NEW.turniej_id IS NULL THEN
    RAISE EXCEPTION 'Drużyna % nie istnieje', NEW.druzyna_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_turniej_zaproszenia_dopelnij ON turniej_zaproszenia;
CREATE TRIGGER trg_turniej_zaproszenia_dopelnij
  BEFORE INSERT ON turniej_zaproszenia
  FOR EACH ROW EXECUTE FUNCTION turniej_zaproszenia_dopelnij();

-- ── 4. Powiadomienie do zaproszonego ────────────────────────────────────────

-- Neutralne, nie niebieskie: niebieski jest w AGENTS.md zarezerwowany dla
-- „wymaga akceptacji uczestnictwa", czyli dla decyzji, której ktoś OD CIEBIE
-- oczekuje i która kogoś blokuje. Zaproszenie niczego nie blokuje — dokładnie
-- jak `zaproszenie_na_mecz`, którego wzorzec powtarzamy.
CREATE OR REPLACE FUNCTION powiadom_o_zaproszeniu_do_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna text;
  v_turniej text;
BEGIN
  SELECT d.nazwa, t.nazwa INTO v_druzyna, v_turniej
    FROM turniej_druzyny d JOIN turnieje t ON t.id = d.turniej_id
   WHERE d.id = NEW.druzyna_id;

  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  VALUES (NEW.user_id, 'turniej_zaproszenie_do_druzyny',
          'Zaproszenie do drużyny',
          v_druzyna || ' gra w: ' || v_turniej || '. Dołącz do składu.',
          NEW.turniej_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_turniej_zaproszenie ON turniej_zaproszenia;
CREATE TRIGGER trg_turniej_zaproszenie AFTER INSERT ON turniej_zaproszenia
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_zaproszeniu_do_druzyny();

-- ── 5. Zaproszenie gaśnie, gdy człowiek wejdzie do drużyny ──────────────────

CREATE OR REPLACE FUNCTION zgas_zaproszenie_po_dolaczeniu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE turniej_zaproszenia
       SET dismissed_at = now()
     WHERE druzyna_id = NEW.druzyna_id
       AND user_id    = NEW.user_id
       AND dismissed_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

-- INSERT i UPDATE: do drużyny wchodzi się dopisaniem nowego wiersza ALBO
-- przejęciem wpisu dopisanego wcześniej z ręki („to ja"), czyli `UPDATE …
-- SET user_id`. Wyzwalacz tylko na INSERT przegapiłby drugą drogę.
DROP TRIGGER IF EXISTS trg_zgas_zaproszenie ON turniej_zawodnicy;
CREATE TRIGGER trg_zgas_zaproszenie AFTER INSERT OR UPDATE OF user_id ON turniej_zawodnicy
  FOR EACH ROW EXECUTE FUNCTION zgas_zaproszenie_po_dolaczeniu();

-- ── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE turniej_zaproszenia ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON turniej_zaproszenia TO authenticated;

-- Widzi: zaproszony i kapitan drużyny. NIE organizator turnieju — patrz
-- nagłówek. Administrator jak wszędzie w module.
DROP POLICY IF EXISTS "Zaproszenie czyta zaproszony i kapitan" ON turniej_zaproszenia;
CREATE POLICY "Zaproszenie czyta zaproszony i kapitan" ON turniej_zaproszenia FOR SELECT
  USING (
    user_id = auth.uid()
    OR czy_sam_kapitan_druzyny(druzyna_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Zaprasza wyłącznie kapitan tej drużyny.
DROP POLICY IF EXISTS "Zaprasza kapitan druzyny" ON turniej_zaproszenia;
CREATE POLICY "Zaprasza kapitan druzyny" ON turniej_zaproszenia FOR INSERT
  WITH CHECK (czy_sam_kapitan_druzyny(druzyna_id));

-- Odrzuca/chowa wyłącznie zaproszony.
DROP POLICY IF EXISTS "Zaproszony chowa swoje zaproszenie" ON turniej_zaproszenia;
CREATE POLICY "Zaproszony chowa swoje zaproszenie" ON turniej_zaproszenia FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Wycofuje kapitan albo sam zaproszony.
DROP POLICY IF EXISTS "Zaproszenie wycofuje kapitan lub zaproszony" ON turniej_zaproszenia;
CREATE POLICY "Zaproszenie wycofuje kapitan lub zaproszony" ON turniej_zaproszenia FOR DELETE
  USING (user_id = auth.uid() OR czy_sam_kapitan_druzyny(druzyna_id));
