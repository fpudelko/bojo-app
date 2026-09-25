import { describe, it, expect } from 'vitest';
import { zl } from '@/lib/kwota';

// W-5 (docs/faza1-przejscie-e2e-plan.md): jedna forma kwoty w całej ścieżce.
describe('zl', () => {
  it('zawsze dwa miejsca po PRZECINKU i „zł”, nigdy „PLN”', () => {
    expect(zl(0)).toBe('0,00 zł');
    expect(zl(1)).toBe('0,01 zł');
    expect(zl(2000)).toBe('20,00 zł');
    expect(zl(2050)).toBe('20,50 zł');
    expect(zl(1786)).toBe('17,86 zł');
    expect(zl(123456)).toBe('1234,56 zł');
  });
});
