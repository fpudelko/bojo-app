-- 058: Oferta zwolnionego miejsca dla listy rezerwowej.
--
-- Dotąd po wypisaniu się gracza miejsce wracało do wspólnej puli i brał je
-- pierwszy, kto kliknął „Dołącz" — również ktoś z zewnątrz, z pominięciem
-- rezerwy. Teraz miejsce jest najpierw OFEROWANE pierwszej osobie z rezerwy,
-- która ma ograniczony czas na decyzję („Wchodzę" / „Odpuszczam"). Po upływie
-- okna oferta przechodzi do kolejnej osoby.
--
-- Świadomie NIE ma auto-awansu: rezerwowy musi kliknąć. Nikt nie wskakuje do
-- składu po cichu — patrz docs/domena.md.
--
-- Osoba, która przepuściła ofertę (odrzuciła lub nie zdążyła), NIE jest
-- usuwana z wydarzenia — dostaje `claim_passed = true`, zostaje na liście
-- (organizator wciąż może ją awansować ręcznie), ale nie blokuje kolejki.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reserve_claim_hours SMALLINT NOT NULL DEFAULT 3
    CHECK (reserve_claim_hours BETWEEN 1 AND 72);

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS claim_offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_passed     BOOLEAN NOT NULL DEFAULT false;

-- Szybkie znalezienie aktywnej oferty dla wydarzenia.
CREATE INDEX IF NOT EXISTS idx_participants_claim
  ON event_participants (event_id)
  WHERE claim_offered_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- sync_reserve_claim — utrzymuje kolejkę ofert w spójnym stanie.
--
-- SECURITY DEFINER, bo musi zmieniać cudze wiersze (przekazać ofertę dalej),
-- a polityki RLS pozwalają uczestnikowi ruszać tylko własny. Nie ma backendu
-- ani crona — funkcję woła klient przy wejściu na stronę meczu, więc musi być
-- idempotentna i bezpieczna przy równoległych wywołaniach.
--
-- Kolejność działań:
--   1. wygasłą ofertę oznacz jako przepuszczoną,
--   2. jeśli jest wolne miejsce i nikt nie ma aktywnej oferty — zaproponuj je
--      pierwszej osobie z rezerwy, która jeszcze nie przepuściła.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max          INT;
  v_hours        SMALLINT;
  v_started      BOOLEAN;
  v_taken        INT;
  v_active_offer INT;
  v_next_id      UUID;
BEGIN
  SELECT max_players,
         reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled'
    INTO v_max, v_hours, v_started
    FROM events
   WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN
    RETURN; -- brak wydarzenia albo już się zaczęło/odwołane — nie ruszamy kolejki
  END IF;

  -- 1. Wygasłe oferty: przepuszczone, miejsce wraca do puli.
  UPDATE event_participants
     SET claim_passed = true,
         claim_offered_at = NULL
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- 2. Ile miejsc realnie zajętych (ta sama definicja co w joinEvent).
  SELECT count(*) INTO v_taken
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = false
     AND pending_approval = false
     AND rsvp <> 'maybe';

  SELECT count(*) INTO v_active_offer
    FROM event_participants
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL;

  -- Miejsce pod aktywną ofertą jest zarezerwowane — nie oferujemy go drugi raz.
  IF v_taken + v_active_offer >= v_max THEN
    RETURN;
  END IF;

  -- 3. Zaproponuj miejsce pierwszej osobie w kolejce.
  SELECT id INTO v_next_id
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = true
     AND claim_passed = false
     AND claim_offered_at IS NULL
     AND pending_approval = false
     AND rsvp <> 'maybe'
     AND user_id IS NOT NULL   -- gość bez konta nie kliknie „Wchodzę"
   ORDER BY created_at
   LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE event_participants
       SET claim_offered_at = now()
     WHERE id = v_next_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;
