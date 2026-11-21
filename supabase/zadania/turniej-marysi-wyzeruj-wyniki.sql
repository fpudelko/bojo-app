-- ============================================================================
-- JEDNORAZOWE ZADANIE: wyzeruj wyniki turnieju dla Marysi po testach
-- ============================================================================
--
-- Prośba właściciela z 2026-11-21: po próbach turniej
-- `e9a3763f-7bd9-99e9-76d6-1c852d6b8f47` ma wrócić do stanu przed pierwszym
-- gwizdkiem i dopiero wtedy trafić do organizatora z Lubonia.
--
-- Co się dzieje (ta sama logika co „Popraw wynik”, `cofnij_wynik_meczu()`
-- z migracji 175, tylko dla wszystkich meczów naraz):
--   • gole, kartki i inne zdarzenia meczów znikają,
--   • każdy mecz wraca do „zaplanowany”: wynik 0:0, bez karnych, zwycięzcy,
--     walkowera, MVP, godziny rozpoczęcia i zakończenia,
--   • drużyny wpisane do meczów zależnych (zwycięzca meczu, miejsce z grupy)
--     znikają, mecze znów mówią „Zwycięzca A”, „Zwycięzca meczu M7”,
--   • wolne losy zostają walkowerem, a ich drużyna wraca do kolejnej rundy,
--   • turniej wraca ze stanu „trwa”/„zakończony” do „zapisy zamknięte”,
--   • powiadomienia o tym turnieju z czasu testów znikają.
-- ZOSTAJE: drużyny, składy, kapitanowie, grupy, terminarz z godzinami,
-- boiska, przerwy, ogłoszenia, ustawienia, okładka, galeria, sponsorzy.
--
-- Nikt nie dostanie powiadomienia: „Wasz mecz jest następny” (155/174)
-- budzi tylko przejście meczu DO „zakończony”/„walkower”, a tu mecze wracają
-- do „zaplanowany”.
--
-- Bezpieczne do ponownego uruchomienia. RĘCZNIE w Supabase → SQL Editor:
-- część A (podgląd), potem B.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A: PODGLĄD. Niczego nie zmienia.
-- ============================================================================

SELECT t.nazwa, t.status,
       count(m.*) FILTER (WHERE m.status <> 'zaplanowany' AND NOT czy_wolny_los(m)) AS meczow_z_wynikiem,
       (SELECT count(*) FROM turniej_zdarzenia z WHERE z.turniej_id = t.id)          AS zdarzen,
       (SELECT count(*) FROM notifications n WHERE n.turniej_id = t.id)              AS powiadomien
  FROM turnieje t
  LEFT JOIN turniej_mecze m ON m.turniej_id = t.id
 WHERE t.id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
 GROUP BY t.id;


-- ============================================================================
-- CZĘŚĆ B: ZEROWANIE.
-- ============================================================================

DO $$
DECLARE
  v_t CONSTANT uuid := 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';
  v_meczow int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM turnieje WHERE id = v_t) THEN
    RAISE EXCEPTION 'Nie ma turnieju %.', v_t;
  END IF;

  DELETE FROM turniej_zdarzenia WHERE turniej_id = v_t;

  UPDATE turniej_mecze m SET
    status = 'zaplanowany', wynik_a = 0, wynik_b = 0, wynik_recznie = false,
    karne_a = NULL, karne_b = NULL, zwyciezca_id = NULL, walkower_dla = NULL,
    mvp_zawodnik_id = NULL, zakonczony_at = NULL, rozpoczety_at = NULL, sety = NULL
   WHERE m.turniej_id = v_t AND NOT czy_wolny_los(m);
  GET DIAGNOSTICS v_meczow = ROW_COUNT;

  -- Drużyny w meczach zależnych: znikają, zostaje „Zwycięzca …”.
  UPDATE turniej_mecze m SET druzyna_a_id = NULL
   WHERE m.turniej_id = v_t AND (m.zrodlo_a_mecz_id IS NOT NULL OR m.zrodlo_a_grupa_id IS NOT NULL);
  UPDATE turniej_mecze m SET druzyna_b_id = NULL
   WHERE m.turniej_id = v_t AND (m.zrodlo_b_mecz_id IS NOT NULL OR m.zrodlo_b_grupa_id IS NOT NULL);

  -- Wolny los: drużyna i tak awansuje bez gry, wraca do kolejnej rundy.
  PERFORM propaguj_zwyciezce_dla(m.id) FROM turniej_mecze m
   WHERE m.turniej_id = v_t AND czy_wolny_los(m);

  UPDATE turnieje SET status = 'zamkniete_zapisy'
   WHERE id = v_t AND status IN ('trwa', 'zakonczony');

  DELETE FROM notifications WHERE turniej_id = v_t;

  RAISE NOTICE 'Wyzerowano % meczów turnieju %.', v_meczow, v_t;
END $$;

-- Sprawdzenie: wszystko poza wolnymi losami ma być „zaplanowany”.
SELECT status, count(*) FROM turniej_mecze
 WHERE turniej_id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47' GROUP BY status;
SELECT nazwa, status FROM turnieje WHERE id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';
