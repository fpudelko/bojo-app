-- ============================================================================
-- 192_turniej_zaproszenie_mailem.sql — zaproszenie do współorganizowania albo
-- prowadzenia meczów turnieju wysłane MAILEM (Resend).
-- ----------------------------------------------------------------------------
-- DLACZEGO. Prośba właściciela (2026-11-27): po „Zaproś linkiem” (189),
-- gdzie organizator kopiuje wiadomość, druga droga: wpisuje adres e-mail,
-- a Bojo samo wysyła maila „X zaprasza Cię do …” z jednym przyciskiem
-- „Dołącz jako współorganizator / prowadzący mecze”. Przycisk prowadzi na to
-- samo `/o/<kod>` co link z 189, więc przyjęcie roli działa bez zmian.
--
-- Wysyłka tą samą drogą co reszta poczty Bojo (133/140): `pg_net` →
-- funkcja brzegowa `powiadom-goscia` (powód `zaproszenie_do_turnieju`) →
-- Resend. Funkcja brzegowa MUSI być wdrożona przed tą migracją, inaczej nie
-- zna powodu i nic nie wyśle.
--
-- Limity, bo adres wpisuje człowiek, a Resend ma wspólny limit dzienny:
-- najwyżej 3 zaproszenia na ten sam adres i 20 od jednego organizatora na
-- dobę. Brak konfiguracji poczty to wyjątek z czytelnym komunikatem (tu
-- wysyłka jest celem kliknięcia, nie skutkiem ubocznym, więc cisza by kłamała).
-- Same dokładające zmiany, automatem.
-- ============================================================================

ALTER TABLE turniej_zaproszenia_osob ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION zapros_osobe_mailem(p_turniej uuid, p_rola text, p_email text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_url    text;
  v_sekret text;
  v_kod    text;
  v_nazwa  text;
  v_kto    text;
BEGIN
  IF auth.uid() IS NULL OR NOT czy_organizator_turnieju(p_turniej) THEN
    RAISE EXCEPTION 'Zaproszenie wysyła organizator turnieju.';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'To nie wygląda na adres e-mail.';
  END IF;
  IF (SELECT count(*) FROM turniej_zaproszenia_osob z
       WHERE z.email = v_email AND z.created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'Na ten adres poszły już dziś 3 zaproszenia. Wyślij link inną drogą.';
  END IF;
  IF (SELECT count(*) FROM turniej_zaproszenia_osob z
       WHERE z.utworzyl = auth.uid() AND z.email IS NOT NULL
         AND z.created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Dzienny limit zaproszeń mailem wyczerpany. Wyślij link inną drogą.';
  END IF;

  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RAISE EXCEPTION 'Poczta Bojo nie jest jeszcze skonfigurowana. Użyj „Zaproś linkiem”.';
  END IF;

  v_kod := utworz_zaproszenie_osoby(p_turniej, p_rola);
  UPDATE turniej_zaproszenia_osob SET email = v_email WHERE kod = v_kod;

  SELECT t.nazwa INTO v_nazwa FROM turnieje t WHERE t.id = p_turniej;
  SELECT nullif(btrim(p.display_name), '') INTO v_kto FROM profiles p WHERE p.id = auth.uid();

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object(
      'powod',         'zaproszenie_do_turnieju',
      'email',         v_email,
      'imie',          NULL,
      'turniej_nazwa', v_nazwa,
      'zapraszajacy',  coalesce(v_kto, 'Organizator'),
      'rola',          p_rola,
      'kod',           v_kod
    )
  );
  RETURN v_kod;
END $$;

REVOKE ALL ON FUNCTION zapros_osobe_mailem(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zapros_osobe_mailem(uuid, text, text) TO authenticated;
