-- ============================================================================
-- 030_tournament_privacy_and_tweaks.sql
-- ----------------------------------------------------------------------------
--  • RODO: dane kontaktowe kapitana (telefon, e-mail) NIE mogą być publicznie
--    czytane. To, że gracz podał numer do organizacji turnieju, nie znaczy, że
--    zgodził się na pokazywanie go w internecie każdemu.
--  • Minimalny skład: 7 (pełen skład). Reszta zasad — osobny temat.
-- ============================================================================

-- ── 1. Ukryj kolumny kontaktowe przed publicznym odczytem ───────────────────
-- PostgREST mapuje ruch z aplikacji na role `anon` (niezalogowani) i
-- `authenticated` (zalogowani). Odbieramy im prawo SELECT na tych dwóch
-- kolumnach — INSERT/UPDATE zostaje nietknięty, więc kapitan dalej je zapisuje.
REVOKE SELECT (captain_phone, captain_email) ON tournament_teams FROM anon;
REVOKE SELECT (captain_phone, captain_email) ON tournament_teams FROM authenticated;

-- ── 2. Kontakty widoczne tylko dla admina (kontrolowana funkcja) ─────────────
-- Admin potrzebuje numerów, by skontaktować się z drużynami. SECURITY DEFINER
-- omija RLS, ale w środku twardo sprawdzamy flagę is_admin wywołującego.
CREATE OR REPLACE FUNCTION admin_team_contacts(p_tournament uuid)
RETURNS TABLE (
  team_id       uuid,
  team_name     text,
  captain_name  text,
  captain_phone text,
  captain_email text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.captain_name, t.captain_phone, t.captain_email
  FROM tournament_teams t
  WHERE t.tournament_id = p_tournament
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  ORDER BY t.created_at
$$;

-- ── 3. Minimalny skład 7 zawodników ─────────────────────────────────────────
ALTER TABLE tournaments
  ALTER COLUMN min_squad SET DEFAULT 7;

UPDATE tournaments
   SET min_squad = 7,
       max_squad = GREATEST(max_squad, 12)
 WHERE slug = 'community-cup-2026';
