-- ============================================================================
-- BOJO — eksport danych o boiskach do oceny z ręki
-- ============================================================================
-- Same SELECT-y, nic nie zapisuje. Do wklejenia w Supabase → SQL Editor.
--
-- Każde zapytanie zwraca JEDNĄ kolumnę tekstową — wynik da się zaznaczyć
-- i wkleić bez rozjeżdżania tabel.
--
-- Supabase pokazuje wynik TYLKO ostatniego zapytania, więc zaznacz jedno
-- (myszką) i wciśnij Ctrl+Enter.
--
-- Format wiersza w eksportach: pola rozdzielone znakiem ~
--   nazwa ~ adres ~ lat,lng ~ sporty ~ nawierzchnia ~ typ ~ źródło ~ flagi
-- Flagi: AI = opisane przez analizę satelitarną, T = telefon, W = strona,
--        M = e-mail, Z = zdjęcie.
-- ============================================================================


-- ── 0. Ile tego jest — żeby wiedzieć, ile stron eksportu przewinąć ──────────
SELECT format(
  'wszystkich: %s | publicznych: %s | organizer_only: %s | ukrytych: %s | stron eksportu po 300: %s',
  count(*),
  count(*) FILTER (WHERE map_visibility = 'public'),
  count(*) FILTER (WHERE map_visibility = 'organizer_only'),
  count(*) FILTER (WHERE map_visibility = 'hidden'),
  ceil(count(*) FILTER (WHERE map_visibility = 'public') / 300.0)
) AS wynik
FROM fields;


-- ── 1. EKSPORT: obiekty PUBLICZNE, strona 1 ────────────────────────────────
-- To jest zestaw, który widzi użytkownik na mapie — od niego zacznij.
-- Kolejne strony: zmień OFFSET na 300, 600, 900, 1200 … i puść ponownie.
SELECT format(
  '%s ~ %s ~ %s,%s ~ %s ~ %s ~ %s ~ %s ~ %s',
  name,
  coalesce(address, '—'),
  round(lat::numeric, 5), round(lng::numeric, 5),
  coalesce(array_to_string(sport, '+'), '—'),
  coalesce(surface, '—'),
  coalesce(venue_type, '—'),
  coalesce(source, '—'),
  concat_ws('',
    CASE WHEN ai_typed_at IS NOT NULL THEN 'AI' END,
    CASE WHEN phone   IS NOT NULL THEN 'T' END,
    CASE WHEN website IS NOT NULL THEN 'W' END,
    CASE WHEN email   IS NOT NULL THEN 'M' END,
    CASE WHEN photo_url IS NOT NULL OR photo_reference IS NOT NULL THEN 'Z' END
  )
) AS wynik
FROM fields
WHERE map_visibility = 'public'
ORDER BY name
LIMIT 300 OFFSET 0;


-- ── 2. EKSPORT: obiekty organizer_only ─────────────────────────────────────
-- Niewidoczne na mapie publicznej, ale wybieralne przy tworzeniu meczu.
-- Tu siedzą obiekty o słabych danych — warto zobaczyć, czy słusznie.
SELECT format(
  '%s ~ %s ~ %s,%s ~ %s ~ %s ~ %s ~ %s',
  name,
  coalesce(address, '—'),
  round(lat::numeric, 5), round(lng::numeric, 5),
  coalesce(array_to_string(sport, '+'), '—'),
  coalesce(surface, '—'),
  coalesce(source, '—'),
  concat_ws('',
    CASE WHEN ai_typed_at IS NOT NULL THEN 'AI' END,
    CASE WHEN phone   IS NOT NULL THEN 'T' END,
    CASE WHEN website IS NOT NULL THEN 'W' END,
    CASE WHEN email   IS NOT NULL THEN 'M' END
  )
) AS wynik
FROM fields
WHERE map_visibility = 'organizer_only'
ORDER BY name
LIMIT 300 OFFSET 0;


-- ── 3. Duplikaty: obiekty o tej samej nazwie i adresie ─────────────────────
-- Jedna linia = jeden klaster. Po niej ocenię, czy to kompleks z kilkoma
-- boiskami (uzasadnione), czy ten sam obiekt zaimportowany dwa razy (śmieć).
SELECT format(
  '%sx | %s | %s | źródła: %s | id: %s',
  count(*), name, coalesce(address, '—'),
  string_agg(DISTINCT coalesce(source, '?'), '+'),
  string_agg(left(id::text, 8), ' ')
) AS wynik
FROM fields
GROUP BY name, address
HAVING count(*) > 1
ORDER BY count(*) DESC, name
LIMIT 200;


-- ── 4. Duplikaty geograficzne: różne nazwy w tym samym punkcie ─────────────
-- Łapie to, czego zapytanie 3 nie złapie — ten sam obiekt pod dwiema nazwami.
SELECT format(
  '%sx @ %s,%s | %s',
  count(*), round(lat::numeric, 5), round(lng::numeric, 5),
  string_agg(name, ' / ' ORDER BY name)
) AS wynik
FROM fields
WHERE lat IS NOT NULL
GROUP BY round(lat::numeric, 5), round(lng::numeric, 5)
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 200;


-- ── 5. Adresy bez numeru — próbka 150 ──────────────────────────────────────
-- 1170 obiektów nie ma numeru w adresie. Ta próbka pokaże, ile z tego to
-- uczciwe „boisko w parku", a ile urwany albo pusty adres.
SELECT format(
  '%s ~ %s ~ %s ~ %s',
  name,
  coalesce(address, 'BRAK ADRESU'),
  coalesce(district, '—'),
  coalesce(source, '—')
) AS wynik
FROM fields
WHERE (address IS NULL OR address !~ '\d')
ORDER BY md5(id::text)
LIMIT 150;


-- ── 6. Kontakty — co realnie mamy do wysłania zapytania o rezerwację ───────
SELECT format(
  'z e-mailem: %s | z telefonem: %s | ze stroną: %s | z e-mailem LUB telefonem: %s | z niczym: %s | (na %s obiektów)',
  count(*) FILTER (WHERE email IS NOT NULL),
  count(*) FILTER (WHERE phone IS NOT NULL),
  count(*) FILTER (WHERE website IS NOT NULL),
  count(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL),
  count(*) FILTER (WHERE email IS NULL AND phone IS NULL AND website IS NULL),
  count(*)
) AS wynik
FROM fields;


-- ── 7. Obiekty z kontaktem — pełna lista ───────────────────────────────────
-- Kandydaci na „Zarezerwuj" i na ofertę B2B. Zwykle krótka lista, wklej całą.
SELECT format(
  '%s ~ %s ~ tel=%s ~ mail=%s ~ www=%s ~ %s',
  name,
  coalesce(address, '—'),
  coalesce(phone, '—'),
  coalesce(email, '—'),
  coalesce(website, '—'),
  coalesce(operator, '—')
) AS wynik
FROM fields
WHERE email IS NOT NULL OR phone IS NOT NULL
ORDER BY name
LIMIT 400;


-- ── 8. Rozkład nawierzchni i typów — czy słownik nie jest zaśmiecony ───────
SELECT format('nawierzchnia %-24s %s', coalesce(surface, '(brak)'), count(*)) AS wynik
FROM fields GROUP BY surface
UNION ALL
SELECT format('typ          %-24s %s', coalesce(venue_type, '(brak)'), count(*))
FROM fields GROUP BY venue_type
ORDER BY 1;


-- ── 9. Notatki AI — czym model tłumaczył swoje decyzje ─────────────────────
-- Dobre miejsce, żeby zobaczyć, gdzie zgadywał. Próbka 60.
SELECT format('%s ~ %s ~ %s', name, coalesce(venue_type, '—'), ai_notes) AS wynik
FROM fields
WHERE ai_notes IS NOT NULL AND length(ai_notes) > 10
ORDER BY md5(id::text)
LIMIT 60;
