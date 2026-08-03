-- ============================================================================
-- NAPRAWA: kontakty przypisane do obiektów bez nazwy własnej
-- ============================================================================
-- enrich (Claude + web search) dostawał wiersz "Boisko sportowe, ul. Szkolna"
-- i szukał kontaktu. Nie mając nazwy, trafiał w najbliższy pasujący ośrodek.
-- Dowód: mail osrodekrataje@posir.poznan.pl siedzi na obiektach przy
-- ul. Chociszewskiego (Grunwald), ul. Kórnickiej (Rataje), ul. Szczytnickiej
-- (Wilda) i ul. Bukowskiej (Dopiewo) — Ośrodek Rataje nie obsługuje Dopiewa.
--
-- Kontakt na obiekcie bez nazwy własnej jest z definicji niesprawdzalny.
-- Kasujemy telefon, mail i stronę; obiekt zostaje, tylko bez fałszywego kontaktu.
--
-- Transakcja kończy się ROLLBACK. Zamień na COMMIT, gdy podgląd się zgadza.
-- ============================================================================

BEGIN;

SELECT format('%s | %s | tel=%s mail=%s www=%s',
  name, coalesce(address,'—'),
  coalesce(phone,'—'), coalesce(email,'—'), coalesce(website,'—')) AS wynik
FROM fields
WHERE name ~ '^(Boisko|Plac|Orlik)( —| sportowe|$)'
  AND (phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL)
ORDER BY name, address
LIMIT 300;

SELECT format('do wyczyszczenia: %s obiektów', count(*)) AS wynik
FROM fields
WHERE name ~ '^(Boisko|Plac|Orlik)( —| sportowe|$)'
  AND (phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL);

UPDATE fields
SET phone = NULL, email = NULL, website = NULL
WHERE name ~ '^(Boisko|Plac|Orlik)( —| sportowe|$)'
  AND (phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL);

ROLLBACK;  -- ← zamień na COMMIT, gdy podgląd się zgadza
