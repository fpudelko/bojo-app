-- Diagnostyka: dlaczego seria cykliczna nie utworzyła terminu na 16.08?
--
-- Hipoteza: migracja 073 planuje zadanie `bojo-terminy-serii` w pg_cron, ale
-- cały blok jest warunkowy — bez włączonego rozszerzenia migracja wypisuje
-- tylko NOTICE i przechodzi dalej. Funkcja `utworz_nalezne_terminy_serii()`
-- wtedy istnieje, tylko nikt jej nie woła.

-- 1. Czy rozszerzenie pg_cron jest w ogóle zainstalowane?
SELECT 'pg_cron zainstalowany' AS pytanie,
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS odpowiedz;

-- 2. Czy funkcja tworząca terminy istnieje?
SELECT 'funkcja utworz_nalezne_terminy_serii' AS pytanie,
       EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'utworz_nalezne_terminy_serii'
       ) AS odpowiedz;

-- 3. Zaplanowane zadania crona (pusto = nic się nie uruchamia samo).
--    Owinięte w DO, żeby brak schematu `cron` nie wywrócił całego zapytania.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'Schemat cron istnieje — lista zadań w kolejnym wyniku.';
  ELSE
    RAISE NOTICE 'BRAK schematu cron — pg_cron niewłączony, terminy serii NIE powstają automatycznie.';
  END IF;
END $$;

-- 4. Aktywne szablony serii i termin, który powinien już powstać.
SELECT r.id,
       r.name,
       r.day_of_week,
       r.event_time,
       r.notify_days_before,
       r.is_active,
       (SELECT count(*) FROM events e WHERE e.recurring_event_id = r.id) AS utworzone_terminy,
       (SELECT max(e.event_date) FROM events e WHERE e.recurring_event_id = r.id) AS ostatni_termin
FROM recurring_events r
ORDER BY r.is_active DESC, r.name;
