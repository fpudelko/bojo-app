-- 136 — push do przejęcia wpisu gościa prowadził w inne miejsce niż dzwonek
--
-- DLACZEGO. Powiadomienie `niepotwierdzony_wpis_goscia` (migracja `084`) mówi
-- „Potwierdź, że to Ty" i ma prowadzić na `/gracz/przejmij/{token}` — jedyną
-- stronę, na której da się to zrobić. Dzwonek tak właśnie robi
-- (`celPowiadomienia()` w `lib/notifications.ts` czyta `notifications.claim_token`).
--
-- PUSH NIE MÓGŁ. Wyzwalacz z migracji `119` wkłada do ładunku siedem pól i NIE
-- MA WŚRÓD NICH `claim_token`, więc `adresPowiadomienia()` w funkcji brzegowej
-- widziała tylko `event_id` i odsyłała na stronę meczu — gdzie żadnego przycisku
-- potwierdzenia nie ma. Komentarz w `send-push/index.ts` deklaruje przy tym
-- wprost: „powiadomienie na telefonie ma otwierać dokładnie to samo miejsce co
-- powiadomienie w aplikacji". Tu tego nie robiło.
--
-- Kogo to dotyczy: osoby, którą organizator dopisał ręcznie i która ma już konto
-- w Bojo na tym adresie. Czyli dokładnie tej, którą próbujemy zamienić z gościa
-- w użytkownika — a więc ruchu, na którym stoi cała faza 1.
--
-- Ładunek rośnie o jedno pole; funkcja brzegowa ignoruje nieznane pola, więc
-- kolejność wdrożenia (migracja przed funkcją czy odwrotnie) nie ma znaczenia.
--
-- Migracja jest IDEMPOTENTNA — `CREATE OR REPLACE` na jednej funkcji.

-- Ciało skopiowane z `119` (ostatnia definicja) — zmieniona WYŁĄCZNIE jedna
-- linia `jsonb_build_object`, dokładająca `'claim_token', NEW.claim_token`.
-- Ten sam wzorzec, którym `119` dokładało `'id'`: przepisywanie funkcji od nowa
-- to okazja, żeby coś zgubić.
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
      'group_id', NEW.group_id,
      -- NOWE. Bez tego pola push „Potwierdź, że to Ty" lądował na stronie
      -- meczu, na której nie ma czego potwierdzić.
      'claim_token', NEW.claim_token
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Kanał dodatkowy nie może wywrócić zapisu powiadomienia w aplikacji.
  RETURN NEW;
END;
$$;

-- Wyzwalacza NIE ruszamy: `CREATE OR REPLACE FUNCTION` podmienia ciało pod
-- istniejącym wyzwalaczem, a `DROP TRIGGER` + `CREATE` byłoby tu jedynie
-- dodatkową okazją do rozjazdu nazwy.
