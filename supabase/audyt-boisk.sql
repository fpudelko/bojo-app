-- ============================================================================
-- BOJO — audyt jakości danych o boiskach
-- ============================================================================
-- Do wklejenia w Supabase → SQL Editor. Nic nie zapisuje, same SELECT-y.
--
-- Każde zapytanie zwraca JEDNĄ kolumnę tekstową, żeby wynik dało się
-- zaznaczyć i wkleić do rozmowy bez rozjeżdżania się tabel.
--
-- Uruchamiaj po jednym zapytaniu (Supabase pokazuje wynik tylko ostatniego).
-- ============================================================================


-- ── 1. Skala i podział na źródła ────────────────────────────────────────────
SELECT format(
  '%s | source=%s | vis=%s | mod=%s | ai_typed=%s',
  count(*), coalesce(source, '?'), map_visibility,
  coalesce(moderation_status, '?'),
  count(*) FILTER (WHERE ai_typed_at IS NOT NULL)
) AS wynik
FROM fields
GROUP BY source, map_visibility, moderation_status
ORDER BY 1;


-- ── 2. Kompletność atrybutów wśród obiektów PUBLICZNYCH ─────────────────────
-- To jest zestaw, który widzi zwykły użytkownik na mapie.
SELECT format(
  'publicznych: %s | z nawierzchnią: %s | z typem: %s | ze sportem: %s | ze zdjęciem: %s | z telefonem: %s | ze stroną: %s | z godzinami: %s | z adresem z numerem: %s',
  count(*),
  count(*) FILTER (WHERE surface IS NOT NULL),
  count(*) FILTER (WHERE venue_type IS NOT NULL),
  count(*) FILTER (WHERE sport IS NOT NULL AND array_length(sport, 1) > 0),
  count(*) FILTER (WHERE photo_url IS NOT NULL OR photo_reference IS NOT NULL OR image_url IS NOT NULL),
  count(*) FILTER (WHERE phone IS NOT NULL),
  count(*) FILTER (WHERE website IS NOT NULL),
  count(*) FILTER (WHERE opening_hours IS NOT NULL),
  count(*) FILTER (WHERE address ~ '\d')
) AS wynik
FROM fields
WHERE map_visibility = 'public';


-- ── 3. Ile publicznych obiektów opiera się WYŁĄCZNIE na ocenie AI ───────────
-- Obiekt bez telefonu, strony, godzin i operatora, ale z ai_typed_at, to
-- obiekt, o którym nie wiemy nic poza tym, co model wyczytał ze zdjęcia z góry.
SELECT format(
  'publiczne bez żadnego twardego źródła (tylko AI): %s z %s',
  count(*) FILTER (
    WHERE ai_typed_at IS NOT NULL
      AND phone IS NULL AND website IS NULL AND email IS NULL
      AND operator IS NULL AND opening_hours IS NULL
  ),
  count(*)
) AS wynik
FROM fields
WHERE map_visibility = 'public';


-- ── 4. Obiekty stojące w tym samym punkcie (podejrzenie sklejenia) ──────────
-- Kilka boisk pod jednym adresem po forward-geocodingu ląduje na jednej
-- pinezce. Tu widać, gdzie mapa "zjadła" osobne boiska.
SELECT format(
  '%s obiektów w punkcie %s,%s → %s',
  count(*), round(lat::numeric, 5), round(lng::numeric, 5),
  string_agg(name, ' / ' ORDER BY name)
) AS wynik
FROM fields
WHERE lat IS NOT NULL
GROUP BY round(lat::numeric, 5), round(lng::numeric, 5)
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 30;


-- ── 5. Losowa próbka publicznych obiektów — do sprawdzenia z ręki ───────────
-- To jest zapytanie, którego wynik warto wkleić do rozmowy: da się po nim
-- ocenić, czy nazwa, adres, współrzędne i nawierzchnia trzymają się kupy.
SELECT format(
  '%s | %s | %s,%s | sport=%s | nawierzchnia=%s | typ=%s | wymiary=%s | boisk=%s | dostęp=%s | źródło=%s | AI=%s | tel=%s | www=%s',
  name,
  coalesce(address, '—'),
  round(lat::numeric, 5), round(lng::numeric, 5),
  coalesce(array_to_string(sport, '+'), '—'),
  coalesce(surface, '—'),
  coalesce(venue_type, '—'),
  coalesce(dimensions_m, '—'),
  coalesce(pitch_count::text, '—'),
  coalesce(access_type, '—'),
  coalesce(source, '—'),
  CASE WHEN ai_typed_at IS NOT NULL THEN 'tak' ELSE 'nie' END,
  CASE WHEN phone IS NOT NULL THEN 'tak' ELSE 'nie' END,
  CASE WHEN website IS NOT NULL THEN 'tak' ELSE 'nie' END
) AS wynik
FROM fields
WHERE map_visibility = 'public'
ORDER BY md5(id::text)      -- stabilna "losowość" — ta sama próbka przy powtórce
LIMIT 40;


-- ── 6. Sygnały ewidentnych błędów ───────────────────────────────────────────
SELECT format('%s: %s', etykieta, liczba) AS wynik
FROM (
  SELECT 'poza granicami Polski'      AS etykieta, count(*) AS liczba, 1 AS ord
    FROM fields WHERE lat IS NOT NULL AND (lat NOT BETWEEN 49 AND 55 OR lng NOT BETWEEN 14 AND 24.2)
  UNION ALL SELECT 'bez współrzędnych', count(*), 2 FROM fields WHERE lat IS NULL OR lng IS NULL
  UNION ALL SELECT 'nazwa krótsza niż 4 znaki', count(*), 3 FROM fields WHERE length(trim(name)) < 4
  UNION ALL SELECT 'adres bez numeru', count(*), 4 FROM fields WHERE address IS NULL OR address !~ '\d'
  UNION ALL SELECT 'is_verified_venue = false, a wciąż publiczne', count(*), 5
    FROM fields WHERE is_verified_venue = false AND map_visibility = 'public'
  UNION ALL SELECT 'zduplikowana nazwa+adres', count(*), 6 FROM (
    SELECT name, address FROM fields GROUP BY name, address HAVING count(*) > 1
  ) d
) s
ORDER BY ord;
