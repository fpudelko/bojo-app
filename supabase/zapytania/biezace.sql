-- Czy da się wysłać HTTP z bazy: potrzebne do wyzwalacza `notifications` → `send-push`.
-- Jeśli `pg_net` jest zainstalowany, wyzwalacz wchodzi do migracji i właściciel
-- nie musi nic klikać. Jeśli nie — trzeba włączyć Database Webhook w panelu.
SELECT
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_net')  AS pg_net_zainstalowany,
  (SELECT count(*) FROM pg_available_extensions WHERE name = 'pg_net') AS pg_net_dostepny,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_zainstalowany;
