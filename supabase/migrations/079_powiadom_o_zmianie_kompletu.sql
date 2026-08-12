-- 079_powiadom_o_zmianie_kompletu.sql
--
-- Organizator nie dowiadywał się o dwóch zdarzeniach, które są dla niego
-- najważniejsze w całym cyklu życia meczu:
--
--   1. ZEBRAŁ SIĘ KOMPLET — moment, w którym przestaje szukać ludzi.
--   2. KTOŚ SIĘ WYPISAŁ Z KOMPLETNEGO SKŁADU — moment, w którym musi szukać od
--      nowa. Na czacie WhatsApp to widoczna wiadomość; w Bojo była cisza aż do
--      chwili, gdy organizator sam z siebie otworzył stronę meczu. Kto nie
--      wszedł, przyjeżdżał na boisko w dziesiątkę.
--
-- Powiadamiamy o ZMIANIE STANU „komplet / niekomplet", w obie strony — nie
-- o pojedynczym zapisie. Przy domyślnym składzie 14 osób ping przy każdym
-- zapisie dałby kilkanaście wpisów pod dzwonkiem na jeden mecz i zagłuszył te
-- dwa, które naprawdę wymagają reakcji.
--
-- Licznik celowo NIE zna trybu miejsc dla bramkarzy (`077`,
-- goalkeeper_slots_reserved) ani wspólnej reguły rezerwy (`078`,
-- czy_na_rezerwe). Liczy dokładnie to, co liczy interfejs organizatora —
-- `regulars.length` na stronie meczu (potwierdzone i nierezerwowe wpisy) —
-- bo to jest liczba, którą organizator ma na ekranie i z którą porównuje
-- powiadomienie. Osobna, dokładniejsza reguła dla ról dałaby powiadomienie
-- niespójne z tym, co widać na stronie.
--
-- Wyzwalacz, nie kod aplikacji — powód identyczny jak w `065`, `070` i `072`:
-- `notifications` (`025`) nie ma polityki INSERT, bo powiadomienie zawsze pisze
-- się KOMU INNEMU niż ten, kto wywołał akcję. Jeden wyzwalacz na
-- INSERT/UPDATE/DELETE łapie wszystkie drogi do zmiany składu naraz — zwykły
-- zapis (`dolacz_do_meczu`, `078`), akceptację prośby (`approveParticipant`),
-- przyjęcie zwolnionego miejsca (`acceptReserveClaim`), usunięcie gracza
-- i rezygnację — zamiast wołania z każdego miejsca osobno.
--
-- Kanał: skrzynka w aplikacji (dzwonek), ta sama co `025`, `062`, `065`, `067`,
-- `070`, `072`, `076`.

CREATE OR REPLACE FUNCTION powiadom_o_zmianie_kompletu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id     UUID;
  v_organizer_id UUID;
  v_tytul        TEXT;
  v_data         DATE;
  v_godz         TIME;
  v_status       TEXT;
  v_max          INT;
  v_po           INT;
  v_przed        INT;
  v_rezerwa      INT;
  v_imie         TEXT;
BEGIN
  -- W wyzwalaczu DELETE zmienna NEW nie jest przypisana — nie wolno jej dotknąć.
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id; ELSE v_event_id := NEW.event_id; END IF;

  SELECT organizer_id, coalesce(title, sport), event_date, event_time, status, max_players
    INTO v_organizer_id, v_tytul, v_data, v_godz, v_status, v_max
    FROM events WHERE id = v_event_id;

  -- Brak wiersza meczu = kaskada z `DELETE FROM events`; poza tym mecz odwołany
  -- albo miniony — zmiana składu nikogo już nie obchodzi.
  IF v_organizer_id IS NULL OR v_status <> 'active' OR v_data < current_date THEN
    RETURN NULL;
  END IF;

  -- Organizator sam zmienił skład (usunął gracza, przyjął prośbę, dopisał
  -- gościa) — wie o tym, bo właśnie to zrobił.
  IF auth.uid() IS NOT NULL AND auth.uid() = v_organizer_id THEN
    RETURN NULL;
  END IF;

  -- Liczymy dokładnie to, co liczy interfejs (`regulars`): wpisy potwierdzone
  -- i nierezerwowe. „Obserwuję" (`rsvp = 'maybe'`) jest zapisywane jako rezerwa,
  -- więc odpada samo.
  SELECT count(*) INTO v_po
    FROM event_participants
   WHERE event_id = v_event_id
     AND pending_approval IS NOT TRUE
     AND is_reserve IS NOT TRUE;

  -- Stan sprzed operacji: wyzwalacz AFTER widzi już nowy stan tabeli, więc
  -- wystarczy cofnąć wkład tego jednego wiersza, którego operacja dotyczyła.
  v_przed := v_po;
  IF TG_OP <> 'INSERT' AND OLD.pending_approval IS NOT TRUE AND OLD.is_reserve IS NOT TRUE THEN
    v_przed := v_przed + 1;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.pending_approval IS NOT TRUE AND NEW.is_reserve IS NOT TRUE THEN
    v_przed := v_przed - 1;
  END IF;

  -- ── Niekomplet → komplet ─────────────────────────────────────────────────
  IF v_przed < v_max AND v_po >= v_max THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (v_organizer_id, 'komplet_skladu', 'Masz komplet',
      coalesce(v_tytul, 'Mecz') || ' — ' || to_char(v_data, 'DD.MM')
        || ', godz. ' || to_char(v_godz, 'HH24:MI') || '. Skład jest pełny: '
        || v_po || ' z ' || v_max || '.',
      v_event_id);
    RETURN NULL;
  END IF;

  -- ── Komplet → niekomplet ─────────────────────────────────────────────────
  IF v_przed >= v_max AND v_po < v_max THEN
    -- Kto realnie czeka w kolejce: bez „obserwuję", bez czekających na
    -- akceptację i bez tych, którzy już raz miejsce przepuścili.
    SELECT count(*) INTO v_rezerwa
      FROM event_participants
     WHERE event_id = v_event_id
       AND is_reserve IS TRUE
       AND pending_approval IS NOT TRUE
       AND rsvp <> 'maybe'
       AND claim_passed IS NOT TRUE;

    v_imie := coalesce(CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END, 'Ktoś');

    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (v_organizer_id, 'zwolnilo_sie_miejsce', 'Zwolniło się miejsce',
      v_imie || ' wypisał(a) się z meczu: ' || coalesce(v_tytul, 'Mecz') || ' — '
        || to_char(v_data, 'DD.MM') || ', godz. ' || to_char(v_godz, 'HH24:MI')
        || '. Skład: ' || v_po || ' z ' || v_max || '. '
        || CASE WHEN v_rezerwa > 0
                THEN 'Miejsce trafia do pierwszej osoby z rezerwy (czeka ich ' || v_rezerwa || ').'
                ELSE 'Nie ma nikogo na rezerwie — trzeba znaleźć zmiennika.' END,
      v_event_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_kompletu ON event_participants;
CREATE TRIGGER trg_powiadom_o_zmianie_kompletu
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zmianie_kompletu();
