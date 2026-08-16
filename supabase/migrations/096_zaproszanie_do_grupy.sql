-- 096: Czwarty przełącznik uprawnień — kto widzi "Zaproś" i kod dołączenia.
--
-- `can_manage_members` (migracja `092`) miał w opisie "wysyła zaproszenia,
-- zmienia link" razem z dodawaniem/usuwaniem ludzi — dwa różne poziomy
-- zaufania sklejone w jeden. Dziś przycisk "Zaproś" i kod grupy widzi w ogóle
-- KAŻDY członek, bez żadnej bramki (GroupDetailClient renderuje go dla
-- każdego `member`, bez sprawdzania uprawnień). Ta migracja daje founderowi
-- osobną dźwignię: kto może zapraszać nowych, niezależnie od tego, czy może
-- zarządzać składem (dodawać/usuwać ludzi wprost) czy zmieniać link/kod
-- (co zostaje przy `can_manage_members`, patrz `odswiez_kod_grupy` w `094`).
--
-- Świadomie BEZ nowej funkcji SECURITY DEFINER i bez zmiany w RPC
-- `dolacz_do_grupy_kodem` (`094`): ta funkcja nie sprawdza uprawnień osoby,
-- która podała kod — nie sprawdzała ich przed tą migracją i nie zaczyna teraz.
-- `can_invite` jest bramką WIDOCZNOŚCI przycisku w UI (kto w ogóle zobaczy
-- kod, żeby go komuś przekazać), nie nową granicą bezpieczeństwa — każdy, kto
-- zna kod, nadal może dołączyć, dokładnie jak dziś.
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS can_invite BOOLEAN NOT NULL DEFAULT true;
  -- true, NIE false: tym samym powodem co can_create_events w 092 — dziś
  -- każdy członek widzi "Zaproś" bez żadnej bramki, default false odebrałby
  -- to wszystkim poza założycielem w dniu wgrania migracji.

UPDATE group_members SET can_invite = true WHERE role = 'admin';

-- Założyciel dostaje can_invite wymuszone na true, tak jak pozostałe trzy
-- przełączniki — trigger z `092` trzeba przedefiniować (ta sama nazwa
-- funkcji, więc wszystkie miejsca, które go wywołują, zostają bez zmian).
CREATE OR REPLACE FUNCTION ustaw_role_czlonka()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_zalozyciel UUID;
BEGIN
  SELECT created_by INTO v_zalozyciel FROM groups WHERE id = NEW.group_id;

  IF v_zalozyciel IS NOT NULL AND NEW.user_id = v_zalozyciel THEN
    -- Założyciela nie da się zdegradować nawet celowym UPDATE-em.
    NEW.can_manage_members := true;
    NEW.can_create_events  := true;
    NEW.can_moderate_wall  := true;
    NEW.can_invite         := true;
    NEW.role := 'admin';
  ELSIF NEW.can_manage_members OR NEW.can_moderate_wall THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := 'member';
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger sam nie wymaga DROP/CREATE — CREATE OR REPLACE FUNCTION wystarcza,
-- bo trg_ustaw_role_czlonka (092) już wskazuje na tę samą funkcję po nazwie.
