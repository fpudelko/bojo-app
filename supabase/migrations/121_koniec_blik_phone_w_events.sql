-- 121: Kasuje `events.blik_phone` — to ta migracja faktycznie zamyka wyciek.
--
-- URUCHOM DOPIERO PO WDROŻENIU FRONTENDU z tego samego PR-a. Kolejność
-- i uzasadnienie: patrz nagłówek migracji `120`. Skrótowo:
--   `120` → deploy → `121`.
--
-- Do tego momentu numer siedzi w DWÓCH miejscach: w `event_blik` (z polityką)
-- i w starej kolumnie `events.blik_phone`, którą czyta każdy — bo `events` ma
-- politykę SELECT `USING (true)`. Kopia w `event_blik` powstała w `120`,
-- frontend po deployu pisze i czyta wyłącznie ją, więc tutaj zostaje sama
-- czynność kasowania.
--
-- Po `121` `select('*')` na `events` przestaje zwracać `blik_phone`. Nic
-- w kodzie o tę kolumnę nie pyta: `toEvent()` czyta `event_blik`, a jedyny
-- zapis spoza klienta — `event_set_payment_settings()` — przeadresowała
-- migracja `120`.

-- Zabezpieczenie przed puszczeniem tego za wcześnie: gdyby w `events` siedział
-- numer, którego nie ma w `event_blik` (np. ktoś zapisał go starym frontendem
-- między `120` a deployem), dokładamy go, zamiast skasować razem z kolumną.
INSERT INTO event_blik (event_id, blik_phone)
SELECT id, blik_phone FROM events
 WHERE blik_phone IS NOT NULL AND btrim(blik_phone) <> ''
ON CONFLICT (event_id) DO NOTHING;

ALTER TABLE events DROP COLUMN IF EXISTS blik_phone;
