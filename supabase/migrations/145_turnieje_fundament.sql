-- ============================================================================
-- 145_turnieje_fundament.sql — moduł turniejowy, część 1: turniej i drużyny
-- ----------------------------------------------------------------------------
-- PO CO. Organizator turnieju amatorskiego prowadzi dziś zgłoszenia w grupie
-- na Facebooku, drużyny w arkuszu, a terminarz na kartce. Ta migracja stawia
-- fundament zamiennika: turniej z parametrami, zgłoszenia drużyn, składy
-- i uprawnienia prowadzących.
--
-- DLACZEGO NOWE TABELE, A NIE `tournament_*` Z `029`. Tamten model to inny
-- produkt: turniej zakłada wyłącznie admin, edycja jest jedna, drużyny umawiają
-- mecze same przez tygodnie, a wynik zgłasza kapitan i potwierdza rywal. Tu
-- turniej zakłada każdy organizator, terminarz powstaje z góry, a wynik wpisuje
-- prowadzący przy boisku. Polskie nazwy pozwalają obu modelom istnieć obok
-- siebie przez czas przenosin; stare tabele kasuje migracja `149`.
--
-- ŚCIANA LOGOWANIA. Skład drużyny i zdarzenia meczu czyta WYŁĄCZNIE zalogowany.
-- To jest decyzja produktowa (konto jako cena za statystyki) i RODO naraz —
-- egzekwowana w RLS, bo klucz `anon` siedzi jawnie w paczce JS.
-- ============================================================================

-- ── 1. Turniej ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turnieje (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizator_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nazwa              text NOT NULL CHECK (char_length(nazwa) BETWEEN 3 AND 80),
  sport              text NOT NULL,
  format             text NOT NULL DEFAULT 'grupy_puchar'
                       CHECK (format IN ('grupy_puchar','puchar','liga')),
  status             text NOT NULL DEFAULT 'szkic'
                       CHECK (status IN ('szkic','zapisy','zamkniete_zapisy',
                                         'trwa','zakonczony','odwolany')),
  widocznosc         text NOT NULL DEFAULT 'publiczny'
                       CHECK (widocznosc IN ('publiczny','na_link')),

  field_id           uuid REFERENCES fields(id) ON DELETE SET NULL,
  miejsce_nazwa      text,
  miejsce_adres      text,
  lat                double precision,
  lng                double precision,
  miasto             text,

  data_startu        date NOT NULL,
  data_konca         date,
  godzina_startu     time NOT NULL DEFAULT '10:00',
  zapisy_do          timestamptz,

  max_druzyn         int NOT NULL DEFAULT 8  CHECK (max_druzyn BETWEEN 2 AND 64),
  min_zawodnikow     int NOT NULL DEFAULT 5  CHECK (min_zawodnikow BETWEEN 1 AND 30),
  max_zawodnikow     int NOT NULL DEFAULT 12 CHECK (max_zawodnikow BETWEEN 1 AND 40),
  graczy_w_polu      int CHECK (graczy_w_polu BETWEEN 1 AND 15),

  liczba_grup        int CHECK (liczba_grup BETWEEN 1 AND 16),
  awansuje_z_grupy   int NOT NULL DEFAULT 2 CHECK (awansuje_z_grupy BETWEEN 1 AND 8),
  mecz_o_3_miejsce   boolean NOT NULL DEFAULT false,
  czas_meczu_min     int NOT NULL DEFAULT 15 CHECK (czas_meczu_min BETWEEN 5 AND 120),
  przerwa_min        int NOT NULL DEFAULT 5  CHECK (przerwa_min BETWEEN 0 AND 60),
  punkty_za_wygrana  int NOT NULL DEFAULT 3  CHECK (punkty_za_wygrana BETWEEN 1 AND 5),
  punkty_za_remis    int NOT NULL DEFAULT 1  CHECK (punkty_za_remis BETWEEN 0 AND 3),
  karne_przy_remisie boolean NOT NULL DEFAULT true,

  wpisowe_grosz      int NOT NULL DEFAULT 0 CHECK (wpisowe_grosz >= 0),
  regulamin          text,
  opis               text,
  okladka_url        text,
  wymaga_akceptacji  boolean NOT NULL DEFAULT true,
  mvp_zawodnik_id    uuid,                      -- FK domknięty w punkcie 4

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT turnieje_sklad_sensowny CHECK (min_zawodnikow <= max_zawodnikow),
  CONSTRAINT turnieje_koniec_po_starcie
    CHECK (data_konca IS NULL OR data_konca >= data_startu)
);

CREATE INDEX IF NOT EXISTS idx_turnieje_organizator ON turnieje(organizator_id);
CREATE INDEX IF NOT EXISTS idx_turnieje_lista       ON turnieje(status, data_startu);

DROP TRIGGER IF EXISTS trg_turnieje_updated ON turnieje;
CREATE TRIGGER trg_turnieje_updated BEFORE UPDATE ON turnieje
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE turnieje IS
  'Turniej amatorski prowadzony w Bojo (migracja 145). Nie mylić z tabelą '
  '`tournaments` (029) — tamta to nieużywany BOJO Community Cup, kasowany w 149.';


-- ── 2. Uprawnienia: współorganizatorzy i prowadzący ─────────────────────────
-- Wzorem `event_delegates` (089) i uprawnień w grupie (092): trzy niezależne
-- przełączniki, `moze_edytowac` jest nadzbiorem pozostałych.

CREATE TABLE IF NOT EXISTS turniej_osoby (
  turniej_id               uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  moze_edytowac            boolean NOT NULL DEFAULT false,
  moze_prowadzic           boolean NOT NULL DEFAULT true,
  moze_zarzadzac_druzynami boolean NOT NULL DEFAULT false,
  dodany_przez             uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (turniej_id, user_id)
);


-- ── 3. Drużyny ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_druzyny (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id         uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  nazwa              text NOT NULL CHECK (char_length(nazwa) BETWEEN 2 AND 40),
  kapitan_id         uuid REFERENCES auth.users ON DELETE SET NULL,
  kod_dolaczenia     text NOT NULL UNIQUE DEFAULT generate_join_code(),
  status             text NOT NULL DEFAULT 'zgloszona'
                       CHECK (status IN ('zgloszona','przyjeta','rezerwa',
                                         'odrzucona','wycofana')),
  dodana_recznie     boolean NOT NULL DEFAULT false,
  grupa_id           uuid,                       -- FK dokłada migracja 146
  rozstawienie       int CHECK (rozstawienie BETWEEN 1 AND 64),
  pozycja_recznie    int CHECK (pozycja_recznie BETWEEN 1 AND 64),
  kontakt_imie       text,
  kontakt_telefon    text,
  kontakt_email      text,
  wpisowe_oplacone_at        timestamptz,
  regulamin_zaakceptowany_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_druzyna_nazwa_w_turnieju
  ON turniej_druzyny(turniej_id, lower(nazwa));
CREATE INDEX IF NOT EXISTS idx_druzyny_turniej ON turniej_druzyny(turniej_id);
CREATE INDEX IF NOT EXISTS idx_druzyny_kapitan ON turniej_druzyny(kapitan_id);

DROP TRIGGER IF EXISTS trg_druzyny_updated ON turniej_druzyny;
CREATE TRIGGER trg_druzyny_updated BEFORE UPDATE ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RODO: numer i mail kapitana NIE są publiczne. To ta sama decyzja co w `030`
-- dla starego modułu: podanie numeru organizatorowi nie jest zgodą na
-- pokazywanie go w internecie. INSERT/UPDATE zostają nietknięte — kapitan
-- dalej je zapisuje, tylko nikt ich nie odczyta przez API.
--
-- UPRAWNIENIA KOLUMNOWE SĄ DODATKOWE DO TABELOWYCH — `REVOKE SELECT (kolumna)`
-- SAMO W SOBIE NIC NIE ROBI, dopóki rola ma SELECT na całej tabeli (domyślne
-- uprawnienia z `ALTER DEFAULT PRIVILEGES` dają dokładnie to). Ta sama pułapka
-- i to samo rozwiązanie co w migracji `127`: najpierw zdejmujemy SELECT
-- z CAŁEJ tabeli, potem oddajemy jawną listę kolumn — wszystkie oprócz
-- `kontakt_telefon`/`kontakt_email`.
--
-- OD TEJ CHWILI `turniej_druzyny` MA GRANTY KOLUMNOWE. Nowa kolumna dostanie
-- INSERT/UPDATE z poziomu tabeli, ale NIE dostanie SELECT-a — dopisz ją do
-- listy niżej (albo, jeśli ma być prywatna jak te dwie, zostaw poza listą).
REVOKE SELECT ON turniej_druzyny FROM anon, authenticated;

GRANT SELECT (
  id,
  turniej_id,
  nazwa,
  kapitan_id,
  kod_dolaczenia,
  status,
  dodana_recznie,
  grupa_id,
  rozstawienie,
  pozycja_recznie,
  kontakt_imie,
  wpisowe_oplacone_at,
  regulamin_zaakceptowany_at,
  created_at,
  updated_at
) ON turniej_druzyny TO anon, authenticated;


-- ── 4. Skład ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_zawodnicy (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  druzyna_id  uuid NOT NULL REFERENCES turniej_druzyny ON DELETE CASCADE,
  turniej_id  uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  imie        text NOT NULL CHECK (char_length(imie) BETWEEN 1 AND 60),
  numer       int CHECK (numer BETWEEN 0 AND 99),
  kapitan     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Jedna osoba gra w JEDNEJ drużynie danego turnieju. Bez tego indeksu ktoś
-- dopisuje się do dwóch ekip i klasyfikacja strzelców przestaje mieć sens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_zawodnik_raz_w_turnieju
  ON turniej_zawodnicy(turniej_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_numer_w_druzynie
  ON turniej_zawodnicy(druzyna_id, numer) WHERE numer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zawodnicy_druzyna ON turniej_zawodnicy(druzyna_id);

-- `turniej_id` jest denormalizacją (wynika z drużyny) i właśnie dlatego NIE
-- ufamy klientowi, że poda ją poprawnie — wyzwalacz ją nadpisuje. Kolumna
-- istnieje po to, żeby indeks unikalny wyżej i polityki RLS nie musiały
-- za każdym razem dołączać `turniej_druzyny`.
CREATE OR REPLACE FUNCTION ustaw_turniej_zawodnika()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT d.turniej_id INTO NEW.turniej_id
  FROM turniej_druzyny d WHERE d.id = NEW.druzyna_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zawodnik_turniej ON turniej_zawodnicy;
CREATE TRIGGER trg_zawodnik_turniej BEFORE INSERT OR UPDATE OF druzyna_id
  ON turniej_zawodnicy FOR EACH ROW EXECUTE FUNCTION ustaw_turniej_zawodnika();

-- Domknięcie FK z punktu 1 (MVP turnieju wskazuje na zawodnika).
ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS fk_turniej_mvp;
ALTER TABLE turnieje ADD CONSTRAINT fk_turniej_mvp
  FOREIGN KEY (mvp_zawodnik_id) REFERENCES turniej_zawodnicy(id) ON DELETE SET NULL;


-- ── 5. Funkcje pomocnicze do polityk ────────────────────────────────────────
-- SECURITY DEFINER, bo polityka na jednej tabeli musi zajrzeć do drugiej,
-- na której pytający może nie mieć prawa odczytu. Wzorem `can_edit_event()`
-- (089) i `czy_czlonek_grupy()` (092). Nie wołane z przeglądarki.

CREATE OR REPLACE FUNCTION czy_organizator_turnieju(p_turniej uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM turnieje t
                 WHERE t.id = p_turniej AND t.organizator_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p
                 WHERE p.id = auth.uid() AND p.is_admin)
$$;

CREATE OR REPLACE FUNCTION czy_zarzadza_turniejem(p_turniej uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT czy_organizator_turnieju(p_turniej)
      OR EXISTS (SELECT 1 FROM turniej_osoby o
                 WHERE o.turniej_id = p_turniej AND o.user_id = auth.uid()
                   AND o.moze_edytowac)
$$;

CREATE OR REPLACE FUNCTION czy_zarzadza_druzynami(p_turniej uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT czy_zarzadza_turniejem(p_turniej)
      OR EXISTS (SELECT 1 FROM turniej_osoby o
                 WHERE o.turniej_id = p_turniej AND o.user_id = auth.uid()
                   AND o.moze_zarzadzac_druzynami)
$$;

CREATE OR REPLACE FUNCTION czy_kapitan_druzyny(p_druzyna uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM turniej_druzyny d
    WHERE d.id = p_druzyna
      AND (d.kapitan_id = auth.uid() OR czy_zarzadza_druzynami(d.turniej_id))
  )
$$;

GRANT EXECUTE ON FUNCTION czy_organizator_turnieju(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_zarzadza_turniejem(uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_zarzadza_druzynami(uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_kapitan_druzyny(uuid)      TO anon, authenticated;


-- ── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE turnieje          ENABLE ROW LEVEL SECURITY;
ALTER TABLE turniej_osoby     ENABLE ROW LEVEL SECURITY;
ALTER TABLE turniej_druzyny   ENABLE ROW LEVEL SECURITY;
ALTER TABLE turniej_zawodnicy ENABLE ROW LEVEL SECURITY;

-- Turniej czyta każdy. `widocznosc = 'na_link'` znaczy „nie ma go na liście",
-- NIE „wiersza nie da się odczytać" — dokładnie ta sama, świadoma słabość co
-- przy `events` (polityka „Events readable by all"). Nie udajemy kontroli
-- dostępu, której tu nie ma; listy filtrują po `widocznosc` w zapytaniu.
DROP POLICY IF EXISTS "Turniej czyta kazdy" ON turnieje;
CREATE POLICY "Turniej czyta kazdy" ON turnieje FOR SELECT USING (true);

DROP POLICY IF EXISTS "Turniej zaklada zalogowany" ON turnieje;
CREATE POLICY "Turniej zaklada zalogowany" ON turnieje FOR INSERT
  WITH CHECK (auth.uid() = organizator_id);

DROP POLICY IF EXISTS "Turniej edytuje zarzadzajacy" ON turnieje;
CREATE POLICY "Turniej edytuje zarzadzajacy" ON turnieje FOR UPDATE
  USING      (czy_zarzadza_turniejem(id))
  WITH CHECK (czy_zarzadza_turniejem(id));

DROP POLICY IF EXISTS "Turniej kasuje organizator" ON turnieje;
CREATE POLICY "Turniej kasuje organizator" ON turnieje FOR DELETE
  USING (czy_organizator_turnieju(id));

-- Uprawnienia widzi zalogowany (plakietka „prowadzący" przy nazwisku),
-- nadaje WYŁĄCZNIE organizator — nie współorganizator z `moze_edytowac`.
-- Inaczej powstaje niekontrolowany łańcuch przekazywania, dokładnie ten sam
-- problem, który zamknięto przy delegatach meczu i uprawnieniach w grupie.
DROP POLICY IF EXISTS "Osoby turnieju czyta zalogowany" ON turniej_osoby;
CREATE POLICY "Osoby turnieju czyta zalogowany" ON turniej_osoby FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Osoby turnieju nadaje organizator" ON turniej_osoby;
CREATE POLICY "Osoby turnieju nadaje organizator" ON turniej_osoby FOR ALL
  USING      (czy_organizator_turnieju(turniej_id))
  WITH CHECK (czy_organizator_turnieju(turniej_id));

-- Lista drużyn jest publiczna (same nazwy — kolumny kontaktowe odebrane grantem).
DROP POLICY IF EXISTS "Druzyny czyta kazdy" ON turniej_druzyny;
CREATE POLICY "Druzyny czyta kazdy" ON turniej_druzyny FOR SELECT USING (true);

-- Zgłosić drużynę można tylko do turnieju, który realnie przyjmuje zgłoszenia,
-- i tylko jako jej kapitan. Sprawdzenie stanu turnieju siedzi TU, a nie w UI:
-- inaczej zgłoszenie wchodzi po zamknięciu zapisów jednym zapytaniem curlem.
DROP POLICY IF EXISTS "Druzyne zglasza zalogowany" ON turniej_druzyny;
CREATE POLICY "Druzyne zglasza zalogowany" ON turniej_druzyny FOR INSERT
  WITH CHECK (
    (auth.uid() = kapitan_id AND EXISTS (
       SELECT 1 FROM turnieje t WHERE t.id = turniej_id AND t.status = 'zapisy'))
    OR czy_zarzadza_druzynami(turniej_id)
  );

DROP POLICY IF EXISTS "Druzyne edytuje kapitan" ON turniej_druzyny;
CREATE POLICY "Druzyne edytuje kapitan" ON turniej_druzyny FOR UPDATE
  USING      (kapitan_id = auth.uid() OR czy_zarzadza_druzynami(turniej_id))
  WITH CHECK (kapitan_id = auth.uid() OR czy_zarzadza_druzynami(turniej_id));

DROP POLICY IF EXISTS "Druzyne kasuje organizator" ON turniej_druzyny;
CREATE POLICY "Druzyne kasuje organizator" ON turniej_druzyny FOR DELETE
  USING (czy_zarzadza_druzynami(turniej_id));

-- ŚCIANA LOGOWANIA. Skład to imiona kilkudziesięciu osób — nie wychodzi do
-- `anon`. To jest jednocześnie główny mechanizm zakładania kont w tym module.
DROP POLICY IF EXISTS "Sklad czyta zalogowany" ON turniej_zawodnicy;
CREATE POLICY "Sklad czyta zalogowany" ON turniej_zawodnicy FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Sklad prowadzi kapitan" ON turniej_zawodnicy;
CREATE POLICY "Sklad prowadzi kapitan" ON turniej_zawodnicy FOR ALL
  USING      (czy_kapitan_druzyny(druzyna_id))
  WITH CHECK (czy_kapitan_druzyny(druzyna_id));

-- Wyjątek do powyższego: zalogowany może przypisać SIEBIE do wolnego wiersza
-- składu — to jest „to ja" na `/t/[kod]`. Bez tej polityki jedyną drogą byłaby
-- funkcja SECURITY DEFINER, a wtedy kapitan nie mógłby przypisania cofnąć.
DROP POLICY IF EXISTS "Przypisz sie do wolnego wpisu" ON turniej_zawodnicy;
CREATE POLICY "Przypisz sie do wolnego wpisu" ON turniej_zawodnicy FOR UPDATE
  USING      (user_id IS NULL AND auth.uid() IS NOT NULL)
  WITH CHECK (user_id = auth.uid());


-- ── 6a. Ochrona przed samodzielnym przyjęciem drużyny ───────────────────────
-- Polityka „Druzyne edytuje kapitan" (punkt 6) pozwala kapitanowi zmienić
-- DOWOLNĄ kolumnę własnej drużyny — w tym `status`, czyli mógłby sam sobie
-- wpisać 'przyjeta'. Ta sama klasa błędu, którą migracja `132` naprawiała
-- w `event_participants`: „uczestnik zmienia własną DEKLARACJĘ, a nie swoje
-- MIEJSCE w składzie". Kapitan zmienia nazwę, kontakt i akceptację regulaminu
-- — status, przydział do grupy, rozstawienie i wpisowe zostają wyłącznie dla
-- zarządzających.

CREATE OR REPLACE FUNCTION pilnuj_wlasnej_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF czy_zarzadza_druzynami(NEW.turniej_id) THEN
    RETURN NEW;                      -- zarządzający robi, co chce
  END IF;

  -- Zapis robi sam kapitan — pola zastrzeżone dla organizatora wracają do
  -- poprzednich wartości, niezależnie od tego, co przyszło z klienta.
  NEW.status                     := OLD.status;
  NEW.grupa_id                   := OLD.grupa_id;
  NEW.rozstawienie               := OLD.rozstawienie;
  NEW.pozycja_recznie             := OLD.pozycja_recznie;
  NEW.wpisowe_oplacone_at        := OLD.wpisowe_oplacone_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pilnuj_wlasnej_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_pilnuj_wlasnej_druzyny BEFORE UPDATE ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION pilnuj_wlasnej_druzyny();


-- ── 7. Wejście do drużyny: kod ──────────────────────────────────────────────
-- Jedna droga na trzy sytuacje: przejęcie kapitanatu drużyny dodanej ręcznie,
-- przypisanie się do istniejącego wiersza składu („to ja") i dopisanie nowego.
-- Wszystkie trzy sprawdzają to samo: stan turnieju, limit składu, unikalność
-- osoby w turnieju. Rozbicie na trzy ścieżki po stronie klienta rozjechałoby
-- te reguły — tak jak rozjechała się reguła pojemności zdublowana w trzech
-- funkcjach w `lib/events.ts`.

CREATE OR REPLACE FUNCTION dolacz_do_druzyny_kodem(
  p_kod          text,
  p_jako_kapitan boolean DEFAULT false,
  p_zawodnik_id  uuid    DEFAULT NULL,
  p_imie         text    DEFAULT NULL
)
RETURNS TABLE (druzyna_id uuid, turniej_id uuid,
               zostal_kapitanem boolean, zawodnik_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna  turniej_druzyny%ROWTYPE;
  v_turniej  turnieje%ROWTYPE;
  v_ile      int;
  v_kapitan  boolean := false;
  v_zawodnik uuid;
  v_imie     text;
  v_inna     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby dołączyć do drużyny.';
  END IF;

  SELECT * INTO v_druzyna FROM turniej_druzyny
   WHERE upper(kod_dolaczenia) = upper(trim(p_kod));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono drużyny o tym kodzie.';
  END IF;

  SELECT * INTO v_turniej FROM turnieje WHERE id = v_druzyna.turniej_id;
  IF v_turniej.status IN ('zakonczony','odwolany') THEN
    RAISE EXCEPTION 'Ten turniej jest już zamknięty.';
  END IF;
  IF v_druzyna.status IN ('odrzucona','wycofana') THEN
    RAISE EXCEPTION 'Ta drużyna nie bierze udziału w turnieju.';
  END IF;

  -- 1. Kapitanat — pierwszy, kto otworzy link drużyny bez kapitana.
  --    Świadomy kompromis, ten sam co przy kodzie dołączenia do ekipy (094):
  --    kto ma link, ten wchodzi. Organizator dostaje powiadomienie i może
  --    kapitana zmienić, a kod — odświeżyć.
  IF p_jako_kapitan THEN
    IF v_druzyna.kapitan_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ta drużyna ma już kapitana.';
    END IF;
    UPDATE turniej_druzyny SET kapitan_id = auth.uid() WHERE id = v_druzyna.id;
    v_kapitan := true;

    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_turniej.organizator_id, 'turniej_kapitan_przejal',
            'Drużyna ma kapitana',
            v_druzyna.nazwa || ' — ktoś przejął zarządzanie drużyną.',
            v_turniej.id);
  END IF;

  -- 2. Ta sama osoba nie gra w dwóch drużynach tego samego turnieju.
  SELECT d.nazwa INTO v_inna
    FROM turniej_zawodnicy z JOIN turniej_druzyny d ON d.id = z.druzyna_id
   WHERE z.turniej_id = v_turniej.id AND z.user_id = auth.uid();
  IF v_inna IS NOT NULL THEN
    IF v_inna = v_druzyna.nazwa THEN
      SELECT id INTO v_zawodnik FROM turniej_zawodnicy
       WHERE druzyna_id = v_druzyna.id AND user_id = auth.uid();
      RETURN QUERY SELECT v_druzyna.id, v_turniej.id, v_kapitan, v_zawodnik;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Grasz już w tym turnieju w drużynie %.', v_inna;
  END IF;

  -- 3a. „To ja" — wolny wiersz składu wpisany wcześniej przez kapitana.
  IF p_zawodnik_id IS NOT NULL THEN
    UPDATE turniej_zawodnicy SET user_id = auth.uid()
     WHERE id = p_zawodnik_id AND druzyna_id = v_druzyna.id AND user_id IS NULL
     RETURNING id INTO v_zawodnik;
    IF v_zawodnik IS NULL THEN
      RAISE EXCEPTION 'To miejsce w składzie jest już zajęte.';
    END IF;
  ELSE
  -- 3b. Nowy wiersz — imię z parametru albo z profilu.
    SELECT count(*) INTO v_ile FROM turniej_zawodnicy WHERE druzyna_id = v_druzyna.id;
    IF v_ile >= v_turniej.max_zawodnikow THEN
      RAISE EXCEPTION 'Skład jest pełny (% osób).', v_turniej.max_zawodnikow;
    END IF;

    v_imie := NULLIF(trim(coalesce(p_imie, '')), '');
    IF v_imie IS NULL THEN
      SELECT coalesce(NULLIF(trim(p.display_name), ''), 'Zawodnik')
        INTO v_imie FROM profiles p WHERE p.id = auth.uid();
    END IF;

    INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie, kapitan)
    VALUES (v_druzyna.id, v_turniej.id, auth.uid(), v_imie, v_kapitan)
    RETURNING id INTO v_zawodnik;
  END IF;

  RETURN QUERY SELECT v_druzyna.id, v_turniej.id, v_kapitan, v_zawodnik;
END $$;

GRANT EXECUTE ON FUNCTION dolacz_do_druzyny_kodem(text, boolean, uuid, text)
  TO authenticated;


-- ── 8. Kontakty kapitanów — wyłącznie dla organizatora ──────────────────────
-- Kolumny są odebrane grantem (punkt 3), więc jedyną drogą do nich jest ta
-- funkcja, która twardo sprawdza uprawnienie w środku.

CREATE OR REPLACE FUNCTION turniej_kontakty(p_turniej uuid)
RETURNS TABLE (druzyna_id uuid, druzyna text, kapitan text,
               telefon text, email text, oplacone boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.nazwa, d.kontakt_imie, d.kontakt_telefon, d.kontakt_email,
         d.wpisowe_oplacone_at IS NOT NULL
    FROM turniej_druzyny d
   WHERE d.turniej_id = p_turniej
     AND czy_zarzadza_druzynami(p_turniej)
     AND d.status <> 'odrzucona'
   ORDER BY d.created_at
$$;

GRANT EXECUTE ON FUNCTION turniej_kontakty(uuid) TO authenticated;


-- ── 9. Powiadomienia ────────────────────────────────────────────────────────
-- Kolumna `turniej_id` jest dokładaniem do istniejącej tabeli — wiersze sprzed
-- tej migracji mają NULL i nic się dla nich nie zmienia. Bez niej powiadomienie
-- turniejowe nie ma dokąd prowadzić: `celPowiadomienia()` rozpoznaje cel po
-- `event_id` albo `group_id`, a wiersz bez żadnego z nich renderuje się jako
-- martwy, nieklikalny akapit.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS turniej_id uuid REFERENCES turnieje(id) ON DELETE CASCADE;

-- Zgłoszenie drużyny → organizator. Przy `wymaga_akceptacji = false` drużyna
-- wchodzi od razu jako przyjęta, więc treść jest inna: nie ma czego decydować.
--
-- CELOWO DWA PEŁNE INSERT-y, NIE JEDEN Z `CASE` NA KOLUMNIE `type`. Test
-- `typyPowiadomien.test.ts` wyciąga typ statyczną analizą — pierwszy literał
-- snake_case po nagłówku INSERT-u. `CASE WHEN … THEN 'literal'` ma SWÓJ
-- literał (wartość porównania) przed właściwym typem, więc wygrałby wyścig
-- i test złapałby fałszywy typ. Literał musi stać wprost po `user_id`.
CREATE OR REPLACE FUNCTION powiadom_o_zgloszeniu_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t turnieje%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM turnieje WHERE id = NEW.turniej_id;
  IF NEW.dodana_recznie OR v_t.organizator_id = auth.uid() THEN
    RETURN NEW;               -- organizator sam ją dopisał, nie budzimy go
  END IF;

  IF NEW.status = 'zgloszona' THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_t.organizator_id, 'turniej_zgloszenie_druzyny',
            'Nowe zgłoszenie do turnieju', NEW.nazwa || ' — ' || v_t.nazwa, v_t.id);
  ELSE
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_t.organizator_id, 'turniej_druzyna_przyjeta',
            'Nowa drużyna w turnieju', NEW.nazwa || ' — ' || v_t.nazwa, v_t.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zgloszenie_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_zgloszenie_druzyny AFTER INSERT ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_zgloszeniu_druzyny();

-- Decyzja organizatora → kapitan. Tylko przy realnej zmianie statusu.
CREATE OR REPLACE FUNCTION powiadom_o_decyzji_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t turnieje%ROWTYPE;
BEGIN
  IF NEW.status = OLD.status OR NEW.kapitan_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_t FROM turnieje WHERE id = NEW.turniej_id;

  IF NEW.status = 'przyjeta' THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (NEW.kapitan_id, 'turniej_druzyna_przyjeta',
            'Jesteście w turnieju',
            NEW.nazwa || ' gra w: ' || v_t.nazwa || '. Uzupełnij skład.', v_t.id);

  ELSIF NEW.status IN ('rezerwa','odrzucona') THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (NEW.kapitan_id, 'turniej_druzyna_odrzucona',
            CASE WHEN NEW.status = 'rezerwa'
                 THEN 'Jesteście na liście rezerwowej'
                 ELSE 'Zgłoszenie nieprzyjęte' END,
            NEW.nazwa || ' — ' || v_t.nazwa, v_t.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_decyzja_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_decyzja_druzyny AFTER UPDATE OF status ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_decyzji_druzyny();


-- ── 10. Push niesie turniej_id — ten sam wzorzec co migracja `136` ──────────
-- `wyslij_push_po_powiadomieniu()` (wyzwalacz z `102`, ostatnio przepisana
-- w `136`) buduje ładunek `net.http_post` z zamkniętej listy pól i NIE MA
-- wśród nich `turniej_id` — bez tego pola `adresPowiadomienia()` w funkcji
-- brzegowej `send-push` widzi tylko `event_id`/`group_id` (oba `NULL` dla
-- powiadomienia turniejowego) i push ląduje na `/`, mimo że dzwonek w apce
-- prowadzi poprawnie (`celPowiadomienia()` w `lib/notifications.ts`).
-- Ten sam błąd, który `136` naprawiało dla `claim_token`, tą samą metodą:
-- ciało skopiowane z ostatniej definicji, dołożona jedna linia.
CREATE OR REPLACE FUNCTION wyslij_push_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = NEW.user_id AND NEW.type = ANY(p.push_wylaczone)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT wartosc INTO v_url    FROM konfiguracja_push WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_push WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bojo-sekret', v_sekret
    ),
    body    := jsonb_build_object(
      'id',       NEW.id,
      'user_id',  NEW.user_id,
      'tytul',    NEW.title,
      'tresc',    NEW.body,
      'typ',      NEW.type,
      'event_id', NEW.event_id,
      'group_id', NEW.group_id,
      'claim_token', NEW.claim_token,
      -- NOWE (145).
      'turniej_id', NEW.turniej_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
