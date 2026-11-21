-- ============================================================================
-- JEDNORAZOWE ZADANIE: usuń WSZYSTKIE turnieje poza turniejem dla Marysi
-- ============================================================================
--
-- Prośba właściciela z 2026-11-21: przed przekazaniem turnieju organizatorowi
-- z Lubonia baza ma mieć jeden turniej: `e9a3763f-7bd9-99e9-76d6-1c852d6b8f47`
-- („Gramy dla Marysi”). Wszystko inne (pokazy, próby, testy) znika.
--
-- Co znika razem z turniejem (ON DELETE CASCADE): drużyny, składy, grupy,
-- boiska, mecze, zdarzenia meczów, przerwy, ogłoszenia, zaproszenia, osoby,
-- BLIK, adresy z nazwą, powiadomienia o tych turniejach. Żaden wyzwalacz nie
-- powiadamia o usunięciu turnieju, więc nikt nie dostanie wiadomości.
-- Zdjęcia galerii i logotypy sponsorów leżą na Cloudflare R2 (161): pliki
-- zostają w zasobniku, znikają tylko wpisy w bazie.
--
-- NIEODWRACALNE. Uruchamiane RĘCZNIE w Supabase → SQL Editor: najpierw
-- część A (podgląd), potem B. Część B sprawdza, czy turniej dla Marysi
-- istnieje, i bez niego nie usunie niczego.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A: PODGLĄD. Niczego nie zmienia. Pierwsza lista = ZOSTAJE,
-- druga = ZNIKNIE.
-- ============================================================================

SELECT 'ZOSTAJE' AS los, t.id, t.nazwa, t.status, t.data_startu,
       (SELECT email FROM auth.users u WHERE u.id = t.organizator_id) AS organizator
  FROM turnieje t
 WHERE t.id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';

SELECT 'ZNIKNIE' AS los, t.id, t.nazwa, t.status, t.data_startu,
       (SELECT email FROM auth.users u WHERE u.id = t.organizator_id) AS organizator,
       (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id) AS druzyn,
       (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id) AS meczow
  FROM turnieje t
 WHERE t.id <> 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
 ORDER BY t.created_at;


-- ============================================================================
-- CZĘŚĆ B: USUNIĘCIE. Uruchom po sprawdzeniu części A.
-- ============================================================================

DO $$
DECLARE
  v_zostaje CONSTANT uuid := 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';
  v_ile int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM turnieje WHERE id = v_zostaje) THEN
    RAISE EXCEPTION 'Nie ma turnieju %. Nic nie usuwam: sprawdź id w części A.', v_zostaje;
  END IF;
  DELETE FROM turnieje WHERE id <> v_zostaje;
  GET DIAGNOSTICS v_ile = ROW_COUNT;
  RAISE NOTICE 'Usunięto % turniejów. Został jeden: %', v_ile, v_zostaje;
END $$;

SELECT id, nazwa, status FROM turnieje;
