-- 139 — strażniki przy zmianie terminu + powiadomienie o PRZYWRÓCENIU meczu
--
-- DWIE RZECZY, obie o tym samym: co skład wie o meczu, którego stan właśnie
-- zmienił organizator.
--
-- ---------------------------------------------------------------------------
-- 1. `065` nie miało strażników, które mają `114` i `133`
-- ---------------------------------------------------------------------------
-- `powiadom_o_zmianie_terminu()` (`065`) sprawdzało WYŁĄCZNIE to, czy data albo
-- godzina się zmieniły. Nie sprawdzało ani statusu meczu, ani tego, czy mecz
-- jest jeszcze przed nami — a `114` (miejsce i koszt) sprawdza oba warunki
-- od początku swojego istnienia, `133` (poczta do gości) sprawdza status.
-- Trzy wyzwalacze reagujące na tę samą edycję miały więc trzy różne zdania
-- o tym, kiedy w ogóle wypada się odezwać.
--
-- Co z tego wynikało dla organizatora, w kolejności od najgorszego:
--
--   • poprawienie daty w meczu ODWOŁANYM wysyłało całemu składowi
--     „Zmiana terminu meczu — Nowy termin: …". Ten komunikat czyta się jak
--     „mecz wraca", bo w Bojo nie ma innego powodu, dla którego mecz miałby
--     dostać nowy termin. Ludzie odkręcali plany na mecz, który się nie odbywa;
--   • poprawienie daty meczu z PRZESZŁOŚCI (literówka zauważona po fakcie,
--     porządki przed wpisaniem wyniku) budziło skład powiadomieniem o czymś,
--     co już było.
--
-- Nie zmieniamy tu ani odbiorców, ani treści — wyłącznie dokładamy dwa
-- warunki, słowo w słowo te, które stoją w `114`.
--
-- ---------------------------------------------------------------------------
-- 2. Przywrócenie odwołanego meczu było CICHE
-- ---------------------------------------------------------------------------
-- `070` milczy przy przejściu `cancelled` → `active` i mówi wprost dlaczego:
-- „to nie jest zła wiadomość, a przy okazji ratuje przed dublem, gdyby
-- organizator odwołał i przywrócił dwa razy". Pierwsza połowa tego argumentu
-- nie broni się z miejsca, w którym stoi skład: te dziesięć osób dostało
-- wcześniej „Mecz odwołany" i porobiło inne plany. Cisza przy przywróceniu
-- znaczy dla nich dokładnie tyle, co brak meczu — z tą różnicą, że mecz jest,
-- a organizator liczy na komplet.
--
-- Aplikacja tę drogę wprost ZACHĘCA: okno odwołania mówi „Możesz go przywrócić
-- tym samym panelem". Zachęcaliśmy więc do drogi, której druga połowa nie
-- działała.
--
-- Druga połowa argumentu z `070` — ochrona przed dublem — zostaje i jest tu
-- rozwiązana dwoma sposobami naraz:
--
--   a) ODBIORCAMI SĄ DOKŁADNIE CI, KTÓRZY DOSTALI `mecz_odwolany` dla tego
--      meczu. Nie „wszyscy uczestnicy": kto dołączył już po odwołaniu (mecz
--      odwołany wciąż da się otworzyć z linku), nigdy nie widział złej
--      wiadomości i nie ma go po co prostować. To jest jednocześnie naturalny
--      dedup — bez tej listy nie ma komu wysłać;
--   b) `NOT EXISTS` na (użytkownik, mecz, typ) w obrębie doby `dzis_pl()`,
--      wzorem `129`. Seria odwołaj/przywróć w jedno popołudnie daje jedno
--      powiadomienie, nie pięć.
--
-- OSOBNA FUNKCJA I OSOBNY WYZWALACZ, `070` nietknięte — ta sama zasada, dla
-- której `133` nie przepisywało `065`/`070`/`114`, tylko stanęło obok: każda
-- przepisana linia to okazja, żeby coś zgubić.
--
-- ---------------------------------------------------------------------------
-- 3. Poczta do gości też ma znać przywrócenie
-- ---------------------------------------------------------------------------
-- `powiadom_gosci_o_zmianie_meczu()` (`133`) rozpoznaje dziś `odwolanie`
-- i `zmiana`, ale przejście `cancelled` → `active` wypada mu przez sito:
-- pierwsza gałąź wymaga przejścia W odwołanie, druga porównuje datę, miejsce
-- i koszt — a przy samym przywróceniu żadne z tych pól się nie zmienia.
-- Gość bez konta dostawał więc mail „mecz odwołany" i nic więcej, na zawsze.
--
-- Dokładamy przywrócenie jako powód `zmiana` — istniejący szablon w funkcji
-- brzegowej mówi o zmianie w meczu i odsyła do wpisu, więc treść ma pokrycie.
-- Nowego powodu i nowego szablonu świadomie NIE dokładamy: to wymaga wdrożenia
-- funkcji brzegowej, a ta migracja ma dać się puścić samodzielnie.
--
-- MIGRACJA JEST IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Strażniki w `powiadom_o_zmianie_terminu` (ciało z `065`, zmieniony
--    WYŁĄCZNIE warunek wejścia)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zmianie_terminu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.event_time IS NOT DISTINCT FROM OLD.event_time THEN
    RETURN NEW;
  END IF;

  -- DWA WARUNKI DOŁOŻONE W `139`, słowo w słowo te z `114`.
  -- `dzis_pl()` (migracja `130`), nie gołe `current_date`: baza stoi na UTC,
  -- więc po 22:00 czasu polskiego `current_date` wskazuje jeszcze dzień
  -- poprzedni i mecz „dzisiejszy” wyglądałby na wczorajszy.
  IF NEW.status = 'cancelled' OR NEW.event_date < dzis_pl() THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  -- Dostają wszyscy związani z meczem, także rezerwowi i obserwujący: zmiana
  -- terminu unieważnia ich plany tak samo jak plany grających. Organizator nie,
  -- bo to on ją wprowadził.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'zmiana_terminu',
         'Zmiana terminu meczu',
         'Nowy termin: ' || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || ' — ' || coalesce(v_tytul, 'mecz') || '.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

-- Wyzwalacz odtworzony, żeby migracja działała także na bazie, na której
-- `065` nigdy nie poszło (`baza-testowa.sh` puszcza wszystko od zera).
DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_terminu ON events;
CREATE TRIGGER trg_powiadom_o_zmianie_terminu
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zmianie_terminu();

-- ---------------------------------------------------------------------------
-- 2. Przywrócenie odwołanego meczu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_przywroceniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  -- Wyłącznie przejście „odwołany” → „cokolwiek innego”.
  IF OLD.status IS DISTINCT FROM 'cancelled' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Mecz z przeszłości przywraca się do porządków (wynik, rozliczenie), nie
  -- po to, żeby ktoś na niego przyjechał.
  IF NEW.event_date < dzis_pl() THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT n.user_id,
         'mecz_przywrocony',
         'Mecz jednak się odbędzie',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI')
           || '. Organizator cofnął odwołanie.',
         NEW.id
    FROM notifications n
   WHERE n.event_id = NEW.id
     AND n.type = 'mecz_odwolany'
     AND n.user_id <> NEW.organizer_id
     -- Jedno powiadomienie o przywróceniu na dobę, wzorem `129`: seria
     -- odwołaj/przywróć w jedno popołudnie nie ma prawa zamienić się w serię
     -- powiadomień.
     AND NOT EXISTS (
           SELECT 1 FROM notifications m
            WHERE m.user_id = n.user_id
              AND m.event_id = NEW.id
              AND m.type = 'mecz_przywrocony'
              AND (m.created_at AT TIME ZONE 'Europe/Warsaw')::date = dzis_pl());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_przywroceniu ON events;
CREATE TRIGGER trg_powiadom_o_przywroceniu
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_przywroceniu();

-- ---------------------------------------------------------------------------
-- 3. Poczta do gości rozpoznaje przywrócenie (ciało z `133`, dołożona jedna
--    gałąź warunku)
-- ---------------------------------------------------------------------------
-- Ciało w całości z `133`; jedyna różnica to gałąź `cancelled` → aktywny.
-- Wywołanie `wyslij_mail_do_goscia()` rozwiązuje się przy URUCHOMIENIU
-- wyzwalacza, nie przy tworzeniu funkcji, więc ta sekcja nie wymaga strażnika
-- na obecność `133`: migracje idą po kolei, a `baza-testowa.sh` puszcza je
-- wszystkie od zera.
CREATE OR REPLACE FUNCTION powiadom_gosci_o_zmianie_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_powod TEXT;
  v_g     RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    v_powod := 'odwolanie';
  -- GAŁĄŹ DOŁOŻONA W `139`: przywrócenie. Musi stać PRZED porównaniem pól,
  -- bo przy samym cofnięciu odwołania żadne z nich się nie zmienia.
  ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
    v_powod := 'zmiana';
  ELSIF NEW.status <> 'cancelled'
        AND (NEW.event_date IS DISTINCT FROM OLD.event_date
          OR NEW.event_time IS DISTINCT FROM OLD.event_time
          OR NEW.field_name IS DISTINCT FROM OLD.field_name
          OR NEW.custom_location_name IS DISTINCT FROM OLD.custom_location_name
          OR NEW.cost_grosz IS DISTINCT FROM OLD.cost_grosz) THEN
    v_powod := 'zmiana';
  ELSE
    RETURN NEW;
  END IF;

  FOR v_g IN
    SELECT p.id FROM event_participants p
     WHERE p.event_id = NEW.id AND p.is_guest
       AND p.guest_email IS NOT NULL AND p.claimed_at IS NULL
  LOOP
    PERFORM wyslij_mail_do_goscia(v_g.id, v_powod);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_gosci_o_zmianie_meczu ON events;
CREATE TRIGGER trg_powiadom_gosci_o_zmianie_meczu
  AFTER UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_gosci_o_zmianie_meczu();

COMMENT ON FUNCTION powiadom_o_przywroceniu() IS
  'Powiadamia o cofnięciu odwołania meczu — DOKŁADNIE te osoby, które dostały mecz_odwolany dla tego meczu, najwyżej raz na dobę (migracja 139).';
