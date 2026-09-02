-- 127: E-mail gościa, telefon i token przejęcia wpisu przestają być czytelne
--      dla całego internetu.
--
-- KONTEKST. Klucz `anon` siedzi jawnie w paczce JavaScriptu (patrz „Architektura
-- w skrócie" w AGENTS.md), więc jedyną granicą jest baza. Polityka
-- `Participants readable by all` na `event_participants` ma od `004` warunek
-- `USING (true)`, a `getEvent()` czytało skład przez `select('*')`. Razem
-- znaczyło to, że jednym zapytaniem do REST-a — bez logowania, dla DOWOLNEGO
-- meczu, także prywatnego — dało się pobrać:
--
--   • `guest_email`  — adres e-mail osoby, która zapisała się bez konta,
--   • `guest_phone`  — jej numer telefonu,
--   • `phone`        — telefon uczestnika,
--   • `claim_token`  — sekret na okaziciela, którym przejmuje się cudzy wpis,
--   • `confirmation_token` — token potwierdzenia SMS.
--
-- Przy tokenach dało się jeszcze bronić stanowiska „to sekret na okaziciela,
-- model jak `join_code`" (BACKLOG §5). Przy adresach e-mail nie da się: to są
-- dane osobowe ludzi, którzy podali je wyłącznie po to, żeby wejść do składu.
-- Migracja `128` daje dodatkowo temu tokenowi moc WYPISANIA ze składu — czyli
-- bez tej zmiany każdy mógłby wypisywać cudzych graczy. Kolejność nie jest tu
-- przypadkowa.
--
-- DLACZEGO UPRAWNIENIA KOLUMNOWE, A NIE OSOBNA TABELA JAK W `120`.
-- Migracja `120` przeniosła `events.blik_phone` do osobnej tabeli właśnie
-- dlatego, że `REVOKE SELECT (kolumna)` wywróciłby wszystkie `select('*')`
-- w kodzie. Tutaj jest inaczej i to jest cała różnica: `select('*')` na
-- `event_participants` było w całym repo JEDNO (`lib/events.ts`), a żadnej
-- z tych pięciu kolumn nie czyta ani jeden komponent. Przenoszenie ich do
-- tabeli obok kosztowałoby migrację danych i czwarte miejsce, w którym trzeba
-- pamiętać o spójności — przy zerowym zysku.
--
-- KOLEJNOŚĆ WDROŻENIA (ważna, bo migracje puszcza się ręcznie):
--   1. deploy kodu z tego PR-a — `getEvent()` prosi już o jawną listę kolumn,
--      `addGuest()` nie czyta tokenu z wiersza, a `joinEventAsGuest()` nie
--      filtruje po `claim_token`,
--   2. ta migracja.
-- Odwrotna kolejność daje 403 („permission denied for column") na stronie
-- KAŻDEGO meczu, bo `select('*')` prosi o kolumny bez uprawnienia.
--
-- SKUTEK UBOCZNY, KTÓRY JEST ZALETĄ: każde przyszłe `select('*')` na tej
-- tabeli wywali się głośno zamiast po cichu wynieść dane. Nowy kod ma
-- wymieniać kolumny z nazwy.

-- ---------------------------------------------------------------------------
-- 1. Uprawnienia kolumnowe
-- ---------------------------------------------------------------------------
-- Uprawnienia kolumnowe są DODATKOWE do tabelowych: dopóki rola ma SELECT na
-- całej tabeli, `REVOKE SELECT (kolumna)` nie robi nic. Stąd kolejność —
-- najpierw zdejmujemy SELECT z tabeli, potem oddajemy listę kolumn jawnie.
--
-- Puszczalne drugi raz: REVOKE i GRANT są idempotentne z natury.
--
-- `service_role` (funkcje brzegowe) i właściciel schematu zostają nietknięci —
-- `send-event-sms` czyta `phone` i ma działać dalej.
REVOKE SELECT ON event_participants FROM anon, authenticated;

GRANT SELECT (
  id,
  event_id,
  user_id,
  name,
  is_guest,
  created_at,
  has_paid,
  is_reserve,
  team,
  paid_amount,
  is_captain,
  added_by,
  is_goalkeeper,
  pending_approval,
  rsvp,
  payment_method,
  has_sports_card,
  sports_card_provider,
  claim_offered_at,
  claim_passed,
  claimed_at,
  zapisano_at
) ON event_participants TO anon, authenticated;

-- UWAGA przy dokładaniu kolumny do tej tabeli: nowa kolumna NIE jest widoczna
-- dla API, dopóki nie dopiszesz jej do tego GRANT-a. To jest domyślnie
-- bezpieczne i tak ma zostać — ale objawia się jako „pole zawsze puste",
-- więc warto o tym wiedzieć, zanim zacznie się szukać błędu w kodzie.

-- ---------------------------------------------------------------------------
-- 2. Token przejęcia wpisu — przez funkcję, nie przez odczyt wiersza
-- ---------------------------------------------------------------------------
-- Interfejs pokazuje „Zaproś do Bojo" przy wpisie gościa organizatorowi ORAZ
-- osobie, która tego gościa dopisała (`mozeZaprosic()` w EventDetailClient —
-- ustalenie `O-31` z audytu ścieżki organizatora). Ta sama reguła stoi teraz
-- w bazie, więc token wydaje się dokładnie tym dwóm osobom, a nie każdemu,
-- kto otworzy stronę meczu.
--
-- Zwraca NULL zamiast rzucać wyjątkiem: brak uprawnienia i wpis już przejęty
-- to dla wywołującego ta sama sytuacja („nie ma czego wysłać"), a wyjątek
-- w tym miejscu trzeba by łapać w komponencie.
CREATE OR REPLACE FUNCTION token_wpisu_goscia(p_uczestnik uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.claim_token
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.id = p_uczestnik
     AND p.is_guest
     AND p.claimed_at IS NULL
     AND p.user_id IS NULL
     AND (e.organizer_id = auth.uid() OR p.added_by = auth.uid());
$$;

REVOKE ALL ON FUNCTION token_wpisu_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION token_wpisu_goscia(uuid) TO authenticated;

COMMENT ON FUNCTION token_wpisu_goscia(uuid) IS
  'Token przejęcia wpisu gościa dla organizatora meczu albo osoby, która gościa dopisała. NULL, gdy pytający nie ma prawa albo wpis jest już przejęty. Od migracji 127 to jedyna droga do tokenu — kolumna claim_token nie jest czytelna przez API.';
