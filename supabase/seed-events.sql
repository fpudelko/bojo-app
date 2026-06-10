-- BOJO — seed events for UI development
-- Run in Supabase SQL editor.
-- Replace USER_ID with your actual user UUID from Authentication > Users.
-- Replace FIELD_IDs with real IDs from the fields table (or leave NULL for custom locations).
--
-- Usage:
--   1. Open Supabase dashboard → SQL editor
--   2. Replace 'YOUR-USER-UUID' below with your user id
--   3. Run the script

DO $$
DECLARE
  uid         uuid    := 'YOUR-USER-UUID';   -- ← replace
  org_name    text    := 'BOJO Dev';
  today       date    := current_date;

  -- Pick a couple of real field IDs (optional — NULL means custom location)
  f1 uuid; f2 uuid; f3 uuid;
  ev_id uuid;
BEGIN

  -- Try to grab some existing field IDs; fall back to NULL if none
  SELECT id INTO f1 FROM fields WHERE sport @> ARRAY['piłka nożna'] LIMIT 1;
  SELECT id INTO f2 FROM fields WHERE sport @> ARRAY['koszykówka']  LIMIT 1;
  SELECT id INTO f3 FROM fields WHERE sport @> ARRAY['siatkówka']   LIMIT 1;

  -- ── piłka nożna ──────────────────────────────────────────────────────────

  INSERT INTO events (organizer_id, organizer_name, sport, field_id, field_name,
    lat, lng, event_date, event_time, end_time, max_players, external_count,
    visibility, cost_grosz, status)
  VALUES
    (uid, org_name, 'piłka nożna', f1,
     COALESCE((SELECT name FROM fields WHERE id = f1), 'Orlik Grunwald'),
     52.3914, 16.8927,
     today + 0, '18:00', '19:30', 10, 3, 'public', 0, 'active'),

    (uid, org_name, 'piłka nożna', f1,
     COALESCE((SELECT name FROM fields WHERE id = f1), 'Orlik Rataje'),
     52.3942, 16.9580,
     today + 1, '17:30', '19:00', 14, 0, 'public', 500, 'active'),

    (uid, org_name, 'piłka nożna', NULL, 'Boisko Wilda',
     52.3857, 16.9278,
     today + 2, '20:00', NULL, 12, 4, 'public', 1000, 'active'),

    (uid, org_name, 'piłka nożna', f1,
     COALESCE((SELECT name FROM fields WHERE id = f1), 'Orlik Nowe Miasto'),
     52.4127, 16.9501,
     today + 3, '16:00', '17:30', 10, 0, 'public', 0, 'active'),

    (uid, org_name, 'piłka nożna', NULL, 'Park Sołacki',
     52.4145, 16.8901,
     today + 4, '19:00', '20:30', 8, 2, 'private', 0, 'active'),

    (uid, org_name, 'futsal', NULL, 'Hala Sportowa Retkinia',
     52.3988, 16.8423,
     today + 1, '20:30', '22:00', 10, 0, 'public', 1500, 'active'),

  -- ── koszykówka ────────────────────────────────────────────────────────────

    (uid, org_name, 'koszykówka', f2,
     COALESCE((SELECT name FROM fields WHERE id = f2), 'Boisko Jeżyce'),
     52.4120, 16.8950,
     today + 0, '19:00', '20:30', 10, 0, 'public', 0, 'active'),

    (uid, org_name, 'koszykówka', NULL, '3×3 przy Starej Rzeźni',
     52.3947, 16.9420,
     today + 2, '18:00', NULL, 6, 2, 'public', 0, 'active'),

  -- ── siatkówka plażowa ─────────────────────────────────────────────────────

    (uid, org_name, 'siatkówka plażowa', NULL, 'Malta Beach',
     52.3962, 17.0430,
     today + 1, '16:00', '18:00', 12, 0, 'public', 0, 'active'),

    (uid, org_name, 'siatkówka plażowa', NULL, 'Plaża Strzeszyn',
     52.4482, 16.9175,
     today + 3, '17:00', '19:00', 8, 0, 'public', 0, 'active'),

  -- ── siatkówka (sala) ──────────────────────────────────────────────────────

    (uid, org_name, 'siatkówka', f3,
     COALESCE((SELECT name FROM fields WHERE id = f3), 'Sala Sportowa UAM'),
     52.4128, 16.9016,
     today + 2, '21:00', '22:30', 12, 0, 'public', 800, 'active'),

    (uid, org_name, 'siatkówka', NULL, 'Hala przy Taborowej',
     52.3601, 16.9017,
     today + 5, '19:00', '20:30', 12, 3, 'public', 0, 'active'),

  -- ── piłka ręczna ──────────────────────────────────────────────────────────

    (uid, org_name, 'piłka ręczna', NULL, 'Hala Dębiec',
     52.3788, 16.9108,
     today + 4, '18:30', '20:00', 14, 0, 'public', 1200, 'active')
  ;

  -- Add a handful of participants to some events so progress bars look real
  FOR ev_id IN
    SELECT id FROM events
    WHERE organizer_id = uid
      AND event_date >= today
    ORDER BY event_date, event_time
    LIMIT 6
  LOOP
    -- Add 2–6 guest participants per event so participant count shows
    INSERT INTO event_participants (event_id, user_id, name, is_guest, is_reserve)
    SELECT ev_id, NULL,
           (ARRAY['Marek','Tomek','Paweł','Kuba','Michał','Bartek','Piotrek','Łukasz'])[floor(random()*8+1)::int],
           true, false
    FROM generate_series(1, floor(random()*5+2)::int)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Seed complete — % events created for user %',
    (SELECT count(*) FROM events WHERE organizer_id = uid AND event_date >= today), uid;
END $$;
