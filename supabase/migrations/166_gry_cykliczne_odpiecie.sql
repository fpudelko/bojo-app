-- 166_gry_cykliczne_odpiecie.sql
--
-- Gry cykliczne (stałe gierki) znikają z Bojo całkowicie — decyzja właściciela,
-- runda 9 (D-4): nie tylko flaga `SHOW_RECURRING`, cały moduł. Migracja `164`
-- już skasowała trójkę funkcji serii i jej wyzwalacz (`utworz_termin_serii`,
-- `utworz_nalezne_terminy_serii`, `powiadom_o_nowym_terminie_serii`) — ta,
-- BEZPIECZNA połowa, odpina dwie funkcje, które PRZETRWAŁY `164`, bo nie są
-- częścią samego modułu, tylko GO CZYTAJĄ z zewnątrz, i cron, który mógł
-- zostać zaplanowany na produkcji zanim `164` skasowała funkcję, którą woła.
--
-- Bez tej migracji `167` (DROP TABLE/COLUMN, RĘCZNA) wywróciłaby dwie zwykłe
-- operacje na `events` w chwili kliknięcia: przypięcie meczu do grupy i
-- usunięcie konta zaczęłyby rzucać `record "new" has no field
-- "recurring_event_id"` / `relation "recurring_events" does not exist`.
-- Rozdzielenie na dwie migracje jest świadome: to odpięcie idzie automatem
-- przy merge'u (patrz AGENTS.md, „Migracje SQL uruchamia workflow"), więc
-- runtime przestaje zależeć od modułu PRZED tym, jak ktoś ręcznie kliknie
-- destrukcyjny DROP.
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ — `CREATE OR REPLACE` i `cron.unschedule` w bloku
-- `IF EXISTS` są idempotentne.

-- ---------------------------------------------------------------------------
-- 1. Cron „bojo-terminy-serii" (073) — woła funkcję, którą `164` już skasowała
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bojo-terminy-serii';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Przypięcie meczu do grupy nie ma już gałęzi „to termin serii" (092)
-- ---------------------------------------------------------------------------
-- Gałąź istniała wyłącznie po to, żeby `utworz_termin_serii()` (073) mogła
-- kopiować `group_id` z poprzedniego terminu bez sprawdzania uprawnień —
-- ta funkcja już nie istnieje (`164`), więc INSERT z `recurring_event_id`
-- nigdy się już nie zdarzy. Zostawienie warunku byłoby martwym kodem czekającym
-- na kolumnę, która za chwilę (`167`) zniknie.
CREATE OR REPLACE FUNCTION pilnuj_uprawnien_do_grupy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
    RETURN NEW;  -- grupa się nie zmienia — nie nasza sprawa
  END IF;
  -- auth.uid() IS NULL = wywołanie spoza sesji przeglądarki (seedy z SQL
  -- Editora, admin, przyszłe zadania w tle) — kontrolę uprawnień egzekwujemy
  -- tylko wtedy, gdy REALNIE jest czyjaś sesja do sprawdzenia.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT czy_moze_tworzyc_wydarzenia_w_grupie(NEW.group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby dodać mecz do tej grupy';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Usunięcie konta nie anonimizuje już organizatora szablonów serii (016)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Anonymise personal data in event_participants (keep event history, lose identity)
  UPDATE public.event_participants
  SET user_id   = NULL,
      name      = 'Usunięty użytkownik',
      phone     = NULL,
      added_by  = NULL
  WHERE user_id = uid;

  -- Anonymise organizer name in events (keep events visible)
  UPDATE public.events
  SET organizer_name = 'Usunięty użytkownik'
  WHERE organizer_id = uid;

  -- Delete profile (avatar stays in storage — purge separately if needed)
  DELETE FROM public.profiles WHERE id = uid;

  -- Delete auth user — Supabase cascades to auth-linked data
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
