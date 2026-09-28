-- Bufor jednorazowy. Agent nadpisuje ten plik zapytaniem i pushuje na gałąź
-- `claude/sql/**` — push sam uruchamia workflow „SQL (tylko odczyt)", a wynik
-- ląduje w logu Actions. Treść nic nie znaczy między uruchomieniami i nie ma
-- powodu, żeby trafiała na mastera.
--
-- Zapytania warte zachowania mieszkają obok jako osobne pliki .sql.

-- Weryfikacja po ręcznym wklejeniu migracji 168/169 w SQL Editorze (produkcja):
-- porównanie faktycznych ciał czterech funkcji z checksumą, jakiej oczekuje
-- repo (ten sam wzorzec co scripts/odcisk-schematu.sh).
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       left(md5(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g')), 12) AS suma
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('podejrzyj_wpis_goscia','ustaw_email_goscia','wyslij_mail_do_konta','wyslij_mail_po_powiadomieniu')
 ORDER BY p.proname;

SELECT numer, plik FROM schema_migracje ORDER BY numer DESC LIMIT 5;
