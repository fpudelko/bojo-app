import { describe, it, expect } from 'vitest';
import { slugify, isUuid } from '@/lib/utils';

describe('slugify', () => {
  it('converts basic name to slug', () => {
    expect(slugify('Orlik Rataje')).toBe('orlik-rataje');
  });

  it('strips Polish diacritics', () => {
    expect(slugify('piłka nożna')).toBe('pilka-nozna');
    expect(slugify('siatkówka plażowa')).toBe('siatkowka-plazowa');
    expect(slugify('Hala Ząbkowska')).toBe('hala-zabkowska');
  });

  it('handles ł correctly', () => {
    expect(slugify('Łódź')).toBe('lodz');
    expect(slugify('piłka ręczna')).toBe('pilka-reczna');
  });

  it('collapses multiple spaces and special chars into single dash', () => {
    expect(slugify('ul. Dąbrowskiego 79A')).toBe('ul-dabrowskiego-79a');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  Boisko  ')).toBe('boisko');
  });

  it('is deterministic (same input → same output)', () => {
    const name = 'Boisko Sportowe Reymonta';
    expect(slugify(name)).toBe(slugify(name));
  });
});

describe('isUuid', () => {
  it('recognises valid UUIDs', () => {
    expect(isUuid('b1a2c3d4-0001-0001-0001-000000000001')).toBe(true);
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects slugs', () => {
    expect(isUuid('orlik-rataje')).toBe(false);
    expect(isUuid('pilka-nozna')).toBe(false);
  });

  it('rejects partial or malformed UUIDs', () => {
    expect(isUuid('b1a2c3d4-0001')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
