-- 130: Baza liczy czas w UTC, a mecze grane są w czasie polskim.
--
-- PO CO. `SHOW timezone` na produkcji zwraca `UTC` (sprawdzone 2026-09-02).
-- Mecz jest zapisany jako DATA + GODZINA LOKALNA (`event_date`, `event_time`,
-- oba bez strefy), więc porównanie `(event_date + event_time)::timestamp <= now()`
-- każe Postgresowi potraktować „2026-09-02 20:00" jako czas UTC — czyli 22:00
-- czasu polskiego latem, 21:00 zimą. Efekt: mecz o 20:00 jest „rozpoczęty"
-- dopiero dwie godziny po pierwszym gwizdku.
--
-- Skutki są dziś drobne, ale realne i widoczne dla ludzi:
--   • kolejka rezerwowa rozdaje jeszcze oferty miejsc po rozpoczęciu meczu,
--   • powiadomienia o zmianie składu wychodzą dla meczów, które już trwają.
--
-- Ważniejsze jest to, co byłoby dalej: KAŻDE nowe zadanie oparte o czas
-- dziedziczy ten błąd, a przy przypomnieniach (`129`) pomyłka o dzień znaczy
-- „przypomnienie o niewłaściwym meczu". `129` liczy już poprawnie; ta migracja
-- domyka to, co było wcześniej.
--
-- CZEGO TA MIGRACJA NIE RUSZA — świadomie: funkcji statystyk (`045`, `055`,
-- `074`, `095`). Tam ta sama poprawka ZMIENIŁABY LICZBY na profilach graczy
-- (mecz rozegrany dziś wieczorem zacząłby się liczyć od razu, a nie po
-- dwóch godzinach) — to jest zmiana widoczna dla użytkownika i należy jej się
-- osobna decyzja, a nie doklejenie do migracji o czymś innym.
--
-- BEZPIECZNA W OBIE STRONY. Jeśli baza kiedykolwiek stanie na
-- `Europe/Warsaw`, `AT TIME ZONE` daje dokładnie ten sam wynik co dziś
-- domyślne `now()` — zmiana czyni regułę JAWNĄ, nie inną.

-- ---------------------------------------------------------------------------
-- 1. Wspólne „teraz" i „dziś" w czasie polskim
-- ---------------------------------------------------------------------------
-- STABLE, nie IMMUTABLE: wynik zmienia się między transakcjami, więc nie wolno
-- go zaindeksować ani użyć w kolumnie generowanej (ta sama pułapka, przez którą
-- migracja `126` musiała sięgnąć po `translate()` zamiast `unaccent()`).
CREATE OR REPLACE FUNCTION teraz_pl() RETURNS timestamp
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Warsaw') $$;

CREATE OR REPLACE FUNCTION dzis_pl() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date $$;

GRANT EXECUTE ON FUNCTION teraz_pl() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION dzis_pl()  TO anon, authenticated;

COMMENT ON FUNCTION teraz_pl() IS
  'Bieżący czas w strefie Europe/Warsaw jako timestamp bez strefy — do porównań z event_date + event_time, które też są czasem lokalnym. Baza stoi na UTC, więc gołe now() przesuwa mecze o 1-2 godziny.';

-- ---------------------------------------------------------------------------
-- 2. sync_reserve_claim — ciało z migracji `118`, zmieniona WYŁĄCZNIE
--    linia rozpoznająca rozpoczęty mecz
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
         -- BYŁO: `(event_date + event_time)::timestamp <= now()` — porównanie
         -- czasu lokalnego z UTC, czyli mecz „trwał" jeszcze dwie godziny po
         -- gwizdku i kolejka rozdawała w tym czasie miejsca.
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

  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_minutes || ' minutes')::interval <= now();

  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', v_title,
              'Zwolniło się miejsce. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
    END IF;
  END IF;

  IF czy_na_rezerwe(p_event_id, true) IS FALSE THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', v_title,
              'Zwolniło się miejsce dla bramkarza. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wyzwalacze pomijające mecze „z przeszłości"
-- ---------------------------------------------------------------------------
-- Oba używały `current_date`, czyli daty UTC. Między północą a drugą w nocy
-- czasu polskiego UTC pokazuje jeszcze dzień poprzedni, więc wyzwalacz uznawał
-- wczorajszy mecz za dzisiejszy i wysyłał powiadomienia o składzie meczu,
-- który już się odbył.
--
-- Ciała skopiowane z `079` i `097` — zmieniona WYŁĄCZNIE ta jedna linia
-- w każdym z nich, żeby diff dało się przeczytać.
DO $$
DECLARE
  v_zrodlo text;
BEGIN
  -- powiadom_o_zmianie_kompletu (079)
  SELECT pg_get_functiondef(oid) INTO v_zrodlo
    FROM pg_proc WHERE proname = 'powiadom_o_zmianie_kompletu' LIMIT 1;
  IF v_zrodlo IS NOT NULL AND position('v_data < current_date' in v_zrodlo) > 0 THEN
    EXECUTE replace(v_zrodlo, 'v_data < current_date', 'v_data < dzis_pl()');
    RAISE NOTICE 'powiadom_o_zmianie_kompletu: current_date → dzis_pl()';
  END IF;

  -- powiadom_o_progu_gry (097)
  SELECT pg_get_functiondef(oid) INTO v_zrodlo
    FROM pg_proc WHERE proname = 'powiadom_o_progu_gry' LIMIT 1;
  IF v_zrodlo IS NOT NULL AND position('v_data < current_date' in v_zrodlo) > 0 THEN
    EXECUTE replace(v_zrodlo, 'v_data < current_date', 'v_data < dzis_pl()');
    RAISE NOTICE 'powiadom_o_progu_gry: current_date → dzis_pl()';
  END IF;
END
$$;

-- Podmiana przez `pg_get_functiondef` + `replace`, a nie przez przepisanie
-- całych ciał: te dwie funkcje mają po kilkadziesiąt linii logiki, której ta
-- migracja NIE dotyczy, a każda przepisana linia to okazja, żeby coś zgubić
-- (dokładnie tak `074` musiała naprawiać `get_player_stats` po `064`).
-- Warunek `position(...) > 0` sprawia, że drugie uruchomienie nic nie robi.
