-- 163: Gość bez konta widzi swoją płatność: sposób, status i numer BLIK
-- (W-4, docs/faza1-przejscie-e2e-plan.md).
--
-- DLACZEGO. Gracz z kontem ma na stronie meczu kartę „Twoja płatność”: kwotę
-- po zniżce kartowej, wybrany sposób, numer BLIK (godzinę przed meczem) i to,
-- czy organizator odhaczył wpłatę. Gość bez konta, czyli dokładnie ten, kogo
-- organizator przyprowadza linkiem „zapisujesz się bez zakładania konta”,
-- widział na stronie swojego wpisu (`/gracz/przejmij/[token]`) samą kwotę.
-- Numeru BLIK nie miał skąd wziąć: RLS na `event_blik` (120) słusznie nie
-- oddaje go anonimowi, a ta funkcja go nie zwracała. Organizator, który wpisał
-- numer w kreatorze, zakładał, że zobaczą go wszyscy z jego linku.
--
-- UPRAWNIENIEM JEST TOKEN WPISU — ten sam model co przy wypisaniu (128) i przy
-- ofercie zwolnionego miejsca (137). Reguła odsłonięcia numeru jest LUSTREM
-- `canSeeBlikPhone()` i `BLIK_PHONE_REVEAL_MINUTES = 60` z
-- `frontend/src/lib/payments.ts`: numer widzi osoba W SKŁADZIE (nie rezerwa,
-- nie czekający na akceptację, nie obserwujący), meczu nieodwołanego,
-- płatnego i przyjmującego BLIK, od godziny przed startem. Pilnuje tego
-- `frontend/src/__tests__/platnoscGoscia.test.ts`, czytający ten plik.
--
-- KSZTAŁT WYNIKU SIĘ ZMIENIA, więc DROP + CREATE (CREATE OR REPLACE nie pozwala
-- zmienić RETURNS TABLE) — wzorzec z 128 i 137. Pierwsze 15 kolumn jest bez
-- zmian względem 137, więc frontend sprzed tej migracji czyta wynik jak dotąd,
-- a frontend po niej ma wartości zapasowe na czas, zanim migracja dojdzie.
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
  -- Nowe od 163.
  metody_platnosci       text[],
  metoda_platnosci       text,
  karta_sportowa         boolean,
  znizka_karty_grosze    integer,
  pokaz_status_platnosci boolean,
  oplacone               boolean,
  -- Numer wyłącznie po spełnieniu reguły odsłonięcia; inaczej NULL.
  blik_telefon           text,
  -- „Numer będzie, ale jeszcze nie teraz” — żeby strona mogła powiedzieć,
  -- KIEDY się pojawi, zamiast milczeć.
  blik_pozniej           boolean
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
         (w.blik_dotyczy AND NOT w.blik_juz)
    FROM w;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;
