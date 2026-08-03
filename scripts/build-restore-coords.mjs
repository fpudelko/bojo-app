#!/usr/bin/env node
/**
 * Odtwarza SQL przywracający ręcznie ustawione współrzędne boisk.
 *
 * Powód: 2026-06-13 przebieg workflow "Fix GPS Coordinates" (source=manual,
 * tryb zapisu) nadpisał lat/lng 59 obiektom wynikiem forward-geocodingu
 * adresu w Nominatim. Adres pokazuje wejście/budynek, nie boisko — pinezki
 * odjechały nawet o 3 km (POSiR Malta, POSiR Strzeszynek).
 *
 * Oryginalne, ręcznie dobrane współrzędne nigdy nie zniknęły: siedzą
 * w plikach seed w repo. Ten skrypt je wyciąga i generuje UPDATE-y
 * po ID, żeby dało się je przywrócić jedną wklejką w SQL Editor.
 *
 * Uruchomienie:  node scripts/build-restore-coords.mjs
 * Wynik:         supabase/przywroc-wspolrzedne.sql
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Pliki z ręcznie dobranymi pinezkami (source = 'manual').
const SEEDS = [
  'seed.sql',
  'seed-orliki.sql',
  'seed-rental-venues.sql',
  'seed-beach-volleyball.sql',
];

// Krotka INSERT-a: id, nazwa, adres, a zaraz po nich para współrzędnych.
// Wystarczy zakotwiczyć się na UUID i wziąć pierwsze dwie liczby po nim.
const TUPLE = /'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',\s*'((?:[^']|'')*)',\s*'(?:[^']|'')*',\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)/g;

const rows = [];
const seenIds = new Set();

for (const file of SEEDS) {
  let sql;
  try {
    sql = readFileSync(join(root, 'supabase', file), 'utf8');
  } catch {
    console.warn(`pominięto (brak pliku): ${file}`);
    continue;
  }
  let found = 0;
  for (const m of sql.matchAll(TUPLE)) {
    const [, id, name, lat, lng] = m;
    // Ten sam obiekt bywa w dwóch seedach — pierwszy wpis wygrywa.
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    rows.push({ id, name: name.replace(/''/g, "'"), lat, lng, file });
    found++;
  }
  console.log(`${file}: ${found} obiektów`);
}

if (!rows.length) {
  console.error('Nie znalazłem żadnych współrzędnych — sprawdź format seedów.');
  process.exit(1);
}

const out = [
  '-- ============================================================================',
  '-- BOJO — przywrócenie ręcznie dobranych współrzędnych boisk',
  '-- ============================================================================',
  '-- Plik generowany: node scripts/build-restore-coords.mjs — nie edytuj ręcznie.',
  '--',
  '-- Co naprawia: 2026-06-13 workflow "Fix GPS Coordinates" przeliczył lat/lng',
  '-- z adresu przez Nominatim dla obiektów source=manual (log: Fixed 59, OK 7,',
  '-- Errors 2). Adres wskazuje budynek albo wjazd, nie płytę boiska, więc',
  '-- pinezki przesunęły się o setki metrów do 3 km.',
  '--',
  `-- Zawiera ${rows.length} obiektów z plików: ${SEEDS.join(', ')}.`,
  '-- UPDATE po ID — nie tworzy nic nowego, nie rusza obiektów z OSM.',
  '--',
  '-- NAJPIERW podgląd: odkomentuj sekcję "PRZED" na dole, żeby zobaczyć,',
  '-- o ile każdy pin się ruszy, zanim cokolwiek zapiszesz.',
  '-- ============================================================================',
  '',
  'BEGIN;',
  '',
  'CREATE TEMP TABLE seed_coords (id UUID PRIMARY KEY, name TEXT, lat NUMERIC, lng NUMERIC) ON COMMIT DROP;',
  '',
  'INSERT INTO seed_coords (id, name, lat, lng) VALUES',
  rows
    .map((r, i) => `  ('${r.id}', '${r.name.replace(/'/g, "''")}', ${r.lat}, ${r.lng})${i === rows.length - 1 ? ';' : ','}`)
    .join('\n'),
  '',
  '-- Ile obiektów faktycznie odjechało i jak daleko (w metrach).',
  'SELECT',
  '  s.name,',
  '  round((',
  '    6371000 * sqrt(',
  '      power(radians(f.lat - s.lat), 2) +',
  '      power(radians(f.lng - s.lng) * cos(radians((f.lat + s.lat) / 2)), 2)',
  '    )',
  '  )::numeric) AS przesuniecie_m,',
  '  f.lat AS teraz_lat, f.lng AS teraz_lng,',
  '  s.lat AS seed_lat,  s.lng AS seed_lng',
  'FROM seed_coords s',
  'JOIN fields f ON f.id = s.id',
  'WHERE f.lat IS DISTINCT FROM s.lat OR f.lng IS DISTINCT FROM s.lng',
  'ORDER BY przesuniecie_m DESC;',
  '',
  '-- Właściwe przywrócenie.',
  'UPDATE fields f',
  'SET lat = s.lat, lng = s.lng',
  'FROM seed_coords s',
  'WHERE f.id = s.id',
  '  AND (f.lat IS DISTINCT FROM s.lat OR f.lng IS DISTINCT FROM s.lng);',
  '',
  '-- Zadowolony z listy powyżej? Zamień na COMMIT.',
  'ROLLBACK;',
  '',
].join('\n');

writeFileSync(join(root, 'supabase', 'przywroc-wspolrzedne.sql'), out);
console.log(`\nsupabase/przywroc-wspolrzedne.sql: ${rows.length} obiektów`);
