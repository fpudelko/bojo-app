import { describe, it, expect } from 'vitest';
import { priorytetDlaTier } from '@/lib/sitemapTier';
import { WOJEWODZTWA } from '@/lib/wojewodztwa';

describe('priorytetDlaTier', () => {
  it('Tier 1 dostaje najwyższy priorytet', () => {
    expect(priorytetDlaTier(1)).toBe(0.7);
  });

  it('Tier 2 dostaje niższy priorytet niż Tier 1', () => {
    expect(priorytetDlaTier(2)).toBeLessThan(priorytetDlaTier(1));
  });

  // Sygnatura jest `1 | 2`, nie `number | null` — TypeScript odrzuca
  // `priorytetDlaTier(null)` na etapie kompilacji, więc nie ma tu czego
  // testować w runtime. `fields.seo_tier` jest `NOT NULL` z
  // `CHECK IN (1, 2, 3)` (migracja 112), a route.ts filtruje `.in([1, 2])`,
  // więc trzeciej ani czwartej wartości ta funkcja nigdy nie zobaczy.
});

describe('WOJEWODZTWA', () => {
  it('ma dokładnie 16 województw, bez duplikatów', () => {
    expect(WOJEWODZTWA.length).toBe(16);
    expect(new Set(WOJEWODZTWA).size).toBe(16);
  });
});
