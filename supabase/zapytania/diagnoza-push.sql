-- ============================================================
-- DIAGNOZA PUSHA — „mam apkę, dałem zgodę, a powiadomienie nie przyszło"
-- ============================================================
-- Wklej całość w Supabase → SQL Editor. Same SELECT-y, nic nie zmienia.
--
-- Po co osobny plik: „nie przyszło" ma cztery różne przyczyny, a każda wymaga
-- innej naprawy. Te pięć zapytań rozdziela je jednoznacznie — od góry do dołu
-- idzie się drogą, którą pokonuje powiadomienie:
--
--   powstało w bazie? → jest komu wysłać? → baza umie zadzwonić? → zadzwoniła?
--
-- Podmień adres e-mail w pierwszej linii, jeśli sprawdzasz inne konto.
-- ============================================================

-- 1. CZY POWIADOMIENIE W OGÓLE POWSTAŁO
--    Jeśli tu pusto, push nie ma z czym startować — problem jest w regułach
--    tworzenia powiadomień, a nie w wysyłce. To najczęstszy przypadek przy
--    „zwolniło się miejsce": ofertę dostaje PIERWSZA osoba z kolejki rezerwowej,
--    a nie każdy, kto patrzy na mecz.
SELECT n.created_at, n.type, n.title, n.body
FROM notifications n
JOIN auth.users u ON u.id = n.user_id
WHERE u.email = 'franciszekpudelko@gmail.com'
ORDER BY n.created_at DESC
LIMIT 10;

-- 2. CZY JEST DOKĄD WYSŁAĆ
--    Jedna subskrypcja = jedna przeglądarka. Apka z ekranu głównego na iPhonie
--    to OSOBNA subskrypcja niż ta sama strona otwarta w Safari — zgoda wyklikana
--    w Safari nie działa dla apki i odwrotnie.
SELECT ps.created_at, ps.last_ok_at, left(ps.endpoint, 45) AS endpoint, ps.przegladarka
FROM push_subscriptions ps
JOIN auth.users u ON u.id = ps.user_id
WHERE u.email = 'franciszekpudelko@gmail.com'
ORDER BY ps.created_at DESC;

-- 3. CZY BAZA WIE, GDZIE DZWONIĆ
--    Brak któregokolwiek wiersza = wyzwalacz wychodzi po cichu (tak ma być:
--    kanał dodatkowy nie może wywrócić zapisu powiadomienia w aplikacji).
SELECT klucz, CASE WHEN klucz = 'sekret' THEN '(ustawiony)' ELSE wartosc END AS wartosc
FROM konfiguracja_push;

-- 4. CZY ROZSZERZENIE DO DZWONIENIA JEST WŁĄCZONE
SELECT extname AS rozszerzenie FROM pg_extension WHERE extname = 'pg_net';

-- 5. CO ODPOWIEDZIAŁA FUNKCJA
--    Tu widać prawdę o samej wysyłce:
--      200 + {"wyslane":1}  → poszło, problem jest po stronie telefonu
--      200 + {"wyslane":0}  → nie było subskrypcji dla tego użytkownika
--      401                  → rozjazd BOJO_PUSH_SEKRET z tabelą konfiguracja_push
--                             ALBO funkcja wdrożona BEZ --no-verify-jwt
--      404                  → zły adres w konfiguracja_push
--      brak wierszy         → wyzwalacz nie zadzwonił (patrz 3 i 4)
SELECT created, status_code, left(content, 200) AS odpowiedz, error_msg
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
