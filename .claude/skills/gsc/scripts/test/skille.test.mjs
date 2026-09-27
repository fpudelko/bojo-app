// Frontmatter of every skill in the repo must load. A plain YAML scalar with
// ": " inside (e.g. "pilnuje cyklu: poprawka → …") is a YAML error, and a skill
// whose frontmatter does not parse is silently never offered to the model.
// That exact bug was in the first draft of `gsc` (caught 2026-09-26 by the
// skill-creator validator); Node has no YAML parser, so this checks the rules
// that matter for the one-line form used here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/mapa-bojo.mjs';

const KATALOG = join(ROOT, '.claude', 'skills');

test('każdy skill ma poprawny frontmatter', () => {
  const skille = readdirSync(KATALOG, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(KATALOG, d.name, 'SKILL.md')));
  assert.ok(skille.length >= 4);
  for (const d of skille) {
    const tekst = readFileSync(join(KATALOG, d.name, 'SKILL.md'), 'utf8');
    const m = tekst.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(m, `${d.name}: brak frontmattera`);
    const pola = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
    assert.equal(pola.name, d.name, `${d.name}: name ≠ nazwa katalogu`);
    assert.match(pola.name, /^[a-z0-9-]+$/);
    const opis = pola.description ?? '';
    assert.ok(opis.length > 50 && opis.length <= 1024, `${d.name}: opis ${opis.length} znaków`);
    const wCudzyslowie = /^(["']).*\1$/.test(opis);
    assert.ok(wCudzyslowie || !/: /.test(opis), `${d.name}: „: ” w opisie bez cudzysłowu psuje YAML`);
    assert.ok(!/[<>]/.test(opis), `${d.name}: nawiasy ostre w opisie`);
  }
});
