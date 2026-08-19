-- Ustawienie kapitanów w konkretnym meczu, gdy trzeba to zrobić z bazy.
--
-- PO CO: gwiazdka kapitana w aplikacji pojawiła się dopiero po odblokowaniu
-- jej we wszystkich trybach dzielenia drużyn. Mecze rozdzielone wcześniej
-- (ręcznie, losowo albo z przyjętej propozycji) zostały bez kapitana, a bez
-- niego zakładka Taktyka nie ma kogo czekać. To zapytanie nadaje ich wprost.
--
-- JAK UŻYĆ: podmień identyfikator meczu i nazwiska, wklej do SQL Editor.
-- Nazwisko musi być dokładnie takie, jak widać na liście składów.

BEGIN;

WITH mecz AS (
  SELECT 'c9be7cda-84f8-499a-ba28-b0993639b746'::uuid AS id
),
-- Kto ma być kapitanem której drużyny. Litera drużyny, nie kolor:
-- A = Niebiescy, B = Czerwoni.
wybor(druzyna, nazwisko) AS (
  VALUES ('A', 'Mistrz Uczeń'),
         ('B', 'Damian Sobczyk')
)
-- Najpierw zdejmujemy kapitana ze wszystkich w tym meczu: w drużynie może być
-- tylko jeden, a zapytanie ma dawać ten sam wynik przy każdym uruchomieniu.
, zdjeci AS (
  UPDATE event_participants ep
     SET is_captain = false
    FROM mecz
   WHERE ep.event_id = mecz.id AND ep.is_captain
  RETURNING ep.id
)
UPDATE event_participants ep
   SET is_captain = true
  FROM mecz, wybor
 WHERE ep.event_id = mecz.id
   AND ep.team = wybor.druzyna
   AND ep.name = wybor.nazwisko;

-- Kontrola przed zatwierdzeniem: mają wyjść DOKŁADNIE dwa wiersze.
-- Zero albo jeden = nazwisko się nie zgadza (spacja, skrót, inna pisownia)
-- — wtedy ROLLBACK zamiast COMMIT i popraw nazwisko.
SELECT ep.team, ep.name, ep.is_captain
  FROM event_participants ep
 WHERE ep.event_id = 'c9be7cda-84f8-499a-ba28-b0993639b746'
   AND ep.is_captain
 ORDER BY ep.team;

COMMIT;
