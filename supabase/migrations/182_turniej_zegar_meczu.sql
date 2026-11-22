-- ============================================================================
-- 182_turniej_zegar_meczu.sql — zegar meczu sterowany przez prowadzącego:
-- start, pauza, koniec połowy, koniec meczu.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Zegar meczu turnieju liczył od `rozpoczety_at`, czyli ruszał
-- w chwili kliknięcia „Prowadź mecz na żywo” i nie dał się zatrzymać
-- (zgłoszenie właściciela 2026-11-22). Na hali mecz zaczyna się, gdy sędzia
-- gwiżdże, bywa przerywany (kontuzja, piłka na trybunach) i ma dwie połowy.
--
-- Stan zegara w trzech kolumnach meczu, bo widzą go także ekran na halę
-- i panel organizatora (inne urządzenia):
--   zegar_od      kiedy ruszył bieżący odcinek gry; NULL = zegar stoi,
--   zegar_sekundy sekundy zebrane w bieżącej połowie przed `zegar_od`,
--   polowa        1 albo 2.
-- Czas gry = zegar_sekundy + (now() - zegar_od, gdy biegnie).
-- `rozpoczety_at` zostaje: to chwila wejścia meczu w tryb na żywo (alerty
-- „mecz trwa za długo”, kolejność).
--
-- Pisze ten sam, kto prowadzi mecz (polityka „Mecz aktualizuje kto go
-- prowadzi”, 146). Same dokładające zmiany, automatem.
-- ============================================================================

ALTER TABLE turniej_mecze
  ADD COLUMN IF NOT EXISTS zegar_od      timestamptz,
  ADD COLUMN IF NOT EXISTS zegar_sekundy integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS polowa        smallint NOT NULL DEFAULT 1;

ALTER TABLE turniej_mecze DROP CONSTRAINT IF EXISTS turniej_mecze_zegar_sekundy_nieujemne;
ALTER TABLE turniej_mecze ADD CONSTRAINT turniej_mecze_zegar_sekundy_nieujemne CHECK (zegar_sekundy >= 0);
ALTER TABLE turniej_mecze DROP CONSTRAINT IF EXISTS turniej_mecze_polowa_1_2;
ALTER TABLE turniej_mecze ADD CONSTRAINT turniej_mecze_polowa_1_2 CHECK (polowa IN (1, 2));
