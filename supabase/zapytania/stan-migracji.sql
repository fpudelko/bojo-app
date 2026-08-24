-- ============================================================
-- KTÓRYCH MIGRACJI BRAKUJE W TEJ BAZIE
-- ============================================================
-- Wklej do Supabase → SQL Editor. Nic nie zmienia, tylko czyta.
--
-- PO CO. `docs/baza-danych.md` mówi wprost: stanu bazy NIE DA SIĘ odczytać
-- z repo, a `list_migrations` na produkcji zwraca pustą listę, bo migracje
-- wklejamy ręcznie. Skutek: jedyną informacją, że czegoś brakuje, jest błąd
-- aplikacji w twarz użytkownika — „Could not find the 'reserve_claim_minutes'
-- column of 'events' in the schema cache" przy zakładaniu meczu, „column …
-- does not exist" przy seedzie. To zapytanie zamienia tę niespodziankę
-- w listę plików do uruchomienia.
--
-- CZEGO NIE SPRAWDZA. Migracji, które zmieniają wyłącznie CIAŁO funkcji
-- (`119`, `122`) — nie zostawiają śladu w schemacie, po którym da się je
-- rozpoznać bez czytania definicji. Ich brak nie wywraca aplikacji, tylko
-- psuje zachowanie powiadomień. Uruchamiaj je razem z resztą.
--
-- DOPISUJĄC MIGRACJĘ, która dodaje tabelę albo kolumnę, dopisz tu wiersz.
-- ============================================================

WITH oczekiwane(plik, obiekt, jest) AS (VALUES
  ('118_rezerwa_czas_w_minutach.sql',        'events.reserve_claim_minutes',
     EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='events'
                AND column_name='reserve_claim_minutes')
     -- Stare ograniczenie CHECK 1..72 znaczy, że `118` przeszła TYLKO w połowie
     -- (sama zmiana nazwy). Patrz nagłówek migracji.
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conrelid='public.events'::regclass
                        AND conname='events_reserve_claim_hours_check')),

  ('120_rozmowa_i_blik_tylko_dla_swoich.sql','tabela event_blik',
     to_regclass('public.event_blik') IS NOT NULL),

  ('121_koniec_blik_phone_w_events.sql',     'events.blik_phone SKASOWANA',
     NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='events'
                    AND column_name='blik_phone')),

  ('123_potwierdzenia_obiektu.sql',          'tabela potwierdzenia_obiektu',
     to_regclass('public.potwierdzenia_obiektu') IS NOT NULL),

  ('124_lista_rezerwowa_opcjonalna.sql',     'events.reserve_enabled',
     EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='events'
                AND column_name='reserve_enabled')),

  ('125_rozmowy_prywatne.sql',               'tabela dm_messages',
     to_regclass('public.dm_messages') IS NOT NULL)
)
SELECT
  CASE WHEN jest THEN '✓ jest' ELSE '✗ BRAKUJE' END AS stan,
  plik,
  obiekt
FROM oczekiwane
ORDER BY jest, plik;

-- ------------------------------------------------------------
-- Po uruchomieniu brakujących migracji: odśwież pamięć podręczną
-- schematu PostgRESTa, inaczej API dalej twierdzi, że kolumny nie ma
-- („… in the schema cache"). Bez tego wygląda to na nieuruchomioną
-- migrację, mimo że przeszła.
-- ------------------------------------------------------------
-- NOTIFY pgrst, 'reload schema';
