import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// docs/seo-geo-strategia.md, rozdział 3d: pytania w MiniFaq siedziały w
// <summary> bez żadnego nagłówka, więc `/faq` (i cztery inne strony, które
// reużywają ten komponent) miały H1, sześć/jeden H2 i ani jednego H3 —
// struktura nagłówków jest głównym sposobem, w jaki model dzieli długą
// stronę na cytowalne kawałki. Test czyta ŹRÓDŁO jako tekst (wzorem
// `ogImageJednoZrodlo.test.ts`), nie importuje pliku — Vitest w tym repo nie
// transformuje JSX w `.tsx` (`tsconfig.json` ma `jsx: "preserve"`).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const miniFaq = readFileSync(join(ROOT, 'src/components/tresc/MiniFaq.tsx'), 'utf8');

describe('MiniFaq — struktura nagłówków', () => {
  it('każde pytanie jest owinięte w <h3>', () => {
    expect(miniFaq).toMatch(/<h3[^>]*>\{item\.q\}<\/h3>/);
  });
});
