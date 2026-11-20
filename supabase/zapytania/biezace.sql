SELECT t.id, t.nazwa, t.status, t.format, t.widocznosc, t.max_druzyn, left(coalesce(t.opis,''),40) AS opis,
       t.organizator_id, (SELECT email FROM auth.users u WHERE u.id = t.organizator_id) AS org_email,
       (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id) AS druzyn,
       (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id) AS meczow,
       t.created_at, left(coalesce(t.regulamin,''),80) AS regulamin
FROM turnieje t WHERE t.nazwa ILIKE '%marys%' OR t.opis ILIKE '%marys%' ORDER BY t.created_at;
SELECT id, email FROM auth.users WHERE email IN ('franekks@gmail.com','franciszekpudelko@gmail.com');
SELECT column_name FROM information_schema.columns WHERE table_name='turniej_druzyny' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name='turniej_zawodnicy' ORDER BY ordinal_position;
