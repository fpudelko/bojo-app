import { describe, it, expect } from 'vitest';
import { MAP_FILTER_SPORTS, SPORT_CONFIG } from '@/lib/sports';

describe('MAP_FILTER_SPORTS', () => {
  it('ma dokładnie sześć wartości', () => {
    expect(MAP_FILTER_SPORTS).toHaveLength(6);
  });

  it('każda wartość jest kluczem SPORT_CONFIG', () => {
    for (const sport of MAP_FILTER_SPORTS) {
      expect(Object.keys(SPORT_CONFIG)).toContain(sport);
    }
  });

  it('zawiera wielofunkcyjne i piłkę ręczną — mają pinezki na mapie, ale nie dało się ich dotąd wybrać', () => {
    expect(MAP_FILTER_SPORTS).toContain('wielofunkcyjne');
    expect(MAP_FILTER_SPORTS).toContain('piłka ręczna');
  });

  it('nie ma duplikatów', () => {
    expect(new Set(MAP_FILTER_SPORTS).size).toBe(MAP_FILTER_SPORTS.length);
  });
});
