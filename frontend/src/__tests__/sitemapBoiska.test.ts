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

  // Wiersze bez seo_tier (przed backfillem — kolumna miała DEFAULT 3, ale
  // stare zapytania mogą wciąż nosić NULL) dostają ostrożny priorytet,
  // nie taki sam jak dawne stałe 0.7 dla każdego boiska.
  it('brak tieru (NULL) dostaje najniższy priorytet, nie domyślne 0.7', () => {
    expect(priorytetDlaTier(null)).toBeLessThan(priorytetDlaTier(2));
  });
});

describe('WOJEWODZTWA', () => {
  it('ma dokładnie 16 województw, bez duplikatów', () => {
    expect(WOJEWODZTWA.length).toBe(16);
    expect(new Set(WOJEWODZTWA).size).toBe(16);
  });
});
