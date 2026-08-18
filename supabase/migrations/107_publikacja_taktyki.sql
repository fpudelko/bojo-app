-- 107: Taktykę widać dopiero po opublikowaniu — jak skład.
--
-- PO CO: kapitan układa ustawienie na raty. Przeciąga jednego gracza, zmienia
-- schemat, wraca po godzinie — a drużyna przez cały ten czas widziała każdą
-- pośrednią wersję i nie miała jak odróżnić „tak gramy" od „tak akurat
-- wyszło". Dokładnie ten sam problem rozwiązuje publikacja składu
-- (`events.teams_published`, migracja `031`), więc taktyka dostaje ten sam
-- mechanizm zamiast własnego.
--
-- KAPITAN WIDZI ZAWSZE, także przed publikacją — inaczej nie miałby czego
-- układać. Reszta drużyny widzi dopiero po kliknięciu „Opublikuj taktykę".
--
-- CZAT DRUŻYNY ZOSTAJE NIEZALEŻNY. Rozmowa to nie jest część planu i nie ma
-- powodu, żeby czekała na jego publikację — drużyna gada od razu, także po to,
-- żeby kapitan miał na czym oprzeć decyzję.

ALTER TABLE event_team_setup
  ADD COLUMN IF NOT EXISTS opublikowana BOOLEAN NOT NULL DEFAULT false;

-- Wiersze sprzed tej migracji powstały w świecie, w którym taktykę widzieli
-- wszyscy — zostawiamy to bez zmian, żeby nikomu nie zniknęło coś, co już
-- oglądał.
UPDATE event_team_setup SET opublikowana = true WHERE schemat IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pomocnicza: czy taktyka tej drużyny jest opublikowana
-- ---------------------------------------------------------------------------
-- Potrzebna przy `event_team_slots`, gdzie flagi nie ma — pozycje i ustawienie
-- to jedna decyzja rozbita na dwie tabele, więc muszą pojawiać się razem.
-- SECURITY DEFINER wzorem `czy_w_druzynie()` (`103`).
CREATE OR REPLACE FUNCTION czy_taktyka_opublikowana(p_event_id UUID, p_team TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT s.opublikowana FROM event_team_setup s
      WHERE s.event_id = p_event_id AND s.team = p_team),
    false);
$$;

GRANT EXECUTE ON FUNCTION czy_taktyka_opublikowana(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Odczyt: kapitan zawsze, drużyna po publikacji
-- ---------------------------------------------------------------------------
-- Zawężenie względem `103`, gdzie ustawienie widział każdy, kto widzi mecz.
-- Ustawienie rywala przestaje być publiczne przy okazji — i dobrze: to jest
-- ekran do uzgodnienia gry ze swoimi, nie podgląd cudzej szatni.
DROP POLICY IF EXISTS "team_setup_select" ON event_team_setup;
CREATE POLICY "team_setup_select" ON event_team_setup FOR SELECT
  USING (
    czy_kapitan_druzyny(event_id, team)
    OR (opublikowana AND czy_w_druzynie(event_id, team))
  );

DROP POLICY IF EXISTS "team_slots_select" ON event_team_slots;
CREATE POLICY "team_slots_select" ON event_team_slots FOR SELECT
  USING (
    czy_kapitan_druzyny(event_id, team)
    OR (czy_taktyka_opublikowana(event_id, team) AND czy_w_druzynie(event_id, team))
  );

COMMENT ON COLUMN event_team_setup.opublikowana IS
  'Czy drużyna widzi taktykę. Kapitan widzi zawsze; reszta dopiero po publikacji — wzorem events.teams_published (migracja 107).';
