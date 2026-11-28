import { describe, it, expect } from 'vitest';
import { najpierwMoje } from '@/lib/turniejTabela';

describe('najpierwMoje', () => {
  it('przesuwa moje na początek, resztę zostawia w kolejności', () => {
    expect(najpierwMoje(['A', 'B', 'C', 'D'], (x) => x === 'C')).toEqual(['C', 'A', 'B', 'D']);
  });
  it('bez mojego nic nie zmienia', () => {
    expect(najpierwMoje(['A', 'B'], () => false)).toEqual(['A', 'B']);
  });
});
