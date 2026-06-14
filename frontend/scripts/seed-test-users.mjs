// Seed test accounts for Bojo — realistic Polish names + avatar photos.
//
// Creates ~10 confirmed accounts you can log into straight away (no email
// confirmation needed). Safe to re-run: existing accounts are updated, not
// duplicated.
//
// ── How to run ──────────────────────────────────────────────────────────────
//   cd frontend
//   SUPABASE_URL="https://YOURPROJECT.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..." \
//   node scripts/seed-test-users.mjs
//
// Get the service_role key in Supabase: Project Settings → API → service_role.
// NEVER commit it or expose it in the browser — it bypasses all security.
//
// Optional: TEST_PASSWORD="..." to override the default password.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.TEST_PASSWORD || 'test1234';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '\n✗ Missing env vars.\n' +
      '  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, e.g.:\n\n' +
      '  SUPABASE_URL="https://xxx.supabase.co" \\\n' +
      '  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \\\n' +
      '  node scripts/seed-test-users.mjs\n',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 10 test players — realistic Polish names + portrait photos (randomuser.me).
const PEOPLE = [
  { email: 'test1@example.com',  name: 'Jakub Kowalski',        avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { email: 'test2@example.com',  name: 'Mateusz Nowak',         avatar: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { email: 'test3@example.com',  name: 'Piotr Wiśniewski',      avatar: 'https://randomuser.me/api/portraits/men/12.jpg' },
  { email: 'test4@example.com',  name: 'Kacper Wójcik',         avatar: 'https://randomuser.me/api/portraits/men/76.jpg' },
  { email: 'test5@example.com',  name: 'Michał Kamiński',       avatar: 'https://randomuser.me/api/portraits/men/8.jpg'  },
  { email: 'test6@example.com',  name: 'Zuzanna Lewandowska',   avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { email: 'test7@example.com',  name: 'Julia Zielińska',       avatar: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { email: 'test8@example.com',  name: 'Maja Szymańska',        avatar: 'https://randomuser.me/api/portraits/women/21.jpg' },
  { email: 'test9@example.com',  name: 'Aleksandra Woźniak',    avatar: 'https://randomuser.me/api/portraits/women/33.jpg' },
  { email: 'test10@example.com', name: 'Natalia Dąbrowska',     avatar: 'https://randomuser.me/api/portraits/women/57.jpg' },
];

/** Find an existing auth user by email (paginated listUsers). */
async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsertProfile(id, person) {
  // The signup trigger creates a profile with display_name, but never sets the
  // avatar — so write both here (service role bypasses RLS).
  const { error } = await supabase.from('profiles').upsert({
    id,
    email: person.email,
    display_name: person.name,
    avatar_url: person.avatar,
  });
  if (error) console.warn(`   ⚠ profile upsert failed: ${error.message}`);
}

async function run() {
  console.log(`\nSeeding ${PEOPLE.length} test accounts (password: "${PASSWORD}")\n`);

  for (const person of PEOPLE) {
    const meta = { display_name: person.name, avatar_url: person.avatar };

    const { data, error } = await supabase.auth.admin.createUser({
      email: person.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: meta,
    });

    let userId = data?.user?.id;

    if (error) {
      // Most likely: already registered → update instead of failing.
      const existing = await findUserByEmail(person.email);
      if (!existing) {
        console.error(`✗ ${person.email} — ${error.message}`);
        continue;
      }
      userId = existing.id;
      await supabase.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: meta,
      });
      await upsertProfile(userId, person);
      console.log(`↻ ${person.email.padEnd(20)} ${person.name} (updated)`);
      continue;
    }

    await upsertProfile(userId, person);
    console.log(`✓ ${person.email.padEnd(20)} ${person.name}`);
  }

  console.log(
    `\nDone. Log in with any email above and password "${PASSWORD}".\n` +
      'Tip: use an incognito window per account to stay logged in as several at once.\n',
  );
}

run().catch((e) => {
  console.error('\nFatal:', e.message || e);
  process.exit(1);
});
