-- 064_usun_statusy_uczestnika.sql
--
-- Usuwa oś „status uczestnika" (`zaproszony` / `potwierdzony` / `odrzucony` /
-- `brak_odpowiedzi`) razem ze śledzeniem obecności, które było jej jedynym
-- interfejsem.
--
-- Dlaczego. Bojo opisuje relację gracza do meczu DWOMA polami, które liczymy
-- przy każdym zapisie: `pending_approval` (czy organizator już przepuścił)
-- oraz `rsvp` (`yes` = gram, `maybe` = obserwuję). Kolumna `status` opowiadała
-- tę samą historię trzeci raz, własnym słownikiem, i nikt jej nie utrzymywał
-- w zgodzie z tamtymi dwoma: gracz mógł być `potwierdzony` i jednocześnie
-- czekać na akceptację. Organizator dostawał listę rozwijaną, która niczego
-- nie zmieniała poza samą sobą.
--
-- `events.track_attendance` włączało sekcję „Potwierdzenia" i nic poza tym,
-- więc po usunięciu statusów nie ma czego włączać.
--
-- Kolumny są kasowane, nie ukrywane. Zostawiona kolumna, której nikt nie pisze,
-- po kilku miesiącach wygląda jak dane — a jest śmieciem sprzed decyzji.

ALTER TABLE event_participants DROP COLUMN IF EXISTS status;
ALTER TABLE event_participants DROP COLUMN IF EXISTS confirmed_at;

ALTER TABLE events DROP COLUMN IF EXISTS track_attendance;
