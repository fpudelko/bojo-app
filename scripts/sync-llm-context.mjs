#!/usr/bin/env node
// sync-llm-context — copies docs/llm-context.md to frontend/public/ so that the
// file is served at bojo.pl/llm-context.md and llms.txt can link to it.
//
// docs/llm-context.md is the single source of truth; the public file is a build
// artifact that happens to be committed (Vercel serves public/ statically, so it
// has to exist in the repo). check-docs.mjs fails CI when the two drift apart.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'docs/llm-context.md';
const DEST = 'frontend/public/llm-context.md';

const source = readFileSync(join(ROOT, SRC), 'utf8');
writeFileSync(join(ROOT, DEST), source);
console.log(`sync-llm-context: ${SRC} → ${DEST} (${source.length} znaków)`);
