-- 126: Szukanie boisk przestaje wymagać polskich ogonków.
--
-- PO CO. `searchExplorerFields()` robi `ilike '%<fraza>%'` na `name` i `address`.
-- Postgres porównuje przy tym znak po znaku, więc „poznan" NIE jest zgodne
-- z „Poznań" — a nikt nie pisze ogonków w szukajce na telefonie. Efekt:
-- wpisanie miasta zwracało ZERO wyników z katalogu, mapa zostawała bez pinezek,
-- a użytkownik dostawał komunikat „nic nie znaleziono" przy 38 tysiącach
-- obiektów w bazie. Zgłoszone wprost: „po wyszukaniu np. »poznan« w widoku
-- mapy … całość się pierdoli".
--
-- Strona przeglądarki jest już naprawiona (`foldText()` w `lib/searchText.ts`),
-- ale to tylko filtr NA TYM, co przyszło z serwera. Gdy serwer nie zwraca nic,
-- nie ma czego filtrować — dlatego ta migracja.
--
-- DLACZEGO `translate()`, A NIE `unaccent()`. `unaccent()` nie jest IMMUTABLE
-- (zależy od słownika, który da się podmienić), więc nie wolno go użyć
-- w kolumnie generowanej ani zaindeksować bez owijania we własną funkcję.
-- `translate()` jest immutable, nie wymaga żadnego rozszerzenia i pokrywa
-- dokładnie te dziewięć liter, które w polskim istnieją. Mapowanie jest to samo
-- co w `foldText()` po stronie przeglądarki — obie strony MUSZĄ składać tekst
-- tak samo, inaczej filtr lokalny wytnie to, co serwer właśnie znalazł.
--
-- WIELKIE LITERY SĄ W MAPOWANIU CELOWO, mimo `lower()` przed nim. `lower()`
-- jest zależne od locale bazy: w bazie postawionej z locale „C" zna wyłącznie
-- ASCII, więc „Ń" zostaje wielkie i wypadłoby z mapowania. Wymienienie obu
-- wielkości znaczy, że kolumna liczy się tak samo niezależnie od tego, jak
-- postawiono bazę.
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ. Kolumna generowana jest wyliczana przez bazę przy
-- każdym zapisie, więc nie ma czego backfillować ani co mogłoby zostać
-- w połowie (patrz pułapka z migracji 118).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS szukaj_norm TEXT
  GENERATED ALWAYS AS (
    translate(
      lower(coalesce(name, '') || ' ' || coalesce(address, '')),
      'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
      'acelnoszzacelnoszz'
    )
  ) STORED;

COMMENT ON COLUMN fields.szukaj_norm IS
  'Nazwa + adres złożone do postaci bez ogonków i małymi literami (migracja 126). Do szukania `ilike` bez polskich znaków. Odpowiednik foldText() z frontend/src/lib/searchText.ts — zmiana po jednej stronie wymaga zmiany po drugiej.';

-- GIN po trigramach: bez niego `ilike '%...%'` na 38 tysiącach wierszy to
-- pełen przegląd tabeli przy każdym naciśnięciu klawisza.
CREATE INDEX IF NOT EXISTS fields_szukaj_norm_trgm
  ON fields USING gin (szukaj_norm gin_trgm_ops);
