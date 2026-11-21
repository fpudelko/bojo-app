-- ============================================================================
-- 180_turniej_ekran_komunikat.sql — ogłoszenie i link (np. zbiórka) na ekranie
-- turnieju na halę.
-- ----------------------------------------------------------------------------
-- DLACZEGO. Ekran na halę (`/turnieje/[id]/ekran`, 2026-11-21) pokazuje
-- wyniki i kod QR do strony turnieju. Turniej charytatywny („Gramy dla
-- Marysi”) ma do powiedzenia jeszcze jedno: na co zbiera i gdzie wpłacić.
-- Organizator wpisuje ogłoszenie i link (zrzutka, strona fundacji) w panelu,
-- a ekran pokazuje tekst i drugi kod QR prowadzący pod ten link.
--
-- W BAZIE, NIE W ADRESIE EKRANU. Ekran wisi na rzutniku podpiętym do
-- laptopa, a organizator chodzi po hali z telefonem: zmiana ogłoszenia
-- („licytacja koszulki o 13:00”) ma dotrzeć na ścianę bez dotykania
-- laptopa. Ekran odświeża dane co 15 s, więc wystarczy zapis w panelu.
--
-- Kolumny w `turnieje`, którą czyta każdy (jak opis i regulamin), a pisze
-- zarządzający turniejem (polityki 145). Link tylko http(s): trafia do kodu
-- QR, który skanuje obcy telefon, więc `javascript:` czy inny schemat nie
-- ma prawa się tam znaleźć.
--
-- Same dokładające zmiany (kolumny i CHECK), automatem.
-- ============================================================================

ALTER TABLE turnieje
  ADD COLUMN IF NOT EXISTS ekran_komunikat text,
  ADD COLUMN IF NOT EXISTS ekran_link text,
  ADD COLUMN IF NOT EXISTS ekran_link_opis text;

ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS turnieje_ekran_komunikat_dlugosc;
ALTER TABLE turnieje ADD CONSTRAINT turnieje_ekran_komunikat_dlugosc
  CHECK (ekran_komunikat IS NULL OR char_length(ekran_komunikat) <= 280);

ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS turnieje_ekran_link_http;
ALTER TABLE turnieje ADD CONSTRAINT turnieje_ekran_link_http
  CHECK (ekran_link IS NULL OR (ekran_link ~* '^https?://[^[:space:]]+$' AND char_length(ekran_link) <= 500));

ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS turnieje_ekran_link_opis_dlugosc;
ALTER TABLE turnieje ADD CONSTRAINT turnieje_ekran_link_opis_dlugosc
  CHECK (ekran_link_opis IS NULL OR char_length(ekran_link_opis) <= 60);
