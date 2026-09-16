-- ============================================================================
-- 151_zegnaj_stary_turniej.sql — kasuje dawny „BOJO Cup" (migracje 029/030).
-- ----------------------------------------------------------------------------
-- Front zniknął w Etapie 0 tego modułu (`git log` — usunięty 2026-09-13 razem
-- z flagą `SHOW_CUP`). Tabele zostały świadomie, dopóki nowy moduł turniejowy
-- (`turnieje`, `turniej_*`, migracje 145–150) nie zastąpił go w całości —
-- ta migracja jest tym zastąpieniem: Etap 4 domyka moduł i odmraża
-- `SHOW_TURNIEJE`, więc dawny model traci rację bytu.
--
-- URUCHOM ŚWIADOMIE. To kasuje dane, nie tylko schemat — jeśli na produkcji
-- ktokolwiek zdążył założyć „BOJO Cup" przez stary interfejs (mało
-- prawdopodobne, front zniknął tydzień temu, ale nie zerowe), te wiersze
-- przepadają bezpowrotnie. `docs/baza-danych.md` oznacza obie tabele jako
-- MARTWE od Etapu 0 — to jest wykonanie tamtej zapowiedzi, nie nowa decyzja.
--
-- KOLEJNOŚĆ: CASCADE, bo `tournament_matches` odwołuje się do samej siebie
-- (`feeds_a_match_id`/`feeds_b_match_id`) i do `tournament_venue_slots`, która
-- odwołuje się z powrotem do `tournament_matches` (`fk_slot_match`, dodany
-- migracją `029` już po utworzeniu obu tabel) — rozplątywanie ręcznej
-- kolejności DROP-ów nie jest tu warte świecy, skoro i tak wszystko znika.
-- ============================================================================

DROP FUNCTION IF EXISTS admin_team_contacts(uuid);
DROP FUNCTION IF EXISTS tournament_team_count(uuid);
DROP FUNCTION IF EXISTS shared_availability_days(uuid, uuid);

DROP TABLE IF EXISTS tournament_matches CASCADE;
DROP TABLE IF EXISTS tournament_venue_slots CASCADE;
DROP TABLE IF EXISTS tournament_venues CASCADE;
DROP TABLE IF EXISTS tournament_team_members CASCADE;
DROP TABLE IF EXISTS tournament_teams CASCADE;
DROP TABLE IF EXISTS tournament_groups CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
