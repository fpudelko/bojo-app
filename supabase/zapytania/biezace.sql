SELECT t.id, t.nazwa, t.status, t.widocznosc,
       (SELECT email FROM auth.users u WHERE u.id = t.organizator_id) AS organizator,
       (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id) AS druzyn,
       (SELECT count(*) FROM turniej_mecze m WHERE m.turniej_id = t.id AND m.status <> 'zaplanowany') AS rozegranych
  FROM turnieje t ORDER BY t.created_at;
