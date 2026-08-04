#!/usr/bin/env node
/**
 * Skleja migracje i seedy w kilka dużych plików do wklejenia w Supabase SQL Editor.
 *
 * Powód: postawienie nowej bazy oznacza uruchomienie ~60 plików po kolei. Ręczne
 * wklejanie ich jeden po drugim to prosta droga do pominięcia jednego i długiego
 * szukania, czemu aplikacja rzuca błędem o nieznanej kolumnie.
 *
 * Wynik trafia do supabase/bundles/ i JEST commitowany — żeby dało się go otworzyć
 * na GitHubie i skopiować bez klonowania repo.
 *
 * Uruchomienie:  node scripts/build-db-bundles.mjs
 * Po dodaniu nowej migracji: uruchom ponownie i zacommituj wynik.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const outDir = join(root, 'supabase', 'bundles');

mkdirSync(outDir, { recursive: true });

const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const numberOf = (f) => parseInt(f.slice(0, 3), 10);

function banner(title, body) {
  return [
    '-- ============================================================================',
    `-- ${title}`,
    '-- ============================================================================',
    ...body.map((l) => `-- ${l}`),
    '-- ============================================================================',
    '',
    '',
  ].join('\n');
}

function concatFiles(dir, files) {
  return files
    .map((f) => {
      const sql = readFileSync(join(dir, f), 'utf8').trimEnd();
      return [
        '',
        `-- ─────────────────────────────────────────────────────────────────────────`,
        `-- ${f}`,
        `-- ─────────────────────────────────────────────────────────────────────────`,
        sql,
        '',
      ].join('\n');
    })
    .join('\n');
}

// --- Migracje w trzech częściach ------------------------------------------
const parts = [
  { name: '01-migracje-001-020.sql', from: 1, to: 20 },
  { name: '02-migracje-021-040.sql', from: 21, to: 40 },
  { name: '03-migracje-041-koniec.sql', from: 41, to: 999 },
];

for (const [i, part] of parts.entries()) {
  const files = migrations.filter((f) => numberOf(f) >= part.from && numberOf(f) <= part.to);
  const last = files.at(-1);
  const head = banner(`BOJO — migracje, część ${i + 1} z ${parts.length}`, [
    `Zawiera ${files.length} migracji: ${files[0]} → ${last}`,
    '',
    'Wklej CAŁOŚĆ do Supabase → SQL Editor → Run.',
    'Uruchamiaj części PO KOLEI — późniejsze migracje zakładają wcześniejsze.',
    '',
    'Plik generowany: node scripts/build-db-bundles.mjs — nie edytuj ręcznie.',
  ]);
  writeFileSync(join(outDir, part.name), head + concatFiles(migrationsDir, files));
  console.log(`${part.name}: ${files.length} migracji`);
}

// --- Seedy ------------------------------------------------------------------
// Kolejność ma znaczenie: boiska → konta → wydarzenia (te ostatnie odwołują się
// do kont po e-mailu i wywalą się z wyjątkiem, jeśli konta nie istnieją).
const seedFiles = ['seed-orliki.sql', 'seed-test-users.sql', 'seed_test_data.sql', 'seed_test_groups.sql', 'seed_test_jan.sql'];

// Konta organizatorów zakładane hasłem, bo świeży projekt nie ma jeszcze
// skonfigurowanego Google OAuth, a seed_test_data.sql ich wymaga.
const devOrganizers = `
-- ─────────────────────────────────────────────────────────────────────────
-- Konta organizatorów (tylko baza deweloperska)
-- ─────────────────────────────────────────────────────────────────────────
-- seed_test_data.sql wymaga tych kont w auth.users. Na świeżym projekcie nie
-- ma jeszcze Google OAuth, więc zakładamy je hasłem — tym samym co konta
-- testowe (test1234). Później można się na nie zalogować także przez Google.
--
-- NIE uruchamiaj tego na produkcji: tam konta powstają przez prawdziwe logowanie.

do $$
declare
  rec  record;
  v_id uuid;
begin
  for rec in
    select * from (values
      ('franciszekpudelko@gmail.com', 'Franciszek'),
      ('franekks@gmail.com',          'Franek'),
      ('j4n.brz0@gmail.com',          'Jan')
    ) as t(email, name)
  loop
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
      jsonb_build_object('display_name', rec.name),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', rec.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    update profiles set display_name = rec.name, email = rec.email where id = v_id;
  end loop;
end $$;
`;

const seedHead = banner('BOJO — seedy (boiska, konta, wydarzenia testowe)', [
  'Wklej CAŁOŚĆ do Supabase → SQL Editor → Run.',
  'URUCHOM DOPIERO PO wszystkich trzech częściach migracji.',
  '',
  'Zawiera:',
  '  1. boiska (seed-orliki.sql)',
  '  2. konta testowe test1..test10@example.com, hasło test1234',
  '  3. konta organizatorów (hasło test1234) — tylko dla bazy deweloperskiej',
  '  4. 25 wydarzeń testowych pokrywających przepływy aplikacji',
  '  5. 4 grupy + 11 meczów prywatnych (seed_test_groups.sql)',
  '  6. 19 wydarzeń dla Jana — wyniki, historia, komentarze (seed_test_jan.sql)',
  '',
  'Bezpieczny do wielokrotnego uruchamiania: istniejące konta są pomijane,',
  'a wydarzenia oznaczone [TEST] kasowane i tworzone od nowa.',
  '',
  'Plik generowany: node scripts/build-db-bundles.mjs — nie edytuj ręcznie.',
]);

const seedsDir = join(root, 'supabase');
const seedBody =
  concatFiles(seedsDir, seedFiles.slice(0, 2)) +
  devOrganizers +
  concatFiles(seedsDir, seedFiles.slice(2));  // wydarzenia + grupy — wymagają kont powyżej

writeFileSync(join(outDir, '04-seedy.sql'), seedHead + seedBody);
console.log('04-seedy.sql: boiska + konta + wydarzenia testowe');
