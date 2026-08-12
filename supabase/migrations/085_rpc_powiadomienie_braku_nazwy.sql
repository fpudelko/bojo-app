-- 085_rpc_powiadomienie_braku_nazwy.sql
--
-- Trigger `powiadom_o_braku_nazwy` (070, poprawiony w 071) jest poprawnie
-- zdefiniowany i włączony na `auth.users`, ale w produkcyjnej bazie NIGDY nie
-- wstawił ani jednego powiadomienia `uzupelnij_profil` — mimo dziesiątek kont
-- z niepełną nazwą założonych po migracji 071 (zweryfikowane zapytaniem po
-- danych produkcyjnych, 2026-08-12). Trigger `on_auth_user_created` na tej
-- samej tabeli, z tym samym zdarzeniem (AFTER INSERT), działa niezawodnie
-- (profile powstają) — przyczyna rozjazdu nie jest znana z analizy statycznej
-- ani z ręcznej symulacji przez SQL Editor (który sam nie odtwarza kontekstu
-- wykonania GoTrue, więc dalsza diagnoza stamtąd nie ma sensu).
--
-- Zamiast dalej diagnozować GoTrue z zewnątrz, przenosimy decyzję na
-- front-end: dokładnie ten sam warunek (`isPelneImie` z profileName.ts),
-- który już steruje banerem na pulpicie, steruje teraz też wywołaniem tej
-- funkcji (`lib/auth.tsx`, `onAuthStateChange`). Jedno źródło prawdy zamiast
-- dwóch niezależnych implementacji tego samego testu.
--
-- Trigger z 070/071 ZOSTAJE — jeśli kiedyś zacznie działać, warunek
-- NOT EXISTS niżej zapobiega duplikatowi niezależnie od tego, kto wstawi
-- pierwszy.
CREATE OR REPLACE FUNCTION zglos_brak_pelnej_nazwy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id = auth.uid() AND type = 'uzupelnij_profil'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    auth.uid(),
    'uzupelnij_profil',
    'Uzupełnij swoje imię',
    'Gracze zobaczą Cię pod nazwą wyprowadzoną z adresu e-mail. Wpisz imię i nazwisko w profilu.'
  );
END;
$$;

REVOKE ALL ON FUNCTION zglos_brak_pelnej_nazwy() FROM public;
GRANT EXECUTE ON FUNCTION zglos_brak_pelnej_nazwy() TO authenticated;
