-- Jedno źródło prawdy dla reguły „skład czy rezerwa"
--
-- DLACZEGO
-- Ta sama reguła istniała w dwóch implementacjach: `decydujCzyRezerwa()`
-- w TypeScripcie (wołane przy zapisie, akceptacji prośby i dopisaniu gościa)
-- oraz `sync_reserve_claim()` w SQL (wołane, gdy zwolni się miejsce). Rozjazd
-- między nimi NIE daje błędu — daje niespójność: gracz wchodzi do składu,
-- a kolejka i tak trzyma go w rezerwie, albo odwrotnie: kolejka proponuje
-- miejsce, którego zapis nie uzna za wolne.
--
-- Przy każdej zmianie reguł (limit bramkarzy w `075`, tryb rezerwacji w `077`)
-- trzeba było pamiętać o obu miejscach i ręcznie pilnować, żeby liczyły tak
-- samo. To działało dopóki działało.
--
-- Po tej migracji regułę zna wyłącznie `czy_na_rezerwe()`. TypeScript nie
-- decyduje o niczym — pyta albo woła `dolacz_do_meczu()`.

-- ---------------------------------------------------------------------------
-- 1. Reguła: czy zapis w danej roli trafia na rezerwę
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION czy_na_rezerwe(p_event_id UUID, p_bramkarz BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int; v_max_gk int; v_gk_enabled boolean; v_gk_reserved boolean;
  v_pole int; v_bramkarze int; v_zajete int;
BEGIN
  SELECT max_players, max_goalkeepers, goalkeepers_enabled, goalkeeper_slots_reserved
    INTO v_max, v_max_gk, v_gk_enabled, v_gk_reserved
    FROM events WHERE id = p_event_id;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Liczymy tak samo jak `sync_reserve_claim`: bez rezerwowych, bez próśb
  -- czekających na akceptację i bez obserwujących. Wpisy z aktywną ofertą
  -- miejsca (`claim_offered_at`) TRZYMAJĄ miejsce, więc liczą się do zajętych —
  -- inaczej dwie osoby dostałyby to samo miejsce.
  SELECT
    count(*) FILTER (WHERE NOT is_goalkeeper),
    count(*) FILTER (WHERE is_goalkeeper)
    INTO v_pole, v_bramkarze
    FROM event_participants
   WHERE event_id = p_event_id
     AND pending_approval = false
     AND rsvp <> 'maybe'
     AND (is_reserve = false OR claim_offered_at IS NOT NULL);

  v_zajete := v_pole + v_bramkarze;

  IF NOT v_gk_enabled THEN
    RETURN v_zajete >= v_max;
  END IF;

  IF v_gk_reserved THEN
    IF p_bramkarz THEN
      RETURN v_bramkarze >= v_max_gk;
    END IF;
    RETURN v_pole >= GREATEST(0, v_max - v_max_gk);
  END IF;

  -- Wspólna pula: o miejsce konkurują wszyscy, bramkarze mają dodatkowo
  -- własny sufit.
  IF v_zajete >= v_max THEN
    RETURN true;
  END IF;
  RETURN p_bramkarz AND v_bramkarze >= v_max_gk;
END;
$$;

GRANT EXECUTE ON FUNCTION czy_na_rezerwe(UUID, BOOLEAN) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dołączanie do meczu jako jedna operacja
-- ---------------------------------------------------------------------------
-- Wcześniej zapis był sekwencją czterech kroków po stronie przeglądarki:
-- odśwież kolejkę → wczytaj ustawienia meczu → policz pojemność → wstaw wiersz.
-- Między krokiem trzecim a czwartym mogło wejść dwóch graczy naraz i obaj
-- dostawali to samo ostatnie miejsce. Tutaj to jedna transakcja.
--
-- SECURITY DEFINER, bo funkcja czyta ustawienia meczu i cudze wpisy, żeby
-- policzyć pojemność. Tożsamość bierzemy z `auth.uid()` — nie z argumentu —
-- więc nikt nie zapisze na mecz kogoś innego.
CREATE OR REPLACE FUNCTION dolacz_do_meczu(
  p_event_id UUID,
  p_nazwa TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false,
  p_dostawca_karty TEXT DEFAULT NULL
)
RETURNS TABLE (is_reserve BOOLEAN, pending BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_organizator uuid;
  v_wymaga_akceptacji boolean;
  v_odwolany boolean;
  v_rezerwa boolean;
  v_pending boolean;
  v_nazwa text := btrim(p_nazwa);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby dołączyć';
  END IF;
  IF v_nazwa = '' OR length(v_nazwa) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  SELECT organizer_id, require_approval, status = 'cancelled'
    INTO v_organizator, v_wymaga_akceptacji, v_odwolany
    FROM events WHERE id = p_event_id;

  IF v_organizator IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;
  IF v_odwolany THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;
  IF EXISTS (SELECT 1 FROM event_participants
              WHERE event_id = p_event_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz';
  END IF;

  -- Wygasłe oferty muszą przepaść ZANIM policzymy pojemność, inaczej martwa
  -- oferta blokowałaby miejsce nowemu chętnemu.
  PERFORM sync_reserve_claim(p_event_id);

  -- Organizator nie akceptuje sam siebie.
  v_pending := v_wymaga_akceptacji AND v_user <> v_organizator;
  v_rezerwa := CASE WHEN v_pending THEN false
                    ELSE czy_na_rezerwe(p_event_id, p_bramkarz) END;

  INSERT INTO event_participants (
    event_id, user_id, name, is_guest, is_reserve, is_goalkeeper,
    pending_approval, payment_method, has_sports_card, sports_card_provider
  ) VALUES (
    p_event_id, v_user, v_nazwa, false, v_rezerwa, p_bramkarz,
    v_pending, p_metoda_platnosci, p_karta_sportowa,
    CASE WHEN p_karta_sportowa THEN p_dostawca_karty ELSE NULL END
  );

  RETURN QUERY SELECT v_rezerwa, v_pending;
END;
$$;

GRANT EXECUTE ON FUNCTION dolacz_do_meczu(UUID, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. sync_reserve_claim korzysta z tej samej reguły
-- ---------------------------------------------------------------------------
-- Funkcja rozdaje zwolnione miejsca, więc pyta odwrotnie niż zapis: „czy jest
-- miejsce dla kogoś w tej roli", czyli `NOT czy_na_rezerwe(...)`. Dzięki temu
-- reguła istnieje fizycznie w jednym miejscu — poprzednia wersja liczyła pułapy
-- własnym kodem, równoległym do TypeScriptu.
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_hours, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_hours, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_hours IS NULL OR v_started THEN RETURN; END IF;

  -- Wygasłe oferty przepadają — dopiero potem cokolwiek liczymy.
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- Zawodnicy z pola
  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;

  -- Bramkarze — osobna kolejka. Pytanie zadajemy PONOWNIE, bo powyższa oferta
  -- mogła właśnie zająć ostatnie miejsce ze wspólnej puli (tryb `077`).
  IF v_gk_enabled AND NOT czy_na_rezerwe(p_event_id, true) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;
