-- ============================================================================
-- BOJO — seed script for UI development
-- ----------------------------------------------------------------------------
-- Creates a few dozen FAKE USERS and a batch of EVENTS spread across the next
-- two weeks, then signs the fake users up to those events (some full, some with
-- a reserve list, some half-empty) so the UI can be tested with realistic data.
--
-- HOW TO RUN
--   1. Open Supabase dashboard → SQL editor
--   2. (optional) put your own user UUID in `me` below to also be enrolled in a
--      handful of games — leave it as-is to skip that.
--   3. Run the whole script. Re-running is safe: it first removes the previous
--      seed (everything under the @seed.bojo email domain) and recreates it.
--
-- All seeded data is tagged with the @seed.bojo email domain, so cleanup is a
-- one-liner:  DELETE FROM auth.users WHERE email LIKE '%@seed.bojo';
-- ============================================================================

DO $$
DECLARE
  -- ── Config ────────────────────────────────────────────────────────────────
  me            uuid    := NULL;          -- ← optional: your real user UUID
  n_users       int     := 48;            -- how many fake players to create
  days_ahead    int     := 14;            -- spread events across N days

  first_names text[] := ARRAY[
    'Kuba','Michał','Patryk','Tomek','Bartek','Wojtek','Adam','Paweł','Marcin','Kamil',
    'Łukasz','Piotr','Mateusz','Dawid','Szymon','Filip','Jan','Krzysztof','Grzegorz','Rafał',
    'Ola','Kasia','Magda','Ania','Natalia','Zuzia','Ewa','Marta','Karolina','Julia',
    'Dominik','Hubert','Igor','Oskar','Sebastian','Maciej','Norbert','Przemek','Artur','Damian',
    'Weronika','Patrycja','Aleksandra','Gosia','Paulina','Sandra','Nikola','Wiktoria'
  ];
  last_names text[] := ARRAY[
    'Nowak','Kowalski','Wiśniewski','Wójcik','Kowalczyk','Kamiński','Lewandowski','Zieliński',
    'Szymański','Woźniak','Dąbrowski','Kozłowski','Jankowski','Mazur','Kwiatkowski','Krawczyk',
    'Piotrowski','Grabowski','Nowicki','Pawłowski','Michalski','Adamczyk','Dudek','Zając',
    'Wieczorek','Jabłoński','Król','Majewski','Olszewski','Jaworski'
  ];

  evening_times time[] := ARRAY['17:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00']::time[];
  sports        text[] := ARRAY['piłka nożna','futsal','koszykówka','siatkówka','siatkówka plażowa'];

  fake_ids   uuid[] := '{}';
  fake_names text[] := '{}';

  fid   uuid;
  fname text;
  i     int;
  d     int;
  e     int;
  n_events_today int;

  -- per-event vars
  sport_choice text;
  ev_max  int;
  ev_id   uuid;
  ev_date date;
  ev_time time;
  ev_cost int;
  ev_vis  text;
  ev_invite boolean;
  f_id   uuid;
  f_name text;
  f_lat  numeric;
  f_lng  numeric;
  signup_count int;
  org_id uuid;
  org_name text;
BEGIN
  -- ── 0. Clean up any previous seed run ─────────────────────────────────────
  DELETE FROM auth.users WHERE email LIKE '%@seed.bojo';

  -- ── 1. Create fake users (auth.users + profiles) ──────────────────────────
  FOR i IN 1..n_users LOOP
    fid   := gen_random_uuid();
    fname := first_names[1 + floor(random() * array_length(first_names, 1))::int]
             || ' ' ||
             last_names[1 + floor(random() * array_length(last_names, 1))::int];

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', fid, 'authenticated', 'authenticated',
      'player' || i || '@seed.bojo', crypt('seedpass123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('name', fname),
      now(), now(), '', '', '', ''
    );

    INSERT INTO profiles (id) VALUES (fid) ON CONFLICT (id) DO NOTHING;

    fake_ids   := array_append(fake_ids, fid);
    fake_names := array_append(fake_names, fname);
  END LOOP;

  -- ── 2. Create events across the next `days_ahead` days ────────────────────
  FOR d IN 0..days_ahead LOOP
    -- weekends get more games
    n_events_today := CASE WHEN extract(dow FROM current_date + d) IN (0, 6)
                           THEN 2 + floor(random() * 2)::int   -- 2-3
                           ELSE 1 + floor(random() * 2)::int   -- 1-2
                      END;

    FOR e IN 1..n_events_today LOOP
      sport_choice := sports[1 + floor(random() * array_length(sports, 1))::int];

      ev_max := CASE sport_choice
                  WHEN 'piłka nożna'       THEN (ARRAY[10,12,14])[1 + floor(random()*3)::int]
                  WHEN 'futsal'            THEN 10
                  WHEN 'koszykówka'        THEN (ARRAY[6,10])[1 + floor(random()*2)::int]
                  WHEN 'siatkówka'         THEN 12
                  WHEN 'siatkówka plażowa' THEN (ARRAY[4,6,8])[1 + floor(random()*3)::int]
                  ELSE 10
                END;

      ev_date := current_date + d;
      ev_time := evening_times[1 + floor(random() * array_length(evening_times, 1))::int];
      ev_cost := (ARRAY[0, 0, 0, 1500, 2000, 2500, 3000])[1 + floor(random()*7)::int];
      ev_vis  := CASE WHEN random() < 0.85 THEN 'public' ELSE 'private' END;
      ev_invite := random() < 0.10;  -- ~10% invite-only

      -- Organizer: usually a fake user, occasionally you (`me`)
      IF me IS NOT NULL AND random() < 0.25 THEN
        org_id := me;
        SELECT COALESCE(raw_user_meta_data->>'name', email) INTO org_name FROM auth.users WHERE id = me;
        org_name := COALESCE(org_name, 'Organizator');
      ELSE
        i := 1 + floor(random() * array_length(fake_ids, 1))::int;
        org_id   := fake_ids[i];
        org_name := fake_names[i];
      END IF;

      -- Pick a real field matching the sport (fallback to a custom Poznań point)
      SELECT id, name, lat, lng INTO f_id, f_name, f_lat, f_lng
      FROM fields
      WHERE sport @> ARRAY[sport_choice]
        AND lat IS NOT NULL AND lng IS NOT NULL
        AND COALESCE(map_visibility, 'public') <> 'hidden'
      ORDER BY random()
      LIMIT 1;

      IF f_id IS NULL THEN
        f_name := 'Boisko ' || sport_choice;
        f_lat  := 52.40 + (random() - 0.5) * 0.08;
        f_lng  := 16.90 + (random() - 0.5) * 0.12;
      END IF;

      INSERT INTO events (
        organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
        title, event_date, event_time, end_time, max_players,
        external_count, visibility, cost_grosz, status, invite_only
      ) VALUES (
        org_id, org_name, sport_choice, f_id, f_name, f_lat, f_lng,
        NULL, ev_date, ev_time, (ev_time + interval '90 minutes')::time, ev_max,
        floor(random() * 3)::int, ev_vis, ev_cost, 'active', ev_invite
      )
      RETURNING id INTO ev_id;

      -- ── 3. Sign fake users up (some events fill up, some don't) ───────────
      signup_count := LEAST(
        array_length(fake_ids, 1),
        GREATEST(1, round(ev_max * (0.4 + random() * 0.85))::int)  -- 40%–125% of capacity
      );

      INSERT INTO event_participants (event_id, user_id, name, is_guest, is_reserve)
      SELECT ev_id, picked.id, picked.nm, false, picked.rn > ev_max
      FROM (
        SELECT t.id, t.nm, row_number() OVER (ORDER BY random()) AS rn
        FROM unnest(fake_ids, fake_names) AS t(id, nm)
        ORDER BY random()
        LIMIT signup_count
      ) picked
      ON CONFLICT (event_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ── 4. Enrol the real user in a handful of upcoming games (optional) ──────
  IF me IS NOT NULL THEN
    INSERT INTO event_participants (event_id, user_id, name, is_guest, is_reserve)
    SELECT ev.id, me, COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = me), 'Ja'), false, false
    FROM events ev
    WHERE ev.organizer_id <> me
      AND ev.event_date >= current_date
      AND NOT EXISTS (SELECT 1 FROM event_participants p WHERE p.event_id = ev.id AND p.user_id = me)
    ORDER BY random()
    LIMIT 5
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Seed complete: % fake users created.', n_users;
END $$;
