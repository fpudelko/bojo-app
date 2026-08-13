-- Atrapy tego, co w Supabase dostajemy z pudełka.
--
-- Migracje w tym repo zakładają istnienie schematu `auth` (tabela `users`,
-- funkcja `auth.uid()`), schematu `extensions` z pgcrypto i roli `authenticated`.
-- Na gołym Postgresie nic tego nie ma, więc tworzymy minimum, które pozwala
-- migracjom przejść i sprawdzić, czy są ze sobą spójne.
--
-- To NIE jest odtworzenie Supabase — służy wyłącznie do sprawdzenia w CI,
-- że migracje aplikują się od zera i że kolejne nie odwołują się do rzeczy,
-- które wcześniejsze usunęły. Dokładnie ta klasa błędu wywróciła produkcję
-- (`get_player_stats` po skasowanej kolumnie `status`).

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Funkcje pgcrypto bywają wołane bez kwalifikacji schematu — w Supabase
-- `extensions` jest w `search_path` bazy, u nas nie. Zamiast bawić się
-- w `search_path` (który migracje same sobie ustawiają w SECURITY DEFINER),
-- wystawiamy cienkie opakowania w `public`.
CREATE OR REPLACE FUNCTION public.gen_random_uuid() RETURNS uuid
  LANGUAGE sql AS $$ SELECT extensions.gen_random_uuid() $$;

CREATE OR REPLACE FUNCTION public.gen_random_bytes(int) RETURNS bytea
  LANGUAGE sql AS $$ SELECT extensions.gen_random_bytes($1) $$;

CREATE OR REPLACE FUNCTION public.crypt(text, text) RETURNS text
  LANGUAGE sql AS $$ SELECT extensions.crypt($1, $2) $$;

CREATE OR REPLACE FUNCTION public.gen_salt(text) RETURNS text
  LANGUAGE sql AS $$ SELECT extensions.gen_salt($1) $$;

CREATE OR REPLACE FUNCTION public.digest(text, text) RETURNS bytea
  LANGUAGE sql AS $$ SELECT extensions.digest($1, $2) $$;

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  aud varchar(255),
  role varchar(255),
  email varchar(255) UNIQUE,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change_token_new varchar(255),
  email_change varchar(255)
);

CREATE TABLE IF NOT EXISTS auth.identities (
  provider_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()
);

-- Tożsamość „zalogowanego" ustawiamy zmienną sesji, tak jak robi to PostgREST.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

-- Storage: bucket na awatary. Migracja `006` zakłada polityki na
-- `storage.objects`, więc bez tej tabeli nie da się jej zastosować.
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb
);

-- `storage.foldername(name)` — helper Supabase używany w politykach.
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
  LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;

-- Publikacja realtime. Migracje dopisują do niej tabele
-- (`ALTER PUBLICATION supabase_realtime ADD TABLE …`), a bez niej padają.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
