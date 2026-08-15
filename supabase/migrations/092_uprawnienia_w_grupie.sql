-- 092: Uprawnienia w grupie — założyciel dzieli się obowiązkami z ekipą.
--
-- Dziś w grupie są dokładnie dwie władze: założyciel (`groups.created_by`)
-- może wszystko, każdy inny nie może nic poza wyjściem z grupy. Kolumna
-- `role` z migracji `044` obiecuje więcej, ale nie ma polityki UPDATE na
-- `group_members`, więc z przeglądarki NIE DA SIĘ jej zmienić — 'admin'
-- dostaje wyłącznie twórca, z wyzwalacza. Efekt: ekipa, w której organizuje
-- trzech ludzi, ma jedno konto z kluczami i dwa proszące o przysługę.
--
-- Trzy niezależne przełączniki, wzorem `event_delegates` z migracji `089` —
-- różni ludzie dostają różny zakres zaufania:
--   can_manage_members — dopisuje i usuwa graczy z grupy,
--   can_create_events  — zakłada mecze przypięte do grupy,
--   can_moderate_wall  — kasuje cudze wpisy z tablicy grupy (migracja `093`).
--
-- DLACZEGO PRZEŁĄCZNIKI, A NIE ROZSZERZENIE `role` O TRZECIĄ WARTOŚĆ.
-- "Kasuje spam z tablicy" i "wyrzuca ludzi z ekipy" to dwa różne poziomy
-- zaufania; jedna wartość enuma skleja je na stałe. Do tego zmiana wartości
-- CHECK-a ('admin'/'member') wywróciłaby żywy kod: `lib/groups.ts` wstawia
-- role='member' przy dołączeniu, `GroupDetailClient` czyta role==='admin',
-- a `seed_test_groups.sql` wstawia obie.
--
-- `role` ZOSTAJE, ale przestaje być źródłem prawdy: wyzwalacz
-- `ustaw_role_czlonka()` wylicza ją z przełączników przy każdym zapisie
-- i nadpisuje to, co przysłał klient. Dzięki temu stary czytelnik (odznaka
-- "admin" na liście członków) działa dalej, a rozjazd między dwoma zapisami
-- tej samej informacji jest fizycznie niemożliwy.
--
-- ZAŁOŻYCIELA NIE DA SIĘ ZDEGRADOWAĆ. Jego moc nie siedzi w przełącznikach,
-- tylko w `groups.created_by` — funkcje pomocnicze pytają najpierw o to.
-- Wyzwalacz dodatkowo wymusza mu wszystkie trzy `true`, więc nawet UPDATE
-- wycelowany w jego wiersz niczego nie odbiera.
--
-- LISTĄ UPRAWNIEŃ ZARZĄDZA WYŁĄCZNIE ZAŁOŻYCIEL — nie współorganizator
-- z can_manage_members. Ten sam powód co w `089`: inaczej powstaje łańcuch
-- przekazywania uprawnień, którego nikt nie kontroluje. can_manage_members
-- pozwala dodać i usunąć CZŁONKA, nie nadać komuś praw.

-- ---------------------------------------------------------------------------
-- 1. Kolumny + backfill
-- ---------------------------------------------------------------------------
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS can_manage_members BOOLEAN NOT NULL DEFAULT false,
  -- true, NIE false: dziś KAŻDY członek może założyć mecz i przypiąć go do
  -- grupy (WybierzGrupeDialog). Domyślne false odebrałoby to w dniu wgrania
  -- migracji wszystkim poza założycielem — to nie jest ta zmiana. Flaga
  -- istnieje po to, żeby dało się ją ODEBRAĆ.
  ADD COLUMN IF NOT EXISTS can_create_events  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_moderate_wall  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS granted_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: dotychczasowy 'admin' (tylko twórca, wpisywany triggerem) dostaje komplet.
UPDATE group_members SET can_manage_members = true, can_create_events = true,
                         can_moderate_wall = true
 WHERE role = 'admin';

-- ---------------------------------------------------------------------------
-- 2. `role` jako etykieta wyliczana z przełączników
-- ---------------------------------------------------------------------------
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
    NEW.role := 'admin';
  ELSIF NEW.can_manage_members OR NEW.can_moderate_wall THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := 'member';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ustaw_role_czlonka ON group_members;
CREATE TRIGGER trg_ustaw_role_czlonka
  BEFORE INSERT OR UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION ustaw_role_czlonka();

-- Wyrównanie wierszy, które istniały przed wyzwalaczem.
UPDATE group_members SET role = role;

COMMENT ON COLUMN group_members.role IS
  'Etykieta WYLICZANA z can_* przez trigger ustaw_role_czlonka (092). Zapis wprost jest nadpisywany.';

-- ---------------------------------------------------------------------------
-- 3. Funkcje pomocnicze do polityk RLS INNYCH tabel
-- ---------------------------------------------------------------------------
-- PUŁAPKA, KTÓREJ TE FUNKCJE UNIKAJĄ: polityka na `group_members`, która
-- w warunku robi `EXISTS (SELECT 1 FROM group_members …)`, wywraca się przy
-- pierwszym odczycie — Postgres zgłasza "infinite recursion detected in
-- policy for relation group_members". Nie widać tego przy CREATE POLICY,
-- tylko na produkcji.
--
-- Wyjście: SECURITY DEFINER. Funkcja wykonuje się z prawami właściciela
-- tabeli (roli, która puściła migrację w SQL Editorze), do którego RLS się
-- nie stosuje (nie włączono FORCE ROW LEVEL SECURITY) — wewnętrzny SELECT
-- widzi więc wszystkie wiersze i żadna polityka nie jest wywoływana ponownie.
-- Ten sam manewr, co `can_edit_event()` w `089`.
--
-- Osobne funkcje, nie jedna z parametrem tekstowym — literówka w nazwie
-- kolumny wywali się błędem składni od razu, a nie cichym "zawsze false".
--
-- GRANT dla `anon` I `authenticated` — inaczej niż w `089`, gdzie wystarczył
-- `authenticated`. Strona grupy renderuje się kluczem anonimowym
-- (`app/grupy/[id]/page.tsx`), a wylogowany odwiedzający jest rolą `anon`.
-- Bez grantu dla `anon` polityka SELECT na `group_posts` (`093`) zwróci
-- `permission denied for function`, a nie pustą listę.

CREATE OR REPLACE FUNCTION czy_zalozyciel_grupy(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid());
$$;

CREATE OR REPLACE FUNCTION czy_czlonek_grupy(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION czy_moze_zarzadzac_grupa(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid()
                    AND m.can_manage_members);
$$;

CREATE OR REPLACE FUNCTION czy_moze_tworzyc_wydarzenia_w_grupie(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid()
                    AND m.can_create_events);
$$;

CREATE OR REPLACE FUNCTION czy_moze_moderowac_tablice(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid()
                    AND m.can_moderate_wall);
$$;

GRANT EXECUTE ON FUNCTION czy_zalozyciel_grupy(UUID)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_czlonek_grupy(UUID)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_moze_zarzadzac_grupa(UUID)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_moze_tworzyc_wydarzenia_w_grupie(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_moze_moderowac_tablice(UUID)           TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Polityki na group_members i groups
-- ---------------------------------------------------------------------------
-- SELECT na obu tabelach zostaje `USING (true)` z `044` — listy członków są
-- pokazywane na publicznej stronie grupy, a `getDelegateCandidates()` (`089`)
-- czyta je dla meczu przypiętego do grupy.

-- Nowość: uprawnienia da się w ogóle zmienić. Tylko założyciel (+ admin
-- platformy, spójnie z `040`/`063`/`089`).
DROP POLICY IF EXISTS "Zalozyciel zmienia uprawnienia czlonka" ON group_members;
CREATE POLICY "Zalozyciel zmienia uprawnienia czlonka" ON group_members FOR UPDATE
  USING (
    czy_zalozyciel_grupy(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  )
  WITH CHECK (
    czy_zalozyciel_grupy(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

-- Wyrzucić może zarządzający; założyciela nie wyrzuci NIKT poza nim samym.
DROP POLICY IF EXISTS "Leave or be removed by creator" ON group_members;
DROP POLICY IF EXISTS "Wyjscie albo usuniecie przez zarzadzajacego" ON group_members;
CREATE POLICY "Wyjscie albo usuniecie przez zarzadzajacego" ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR (
      czy_moze_zarzadzac_grupa(group_id)
      AND user_id IS DISTINCT FROM (SELECT g.created_by FROM groups g WHERE g.id = group_id)
    )
  );

-- Ustawienia grupy edytuje założyciel albo zarządzający. USUNIĘCIE grupy
-- zostaje wyłącznie przy założycielu (polityka "Creator deletes group" bez zmian).
DROP POLICY IF EXISTS "Creator updates group" ON groups;
CREATE POLICY "Zalozyciel lub zarzadzajacy edytuje grupe" ON groups FOR UPDATE
  USING (czy_moze_zarzadzac_grupa(id)) WITH CHECK (czy_moze_zarzadzac_grupa(id));

-- ---------------------------------------------------------------------------
-- 5. Przypięcie meczu do grupy wymaga can_create_events
-- ---------------------------------------------------------------------------
-- WYZWALACZ, NIE POLITYKA RLS — świadomie. `WITH CHECK` przy UPDATE nie widzi
-- wiersza SPRZED zmiany, więc warunek "group_id musi być dozwolony" blokowałby
-- KAŻDĄ edycję meczu przypiętego do grupy, także zmianę godziny przez
-- organizatora, który tymczasem wyszedł z grupy. Wyzwalacz porównuje OLD
-- z NEW i pilnuje wyłącznie MOMENTU przypięcia. Dodatkowo rzuca czytelny
-- wyjątek zamiast po cichu zaktualizować zero wierszy (patrz AGENTS.md).
CREATE OR REPLACE FUNCTION pilnuj_uprawnien_do_grupy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
    RETURN NEW;  -- grupa się nie zmienia — nie nasza sprawa
  END IF;
  -- auth.uid() IS NULL = wywołanie spoza sesji przeglądarki (seedy z SQL
  -- Editora, admin, przyszłe zadania w tle) — ten sam warunek co w
  -- utworz_termin_serii() (073): „cron nie działa w niczyim imieniu", więc
  -- kontrolę uprawnień egzekwujemy tylko wtedy, gdy REALNIE jest czyjaś
  -- sesja do sprawdzenia. Bez tego seed_test_groups.sql (INSERT jako
  -- właściciel tabeli, auth.uid() = NULL) wywalał się na każdym meczu
  -- przypiętym do grupy — złapane przez ./scripts/baza-testowa.sh.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Termin serii cyklicznej dziedziczy grupę po poprzednim terminie, który był
  -- sprawdzony przy tworzeniu. `utworz_termin_serii()` (073) robi
  -- `INSERT INTO events VALUES (v_wzor.*)`, kopiując group_id, i bywa wołana
  -- w kontekście, w którym auth.uid() nie należy do grupy — bez tego wyjątku
  -- generowanie serii przestałoby działać.
  IF TG_OP = 'INSERT' AND NEW.recurring_event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT czy_moze_tworzyc_wydarzenia_w_grupie(NEW.group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby dodać mecz do tej grupy';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilnuj_uprawnien_do_grupy ON events;
CREATE TRIGGER trg_pilnuj_uprawnien_do_grupy
  BEFORE INSERT OR UPDATE OF group_id ON events
  FOR EACH ROW EXECUTE FUNCTION pilnuj_uprawnien_do_grupy();
