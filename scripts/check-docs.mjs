#!/usr/bin/env node
// check-docs — deterministic consistency check between docs and code.
// Zero dependencies, Node >= 18. Run from anywhere: node scripts/check-docs.mjs
//
// What it guards (each check exists because this exact drift happened before):
//   1. every route linked in llms.txt has a page.tsx
//   2. routes hidden behind feature flags leak into llms.txt / sitemap.ts
//   3. every feature flag export is documented in docs/funkcje.md
//   4. every relative .md link (and #anchor) resolves
//   5. migration numbers cited in docs/baza-danych.md exist on disk
//   6. table names listed in docs/baza-danych.md exist in migrations
//   7. frontend/public/llm-context.md is byte-identical to its source in docs/
//   8. llm-context.md still has every required section, changelog capped at 10
//   9. llm-context.md's "Stan na" marker — every field of it, not just the migration
//  12. every repo path and relative link cited in .claude/skills/**/*.md exists

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const section = (name) => console.log(`\n${name}`);

// Routes hidden behind flags. Kept here, not parsed from JSX, because the
// mapping flag -> route is a product decision, not something grep can infer.
// FEATURE_RESERVATIONS is env-driven and treated as OFF for public surfaces.
const FLAG_ROUTES = {
  SHOW_RECURRING: ['/cykliczne'],
  SHOW_TURNIEJE: ['/turnieje'],
  FEATURE_RESERVATIONS: ['/rezerwacje', '/obiekt'],
};

// ---------------------------------------------------------------------------
section('1. llms.txt → trasy istnieją');
const llms = read('frontend/public/llms.txt');
const llmsRoutes = [...llms.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
const sportSlugs = [...read('frontend/src/lib/sports.ts')
  .matchAll(/'([a-z-]+)':\s*\{ db:/g)].map((m) => m[1]);
const grajSlugs = [...read('frontend/src/content/graj.ts')
  .matchAll(/slug: '([a-z-]+)'/g)].map((m) => m[1]);
const miastaSlugs = [...read('frontend/src/content/miasta.ts')
  .matchAll(/slug: '([a-z-]+)'/g)].map((m) => m[1]);

for (const route of llmsRoutes) {
  let page;
  // Static files served straight from public/ (e.g. /llm-context.md) are not routes.
  if (/\.(md|txt)$/.test(route)) {
    const asset = `frontend/public${route}`;
    if (!existsSync(join(ROOT, asset))) fail(`llms.txt: linkuje ${route}, a nie ma ${asset}`);
    continue;
  }
  if (route === '/') page = 'frontend/src/app/page.tsx';
  else if (route.startsWith('/boiska/')) {
    const slug = route.slice('/boiska/'.length);
    if (!sportSlugs.includes(slug)) { fail(`llms.txt: slug sportu "${slug}" nie istnieje w SPORT_MAP`); continue; }
    page = 'frontend/src/app/boiska/[sport]/page.tsx';
  } else {
    // Landing lokalny /[sport]/[miasto] siedzi na pierwszym segmencie ścieżki,
    // więc rozpoznajemy go po tym, że pierwszy człon JEST slugiem sportu —
    // sprawdzane po /boiska/, żeby nie połknąć /boiska/<sport>.
    const czesci = route.slice(1).split('/');
    if (czesci.length === 2 && grajSlugs.includes(czesci[0])) {
      const [slug, miasto] = czesci;
      if (!miastaSlugs.includes(miasto)) {
        fail(`llms.txt: /${slug}/${miasto} — miasto "${miasto}" nie istnieje w content/miasta.ts`);
        continue;
      }
      page = 'frontend/src/app/[sport]/[miasto]/page.tsx';
    } else page = `frontend/src/app${route}/page.tsx`;
  }
  if (!existsSync(join(ROOT, page))) fail(`llms.txt: trasa ${route} nie ma ${page}`);
}
console.log(`  sprawdzono ${llmsRoutes.length} tras`);

// ---------------------------------------------------------------------------
section('2. trasy za flagami nie przeciekają do llms.txt / sitemap.ts');
const featuresTs = read('frontend/src/lib/features.ts');
const sitemapTs = read('frontend/src/app/sitemap.ts');
const flagStates = Object.fromEntries(
  [...featuresTs.matchAll(/export const (SHOW_\w+) = (true|false)/g)].map((m) => [m[1], m[2] === 'true']),
);
flagStates.FEATURE_RESERVATIONS = false; // env-driven, assume off publicly

for (const [flag, routes] of Object.entries(FLAG_ROUTES)) {
  if (flagStates[flag] === true) continue; // feature is live, listing it is fine
  for (const route of routes) {
    if (llmsRoutes.some((r) => r === route || r.startsWith(route + '/')))
      fail(`llms.txt reklamuje ${route}, a ${flag} jest wyłączona`);
    if (new RegExp(`\\\`?\\$\\{base\\}${route.replace(/\//g, '\\/')}\\\`?`).test(sitemapTs))
      fail(`sitemap.ts zgłasza ${route}, a ${flag} jest wyłączona`);
  }
}
console.log(`  sprawdzono ${Object.keys(FLAG_ROUTES).length} flag z trasami`);

// ---------------------------------------------------------------------------
section('3. każda flaga udokumentowana w docs/funkcje.md');
const funkcjeMd = read('docs/funkcje.md');
const allFlags = [
  ...featuresTs.matchAll(/export const (\w+) =/g),
  ...read('frontend/src/config/features.ts').matchAll(/export const ([A-Z_]+) =/g),
].map((m) => m[1]);
for (const flag of allFlags) {
  if (!new RegExp(`\\b${flag}\\b`).test(funkcjeMd))
    fail(`flaga ${flag} nie występuje w docs/funkcje.md`);
}
console.log(`  sprawdzono ${allFlags.length} flag`);

// ---------------------------------------------------------------------------
section('4. linki .md żywe (pliki + kotwice)');
const mdFiles = [
  ...readdirSync(join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`),
  'AGENTS.md', 'CLAUDE.md', 'README.md', 'BACKLOG.md', 'PRZEWODNIK.md',
];
// GitHub-style anchor: lowercase, drop everything except word chars/spaces/hyphens
// (unicode-aware so Polish diacritics survive), spaces -> hyphens.
const toAnchor = (h) => h.trim().toLowerCase()
  .replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
let linkCount = 0;
for (const file of mdFiles) {
  const text = read(file);
  const dir = dirname(file);
  for (const [, target] of text.matchAll(/\]\((\.{1,2}\/[^)]+)\)/g)) {
    linkCount++;
    const [path, anchor] = target.split('#');
    const targetPath = join(dir, path);
    if (!existsSync(join(ROOT, targetPath))) { fail(`${file}: martwy link ${target}`); continue; }
    if (anchor && targetPath.endsWith('.md')) {
      const anchors = [...read(targetPath).matchAll(/^#+\s+(.+)$/gm)].map((m) => toAnchor(m[1]));
      if (!anchors.includes(anchor)) fail(`${file}: kotwica #${anchor} nie istnieje w ${targetPath}`);
    }
  }
}
console.log(`  sprawdzono ${linkCount} linków w ${mdFiles.length} plikach`);

// ---------------------------------------------------------------------------
section('5. migracje cytowane w docs/baza-danych.md istnieją');
const bazaMd = read('docs/baza-danych.md');
// TYLKO `.sql`, i to posortowane. `readdirSync` zwraca wszystko, co leży
// w katalogu — a leży tam też `README.md`. Bez tego filtra jego proza wchodziła
// do `allMigrationSql` i liczenie tabel („CREATE TABLE minus DROP TABLE")
// doliczało tabelę z akapitu o dzienniku migracji. Kolejność katalogu bywa
// zależna od systemu plików, więc sortujemy wprost, zamiast na nią liczyć.
const migrationFiles = readdirSync(join(ROOT, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
const maxMigration = Math.max(...migrationFiles.map((f) => parseInt(f, 10)).filter(Number.isFinite));
const cited = new Set([...bazaMd.matchAll(/`(0\d{2})[_`]/g)].map((m) => m[1]));
for (const num of cited) {
  if (parseInt(num, 10) > maxMigration) continue; // future-convention examples like 058
  if (!migrationFiles.some((f) => f.startsWith(num + '_')))
    fail(`baza-danych.md cytuje migrację ${num}, której nie ma na dysku`);
}
console.log(`  sprawdzono ${cited.size} numerów migracji`);

// ---------------------------------------------------------------------------
section('6. tabele z docs/baza-danych.md istnieją w migracjach');
const allMigrationSql = migrationFiles
  .map((f) => read(`supabase/migrations/${f}`)).join('\n');
const tableRows = [...bazaMd.matchAll(/^\| `([a-z_]+)`(?: i \d.*)? \| `?\d{3}`? \|/gm)]
  .map((m) => m[1]);
for (const table of tableRows) {
  if (!new RegExp(`\\b${table}\\b`, 'i').test(allMigrationSql))
    fail(`tabela ${table} z baza-danych.md nie występuje w żadnej migracji`);
}
console.log(`  sprawdzono ${tableRows.length} tabel`);

// ---------------------------------------------------------------------------
section('7. kopia publiczna llm-context.md zgodna ze źródłem');
const llmContext = read('docs/llm-context.md');
const llmContextPublic = existsSync(join(ROOT, 'frontend/public/llm-context.md'))
  ? read('frontend/public/llm-context.md') : null;
if (llmContextPublic === null) fail('brak frontend/public/llm-context.md — uruchom: npm run sync:llm-context');
else if (llmContextPublic !== llmContext) fail('frontend/public/llm-context.md rozjechał się ze źródłem — uruchom: npm run sync:llm-context');
else console.log('  kopia identyczna ze źródłem');

// ---------------------------------------------------------------------------
section('8. szkielet llm-context.md kompletny');
// Sections a cold-reading model relies on. Renaming one is fine — update this list
// in the same commit, so the rename is a decision and not an accident.
const REQUIRED_SECTIONS = [
  'Jak czytać ten plik', 'Czym jest Bojo', 'Zasięg i skala', 'Status funkcji',
  'Mecz: model i widoczność',
  'Zapisy, pojemność, rezerwa', 'Płatności i karty sportowe', 'Grupy', 'Boiska i mapa',
  'Architektura', 'Czego Bojo NIE robi', 'Słownik pojęć', 'Gdzie szukać szczegółów',
  'Ostatnie zmiany',
];
const presentSections = [...llmContext.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
for (const wanted of REQUIRED_SECTIONS) {
  if (!presentSections.includes(wanted)) fail(`llm-context.md: brakuje sekcji "## ${wanted}"`);
}
// The changelog is capped on purpose: an unbounded log dilutes every retrieved chunk.
const changelogEntries = (llmContext.split('## Ostatnie zmiany')[1] ?? '').match(/^###\s+/gm) ?? [];
if (changelogEntries.length > 10)
  fail(`llm-context.md: ${changelogEntries.length} wpisów w "Ostatnie zmiany", limit to 10 — usuń najstarsze`);
console.log(`  sprawdzono ${REQUIRED_SECTIONS.length} sekcji, ${changelogEntries.length}/10 wpisów w logu`);

// ---------------------------------------------------------------------------
section('9. znacznik "Stan na" w llm-context.md aktualny');
// Forces a human/agent to re-read the file whenever the database moves.
//
// Do 2026-08-26 sprawdzany był TYLKO numer migracji, więc reszta znacznika
// dryfowała po cichu: przy migracji 125 stała tam data sprzed trzech dni,
// „45 tabel" (baza miała 53) i „775 testów" (było 822). Znacznik ma być
// stemplem świeżości, a stempel, którego nikt nie sprawdza, jest gorszy niż
// jego brak — mówi „sprawdzone" o rzeczy niesprawdzonej. Stąd zasada: każde
// pole znacznika musi dać się zweryfikować deterministycznie z dysku, a pole,
// którego nie da się (liczba testów — wymagałaby uruchomienia Vitesta), do
// znacznika nie wchodzi.
const marker = llmContext.match(
  /\*\*Stan na:\*\* (\d{4}-\d{2}-\d{2}) · migracja `(\d{3})` · (\d+) tabel[ei]?\s*$/m,
);
if (!marker) {
  fail('llm-context.md: znacznik ma mieć postać "**Stan na:** RRRR-MM-DD · migracja `NNN` · N tabel"');
} else {
  const [, statedDate, statedMigration, statedTables] = marker;

  // Data jest jedynym polem, którego nie da się wyprowadzić z dysku: nieaktualnej
  // daty w przeszłości NIC tu nie odróżni od poprawnej. Sprawdzamy więc tylko to,
  // co jest rozstrzygalne (format i data z przyszłości), a o świeżość dba numer
  // migracji i liczba tabel — one wymuszają dotknięcie znacznika, gdy baza się
  // rusza, i wtedy datę poprawia się przy okazji.
  const dzis = new Date().toISOString().slice(0, 10);
  if (Number.isNaN(Date.parse(statedDate))) fail(`llm-context.md: "${statedDate}" nie jest datą`);
  else if (statedDate > dzis) fail(`llm-context.md: data ${statedDate} jest z przyszłości`);

  if (parseInt(statedMigration, 10) !== maxMigration)
    fail(`llm-context.md deklaruje migrację ${statedMigration}, a najnowsza na dysku to ${String(maxMigration).padStart(3, '0')} — zaktualizuj plik`);

  // Liczba tabel liczona z migracji: CREATE TABLE minus DROP TABLE. Wynik
  // sprawdzony wprost na schemacie postawionym od zera przez
  // scripts/baza-testowa.sh (2026-08-26: 53 tabele w `public`, co do nazwy).
  const bezKomentarzy = allMigrationSql.replace(/--[^\n]*/g, '');
  const utworzone = new Set(
    [...bezKomentarzy.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)]
      .map((m) => m[1].toLowerCase()),
  );
  for (const m of bezKomentarzy.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi))
    utworzone.delete(m[1].toLowerCase());

  if (parseInt(statedTables, 10) !== utworzone.size)
    fail(`llm-context.md deklaruje ${statedTables} tabel, a z migracji wychodzi ${utworzone.size} — zaktualizuj znacznik`);

  if (!failures)
    console.log(`  data ${statedDate}, migracja ${statedMigration}, tabel: ${utworzone.size} — zgodne ze stanem repo`);
}

// ---------------------------------------------------------------------------
section('10. mobile-first: brak breakpointów max-width w frontend/src');
// AGENTS.md, "Konwencje": style bazowe są dla najmniejszego telefonu, rozszerzanie
// wyłącznie przez min-width (`sm:`/`md:`/`lg:` Tailwinda). `max-*:` i
// `@media (max-width: …)` odwracają tę zasadę — łapane tu, zanim wejdą do repo.
function* walk(dir) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(rel);
    else if (/\.(tsx?|css)$/.test(entry.name)) yield rel;
  }
}
const MAX_WIDTH_TAILWIND = /(?:^|["'`\s(])max-(?:sm|md|lg|xl|2xl):/;
const MAX_WIDTH_MEDIA = /@media[^)]*\(\s*max-width/;
let mobileFirstViolations = 0;
let mobileFirstFilesScanned = 0;
for (const rel of walk('frontend/src')) {
  mobileFirstFilesScanned++;
  const text = read(rel);
  text.split('\n').forEach((line, i) => {
    if (MAX_WIDTH_TAILWIND.test(line) || MAX_WIDTH_MEDIA.test(line)) {
      mobileFirstViolations++;
      fail(`${rel}:${i + 1}: breakpoint max-width w nowym kodzie — użyj min-width (mobile-first)`);
    }
  });
}
if (mobileFirstViolations === 0) console.log(`  sprawdzono ${mobileFirstFilesScanned} plików, zero breakpointów max-width`);

// ---------------------------------------------------------------------------
section('11. brak długiego myślnika (—) w treści widocznej dla użytkownika');
// AGENTS.md, "Konwencje": „—" nie jest naturalnie używany w polskim piśmie
// odręcznym ani potocznym i jest rozpoznawalnym sygnałem tekstu wygenerowanego
// przez model. Skanuje ten sam `frontend/src` co sekcja 10, ale z pominięciem
// komentarzy (`//`, `/* … */`, `{/* … */}`) — te nie renderują się użytkownikowi,
// więc nie niosą tego ryzyka i piszemy je swobodnie, tak jak resztę dokumentacji.
//
// Śledzenie bloku komentarza jest linijkowe, nie przez pełny parser AST — nie
// łapie długiego myślnika w kodzie stojącym na tej samej linii co OTWARCIE
// wielolinijkowego /*… (rzadkie w tym stylu kodu), ale to jest fałszywy
// negatyw, nie fałszywy pozytyw: bezpieczniejsza strona pomyłki dla bramki CI.
let emDashViolations = 0;
let emDashFilesScanned = 0;
for (const rel of walk('frontend/src')) {
  if (!/\.tsx?$/.test(rel)) continue;
  // Testy (Vitest) nie są treścią strony — asercje na fixture'ach ze starym
  // tekstem po prostu przestaną przechodzić, gdy treść źródłowa się zmieni,
  // i to jest wtedy sygnał do poprawienia TEGO testu, nie tej reguły.
  if (rel.includes('__tests__') || /\.test\.tsx?$/.test(rel)) continue;
  emDashFilesScanned++;
  let inBlockComment = false;
  read(rel).split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    // Otwarcie bloku (`/* …` albo JSX `{/* …`) bez zamknięcia na tej samej
    // linii MUSI ustawić inBlockComment PRZED pominięciem linii — wcześniej
    // osobny warunek `startsWith('{/*')` wychodził wcześniej (`return`) i nigdy
    // nie ustawiał flagi, więc wielolinijkowy komentarz JSX `{/* … */}` mylił
    // TREŚĆ KOMENTARZA (linie 2., 3. …) z kodem.
    if (line.includes('/*') && !line.includes('*/')) { inBlockComment = true; return; }
    // Usuń komentarze jednolinijkowe przed sprawdzeniem: {/* … */}, /* … */, // …
    const codeOnly = line
      .replace(/\{\/\*.*?\*\/\}/g, '')
      .replace(/\/\*.*?\*\//g, '')
      .split('//')[0];
    if (codeOnly.includes('—')) {
      emDashViolations++;
      fail(`${rel}:${i + 1}: długi myślnik w treści — zastąp przecinkiem, dwukropkiem, średnikiem albo nowym zdaniem (AGENTS.md, „Konwencje")`);
    }
  });
}
if (emDashViolations === 0) console.log(`  sprawdzono ${emDashFilesScanned} plików, zero długich myślników w treści`);

// ---------------------------------------------------------------------------
section('12. ścieżki i linki w skillach (.claude/skills) żywe');
// Skille to dokumentacja dla agentów: mówią „popraw `frontend/src/lib/structuredData.ts`”
// albo „uruchom `scripts/gsc-okazje.mjs`”. Gdy plik się przeniesie, skill dalej to
// mówi, pewnym tonem, i agent szuka w próżni. Sprawdzamy dwie rzeczy: ścieżki
// z repo w `backtickach` (od katalogu głównego) oraz ścieżki względne skilla
// (`references/…`, `scripts/…`, `../inny-skill/…`) i linki markdown.
function* walkMd(dir) {
  if (!existsSync(join(ROOT, dir))) return;
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMd(rel);
    else if (entry.name.endsWith('.md')) yield rel;
  }
}
const Z_REPO = /^(frontend|scripts|docs|supabase|\.claude|\.github)\//;
const Z_SKILLA = /^(references|scripts|evals|\.\.)\//;
let skillPaths = 0;
for (const rel of walkMd('.claude/skills')) {
  const text = read(rel);
  const skillDir = rel.split('/').slice(0, 3).join('/'); // .claude/skills/<skill>
  const kandydaci = [
    ...[...text.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]),
    ...[...text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]).filter((l) => !/^https?:/.test(l)),
  ];
  for (let p of kandydaci) {
    p = p.replace(/[.,:;)]+$/, '').replace(/:\d+$/, '');
    if (/[<>*{}…]|\$/.test(p)) continue; // placeholders and globs
    let cel = null;
    if (Z_REPO.test(p)) cel = p;
    else if (Z_SKILLA.test(p)) cel = join(p.startsWith('../') ? join(skillDir, 'references') : skillDir, p);
    else if (p.startsWith('./') || p.endsWith('.md')) cel = join(dirname(rel), p);
    if (!cel) continue;
    skillPaths++;
    // A path cited from a references/ file may be relative to the skill root.
    const alternatywa = join(skillDir, p);
    if (!existsSync(join(ROOT, cel)) && !existsSync(join(ROOT, alternatywa)) && !existsSync(join(ROOT, dirname(rel), p))) {
      fail(`${rel}: ścieżka \`${p}\` nie istnieje`);
    }
  }
}
console.log(`  sprawdzono ${skillPaths} ścieżek w skillach`);

// ---------------------------------------------------------------------------
console.log('');
if (failures) {
  console.error(`check-docs: ${failures} problem(ów). Dokumentacja rozjechała się z kodem.`);
  process.exit(1);
}
console.log('check-docs: OK — dokumentacja spójna z kodem.');
