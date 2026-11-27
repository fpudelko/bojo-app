-- ============================================================================
-- JEDNORAZOWE ZADANIE: opis „Gramy dla Marysi!” zgodny z terminarzem z PDF
-- ============================================================================
--
-- Prośba właściciela z 2026-11-27: opis turnieju mówił jeszcze o starym
-- planie (start 08:30, mecze po 12 min, grupy A, B i C, trzyzespołowa grupa
-- finałowa, konkurs 12:40). Po `turniej-marysi-terminarz-28-11.sql` turniej
-- ma: start 08:45, mecze po 10 min, zmiana 2 min, grupa A (7 drużyn, po
-- 6 meczów) i B (6 drużyn, po 5 meczów), o 3. miejsce 16:12 (A2–B2), finał
-- 16:24 (A1–B1), konkurs 12:45–13:00, dekoracja 16:34–16:49.
--
-- Przed konkursem nie grają jeszcze: Emar Instalacje (pierwszy mecz 13:24),
-- Ekipa Fortnite Skurczybyki (13:36) i AFC Poznań (13:48), stąd prośba
-- o przyjazd do 12:30 tylko do nich.
--
-- Zmienia: opis, a w regulaminie zdanie o długości meczu (jeśli mówi o innej
-- liczbie minut niż ustawienie turnieju). Nikt nie dostaje powiadomienia.
-- RĘCZNIE w Supabase → SQL Editor: część A (podgląd), potem B. Można puścić
-- drugi raz.
-- ============================================================================


-- ============================================================================
-- CZĘŚĆ A: PODGLĄD. Niczego nie zmienia.
-- ============================================================================

SELECT nazwa, czas_meczu_min, przerwa_min, godzina_startu,
       opis,
       substring(regulamin FROM '3\. Mecz trwa [0-9]+ minut') AS zdanie_w_regulaminie,
       ekran_komunikat
  FROM turnieje
 WHERE id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';


-- ============================================================================
-- CZĘŚĆ B: ZAPIS.
-- ============================================================================

UPDATE turnieje SET opis = $opis$Charytatywny turniej piłkarski „Gramy dla Marysi!” odbędzie się w sobotę, 28 listopada 2026 r., w hali LOSiR Luboń.

Najważniejsze informacje organizacyjne:

• Pierwszy mecz turnieju rozpoczyna się o 08:45. Prosimy o przyjazd z odpowiednim wyprzedzeniem przed pierwszym spotkaniem swojej drużyny oraz punktualne przygotowanie do kolejnych meczów.
• Mecze trwają 10 minut, a standardowa zmiana drużyn wynosi 2 minuty.
• Gramy w dwóch grupach, każdy z każdym: w grupie A (7 drużyn) każda drużyna rozgrywa 6 meczów, w grupie B (6 drużyn) 5 meczów.
• Zwycięzcy grup A i B zagrają w finale o 16:24, a drużyny z drugich miejsc o 3. miejsce o 16:12.
• 12:45–13:00: konkurs obijania poprzeczki. Chcemy, aby były wtedy obecne wszystkie drużyny. Drużyny Emar Instalacje, Ekipa Fortnite Skurczybyki i AFC Poznań, które pierwszy mecz grają po konkursie, prosimy o przyjazd najpóźniej do 12:30, a pozostałe drużyny o pozostanie do zakończenia konkursu, również jeśli wcześniej zakończą swoje mecze.
• Finał kończy się o 16:34. Następnie odbędzie się dekoracja i podziękowania; wydarzenie kończymy do 17:00.

Podczas turnieju prowadzimy zbiórkę dla Marysi, loterię z nagrodami i licytacje charytatywne. Zachęcamy do zaproszenia rodzin i znajomych, wspólnie możemy zrobić coś dobrego!

Pytania organizacyjne: pomagramy@gmail.com

Dziękujemy, że gracie razem z nami dla Marysi. Do zobaczenia na hali!
Zespół Poma-Gramy$opis$
 WHERE id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';

-- Długość meczu w regulaminie z bieżącego ustawienia turnieju (10 min).
UPDATE turnieje
   SET regulamin = regexp_replace(regulamin, '3\. Mecz trwa [0-9]+ minut', '3. Mecz trwa ' || czas_meczu_min || ' minut')
 WHERE id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47'
   AND regulamin ~ '3\. Mecz trwa [0-9]+ minut';

-- Kontrola: to samo co w części A, już po zmianie.
SELECT czas_meczu_min, left(opis, 120) AS opis_poczatek,
       substring(regulamin FROM '3\. Mecz trwa [0-9]+ minut') AS zdanie_w_regulaminie
  FROM turnieje
 WHERE id = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';
