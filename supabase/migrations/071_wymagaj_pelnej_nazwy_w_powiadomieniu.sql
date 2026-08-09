-- 071_wymagaj_pelnej_nazwy_w_powiadomieniu.sql
--
-- `powiadom_o_braku_nazwy()` (migracja 070) sprawdzał, czy KTÓREKOLWIEK z pól
-- display_name/full_name/name jest niepuste. Google OAuth zawsze wypełnia
-- full_name/name danymi z profilu Google, więc ten check praktycznie nigdy nie
-- wykrywał braku — powiadomienie „Uzupełnij swoje imię” nie odpalało się dla
-- kont z Google. Front-end ma już dokładnie ten sam problem naprawiony w
-- `profileName.ts` (`isPelneImie()` zamiast usuniętego `brakNazwy()`) — to jest
-- odpowiednik tej naprawy po stronie wyzwalacza, żeby oba mechanizmy (baner na
-- pulpicie i powiadomienie w dzwonku) mierzyły tym samym miernikiem: co
-- najmniej dwa człony nazwy, każdy ≥2 znaki. Bez pełnej parzystości z regexem
-- TS (klasy liter Unicode) — to wystarczające przybliżenie dla jednorazowego
-- powiadomienia przy rejestracji.
CREATE OR REPLACE FUNCTION powiadom_o_braku_nazwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nazwa TEXT;
  v_czlony TEXT[];
BEGIN
  v_nazwa := btrim(coalesce(
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  ));
  v_czlony := array_remove(regexp_split_to_array(v_nazwa, '\s+'), '');

  IF array_length(v_czlony, 1) >= 2
     AND (SELECT bool_and(char_length(c) >= 2) FROM unnest(v_czlony) c) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'uzupelnij_profil',
    'Uzupełnij swoje imię',
    'Gracze zobaczą Cię pod nazwą wyprowadzoną z adresu e-mail. Wpisz imię i nazwisko w profilu.'
  );

  RETURN NEW;
END;
$$;

-- Wyzwalacz już istnieje z migracji 070 i wskazuje na tę samą nazwę funkcji —
-- CREATE OR REPLACE wystarczy, nie trzeba go przetwarzać ponownie.
