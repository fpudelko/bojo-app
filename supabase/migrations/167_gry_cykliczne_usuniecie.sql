-- 167_gry_cykliczne_usuniecie.sql
--
-- Gry cykliczne (stałe gierki) usunięte całkowicie — decyzja właściciela,
-- runda 9 (D-4). Migracja `164` skasowała trójkę funkcji serii i jej
-- wyzwalacz, `166` odpięła dwie funkcje spoza modułu, które go czytały
-- (przypięcie meczu do grupy, usunięcie konta) i cron 'bojo-terminy-serii'.
-- Ta migracja kasuje to, co po tamtych dwóch jeszcze zostaje: SAME DANE —
-- tabele szablonu serii i kolumnę, która do nich wskazywała. RĘCZNA: skaner
-- (`scripts/ryzyko-migracji.mjs`) i tak złapie każdy `DROP TABLE`/`DROP
-- COLUMN` niżej, ten nagłówek tylko to nazywa wprost.
--
-- CO ZOSTAJE W BAZIE PO TEJ MIGRACJI: mecze, które kiedyś były terminami
-- serii, zostają zwykłymi meczami — tracą wyłącznie kolumnę
-- `recurring_event_id`, nie wiersz. Skład, wynik, rozliczenie, historia
-- czatu — nic z tego nie jest powiązane z `recurring_events`, więc nic
-- z tego nie znika.
--
-- `player_stats` (migracja `011`) idzie w tym samym pliku, nie osobno:
-- to tabela wyłącznie dla tego modułu (`recurring_event_id` w jej UNIQUE
-- i w jej jedynej sensownej polityce SELECT), martwa od migracji `043`,
-- która zastąpiła ją funkcją `get_player_stats()` liczącą na żywo z
-- `events`/`event_participants` — bez czytania tej tabeli. Zero wywołań
-- z frontendu poza usuniętym już `lib/eventFeatures.ts`. Rozdzielanie
-- jej usunięcia na osobną migrację nie chroniłoby niczego, co warto
-- chronić osobno.
--
-- KOLEJNOŚĆ MA ZNACZENIE: najpierw kolumna `events.recurring_event_id`
-- (FK DO `recurring_events`), potem tabele, które WSKAZUJĄ na
-- `recurring_events` (`recurring_event_invites`, `player_stats`), na
-- końcu sam szablon. Odwrotna kolejność kończy się błędem klucza obcego.

-- ---------------------------------------------------------------------------
-- 1. Kolumna na `events` — CASCADE zabiera ze sobą oba indeksy z `073`
--    (`idx_events_recurring`, `uniq_events_seria_termin`)
-- ---------------------------------------------------------------------------
ALTER TABLE events DROP COLUMN IF EXISTS recurring_event_id CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Tabele, które wskazują na `recurring_events`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS recurring_event_invites;
DROP TABLE IF EXISTS player_stats;

-- ---------------------------------------------------------------------------
-- 3. Szablon serii
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS recurring_events;
