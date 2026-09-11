-- 141 — „Zapisy zamknięte": mecz gra się w tym składzie, ale NIE jest odwołany
--
-- DLACZEGO. Organizator z 10 osobami na 14 miejsc, który o 20:00 mówi „gramy
-- w tym składzie", ma dziś do wyboru dwie rzeczy i obie są złe:
--
--   • ZMNIEJSZYĆ LICZBĘ MIEJSC do 10 — co kłamie o meczu (na boisku jest
--     miejsce dla 14) i nie da się cofnąć bez ponownego liczenia, a przy
--     bramkarzach w trybie osobnej puli rozjeżdża pułapy ról;
--   • ODWOŁAĆ MECZ — co wysyła całemu składowi „mecz odwołany" (`139`, `140`),
--     czyli komunikat dokładnie odwrotny do prawdy.
--
-- Trzeciej możliwości nie było, choć jest to najczęstsza decyzja organizatora
-- w ostatnich godzinach przed meczem.
--
-- ---------------------------------------------------------------------------
-- CO TO ZNACZY, A CZEGO NIE ZNACZY
-- ---------------------------------------------------------------------------
-- Zamknięcie zapisów blokuje WYŁĄCZNIE wejście NOWEJ osoby. Kto jest w środku,
-- zostaje w środku — i to jest cała różnica wobec odwołania.
--
-- BLOKUJE:
--   • `dolacz_do_meczu()` — zapis konta, tak samo do składu jak na rezerwę.
--     Rezerwa też jest zapisem: człowiek, który staje w kolejce do meczu
--     rozstrzygniętego, czeka na coś, co nie nadejdzie;
--   • `dolacz_do_meczu_jako_goscie()` — zapis bez konta, w tym samym miejscu
--     i z tego samego powodu.
--
-- NIE BLOKUJE — i każde z tych „nie" jest decyzją, nie przeoczeniem:
--   • ORGANIZATORA DOPISUJĄCEGO GOŚCIA (`addGuest`). To nie jest zapis, tylko
--     świadome działanie osoby, która zapisy właśnie zamknęła. Zabranianie jej
--     tego znaczyłoby, że zamknięcie trzeba cofnąć, żeby dopisać kolegę, który
--     napisał na WhatsAppie — czyli że funkcja przeszkadza w rzeczy, dla której
--     powstała;
--   • OFERTY ZWOLNIONEGO MIEJSCA (`sync_reserve_claim`). Człowiek z kolejki
--     JEST już w meczu; dostanie miejsce, gdy ktoś się wypisze, to nie jest
--     nowy zapis, tylko dokończenie starego;
--   • WYPISANIA SIĘ. Zamknięte zapisy nie mogą nikogo trzymać siłą;
--   • PONOWNEGO WEJŚCIA GOŚCIA PO SWÓJ TOKEN. `dolacz_do_meczu_jako_goscie`
--     oddaje istniejący `claim_token`, gdy ten sam adres ma już wpis. Strażnik
--     stoi PO tych gałęziach, więc gość, który zapisał się przed zamknięciem
--     i wrócił po swój link, dalej go dostaje. Strażnik przed nimi zamieniłby
--     zamknięcie zapisów w odebranie ludziom dostępu do własnego wpisu.
--
-- ODWOŁANIE MECZU ZOSTAJE OSOBNYM STANEM. `status = 'cancelled'` znaczy „nie
-- gramy" i wysyła powiadomienia; `zapisy_zamkniete` znaczy „gramy, skład
-- zamknięty" i nie wysyła nic. Wspólna kolumna ze stanem („otwarty/zamknięty/
-- odwołany") wyglądałaby schludniej i byłaby błędem: te dwie rzeczy są
-- niezależne (mecz odwołany może mieć zapisy otwarte i to bez znaczenia),
-- a każdy warunek `status = 'cancelled'` w bazie i w kodzie trzeba by
-- przepisać — za każdą przepisaną linią stoi szansa, że coś zgubimy.
--
-- BEZ POWIADOMIEŃ, ŚWIADOMIE. Zamknięcie zapisów nie zmienia nic dla osoby,
-- która JEST w składzie — a tylko takie osoby mają dziś do kogo dostać
-- wiadomość. Mail o tym byłby przerwaniem dnia bez treści (patrz wąska lista
-- powodów w `140`).
--
-- STRAŻNIK JEST W BAZIE, NIE W INTERFEJSIE. Klucz `anon` siedzi jawnie
-- w paczce JS, więc schowany przycisk nie jest granicą. Obie funkcje zapisu są
-- `SECURITY DEFINER` i stanowią jedyne wejście do `event_participants` dla
-- zapisującego się — dlatego warunek wchodzi DO NICH, a nie do polityki RLS.
--
-- MIGRACJA JEST IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Kolumna
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS zapisy_zamkniete BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.zapisy_zamkniete IS
  'Organizator zamknął zapisy: nikt nowy nie wejdzie (ani do składu, ani na rezerwę), ale mecz się odbywa i skład zostaje. Rozłączne ze status = ''cancelled'' (migracja 141).';

-- `events` ma uprawnienia na poziomie TABELI, nie kolumn — `120` przeniosło
-- `blik_phone` do osobnej tabeli właśnie po to, żeby nie trzeba było odbierać
-- uprawnień kolumnowych i wywracać wszystkich `select('*')`. Nowa kolumna jest
-- więc czytelna od razu i nie wymaga własnego GRANT-a. Gdyby to się kiedyś
-- zmieniło, brak SELECT-a na tej kolumnie objawi się jako przełącznik, który
-- po odświeżeniu strony wraca do „otwarte".

-- ---------------------------------------------------------------------------
-- 2. Zapis konta — strażnik obok warunku o odwołaniu
-- ---------------------------------------------------------------------------
-- Ciało przepisane z `078` z jedną zmianą: `v_zamkniete` w SELECT-cie i warunek
-- niżej. Reszta zostaje znak w znak, łącznie z kolejnością `sync_reserve_claim`
-- przed liczeniem pojemności.
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
  v_zamkniete boolean;
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

  SELECT organizer_id, require_approval, status = 'cancelled',
         coalesce(zapisy_zamkniete, false)
    INTO v_organizator, v_wymaga_akceptacji, v_odwolany, v_zamkniete
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
  -- Strażnik PO teście „jesteś już zapisany": kto jest w środku, ma dostać
  -- swój komunikat, nie ten o zamkniętych zapisach.
  --
  -- Organizator jest wyjątkiem i to nie jest furtka dla wygody: to ta sama
  -- osoba, która zapisy zamknęła, a `addGuest` i tak pozwala jej dopisać kogo
  -- chce. Blokowanie jej własnego wpisu znaczyłoby, że musi odemknąć mecz,
  -- żeby dopisać samą siebie.
  IF v_zamkniete AND v_user <> v_organizator THEN
    RAISE EXCEPTION 'Zapisy na ten mecz są zamknięte';
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

-- ---------------------------------------------------------------------------
-- 3. Zapis gościa — strażnik PO gałęziach „już masz wpis"
-- ---------------------------------------------------------------------------
-- Ciało przepisane z `115`. Jedyna zmiana to blok oznaczony `141` — stoi tuż
-- przed `sync_reserve_claim`, czyli za wszystkimi wcześniejszymi `RETURN`-ami
-- oddającymi istniejący token. Gość zapisany przed zamknięciem dalej odzyskuje
-- swój wpis; blokujemy wyłącznie wstawienie NOWEGO wiersza.
CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN, has_account BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_pending boolean;
  v_wymaga_akceptacji boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
  v_ma_wpis boolean;
  v_ma_konto boolean;
BEGIN
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  SELECT require_approval INTO v_wymaga_akceptacji FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email_clean)
  ) INTO v_ma_konto;

  SELECT ep.claim_token, true
    INTO v_istniejacy_token, v_ma_wpis
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   ORDER BY (ep.claim_token IS NULL) DESC, ep.created_at
   LIMIT 1;

  IF v_ma_wpis THEN
    IF v_istniejacy_token IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, p_event_id, true, v_ma_konto;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true, v_ma_konto;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RETURN QUERY SELECT NULL::uuid, p_event_id, true, true;
    RETURN;
  END IF;

  -- `141` — dopiero tutaj wiadomo, że to NOWY wpis.
  IF EXISTS (SELECT 1 FROM events
              WHERE id = p_event_id AND coalesce(zapisy_zamkniete, false)) THEN
    RAISE EXCEPTION 'Zapisy na ten mecz są zamknięte';
  END IF;

  PERFORM sync_reserve_claim(p_event_id);

  v_pending := coalesce(v_wymaga_akceptacji, false);
  v_rezerwa := CASE WHEN v_pending THEN false
                    ELSE czy_na_rezerwe(p_event_id, p_bramkarz) END;

  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    v_pending
  )
  RETURNING event_participants.claim_token, p_event_id, false, v_ma_konto;
END;
$$;

GRANT EXECUTE ON FUNCTION dolacz_do_meczu(UUID, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;
