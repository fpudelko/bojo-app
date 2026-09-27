-- 165_powiadomienia_bez_dlugiego_myslnika.sql
--
-- Długi myślnik „—" w treści widocznej dla użytkownika jest zakazany od dawna
-- (AGENTS.md), ale zakaz obowiązywał wyłącznie `frontend/src` — `check:docs`
-- (sekcja 11) nie zaglądał do ciał funkcji w bazie. Efekt na produkcji, każdy
-- typ powiadomienia: „Czwartkowa gierka — 26.09, godz. 18:00.”. 25 funkcji
-- (RPC i wyzwalacze) miało literał „—” w ciele; ta migracja przepisuje
-- WSZYSTKIE (`CREATE OR REPLACE FUNCTION`, sygnatury i uprawnienia bez zmian —
-- `GRANT` przechodzi przez `CREATE OR REPLACE` automatycznie).
--
-- ZNAK DOBIERANY DO ZDANIA (AGENTS.md), nie mechanicznie jeden wzorzec
-- wszędzie. Najczęstszy wzorzec w tym repo, „Tytuł — DD.MM, godz. HH:MM.”,
-- zamienia się w „Tytuł, DD.MM, godz. HH:MM.” — przecinek, bo druga część
-- naturalnie kontynuuje pierwszą (to jedno zdanie o terminie, nie dwa fakty).
-- Gdzie druga część jest dopowiedzeniem (nazwa turnieju przy nazwie drużyny),
-- staje nawias; gdzie to dwa pełne zdania, dwukropek albo średnik.
--
-- CZEGO TA MIGRACJA NIE ROBI: nie rusza tytułów meczów wpisanych przez ludzi
-- (`events.title`, `groups.name`…) — część myślników w `notifications.body`
-- na produkcji pochodzi z nich („Poniedziałek — wymaga akceptacji”), a to
-- treść autora, nie szablon Bojo. Nie rusza `073` (funkcje serii, skasowane
-- w `164`) ani historycznego backfillu w `131` (`UPDATE … SET body = replace(…)`
-- naprawiał już WYSŁANE powiadomienia jednorazowo, po fakcie — dotykanie go
-- teraz niczego nie wysyła na nowo).
--
-- BEZPIECZNA dla skanera ryzyka: same `CREATE OR REPLACE FUNCTION`, zero
-- `DROP`/`ALTER COLUMN`. Sekcja 12 `check:docs` (dopisana w tym samym PR)
-- pilnuje, żeby migracje od `165` i `supabase/functions/**` nie dostały
-- nowego długiego myślnika w treści — starszym migracjom (historia, nie
-- treść) tego nie każe.

-- ---------------------------------------------------------------------------
-- 1. Zaproszenie na mecz (067)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zaproszeniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul     TEXT;
  v_data      DATE;
  v_godzina   TIME;
  v_kto       TEXT;
BEGIN
  SELECT coalesce(e.title, e.sport), e.event_date, e.event_time
    INTO v_tytul, v_data, v_godzina
    FROM events e
   WHERE e.id = NEW.event_id;

  SELECT p.display_name INTO v_kto FROM profiles p WHERE p.id = NEW.invited_by;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    NEW.user_id,
    'zaproszenie_na_mecz',
    coalesce(v_kto || ' zaprasza Cię na mecz', 'Zaproszenie na mecz'),
    coalesce(v_tytul, 'Mecz') || ', ' || to_char(v_data, 'DD.MM')
      || ', godz. ' || to_char(v_godzina, 'HH24:MI') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Odwołanie meczu (142, niesie notatkę organizatora)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_odwolaniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'mecz_odwolany',
         'Mecz odwołany',
         coalesce(v_tytul, 'Mecz') || ', ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI')
           || '. Organizator odwołał ten mecz.'
           || CASE WHEN btrim(coalesce(NEW.notatka_odwolania, '')) <> ''
                THEN E'\n\nWiadomość od organizatora: ' || btrim(NEW.notatka_odwolania)
                ELSE '' END,
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Przywrócenie odwołanego meczu (139)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_przywroceniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM 'cancelled' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.event_date < dzis_pl() THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT n.user_id,
         'mecz_przywrocony',
         'Mecz jednak się odbędzie',
         'Nowy termin: ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI')
           || ' (' || coalesce(v_tytul, 'Mecz') || '). Organizator cofnął odwołanie.',
         NEW.id
    FROM notifications n
   WHERE n.event_id = NEW.id
     AND n.type = 'mecz_odwolany'
     AND n.user_id <> NEW.organizer_id
     AND NOT EXISTS (
           SELECT 1 FROM notifications m
            WHERE m.user_id = n.user_id
              AND m.event_id = NEW.id
              AND m.type = 'mecz_przywrocony'
              AND (m.created_at AT TIME ZONE 'Europe/Warsaw')::date = dzis_pl());

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Zmiana terminu meczu (139)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zmianie_terminu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.event_time IS NOT DISTINCT FROM OLD.event_time THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' OR NEW.event_date < dzis_pl() THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'zmiana_terminu',
         'Zmiana terminu meczu',
         'Nowy termin: ' || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || ' (' || coalesce(v_tytul, 'mecz') || ').',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Usunięcie meczu na stałe (116)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_usunieciu_meczu()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT;
BEGIN
  IF OLD.event_date < current_date THEN RETURN OLD; END IF;

  v_tytul := coalesce(OLD.title, OLD.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id, 'mecz_usuniety', 'Mecz usunięty',
    coalesce(v_tytul, 'Mecz') || ', ' || to_char(OLD.event_date, 'DD.MM') || ', godz. '
      || to_char(OLD.event_time, 'HH24:MI') || '. Organizator usunął ten mecz na stałe.',
    NULL::uuid -- CELOWO NULL, nie OLD.id: patrz komentarz na górze pliku 116 (pułapka CASCADE)
    FROM event_participants p
   WHERE p.event_id = OLD.id AND p.user_id IS NOT NULL AND p.user_id <> OLD.organizer_id;

  RETURN OLD;
END; $$;

-- ---------------------------------------------------------------------------
-- 6. Usunięcie uczestnika ze składu (113)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_usunieciu_uczestnika()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tytul  TEXT;
  v_data   DATE;
  v_godz   TIME;
  v_status TEXT;
BEGIN
  IF OLD.user_id IS NULL
     OR OLD.pending_approval IS TRUE
     OR auth.uid() IS NOT DISTINCT FROM OLD.user_id
  THEN
    RETURN OLD;
  END IF;

  SELECT coalesce(title, sport), event_date, event_time, status
    INTO v_tytul, v_data, v_godz, v_status
    FROM events WHERE id = OLD.event_id;

  IF v_status IS NULL OR v_status = 'cancelled' OR v_data < current_date THEN
    RETURN OLD;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    OLD.user_id, 'usuniety_ze_skladu', 'Usunięto Cię ze składu',
    coalesce(v_tytul, 'Mecz') || ', ' || to_char(v_data, 'DD.MM') || ', godz. '
      || to_char(v_godz, 'HH24:MI') || '. Organizator usunął Twój zapis.',
    OLD.event_id
  );
  RETURN OLD;
END; $$;

-- ---------------------------------------------------------------------------
-- 7. Zmiana warunków meczu — miejsce/koszt (114)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zmianie_warunkow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tytul           TEXT;
  v_miejsce_zmiana  BOOLEAN;
  v_cena_zmiana     BOOLEAN;
  v_body            TEXT;
BEGIN
  v_miejsce_zmiana := NEW.field_id IS DISTINCT FROM OLD.field_id
    OR NEW.field_name IS DISTINCT FROM OLD.field_name
    OR NEW.custom_location_name IS DISTINCT FROM OLD.custom_location_name
    OR NEW.custom_address IS DISTINCT FROM OLD.custom_address
    OR NEW.lat IS DISTINCT FROM OLD.lat
    OR NEW.lng IS DISTINCT FROM OLD.lng;
  v_cena_zmiana := NEW.cost_grosz IS DISTINCT FROM OLD.cost_grosz;

  IF NOT v_miejsce_zmiana AND NOT v_cena_zmiana THEN RETURN NEW; END IF;
  IF NEW.status = 'cancelled' OR NEW.event_date < current_date THEN RETURN NEW; END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);
  v_body := coalesce(v_tytul, 'Mecz') || ', ';
  IF v_miejsce_zmiana AND v_cena_zmiana THEN
    v_body := v_body || 'zmieniło się miejsce i koszt.';
  ELSIF v_miejsce_zmiana THEN
    v_body := v_body || 'zmieniło się miejsce: '
      || coalesce(NEW.field_name, NEW.custom_location_name, 'nowa lokalizacja') || '.';
  ELSE
    v_body := v_body || 'zmienił się koszt: '
      || to_char(NEW.cost_grosz / 100.0, 'FM999990.00') || ' zł od osoby.';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id, 'zmiana_warunkow_meczu', 'Zmiana w meczu', v_body, NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id AND p.user_id IS NOT NULL AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- 8. Akceptacja/prośba/odrzucenie dołączenia (076, ostatnia wersja odrzucenia z 148)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_akceptacji()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF NEW.user_id IS NULL OR OLD.pending_approval IS NOT TRUE OR NEW.pending_approval IS NOT FALSE THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = NEW.event_id;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (NEW.user_id, 'zapis_zaakceptowany', 'Jesteś w składzie',
    'Organizator przyjął Twój zapis na mecz: ' || coalesce(v_tytul,'mecz')
      || ', ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    NEW.event_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION powiadom_o_prosbie_o_dolaczenie()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_organizer_id UUID; v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF NEW.pending_approval IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT organizer_id, coalesce(title, sport), event_date, event_time
    INTO v_organizer_id, v_tytul, v_data, v_godz FROM events WHERE id = NEW.event_id;
  IF v_organizer_id IS NULL OR v_organizer_id = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (v_organizer_id, 'prosba_o_dolaczenie', 'Nowa prośba o dołączenie',
    coalesce(NEW.name,'Gracz') || ' chce dołączyć do meczu: ' || coalesce(v_tytul,'mecz')
      || ', ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    NEW.event_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;

  -- Z `135`: gracz wycofał prośbę sam (przycisk „Anuluj" w banerze „Oczekujesz
  -- na akceptację" woła ten sam DELETE co odrzucenie przez organizatora).
  -- „Organizator nie przyjął Twojej prośby" byłoby wtedy nieprawdą.
  IF auth.uid() IS NOT DISTINCT FROM OLD.user_id THEN RETURN OLD; END IF;

  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;

  -- Z `116`: meczu już nie ma, to kaskada z `DELETE FROM events`; o tym mówi
  -- osobne powiadomienie `mecz_usuniety` (`powiadom_o_usunieciu_meczu()`).
  IF NOT FOUND THEN RETURN OLD; END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (OLD.user_id, 'prosba_odrzucona', 'Prośba o dołączenie odrzucona',
    'Organizator nie przyjął Twojej prośby o dołączenie do meczu: ' || coalesce(v_tytul,'mecz')
      || ', ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    OLD.event_id);
  RETURN OLD;
END; $$;

-- ---------------------------------------------------------------------------
-- 9. Konto skojarzone z wpisem gościa, w obie strony (084)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_istniejace_konto_o_wpisie_goscia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tytul   text;
BEGIN
  IF NOT (NEW.is_guest AND NEW.guest_email IS NOT NULL AND NEW.claim_token IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(NEW.guest_email)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(title, sport) INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id, claim_token)
  VALUES (
    v_user_id,
    'niepotwierdzony_wpis_goscia',
    'Masz niepotwierdzony zapis na mecz',
    coalesce(v_tytul, 'mecz') || '. To Ty? Potwierdź, żeby dołączyć do składu na swoim koncie.',
    NEW.event_id,
    NEW.claim_token
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION powiadom_o_niepotwierdzonych_wpisach_goscia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ep.event_id, ep.claim_token, coalesce(e.title, e.sport) AS tytul
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
     WHERE ep.is_guest = true
       AND ep.user_id IS NULL
       AND ep.claim_token IS NOT NULL
       AND ep.guest_email IS NOT NULL
       AND lower(ep.guest_email) = lower(NEW.email)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, event_id, claim_token)
    VALUES (
      NEW.id,
      'niepotwierdzony_wpis_goscia',
      'Masz niepotwierdzony zapis na mecz',
      coalesce(r.tytul, 'mecz') || '. To Ty? Potwierdź, żeby dołączyć do składu na swoim koncie.',
      r.event_id,
      r.claim_token
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Nowy mecz i tablica ekipy (111, ostatnia wersja)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_skladach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.teams_published IS NOT TRUE OR OLD.teams_published IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'sklady_opublikowane',
         coalesce(NEW.title, 'Mecz'),
         'Są składy. Sprawdź, w której drużynie grasz. '
           || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id
    FROM event_participants ep
   WHERE ep.event_id = NEW.id
     AND ep.user_id IS NOT NULL
     AND ep.is_reserve = false
     AND ep.pending_approval = false;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa_grupy TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_nazwa_grupy FROM groups WHERE id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         coalesce(v_nazwa_grupy, 'Twoja ekipa') || ': nowy mecz',
         coalesce(NEW.title, 'Mecz') || ', '
           || to_char(NEW.event_date, 'DD.MM') || ' godz. '
           || to_char(NEW.event_time, 'HH24:MI')
           || coalesce(' · ' || NEW.field_name, '') || '.',
         NEW.id,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Próg „gra się odbędzie" (097) — kod zostaje, mimo że toggle jest
--     schowany flagą `SHOW_MIN_PLAYERS_THRESHOLD`; istniejące mecze z
--     ustawionym progiem dalej go liczą.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION zapytaj_milczacych(p_event_id UUID) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id     UUID;
  v_organizer_id UUID;
  v_tytul        TEXT;
  v_data         DATE;
  v_godz         TIME;
  v_n            INT;
BEGIN
  SELECT group_id, organizer_id, coalesce(title, sport), event_date, event_time
    INTO v_group_id, v_organizer_id, v_tytul, v_data, v_godz
    FROM events WHERE id = p_event_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Ta funkcja działa tylko dla meczów przypiętych do ekipy';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_organizer_id
     AND NOT czy_moze_tworzyc_wydarzenia_w_grupie(v_group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby zapytać ekipę o ten mecz';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id, 'pytanie_o_udzial',
         'Grasz w ' || coalesce(v_tytul, 'meczu') || '?',
         to_char(v_data, 'DD.MM') || ', godz. ' || to_char(v_godz, 'HH24:MI')
           || '; daj znać, czy wchodzisz.',
         p_event_id, v_group_id
    FROM group_members gm
   WHERE gm.group_id = v_group_id
     AND NOT EXISTS (
       SELECT 1 FROM event_participants ep WHERE ep.event_id = p_event_id AND ep.user_id = gm.user_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM event_declines ed WHERE ed.event_id = p_event_id AND ed.user_id = gm.user_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id AND n.event_id = p_event_id AND n.type = 'pytanie_o_udzial'
          AND n.created_at > now() - interval '12 hours'
     );

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION powiadom_o_progu_gry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_actor    UUID;
  v_min      INT;
  v_status   TEXT;
  v_data     DATE;
  v_tytul    TEXT;
  v_po       INT;
  v_przed    INT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id; v_actor := OLD.user_id;
  ELSE v_event_id := NEW.event_id; v_actor := NEW.user_id; END IF;

  SELECT min_players, status, event_date, coalesce(title, sport)
    INTO v_min, v_status, v_data, v_tytul
    FROM events WHERE id = v_event_id;

  IF v_min IS NULL OR v_status <> 'active' OR v_data < current_date THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_po
    FROM event_participants
   WHERE event_id = v_event_id AND pending_approval IS NOT TRUE AND is_reserve IS NOT TRUE;

  v_przed := v_po;
  IF TG_OP <> 'INSERT' AND OLD.pending_approval IS NOT TRUE AND OLD.is_reserve IS NOT TRUE THEN
    v_przed := v_przed + 1;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.pending_approval IS NOT TRUE AND NEW.is_reserve IS NOT TRUE THEN
    v_przed := v_przed - 1;
  END IF;

  IF v_przed < v_min AND v_po >= v_min THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    SELECT ep.user_id, 'gra_potwierdzona', 'Gramy! ✓',
           coalesce(v_tytul, 'Mecz') || ', skład przekroczył minimum (' || v_po || '/' || v_min || ').',
           v_event_id
      FROM event_participants ep
     WHERE ep.event_id = v_event_id AND ep.pending_approval IS NOT TRUE AND ep.is_reserve IS NOT TRUE
       AND ep.user_id IS NOT NULL AND ep.user_id IS DISTINCT FROM v_actor;
    RETURN NULL;
  END IF;

  IF v_przed >= v_min AND v_po < v_min THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    SELECT ep.user_id, 'gra_zagrozona', 'Gra zagrożona',
           coalesce(v_tytul, 'Mecz') || ', brakuje ' || (v_min - v_po) || ' do minimum (' || v_po || '/' || v_min || ').',
           v_event_id
      FROM event_participants ep
     WHERE ep.event_id = v_event_id AND ep.pending_approval IS NOT TRUE AND ep.is_reserve IS NOT TRUE
       AND ep.user_id IS NOT NULL AND ep.user_id IS DISTINCT FROM v_actor;
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. Komplet/zwolnione miejsce (079)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zmianie_kompletu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id     UUID;
  v_organizer_id UUID;
  v_tytul        TEXT;
  v_data         DATE;
  v_godz         TIME;
  v_status       TEXT;
  v_max          INT;
  v_po           INT;
  v_przed        INT;
  v_rezerwa      INT;
  v_imie         TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id; ELSE v_event_id := NEW.event_id; END IF;

  SELECT organizer_id, coalesce(title, sport), event_date, event_time, status, max_players
    INTO v_organizer_id, v_tytul, v_data, v_godz, v_status, v_max
    FROM events WHERE id = v_event_id;

  IF v_organizer_id IS NULL OR v_status <> 'active' OR v_data < current_date THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = v_organizer_id THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_po
    FROM event_participants
   WHERE event_id = v_event_id
     AND pending_approval IS NOT TRUE
     AND is_reserve IS NOT TRUE;

  v_przed := v_po;
  IF TG_OP <> 'INSERT' AND OLD.pending_approval IS NOT TRUE AND OLD.is_reserve IS NOT TRUE THEN
    v_przed := v_przed + 1;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.pending_approval IS NOT TRUE AND NEW.is_reserve IS NOT TRUE THEN
    v_przed := v_przed - 1;
  END IF;

  IF v_przed < v_max AND v_po >= v_max THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (v_organizer_id, 'komplet_skladu', 'Masz komplet',
      coalesce(v_tytul, 'Mecz') || ', ' || to_char(v_data, 'DD.MM')
        || ', godz. ' || to_char(v_godz, 'HH24:MI') || '. Skład jest pełny: '
        || v_po || ' z ' || v_max || '.',
      v_event_id);
    RETURN NULL;
  END IF;

  IF v_przed >= v_max AND v_po < v_max THEN
    SELECT count(*) INTO v_rezerwa
      FROM event_participants
     WHERE event_id = v_event_id
       AND is_reserve IS TRUE
       AND pending_approval IS NOT TRUE
       AND rsvp <> 'maybe'
       AND claim_passed IS NOT TRUE;

    v_imie := coalesce(CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END, 'Ktoś');

    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (v_organizer_id, 'zwolnilo_sie_miejsce', 'Zwolniło się miejsce',
      v_imie || ' wypisał(a) się z meczu: ' || coalesce(v_tytul, 'Mecz') || ', '
        || to_char(v_data, 'DD.MM') || ', godz. ' || to_char(v_godz, 'HH24:MI')
        || '. Skład: ' || v_po || ' z ' || v_max || '. '
        || CASE WHEN v_rezerwa > 0
                THEN 'Miejsce trafia do pierwszej osoby z rezerwy (czeka ich ' || v_rezerwa || ').'
                ELSE 'Nie ma nikogo na rezerwie: trzeba znaleźć zmiennika.' END,
      v_event_id);
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Kolejka rezerwowa — oferta wygasła / nowa oferta (137, ostatnia wersja)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutes smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_czas text;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_minutes, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= teraz_pl() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_minutes, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_minutes IS NULL OR v_started THEN RETURN; END IF;

  v_czas := CASE
    WHEN v_minutes < 60 THEN v_minutes || ' min.'
    WHEN v_minutes % 60 = 0 THEN (v_minutes / 60) || ' godz.'
    ELSE (v_minutes / 60) || ' godz. ' || (v_minutes % 60) || ' min.'
  END;

  WITH wygasle AS (
    UPDATE event_participants
       SET oferta_wygasla_at = now(), claim_offered_at = NULL
     WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
       AND claim_offered_at + (v_minutes || ' minutes')::interval <= now()
    RETURNING user_id
  )
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT user_id, 'oferta_wygasla', v_title,
         'Czas na przyjęcie miejsca minął, więc poszło do kolejnej osoby. '
         || 'Zostajesz na liście rezerwowej, na jej końcu; przy następnym '
         || 'zwolnionym miejscu dostaniesz kolejną ofertę.',
         p_event_id
    FROM wygasle WHERE user_id IS NOT NULL;

  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND (user_id IS NOT NULL OR guest_email IS NOT NULL)
       AND is_goalkeeper = false
     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
     LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      IF v_next_user IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, event_id)
        VALUES (v_next_user, 'reserve_claim_offered', v_title,
                'Zwolniło się miejsce. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
      ELSE
        PERFORM wyslij_mail_do_goscia(v_next_id, 'oferta');
      END IF;
    END IF;
  END IF;

  IF czy_na_rezerwe(p_event_id, true) IS FALSE THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND (user_id IS NOT NULL OR guest_email IS NOT NULL)
       AND is_goalkeeper = true
     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
     LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      IF v_next_user IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, event_id)
        VALUES (v_next_user, 'reserve_claim_offered', v_title,
                'Zwolniło się miejsce dla bramkarza. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
      ELSE
        PERFORM wyslij_mail_do_goscia(v_next_id, 'oferta');
      END IF;
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. Przypomnienia dzień przed / po meczu (160, ostatnia wersja)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wyslij_przypomnienia()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dzis  date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_ile   integer := 0;
  v_teraz integer;
BEGIN
  -- A. JUTRO GRASZ: do wszystkich, którzy mają miejsce w składzie.
  WITH sklad AS (
    SELECT e.id AS event_id,
           e.organizer_id,
           coalesce(e.title, e.sport)                                     AS tytul,
           to_char(e.event_time, 'HH24:MI')                               AS godzina,
           coalesce(e.field_name, e.custom_location_name, 'boisko')       AS miejsce,
           e.max_players,
           e.zapisy_zamkniete,
           count(*) FILTER (
             WHERE p.pending_approval IS NOT TRUE
               AND p.rsvp <> 'maybe'
               AND p.is_reserve IS NOT TRUE)                              AS w_skladzie,
           count(*) FILTER (
             WHERE p.is_reserve
               AND p.pending_approval IS NOT TRUE
               AND p.rsvp <> 'maybe'
               AND p.claim_passed IS NOT TRUE)                            AS na_rezerwie
      FROM events e
      JOIN event_participants p ON p.event_id = e.id
     WHERE e.event_date = v_dzis + 1
       AND e.status = 'active'
     GROUP BY e.id
  )
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT p.user_id,
         'przypomnienie_o_meczu',
         s.tytul,
         CASE
           WHEN p.user_id = s.organizer_id AND s.zapisy_zamkniete
             THEN 'Jutro ' || s.godzina || ' · ' || s.miejsce
                  || ' · zapisy zamknięte (' || s.w_skladzie || '/' || s.max_players || ')'
           WHEN p.user_id = s.organizer_id AND s.w_skladzie < s.max_players
             THEN 'Jutro ' || s.godzina || ' · ' || s.miejsce
                  || ' · brakuje ' || (s.max_players - s.w_skladzie)
                  || ' (' || s.w_skladzie || '/' || s.max_players || ')'
                  || CASE WHEN s.na_rezerwie > 0
                          THEN ' · ' || odmien_czeka_na_rezerwie(s.na_rezerwie::int)
                          ELSE '' END
           ELSE 'Jutro ' || s.godzina || ' · ' || s.miejsce
         END,
         s.event_id
    FROM sklad s
    JOIN event_participants p ON p.event_id = s.event_id
   WHERE p.user_id IS NOT NULL
     AND p.pending_approval IS NOT TRUE
     AND p.rsvp <> 'maybe'
     AND p.is_reserve IS NOT TRUE
     AND NOT EXISTS (
           SELECT 1 FROM notifications n
            WHERE n.user_id = p.user_id
              AND n.event_id = s.event_id
              AND n.type = 'przypomnienie_o_meczu');

  GET DIAGNOSTICS v_teraz = ROW_COUNT;
  v_ile := v_ile + v_teraz;

  -- B. Organizator, który jutro gra, ale nie ma siebie w składzie.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT e.organizer_id,
         'przypomnienie_o_meczu',
         coalesce(e.title, e.sport),
         CASE
           WHEN e.zapisy_zamkniete
             THEN 'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
                  || coalesce(e.field_name, e.custom_location_name, 'boisko')
                  || ' · zapisy zamknięte (' || w.w_skladzie || '/' || e.max_players || ')'
           WHEN w.w_skladzie < e.max_players
             THEN 'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
                  || coalesce(e.field_name, e.custom_location_name, 'boisko')
                  || ' · brakuje ' || (e.max_players - w.w_skladzie)
                  || ' (' || w.w_skladzie || '/' || e.max_players || ')'
                  || CASE WHEN w.na_rezerwie > 0
                          THEN ' · ' || odmien_czeka_na_rezerwie(w.na_rezerwie::int)
                          ELSE '' END
           ELSE 'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
                || coalesce(e.field_name, e.custom_location_name, 'boisko')
         END,
         e.id
    FROM events e
    CROSS JOIN LATERAL (
      SELECT
        count(*) FILTER (
          WHERE x.pending_approval IS NOT TRUE
            AND x.rsvp <> 'maybe'
            AND x.is_reserve IS NOT TRUE)                                AS w_skladzie,
        count(*) FILTER (
          WHERE x.is_reserve
            AND x.pending_approval IS NOT TRUE
            AND x.rsvp <> 'maybe'
            AND x.claim_passed IS NOT TRUE)                              AS na_rezerwie
        FROM event_participants x WHERE x.event_id = e.id
    ) w
   WHERE e.event_date = v_dzis + 1
     AND e.status = 'active'
     AND NOT EXISTS (
           SELECT 1 FROM notifications n
            WHERE n.user_id = e.organizer_id
              AND n.event_id = e.id
              AND n.type = 'przypomnienie_o_meczu');

  GET DIAGNOSTICS v_teraz = ROW_COUNT;
  v_ile := v_ile + v_teraz;

  -- C. Po meczu: tylko organizator i tylko wtedy, gdy jest co domknąć.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT e.organizer_id,
         'po_meczu_do_domkniecia',
         coalesce(e.title, e.sport),
         'Mecz rozegrany. ' || array_to_string(
           array_remove(ARRAY[
             CASE WHEN e.track_results
                   AND NOT EXISTS (SELECT 1 FROM match_results r WHERE r.event_id = e.id)
                  THEN 'Wpisz wynik' END,
             CASE WHEN e.cost_grosz > 0 AND (
                    SELECT count(*) FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE
                       AND x.user_id IS DISTINCT FROM e.organizer_id) > 0
                  THEN 'odhacz wpłaty: ' || odmien_nie_oddalo((
                    SELECT count(*)::int FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE
                       AND x.user_id IS DISTINCT FROM e.organizer_id)) END
           ], NULL), ', ') || '.',
         e.id
    FROM events e
   WHERE e.event_date = v_dzis - 1
     AND e.status = 'active'
     AND (
       (e.track_results AND NOT EXISTS (SELECT 1 FROM match_results r WHERE r.event_id = e.id))
       OR (e.cost_grosz > 0 AND EXISTS (
             SELECT 1 FROM event_participants x
              WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                AND x.is_reserve IS NOT TRUE
                AND x.user_id IS DISTINCT FROM e.organizer_id))
     )
     AND NOT EXISTS (
           SELECT 1 FROM notifications n
            WHERE n.user_id = e.organizer_id
              AND n.event_id = e.id
              AND n.type = 'po_meczu_do_domkniecia');

  GET DIAGNOSTICS v_teraz = ROW_COUNT;
  v_ile := v_ile + v_teraz;

  RETURN v_ile;
END;
$$;

-- ---------------------------------------------------------------------------
-- 15. Rezerwa wyłączona — komunikat błędu (124)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pilnuj_wylaczonej_rezerwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = NEW.event_id AND reserve_enabled
  ) THEN
    RAISE EXCEPTION 'Ten mecz nie prowadzi listy rezerwowej: przy komplecie zapisy są zamknięte.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 16. Odświeżenie kodu grupy — komunikat błędu (094)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION odswiez_kod_grupy(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kod TEXT;
  i INT;
BEGIN
  IF NOT czy_zalozyciel_grupy(p_group_id) THEN
    RAISE EXCEPTION 'Tylko założyciel może odświeżyć kod grupy';
  END IF;

  FOR i IN 1..10 LOOP
    BEGIN
      v_kod := generate_join_code();
      UPDATE groups
         SET join_code = v_kod, join_code_rotated_at = now()
       WHERE id = p_group_id;
      RETURN v_kod;
    EXCEPTION WHEN unique_violation THEN
      -- kolejna próba
    END;
  END LOOP;

  RAISE EXCEPTION 'Nie udało się wylosować nowego kodu; spróbuj ponownie';
END;
$$;

-- ---------------------------------------------------------------------------
-- 17. Turnieje — dołączenie kodem, zgłoszenie i decyzja o drużynie (145)
-- ---------------------------------------------------------------------------
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

  -- Kapitanat: pierwszy, kto otworzy link drużyny bez kapitana, nim staje.
  IF p_jako_kapitan THEN
    IF v_druzyna.kapitan_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ta drużyna ma już kapitana.';
    END IF;
    UPDATE turniej_druzyny SET kapitan_id = auth.uid() WHERE id = v_druzyna.id;
    v_kapitan := true;

    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_turniej.organizator_id, 'turniej_kapitan_przejal',
            'Drużyna ma kapitana',
            v_druzyna.nazwa || ': ktoś przejął zarządzanie drużyną.',
            v_turniej.id);
  END IF;

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

  IF p_zawodnik_id IS NOT NULL THEN
    UPDATE turniej_zawodnicy SET user_id = auth.uid()
     WHERE id = p_zawodnik_id AND druzyna_id = v_druzyna.id AND user_id IS NULL
     RETURNING id INTO v_zawodnik;
    IF v_zawodnik IS NULL THEN
      RAISE EXCEPTION 'To miejsce w składzie jest już zajęte.';
    END IF;
  ELSE
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

CREATE OR REPLACE FUNCTION powiadom_o_zgloszeniu_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t turnieje%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM turnieje WHERE id = NEW.turniej_id;
  IF NEW.dodana_recznie OR v_t.organizator_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'zgloszona' THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_t.organizator_id, 'turniej_zgloszenie_druzyny',
            'Nowe zgłoszenie do turnieju', NEW.nazwa || ' (' || v_t.nazwa || ')', v_t.id);
  ELSE
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_t.organizator_id, 'turniej_druzyna_przyjeta',
            'Nowa drużyna w turnieju', NEW.nazwa || ' (' || v_t.nazwa || ')', v_t.id);
  END IF;
  RETURN NEW;
END $$;

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
            NEW.nazwa || ' (' || v_t.nazwa || ')', v_t.id);
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 18. Turnieje — terminarz: zapis i przesunięcie (146)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION zapisz_terminarz(p_turniej uuid, p_mecze jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_niedokonczone int;
  v_wstawiono int;
BEGIN
  IF NOT czy_zarzadza_turniejem(p_turniej) THEN
    RAISE EXCEPTION 'Brak uprawnień do edycji terminarza tego turnieju.';
  END IF;

  SELECT count(*) INTO v_niedokonczone FROM turniej_mecze
   WHERE turniej_id = p_turniej AND status <> 'zaplanowany';
  IF v_niedokonczone > 0 THEN
    RAISE EXCEPTION 'Terminarz ma % nie w pełni zaplanowanych meczów: nie można go nadpisać.', v_niedokonczone;
  END IF;

  DELETE FROM turniej_mecze WHERE turniej_id = p_turniej;

  INSERT INTO turniej_mecze (
    id, turniej_id, numer, faza, grupa_id, kolejka, pozycja_w_drabince,
    druzyna_a_id, druzyna_b_id, zrodlo_a_mecz_id, zrodlo_b_mecz_id,
    zrodlo_a_typ, zrodlo_b_typ, arena_id, zaplanowany_at, status,
    zwyciezca_id, walkower_dla
  )
  SELECT
    (m->>'id')::uuid, p_turniej, (m->>'numer')::int, m->>'faza',
    NULLIF(m->>'grupaId','')::uuid, (m->>'kolejka')::int, (m->>'pozycjaWDrabince')::int,
    NULLIF(m->>'druzynaAId','')::uuid, NULLIF(m->>'druzynaBId','')::uuid,
    NULLIF(m->>'zrodloAMeczId','')::uuid, NULLIF(m->>'zrodloBMeczId','')::uuid,
    NULLIF(m->>'zrodloATyp',''), NULLIF(m->>'zrodloBTyp',''),
    NULLIF(m->>'arenaId','')::uuid, (m->>'zaplanowanyAt')::timestamptz,
    coalesce(NULLIF(m->>'status',''), 'zaplanowany'),
    NULLIF(m->>'zwyciezcaId','')::uuid, NULLIF(m->>'walkowerDla','')::uuid
  FROM jsonb_array_elements(p_mecze) AS m;
  GET DIAGNOSTICS v_wstawiono = ROW_COUNT;

  PERFORM propaguj_zwyciezce_dla(id) FROM turniej_mecze
   WHERE turniej_id = p_turniej AND status <> 'zaplanowany';

  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  SELECT DISTINCT z.user_id, 'turniej_terminarz_gotowy', 'Terminarz gotowy',
         'Sprawdź, kiedy gracie (' || t.nazwa || ')', p_turniej
    FROM turniej_zawodnicy z
    JOIN turnieje t ON t.id = p_turniej
   WHERE z.turniej_id = p_turniej AND z.user_id IS NOT NULL;

  RETURN v_wstawiono;
END $$;

CREATE OR REPLACE FUNCTION przesun_terminarz(p_turniej uuid, p_od_meczu uuid, p_minuty int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_od timestamptz;
  v_ile int;
BEGIN
  IF NOT czy_zarzadza_turniejem(p_turniej) THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany terminarza tego turnieju.';
  END IF;

  SELECT zaplanowany_at INTO v_od FROM turniej_mecze
   WHERE id = p_od_meczu AND turniej_id = p_turniej;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono meczu w tym turnieju.';
  END IF;
  IF v_od IS NULL THEN
    RAISE EXCEPTION 'Ten mecz nie ma jeszcze ustalonej godziny: nie da się liczyć przesunięcia od niego.';
  END IF;

  UPDATE turniej_mecze
     SET zaplanowany_at = zaplanowany_at + make_interval(mins => p_minuty)
   WHERE turniej_id = p_turniej AND status = 'zaplanowany' AND zaplanowany_at >= v_od;
  GET DIAGNOSTICS v_ile = ROW_COUNT;

  IF v_ile > 0 THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    SELECT DISTINCT z.user_id, 'turniej_zmiana_terminu', 'Zmiana terminarza',
           format('Terminarz przesunięty o %s min (%s)', p_minuty, t.nazwa), p_turniej
      FROM turniej_mecze m
      JOIN turniej_zawodnicy z ON z.druzyna_id IN (m.druzyna_a_id, m.druzyna_b_id)
      JOIN turnieje t ON t.id = p_turniej
     WHERE m.turniej_id = p_turniej AND z.user_id IS NOT NULL
       AND m.zaplanowany_at >= v_od + make_interval(mins => p_minuty);
  END IF;

  RETURN v_ile;
END $$;
