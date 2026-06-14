-- seed-test-users.sql
-- Quick way to create test accounts straight from the Supabase SQL editor.
-- All accounts share the password:  test1234
-- Emails:  test1@example.com … test10@example.com
--
-- ── How to use ──────────────────────────────────────────────────────────────
--   Supabase dashboard → SQL Editor → paste this whole file → Run.
--   Then log in with e.g. test1@example.com / test1234.
--
-- Safe to re-run: accounts that already exist are skipped.
-- The handle_new_user() trigger auto-creates the matching `profiles` row; we
-- also set the avatar afterwards so test players show a photo.
--
-- NOTE: this writes directly into auth.users — that's fine for a test project.
-- If your GoTrue version complains about a NULL token column, use the Node
-- script instead: frontend/scripts/seed-test-users.mjs (uses the official API).

do $$
declare
  rec   record;
  v_id  uuid;
begin
  for rec in
    select * from (values
      ('test1@example.com',  'Jakub Kowalski',      'https://randomuser.me/api/portraits/men/32.jpg'),
      ('test2@example.com',  'Mateusz Nowak',       'https://randomuser.me/api/portraits/men/45.jpg'),
      ('test3@example.com',  'Piotr Wiśniewski',    'https://randomuser.me/api/portraits/men/12.jpg'),
      ('test4@example.com',  'Kacper Wójcik',       'https://randomuser.me/api/portraits/men/76.jpg'),
      ('test5@example.com',  'Michał Kamiński',     'https://randomuser.me/api/portraits/men/8.jpg'),
      ('test6@example.com',  'Zuzanna Lewandowska', 'https://randomuser.me/api/portraits/women/44.jpg'),
      ('test7@example.com',  'Julia Zielińska',     'https://randomuser.me/api/portraits/women/68.jpg'),
      ('test8@example.com',  'Maja Szymańska',      'https://randomuser.me/api/portraits/women/21.jpg'),
      ('test9@example.com',  'Aleksandra Woźniak',  'https://randomuser.me/api/portraits/women/33.jpg'),
      ('test10@example.com', 'Natalia Dąbrowska',   'https://randomuser.me/api/portraits/women/57.jpg')
    ) as t(email, name, avatar)
  loop
    -- Skip if the account already exists.
    if exists (select 1 from auth.users where email = rec.email) then
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      rec.email, extensions.crypt('test1234', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', rec.name, 'avatar_url', rec.avatar),
      '', '', '', ''
    );

    -- Email identity (so password login behaves like a dashboard-created user).
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', rec.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    -- Trigger already inserted the profile; make sure name + avatar are set.
    update profiles
       set display_name = rec.name,
           avatar_url   = rec.avatar,
           email        = rec.email
     where id = v_id;
  end loop;
end $$;
