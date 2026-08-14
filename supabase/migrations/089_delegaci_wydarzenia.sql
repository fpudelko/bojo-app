-- 089: Delegowanie uprawnień organizatora — dla meczów, gdzie organizator nie
-- gra albo dzieli się obowiązkami z kimś zaufanym z ekipy.
--
-- Delegatem może zostać wyłącznie osoba już powiązana z meczem: uczestnik
-- (regularny, z kontem) albo — jeśli mecz jest przypięty do grupy — członek
-- tej grupy. Bez nowego mechanizmu zaproszeń: to zawsze ktoś, kogo organizator
-- już zna z kontekstu meczu/grupy (patrz frontend/src/lib/eventDelegates.ts).
--
-- Trzy niezależne przełączniki, bo różni ludzie dostają różny zakres zaufania:
--   can_edit             — jak organizator: termin, miejsce, ustawienia,
--                          odwołanie meczu. Fizyczne USUNIĘCIE zostaje tylko
--                          dla prawdziwego organizatora/admina.
--   can_manage_squad     — dzieli drużyny, wpisuje wynik, dodaje/usuwa
--                          uczestników, akceptuje prośby o dołączenie,
--                          zaprasza gości, oznacza nieobecność.
--   can_manage_payments  — oznacza kto zapłacił, zmienia zaakceptowane metody
--                          płatności i numer BLIK, wysyła rozliczenie.
--
-- Samą listę delegatów zarządza WYŁĄCZNIE prawdziwy organizator (nie inny
-- delegat, nawet z can_edit) — inaczej powstałby łańcuch przekazywania
-- uprawnień, którego nikt by nie kontrolował.

CREATE TABLE IF NOT EXISTS event_delegates (
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit             BOOLEAN NOT NULL DEFAULT false,
  can_manage_squad     BOOLEAN NOT NULL DEFAULT false,
  can_manage_payments  BOOLEAN NOT NULL DEFAULT false,
  granted_by           UUID NOT NULL REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id),
  -- Wiersz bez żadnego uprawnienia nie ma sensu — UI usuwa go zamiast
  -- zapisywać same "false", ale to zabezpieczenie na wypadek błędu w kliencie.
  CONSTRAINT at_least_one_permission CHECK (can_edit OR can_manage_squad OR can_manage_payments)
);

CREATE INDEX IF NOT EXISTS idx_event_delegates_user ON event_delegates (user_id);

ALTER TABLE event_delegates ENABLE ROW LEVEL SECURITY;

-- Widzi organizator (żeby zarządzać listą), sam zainteresowany (żeby UI
-- wiedziało, co może) i admin.
DROP POLICY IF EXISTS "Organizer, self and admin read delegates" ON event_delegates;
CREATE POLICY "Organizer, self and admin read delegates"
  ON event_delegates FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  );

-- Pisze WYŁĄCZNIE prawdziwy organizator (+ admin, spójnie z resztą admin-owych
-- wyjątków w bazie, np. 040_admin_delete_events.sql).
DROP POLICY IF EXISTS "Only organizer or admin manages delegates" ON event_delegates;
CREATE POLICY "Only organizer or admin manages delegates"
  ON event_delegates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  );

-- ---- Trzy pomocnicze funkcje do użycia w politykach innych tabel ----
-- Osobne funkcje (nie jedna z parametrem tekstowym) celowo: literówka w
-- nazwie kolumny przy tworzeniu polityki da błąd składni SQL od razu, a nie
-- ciche "zawsze false" przy literówce w stringu. SECURITY DEFINER + search_path,
-- bo wywołanie z wnętrza polityki RLS innej tabeli inaczej mogłoby się nie
-- powieść przez brak uprawnień do odczytu event_delegates/events w kontekście
-- wywołującego (wzorzec jak w istniejących funkcjach SECURITY DEFINER, np.
-- zglos_brak_pelnej_nazwy z migracji 086).

CREATE OR REPLACE FUNCTION can_edit_event(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_delegates WHERE event_id = p_event_id AND user_id = auth.uid() AND can_edit);
$$;

CREATE OR REPLACE FUNCTION can_manage_squad(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_delegates WHERE event_id = p_event_id AND user_id = auth.uid() AND (can_edit OR can_manage_squad));
$$;

CREATE OR REPLACE FUNCTION can_manage_payments(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_delegates WHERE event_id = p_event_id AND user_id = auth.uid() AND (can_edit OR can_manage_payments));
$$;

GRANT EXECUTE ON FUNCTION can_edit_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_squad(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_payments(UUID) TO authenticated;
