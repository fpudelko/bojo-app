-- 123: Lista rezerwowa staje się WYBOREM organizatora, nie stałą regułą.
--
-- PO CO. Kreator mówił pod licznikiem miejsc: „Kolejni chętni trafią na listę
-- rezerwową." — zdanie o zachowaniu, którego nie dało się zmienić. Zaraz pod
-- spodem stało jeszcze ustawienie „Czas na decyzję z rezerwy", czyli reguła
-- rozdawania zwolnionych miejsc. Organizator, który rezerwy nie chce (mecz na
-- zamkniętą ekipę, hala opłacona z góry, ustalona dwunastka), musiał ją mimo
-- wszystko mieć i tłumaczyć ludziom, dlaczego zapisali się „na listę".
--
-- Od tej migracji rezerwa jest przełącznikiem. DEFAULT TRUE, bo dla wszystkich
-- istniejących meczów zachowanie ma zostać dokładnie takie, jakie było —
-- migracja niczego nikomu nie wyłącza.
--
-- CO ZNACZY „WYŁĄCZONA". Przy komplecie nikt nie ląduje na rezerwie: mecz jest
-- po prostu zamknięty, a organizator, który chce więcej ludzi, podnosi liczbę
-- miejsc. Istniejące wpisy `is_reserve = true` NIE są kasowane — wyłączenie
-- rezerwy na meczu, który już ma kolejkę, nie może po cichu usunąć ludziom
-- ich miejsca w niej. Kolejka zostaje widoczna, tylko nikt nowy do niej nie
-- wejdzie.
--
-- Kolumna `reserve_claim_minutes` zostaje bez zmian: przy wyłączonej rezerwie
-- po prostu nie ma czego rozdawać, a przy ponownym włączeniu wraca wcześniej
-- ustawiona wartość zamiast domyślnej.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reserve_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN events.reserve_enabled IS
  'Czy przy komplecie chętni trafiają na listę rezerwową (migracja 123). false = mecz przy komplecie jest zamknięty. Istniejące wpisy is_reserve zostają — wyłączenie nie kasuje kolejki, która już powstała.';
