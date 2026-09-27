-- Test migracji `165`: żadna z 26 funkcji przepisanych przy usuwaniu długiego
-- myślnika z treści powiadomień/maili/SMS-ów nie ma go w ciele.
--
-- PO CO OSOBNY TEST, NIE `check:docs`. Sekcja 12 walidatora skanuje PLIKI migracji
-- (od `165`) — pilnuje, żeby NOWY kod nie dopisał myślnika. Ten plik czyta
-- `pg_proc.prosrc`, czyli to, co REALNIE jest w bazie po zastosowaniu wszystkich
-- migracji — inna migracja mogłaby w teorii przywrócić starą wersję funkcji
-- (np. przez ślepe `CREATE OR REPLACE` skopiowane z historii) i wtedy plik na
-- dysku byłby czysty, a baza dalej wysyłałaby myślnik. Uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- Nie sprawdzamy WSZYSTKICH funkcji w bazie — `to_regprocedure()` na liście z
-- migracji `165` wystarcza, bo to jest zamknięty zbiór, który ta migracja
-- naprawiła. Nowa funkcja z myślnikiem w treści powiadomienia złapie się na
-- sekcji 12 `check:docs`, zanim trafi do repo.

\set ON_ERROR_STOP on
\o /dev/null

DO $$
DECLARE
  v_funkcje TEXT[] := ARRAY[
    'powiadom_o_zaproszeniu', 'powiadom_o_odwolaniu', 'powiadom_o_przywroceniu',
    'powiadom_o_zmianie_terminu', 'powiadom_o_usunieciu_meczu',
    'powiadom_o_usunieciu_uczestnika', 'powiadom_o_zmianie_warunkow',
    'powiadom_o_akceptacji', 'powiadom_o_prosbie_o_dolaczenie',
    'powiadom_o_odrzuceniu_prosby', 'powiadom_istniejace_konto_o_wpisie_goscia',
    'powiadom_o_niepotwierdzonych_wpisach_goscia', 'powiadom_o_skladach',
    'powiadom_o_nowym_meczu_w_grupie', 'zapytaj_milczacych', 'powiadom_o_progu_gry',
    'powiadom_o_zmianie_kompletu', 'sync_reserve_claim', 'wyslij_przypomnienia',
    'pilnuj_wylaczonej_rezerwy', 'odswiez_kod_grupy', 'dolacz_do_druzyny_kodem',
    'powiadom_o_zgloszeniu_druzyny', 'powiadom_o_decyzji_druzyny',
    'zapisz_terminarz', 'przesun_terminarz'
  ];
  v_nazwa TEXT;
  v_prosrc TEXT;
  v_zlych INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Powiadomienia bez długiego myślnika (migracja 165)';
  FOREACH v_nazwa IN ARRAY v_funkcje LOOP
    SELECT prosrc INTO v_prosrc
      FROM pg_proc
     WHERE proname = v_nazwa
       AND pronamespace = 'public'::regnamespace
     LIMIT 1;
    IF v_prosrc IS NULL THEN
      RAISE EXCEPTION 'POWIADOMIENIA: funkcja % nie istnieje w bazie, a lista z 165 mówi inaczej', v_nazwa;
    END IF;
    IF v_prosrc LIKE '%—%' THEN
      v_zlych := v_zlych + 1;
      RAISE WARNING '  ✗ %: ciało funkcji dalej ma długi myślnik', v_nazwa;
    END IF;
  END LOOP;

  IF v_zlych > 0 THEN
    RAISE EXCEPTION 'POWIADOMIENIA: % z % funkcji dalej ma długi myślnik w ciele', v_zlych, array_length(v_funkcje, 1);
  END IF;
  RAISE NOTICE '  ✓ % funkcji bez długiego myślnika w ciele', array_length(v_funkcje, 1);
END $$;
