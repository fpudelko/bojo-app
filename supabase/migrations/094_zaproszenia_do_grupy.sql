-- 094: Zaproszenia do grupy — kto kogo przyprowadził i czy w ogóle miał prawo.
--
-- DWIE DZIURY NARAZ.
--
-- 1. KOD DOŁĄCZENIA BYŁ DEKORACJĄ. Polityka INSERT na `group_members`
--    z migracji `044` brzmi `auth.uid() = user_id` — czyli wystarczy ZNAĆ
--    UUID grupy, żeby się do niej dopisać. A UUID nie jest tajny: tabela
--    `groups` jest publicznie czytelna, strona `/grupy/{id}` publiczna,
--    a link do niej ląduje w Messengerze. `join_code` sprawdzał wyłącznie
--    interfejs (`GroupsClient.handleJoin`), więc baza wpuszczała każdego,
--    kto ominął formularz.
--
-- 2. ZAPROSZENIE NIE MIAŁO NADAWCY. Link `/g/{kod}` prowadził na stronę
--    grupy i tyle. Nie dało się powiedzieć "Marek zaprasza Cię do Ekipy
--    Rataje", nie dało się później sprawdzić, kto kogo przyprowadził,
--    i nie dało się kodu unieważnić.
--
-- DLACZEGO BEZ TABELI `group_invites`. Osobna tabela z tokenem, wygaśnięciem
-- i licznikiem użyć daje unieważnianie POJEDYNCZEGO linku — funkcja klubu
-- na dwieście osób, nie ekipy na dwanaście. Kosztuje drugą przestrzeń
-- kodów (którą `/g/[code]` musi odtąd przeszukiwać w dwóch tabelach),
-- odporny na wyścig licznik użyć i sprzątanie wygasłych. To samo (a)+(b)+(c)
-- da się dostać za jedną kolumnę i dwie funkcje:
--   (a) `group_members.invited_by` — zapisywane przez RPC, weryfikowane
--       po stronie bazy (zapraszający musi sam być w grupie),
--   (b) parametr `?od=<uuid>` w linku + publicznie czytelne `profiles`,
--   (c) `odswiez_kod_grupy()` — nowy kod unieważnia wszystkie stare linki.
-- Gdy pojawi się potrzeba wygaszania pojedynczych zaproszeń, `invited_by`
-- zostaje i tak — to jedyna z tych trzech rzeczy, której URL nie zapisze.

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS join_code_rotated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_group_members_invited_by
  ON group_members (invited_by) WHERE invited_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Dołączenie kodem — jedyna droga samodzielnego wejścia do grupy
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, bo po zdjęciu polityki INSERT (niżej) nikt nie ma prawa
-- pisać do `group_members` z przeglądarki. Tożsamość bierzemy z auth.uid(),
-- nie z argumentu — wzorem `dolacz_do_meczu()` z migracji `078` — więc nikt
-- nie dopisze do grupy kogoś innego.
CREATE OR REPLACE FUNCTION dolacz_do_grupy_kodem(p_code TEXT, p_od UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_group uuid;
  v_od    uuid := NULL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby dołączyć do grupy';
  END IF;

  SELECT g.id INTO v_group
    FROM groups g
   WHERE g.join_code = upper(btrim(coalesce(p_code, '')));

  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Nie ma grupy o tym kodzie';
  END IF;

  -- Zapraszający liczy się TYLKO wtedy, gdy sam należy do grupy. Parametr
  -- `od` przychodzi z adresu URL, więc każdy może wpisać tam co chce —
  -- bez tego sprawdzenia obcy człowiek zapisałby się "z polecenia
  -- założyciela".
  IF p_od IS NOT NULL AND EXISTS (
       SELECT 1 FROM group_members m WHERE m.group_id = v_group AND m.user_id = p_od
     ) THEN
    v_od := p_od;
  END IF;

  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (v_group, v_user, 'member', v_od)
  ON CONFLICT (group_id, user_id) DO NOTHING;   -- „już członek" to wynik, nie błąd

  RETURN v_group;
END;
$$;

GRANT EXECUTE ON FUNCTION dolacz_do_grupy_kodem(TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dopisanie kogoś przez zarządzającego (bez kodu)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dodaj_czlonka_do_grupy(p_group_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT czy_moze_zarzadzac_grupa(p_group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby dodawać graczy do tej grupy';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Nie ma takiego użytkownika';
  END IF;

  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (p_group_id, p_user_id, 'member', auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION dodaj_czlonka_do_grupy(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Unieważnienie linku = nowy kod
-- ---------------------------------------------------------------------------
-- Politykę UPDATE na `groups` ma dziś zarządzający (`092`), więc technicznie
-- dałoby się to zrobić zwykłym UPDATE-em z klienta. Osobna funkcja, bo klient
-- nie zna `generate_join_code()`, a losowanie kodu w JavaScripcie oznaczałoby
-- drugą implementację tego samego alfabetu (bez I, L, O, 0, 1 — patrz `041`).
CREATE OR REPLACE FUNCTION odswiez_kod_grupy(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kod TEXT;
  i INT;
BEGIN
  IF NOT czy_zalozyciel_grupy(p_group_id) THEN
    RAISE EXCEPTION 'Tylko założyciel może odświeżyć kod grupy';
  END IF;

  -- Pętla na wypadek kolizji z UNIQUE — 31^6 kombinacji, ale kolizja jest
  -- możliwa, a wyjątek w tym miejscu wyglądałby dla użytkownika jak awaria.
  FOR i IN 1..10 LOOP
    BEGIN
      v_kod := generate_join_code();
      UPDATE groups
         SET join_code = v_kod, join_code_rotated_at = now()
       WHERE id = p_group_id;
      RETURN v_kod;
    EXCEPTION WHEN unique_violation THEN
      -- kolejna próba
    END;
  END LOOP;

  RAISE EXCEPTION 'Nie udało się wylosować nowego kodu — spróbuj ponownie';
END;
$$;

GRANT EXECUTE ON FUNCTION odswiez_kod_grupy(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Zamknięcie dziury: koniec samodzielnego INSERT-a
-- ---------------------------------------------------------------------------
-- Po zdjęciu tej polityki `group_members` NIE MA ŻADNEJ polityki INSERT, więc
-- z przeglądarki nie da się dopisać nikogo — także siebie. Wszystkie realne
-- drogi wejścia idą przez SECURITY DEFINER i tam sprawdzają warunek:
--   * dolacz_do_grupy_kodem()      — trzeba znać kod,
--   * dodaj_czlonka_do_grupy()     — trzeba mieć can_manage_members,
--   * add_group_creator_as_member() (`044`) — wyzwalacz przy tworzeniu grupy,
--   * seedy z SQL Editora           — działają jako właściciel tabeli, RLS ich
--                                     nie dotyczy.
DROP POLICY IF EXISTS "Users join groups" ON group_members;
