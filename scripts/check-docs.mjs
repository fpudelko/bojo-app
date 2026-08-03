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
//   9. llm-context.md's "Stan na" marker matches the newest migration on disk

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
  SHOW_CUP: ['/turniej'],
  FEATURE_RESERVATIONS: ['/rezerwacje', '/obiekt'],
};

// ---------------------------------------------------------------------------
section('1. llms.txt → trasy istnieją');
const llms = read('frontend/public/llms.txt');
const llmsRoutes = [...llms.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
const sportSlugs = [...read('frontend/src/app/boiska/[sport]/page.tsx')
  .matchAll(/'([a-z-]+)':\s*\{ db:/g)].map((m) => m[1]);

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
  } else page = `frontend/src/app${route}/page.tsx`;
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
const migrationFiles = readdirSync(join(ROOT, 'supabase/migrations'));
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
const statedMigration = llmContext.match(/\*\*Stan na:\*\*.*?migracja `(\d{3})`/)?.[1];
if (!statedMigration) fail('llm-context.md: brak znacznika "**Stan na:** ... migracja `NNN`"');
else if (parseInt(statedMigration, 10) !== maxMigration)
  fail(`llm-context.md deklaruje migrację ${statedMigration}, a najnowsza na dysku to ${String(maxMigration).padStart(3, '0')} — zaktualizuj plik`);
else console.log(`  migracja ${statedMigration} zgodna ze stanem repo`);

// ---------------------------------------------------------------------------
console.log('');
if (failures) {
  console.error(`check-docs: ${failures} problem(ów). Dokumentacja rozjechała się z kodem.`);
  process.exit(1);
}
console.log('check-docs: OK — dokumentacja spójna z kodem.');
