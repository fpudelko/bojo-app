-- Ile obiektów ma kontakt. Rozstrzyga, czy "Zarezerwuj" ma sens.

SELECT format('mail: %s | tel: %s | www: %s | mail LUB tel: %s | nic: %s | razem: %s',
  count(*) FILTER (WHERE email IS NOT NULL),
  count(*) FILTER (WHERE phone IS NOT NULL),
  count(*) FILTER (WHERE website IS NOT NULL),
  count(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL),
  count(*) FILTER (WHERE email IS NULL AND phone IS NULL AND website IS NULL),
  count(*)) AS wynik
FROM fields;
