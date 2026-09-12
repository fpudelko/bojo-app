-- 143 — kolejka rezerwowa dostaje zegar
--
-- DLACZEGO. `sync_reserve_claim()` (migracje `118`/`130`/`135`) jest wołane
-- WYŁĄCZNIE czyimś kliknięciem: wejściem na stronę meczu, wypisaniem się kogoś,
-- odpuszczeniem oferty. Gdy oferta zwolnionego miejsca wygasa i NIKT nie
-- otworzy strony meczu, kolejka STAJE: wygasła oferta dalej wisi, następna
-- osoba nie dostaje niczego, a organizator gra w niepełnym składzie mając
-- chętnego na ławce. Sprawdzone zapytaniami na bazie (audyt 2026-09-12,
-- `docs/przeplyw-organizatora.md`, ustalenie `S-1`): 6 h po wygaśnięciu okna
-- (domyślnie 180 min) oferta stała dalej, druga osoba w kolejce miała zero
-- powiadomień, skład 1 z 2.
--
-- GORSZA POŁOWA: po starcie meczu `sync_reserve_claim()` wychodzi natychmiast
-- (`IF v_minutes IS NULL OR v_started THEN RETURN`), więc oferta, która wygasła
-- tuż przed startem i nikt nie wszedł na stronę, nie wygaśnie już NIGDY —
-- zostaje przypisana do gracza, który jej nie przyjął.
--
-- Migracja `079` mówi przy tym organizatorowi WPROST: „Miejsce trafia do
-- pierwszej osoby z rezerwy" — obietnica, której druga połowa działała tylko
-- wtedy, gdy ktoś przypadkiem odświeżył stronę.
--
-- JAK. Zadanie w bazie przegląda aktywne, PRZYSZŁE mecze z niepustą rezerwą
-- i woła ISTNIEJĄCĄ, przetestowaną `sync_reserve_claim()`. Świadomie NIE
-- powtarzamy tu reguły „czy jest wolne miejsce" — rozstrzyga ją `czy_na_rezerwe()`
-- wewnątrz `sync_reserve_claim()`, a druga kopia tej samej reguły rozjechałaby
-- się przy pierwszej zmianie (ta sama lekcja co `KROK_KREATORA` w kreatorze —
-- jedno źródło prawdy, nie trzy niezależne kopie).
--
-- CO 15 MINUT, NIE RZADZIEJ. Okno oferty ma dolny limit 15 minut
-- (`events_reserve_claim_minutes_check`). Zadanie rzadsze niż najkrótsze
-- dopuszczalne okno znaczyłoby, że organizator, który ustawił 15 min, i tak
-- czeka dłużej — czyli kontrolka w kreatorze by kłamała.
--
-- IDEMPOTENTNA i tania: zbiór to aktywne przyszłe mecze z kimkolwiek na
-- rezerwie, czyli w praktyce kilkadziesiąt wierszy. Drugi przebieg pod rząd
-- nie wysyła nic nowego — sprawdzone.

CREATE OR REPLACE FUNCTION porzadkuj_kolejki_rezerwy()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id  uuid;
  v_ile integer := 0;
BEGIN
  FOR v_id IN
    SELECT DISTINCT e.id
      FROM events e
      JOIN event_participants p ON p.event_id = e.id
     WHERE e.status = 'active'
       AND (e.event_date + e.event_time)::timestamp > teraz_pl()
       AND p.is_reserve
       AND p.pending_approval IS NOT TRUE
       AND p.rsvp <> 'maybe'
  LOOP
    PERFORM sync_reserve_claim(v_id);
    v_ile := v_ile + 1;
  END LOOP;

  RETURN v_ile;
END;
$$;

COMMENT ON FUNCTION porzadkuj_kolejki_rezerwy() IS
  'Wołane WYŁĄCZNIE przez zadanie pg_cron (bojo-kolejka-rezerwy). Przegląda aktywne przyszłe mecze z niepustą rezerwą i odświeża każdy przez sync_reserve_claim() — bez tego wygasła oferta stoi, dopóki ktoś przypadkiem nie wejdzie na stronę meczu.';

-- Wołana wyłącznie przez zadanie w bazie — z przeglądarki nie ma po co jej
-- ruszać, a dostępna dla `anon` byłaby zaproszeniem do przymuszania kolejki
-- rezerwowej cudzych meczów.
REVOKE ALL ON FUNCTION porzadkuj_kolejki_rezerwy() FROM public;
REVOKE ALL ON FUNCTION porzadkuj_kolejki_rezerwy() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Harmonogram — co 15 minut
-- ---------------------------------------------------------------------------
-- Owinięte w DO wzorem `073`/`129`: samo `cron.schedule` na bazie bez
-- `pg_cron` wywraca całą migrację. Na produkcji rozszerzenie JEST włączone
-- (sprawdzone przy `129`/`133`), ale `baza-testowa.sh` stawia goły Postgres
-- bez niego.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- `unschedule` przed `schedule`: bez tego drugie uruchomienie migracji
    -- wywala się na duplikacie nazwy zadania.
    PERFORM cron.unschedule('bojo-kolejka-rezerwy')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bojo-kolejka-rezerwy');
    PERFORM cron.schedule(
      'bojo-kolejka-rezerwy',
      '*/15 * * * *',
      'SELECT porzadkuj_kolejki_rezerwy()'
    );
    RAISE NOTICE 'Zadanie bojo-kolejka-rezerwy ustawione co 15 minut.';
  ELSE
    RAISE NOTICE 'pg_cron niewłączony — kolejka rezerwowa NIE będzie się porządkować sama, dopóki ktoś nie wejdzie na stronę meczu. Włącz: Database → Extensions → pg_cron, potem uruchom ten blok ponownie.';
  END IF;
END
$$;

-- SPRAWDZENIE PO URUCHOMIENIU (wkleić w SQL Editorze):
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'bojo-kolejka-rezerwy';
--   SELECT porzadkuj_kolejki_rezerwy();   -- ręczne wywołanie: zwraca liczbę przejrzanych meczów
