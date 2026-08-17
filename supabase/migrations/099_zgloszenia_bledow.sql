-- 099: Zgłoszenia błędów — od użytkownika i automatyczne z awarii.
--
-- WYMAGA MIGRACJI 098 (funkcja `czy_admin()`).
--
-- Po co: dziś awaria u użytkownika nie zostawia po sobie ŻADNEGO śladu.
-- `app/error.tsx` wypisuje błąd do konsoli przeglądarki, której nikt nie ogląda,
-- a zgłoszenie „coś mi wywaliło" przychodzi zrzutem ekranu na WhatsAppie, bez
-- adresu strony, bez wersji, bez treści błędu. Odtworzenie takiego zgłoszenia
-- kosztuje więcej niż sama naprawa.
--
-- JEDNA TABELA NA OBA RODZAJE, i to jest świadome: administrator ma jedno
-- miejsce, w które patrzy. Kolumna `rodzaj` rozróżnia „napisał człowiek" od
-- „złapało się samo", bo obie rzeczy czyta się inaczej.
--
-- GRUPOWANIE PO `odcisk` (fingerprint) zamiast wiersza na każde wystąpienie.
-- Jeden zepsuty widok potrafi wygenerować setki błędów w minutę — bez
-- grupowania panel administratora tonie w kopiach tego samego, a licznik
-- wystąpień, czyli najważniejsza informacja („dotyczy 200 osób czy jednej"),
-- w ogóle nie istnieje. Zgłoszenia od ludzi grupowaniu NIE podlegają: każde
-- jest osobną historią, nawet gdy opis brzmi tak samo.

CREATE TABLE IF NOT EXISTS zgloszenia_bledow (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trzy rodzaje, bo trzy różne rzeczy i trzy różne reakcje:
  --   uzytkownik — „coś nie działa", napisane ręką,
  --   awaria     — złapane samo, z komunikatem i stosem,
  --   obiekt     — błąd w DANYCH boiska („tu już nie ma bramek").
  -- Ten trzeci jest osobny, bo dotyczy danych, których NIE jesteśmy
  -- właścicielem (OSM, licencja ODbL) — poprawka wymaga naszej decyzji,
  -- a nie automatu.
  rodzaj        TEXT NOT NULL CHECK (rodzaj IN ('uzytkownik', 'awaria', 'obiekt')),

  -- Skrót „to jest ten sam błąd": komunikat + pierwsza ramka stosu. NULL dla
  -- zgłoszeń od ludzi (patrz wyżej). Indeks częściowy, bo tylko awarie go mają.
  odcisk        TEXT,

  opis          TEXT NOT NULL,
  slad          TEXT,

  -- Kontekst, bez którego zgłoszenie jest nie do odtworzenia.
  adres         TEXT,
  przegladarka  TEXT,
  wersja        TEXT,

  -- Zgłaszać może też niezalogowany — wtedy NULL. `ON DELETE SET NULL`, żeby
  -- usunięcie konta nie kasowało historii błędów.
  user_id       UUID REFERENCES auth.users ON DELETE SET NULL,

  -- Wypełnione wyłącznie dla `rodzaj = 'obiekt'`. `ON DELETE CASCADE`:
  -- zgłoszenie o nieistniejącym już obiekcie nie ma po co zostawać.
  field_id      UUID REFERENCES fields(id) ON DELETE CASCADE,

  status        TEXT NOT NULL DEFAULT 'nowe'
                CHECK (status IN ('nowe', 'w_toku', 'zamkniete')),
  notatka       TEXT,

  liczba        INT NOT NULL DEFAULT 1,
  pierwszy_raz  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ostatni_raz   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zgloszenia_bledow_odcisk_idx
  ON zgloszenia_bledow (odcisk) WHERE odcisk IS NOT NULL;
CREATE INDEX IF NOT EXISTS zgloszenia_bledow_status_idx
  ON zgloszenia_bledow (status, ostatni_raz DESC);
-- Ile zgłoszeń zebrał jeden obiekt — backlog zakłada, że dopiero kilka
-- niezależnych zgłoszeń uzasadnia zmianę danych bez naszej moderacji.
CREATE INDEX IF NOT EXISTS zgloszenia_bledow_field_idx
  ON zgloszenia_bledow (field_id) WHERE field_id IS NOT NULL;

ALTER TABLE zgloszenia_bledow ENABLE ROW LEVEL SECURITY;

-- CZYTAĆ MOŻE WYŁĄCZNIE ADMIN. To nie jest ostrożność na wyrost: w opisie
-- błędu ląduje adres strony, a ten bywa linkiem do prywatnego meczu. Bez tej
-- polityki dowolny zalogowany user czytałby cudze zgłoszenia razem z nimi.
DROP POLICY IF EXISTS "Admin czyta zgloszenia" ON zgloszenia_bledow;
CREATE POLICY "Admin czyta zgloszenia" ON zgloszenia_bledow
  FOR SELECT USING (public.czy_admin());

DROP POLICY IF EXISTS "Admin zmienia zgloszenia" ON zgloszenia_bledow;
CREATE POLICY "Admin zmienia zgloszenia" ON zgloszenia_bledow
  FOR UPDATE USING (public.czy_admin()) WITH CHECK (public.czy_admin());

-- Zapis idzie WYŁĄCZNIE przez RPC niżej (SECURITY DEFINER), więc bezpośredni
-- INSERT jest zamknięty dla wszystkich. Inaczej dowolny klient mógłby wstawiać
-- wiersze z dowolnym `status`, `liczba` czy cudzym `user_id`.

/**
 * Zapisuje zgłoszenie. Awarie z tym samym odciskiem dokładają się do
 * istniejącego wiersza zamiast tworzyć nowy.
 *
 * SECURITY DEFINER, bo tabela nie ma polityki INSERT — to jedyne wejście.
 * Dzięki temu klient nie decyduje o `status`, `liczba` ani `user_id`:
 * tożsamość bierzemy z `auth.uid()`, nie z tego, co przyszło z przeglądarki.
 */
CREATE OR REPLACE FUNCTION public.zapisz_zgloszenie_bledu(
  p_rodzaj       TEXT,
  p_opis         TEXT,
  p_odcisk       TEXT DEFAULT NULL,
  p_slad         TEXT DEFAULT NULL,
  p_adres        TEXT DEFAULT NULL,
  p_przegladarka TEXT DEFAULT NULL,
  p_wersja       TEXT DEFAULT NULL,
  p_field_id     UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  -- Ucinamy na wejściu, nie przy wyświetlaniu: stos potrafi mieć kilkadziesiąt
  -- kilobajtów, a do rozpoznania błędu wystarczy jego początek. Bez tego jedna
  -- pętla w kodzie klienta potrafi wpompować megabajty do bazy.
  v_opis TEXT := left(coalesce(p_opis, ''), 2000);
  v_slad TEXT := left(p_slad, 4000);
BEGIN
  IF p_rodzaj NOT IN ('uzytkownik', 'awaria', 'obiekt') THEN
    RAISE EXCEPTION 'Nieznany rodzaj zgłoszenia: %', p_rodzaj;
  END IF;

  IF v_opis = '' THEN
    RAISE EXCEPTION 'Puste zgłoszenie';
  END IF;

  -- Awaria z odciskiem: dokładamy do istniejącego wiersza. `ostatni_raz`
  -- i licznik są tym, po czym administrator poznaje, czy błąd żyje.
  IF p_rodzaj = 'awaria' AND p_odcisk IS NOT NULL THEN
    INSERT INTO zgloszenia_bledow
      (rodzaj, odcisk, opis, slad, adres, przegladarka, wersja, user_id)
    VALUES
      ('awaria', p_odcisk, v_opis, v_slad, p_adres, p_przegladarka, p_wersja, auth.uid())
    ON CONFLICT (odcisk) WHERE odcisk IS NOT NULL DO UPDATE
      SET liczba      = zgloszenia_bledow.liczba + 1,
          ostatni_raz = now(),
          adres       = COALESCE(EXCLUDED.adres, zgloszenia_bledow.adres),
          -- Błąd zamknięty, który wraca, musi znowu trafić na wierzch listy.
          status      = CASE WHEN zgloszenia_bledow.status = 'zamkniete'
                             THEN 'nowe' ELSE zgloszenia_bledow.status END
      RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  INSERT INTO zgloszenia_bledow
    (rodzaj, opis, slad, adres, przegladarka, wersja, user_id, field_id)
  VALUES
    (p_rodzaj, v_opis, v_slad, p_adres, p_przegladarka, p_wersja, auth.uid(),
     CASE WHEN p_rodzaj = 'obiekt' THEN p_field_id ELSE NULL END)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
-- `anon` też: awaria na stronie meczu otwartej z linku, bez logowania, jest
-- dokładnie tym przypadkiem, o którym chcemy wiedzieć.
GRANT EXECUTE ON FUNCTION public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  TO anon, authenticated;
