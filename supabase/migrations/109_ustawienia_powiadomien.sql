-- 109: Ustawienia powiadomień + powiadomienia o wiadomościach.
--
-- DWIE RZECZY, bo bez drugiej pierwsza byłaby pusta w najważniejszym miejscu:
-- „wiadomości w meczu" i „wiadomości w ekipie" NIE MIAŁY dotąd żadnego
-- powiadomienia. Nieprzeczytane liczyła sama przeglądarka (znacznik „ostatnio
-- widziano" w `localStorage`), więc o nowej wiadomości dowiadywał się tylko
-- ten, kto i tak otworzył aplikację. Nie było czego wyłączać ani włączać.
--
-- ---------------------------------------------------------------------------
-- 1. Ustawienia — czego NIE wysyłać
-- ---------------------------------------------------------------------------
-- Lista WYŁĄCZONYCH rodzajów, nie włączonych. Domyślnie pusta, czyli wszystko
-- działa — nowy rodzaj powiadomienia nie wymaga wtedy migracji danych ani
-- „obudzenia" nikomu ustawień. Odwrotnie (lista włączonych) każdy nowy rodzaj
-- byłby domyślnie wyłączony dla wszystkich, którzy kiedykolwiek dotknęli
-- ustawień — czyli funkcja wchodziłaby martwa.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_wylaczone TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.push_wylaczone IS
  'Rodzaje powiadomień, których użytkownik NIE chce dostawać na telefon. Pusta tablica = wszystko włączone. Dotyczy wyłącznie pusha — dzwonek w aplikacji pokazuje wszystko (migracja 109).';

-- Wyzwalacz wysyłki respektuje ustawienia. ŚWIADOMIE tylko push: dzwonek
-- w aplikacji zostaje kompletny, bo to jest historia tego, co się wydarzyło,
-- a nie kanał, który przerywa komuś dzień. Wyłączenie rodzaju ma znaczyć
-- „nie zawracaj mi telefonu", a nie „ukryj to przede mną".
CREATE OR REPLACE FUNCTION wyslij_push_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
BEGIN
  -- Ustawienia sprawdzamy PIERWSZE: to najtańszy sposób na niewysłanie.
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = NEW.user_id AND NEW.type = ANY(p.push_wylaczone)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT wartosc INTO v_url    FROM konfiguracja_push WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_push WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bojo-sekret', v_sekret
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'tytul',   NEW.title,
      'tresc',   NEW.body,
      'typ',     NEW.type,
      'event_id', NEW.event_id,
      'group_id', NEW.group_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Kanał dodatkowy nie może wywrócić zapisu powiadomienia w aplikacji.
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wiadomość w rozmowie meczu → powiadomienie dla składu
-- ---------------------------------------------------------------------------
-- ZAPORA 60 MINUT, per mecz i per odbiorca. Rozmowa przed meczem potrafi mieć
-- trzydzieści wiadomości w kwadrans („będę 10 minut później", „kto bierze
-- piłki"). Bez zapory każdy dostałby trzydzieści powiadomień, czyli wyłączyłby
-- je po drugiej gierce — a razem z nimi te, które naprawdę mają znaczenie.
-- Jedno powiadomienie na godzinę mówi „coś się dzieje, zajrzyj", i to
-- wystarczy: treść i tak jest w aplikacji.
--
-- Ten sam wzorzec co zapora 12 h w `zapytaj_milczacych()` (migracja `097`).
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  SELECT title INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'wiadomosc_w_meczu',
         'Nowa wiadomość',
         coalesce(v_tytul, 'Mecz') || ' — ' || NEW.user_name || ' napisał w rozmowie.',
         NEW.event_id
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id          -- autor wie, że napisał
     AND ep.pending_approval = false
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ep.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'wiadomosc_w_meczu'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Powiadomienie nie może zablokować wysłania samej wiadomości.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_wiadomosci_w_meczu ON event_comments;
CREATE TRIGGER trg_powiadom_o_wiadomosci_w_meczu
  AFTER INSERT ON event_comments
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_wiadomosci_w_meczu();

-- ---------------------------------------------------------------------------
-- 3. Wpis na tablicy ekipy → powiadomienie dla członków
-- ---------------------------------------------------------------------------
-- Migracja `093` powiadamia WYŁĄCZNIE o wpisie PRZYPIĘTYM przez kogoś
-- z `can_moderate_wall` — czyli o ogłoszeniu. Zwykła rozmowa ekipy nie
-- powiadamiała nikogo. Ta sama zapora 60 minut, ten sam powód.
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa TEXT;
BEGIN
  -- Ogłoszenie (wpis przypięty) ma własne powiadomienie z `093` — nie dublujemy.
  IF NEW.pinned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_nazwa FROM groups WHERE id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'wiadomosc_w_grupie',
         'Nowa wiadomość w ekipie',
         coalesce(v_nazwa, 'Ekipa') || ' — ' || NEW.user_name || ' napisał na tablicy.',
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id
          AND n.group_id = NEW.group_id
          AND n.type = 'wiadomosc_w_grupie'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_wiadomosci_w_grupie ON group_posts;
CREATE TRIGGER trg_powiadom_o_wiadomosci_w_grupie
  AFTER INSERT ON group_posts
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_wiadomosci_w_grupie();

-- ---------------------------------------------------------------------------
-- 4. Publikacja składów → powiadomienie dla grających
-- ---------------------------------------------------------------------------
-- „Pojawiły się składy" to moment, na który czeka cała drużyna, a dotąd
-- trzeba było zgadywać, kiedy nastąpił.
CREATE OR REPLACE FUNCTION powiadom_o_skladach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Wyłącznie przejście false → true. Bez tego każda edycja meczu
  -- z opublikowanymi składami wysyłałaby powiadomienie od nowa.
  IF NEW.teams_published IS NOT TRUE OR OLD.teams_published IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'sklady_opublikowane',
         'Są składy',
         coalesce(NEW.title, 'Mecz') || ' — sprawdź, w której drużynie grasz.',
         NEW.id
    FROM event_participants ep
   WHERE ep.event_id = NEW.id
     AND ep.user_id IS NOT NULL
     AND ep.is_reserve = false
     AND ep.pending_approval = false;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_skladach ON events;
CREATE TRIGGER trg_powiadom_o_skladach
  AFTER UPDATE OF teams_published ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_skladach();
