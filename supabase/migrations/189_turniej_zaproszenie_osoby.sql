-- ============================================================================
-- 189_turniej_zaproszenie_osoby.sql — zaproszenie do prowadzenia turnieju
-- linkiem, także dla kogoś BEZ konta w Bojo.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Test przed turniejem (2026-11-27): współorganizatora i
-- prowadzącego mecze dało się dodać tylko po e-mailu ISTNIEJĄCEGO konta
-- (178/185), więc organizator, który chciał zaprosić kolegę, musiał najpierw
-- namówić go na założenie konta i dopytać o adres. Decyzja właściciela: bez
-- wysyłania maili z Bojo. Organizator dostaje gotową wiadomość z linkiem
-- `/o/<kod>` do skopiowania (WhatsApp, SMS, mail z własnej skrzynki);
-- zaproszony otwiera link, loguje się albo zakłada konto i przyjmuje rolę.
--
-- Link działa RAZ (jak link kapitana, 181): po przyjęciu kod znika, więc
-- przesłany dalej nic nie da. Kod przypisany do roli: 'wspolorganizator'
-- (pełne prawa, 178) albo 'prowadzacy' (tylko mecze, 185).
-- Same dokładające zmiany, automatem.
-- ============================================================================

CREATE TABLE IF NOT EXISTS turniej_zaproszenia_osob (
  kod         text PRIMARY KEY,
  turniej_id  uuid NOT NULL REFERENCES turnieje(id) ON DELETE CASCADE,
  rola        text NOT NULL CHECK (rola IN ('wspolorganizator', 'prowadzacy')),
  utworzyl    uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turniej_zaproszenia_osob ENABLE ROW LEVEL SECURITY;

-- Listę kodów widzi tylko organizator; zaproszony czyta przez funkcję niżej.
DROP POLICY IF EXISTS "Zaproszenia osob widzi organizator" ON turniej_zaproszenia_osob;
CREATE POLICY "Zaproszenia osob widzi organizator" ON turniej_zaproszenia_osob FOR SELECT
  TO authenticated USING (czy_organizator_turnieju(turniej_id));

GRANT SELECT ON turniej_zaproszenia_osob TO authenticated;


CREATE OR REPLACE FUNCTION utworz_zaproszenie_osoby(p_turniej uuid, p_rola text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kod text;
BEGIN
  IF auth.uid() IS NULL OR NOT czy_organizator_turnieju(p_turniej) THEN
    RAISE EXCEPTION 'Zaproszenie wysyła organizator turnieju.';
  END IF;
  IF p_rola NOT IN ('wspolorganizator', 'prowadzacy') THEN
    RAISE EXCEPTION 'Nieznana rola: %.', p_rola;
  END IF;
  LOOP
    v_kod := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM turniej_zaproszenia_osob z WHERE z.kod = v_kod);
  END LOOP;
  INSERT INTO turniej_zaproszenia_osob (kod, turniej_id, rola, utworzyl)
  VALUES (v_kod, p_turniej, p_rola, auth.uid());
  RETURN v_kod;
END $$;

REVOKE ALL ON FUNCTION utworz_zaproszenie_osoby(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION utworz_zaproszenie_osoby(uuid, text) TO authenticated;


-- Co jest za linkiem: dostępne także przed zalogowaniem, żeby strona mogła
-- powiedzieć, do czego zaprasza, zanim poprosi o konto.
CREATE OR REPLACE FUNCTION zaproszenie_osoby_info(p_kod text)
RETURNS TABLE (turniej_id uuid, turniej_nazwa text, rola text, zapraszajacy text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT z.turniej_id, t.nazwa, z.rola,
         coalesce(nullif(btrim(p.display_name), ''), 'Organizator')
    FROM turniej_zaproszenia_osob z
    JOIN turnieje t ON t.id = z.turniej_id
    LEFT JOIN profiles p ON p.id = z.utworzyl
   WHERE z.kod = upper(btrim(coalesce(p_kod, '')))
$$;

GRANT EXECUTE ON FUNCTION zaproszenie_osoby_info(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION przyjmij_zaproszenie_osoby(p_kod text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_z     turniej_zaproszenia_osob%ROWTYPE;
  v_pelne boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby przyjąć zaproszenie.';
  END IF;
  SELECT * INTO v_z FROM turniej_zaproszenia_osob z
   WHERE z.kod = upper(btrim(coalesce(p_kod, ''))) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ten link już nie działa: został użyty albo organizator go cofnął.';
  END IF;
  IF EXISTS (SELECT 1 FROM turnieje t WHERE t.id = v_z.turniej_id AND t.organizator_id = auth.uid()) THEN
    RAISE EXCEPTION 'Jesteś organizatorem tego turnieju. Wyślij ten link osobie, którą zapraszasz.';
  END IF;

  v_pelne := v_z.rola = 'wspolorganizator';
  INSERT INTO turniej_osoby (turniej_id, user_id, moze_edytowac, moze_prowadzic, moze_zarzadzac_druzynami, dodany_przez)
  VALUES (v_z.turniej_id, auth.uid(), v_pelne, true, v_pelne, v_z.utworzyl)
  ON CONFLICT (turniej_id, user_id) DO UPDATE
    -- Zaproszenie nigdy nie odbiera praw: prowadzący zaproszony jako
    -- współorganizator awansuje, współorganizator z linkiem prowadzącego nie.
    SET moze_edytowac = turniej_osoby.moze_edytowac OR v_pelne,
        moze_prowadzic = true,
        moze_zarzadzac_druzynami = turniej_osoby.moze_zarzadzac_druzynami OR v_pelne;

  DELETE FROM turniej_zaproszenia_osob z WHERE z.kod = v_z.kod;
  RETURN v_z.turniej_id;
END $$;

REVOKE ALL ON FUNCTION przyjmij_zaproszenie_osoby(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION przyjmij_zaproszenie_osoby(text) TO authenticated;
