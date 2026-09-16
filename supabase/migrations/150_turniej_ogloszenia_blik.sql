-- ============================================================================
-- 150_turniej_ogloszenia_blik.sql — moduł turniejowy, Etap 4: ogłoszenia,
-- BLIK organizatora i „zamień drużynę w ekipę".
-- ----------------------------------------------------------------------------
-- OGŁOSZENIA. Jedyne miejsce, w którym organizator turnieju mówi coś do
-- wszystkich naraz („Start opóźniony 15 minut", „Boisko 2 zamknięte, gramy na
-- 1 i 3"). Publiczne — decyzja z `docs/turnieje-plan-duze-klocki.md` §5:
-- ogłoszenia organizatora widzi każdy, tak jak wynik meczu i terminarz.
-- Powiadomienie idzie do KAŻDEGO zawodnika z kontem w przyjętej drużynie —
-- to jedyna wiadomość w tym module, więc kolor jest różowy (AGENTS.md:
-- różowy = zawsze i wyłącznie wiadomość).
--
-- BLIK. `turniej_druzyny.wpisowe_oplacone_at` (migracja `145`) daje
-- organizatorowi przełącznik „zapłacone", ale nigdzie nie było WIDAĆ, na jaki
-- numer kapitan miał zapłacić. Ten sam powód co `event_blik` (migracja `120`):
-- osobna tabela, bo RLS jest wierszowe, a `turnieje` czyta każdy.
--
-- ZAMIEŃ DRUŻYNĘ W EKIPĘ. Turniej kończy się dziś pustką — dwunastu ludzi,
-- którzy przez dzień grali razem, nie mają jak umówić się na kolejny mecz
-- bez zakładania grupy ręcznie i zapraszania każdego z osobna. RPC robi to
-- jednym wywołaniem: nowa `groups` z tej samej nazwy (albo własnej), kapitan
-- jako założyciel (trigger `add_group_creator_as_member`, migracja `044`),
-- reszta zawodników z kontem dopisana wprost do `group_members`.
-- ============================================================================

-- ── 1. Ogłoszenia ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_ogloszenia (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  autor_id   uuid REFERENCES auth.users ON DELETE SET NULL,
  tresc      text NOT NULL CHECK (char_length(tresc) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ogloszenia_turniej
  ON turniej_ogloszenia(turniej_id, created_at DESC);

ALTER TABLE turniej_ogloszenia ENABLE ROW LEVEL SECURITY;

-- Publiczne, tak jak sam turniej i terminarz — patrz uzasadnienie w nagłówku.
DROP POLICY IF EXISTS "Ogloszenia czyta kazdy" ON turniej_ogloszenia;
CREATE POLICY "Ogloszenia czyta kazdy" ON turniej_ogloszenia FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ogloszenie pisze zarzadzajacy" ON turniej_ogloszenia;
CREATE POLICY "Ogloszenie pisze zarzadzajacy" ON turniej_ogloszenia FOR INSERT
  WITH CHECK (auth.uid() = autor_id AND czy_zarzadza_turniejem(turniej_id));

-- Bez UPDATE — ogłoszenie się nie edytuje, tylko kasuje i pisze od nowa.
DROP POLICY IF EXISTS "Ogloszenie kasuje zarzadzajacy" ON turniej_ogloszenia;
CREATE POLICY "Ogloszenie kasuje zarzadzajacy" ON turniej_ogloszenia FOR DELETE
  USING (czy_zarzadza_turniejem(turniej_id));

-- Powiadomienie do każdego zawodnika z kontem w PRZYJĘTEJ drużynie, poza
-- autorem. `turniej_zawodnicy` (nie `turniej_druzyny.kapitan_id`) celowo —
-- ekipa turniejowa ma zwykle więcej niż jedno konto, a ogłoszenie ma trafić
-- do wszystkich, tak jak wpis na tablicy grupy (`093`) trafia do każdego
-- `group_members`, nie tylko do założyciela.
CREATE OR REPLACE FUNCTION powiadom_o_ogloszeniu_w_turnieju()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nazwa text;
BEGIN
  SELECT nazwa INTO v_nazwa FROM turnieje WHERE id = NEW.turniej_id;

  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  SELECT DISTINCT z.user_id,
         'turniej_ogloszenie',
         'Ogłoszenie w turnieju ' || coalesce(v_nazwa, ''),
         left(NEW.tresc, 140),
         NEW.turniej_id
    FROM turniej_zawodnicy z
    JOIN turniej_druzyny d ON d.id = z.druzyna_id
   WHERE z.turniej_id = NEW.turniej_id
     AND d.status = 'przyjeta'
     AND z.user_id IS NOT NULL
     AND z.user_id <> NEW.autor_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ogloszenie_turnieju ON turniej_ogloszenia;
CREATE TRIGGER trg_ogloszenie_turnieju AFTER INSERT ON turniej_ogloszenia
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_ogloszeniu_w_turnieju();


-- ── 2. BLIK organizatora ─────────────────────────────────────────────────────
-- Jeden wiersz na turniej (PK = FK), tak jak `event_blik`: PostgREST widzi
-- relację jeden-do-jeden i `select('*, turniej_blik(blik_telefon)')` oddaje
-- obiekt albo `null`, bez numeru dla tych, których nie przepuści polityka.

CREATE TABLE IF NOT EXISTS turniej_blik (
  turniej_id   uuid PRIMARY KEY REFERENCES turnieje ON DELETE CASCADE,
  blik_telefon text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turniej_blik ENABLE ROW LEVEL SECURITY;

-- `anon` dostaje SELECT z tego samego powodu co w `120`: strona turnieju
-- dociąga numer osadzeniem i renderuje się także niezalogowanemu, mimo że
-- nigdy nie zobaczy wiersza — polityka niżej odsiewa treść, nie sam dostęp.
GRANT SELECT ON turniej_blik TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON turniej_blik TO authenticated;

-- Widzi: zarządzający turniejem (ustawił numer) i kapitan KAŻDEJ drużyny w
-- turnieju — nie tylko przyjętej, bo drużyna na liście rezerwowej też może
-- zapłacić wpisowe z góry, żeby nie stracić miejsca, gdy ktoś się wycofa.
DROP POLICY IF EXISTS "Blik turnieju czyta zarzadzajacy i kapitanowie" ON turniej_blik;
CREATE POLICY "Blik turnieju czyta zarzadzajacy i kapitanowie" ON turniej_blik FOR SELECT
  USING (
    czy_zarzadza_turniejem(turniej_id)
    OR EXISTS (
      SELECT 1 FROM turniej_druzyny d
       WHERE d.turniej_id = turniej_blik.turniej_id AND d.kapitan_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Blik turnieju pisze zarzadzajacy" ON turniej_blik;
CREATE POLICY "Blik turnieju pisze zarzadzajacy" ON turniej_blik FOR ALL
  USING      (czy_zarzadza_turniejem(turniej_id))
  WITH CHECK (czy_zarzadza_turniejem(turniej_id));


-- ── 3. Zamień drużynę w ekipę ────────────────────────────────────────────────
-- SECURITY DEFINER, bo funkcja pisze do `groups`/`group_members` w imieniu
-- kapitana, który nie musi mieć żadnego uprawnienia na tych tabelach poza
-- byciem sobą. Kapitanat sprawdzany wprost — to jest JEGO przycisk, nie
-- zarządzającego turniejem (inaczej organizator mógłby zakładać grupy
-- z cudzych drużyn bez pytania kapitana o zgodę).
CREATE OR REPLACE FUNCTION zamien_druzyne_w_ekipe(p_druzyna uuid, p_nazwa text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna turniej_druzyny%ROWTYPE;
  v_turniej turnieje%ROWTYPE;
  v_grupa   uuid;
BEGIN
  SELECT * INTO v_druzyna FROM turniej_druzyny WHERE id = p_druzyna;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono drużyny.';
  END IF;
  IF v_druzyna.kapitan_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Tylko kapitan może zamienić drużynę w ekipę.';
  END IF;

  SELECT * INTO v_turniej FROM turnieje WHERE id = v_druzyna.turniej_id;

  INSERT INTO groups (name, sport, city, created_by)
  VALUES (
    coalesce(NULLIF(trim(coalesce(p_nazwa, '')), ''), v_druzyna.nazwa),
    v_turniej.sport,
    v_turniej.miasto,
    auth.uid()
  )
  RETURNING id INTO v_grupa;

  -- Kapitan wszedł jako założyciel przez trigger `add_group_creator_as_member`
  -- (migracja `044`). Reszta składu z kontem dołącza wprost — `group_members`
  -- nie ma polityki INSERT dla zwykłego użytkownika od migracji `094`, więc
  -- to jest jedyna droga, którą reszta drużyny w ogóle może wejść tu bez
  -- osobnego klikania kodu zaproszenia.
  INSERT INTO group_members (group_id, user_id, role)
  SELECT v_grupa, z.user_id, 'member'
    FROM turniej_zawodnicy z
   WHERE z.druzyna_id = p_druzyna
     AND z.user_id IS NOT NULL
     AND z.user_id <> auth.uid()
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_grupa;
END $$;

GRANT EXECUTE ON FUNCTION zamien_druzyne_w_ekipe(uuid, text) TO authenticated;


-- ── 4. Powiadomienia — nowy typ ─────────────────────────────────────────────
-- `turniej_zgloszenie_druzyny`, `turniej_druzyna_przyjeta`,
-- `turniej_druzyna_odrzucona`, `turniej_kapitan_przejal` (145),
-- `turniej_terminarz_gotowy`, `turniej_zmiana_terminu` (146) już istnieją —
-- `turniej_ogloszenie` dokłada się do tej samej rodziny. Bez osobnego wpisu
-- w bazie (typ to zwykły `text` w `notifications`) — trzy miejsca do
-- dopisania po stronie frontu są w `lib/ikonyPowiadomien.ts` i
-- `lib/ustawieniaPowiadomien.ts`, pilnuje ich `typyPowiadomien.test.ts`.
