-- Bufor jednorazowy. Agent nadpisuje ten plik zapytaniem i pushuje na gałąź
-- `claude/sql/**` — push sam uruchamia workflow „SQL (tylko odczyt)", a wynik
-- ląduje w logu Actions. Treść nic nie znaczy między uruchomieniami i nie ma
-- powodu, żeby trafiała na mastera.
--
-- Zapytania warte zachowania mieszkają obok jako osobne pliki .sql.

SELECT count(*) AS boisk_w_katalogu FROM fields;
