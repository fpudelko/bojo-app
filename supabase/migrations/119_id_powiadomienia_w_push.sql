-- 119: Identyfikator powiadomienia w payloadzie push.
--
-- PO CO: kliknięcie w powiadomienie push na telefonie nie oznaczało tej samej
-- pozycji jako przeczytanej w dzwonku aplikacji (zgłoszone wprost) — dzwonek
-- oznacza wszystko na raz WYŁĄCZNIE przy otwarciu panelu w aplikacji
-- (`NotificationBell.tsx`), a push to zupełnie inna ścieżka, o której dzwonek
-- nic nie wie.
--
-- Service worker (`public/sw.js`) nie ma dostępu do sesji Supabase — nie może
-- sam wykonać `UPDATE notifications SET read_at = now()`. Zamiast tego
-- dokleja identyfikator do adresu, na który nawiguje po kliknięciu
-- (`?przeczytaj=<id>`), a `NotificationBell.tsx` po stronie klienta czyta ten
-- parametr i woła zwykłe `markRead([id])`. Warunek: identyfikator musi w ogóle
-- dojechać do przeglądarki — stąd ta migracja.
--
-- Ciało funkcji skopiowane z `109` (ostatnia definicja) — zmieniona WYŁĄCZNIE
-- jedna linia `jsonb_build_object`, dokładająca `'id', NEW.id`.
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
      'id',       NEW.id,
      'user_id',  NEW.user_id,
      'tytul',    NEW.title,
      'tresc',    NEW.body,
      'typ',      NEW.type,
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
