-- 098: Nadawanie i odbieranie admina przestaje po cichu nie działać.
--
-- OBJAW: przełącznik admin/użytkownik na `/admin/uzytkownicy` „nic nie robi" —
-- przełącza się na ekranie (optymistyczna aktualizacja), a po odświeżeniu
-- wraca do stanu sprzed kliknięcia.
--
-- PRZYCZYNA: polityka z migracji `022` sprawdza uprawnienie zapytaniem
-- o TĘ SAMĄ tabelę, na której siedzi:
--
--     CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
--       USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));
--
-- Podzapytanie o `profiles` wewnątrz polityki `profiles` samo podlega RLS tej
-- tabeli. Postgres albo zgłasza „infinite recursion detected in policy", albo —
-- gdy rekurencję utnie polityka SELECT — po prostu nie znajduje wiersza
-- i warunek wychodzi FAŁSZ. Wtedy UPDATE aktualizuje ZERO wierszy i zwraca
-- sukces: cisza, żadnego błędu, przycisk „nic nie robi".
--
-- ROZWIĄZANIE: sprawdzenie wyjeżdża do funkcji `SECURITY DEFINER`, która
-- czyta `profiles` z pominięciem RLS. To ten sam wzorzec, którego repo używa
-- już przy powiadomieniach (`065`, `070`) — funkcja działa z uprawnieniami
-- właściciela, więc podzapytanie nie wraca do polityki, z której wyszło.
--
-- `STABLE`, bo wynik nie zmienia się w obrębie jednego zapytania — Postgres
-- może dzięki temu wywołać ją raz na zapytanie, a nie raz na wiersz.

CREATE OR REPLACE FUNCTION public.czy_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
-- Pusty search_path: funkcja SECURITY DEFINER bez tego daje się nabrać na
-- podstawioną tabelę `profiles` w schemacie z wyższym priorytetem.
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.czy_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.czy_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
  USING      (public.czy_admin())
  WITH CHECK (public.czy_admin());

-- Ta sama rekurencja siedzi w politykach z `005`. `events` i `fields` to inne
-- tabele niż `profiles`, więc pętli tam nie ma — ale podzapytanie i tak
-- odpytuje `profiles` przez RLS, co przy zaostrzeniu polityk na `profiles`
-- wywróciłoby je po cichu w ten sam sposób. Przepinamy na tę samą funkcję,
-- żeby uprawnienie administratora było liczone w JEDNYM miejscu.
DROP POLICY IF EXISTS "Admins can update any event" ON events;
CREATE POLICY "Admins can update any event"
  ON events FOR UPDATE
  USING      (public.czy_admin())
  WITH CHECK (public.czy_admin());
