-- 168: gość dopisany przez organizatora sam podaje e-mail pod linkiem swojego
-- zapisu (Z-5, docs/faza1-runda10-plan.md).
--
-- DLACZEGO. Organizator dopisuje ludzi ręką („Dopisz osobę bez konta") i zwykle
-- nie zna ich adresów: na produkcji 29 z 29 takich wpisów z ostatnich 60 dni
-- nie ma e-maila, więc ci ludzie nie dostają ani potwierdzenia, ani „jutro
-- grasz", ani wiadomości o odwołaniu. Organizator może im wysłać link do
-- zapisu — od tej migracji zostawią tam adres sami, bez zakładania konta.
--
-- TOKEN JEST UPRAWNIENIEM (wzorzec `128`/`137`). Adres ustawia się TYLKO, gdy
-- go jeszcze nie ma: link, który wyciekł, nie może przekierować istniejącego
-- kanału — pomyłkę w adresie poprawia organizator (usuń i dopisz ponownie).
--
-- KSZTAŁT WYNIKU SIĘ ZMIENIA (dokłada `ma_email`), więc DROP + CREATE — ten sam
-- wzorzec co `128`/`137`/`163`. Pierwsze 21 kolumn bez zmian względem `163`.
-- Idempotentna: drugie uruchomienie robi dokładnie to samo.

DROP FUNCTION IF EXISTS podejrzyj_wpis_goscia(uuid);
CREATE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  imie                   text,
  event_id               uuid,
  tytul                  text,
  data_meczu             date,
  godzina                time,
  miejsce                text,
  juz_przejety           boolean,
  status_meczu           text,
  na_rezerwie            boolean,
  czeka_na_akceptacje    boolean,
  koszt_grosze           integer,
  w_skladzie             integer,
  max_graczy             integer,
  mozna_zmieniac         boolean,
  oferta_do              timestamptz,
  metody_platnosci       text[],
  metoda_platnosci       text,
  karta_sportowa         boolean,
  znizka_karty_grosze    integer,
  pokaz_status_platnosci boolean,
  oplacone               boolean,
  blik_telefon           text,
  blik_pozniej           boolean,
  -- Nowe od 168. Sam FAKT, nie treść adresu (`guest_email` od migracji `127`
  -- nie wychodzi przez to API do anon) — strona wie, czy pokazać pole.
  ma_email               boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT p.*, e.id AS e_id, e.title, e.sport, e.event_date, e.event_time,
           e.field_name, e.custom_location_name, e.custom_address, e.status AS e_status,
           e.cost_grosz, e.max_players, e.reserve_claim_minutes,
           e.accepted_payment_methods, e.sports_card_discount_grosz, e.show_payment_status,
           b.blik_phone,
           (NOT coalesce(p.is_reserve, false) AND NOT coalesce(p.pending_approval, false)
             AND coalesce(p.rsvp, 'yes') <> 'maybe'
             AND e.status <> 'cancelled' AND coalesce(e.cost_grosz, 0) > 0
             AND 'blik' = ANY (coalesce(e.accepted_payment_methods, '{}'))
             AND b.blik_phone IS NOT NULL) AS blik_dotyczy,
           ((e.event_date + e.event_time) - interval '60 minutes'
             <= (now() AT TIME ZONE 'Europe/Warsaw')) AS blik_juz
      FROM event_participants p
      JOIN events e ON e.id = p.event_id
      LEFT JOIN event_blik b ON b.event_id = e.id
     WHERE p.claim_token = p_token
  )
  SELECT w.name, w.e_id, coalesce(w.title, w.sport), w.event_date, w.event_time,
         coalesce(w.field_name, w.custom_location_name, w.custom_address, 'Boisko'),
         (w.claimed_at IS NOT NULL OR w.user_id IS NOT NULL),
         w.e_status,
         coalesce(w.is_reserve, false),
         coalesce(w.pending_approval, false),
         coalesce(w.cost_grosz, 0),
         (SELECT count(*)::int FROM event_participants x
           WHERE x.event_id = w.e_id AND x.pending_approval IS NOT TRUE
             AND x.rsvp <> 'maybe' AND x.is_reserve IS NOT TRUE),
         w.max_players,
         (w.claimed_at IS NULL AND w.user_id IS NULL AND w.is_guest
          AND (w.event_date + w.event_time) > (now() AT TIME ZONE 'Europe/Warsaw')),
         CASE WHEN w.claim_offered_at IS NULL THEN NULL
              ELSE w.claim_offered_at
                   + (coalesce(w.reserve_claim_minutes, 180) || ' minutes')::interval
         END,
         coalesce(w.accepted_payment_methods, '{}'),
         w.payment_method,
         coalesce(w.has_sports_card, false),
         w.sports_card_discount_grosz,
         coalesce(w.show_payment_status, false),
         coalesce(w.has_paid, false),
         CASE WHEN w.blik_dotyczy AND w.blik_juz THEN w.blik_phone END,
         (w.blik_dotyczy AND NOT w.blik_juz),
         (w.guest_email IS NOT NULL)
    FROM w;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gość ustawia adres pod swoim linkiem — TYLKO gdy go jeszcze nie ma.
-- ---------------------------------------------------------------------------
-- Walidacja e-maila lustrem `dolacz_do_meczu_jako_goscie()` (`082`): prymitywna
-- (`LIKE '%@%.%'` + limit 100 znaków), pełną robi Supabase Auth przy zakładaniu
-- konta. `UPDATE ... WHERE guest_email IS NULL` w jednym zapytaniu jest samo
-- w sobie odpornością na wyścig — dwa równoległe wywołania nie mogą obie
-- wygrać, drugie dostanie zero wierszy.
CREATE OR REPLACE FUNCTION ustaw_email_goscia(p_token uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id    uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF length(v_email) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  UPDATE event_participants p
     SET guest_email = v_email
    FROM events e
   WHERE p.claim_token = p_token
     AND e.id = p.event_id
     AND p.is_guest AND p.user_id IS NULL AND p.claimed_at IS NULL
     AND p.guest_email IS NULL
     AND e.status <> 'cancelled'
     AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw')
  RETURNING p.id INTO v_id;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  -- Potwierdzenie od razu, na tym samym powodzie co pierwszy zapis gościa
  -- (`133`) — trzy warianty treści (skład / rezerwa / poczekalnia) już
  -- istnieją w `powiadom-goscia/tresc.ts`. Wyzwalacz `trg_powiadom_goscia_o_zapisie`
  -- (`133`) reaguje wyłącznie na INSERT, więc przy UPDATE trzeba wywołać wprost.
  PERFORM wyslij_mail_do_goscia(v_id, 'zapis');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION ustaw_email_goscia(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION ustaw_email_goscia(uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION ustaw_email_goscia(uuid, text) IS
  'Gość bez konta zostawia e-mail pod swoim linkiem zapisu (Z-5). Adres ustawia '
  'się tylko raz — token jest uprawnieniem, nie hasłem, więc nie wolno mu '
  'pozwolić nadpisać cudzego kanału.';

-- ---------------------------------------------------------------------------
-- Sprawdzone przy pisaniu tej migracji (nie decyzja, weryfikacja z AGENTS.md):
-- żaden wyzwalacz AFTER/BEFORE UPDATE na `event_participants` nie odpala się
-- na samej zmianie `guest_email`. `trg_pilnuj_wlasnego_wpisu` (BEFORE, `135`)
-- wychodzi wcześnie dla `current_user NOT IN ('authenticated','anon')` — funkcja
-- SECURITY DEFINER wywołana tutaj biegnie jako właściciel, nie jako `anon`.
-- `trg_powiadom_o_akceptacji` (`076`) sprawdza konkretne przejście
-- `pending_approval`; `trg_powiadom_o_zmianie_kompletu` (`079`) i
-- `trg_powiadom_o_progu_gry` (`097`) liczą różnicę AFTER/BEFORE z
-- `is_reserve`/`pending_approval` OLD i NEW — przy niezmienionych polach
-- wychodzi zero, więc żadne powiadomienie o składzie nie leci.
