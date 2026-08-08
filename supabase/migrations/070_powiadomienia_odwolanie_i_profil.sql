-- 070_powiadomienia_odwolanie_i_profil.sql
--
-- Dwa zdarzenia, o których użytkownik dotąd nie miał jak się dowiedzieć.
--
-- 1. ODWOŁANIE MECZU BYŁO CICHE. `cancelEvent()` (lib/events.ts) zmieniało
--    `status` i logowało aktywność — i tyle. Uczestnik dowiadywał się o tym
--    WYŁĄCZNIE wchodząc na stronę meczu i widząc czerwony baner. Kto nie wszedł,
--    przyjeżdżał na boisko. To jedyne miejsce, w którym Bojo było obiektywnie
--    gorsze od zwykłej wiadomości na czacie — i najgorsze możliwe, bo dotyczy
--    zaufania do narzędzia („czy oni w ogóle będą wiedzieć?").
--
-- 2. KONTO BEZ NAZWY publikuje mecz pod nazwą wyprowadzoną z adresu e-mail.
--    Rejestracja e-mailem wymaga już imienia i nazwiska (walidacja w AuthForm),
--    ale konto z Google, którego profil nie niesie `full_name`, wciąż wpada
--    w ten przypadek. Powiadomienie kieruje takiego człowieka do /profil.
--
-- Dlaczego wyzwalacze, a nie kod aplikacji — powód identyczny jak w migracji
-- `065`: tabela `notifications` (migracja `025`) ma politykę SELECT i UPDATE dla
-- własnych wierszy i NIE MA ŻADNEJ polityki INSERT. Przeglądarka nie może więc
-- wpisać powiadomienia nikomu, nawet sobie. Funkcja `SECURITY DEFINER` jest
-- jedynym miejscem, w którym da się to zrobić bez otwierania tabeli na oścież.
-- Przy okazji działa niezależnie od tego, którędy przyszła zmiana — z aplikacji,
-- z panelu Supabase czy ze skryptu.
--
-- Kanał: skrzynka w aplikacji (dzwonek), ta sama co `025`, `062`, `065` i `067`.

-- ---------------------------------------------------------------------------
-- 1. Organizator odwołał mecz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_odwolaniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  -- Wyłącznie przejście „cokolwiek innego" → „odwołany". Przywrócenie meczu
  -- (`cancelled` → `active`) nie wysyła nic: to nie jest zła wiadomość, a przy
  -- okazji ratuje przed dublem, gdyby organizator odwołał i przywrócił dwa razy.
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  -- Dostają wszyscy związani z meczem, także rezerwowi i obserwujący —
  -- odwołanie unieważnia ich plany dokładnie tak samo jak plany grających.
  -- Organizator nie, bo to on je wprowadził. Goście bez konta odpadają sami
  -- (`user_id IS NULL`); ich powiadomi ten, kto ich dopisał.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'mecz_odwolany',
         'Mecz odwołany',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI')
           || '. Organizator odwołał ten mecz.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_odwolaniu ON events;
CREATE TRIGGER trg_powiadom_o_odwolaniu
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_odwolaniu();

-- ---------------------------------------------------------------------------
-- 2. Nowe konto bez imienia i nazwiska
-- ---------------------------------------------------------------------------
-- Kolejność względem `on_auth_user_created` (migracja `022`, zakłada wiersz
-- w `profiles`): PostgreSQL odpala wyzwalacze tego samego zdarzenia w kolejności
-- alfabetycznej nazw, a `on_auth_user_created` < `trg_powiadom_o_braku_nazwy`,
-- więc profil powstaje pierwszy. Nie zależymy od tego — piszemy tylko do
-- `notifications` — ale zapisujemy, żeby nikt nie musiał tego wyprowadzać.
--
-- Klucz obcy `notifications.user_id → auth.users` jest spełniony, bo wyzwalacz
-- jest AFTER INSERT na tym samym wierszu.
CREATE OR REPLACE FUNCTION powiadom_o_braku_nazwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(coalesce(
       NEW.raw_user_meta_data ->> 'display_name',
       NEW.raw_user_meta_data ->> 'full_name',
       NEW.raw_user_meta_data ->> 'name',
       '')) <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'uzupelnij_profil',
    'Uzupełnij swoje imię',
    'Gracze zobaczą Cię pod nazwą wyprowadzoną z adresu e-mail. Wpisz imię i nazwisko w profilu.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_braku_nazwy ON auth.users;
CREATE TRIGGER trg_powiadom_o_braku_nazwy
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_braku_nazwy();

-- ŚWIADOMIE BEZ UZUPEŁNIANIA WSTECZ. Konta, które już istnieją, obsługuje baner
-- na pulpicie (`components/home/dashboard/UzupelnijProfilBanner.tsx`) — pokazuje
-- się każdemu bez nazwy, nie tylko nowym. Wysłanie powiadomienia wszystkim
-- zaległym kontom naraz byłoby hałasem w skrzynce, nie informacją.
