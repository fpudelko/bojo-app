-- seed-demo-events.sql
-- Wipes ALL events, then creates a realistic demo set across dates/sports,
-- each filled with the test players (test1…@example.com) + named guests.
--
-- ── How to use ──────────────────────────────────────────────────────────────
--   1) First create test players: run supabase/seed-test-users.sql
--   2) Then paste this whole file into Supabase → SQL Editor → Run.
--
-- ⚠ Deletes every existing event (participants/comments cascade). Demo only.

do $$
declare
  v_users   uuid[];
  v_names   text[];
  n         int;
  rec       record;
  v_event   uuid;
  v_org     uuid;
  v_orgname text;
  v_target  int;
  v_realcap int;
  v_cur     int;
  i         int;
  idx       int;
  gi        int;
  guests    text[] := array[
    'Tomasz Lis','Paweł Krawczyk','Adrian Mazur','Bartosz Kaczmarek','Damian Wróbel',
    'Sebastian Pawlak','Grzegorz Adamczyk','Marcin Dudek','Łukasz Sikora','Rafał Baran',
    'Krzysztof Michalski','Dawid Olszewski','Patryk Stępień','Hubert Górski','Oskar Witkowski',
    'Filip Rutkowski','Wojciech Zawadzki','Konrad Sadowski','Igor Jakubowski','Kamil Walczak'
  ];
begin
  -- Collect test players.
  select array_agg(id order by email), array_agg(coalesce(display_name, 'Gracz') order by email)
    into v_users, v_names
    from profiles
   where email like 'test%@example.com';

  n := coalesce(array_length(v_users, 1), 0);
  if n = 0 then
    raise exception 'No test users found — run seed-test-users.sql first.';
  end if;

  -- Wipe existing events (cascades participants/comments/results).
  delete from events;

  -- Demo matches. ord drives which test user organizes each one.
  for rec in
    select * from (values
      (1,  'Środowa piłka 7v7',        'piłka nożna',        14, 1, '19:00', '21:00', 1500, 'Orlik Rataje',               52.3889, 16.9560, 'Regularna środowa gierka na sztucznej trawie. Gramy do dwóch straconych, rotacja składów. Poziom luźny — liczy się dobra zabawa. Buty turfy lub lanki.'),
      (2,  'Niedzielne 6v6 — hala',     'piłka nożna',        12, 3, '11:00', '12:30', 1800, 'Hala Politechnika',          52.4020, 16.9490, 'Gramy w hali 2×30 min, równe składy losowane na miejscu. Obuwie na halę obowiązkowe (jasna podeszwa). Stała ekipa — dobierzemy brakujących.'),
      (3,  'Piłka 7v7 — Wilda',         'piłka nożna',        14, 2, '18:30', '20:00',    0, 'Orlik Wilda',                52.3870, 16.9200, 'Za darmo, Orlik miejski. Spokojne tempo, mile widziani początkujący. Zbieramy pełne 7 na 7 — wpadaj jak brakuje Ci gry.'),
      (4,  'Poranna piłka 7v7',         'piłka nożna',        14, 5, '09:00', '10:30', 1200, 'Golęcin — kompleks boisk',   52.4350, 16.8950, 'Sobotni poranek, świeże nogi. Szybkie mecze do gola, zmiana co 10 min. Po wszystkim kawa w klubie.'),
      (5,  'Wieczorne 6v6',             'piłka nożna',        12, 7, '20:00', '21:30', 1600, 'Orlik Grunwald',             52.3990, 16.8800, 'Mecz pod światłami. Równe drużyny, gramy do 7 bramek lub do końca czasu. Szukamy kilku do kompletu.'),
      (6,  'Piłka 7v7 — Sołacz',        'piłka nożna',        14, 9, '18:00', '19:30', 1000, 'Park Sołacki — boisko',      52.4250, 16.9050, 'Trawa naturalna, klimatyczne miejsce. Luźna gra dla każdego poziomu. Bramkarz mile widziany!'),
      (7,  'Siatkówka plażowa 4v4',     'siatkówka plażowa',   8, 2, '17:00', '19:00',  800, 'Malta — boisko piaszczyste', 52.4030, 16.9760, 'Piasek nad Maltą, dwa boiska. Gramy do dwóch wygranych setów, rotacja par. Poziom rekreacyjny, woda i dobry humor obowiązkowe.'),
      (8,  'Plażówka po pracy',         'siatkówka plażowa',   8, 6, '18:30', '20:30',    0, 'Plaża Rataje',               52.3850, 16.9620, 'Luźne granie na piachu po pracy. Miksujemy składy, gramy krótkie sety. Za darmo — wpadaj uzupełnić ekipę.'),
      (9,  'Streetball 3x3',            'koszykówka',          6, 4, '19:00', '20:30',    0, 'Łęgi Dębińskie — boisko',    52.3870, 16.9080, 'Koszykówka uliczna do 21 punktów, winner stays. Jedna obręcz, szybkie zmiany. Za darmo, wpadaj na parkiet.'),
      (10, 'Kosz 5v5 — pełne boisko',   'koszykówka',         10, 8, '20:00', '21:30', 1400, 'Hala Politechnika',          52.4020, 16.9490, 'Pełnowymiarowe granie 5 na 5 w hali. Gramy na czas z sędzią-amatorem. Średni poziom, dobierzemy brakujących.')
    ) as t(ord, title, sport, maxp, days, etime, endt, cost, field, lat, lng, descr)
    order by ord
  loop
    v_org     := v_users[(rec.ord % n) + 1];
    v_orgname := v_names[(rec.ord % n) + 1];

    insert into events (
      organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
      title, description, event_date, event_time, end_time,
      max_players, external_count, visibility, team_mode, track_results,
      cost_grosz, invite_only
    ) values (
      v_org, v_orgname, rec.sport, null, rec.field, rec.lat, rec.lng,
      rec.title, rec.descr, current_date + rec.days, rec.etime::time, rec.endt::time,
      rec.maxp, 0, 'public', 'brak', rec.sport = 'piłka nożna',
      rec.cost, false
    )
    returning id into v_event;

    -- Fill: organizer + a few real players (with avatars) + named guests.
    v_target  := greatest(2, rec.maxp - floor(random() * 3)::int);   -- 0..2 free
    v_realcap := least(v_target - 1, n - 1, 3 + floor(random() * 6)::int);  -- 3..8

    -- organizer
    INSERT INTO event_participants (event_id, user_id, name, is_guest, is_reserve, is_goalkeeper)
    values (v_event, v_org, v_orgname, false, false, false);
    v_cur := 1;

    -- real players (offset start by ord for some variety)
    i := 0;
    while i < n and (v_cur - 1) < v_realcap loop
      idx := ((rec.ord + i) % n) + 1;
      if v_users[idx] <> v_org then
        INSERT INTO event_participants (event_id, user_id, name, is_guest, is_reserve, is_goalkeeper)
        values (v_event, v_users[idx], v_names[idx], false, false, false);
        v_cur := v_cur + 1;
      end if;
      i := i + 1;
    end loop;

    -- guests fill the rest
    gi := 1;
    while v_cur < v_target and gi <= array_length(guests, 1) loop
      INSERT INTO event_participants (event_id, user_id, name, is_guest, is_reserve, is_goalkeeper)
      values (v_event, null, guests[gi], true, false, false);
      v_cur := v_cur + 1;
      gi := gi + 1;
    end loop;

    -- One goalkeeper for ~70% of football matches.
    if rec.sport = 'piłka nożna' and random() < 0.7 then
      update event_participants
         set is_goalkeeper = true
       where id = (select id from event_participants where event_id = v_event order by random() limit 1);
    end if;
  end loop;
end $$;
