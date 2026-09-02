-- 128: Gość bez konta przestaje być ulicą jednokierunkową.
--
-- PO CO. „Dołącz bez konta" (migracja `082`) jest argumentem, którym organizator
-- przebija opór graczy przed zakładaniem konta — i jednocześnie jedynym zapisem
-- w Bojo, którego zapisany NIE MOŻE cofnąć. Stan przed tą migracją:
--
--   • nie ma funkcji, która usuwałaby wpis gościa — `removeParticipant` wymaga
--     sesji, więc wypisać go może wyłącznie organizator,
--   • żaden wyzwalacz powiadomień go nie widzi: `070` (odwołanie), `114`
--     (zmiana warunków) i `116` (usunięcie meczu) mają warunek
--     `user_id IS NOT NULL`. Gość bez konta NIE DOWIE SIĘ, że mecz odwołano —
--     przyjedzie na boisko,
--   • po zamknięciu okna „Utwórz profil" traci `claim_token` bezpowrotnie:
--     nic nie ląduje na urządzeniu, żaden e-mail nie wychodzi.
--
-- Skutek dla organizatora jest odwrotny do obietnicy produktu: skład kłamie
-- dokładnie w tej części, którą organizator sam przyprowadził, a odwołanie
-- meczu dociera do połowy ludzi. Na czacie WhatsApp obie te rzeczy działają.
--
-- CO ROBI TA MIGRACJA. Podnosi `claim_token` z „tokenu do założenia konta"
-- do „prywatnego linku do własnego zapisu": tym samym adresem gość widzi stan
-- meczu i tym samym adresem się wypisuje. Zero nowych sekretów, zero nowej
-- tabeli — token już istnieje i już jest generowany wyzwalaczem z `066`.
--
-- WYMAGA MIGRACJI `127`. Token dostaje tu moc zmiany składu, a do `127`
-- kolumna `claim_token` była czytelna przez API dla każdego — czyli bez niej
-- ta funkcja byłaby przyciskiem do wypisywania CUDZYCH graczy.

-- ---------------------------------------------------------------------------
-- 1. Podgląd wpisu — szerszy, bo strona przestaje być samym „przejmij"
-- ---------------------------------------------------------------------------
-- Sygnatura się zmienia (dochodzą kolumny), więc CREATE OR REPLACE nie
-- wystarczy — Postgres nie pozwala zmienić typu zwracanego w miejscu.
DROP FUNCTION IF EXISTS podejrzyj_wpis_goscia(uuid);

CREATE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  imie                text,
  event_id            uuid,
  tytul               text,
  data_meczu          date,
  godzina             time,
  miejsce             text,
  juz_przejety        boolean,
  -- Nowe od `128`. Wszystko dotyczy TEGO wpisu i TEGO meczu — nic o innych
  -- uczestnikach poza dwiema liczbami składu, które i tak widać na stronie
  -- meczu, dostępnej publicznie pod adresem z linku.
  status_meczu        text,
  na_rezerwie         boolean,
  czeka_na_akceptacje boolean,
  koszt_grosze        integer,
  w_skladzie          integer,
  max_graczy          integer,
  mozna_zmieniac      boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name,
         e.id,
         coalesce(e.title, e.sport),
         e.event_date,
         e.event_time,
         -- Mecz przy pinezce spoza katalogu nie ma `field_name` — dotąd
         -- wychodziło z tego puste miejsce w podglądzie.
         coalesce(e.field_name, e.custom_location_name, e.custom_address, 'Boisko'),
         (p.claimed_at IS NOT NULL OR p.user_id IS NOT NULL),
         e.status,
         coalesce(p.is_reserve, false),
         coalesce(p.pending_approval, false),
         -- `cost_grosz`, nie `cost_grosze` — pułapka nazewnicza opisana
         -- w docs/domena.md; kolumna w bazie jest w liczbie pojedynczej.
         coalesce(e.cost_grosz, 0),
         (SELECT count(*)::int FROM event_participants x
           WHERE x.event_id = e.id AND x.pending_approval IS NOT TRUE
             AND x.rsvp <> 'maybe' AND x.is_reserve IS NOT TRUE),
         e.max_players,
         -- Czy da się jeszcze cokolwiek z tym wpisem zrobić. Ta sama reguła,
         -- którą niżej egzekwuje `wypisz_wpis_goscia` — liczona raz, tutaj,
         -- żeby interfejs nie musiał jej zgadywać drugi raz.
         --
         -- Czas liczony w strefie 'Europe/Warsaw', nie w UTC bazy (wzorem
         -- migracji `073`): baza stoi na UTC, więc gołe `now()` uznawałoby
         -- mecz o 20:00 za rozpoczęty dopiero o 22:00 czasu polskiego.
         (p.claimed_at IS NULL AND p.user_id IS NULL AND p.is_guest
          AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw'))
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wypisanie się przez link
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, bo wiersz gościa z definicji nie należy do nikogo: żadna
-- polityka oparta o `auth.uid()` nie mogłaby go przepuścić. Uprawnieniem jest
-- sam token — dokładnie tak, jak przy przejęciu wpisu (`066`).
--
-- Świadomie NIE pozwalamy wypisać:
--   • wpisu już przejętego (ma właściciela — ten wypisuje się normalnie,
--     zalogowany, i wtedy powiadomienia działają jak dla każdego),
--   • po rozpoczęciu meczu (skład rozegranego meczu to zapis historii,
--     z niego liczą się statystyki i rozliczenie).
CREATE OR REPLACE FUNCTION wypisz_wpis_goscia(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_event uuid;
BEGIN
  SELECT p.id, p.event_id
    INTO v_id, v_event
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token
     AND p.is_guest
     AND p.claimed_at IS NULL
     AND p.user_id IS NULL
     AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw');

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Tego zapisu nie da się już zmienić.';
  END IF;

  DELETE FROM event_participants WHERE id = v_id;

  -- Zwolnione miejsce idzie do pierwszej osoby z rezerwy — tą samą drogą,
  -- co przy każdym innym wypisaniu. Organizatora o zmianie stanu kompletu
  -- powiadomi wyzwalacz z `079`, wywołany już przez samo DELETE.
  PERFORM sync_reserve_claim(v_event);

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
REVOKE ALL ON FUNCTION wypisz_wpis_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wypisz_wpis_goscia(uuid) TO anon, authenticated;

COMMENT ON FUNCTION wypisz_wpis_goscia(uuid) IS
  'Wypisanie ze składu wpisu gościa bez konta, uprawnieniem jest sam token (model jak join_code). Nie działa na wpisie przejętym ani po rozpoczęciu meczu. Woła sync_reserve_claim, żeby zwolnione miejsce trafiło do rezerwy.';
