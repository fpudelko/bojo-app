import { describe, it, expect } from 'vitest';
import { MAP_FILTER_SPORTS, SPORT_CONFIG, FOCUS_SPORTS, FOCUS_SPORT_BY_SLUG } from '@/lib/sports';

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

describe('FOCUS_SPORT_BY_SLUG', () => {
  it('ma jeden slug na każdy sport z FOCUS_SPORTS, bez duplikatów', () => {
    expect(Object.keys(FOCUS_SPORT_BY_SLUG)).toHaveLength(FOCUS_SPORTS.length);
  });

  it('mapuje slug z powrotem na oryginalną wartość z bazy', () => {
    expect(FOCUS_SPORT_BY_SLUG['pilka-nozna']).toBe('piłka nożna');
    expect(FOCUS_SPORT_BY_SLUG['siatkowka-plazowa']).toBe('siatkówka plażowa');
  });

  it('nieznany slug nie zwraca niczego', () => {
    expect(FOCUS_SPORT_BY_SLUG['nieistniejacy-sport']).toBeUndefined();
  });
});
