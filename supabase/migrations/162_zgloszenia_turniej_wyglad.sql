-- 162: Organizator może poprosić Bojo o inny wygląd strony turnieju wprost
-- z panelu (kolory, układ, dodatkowy element) — bez wychodzenia na osobny
-- formularz kontaktowy i bez zgadywania, którego turnieju prośba dotyczy.
--
-- `zgloszenia_bledow` (migracja 099) ma już dokładnie ten kształt: jedna
-- tabela, jedno miejsce, w które patrzy administrator, `rodzaj` odróżnia
-- czytanie. Nowy rodzaj 'turniej_wyglad' dokłada się do tego wzorca zamiast
-- zakładać osobną tabelę — ten sam pomysł co `obiekt` (zgłoszenie związane
-- z konkretnym wierszem, tam `fields`, tu `turnieje`).
--
-- Migracja da się puścić drugi raz: DROP CONSTRAINT/DROP FUNCTION IF EXISTS
-- i ADD COLUMN IF NOT EXISTS.

ALTER TABLE zgloszenia_bledow DROP CONSTRAINT IF EXISTS zgloszenia_bledow_rodzaj_check;
ALTER TABLE zgloszenia_bledow ADD CONSTRAINT zgloszenia_bledow_rodzaj_check
  CHECK (rodzaj IN ('uzytkownik', 'awaria', 'obiekt', 'turniej_wyglad'));

-- Wypełnione wyłącznie dla `rodzaj = 'turniej_wyglad'`. `ON DELETE CASCADE`:
-- zgłoszenie o skasowanym turnieju nie ma po co zostawać (ten sam wzorzec
-- co `field_id` wyżej w 099).
ALTER TABLE zgloszenia_bledow ADD COLUMN IF NOT EXISTS turniej_id UUID REFERENCES turnieje(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS zgloszenia_bledow_turniej_idx
  ON zgloszenia_bledow (turniej_id) WHERE turniej_id IS NOT NULL;

-- Stara sygnatura (8 parametrów) znika PRZED utworzeniem nowej — inaczej
-- Postgres trzyma obie jako przeciążone funkcje i wywołanie bez
-- `p_turniej_id` mogłoby trafić w starą wersję zamiast w tę niżej.
DROP FUNCTION IF EXISTS public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);

/**
 * Zapisuje zgłoszenie. Jak w 099, plus `p_turniej_id` dla nowego rodzaju.
 * SECURITY DEFINER, bo tabela nie ma polityki INSERT — to jedyne wejście.
 */
CREATE OR REPLACE FUNCTION public.zapisz_zgloszenie_bledu(
  p_rodzaj       TEXT,
  p_opis         TEXT,
  p_odcisk       TEXT DEFAULT NULL,
  p_slad         TEXT DEFAULT NULL,
  p_adres        TEXT DEFAULT NULL,
  p_przegladarka TEXT DEFAULT NULL,
  p_wersja       TEXT DEFAULT NULL,
  p_field_id     UUID DEFAULT NULL,
  p_turniej_id   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_opis TEXT := left(coalesce(p_opis, ''), 2000);
  v_slad TEXT := left(p_slad, 4000);
BEGIN
  IF p_rodzaj NOT IN ('uzytkownik', 'awaria', 'obiekt', 'turniej_wyglad') THEN
    RAISE EXCEPTION 'Nieznany rodzaj zgłoszenia: %', p_rodzaj;
  END IF;

  IF v_opis = '' THEN
    RAISE EXCEPTION 'Puste zgłoszenie';
  END IF;

  IF p_rodzaj = 'awaria' AND p_odcisk IS NOT NULL THEN
    INSERT INTO zgloszenia_bledow
      (rodzaj, odcisk, opis, slad, adres, przegladarka, wersja, user_id)
    VALUES
      ('awaria', p_odcisk, v_opis, v_slad, p_adres, p_przegladarka, p_wersja, auth.uid())
    ON CONFLICT (odcisk) WHERE odcisk IS NOT NULL DO UPDATE
      SET liczba      = zgloszenia_bledow.liczba + 1,
          ostatni_raz = now(),
          adres       = COALESCE(EXCLUDED.adres, zgloszenia_bledow.adres),
          status      = CASE WHEN zgloszenia_bledow.status = 'zamkniete'
                             THEN 'nowe' ELSE zgloszenia_bledow.status END
      RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  INSERT INTO zgloszenia_bledow
    (rodzaj, opis, slad, adres, przegladarka, wersja, user_id, field_id, turniej_id)
  VALUES
    (p_rodzaj, v_opis, v_slad, p_adres, p_przegladarka, p_wersja, auth.uid(),
     CASE WHEN p_rodzaj = 'obiekt' THEN p_field_id ELSE NULL END,
     CASE WHEN p_rodzaj = 'turniej_wyglad' THEN p_turniej_id ELSE NULL END)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
-- `anon` też: tak jak przy awarii, zgłoszenie z niezalogowanej przeglądarki
-- ma trafić do nas, nie zniknąć.
GRANT EXECUTE ON FUNCTION public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID)
  TO anon, authenticated;
