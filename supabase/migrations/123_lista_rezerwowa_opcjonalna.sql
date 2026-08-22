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

-- ---------------------------------------------------------------------------
-- Bramka po stronie BAZY, nie interfejsu
-- ---------------------------------------------------------------------------
-- Bojo nie ma własnego backendu, a klucz `anon` siedzi jawnie w paczce JS —
-- schowanie przycisku w kreatorze nie jest żadną regułą. Reguła musi stać tu.
--
-- WYZWALACZ, a nie poprawka w `dolacz_do_meczu()`. Na rezerwę wchodzi się
-- kilkoma drogami: `dolacz_do_meczu()` (078, nadpisywane w 087 i 088),
-- akceptacja prośby, dopisanie gościa bez konta, przeniesienie przez
-- organizatora. Przepisywanie każdej z nich znaczyłoby cztery miejsca, w
-- których ta sama reguła może się rozjechać; wyzwalacz na tabeli łapie
-- wszystkie, także te dopisane w przyszłości.
--
-- Obejmuje INSERT i UPDATE: organizator nie powinien móc przenieść kogoś na
-- rezerwę meczu, który rezerwy nie prowadzi. Wpisy, które JUŻ są rezerwowe,
-- nie są ruszane — wyzwalacz patrzy wyłącznie na wiersze, które rezerwowe
-- SIĘ STAJĄ.
--
-- WYJĄTEK NA `rsvp = 'maybe'` NIE JEST DROBIAZGIEM. Obserwujący („Obserwuj"
-- na stronie meczu) siedzi w bazie z `is_reserve = true` — to sztuczka, żeby
-- nie zajmował miejsca w składzie, a nie deklaracja gry. Bez tego wyjątku
-- wyłączenie listy rezerwowej wyłączałoby przy okazji OBSERWOWANIE, czyli
-- funkcję, która z rezerwą nie ma nic wspólnego i istnieje właśnie po to,
-- żeby chcieć śledzić mecz bez blokowania komuś miejsca.

CREATE OR REPLACE FUNCTION pilnuj_wylaczonej_rezerwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = NEW.event_id AND reserve_enabled
  ) THEN
    RAISE EXCEPTION 'Ten mecz nie prowadzi listy rezerwowej — przy komplecie zapisy są zamknięte.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilnuj_wylaczonej_rezerwy ON event_participants;
CREATE TRIGGER trg_pilnuj_wylaczonej_rezerwy
  BEFORE INSERT OR UPDATE OF is_reserve ON event_participants
  FOR EACH ROW
  WHEN (NEW.is_reserve AND NEW.rsvp <> 'maybe')
  EXECUTE FUNCTION pilnuj_wylaczonej_rezerwy();

COMMENT ON FUNCTION pilnuj_wylaczonej_rezerwy() IS
  'Nie wpuszcza nikogo na listę rezerwową meczu z reserve_enabled = false (migracja 123). Wyzwalacz zamiast poprawki w dolacz_do_meczu(), bo na rezerwę wchodzi się kilkoma drogami.';
