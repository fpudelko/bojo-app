#!/usr/bin/env node
/**
 * Skleja prompt „Rewizja przed startem" z czterema dokumentami źródłowymi
 * w jeden plik do wklejenia jednym ruchem.
 *
 * Powód: brief jest bezwartościowy bez kontekstu, a zbieranie czterech plików
 * z repo za każdym razem to wystarczająca bariera, żeby tego nie zrobić.
 *
 * Wynik: rewizja-do-wklejenia.txt (rozszerzenie .txt celowo — to nie jest
 * dokument do czytania, tylko wsad, i nie ma podlegać walidatorowi linków).
 *
 * Uruchomienie: node scripts/build-rewizja.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Właściwy prompt to pierwszy blok ``` … ``` w docs/prompt-rewizja.md.
const prompt = read('docs/prompt-rewizja.md').split('```')[1].trim();

const DOCS = [
  ['docs/llm-context.md', 'Kontekst produktu (pisany dla modelu czytającego na zimno)'],
  ['docs/wizja.md',       'Wizja — DOKUMENT NADRZĘDNY w projekcie'],
  ['docs/funkcje.md',     'Stan funkcji i flagi'],
  ['BACKLOG.md',          'Backlog'],
];

const line = '='.repeat(72);

const body = DOCS.map(([path, title]) => [
  '', '', line, `DOKUMENT: ${title}`, `Ścieżka w repo: ${path}`, line, '',
  read(path).trim(), '',
].join('\n')).join('\n');

const out = [
  prompt, '', '', line,
  'MATERIAŁ ŹRÓDŁOWY — cztery dokumenty z repozytorium Bojo',
  line, body, '',
].join('\n');

writeFileSync(join(root, 'rewizja-do-wklejenia.txt'), out);
console.log(`rewizja-do-wklejenia.txt: ${out.length} znaków, ${DOCS.length} dokumentów`);
