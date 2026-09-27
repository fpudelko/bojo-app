#!/usr/bin/env node
// jsonld-z-buildera: run a real builder from frontend/src/lib/structuredData.ts
// on given arguments and print the JSON-LD it produces.
//
// The builders are TypeScript behind the `@/` alias, so plain Node cannot
// import them. Vitest can: this script writes a throwaway test file, runs it,
// captures the output between markers and deletes the file in `finally`
// (nothing is left in the repo, even on failure). It is the exact procedure
// used on 2026-09-24 to prove the SportsEvent fix on real rows from the
// production database, turned into one command.
//
// Usage (from anywhere):
//   node jsonld-z-buildera.mjs --funkcja eventJsonLd \
//     --argumenty '["f1e98fe0-ca47-48ab-9b81-854ec20a5f76", {"sport":"piłka nożna","date":"2027-01-07","time":"18:00:00","visibility":"public","max_players":14,"cost_grosz":0,"created_at":"2026-09-04T08:18:47+00:00","zajete":3}]'
//   node jsonld-z-buildera.mjs --funkcja siteJsonLd --argumenty '["https://www.bojo.pl"]'
//   … | node sprawdz-jsonld.mjs          # validate the result
// Needs frontend/node_modules (cd frontend && npm ci).
//
// Not covered: the venue page's SportsActivityLocation is built inline in
// frontend/src/app/boisko/[id]/page.tsx, not in structuredData.ts. Check it
// on a rendered page instead (sprawdz-jsonld.mjs --url / --plik).

import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const FRONTEND = join(ROOT, 'frontend');

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

const funkcja = arg('--funkcja');
if (!funkcja || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(funkcja)) {
  console.error('Podaj --funkcja <nazwa eksportu z structuredData.ts>, np. eventJsonLd.');
  process.exit(2);
}
let argumenty = [];
try {
  if (arg('--argumenty')) argumenty = JSON.parse(arg('--argumenty'));
  else if (arg('--argumenty-plik')) argumenty = JSON.parse(readFileSync(arg('--argumenty-plik'), 'utf8'));
} catch (e) {
  console.error(`Argumenty to nie jest poprawny JSON: ${e.message}`);
  process.exit(2);
}
if (!Array.isArray(argumenty)) argumenty = [argumenty];
if (!existsSync(join(FRONTEND, 'node_modules'))) {
  console.error('Brak frontend/node_modules: uruchom najpierw `cd frontend && npm ci`.');
  process.exit(2);
}

const nazwaPliku = `__jsonld_tmp_${process.pid}.test.ts`;
const sciezka = join(FRONTEND, 'src', '__tests__', nazwaPliku);
const START = '@@JSONLD@@';
const KONIEC = '@@KONIEC@@';

// Arguments go in as a JSON literal and the function name is validated above,
// so nothing user-provided is spliced into code unescaped.
writeFileSync(sciezka, `import { it } from 'vitest';
import * as sd from '@/lib/structuredData';

it('jsonld z buildera', () => {
  const fn = (sd as Record<string, unknown>)[${JSON.stringify(funkcja)}];
  if (typeof fn !== 'function') throw new Error('Brak funkcji ${funkcja} w structuredData.ts');
  const wynik = (fn as (...a: unknown[]) => unknown)(...(${JSON.stringify(argumenty)} as unknown[]));
  process.stdout.write('\\n${START}' + JSON.stringify(wynik) + '${KONIEC}\\n');
});
`);

try {
  const r = spawnSync('npx', ['vitest', 'run', `src/__tests__/${nazwaPliku}`, '--reporter=verbose'], {
    cwd: FRONTEND,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const wyjscie = `${r.stdout}\n${r.stderr}`;
  const m = wyjscie.match(new RegExp(`${START}([\\s\\S]*?)${KONIEC}`));
  if (!m) {
    console.error('Builder nie oddał wyniku. Wyjście Vitesta:\n');
    console.error(wyjscie.split('\n').filter((l) => /Error|error|✗|×|FAIL/.test(l)).slice(0, 20).join('\n') || wyjscie.slice(-2000));
    process.exitCode = 1;
  } else {
    const wynik = JSON.parse(m[1]);
    if (wynik === null) console.error('Builder zwrócił null (np. mecz niepubliczny: eventJsonLd celowo nic nie emituje).');
    console.log(JSON.stringify(wynik, null, 2));
  }
} finally {
  try { unlinkSync(sciezka); } catch { /* already gone */ }
}
