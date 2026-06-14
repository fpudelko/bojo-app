// Seed DEMO matches for Bojo — wipes all events, then creates a realistic set
// across dates/sports, each filled with the test players (+ named guests).
//
// Goal: show what the app looks like once it's busy, and have something to demo.
//
// ── Run it ───────────────────────────────────────────────────────────────────
//   1) First create the test players (once):  node scripts/seed-test-users.mjs
//   2) Then:
//        cd frontend
//        SUPABASE_URL="https://YOURPROJECT.supabase.co" \
//        SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..." \
//        node scripts/seed-demo-events.mjs
//
// ⚠ This DELETES every existing event (and their participants/comments via
//   cascade). Only run it on a test/demo project.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n✗ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Project Settings → API).\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── helpers ──────────────────────────────────────────────────────────────────
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const dateIn = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Named guests so full rosters look real (these have no account → show initials).
const GUEST_NAMES = [
  'Tomasz Lis', 'Paweł Krawczyk', 'Adrian Mazur', 'Bartosz Kaczmarek', 'Damian Wróbel',
  'Sebastian Pawlak', 'Grzegorz Adamczyk', 'Marcin Dudek', 'Łukasz Sikora', 'Rafał Baran',
  'Krzysztof Michalski', 'Dawid Olszewski', 'Patryk Stępień', 'Hubert Górski', 'Oskar Witkowski',
  'Filip Rutkowski', 'Wojciech Zawadzki', 'Konrad Sadowski', 'Igor Jakubowski', 'Kamil Walczak',
];

// ── demo matches (Poznań venues as custom locations) ─────────────────────────
const EVENTS = [
  { title: 'Środowa piłka 7v7', sport: 'piłka nożna', max: 14, days: 1, time: '19:00', end: '21:00', cost: 1500,
    field: 'Orlik Rataje', lat: 52.3889, lng: 16.9560,
    desc: 'Regularna środowa gierka na sztucznej trawie. Gramy do dwóch straconych, rotacja składów. Poziom luźny — liczy się dobra zabawa i pełne składy. Buty turfy lub lanki.' },
  { title: 'Niedzielne 6v6 — hala', sport: 'piłka nożna', max: 12, days: 3, time: '11:00', end: '12:30', cost: 1800,
    field: 'Hala Politechnika', lat: 52.4020, lng: 16.9490,
    desc: 'Gramy w hali 2×30 min, równe składy losowane na miejscu. Obuwie na halę obowiązkowe (jasna podeszwa). Kameralna, stała ekipa — dobierzemy brakujących.' },
  { title: 'Piłka 7v7 — Wilda', sport: 'piłka nożna', max: 14, days: 2, time: '18:30', end: '20:00', cost: 0,
    field: 'Orlik Wilda', lat: 52.3870, lng: 16.9200,
    desc: 'Za darmo, Orlik miejski. Spokojne tempo, mile widziani początkujący. Zbieramy pełne 7 na 7 — wpadaj jak brakuje Ci gry.' },
  { title: 'Poranna piłka 7v7', sport: 'piłka nożna', max: 14, days: 5, time: '09:00', end: '10:30', cost: 1200,
    field: 'Golęcin — kompleks boisk', lat: 52.4350, lng: 16.8950,
    desc: 'Sobotni poranek, świeże nogi. Gramy szybkie mecze do gola, zmiana co 10 min. Po wszystkim kawa w klubie.' },
  { title: 'Wieczorne 6v6', sport: 'piłka nożna', max: 12, days: 7, time: '20:00', end: '21:30', cost: 1600,
    field: 'Orlik Grunwald', lat: 52.3990, lng: 16.8800,
    desc: 'Mecz pod światłami. Równe drużyny, gramy do 7 bramek lub do końca czasu. Stała grupa, szukamy kilku do kompletu.' },
  { title: 'Piłka 7v7 — Sołacz', sport: 'piłka nożna', max: 14, days: 9, time: '18:00', end: '19:30', cost: 1000,
    field: 'Park Sołacki — boisko', lat: 52.4250, lng: 16.9050,
    desc: 'Trawa naturalna, klimatyczne miejsce. Luźna gra dla każdego poziomu. Bramkarz mile widziany!' },

  { title: 'Siatkówka plażowa 4v4', sport: 'siatkówka plażowa', max: 8, days: 2, time: '17:00', end: '19:00', cost: 800,
    field: 'Malta — boisko piaszczyste', lat: 52.4030, lng: 16.9760,
    desc: 'Piasek nad Maltą, dwa boiska. Gramy do dwóch wygranych setów, rotacja par. Poziom rekreacyjny, woda i dobry humor obowiązkowe.' },
  { title: 'Plażówka po pracy', sport: 'siatkówka plażowa', max: 8, days: 6, time: '18:30', end: '20:30', cost: 0,
    field: 'Plaża Rataje', lat: 52.3850, lng: 16.9620,
    desc: 'Luźne granie na piachu po pracy. Miksujemy składy, gramy krótkie sety. Za darmo — wpadaj uzupełnić ekipę.' },

  { title: 'Streetball 3x3', sport: 'koszykówka', max: 6, days: 4, time: '19:00', end: '20:30', cost: 0,
    field: 'Łęgi Dębińskie — boisko', lat: 52.3870, lng: 16.9080,
    desc: 'Koszykówka uliczna do 21 punktów, winner stays. Jedna obręcz, szybkie zmiany. Za darmo, wpadaj na parkiet.' },
  { title: 'Kosz 5v5 — pełne boisko', sport: 'koszykówka', max: 10, days: 8, time: '20:00', end: '21:30', cost: 1400,
    field: 'Hala Politechnika', lat: 52.4020, lng: 16.9490,
    desc: 'Pełnowymiarowe granie 5 na 5 w hali. Gramy na czas z sędzią-amatorem. Średni poziom, dobierzemy brakujących do kompletu.' },
];

async function run() {
  // 1) Players to fill rosters with.
  const { data: testUsers, error: uErr } = await supabase
    .from('profiles')
    .select('id, display_name')
    .like('email', 'test%@example.com');
  if (uErr) { console.error('✗ Could not read test users:', uErr.message); process.exit(1); }
  if (!testUsers || testUsers.length === 0) {
    console.error('✗ No test users found. Run `node scripts/seed-test-users.mjs` first.');
    process.exit(1);
  }
  console.log(`Found ${testUsers.length} test players.`);

  // 2) Wipe existing events (cascades participants/comments/results).
  const { error: dErr } = await supabase
    .from('events')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (dErr) { console.error('✗ Could not delete events:', dErr.message); process.exit(1); }
  console.log('Deleted all existing events.');

  // 3) Create the demo events, each filled.
  let made = 0;
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    const organizer = testUsers[i % testUsers.length];

    const { data: row, error: evErr } = await supabase
      .from('events')
      .insert({
        organizer_id: organizer.id,
        organizer_name: organizer.display_name || 'Organizator',
        sport: e.sport,
        field_id: null,
        field_name: e.field,
        lat: e.lat,
        lng: e.lng,
        title: e.title,
        description: e.desc,
        event_date: dateIn(e.days),
        event_time: e.time,
        end_time: e.end,
        max_players: e.max,
        external_count: 0,
        visibility: 'public',
        team_mode: 'brak',
        track_results: e.sport === 'piłka nożna',
        cost_grosz: e.cost,
        invite_only: false,
      })
      .select('id')
      .single();

    if (evErr) { console.error(`✗ ${e.title}:`, evErr.message); continue; }

    // Fill: organizer + a few real players (with avatars), then named guests.
    const target = Math.max(2, e.max - randInt(0, 2)); // mostly full, 0–2 free
    const others = shuffle(testUsers.filter((u) => u.id !== organizer.id));
    const realCount = Math.min(target - 1, others.length, randInt(3, 8));

    const rows = [];
    // organizer first
    rows.push({ user_id: organizer.id, name: organizer.display_name || 'Organizator', is_guest: false });
    for (let k = 0; k < realCount; k++) {
      rows.push({ user_id: others[k].id, name: others[k].display_name || 'Gracz', is_guest: false });
    }
    // guests fill the rest
    const guests = shuffle(GUEST_NAMES);
    let g = 0;
    while (rows.length < target && g < guests.length) {
      rows.push({ user_id: null, name: guests[g++], is_guest: true });
    }

    // One goalkeeper for football matches (≈70% of the time).
    const gkIndex = e.sport === 'piłka nożna' && Math.random() < 0.7 ? randInt(0, rows.length - 1) : -1;

    const participantRows = rows.map((r, idx) => ({
      event_id: row.id,
      user_id: r.user_id,
      name: r.name,
      is_guest: r.is_guest,
      is_reserve: false,
      is_goalkeeper: idx === gkIndex,
      status: 'potwierdzony',
    }));

    const { error: pErr } = await supabase.from('event_participants').insert(participantRows);
    if (pErr) { console.error(`   ⚠ participants for "${e.title}":`, pErr.message); }

    made++;
    console.log(`✓ ${e.title.padEnd(28)} ${rows.length}/${e.max} graczy · ${dateIn(e.days)} ${e.time}`);
  }

  console.log(`\nDone — created ${made} demo matches. Open the app to see a busy feed.\n`);
}

run().catch((err) => { console.error('\nFatal:', err.message || err); process.exit(1); });
