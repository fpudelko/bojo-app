-- Kontakty przypisane przez enrich AI do NIENAZWANYCH obiektów.
--
-- Powód: model z web search dostawał wiersz "Boisko sportowe, ul. Szkolna"
-- i szukał kontaktu. Nie mając nazwy obiektu, trafiał w najbliższy pasujący
-- ośrodek i przypisywał jego telefon, mail i stronę. Stąd boisko piłkarskie
-- z linkiem do kortów tenisowych i orliki w Poznaniu z linkiem do orlika
-- w Środzie Wielkopolskiej.
--
-- Podgląd. Nic nie zapisuje.

SELECT format('%s | %s | tel=%s | mail=%s | www=%s',
  name, coalesce(address,'—'),
  coalesce(phone,'—'), coalesce(email,'—'), coalesce(website,'—')) AS wynik
FROM fields
WHERE (phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL)
  AND name ~* '^(Boisko|Orlik|Plac|Hala Sportowa)( |—|$|,)'
  AND name !~ '[A-ZŁŚŻŹĆŃÓĄĘ][a-ząćęłńóśźż]+ [A-ZŁŚŻŹĆŃÓĄĘ]'
ORDER BY name, address;
