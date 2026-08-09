-- 073_serie_wydarzen_cyklicznych.sql
--
-- Wydarzenia cykliczne przestają być zbiorem niepowiązanych kopii i stają się
-- SERIĄ: kolejne terminy tworzą się same, dziedziczą pełne ustawienia i dają
-- się edytować zbiorczo.
--
-- 1. BRAKUJĄCA KOLUMNA, KTÓREJ KOD JUŻ SZUKAŁ. `getNextEventsForRecurring()`
--    (`lib/recurring.ts`) odpytuje `events.recurring_event_id` od dawna, ale
--    kolumna nigdy nie powstała. Zapytanie połyka błąd (`if (error) return {}`),
--    więc `/cykliczne` pokazywało „Brak terminu" ZAWSZE, niezależnie od stanu
--    faktycznego. To nie był brak funkcji, tylko cicha awaria.
--
-- 2. KOLEJNY TERMIN TRZEBA BYŁO KLIKAĆ RĘCZNIE. Szablon istniał, ale nikt nie
--    tworzył z niego wydarzeń — organizator musiał wejść na `/cykliczne/[id]`
--    i nacisnąć „Utwórz nową edycję". Gierka co tydzień oznaczała klikanie co
--    tydzień, czyli dokładnie tę pracę, którą Bojo miało zdjąć z głowy.
--
-- 3. SPAWN GUBIŁ USTAWIENIA. Szablon `recurring_events` niesie tylko sport,
--    miejsce, dzień, godzinę, limit i widoczność. Reszta szła z domyślnych:
--    cena 0, brak metod płatności, bramkarze wyłączeni, brak akceptacji zapisów.
--    PŁATNA GIERKA ODRADZAŁA SIĘ JAKO DARMOWA — realny błąd, nie brak funkcji.
--
-- PODZIAŁ RÓL, żeby nie duplikować schematu `events` w `recurring_events`:
--   szablon             = reguła powtarzania (dzień, godzina, miejsce, limit,
--                         widoczność, wyprzedzenie, aktywność),
--   ostatni termin serii = żywy wzorzec reszty ustawień (cena, płatności,
--                         bramkarze, grupa, akceptacja, czas na decyzję…).
-- Dzięki temu „popraw ten i przyszłe" działa bez osobnego magazynu ustawień:
-- poprawiasz jeden termin, kolejny się tym żywi.
--
-- WYPRZEDZENIE reużywa `notify_days_before` zamiast nowej kolumny — utworzenie
-- terminu JEST momentem powiadomienia (wyzwalacz na końcu tego pliku), więc dwa
-- osobne ustawienia byłyby tym samym pytaniem zadanym dwa razy.

-- ---------------------------------------------------------------------------
-- 1. Tożsamość serii
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurring_event_id UUID
    REFERENCES recurring_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_recurring ON events (recurring_event_id);

-- SET NULL, nie CASCADE: skasowanie szablonu nie może zabrać ze sobą rozegranych
-- meczów razem ze składami, wynikami i rozliczeniami. Mecz traci przynależność
-- do serii, ale zostaje.

-- Twarda gwarancja przeciw dublom. Funkcja niżej i tak sprawdza istnienie
-- terminu, ale przy cronie co godzinę dwa przebiegi mogą się nałożyć —
-- wtedy sprawdzenie w jednej transakcji nie widzi wstawki z drugiej.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_seria_termin
  ON events (recurring_event_id, event_date)
  WHERE recurring_event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2a. Jeden termin serii — wspólne źródło prawdy
-- ---------------------------------------------------------------------------
-- Tę samą funkcję wołają OBA wejścia: cron (niżej) i przycisk „Utwórz nową
-- edycję" na `/cykliczne/[id]` (przez `supabase.rpc`). Dzięki temu termin
-- utworzony ręcznie i automatycznie jest identyczny — gdyby logika kopiowania
-- ustawień żyła osobno w TypeScripcie, obie ścieżki rozjechałyby się przy
-- pierwszej zmianie.
--
-- SECURITY DEFINER, bo RLS na `events` przepuszcza INSERT wyłącznie jako
-- `auth.uid() = organizer_id` — cron nie działa w niczyim imieniu. Stąd jawna
-- kontrola uprawnień w środku: wywołanie z przeglądarki (auth.uid() nie-NULL)
-- musi pochodzić od organizatora serii.
--
-- Zwraca id nowego wydarzenia albo NULL, gdy termin już istniał.
CREATE OR REPLACE FUNCTION utworz_termin_serii(p_szablon_id UUID, p_data DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_szablon  recurring_events%ROWTYPE;
  v_wzor     events%ROWTYPE;
  v_wzor_id  UUID;
  v_ma_wzor  BOOLEAN;
  v_nowy_id  UUID;
  v_bramkarz BOOLEAN;
  v_gra      BOOLEAN;
BEGIN
  SELECT * INTO v_szablon FROM recurring_events WHERE id = p_szablon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiej serii: %', p_szablon_id;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_szablon.organizer_id THEN
    RAISE EXCEPTION 'Tylko organizator może tworzyć terminy tej serii';
  END IF;

  -- Termin już istnieje (ręcznie albo z poprzedniego przebiegu crona).
  IF EXISTS (
    SELECT 1 FROM events
     WHERE recurring_event_id = p_szablon_id AND event_date = p_data
  ) THEN
    RETURN NULL;
  END IF;

  -- Ostatni termin serii jako wzorzec ustawień.
  SELECT * INTO v_wzor
    FROM events
   WHERE recurring_event_id = p_szablon_id
   ORDER BY event_date DESC
   LIMIT 1;
  v_ma_wzor := FOUND;
  v_wzor_id := v_wzor.id;  -- id POPRZEDNIEGO terminu; niżej v_wzor.id nadpisujemy

  IF v_ma_wzor THEN
    -- Kopia całego wiersza: każda kolumna `events` — także te dodane przyszłymi
    -- migracjami — jedzie automatycznie. Niżej zerujemy tylko to, co jest
    -- własnością POJEDYNCZEGO terminu, nie serii.
    v_wzor.id                 := gen_random_uuid();
    v_wzor.event_date         := p_data;
    v_wzor.created_at         := now();
    v_wzor.status             := 'active';
    v_wzor.join_code          := generate_join_code();  -- kolumna UNIQUE
    v_wzor.teams_published    := false;                 -- składy są per termin
    v_wzor.recurring_event_id := p_szablon_id;

    -- Pola, których właścicielem jest szablon (reguła powtarzania). Nadpisują
    -- wzorzec, żeby edycja szablonu realnie wpływała na kolejne terminy.
    v_wzor.sport        := v_szablon.sport;
    v_wzor.field_id     := v_szablon.field_id;
    v_wzor.field_name   := v_szablon.field_name;
    v_wzor.lat          := v_szablon.lat;
    v_wzor.lng          := v_szablon.lng;
    v_wzor.title        := v_szablon.title;
    v_wzor.description  := v_szablon.description;
    v_wzor.event_time   := v_szablon.event_time;
    v_wzor.end_time     := v_szablon.end_time;
    v_wzor.max_players  := v_szablon.max_players;
    v_wzor.visibility   := v_szablon.visibility;

    INSERT INTO events VALUES (v_wzor.*) RETURNING id INTO v_nowy_id;
  ELSE
    -- Pierwszy termin serii — nie ma z czego dziedziczyć, biorą domyślne bazy.
    INSERT INTO events (
      organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
      title, description, event_date, event_time, end_time, max_players,
      visibility, recurring_event_id
    ) VALUES (
      v_szablon.organizer_id, v_szablon.organizer_name, v_szablon.sport,
      v_szablon.field_id, v_szablon.field_name, v_szablon.lat, v_szablon.lng,
      v_szablon.title, v_szablon.description, p_data, v_szablon.event_time,
      v_szablon.end_time, v_szablon.max_players, v_szablon.visibility,
      p_szablon_id
    ) RETURNING id INTO v_nowy_id;
  END IF;

  -- Czy organizator gra? Idzie za poprzednim terminem — organizator, który
  -- tylko prowadzi gierkę i sam nie wchodzi na boisko, nie ma powodu co
  -- tydzień wypisywać się ze składu. Bez wzorca: gra (domyślne `createEvent`).
  IF v_ma_wzor THEN
    SELECT coalesce(p.is_goalkeeper, false)
      INTO v_bramkarz
      FROM event_participants p
     WHERE p.event_id = v_wzor_id
       AND p.user_id = v_szablon.organizer_id
       AND p.is_guest = false
     LIMIT 1;
    v_gra := FOUND;
  ELSE
    v_gra := true;
    v_bramkarz := false;
  END IF;

  IF v_gra THEN
    INSERT INTO event_participants (event_id, user_id, name, is_guest, is_goalkeeper)
    VALUES (v_nowy_id, v_szablon.organizer_id, v_szablon.organizer_name,
            false, coalesce(v_bramkarz, false));
  END IF;

  RETURN v_nowy_id;
END;
$$;

-- Przeglądarka woła to przez `supabase.rpc('utworz_termin_serii', …)`;
-- kontrola „tylko organizator" siedzi w środku funkcji.
GRANT EXECUTE ON FUNCTION utworz_termin_serii(UUID, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Które terminy są już należne — pętla dla crona
-- ---------------------------------------------------------------------------
-- Czas liczony w strefie 'Europe/Warsaw', nie w UTC bazy: przy meczu o 20:00
-- i bazie w UTC różnica 1–2 h potrafi przesunąć „dzisiaj" na sąsiedni dzień
-- i wyliczyć zły termin.
CREATE OR REPLACE FUNCTION utworz_nalezne_terminy_serii()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teraz     TIMESTAMP := now() AT TIME ZONE 'Europe/Warsaw';
  v_dzis      DATE      := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_szablon   RECORD;
  v_termin    DATE;
  v_odstep    INT;
  v_utworzone INTEGER := 0;
BEGIN
  FOR v_szablon IN SELECT * FROM recurring_events WHERE is_active LOOP
    -- Najbliższe wystąpienie dnia tygodnia (1=Pon…7=Niedz, ISO).
    v_odstep := (v_szablon.day_of_week - EXTRACT(ISODOW FROM v_dzis)::INT + 7) % 7;
    v_termin := v_dzis + v_odstep;

    -- Dzisiaj, ale godzina już minęła → termin był, następny za tydzień.
    -- Bez tego cron tworzyłby mecz kilka godzin po jego zakończeniu.
    IF v_odstep = 0 AND v_szablon.event_time <= v_teraz::time THEN
      v_termin := v_termin + 7;
    END IF;

    -- Jeszcze za wcześnie, żeby otwierać zapisy.
    CONTINUE WHEN (v_termin - v_dzis) > v_szablon.notify_days_before;

    IF utworz_termin_serii(v_szablon.id, v_termin) IS NOT NULL THEN
      v_utworzone := v_utworzone + 1;
    END IF;
  END LOOP;

  RETURN v_utworzone;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Harmonogram — co godzinę
-- ---------------------------------------------------------------------------
-- Owinięte w DO, bo `pg_cron` bywa niewłączony, a wtedy samo `cron.schedule`
-- wywróciłoby CAŁĄ migrację — łącznie z kolumną i funkcją wyżej, które są
-- wartościowe niezależnie od harmonogramu. Bez crona funkcja działa z ręki:
--   SELECT utworz_nalezne_terminy_serii();
-- Włączenie: Supabase → Database → Extensions → pg_cron, potem ponownie ten blok.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bojo-terminy-serii';
    -- Minuta 7, nie 0: pełna godzina to najbardziej zatłoczony moment na
    -- współdzielonej instancji.
    PERFORM cron.schedule(
      'bojo-terminy-serii', '7 * * * *',
      $cron$SELECT utworz_nalezne_terminy_serii()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron niewłączony — terminy serii nie będą powstawać automatycznie. Włącz rozszerzenie i uruchom ten blok ponownie.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Powiadomienie o nowym terminie serii
-- ---------------------------------------------------------------------------
-- Termin, który powstaje po cichu, nie rozwiązuje niczego — gracze i tak muszą
-- wejść i sprawdzić, czyli dokładnie to, co miało zniknąć. Dostają go uczestnicy
-- POPRZEDNIEGO terminu tej serii: to oni grają w tę gierkę.
--
-- Bez organizatora (sam ją prowadzi), bez gości bez konta (`user_id IS NULL`)
-- i bez członków grupy meczu — tym `powiadom_o_nowym_meczu_w_grupie` (migracja
-- `072`) wysyła już własne powiadomienie o tym samym meczu.
CREATE OR REPLACE FUNCTION powiadom_o_nowym_terminie_serii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul     TEXT;
  v_poprzedni UUID;
BEGIN
  IF NEW.recurring_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_poprzedni
    FROM events
   WHERE recurring_event_id = NEW.recurring_event_id
     AND event_date < NEW.event_date
   ORDER BY event_date DESC
   LIMIT 1;

  -- Pierwszy termin serii — nie ma jeszcze komu powiedzieć.
  IF v_poprzedni IS NULL THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'nowy_termin_serii',
         'Nowy termin stałej gierki',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI') || '. Zapisy otwarte.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = v_poprzedni
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id
     AND (
       NEW.group_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM group_members gm
          WHERE gm.group_id = NEW.group_id AND gm.user_id = p.user_id
       )
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_terminie_serii ON events;
CREATE TRIGGER trg_powiadom_o_nowym_terminie_serii
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_nowym_terminie_serii();
