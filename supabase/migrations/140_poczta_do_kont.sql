-- 140 — poczta do uczestników Z KONTEM
--
-- DLACZEGO. Dziś gość BEZ konta bywa lepiej poinformowany niż uczestnik
-- Z kontem, i nie jest to przenośnia — to jest stan faktyczny po `133`:
--
--   • gość, który podał adres, dostaje mail przy zapisie, dzień przed meczem,
--     przy zmianie warunków i przy odwołaniu. Aplikacja obiecuje mu to wprost,
--     w podpisie pod polem e-maila: „Z adresem dostanie potwierdzenie,
--     przypomnienie dzień przed i wiadomość, gdyby mecz się zmienił albo
--     odwołał”;
--   • uczestnik z kontem dostaje wiersz w `notifications` (dzwonek) i push —
--     ale push TYLKO wtedy, gdy sam go włączył w przeglądarce. Kto nie włączył
--     i nie wejdzie do aplikacji, o odwołaniu meczu nie dowie się WCALE.
--
-- Aplikacja mówi to zresztą sama, w oknie odwołania: „Uczestnicy z kontem
-- dostaną powiadomienie w Bojo (i na telefon, jeśli je włączyli)”. To zdanie
-- jest uczciwe i dlatego tak niewygodne — opisuje kanał, który może nie
-- zadziałać, przy decyzji, której koszt ponosi ktoś inny niż decydujący.
--
-- Skutki bierze na siebie organizator: mecz odwołany, a trzy osoby przyjeżdżają
-- na boisko, bo nie miały włączonych powiadomień.
--
-- ---------------------------------------------------------------------------
-- CO TU JEST, A CZEGO ŚWIADOMIE NIE MA
-- ---------------------------------------------------------------------------
-- WĄSKA LISTA POWODÓW, cztery: odwołanie, zmiana terminu, zmiana warunków
-- i przywrócenie meczu (`139`). To jest dokładnie ten zbiór, przy którym
-- niedoręczenie kosztuje CZYJŚ WYJAZD NA BOISKO — i tylko on. Poczta jest
-- kanałem, który przerywa dzień; wysyłana przy byle czym przestaje być czytana,
-- a wtedy przestaje działać także przy rzeczach ważnych.
--
-- ŚWIADOMIE BEZ `przypomnienie_o_meczu`. Dzienny mail do całego składu każdego
-- meczu to inna skala (jeden mecz = kilkanaście maili DZIENNIE) i inna decyzja.
-- Push i dzwonek obsługują przypomnienia od `129` i to zostaje bez zmian.
--
-- ŚWIADOMIE BEZ `komplet_skladu`, `wiadomosc_w_meczu`, `prosba_o_dolaczenie`:
-- żadne z nich nie kończy się czyimś wyjazdem na boisko bez meczu.
--
-- OSOBNA KOLUMNA `mail_wylaczone`, nie współdzielona z `push_wylaczone` (`109`).
-- To są dwa różne kanały o różnej cenie pomyłki: wyłączenie pusha znaczy „nie
-- zawracaj mi telefonu”, wyłączenie poczty — „nie pisz do mnie”. Wspólna lista
-- kazałaby wybierać oba naraz, a to są różne decyzje. Przechowujemy WYŁĄCZONE,
-- nie włączone — ta sama zasada co w `109`: nowy powód wchodzi domyślnie
-- włączony i nie wymaga migracji danych.
--
-- WYZWALACZ STOI OBOK `wyslij_push_po_powiadomieniu` (`109`), nie zamiast niego.
-- Ta sama zasada, dla której `133` nie przepisywało `065`/`070`/`114`: każda
-- przepisana linia to okazja, żeby coś zgubić.
--
-- NIC NIE DORĘCZY, DOPÓKI KANAŁ NIE JEST WŁĄCZONY. `konfiguracja_poczty` jest
-- na produkcji pusta (wymaga weryfikacji domeny `bojo.pl` w Resend — SPF/DKIM,
-- poza repo), więc funkcja wychodzi CICHO. To jest zamierzone: migracja ma
-- dać się puścić dziś i zacząć działać w dniu, w którym domena przejdzie.
--
-- MIGRACJA JEST IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Czego użytkownik nie chce dostawać MAILEM
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mail_wylaczone TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.mail_wylaczone IS
  'Rodzaje powiadomień, których użytkownik NIE chce dostawać mailem. Pusta tablica = wszystko włączone. Osobno od push_wylaczone — to inny kanał i inna cena pomyłki (migracja 140).';

-- Idempotencja dla powodów meczowych: klucz musi zawierać MECZ, inaczej dwa
-- różne mecze odwołane tego samego dnia dałyby jeden mail. `maile_wyslane`
-- (`133`/`134`) ma dziś klucz (user_id, powod) bez daty — dobry dla powitania
-- („raz w życiu konta"), bezużyteczny tutaj.
ALTER TABLE maile_wyslane ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Stary indeks obejmował (user_id, powod) dla WSZYSTKICH powodów — z nim drugi
-- mail o czymkolwiek nigdy by nie wyszedł. Zawężamy go do powitania, a dla
-- powodów meczowych zakładamy własny, z meczem i dniem w kluczu.
DROP INDEX IF EXISTS maile_wyslane_konto;
CREATE UNIQUE INDEX IF NOT EXISTS maile_wyslane_konto_bez_meczu
  ON maile_wyslane (user_id, powod) WHERE user_id IS NOT NULL AND event_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS maile_wyslane_konto_mecz
  ON maile_wyslane (user_id, powod, event_id, dzien) WHERE user_id IS NOT NULL AND event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Wysyłka do konta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wyslij_mail_do_konta(p_user UUID, p_powod TEXT, p_event UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
  v_email  TEXT;
  v_imie   TEXT;
  v_w      RECORD;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  -- Brak konfiguracji = kanał jeszcze niewłączony. Wychodzimy CICHO: wyjątek
  -- tutaj wywróciłby operację, przy której jesteśmy wołani — a jest nią między
  -- innymi ODWOŁANIE MECZU.
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  -- Ustawienia sprawdzamy WCZEŚNIE: to najtańszy sposób na niewysłanie.
  IF EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = p_user AND p_powod = ANY(p.mail_wylaczone)
  ) THEN
    RETURN;
  END IF;

  -- Imię tą samą drogą co `wyslij_mail_powitalny()` (`134`) — trzy pola, bo
  -- Google i rejestracja hasłem wpisują je pod różnymi nazwami.
  SELECT u.email,
         nullif(btrim(coalesce(
           u.raw_user_meta_data ->> 'display_name',
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name', '')), '')
    INTO v_email, v_imie
    FROM auth.users u WHERE u.id = p_user;

  IF v_email IS NULL THEN RETURN; END IF;

  SELECT e.id, e.title, e.sport, e.event_date, e.event_time,
         coalesce(e.field_name, e.custom_location_name) AS miejsce, e.cost_grosz
    INTO v_w
    FROM events e WHERE e.id = p_event;
  IF v_w.id IS NULL THEN RETURN; END IF;

  BEGIN
    INSERT INTO maile_wyslane (user_id, powod, event_id) VALUES (p_user, p_powod, p_event);
  EXCEPTION WHEN unique_violation THEN
    RETURN;   -- ten sam powód, ten sam mecz, ta sama doba
  END;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object(
      'powod',    p_powod,
      'email',    v_email,
      'imie',     v_imie,
      'event_id', v_w.id,
      'tytul',    coalesce(v_w.title, v_w.sport),
      'data',     to_char(v_w.event_date, 'DD.MM.YYYY'),
      'godzina',  to_char(v_w.event_time, 'HH24:MI'),
      'miejsce',  v_w.miejsce,
      'koszt_grosz', v_w.cost_grosz,
      -- Odbiorca ma KONTO, więc dostaje link do ustawień, nie do wpisu gościa.
      'ma_konto', true
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Ta sama zasada co przy braku konfiguracji, ale dla awarii `pg_net`.
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION wyslij_mail_do_konta(UUID, TEXT, UUID) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wyzwalacz — OBOK pushowego, nie zamiast
-- ---------------------------------------------------------------------------
-- Cztery powody i ani jednego więcej. Lista jest tu, a nie w konfiguracji,
-- świadomie: dopisanie piątego ma wymagać migracji, czyli decyzji i przeglądu,
-- a nie wpisu w tabeli, który da się zrobić w pięć sekund o 23:00.
CREATE OR REPLACE FUNCTION wyslij_mail_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.type IN ('mecz_odwolany', 'zmiana_terminu', 'zmiana_warunkow_meczu', 'mecz_przywrocony') THEN
    PERFORM wyslij_mail_do_konta(NEW.user_id, NEW.type, NEW.event_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wyslij_mail_po_powiadomieniu ON notifications;
CREATE TRIGGER trg_wyslij_mail_po_powiadomieniu
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION wyslij_mail_po_powiadomieniu();

COMMENT ON FUNCTION wyslij_mail_do_konta(UUID, TEXT, UUID) IS
  'Poczta do uczestnika Z KONTEM — wyłącznie cztery powody, przy których niedoręczenie kończy się czyimś wyjazdem na boisko (migracja 140). Respektuje profiles.mail_wylaczone. Cicho wychodzi bez konfiguracji poczty.';
