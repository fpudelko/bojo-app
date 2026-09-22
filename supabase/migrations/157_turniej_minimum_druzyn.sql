-- 157: opcjonalne MINIMUM drużyn w turnieju.
--
-- DLACZEGO OPCJONALNE, A NIE Z WARTOŚCIĄ DOMYŚLNĄ: minimum jest informacją
-- organizatora dla kapitanów („poniżej czterech drużyn nie ma po co grać"),
-- a nie warunkiem, który aplikacja ma egzekwować. Wartość domyślna zrobiłaby
-- z tego regułę, której nikt nie ustawił, i postawiła Bojo w roli arbitra
-- decydującego, czy turniej się odbędzie. Tę samą decyzję podjęliśmy już raz
-- dla meczów, wyłączając `SHOW_MIN_PLAYERS_THRESHOLD` (2026-08-21): werdykt
-- „gra się odbędzie / brakuje N" mówił organizatorowi, co ma myśleć, zamiast
-- podać mu liczbę. NULL znaczy tu „organizator nie podał", i to jest inny
-- stan niż „podał zero".
--
-- Górna granica pilnowana względem `max_druzyn`, nie liczbą wprost: minimum
-- większe od maksimum jest turniejem, do którego nie da się zapisać.
ALTER TABLE turnieje
  ADD COLUMN IF NOT EXISTS min_druzyn int;

-- Osobno od ADD COLUMN, żeby migracja dała się puścić drugi raz także wtedy,
-- gdy kolumna powstała, a ograniczenie nie (patrz AGENTS.md: „migracja
-- przerwana w połowie zostaje w połowie").
ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS turnieje_minimum_sensowne;
ALTER TABLE turnieje
  ADD CONSTRAINT turnieje_minimum_sensowne
  CHECK (min_druzyn IS NULL OR (min_druzyn BETWEEN 2 AND 64 AND min_druzyn <= max_druzyn));

COMMENT ON COLUMN turnieje.min_druzyn IS
  'Opcjonalne minimum drużyn podane przez organizatora. NULL = nie podał. '
  'Informacja dla kapitanów, nie warunek egzekwowany przez aplikację.';
